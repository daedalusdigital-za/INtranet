using ProjectTracker.API.Services.TFN;

namespace ProjectTracker.API.Services.TFN.Clients
{
    public class TfnDriversClient
    {
        private readonly HttpClient _httpClient;
        private readonly TfnTokenService _tokenService;
        private readonly ILogger<TfnDriversClient> _logger;
        private readonly IConfiguration _configuration;

        public TfnDriversClient(
            HttpClient httpClient,
            TfnTokenService tokenService,
            ILogger<TfnDriversClient> logger,
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
        /// Get all drivers from TFN
        /// </summary>
        public async Task<List<TfnDriverDto>?> GetDriversAsync()
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

                var response = await _httpClient.GetAsync($"/api/Drivers?customerNumber={customerNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get drivers from TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                var drivers = await response.Content.ReadFromJsonAsync<List<TfnDriverDto>>();
                _logger.LogInformation("Retrieved {Count} drivers from TFN", drivers?.Count ?? 0);
                
                return drivers;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving drivers from TFN");
                return null;
            }
        }

        /// <summary>
        /// Add or update driver in TFN
        /// </summary>
        public async Task<bool> AddOrUpdateDriverAsync(TfnDriverDto driver)
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

                var response = await _httpClient.PostAsJsonAsync($"/api/Drivers?customerNumber={customerNumber}&api-version={apiVersion}", driver);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to add/update driver in TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return false;
                }

                _logger.LogInformation("Successfully added/updated driver {DriverCode} in TFN", driver.DriverCode);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding/updating driver in TFN");
                return false;
            }
        }
    }

    public class TfnDriverDto
    {
        public string DriverCode { get; set; } = string.Empty;
        public string? DriverName { get; set; }
        public string? IdNumber { get; set; }
        public string? LicenseNumber { get; set; }
        public string? CellNumber { get; set; }
        public string? Email { get; set; }
        public string? SubAccountNumber { get; set; }
        public string? VirtualCardNumber { get; set; }
        public decimal? CreditLimit { get; set; }
        public bool IsActive { get; set; }
    }
}
