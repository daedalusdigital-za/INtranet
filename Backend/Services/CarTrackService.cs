using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using ProjectTracker.API.DTOs.Logistics;

namespace ProjectTracker.API.Services
{
    public interface ICarTrackService
    {
        Task<List<VehicleLocationDto>> GetAllVehicleLocationsAsync();
        Task<VehicleLocationDto?> GetVehicleLocationAsync(string carTrackId);
        Task<FleetStatusDto> GetFleetStatusAsync();
        Task<TripTrackingDto?> TrackActiveTripAsync(int loadId);
        Task<List<CarTrackVehicleData>> GetRawVehicleDataAsync();
        Task<LivestreamResponseDto?> GetVehicleLivestreamAsync(string registration, int[] cameras);
        Task<List<VisionVehicleDto>> GetVisionEnabledVehiclesAsync();
    }

    // DTO for raw CarTrack vehicle data used in sync
    public class CarTrackVehicleData
    {
        public string VehicleId { get; set; } = string.Empty;
        public string? Registration { get; set; }
        public string? ChassisNumber { get; set; }
        public string? DriverFirstName { get; set; }
        public string? DriverLastName { get; set; }
        public string? Status { get; set; }
    }

    public class CarTrackService : ICarTrackService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<CarTrackService> _logger;
        private readonly string _baseUrl;
        private readonly string _username;
        private readonly string _password;

        public CarTrackService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<CarTrackService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;

            _baseUrl = configuration["CarTrack:BaseUrl"] ?? "https://fleetapi-za.cartrack.com/rest/";
            _username = configuration["CarTrack:Username"] ?? "ACCE00008";
            _password = configuration["CarTrack:Password"] ?? "a5aef0a82cd3babec9fb2cb3281d7accc984f5267e67d4573c8dc443b03aef82";

            // Configure HTTP client
            _httpClient.BaseAddress = new Uri(_baseUrl);
            _httpClient.Timeout = TimeSpan.FromSeconds(30);

