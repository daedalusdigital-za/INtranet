using ProjectTracker.API.Services.TFN;

namespace ProjectTracker.API.Services.TFN.Clients
{
    public class TfnAccountsClient
    {
        private readonly HttpClient _httpClient;
        private readonly TfnTokenService _tokenService;
        private readonly ILogger<TfnAccountsClient> _logger;
        private readonly IConfiguration _configuration;

        public TfnAccountsClient(
            HttpClient httpClient,
            TfnTokenService tokenService,
            ILogger<TfnAccountsClient> logger,
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
        /// Get sub-account balance
        /// </summary>
        public async Task<TfnBalanceDto?> GetBalanceAsync(string? subAccountNumber = null)
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

                var url = $"/api/SubAccountBalance?customerNumber={customerNumber}&api-version={apiVersion}";
                if (!string.IsNullOrEmpty(subAccountNumber))
                {
                    url += $"&subAccountNumber={subAccountNumber}";
                }

                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get balance from TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<TfnBalanceDto>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving balance from TFN");
                return null;
            }
        }

        /// <summary>
        /// Get credit limit for sub-account
        /// </summary>
        public async Task<TfnCreditLimitDto?> GetCreditLimitAsync(string subAccountNumber)
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

                var response = await _httpClient.GetAsync($"/api/SubAccountCreditLimit?customerNumber={customerNumber}&subAccountNumber={subAccountNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get credit limit from TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<TfnCreditLimitDto>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving credit limit from TFN");
                return null;
            }
        }

        /// <summary>
        /// Get all credit limits for customer
        /// </summary>
        public async Task<List<TfnCreditLimitDto>?> GetAllCreditLimitsAsync()
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

                var response = await _httpClient.GetAsync($"/api/SubAccountCreditLimits?customerNumber={customerNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get credit limits from TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                var limits = await response.Content.ReadFromJsonAsync<List<TfnCreditLimitDto>>();
                _logger.LogInformation("Retrieved {Count} credit limits from TFN", limits?.Count ?? 0);
                
                return limits;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving credit limits from TFN");
                return null;
            }
        }

        /// <summary>
        /// Update credit limit for sub-account
        /// </summary>
        public async Task<bool> UpdateCreditLimitAsync(string subAccountNumber, decimal newLimit)
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
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                var request = new
                {
                    SubAccountNumber = subAccountNumber,
                    CreditLimit = newLimit
                };

                var response = await _httpClient.PostAsJsonAsync($"/api/SubAccountCreditLimit?api-version={apiVersion}", request);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to update credit limit in TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return false;
                }

                _logger.LogInformation("Successfully updated credit limit for {SubAccount} to {Limit}", 
                    subAccountNumber, newLimit);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating credit limit in TFN");
                return false;
            }
        }

        /// <summary>
        /// Apply payment (credit/debit) to sub-account
        /// </summary>
        public async Task<bool> ApplyPaymentAsync(string subAccountNumber, decimal amount, string reference)
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
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                var request = new
                {
                    SubAccountNumber = subAccountNumber,
                    Amount = amount,
                    Reference = reference,
                    TransactionDate = DateTime.Now
                };

                var response = await _httpClient.PostAsJsonAsync($"/api/SubAccountPayment?api-version={apiVersion}", request);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to apply payment in TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return false;
                }

                _logger.LogInformation("Successfully applied payment of {Amount} to {SubAccount}", 
                    amount, subAccountNumber);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error applying payment in TFN");
                return false;
            }
        }
    }

    public class TfnBalanceDto
    {
        public string SubAccountNumber { get; set; } = string.Empty;
        public decimal Balance { get; set; }
        public decimal CreditLimit { get; set; }
        public decimal AvailableCredit { get; set; }
        public DateTime BalanceDate { get; set; }
    }

    public class TfnCreditLimitDto
    {
        public string SubAccountNumber { get; set; } = string.Empty;
        public decimal CreditLimit { get; set; }
        public bool IsActive { get; set; }
    }
}
