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
                var carTrackResponse = JsonSerializer.Deserialize<CarTrackApiResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (carTrackResponse?.Data == null)
                {
                    return new List<VehicleLocationDto>();
                }

                var vehicles = carTrackResponse.Data.Select(v => new VehicleLocationDto
                {
                    VehicleId = v.VehicleId ?? string.Empty,
                    VehicleName = v.Name,
                    Location = v.Location != null ? new LocationDto
                    {
                        Latitude = v.Location.Latitude,
                        Longitude = v.Location.Longitude,
                        Address = v.Location.Address,
                        Updated = v.Location.Updated
                    } : null,
                    Speed = v.Speed ?? 0,
                    Heading = v.Heading ?? 0,
                    Status = DetermineVehicleStatus(v.Speed, v.Location?.Updated),
                    LastUpdate = v.Location?.Updated
                }).ToList();

                _logger.LogInformation($"Successfully fetched {vehicles.Count} vehicle locations");
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
                    VehiclesOffline = vehicles.Count(v => v.Status == "offline"),
                    Vehicles = vehicles,
                    LastUpdate = DateTime.UtcNow
                };

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

        private string DetermineVehicleStatus(double? speed, DateTime? lastUpdate)
        {
            if (lastUpdate == null || DateTime.UtcNow.Subtract(lastUpdate.Value).TotalMinutes > 30)
            {
                return "offline";
            }

            if (speed.HasValue && speed.Value > 5) // Moving if speed > 5 km/h
            {
                return "moving";
            }

            return "stopped";
        }

        // CarTrack API response models
        private class CarTrackApiResponse
        {
            public List<CarTrackVehicle>? Data { get; set; }
        }

        private class CarTrackVehicle
        {
            public string? VehicleId { get; set; }
            public string? Name { get; set; }
            public CarTrackLocation? Location { get; set; }
            public double? Speed { get; set; }
            public double? Heading { get; set; }
            public string? Status { get; set; }
        }

        private class CarTrackLocation
        {
            public double Latitude { get; set; }
            public double Longitude { get; set; }
            public string? Address { get; set; }
            public DateTime Updated { get; set; }
        }
    }
}
