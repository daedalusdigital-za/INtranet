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

                var response = await _httpClient.GetAsync($"/api/Vehicle?customerNumber={customerNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get vehicles from TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                var vehicles = await response.Content.ReadFromJsonAsync<List<TfnVehicleDto>>();
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
                    isUpdate ? "updated" : "added", vehicle.VehicleRegistration);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error {Action} vehicle in TFN", isUpdate ? "updating" : "adding");
                return false;
            }
        }
    }

    public class TfnVehicleDto
    {
        public string VehicleRegistration { get; set; } = string.Empty;
        public string? VehicleDescription { get; set; }
        public string? VehicleMake { get; set; }
        public string? VehicleModel { get; set; }
        public string? VIN { get; set; }
        public string? FuelType { get; set; }
        public decimal? TankSize { get; set; }
        public string? SubAccountNumber { get; set; }
        public string? VirtualCardNumber { get; set; }
        public decimal? CreditLimit { get; set; }
        public bool IsActive { get; set; }
    }
}
