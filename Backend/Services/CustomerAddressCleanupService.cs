using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using System.Text.Json;
using System.Net.Http;
using System.Web;

namespace ProjectTracker.API.Services
{
    public class CustomerAddressCleanupService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CustomerAddressCleanupService> _logger;
        private readonly HttpClient _httpClient;
        private const string GoogleMapsApiKey = "AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k";
        private const string GeocodeUrl = "https://maps.googleapis.com/maps/api/geocode/json";

        public CustomerAddressCleanupService(
            ApplicationDbContext context,
            ILogger<CustomerAddressCleanupService> logger,
            IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _logger = logger;
            _httpClient = httpClientFactory.CreateClient();
        }

        public class CleanupResult
        {
            public int TotalCustomers { get; set; }
            public int Updated { get; set; }
            public int AlreadyComplete { get; set; }
            public int Failed { get; set; }
            public List<CustomerUpdateResult> Results { get; set; } = new();
        }

        public class CustomerUpdateResult
        {
            public int CustomerId { get; set; }
            public string CustomerCode { get; set; } = "";
            public string CustomerName { get; set; } = "";
            public bool Success { get; set; }
            public string? OldAddress { get; set; }
            public string? NewAddress { get; set; }
            public string? Province { get; set; }
            public string? City { get; set; }
            public string? Error { get; set; }
        }

