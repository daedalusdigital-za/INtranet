using ProjectTracker.API.Services.TFN;

namespace ProjectTracker.API.Services.TFN.Clients
{
    public class TfnDepotsClient
    {
        private readonly HttpClient _httpClient;
        private readonly TfnTokenService _tokenService;
        private readonly ILogger<TfnDepotsClient> _logger;
        private readonly IConfiguration _configuration;

        public TfnDepotsClient(
            HttpClient httpClient,
            TfnTokenService tokenService,
            ILogger<TfnDepotsClient> logger,
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
        /// Get all fuel depots
        /// </summary>
        public async Task<List<TfnDepotDto>?> GetDepotsAsync()
        {
            try
            {
                var token = await _tokenService.GetValidTokenAsync();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Failed to get valid TFN token for depots");
                    return null;
                }

                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";
                var customerNumber = Uri.EscapeDataString(_configuration["TFN:CustomerNumber"] ?? "");
                
                _logger.LogInformation("Fetching depots from TFN with customerNumber={CustomerNumber}", customerNumber);
                
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.GetAsync($"/api/Depots?customerNumber={customerNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get depots from TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                var jsonContent = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Depots response received, length={Length}", jsonContent.Length);

                var depots = System.Text.Json.JsonSerializer.Deserialize<List<TfnDepotDto>>(jsonContent);
                _logger.LogInformation("Retrieved {Count} depots from TFN", depots?.Count ?? 0);
                
                return depots;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving depots from TFN: {Message}", ex.Message);
                return null;
            }
        }
    }

    public class TfnDepotDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("DepotID")]
        public string DepotCode { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("Title")]
        public string DepotName { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("Number")]
        public int? Number { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("GPSLatitude")]
        public decimal? Latitude { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("GPSLongitude")]
        public decimal? Longitude { get; set; }
        
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactNumber { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
