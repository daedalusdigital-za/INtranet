using ProjectTracker.API.Services.TFN;

namespace ProjectTracker.API.Services.TFN.Clients
{
    public class TfnTransactionsClient
    {
        private readonly HttpClient _httpClient;
        private readonly TfnTokenService _tokenService;
        private readonly ILogger<TfnTransactionsClient> _logger;
        private readonly IConfiguration _configuration;

        public TfnTransactionsClient(
            HttpClient httpClient,
            TfnTokenService tokenService,
            ILogger<TfnTransactionsClient> logger,
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
        /// Get transactions after specified date
        /// </summary>
        public async Task<List<TfnTransactionDto>?> GetTransactionsAsync(DateTime? fromDate = null)
        {
            try
            {
                var token = await _tokenService.GetValidTokenAsync();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Failed to get valid TFN token");
                    return null;
                }

                fromDate ??= DateTime.UtcNow.AddDays(-7); // Default to last week

                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";
                var customerNumber = Uri.EscapeDataString(_configuration["TFN:CustomerNumber"] ?? "");
                
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                var dateParam = fromDate.Value.ToString("yyyy-MM-dd");
                
                // Try different parameter patterns the TFN API might accept
                var urls = new[]
                {
                    $"/api/Transactions?customerNumber={customerNumber}&transactionDate={dateParam}&api-version={apiVersion}",
                    $"/api/Transactions?customerNumber={customerNumber}&fromDate={dateParam}&api-version={apiVersion}",
                    $"/api/Transactions?customerNumber={customerNumber}&startDate={dateParam}&api-version={apiVersion}"
                };

                HttpResponseMessage? response = null;
                string? lastError = null;
                
                foreach (var url in urls)
                {
                    _logger.LogInformation("Trying TFN transactions URL: {Url}", url);
                    response = await _httpClient.GetAsync(url);
                    
                    if (response.IsSuccessStatusCode)
                        break;
                    
                    lastError = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("TFN transactions URL failed: {StatusCode} - {Error}", response.StatusCode, lastError);
                }
                
                if (response == null || !response.IsSuccessStatusCode)
                {
                    _logger.LogError("Failed to get transactions from TFN after trying all URL patterns. Last error: {Error}", lastError);
                    return null;
                }

                var transactions = await response.Content.ReadFromJsonAsync<List<TfnTransactionDto>>();
                _logger.LogInformation("Retrieved {Count} transactions from TFN since {Date}", 
                    transactions?.Count ?? 0, fromDate);
                
                return transactions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving transactions from TFN");
                return null;
            }
        }

        /// <summary>
        /// Get transactions with utilized orders
        /// </summary>
        public async Task<List<TfnTransactionDto>?> GetTransactionsWithOrdersAsync(DateTime? fromDate = null)
        {
            try
            {
                var token = await _tokenService.GetValidTokenAsync();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Failed to get valid TFN token");
                    return null;
                }

                fromDate ??= DateTime.UtcNow.AddDays(-7);

                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";
                var customerNumber = Uri.EscapeDataString(_configuration["TFN:CustomerNumber"] ?? "");
                
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                var dateParam = fromDate.Value.ToString("yyyy-MM-dd");
                var response = await _httpClient.GetAsync($"/api/TransactionsWithUtilisedOrders?customerNumber={customerNumber}&transactionDate={dateParam}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get transactions with orders from TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                var transactions = await response.Content.ReadFromJsonAsync<List<TfnTransactionDto>>();
                _logger.LogInformation("Retrieved {Count} transactions with orders from TFN since {Date}", 
                    transactions?.Count ?? 0, fromDate);
                
                return transactions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving transactions with orders from TFN");
                return null;
            }
        }

        /// <summary>
        /// Get specific transaction by ID
        /// </summary>
        public async Task<TfnTransactionDto?> GetTransactionAsync(string transactionId)
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

                var response = await _httpClient.GetAsync($"/api/TransactionsWithUtilisedOrders/{transactionId}?customerNumber={customerNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get transaction {TransactionId} from TFN: {StatusCode} - {Error}", 
                        transactionId, response.StatusCode, error);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<TfnTransactionDto>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving transaction {TransactionId} from TFN", transactionId);
                return null;
            }
        }

        /// <summary>
        /// Get full transaction detail by GUID from /api/TransactionsWithUtilisedOrders/{id}.
        /// This is the ONLY working transaction endpoint (the collection endpoints 404).
        /// Returns the real fuel fill: supplier/depot, litres, amount spent and odometer.
        /// </summary>
        public async Task<TfnTransactionDetailDto?> GetTransactionDetailAsync(string transactionId)
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

                var response = await _httpClient.GetAsync(
                    $"/api/TransactionsWithUtilisedOrders/{transactionId}?customerNumber={customerNumber}&api-version={apiVersion}");

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Failed to get transaction detail {TransactionId} from TFN: {StatusCode} - {Error}",
                        transactionId, response.StatusCode, error);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<TfnTransactionDetailDto>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving transaction detail {TransactionId} from TFN", transactionId);
                return null;
            }
        }
    }

    /// <summary>
    /// Matches the JSON returned by /api/TransactionsWithUtilisedOrders/{id}.
    /// </summary>
    public class TfnTransactionDetailDto
    {
        public Guid TransactionID { get; set; }
        public string? CustomerNumber { get; set; }
        public string? ProductCode { get; set; }
        public string? TransactionTypeCode { get; set; }
        public DateTime TransactionDate { get; set; }
        public DateTime? CapturedDate { get; set; }
        public string? SupplierName { get; set; }
        public string? SupplierNumber { get; set; }
        public string? VehicleRegistration { get; set; }
        public decimal Amount { get; set; }
        public decimal VAT { get; set; }
        public decimal Litres { get; set; }
        public decimal? Odometer { get; set; }
        public string? TransactionReference { get; set; }
        public string? Identifier { get; set; }
        public List<TfnUtilisedOrderDetailDto>? UtilisedOrders { get; set; }
    }

    public class TfnUtilisedOrderDetailDto
    {
        public string OrderNumber { get; set; } = string.Empty;
        public string? CustomerReferences { get; set; }
        public decimal AllocatedLitres { get; set; }
        public decimal AllocatedAmount { get; set; }
    }

    public class TfnTransactionDto
    {
        public string TransactionId { get; set; } = string.Empty;
        public string TransactionNumber { get; set; } = string.Empty;
        public DateTime TransactionDate { get; set; }
        public string? VehicleRegistration { get; set; }
        public string? DriverCode { get; set; }
        public string? DriverName { get; set; }
        public string? DepotCode { get; set; }
        public string? DepotName { get; set; }
        public string? ProductCode { get; set; }
        public string? ProductDescription { get; set; }
        public decimal Litres { get; set; }
        public decimal PricePerLitre { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal? VatAmount { get; set; }
        public decimal? OdometerReading { get; set; }
        public string? VirtualCardNumber { get; set; }
        public string? OrderNumber { get; set; }
        public string? AttendantName { get; set; }
        public List<TfnUtilizedOrderDto>? UtilizedOrders { get; set; }
    }

    public class TfnUtilizedOrderDto
    {
        public string OrderNumber { get; set; } = string.Empty;
        public decimal LitresUsed { get; set; }
        public decimal AmountUsed { get; set; }
    }
}