            // Set up basic authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);
            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        public async Task<List<VehicleLocationDto>> GetAllVehicleLocationsAsync()
        {
            try
            {
                _logger.LogInformation("Fetching all vehicle locations from CarTrack");

                var response = await _httpClient.GetAsync("vehicles/status?limit=1000");

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"CarTrack API returned status code: {response.StatusCode}");
                    return new List<VehicleLocationDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                _logger.LogDebug($"CarTrack API response: {content.Substring(0, Math.Min(500, content.Length))}...");
                
                var carTrackResponse = JsonSerializer.Deserialize<CarTrackApiResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (carTrackResponse?.Data == null)
                {
                    _logger.LogWarning("CarTrack API returned null data");
                    return new List<VehicleLocationDto>();
                }

                _logger.LogInformation($"CarTrack returned {carTrackResponse.Data.Count} vehicles");

                var vehicles = carTrackResponse.Data.Select(v => {
                    DateTime? lastUpdate = null;
                    if (!string.IsNullOrEmpty(v.Location?.Updated))
                    {
                        if (DateTime.TryParse(v.Location.Updated, out var parsed))
                            lastUpdate = parsed;
                    }
                    else if (!string.IsNullOrEmpty(v.EventTs))
                    {
                        if (DateTime.TryParse(v.EventTs, out var parsed))
                            lastUpdate = parsed;
                    }

                    var driverName = "";
                    if (v.Driver != null && !string.IsNullOrEmpty(v.Driver.FirstName))
                    {
                        driverName = $"{v.Driver.FirstName} {v.Driver.LastName}".Trim();
                    }

                    return new VehicleLocationDto
                    {
                        VehicleId = v.VehicleId?.ToString() ?? string.Empty,
                        VehicleName = v.Registration ?? $"Vehicle {v.VehicleId}",
                        RegistrationNumber = v.Registration,
                        CurrentDriverName = driverName,
                        Location = v.Location != null ? new LocationDto
                        {
                            Latitude = v.Location.Latitude ?? 0,
                            Longitude = v.Location.Longitude ?? 0,
                            Address = v.Location.PositionDescription ?? "Unknown location",
                            Updated = lastUpdate ?? DateTime.UtcNow
                        } : null,
                        Speed = v.Speed ?? 0,
                        Heading = v.Bearing ?? 0,
                        Status = DetermineVehicleStatus(v.Speed, v.Ignition, lastUpdate),
                        LastUpdate = lastUpdate
                    };
                }).ToList();

                _logger.LogInformation($"Successfully processed {vehicles.Count} vehicle locations");
                return vehicles;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching vehicle locations from CarTrack");
                return new List<VehicleLocationDto>();
            }
        }

        public async Task<VehicleLocationDto?> GetVehicleLocationAsync(string carTrackId)
        {
            try
            {
                _logger.LogInformation($"Fetching location for vehicle: {carTrackId}");

                var allVehicles = await GetAllVehicleLocationsAsync();
                var vehicle = allVehicles.FirstOrDefault(v => v.VehicleId == carTrackId);

                if (vehicle == null)
                {
                    _logger.LogWarning($"Vehicle {carTrackId} not found in CarTrack response");
                }

                return vehicle;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching vehicle location for {carTrackId}");
                return null;
            }
        }

        public async Task<FleetStatusDto> GetFleetStatusAsync()
        {
            try
            {
                var vehicles = await GetAllVehicleLocationsAsync();

                var status = new FleetStatusDto
                {
                    TotalVehicles = vehicles.Count,
                    VehiclesMoving = vehicles.Count(v => v.Status == "moving"),
                    VehiclesStopped = vehicles.Count(v => v.Status == "stopped"),
                    VehiclesIdling = vehicles.Count(v => v.Status == "idling"),
                    VehiclesOffline = vehicles.Count(v => v.Status == "offline"),
                    Vehicles = vehicles,
                    LastUpdate = DateTime.UtcNow
                };

                _logger.LogInformation($"Fleet status: {status.TotalVehicles} total, {status.VehiclesMoving} moving, {status.VehiclesStopped} stopped, {status.VehiclesIdling} idling, {status.VehiclesOffline} offline");

                return status;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching fleet status");
                return new FleetStatusDto
                {
                    LastUpdate = DateTime.UtcNow
                };
            }
        }

        public async Task<TripTrackingDto?> TrackActiveTripAsync(int loadId)
        {
            // This method would need access to the database to get load details
            // It should be implemented in a service that has access to both CarTrack and the database
            _logger.LogWarning("TrackActiveTripAsync requires database access and should be implemented in a higher-level service");
            return null;
        }

        public async Task<List<CarTrackVehicleData>> GetRawVehicleDataAsync()
        {
            try
            {
                _logger.LogInformation("Fetching raw vehicle data from CarTrack for sync");

                var response = await _httpClient.GetAsync("vehicles/status?limit=1000");

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"CarTrack API returned status code: {response.StatusCode}");
                    return new List<CarTrackVehicleData>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var carTrackResponse = JsonSerializer.Deserialize<CarTrackApiResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (carTrackResponse?.Data == null)
                {
                    return new List<CarTrackVehicleData>();
                }

                return carTrackResponse.Data.Select(v => {
                    DateTime? lastUpdate = null;
                    if (!string.IsNullOrEmpty(v.Location?.Updated) && DateTime.TryParse(v.Location.Updated, out var parsed))
                        lastUpdate = parsed;
                    else if (!string.IsNullOrEmpty(v.EventTs) && DateTime.TryParse(v.EventTs, out var parsed2))
                        lastUpdate = parsed2;

                    return new CarTrackVehicleData
                    {
                        VehicleId = v.VehicleId?.ToString() ?? string.Empty,
                        Registration = v.Registration,
                        ChassisNumber = v.ChassisNumber,
                        DriverFirstName = v.Driver?.FirstName,
                        DriverLastName = v.Driver?.LastName,
                        Status = DetermineVehicleStatus(v.Speed, v.Ignition, lastUpdate)
                    };
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching raw vehicle data from CarTrack");
                return new List<CarTrackVehicleData>();
            }
        }

        public async Task<LivestreamResponseDto?> GetVehicleLivestreamAsync(string registration, int[] cameras)
        {
            try
            {
                _logger.LogInformation("Requesting livestream for vehicle {Registration} with cameras {Cameras}", 
                    registration, string.Join(",", cameras));

                var requestBody = new { camera = cameras };
                var jsonContent = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"vision/livestream/{registration}", content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("CarTrack Vision API returned {StatusCode} for {Registration}: {Error}", 
                        response.StatusCode, registration, errorContent);
                    
                    if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                    {
                        _logger.LogWarning("CarTrack Vision API not enabled for this account");
                        // Return a response with error information instead of null
                        return new LivestreamResponseDto
                        {
                            VehicleRegistration = registration,
                            Error = $"Your CarTrack account ({_username}) does not have Vision API enabled. Please contact your CarTrack sales representative to enable this feature, or update the CarTrack credentials in appsettings.json with an account that has Vision access.",
                            ErrorCode = "VISION_NOT_ENABLED"
                        };
                    }
                    
                    if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        _logger.LogWarning("CarTrack Vision API authentication failed");
                        return new LivestreamResponseDto
                        {
                            VehicleRegistration = registration,
                            Error = "CarTrack API authentication failed. Please check the username and password in appsettings.json.",
                            ErrorCode = "AUTH_FAILED"
                        };
                    }
                    return null;
                }

                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("CarTrack Vision API response: {Response}", responseContent);

                var visionResponse = JsonSerializer.Deserialize<CarTrackVisionResponse>(responseContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (visionResponse?.Data == null)
                {
                    return null;
                }

                var result = new LivestreamResponseDto
                {
                    VehicleRegistration = registration,
                    Streams = visionResponse.Data.Select(stream => new LivestreamUrlDto
                    {
                        CameraId = stream.Camera,
                        CameraName = GetCameraName(stream.Camera),
                        StreamUrl = stream.StreamUrl ?? stream.Url ?? string.Empty,
                        ThumbnailUrl = stream.ThumbnailUrl
                    }).ToList()
                };

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching livestream for vehicle {Registration}", registration);
                return null;
            }
        }

        public async Task<List<VisionVehicleDto>> GetVisionEnabledVehiclesAsync()
        {
            try
            {
                // Get all vehicles first
                var allVehicles = await GetRawVehicleDataAsync();
                
                // Return all vehicles as potential Vision-enabled vehicles
                // The actual Vision capability will be determined when trying to stream
                return allVehicles.Select(v => new VisionVehicleDto
                {
                    VehicleId = v.VehicleId,
                    Registration = v.Registration ?? string.Empty,
                    VehicleName = v.Registration,
                    HasVision = true, // Assume all have Vision, will fail gracefully if not
                    AvailableCameras = new List<int> { 1, 2, 3, 4, 5, 6, 7, 8 } // Default all cameras
                }).Where(v => !string.IsNullOrEmpty(v.Registration)).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching Vision-enabled vehicles");
                return new List<VisionVehicleDto>();
            }
        }

        private static string GetCameraName(int cameraId)
        {
            return cameraId switch
            {
                1 => "Front Camera",
                2 => "Rear Camera",
                3 => "Driver Camera",
                4 => "Cabin Camera",
                5 => "Left Side Camera",
                6 => "Right Side Camera",
                7 => "Cargo Camera",
                8 => "Auxiliary Camera",
                _ => $"Camera {cameraId}"
            };
        }

        private string DetermineVehicleStatus(double? speed, bool? ignition, DateTime? lastUpdate)
        {
            if (lastUpdate == null || DateTime.UtcNow.Subtract(lastUpdate.Value).TotalHours > 24)
            {
                return "offline";
            }

            if (speed.HasValue && speed.Value > 5) // Moving if speed > 5 km/h
            {
                return "moving";
            }

            if (ignition == true)
            {
                return "idling";
            }

            return "stopped";
        }

        // CarTrack API response models (using snake_case to match API)
        private class CarTrackApiResponse
        {
            public List<CarTrackVehicle>? Data { get; set; }
        }

        private class CarTrackVehicle
        {
            [System.Text.Json.Serialization.JsonPropertyName("vehicle_id")]
            public long? VehicleId { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("registration")]
            public string? Registration { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("chassis_number")]
            public string? ChassisNumber { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("speed")]
            public double? Speed { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("bearing")]
            public double? Bearing { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("ignition")]
            public bool? Ignition { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("event_ts")]
            public string? EventTs { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("location")]
            public CarTrackLocation? Location { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("driver")]
            public CarTrackDriver? Driver { get; set; }
        }

        private class CarTrackLocation
        {
            [System.Text.Json.Serialization.JsonPropertyName("latitude")]
            public double? Latitude { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("longitude")]
            public double? Longitude { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("position_description")]
            public string? PositionDescription { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("updated")]
            public string? Updated { get; set; }
        }

        private class CarTrackDriver
        {
            [System.Text.Json.Serialization.JsonPropertyName("first_name")]
            public string? FirstName { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("last_name")]
            public string? LastName { get; set; }
        }

        // Vision API response models
        private class CarTrackVisionResponse
        {
            [System.Text.Json.Serialization.JsonPropertyName("data")]
            public List<CarTrackVisionStream>? Data { get; set; }
        }

        private class CarTrackVisionStream
        {
            [System.Text.Json.Serialization.JsonPropertyName("camera")]
            public int Camera { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("stream_url")]
            public string? StreamUrl { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("url")]
            public string? Url { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("thumbnail_url")]
            public string? ThumbnailUrl { get; set; }
        }
    }
}
