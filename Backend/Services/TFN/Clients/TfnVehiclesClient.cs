using ProjectTracker.API.Services.TFN;
using System.Text.Json;

namespace ProjectTracker.API.Services.TFN.Clients
{
    public class TfnVehiclesClient
    {
        private readonly HttpClient _httpClient;
        private readonly TfnTokenService _tokenService;
        private readonly ILogger<TfnVehiclesClient> _logger;
        private readonly IConfiguration _configuration;

        public TfnVehiclesClient(
            HttpClient httpClient,
            TfnTokenService tokenService,
            ILogger<TfnVehiclesClient> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _tokenService = tokenService;
            _logger = logger;
            _configuration = configuration;

            var baseUrl = _configuration["TFN:BaseUrl"] ?? "https://api.tfn.co.za";
            _httpClient.BaseAddress = new Uri(baseUrl);
        }

        /// <summary>
        /// Get all vehicles from TFN
        /// </summary>
        public async Task<List<TfnVehicleDto>?> GetVehiclesAsync()
        {
            try
            {
                var token = await _tokenService.GetValidTokenAsync();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Failed to get valid TFN token");
                    return null;
                }

                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";
                var customerNumber = Uri.EscapeDataString(_configuration["TFN:CustomerNumber"] ?? "");
                
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                // Try singular endpoint first, then plural as fallback
                var response = await _httpClient.GetAsync($"/api/Vehicle?customerNumber={customerNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Vehicle (singular) endpoint failed: {StatusCode} - {Error}, trying Vehicles (plural)", 
                        response.StatusCode, error);
                    
                    // Try plural endpoint
                    response = await _httpClient.GetAsync($"/api/Vehicles?customerNumber={customerNumber}&api-version={apiVersion}");
                    if (!response.IsSuccessStatusCode)
                    {
                        error = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Failed to get vehicles from TFN (both endpoints): {StatusCode} - {Error}", 
                            response.StatusCode, error);
                        return null;
                    }
                }

                var jsonContent = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Vehicles response received, length={Length}, preview={Preview}", 
                    jsonContent.Length, jsonContent.Length > 300 ? jsonContent[..300] : jsonContent);
                
                List<TfnVehicleDto>? vehicles = null;
                var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                try
                {
                    vehicles = JsonSerializer.Deserialize<List<TfnVehicleDto>>(jsonContent, jsonOptions);
                }
                catch
                {
                    // Try as wrapper object
                    try
                    {
                        using var doc = JsonDocument.Parse(jsonContent);
                        foreach (var prop in doc.RootElement.EnumerateObject())
                        {
                            if (prop.Value.ValueKind == System.Text.Json.JsonValueKind.Array)
                            {
                                vehicles = JsonSerializer.Deserialize<List<TfnVehicleDto>>(prop.Value.GetRawText(), jsonOptions);
                                break;
                            }
                        }
                    }
                    catch (Exception innerEx)
                    {
                        _logger.LogError(innerEx, "Could not parse TFN vehicles response");
                    }
                }
                
                _logger.LogInformation("Retrieved {Count} vehicles from TFN", vehicles?.Count ?? 0);
                return vehicles;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vehicles from TFN");
                return null;
            }
        }

        /// <summary>
        /// Get specific vehicle by registration
        /// </summary>
        public async Task<TfnVehicleDto?> GetVehicleAsync(string registration)
        {
            try
            {
                var token = await _tokenService.GetValidTokenAsync();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Failed to get valid TFN token");
                    return null;
                }

                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";
                var customerNumber = Uri.EscapeDataString(_configuration["TFN:CustomerNumber"] ?? "");
                
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.GetAsync($"/api/Vehicle/{registration}?customerNumber={customerNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get vehicle {Registration} from TFN: {StatusCode} - {Error}", 
                        registration, response.StatusCode, error);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<TfnVehicleDto>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vehicle {Registration} from TFN", registration);
                return null;
            }
        }

        /// <summary>
        /// Add or update vehicle in TFN
        /// </summary>
        public async Task<bool> AddOrUpdateVehicleAsync(TfnVehicleDto vehicle, bool isUpdate = false)
        {
            try
            {
                var token = await _tokenService.GetValidTokenAsync();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Failed to get valid TFN token");
                    return false;
                }

                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";
                var customerNumber = Uri.EscapeDataString(_configuration["TFN:CustomerNumber"] ?? "");
                
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                HttpResponseMessage response;
                if (isUpdate)
                {
                    response = await _httpClient.PutAsJsonAsync($"/api/Vehicle?customerNumber={customerNumber}&api-version={apiVersion}", vehicle);
                }
                else
                {
                    response = await _httpClient.PostAsJsonAsync($"/api/Vehicle?customerNumber={customerNumber}&api-version={apiVersion}", vehicle);
                }

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to {Action} vehicle in TFN: {StatusCode} - {Error}", 
                        isUpdate ? "update" : "add", response.StatusCode, error);
                    return false;
                }

                _logger.LogInformation("Successfully {Action} vehicle {Registration} in TFN", 
                    isUpdate ? "updated" : "added", vehicle.Registration);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error {Action} vehicle in TFN", isUpdate ? "updating" : "adding");
                return false;
            }
        }
    }

    /// <summary>
    /// DTO matching TFN API /api/Vehicle response
    /// API returns: Registration, FleetNumber, TankSize, Status, ExternalNumber
    /// </summary>
    public class TfnVehicleDto
    {
        // API field name is "Registration" - use JsonPropertyName
        public string Registration { get; set; } = string.Empty;
        public string? FleetNumber { get; set; }
        public decimal? TankSize { get; set; }
        public int? StatusCode { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("Status")]
        public System.Text.Json.JsonElement? StatusRaw { get; set; }
        public string? ExternalNumber { get; set; }
        
        // Legacy fields that may still be used
        public string? VehicleDescription { get; set; }
        public string? VehicleMake { get; set; }
        public string? VehicleModel { get; set; }
        public string? VIN { get; set; }
        public string? FuelType { get; set; }
        public string? SubAccountNumber { get; set; }
        public string? VirtualCardNumber { get; set; }
        public decimal? CreditLimit { get; set; }
        public bool IsActive { get; set; }
        
        // Status as string - converts numeric status to text
        [System.Text.Json.Serialization.JsonIgnore]
        public string Status => StatusRaw?.ValueKind switch
        {
            System.Text.Json.JsonValueKind.Number => StatusRaw.Value.GetInt32() switch
            {
                1 => "Active",
                2 => "Inactive",
                3 => "Suspended",
                4 => "Active",  // 4 appears to be active in TFN
                _ => StatusRaw.Value.GetInt32().ToString()
            },
            System.Text.Json.JsonValueKind.String => StatusRaw.Value.GetString() ?? "Unknown",
            _ => "Unknown"
        };
        
        // Helper property to get normalized registration (no dashes/spaces)
        public string NormalizedRegistration => Registration?.Replace("-", "").Replace(" ", "").ToUpper() ?? "";
    }
}
