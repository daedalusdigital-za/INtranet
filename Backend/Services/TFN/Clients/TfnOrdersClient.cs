using ProjectTracker.API.Services.TFN;

namespace ProjectTracker.API.Services.TFN.Clients
{
    public class TfnOrdersClient
    {
        private readonly HttpClient _httpClient;
        private readonly TfnTokenService _tokenService;
        private readonly ILogger<TfnOrdersClient> _logger;
        private readonly IConfiguration _configuration;

        public TfnOrdersClient(
            HttpClient httpClient,
            TfnTokenService tokenService,
            ILogger<TfnOrdersClient> logger,
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
        /// Get all orders after specified date
        /// </summary>
        public async Task<List<TfnOrderDto>?> GetOrdersAsync(DateTime? fromDate = null)
        {
            try
            {
                var token = await _tokenService.GetValidTokenAsync();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Failed to get valid TFN token");
                    return null;
                }

                fromDate ??= DateTime.UtcNow.AddDays(-13); // TFN requires date within 14 days

                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";
                var customerNumber = Uri.EscapeDataString(_configuration["TFN:CustomerNumber"] ?? "");
                
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                var dateParam = fromDate.Value.ToString("yyyy-MM-dd");
                var response = await _httpClient.GetAsync($"/api/Orders?customerNumber={customerNumber}&modifiedAfterDate={dateParam}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get orders from TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                var orders = await response.Content.ReadFromJsonAsync<List<TfnOrderDto>>();
                _logger.LogInformation("Retrieved {Count} orders from TFN since {Date}", 
                    orders?.Count ?? 0, fromDate);
                
                return orders;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving orders from TFN");
                return null;
            }
        }

        /// <summary>
        /// Get specific order by number
        /// </summary>
        public async Task<TfnOrderDto?> GetOrderAsync(string orderNumber)
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

                var response = await _httpClient.GetAsync($"/api/Orders/{orderNumber}?customerNumber={customerNumber}&api-version={apiVersion}");
                
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get order {OrderNumber} from TFN: {StatusCode} - {Error}", 
                        orderNumber, response.StatusCode, error);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<TfnOrderDto>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving order {OrderNumber} from TFN", orderNumber);
                return null;
            }
        }

        /// <summary>
        /// Create new fuel order
        /// </summary>
        public async Task<TfnOrderDto?> CreateOrderAsync(TfnCreateOrderRequest order)
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

                var response = await _httpClient.PostAsJsonAsync($"/api/Orders?customerNumber={customerNumber}&api-version={apiVersion}", order);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to create order in TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return null;
                }

                var createdOrder = await response.Content.ReadFromJsonAsync<TfnOrderDto>();
                _logger.LogInformation("Successfully created order in TFN");
                
                return createdOrder;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating order in TFN");
                return null;
            }
        }

        /// <summary>
        /// Update existing order
        /// </summary>
        public async Task<bool> UpdateOrderAsync(TfnOrderDto order)
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

                var response = await _httpClient.PutAsJsonAsync($"/api/Orders?customerNumber={customerNumber}&api-version={apiVersion}", order);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to update order in TFN: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    return false;
                }

                _logger.LogInformation("Successfully updated order {OrderNumber} in TFN", order.OrderNumber);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating order in TFN");
                return false;
            }
        }

        /// <summary>
        /// Delete order
        /// </summary>
        public async Task<bool> DeleteOrderAsync(string orderNumber)
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

                var response = await _httpClient.DeleteAsync($"/api/Orders?customerNumber={customerNumber}&orderNumber={orderNumber}&api-version={apiVersion}");

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to delete order {OrderNumber} from TFN: {StatusCode} - {Error}", 
                        orderNumber, response.StatusCode, error);
                    return false;
                }

                _logger.LogInformation("Successfully deleted order {OrderNumber} from TFN", orderNumber);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting order {OrderNumber} from TFN", orderNumber);
                return false;
            }
        }
    }

    /// <summary>
    /// Matches TFN API response structure for Orders endpoint
    /// </summary>
    public class TfnOrderDto
    {
        public bool IsDeleted { get; set; }
        public bool Planned { get; set; }
        public string? PlannedReasons { get; set; }
        public string OrderNumber { get; set; } = string.Empty;
        public string? CustomerNumber { get; set; }
        public string? SubContractorCustomerNumber { get; set; }
        public string? CustomerReference { get; set; }
        public bool EntriesCompleteAfterFirstUse { get; set; }
        public decimal MaxAllocation { get; set; }
        public bool SubContractorAccepted { get; set; }
        public bool SubContractorDeclined { get; set; }
        public string? StatusTitle { get; set; }
        public List<TfnOrderEntryDto> Entries { get; set; } = new();

        // Computed properties for backward compatibility
        public string? VehicleRegistration => Entries.FirstOrDefault()?.VehicleRegistration;
        public string? VirtualCardNumber => Entries.FirstOrDefault()?.CurrentVirtualCardNumber;
        public decimal Litres => Entries.Sum(e => e.MaxAllocation);
        public string? ProductCode => Entries.FirstOrDefault()?.ProductCode;
        public DateTime? ValidDateStart => Entries.FirstOrDefault()?.ValidDateStart;
        public DateTime? ValidDateEnd => Entries.FirstOrDefault()?.ValidDateEnd;
        public string? DriverCellNumber => Entries.FirstOrDefault()?.DriverCellNumber;
    }

    public class TfnOrderEntryDto
    {
        public bool IsDeleted { get; set; }
        public int Position { get; set; }
        public int SupplierNumber { get; set; }
        public string? ProductCode { get; set; }
        public string? VehicleRegistration { get; set; }
        public string? CardNumber { get; set; }
        public string? DriverCellNumber { get; set; }
        public string? CurrentVirtualCardNumber { get; set; }
        public decimal MaxAllocation { get; set; }
        public DateTime? ValidDateStart { get; set; }
        public DateTime? ValidDateEnd { get; set; }
        public string? CustomerReference { get; set; }
        public List<TfnLinkedTransactionDto> LinkedTransactions { get; set; } = new();
    }

    public class TfnLinkedTransactionDto
    {
        public Guid TransactionID { get; set; }
    }

    public class TfnCreateOrderRequest
    {
        public string? VehicleRegistration { get; set; }
        public string? DriverCode { get; set; }
        public string? VirtualCardNumber { get; set; }
        public decimal Litres { get; set; }
        public string ProductCode { get; set; } = "DIESEL";
        public DateTime? ExpiryDate { get; set; }
        public string? Notes { get; set; }
    }
}