        public async Task<CleanupResult> CleanupCustomerAddresses(int? batchSize = null, bool updateDatabase = true)
        {
            var result = new CleanupResult();

            // Get customers that need address cleanup (missing province or city)
            var customersQuery = _context.LogisticsCustomers
                .Where(c => c.Province == null || c.City == null || c.Province == "" || c.City == "");

            if (batchSize.HasValue)
            {
                customersQuery = customersQuery.Take(batchSize.Value);
            }

            var customers = await customersQuery.ToListAsync();
            result.TotalCustomers = customers.Count;

            _logger.LogInformation($"Starting address cleanup for {customers.Count} customers");

            foreach (var customer in customers)
            {
                var updateResult = new CustomerUpdateResult
                {
                    CustomerId = customer.Id,
                    CustomerCode = customer.CustomerCode ?? "",
                    CustomerName = customer.Name
                };

                try
                {
                    // Build search query from available data
                    var searchQuery = BuildSearchQuery(customer);
                    updateResult.OldAddress = searchQuery;

                    if (string.IsNullOrWhiteSpace(searchQuery))
                    {
                        updateResult.Success = false;
                        updateResult.Error = "No address data to search";
                        result.Failed++;
                        result.Results.Add(updateResult);
                        continue;
                    }

                    // Call Google Maps Geocoding API
                    var geocodeResult = await GeocodeAddress(searchQuery);

                    if (geocodeResult.HasValue)
                    {
                        var geoResult = geocodeResult.Value;
                        
                        // Extract address components
                        var province = GetAddressComponent(geoResult, "administrative_area_level_1");
                        var city = GetAddressComponent(geoResult, "locality") 
                                ?? GetAddressComponent(geoResult, "sublocality")
                                ?? GetAddressComponent(geoResult, "administrative_area_level_2");
                        var postalCode = GetAddressComponent(geoResult, "postal_code");
                        var streetNumber = GetAddressComponent(geoResult, "street_number");
                        var route = GetAddressComponent(geoResult, "route");
                        var suburb = GetAddressComponent(geoResult, "sublocality_level_1")
                                  ?? GetAddressComponent(geoResult, "neighborhood");
                        var formattedAddress = geoResult.GetProperty("formatted_address").GetString();

                        updateResult.Province = province;
                        updateResult.City = city;
                        updateResult.NewAddress = formattedAddress;
                        updateResult.Success = true;

                        if (updateDatabase)
                        {
                            // Update customer record
                            customer.Province = province;
                            customer.City = city;
                            customer.PostalCode = postalCode;
                            customer.DeliveryProvince = province;
                            customer.DeliveryCity = city;
                            customer.DeliveryPostalCode = postalCode;

                            // Build new address lines
                            var addressLines = new List<string>();
                            if (!string.IsNullOrEmpty(streetNumber) && !string.IsNullOrEmpty(route))
                                addressLines.Add($"{streetNumber} {route}");
                            else if (!string.IsNullOrEmpty(route))
                                addressLines.Add(route);
                            if (!string.IsNullOrEmpty(suburb))
                                addressLines.Add(suburb);
                            if (!string.IsNullOrEmpty(city))
                                addressLines.Add(city);
                            if (!string.IsNullOrEmpty(postalCode))
                                addressLines.Add(postalCode);

                            if (addressLines.Any())
                            {
                                customer.AddressLinesJson = JsonSerializer.Serialize(addressLines);
                            }

                            if (!string.IsNullOrEmpty(formattedAddress))
                            {
                                customer.PhysicalAddress = formattedAddress;
                                customer.DeliveryAddress = formattedAddress;
                            }

                            customer.UpdatedAt = DateTime.UtcNow;
                        }

                        result.Updated++;
                        _logger.LogInformation($"Updated customer {customer.CustomerCode}: {province}, {city}");
                    }
                    else
                    {
                        updateResult.Success = false;
                        updateResult.Error = "Geocoding returned no results";
                        result.Failed++;
                    }
                }
                catch (Exception ex)
                {
                    updateResult.Success = false;
                    updateResult.Error = ex.Message;
                    result.Failed++;
                    _logger.LogError(ex, $"Error processing customer {customer.CustomerCode}");
                }

                result.Results.Add(updateResult);

                // Rate limiting - Google allows 50 requests per second
                await Task.Delay(100);
            }

            if (updateDatabase)
            {
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation($"Address cleanup complete. Updated: {result.Updated}, Failed: {result.Failed}");
            return result;
        }

        private string BuildSearchQuery(Models.Logistics.Customer customer)
        {
            var parts = new List<string>();

            // Try to use existing address lines first
            if (!string.IsNullOrEmpty(customer.AddressLinesJson))
            {
                try
                {
                    var addressLines = JsonSerializer.Deserialize<List<string>>(customer.AddressLinesJson);
                    if (addressLines != null && addressLines.Any())
                    {
                        parts.AddRange(addressLines);
                    }
                }
                catch { }
            }

            // If no address lines, use other address fields
            if (!parts.Any())
            {
                if (!string.IsNullOrEmpty(customer.PhysicalAddress))
                    parts.Add(customer.PhysicalAddress);
                else if (!string.IsNullOrEmpty(customer.DeliveryAddress))
                    parts.Add(customer.DeliveryAddress);
                else if (!string.IsNullOrEmpty(customer.Address))
                    parts.Add(customer.Address);
            }

            // If still no address, use customer name (often contains location for hospitals)
            if (!parts.Any())
            {
                parts.Add(customer.Name);
            }

            // Always add South Africa to improve results
            parts.Add("South Africa");

            return string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        }

        private async Task<JsonElement?> GeocodeAddress(string address)
        {
            try
            {
                var encodedAddress = HttpUtility.UrlEncode(address);
                var url = $"{GeocodeUrl}?address={encodedAddress}&key={GoogleMapsApiKey}&components=country:ZA";

                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                var json = JsonSerializer.Deserialize<JsonElement>(content);

                var status = json.GetProperty("status").GetString();
                if (status == "OK")
                {
                    var results = json.GetProperty("results");
                    if (results.GetArrayLength() > 0)
                    {
                        return results[0];
                    }
                }
                else if (status == "ZERO_RESULTS")
                {
                    _logger.LogWarning($"No geocode results for: {address}");
                }
                else
                {
                    _logger.LogWarning($"Geocode API returned status: {status} for: {address}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Geocoding failed for: {address}");
            }

            return null;
        }

        private string? GetAddressComponent(JsonElement result, string type)
        {
            try
            {
                var components = result.GetProperty("address_components");
                foreach (var component in components.EnumerateArray())
                {
                    var types = component.GetProperty("types");
                    foreach (var t in types.EnumerateArray())
                    {
                        if (t.GetString() == type)
                        {
                            return component.GetProperty("long_name").GetString();
                        }
                    }
                }
            }
            catch { }
            return null;
        }

        // Get province code from province name
        public static string GetProvinceCode(string? provinceName)
        {
            if (string.IsNullOrEmpty(provinceName)) return "";
            
            var lower = provinceName.ToLower();
            return lower switch
            {
                var p when p.Contains("gauteng") => "GP",
                var p when p.Contains("kwazulu") || p.Contains("natal") => "KZN",
                var p when p.Contains("western cape") => "WC",
                var p when p.Contains("eastern cape") => "EC",
                var p when p.Contains("mpumalanga") => "MP",
                var p when p.Contains("limpopo") => "LP",
                var p when p.Contains("free state") => "FS",
                var p when p.Contains("north west") || p.Contains("north-west") => "NW",
                var p when p.Contains("northern cape") => "NC",
                _ => provinceName
            };
        }
    }
}
