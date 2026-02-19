using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Services
{
    /// <summary>
    /// Service to use Google Gemini AI to map customer addresses to South African provinces
    /// </summary>
    public class GeminiProvinceService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<GeminiProvinceService> _logger;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;

        private static readonly string[] SouthAfricanProvinces = new[]
        {
            "Eastern Cape",
            "Free State",
            "Gauteng",
            "KwaZulu-Natal",
            "Limpopo",
            "Mpumalanga",
            "Northern Cape",
            "North West",
            "Western Cape"
        };

        public GeminiProvinceService(
            ApplicationDbContext context,
            ILogger<GeminiProvinceService> logger,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _logger = logger;
            _configuration = configuration;
            _httpClient = httpClientFactory.CreateClient();
            _apiKey = configuration.GetValue<string>("GeminiSettings:ApiKey") ?? "";
        }

        public class ProvinceMappingResult
        {
            public bool Success { get; set; }
            public int TotalProcessed { get; set; }
            public int SuccessfullyMapped { get; set; }
            public int AlreadyHadProvince { get; set; }
            public int FailedToMap { get; set; }
            public int ApiErrors { get; set; }
            public string? ErrorMessage { get; set; }
            public List<MappedCustomerInfo> MappedCustomers { get; set; } = new();
        }

        public class MappedCustomerInfo
        {
            public int CustomerId { get; set; }
            public string? CustomerName { get; set; }
            public string? Address { get; set; }
            public string? City { get; set; }
            public string? MappedProvince { get; set; }
            public double Confidence { get; set; }
        }

        /// <summary>
        /// Use Gemini AI to map addresses to provinces for customers missing province data
        /// </summary>
        public async Task<ProvinceMappingResult> MapProvincesWithGemini(int? batchSize = null)
        {
            var result = new ProvinceMappingResult();

            try
            {
                // Get customers with addresses but missing province
                var customersQuery = _context.LogisticsCustomers
                    .Where(c => c.Status == "Active")
                    .Where(c => 
                        // Has some address data
                        (!string.IsNullOrEmpty(c.Address) || 
                         !string.IsNullOrEmpty(c.DeliveryAddress) || 
                         !string.IsNullOrEmpty(c.PhysicalAddress) ||
                         !string.IsNullOrEmpty(c.City) ||
                         !string.IsNullOrEmpty(c.DeliveryCity)) &&
                        // But missing province
                        (string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince)));

                if (batchSize.HasValue)
                {
                    customersQuery = customersQuery.Take(batchSize.Value);
                }

                var customers = await customersQuery.ToListAsync();
                result.TotalProcessed = customers.Count;

                _logger.LogInformation("Processing {Count} customers for Gemini province mapping", customers.Count);

                // Process in batches to avoid overwhelming the API
                const int geminiaBatchSize = 10;
                var batches = customers
                    .Select((c, i) => new { Customer = c, Index = i })
                    .GroupBy(x => x.Index / geminiaBatchSize)
                    .Select(g => g.Select(x => x.Customer).ToList())
                    .ToList();

                foreach (var batch in batches)
                {
                    try
                    {
                        var mappings = await GetProvinceMappingsFromGemini(batch);
                        
                        foreach (var mapping in mappings)
                        {
                            var customer = batch.FirstOrDefault(c => c.Id == mapping.CustomerId);
                            if (customer == null) continue;

                            if (!string.IsNullOrEmpty(mapping.Province) && 
                                SouthAfricanProvinces.Contains(mapping.Province))
                            {
                                // Update customer province
                                if (!string.IsNullOrEmpty(customer.DeliveryAddress))
                                {
                                    customer.DeliveryProvince = mapping.Province;
                                }
                                if (!string.IsNullOrEmpty(customer.Address) || !string.IsNullOrEmpty(customer.PhysicalAddress))
                                {
                                    customer.Province = mapping.Province;
                                }
                                customer.UpdatedAt = DateTime.UtcNow;

                                result.SuccessfullyMapped++;
                                result.MappedCustomers.Add(new MappedCustomerInfo
                                {
                                    CustomerId = customer.Id,
                                    CustomerName = customer.Name,
                                    Address = customer.DeliveryAddress ?? customer.Address ?? customer.PhysicalAddress,
                                    City = customer.DeliveryCity ?? customer.City,
                                    MappedProvince = mapping.Province,
                                    Confidence = mapping.Confidence
                                });

                                _logger.LogDebug("Mapped customer {Name} to province {Province}", 
                                    customer.Name, mapping.Province);
                            }
                            else
                            {
                                result.FailedToMap++;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing batch with Gemini");
                        result.ApiErrors++;
                    }

                    // Small delay between batches to respect rate limits
                    await Task.Delay(500);
                }

                await _context.SaveChangesAsync();

                result.Success = true;
                _logger.LogInformation("Gemini province mapping completed: {Mapped} mapped, {Failed} failed, {Errors} errors",
                    result.SuccessfullyMapped, result.FailedToMap, result.ApiErrors);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Gemini province mapping");
                result.Success = false;
                result.ErrorMessage = ex.Message;
            }

            return result;
        }

        private async Task<List<ProvinceMapping>> GetProvinceMappingsFromGemini(List<Customer> customers)
        {
            var results = new List<ProvinceMapping>();

            // Build the prompt with customer address data
            var addressList = customers.Select(c => new
            {
                id = c.Id,
                name = c.Name,
                address = c.DeliveryAddress ?? c.Address ?? c.PhysicalAddress ?? "",
                city = c.DeliveryCity ?? c.City ?? ""
            }).ToList();

            var prompt = $@"You are a South African geography expert. For each customer below, determine which South African province their address/city is located in.

The valid provinces are EXACTLY:
- Eastern Cape
- Free State
- Gauteng
- KwaZulu-Natal
- Limpopo
- Mpumalanga
- Northern Cape
- North West
- Western Cape

Return a JSON array with the following format for each customer:
[
  {{""id"": 123, ""province"": ""KwaZulu-Natal"", ""confidence"": 0.95}},
  {{""id"": 456, ""province"": ""Gauteng"", ""confidence"": 0.8}}
]

If you cannot determine the province, use ""province"": null and ""confidence"": 0.

Here are the customers:
{JsonSerializer.Serialize(addressList, new JsonSerializerOptions { WriteIndented = true })}

Return ONLY the JSON array, no other text.";

            try
            {
                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.1,
                        maxOutputTokens = 2048
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={_apiKey}";
                var response = await _httpClient.PostAsync(url, content);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    var geminiResponse = JsonSerializer.Deserialize<GeminiResponse>(responseJson);

                    if (geminiResponse?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text is string responseText)
                    {
                        // Extract JSON from response (it might have markdown code blocks)
                        responseText = ExtractJsonFromResponse(responseText);
                        
                        var mappings = JsonSerializer.Deserialize<List<ProvinceMapping>>(responseText, 
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        
                        if (mappings != null)
                        {
                            results.AddRange(mappings);
                        }
                    }
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Gemini API error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Gemini API");
            }

            return results;
        }

        private string ExtractJsonFromResponse(string response)
        {
            // Remove markdown code blocks if present
            response = response.Trim();
            
            if (response.StartsWith("```json"))
            {
                response = response.Substring(7);
            }
            else if (response.StartsWith("```"))
            {
                response = response.Substring(3);
            }

            if (response.EndsWith("```"))
            {
                response = response.Substring(0, response.Length - 3);
            }

            return response.Trim();
        }

        /// <summary>
        /// Map a single address to a province using Gemini
        /// </summary>
        public async Task<string?> GetProvinceForAddress(string address, string? city = null)
        {
            var prompt = $@"What South African province is the following location in?

Address: {address}
City: {city ?? "Unknown"}

Return ONLY the province name from this exact list:
- Eastern Cape
- Free State
- Gauteng
- KwaZulu-Natal
- Limpopo
- Mpumalanga
- Northern Cape
- North West
- Western Cape

If you cannot determine the province, return ""Unknown"".";

            try
            {
                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.1,
                        maxOutputTokens = 50
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={_apiKey}";
                var response = await _httpClient.PostAsync(url, content);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    var geminiResponse = JsonSerializer.Deserialize<GeminiResponse>(responseJson);

                    if (geminiResponse?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text is string responseText)
                    {
                        responseText = responseText.Trim();
                        
                        // Validate it's a real province
                        if (SouthAfricanProvinces.Contains(responseText))
                        {
                            return responseText;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting province from Gemini");
            }

            return null;
        }

        /// <summary>
        /// Get AI suggestions for fixing address issues for customers
        /// </summary>
        public async Task<AddressSuggestionsResult> GetAddressSuggestions(List<CustomerAddressInfo> customers)
        {
            var result = new AddressSuggestionsResult();

            try
            {
                _logger.LogInformation("Getting Gemini AI suggestions for {Count} customers", customers.Count);

                // Process in batches of 10
                const int batchSize = 10;
                var batches = customers
                    .Select((c, i) => new { Customer = c, Index = i })
                    .GroupBy(x => x.Index / batchSize)
                    .Select(g => g.Select(x => x.Customer).ToList())
                    .ToList();

                foreach (var batch in batches)
                {
                    try
                    {
                        var suggestions = await GetBatchSuggestions(batch);
                        result.Suggestions.AddRange(suggestions);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing batch");
                        result.Errors++;
                    }

                    // Rate limit - wait between batches
                    await Task.Delay(500);
                }

                result.Success = true;
                result.TotalProcessed = customers.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting address suggestions");
                result.Success = false;
                result.ErrorMessage = ex.Message;
            }

            return result;
        }

        private async Task<List<AddressSuggestion>> GetBatchSuggestions(List<CustomerAddressInfo> customers)
        {
            var suggestions = new List<AddressSuggestion>();

            var customerList = customers.Select(c => new
            {
                id = c.CustomerId,
                name = c.CustomerName,
                code = c.CustomerCode,
                address = c.Address,
                city = c.City,
                province = c.Province,
                postalCode = c.PostalCode,
                latitude = c.Latitude,
                longitude = c.Longitude,
                hasCoordinates = c.Latitude.HasValue && c.Longitude.HasValue,
                issues = new {
                    missingAddress = c.HasMissingAddress,
                    missingCity = c.HasMissingCity,
                    missingProvince = c.HasMissingProvince,
                    missingCoordinates = c.HasMissingCoordinates
                }
            }).ToList();

            var prompt = $@"You are a South African geography and address expert. Analyze these customer records with address issues and provide suggestions to fix them.

IMPORTANT: For customers that have GPS coordinates (latitude/longitude), use those coordinates to determine the EXACT province and city. This is the most accurate method.

For each customer, provide:
1. **PRIORITY: If customer has coordinates (latitude, longitude) but missing province** - Use the GPS coordinates to determine which South African province that location is in. This is very accurate - just identify what province those coordinates fall within.
2. If customer has coordinates but missing city - Use the GPS coordinates to identify the nearest city/town
3. If missing province and NO coordinates - suggest based on address, city, postal code, or customer name
4. If missing city - suggest the likely city based on the address, province, or postal code
5. If missing coordinates - only suggest if you're confident about the exact location

South African Province Boundaries (approximate):
- Gauteng: Lat -25.0 to -27.0, Lon 27.0 to 29.5 (Johannesburg, Pretoria area)
- KwaZulu-Natal: Lat -27.0 to -31.5, Lon 29.0 to 32.5 (Durban, coastal east)
- Western Cape: Lat -31.5 to -35.0, Lon 17.5 to 23.5 (Cape Town area)
- Eastern Cape: Lat -30.5 to -34.5, Lon 23.5 to 30.5 (Port Elizabeth, East London)
- Free State: Lat -27.5 to -30.5, Lon 24.5 to 30.0 (central interior)
- Limpopo: Lat -22.0 to -25.0, Lon 26.5 to 31.5 (far north)
- Mpumalanga: Lat -24.5 to -27.5, Lon 28.5 to 32.0 (east of Gauteng)
- North West: Lat -24.5 to -28.0, Lon 22.5 to 28.0 (west of Gauteng)
- Northern Cape: Lat -26.5 to -34.5, Lon 16.5 to 24.5 (large western area)

Major Cities by Province:
- Gauteng: Johannesburg (-26.2, 28.0), Pretoria (-25.7, 28.2), Sandton, Centurion, Midrand
- Western Cape: Cape Town (-33.9, 18.4), Stellenbosch, Paarl, George, Knysna
- KwaZulu-Natal: Durban (-29.9, 31.0), Pietermaritzburg, Richards Bay, Newcastle
- Eastern Cape: Port Elizabeth (-33.9, 25.6), East London (-33.0, 27.9), Mthatha
- Free State: Bloemfontein (-29.1, 26.2), Welkom, Kroonstad
- Limpopo: Polokwane (-23.9, 29.5), Tzaneen, Mokopane
- Mpumalanga: Nelspruit (-25.5, 30.9), Witbank (-25.9, 29.2), Middelburg, Secunda
- North West: Rustenburg (-25.7, 27.2), Potchefstroom, Klerksdorp, Mahikeng
- Northern Cape: Kimberley (-28.7, 24.8), Upington, Springbok

Postal Code Prefixes:
- 0001-0299: Gauteng (Pretoria area)
- 1600-2199: Gauteng (Johannesburg area)
- 2500-2999: Free State
- 3000-4999: KwaZulu-Natal
- 5000-6999: Eastern Cape
- 7000-7999: Western Cape
- 8000-8999: Northern Cape
- 9000-9999: Free State/Eastern Cape

Customers to analyze:
{JsonSerializer.Serialize(customerList, new JsonSerializerOptions { WriteIndented = true })}

Return a JSON array with suggestions for each customer:
[
  {{
    ""id"": 123,
    ""suggestedProvince"": ""Gauteng"",
    ""suggestedCity"": ""Johannesburg"",
    ""suggestedAddress"": null,
    ""suggestedLatitude"": -26.2041,
    ""suggestedLongitude"": 28.0473,
    ""confidence"": 0.85,
    ""reasoning"": ""Postal code 2000 is in central Johannesburg, Gauteng""
  }}
]

For fields you cannot determine, use null. Only include suggestions you're confident about.
Return ONLY the JSON array, no other text.";

            try
            {
                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.2,
                        maxOutputTokens = 4096
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={_apiKey}";
                var response = await _httpClient.PostAsync(url, content);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    var geminiResponse = JsonSerializer.Deserialize<GeminiResponse>(responseJson);

                    if (geminiResponse?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text is string responseText)
                    {
                        responseText = ExtractJsonFromResponse(responseText);
                        
                        var parsed = JsonSerializer.Deserialize<List<AddressSuggestionResponse>>(responseText, 
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        
                        if (parsed != null)
                        {
                            foreach (var item in parsed)
                            {
                                var customer = customers.FirstOrDefault(c => c.CustomerId == item.Id);
                                if (customer != null)
                                {
                                    suggestions.Add(new AddressSuggestion
                                    {
                                        CustomerId = item.Id,
                                        CustomerName = customer.CustomerName,
                                        CustomerCode = customer.CustomerCode,
                                        CurrentAddress = customer.Address,
                                        CurrentCity = customer.City,
                                        CurrentProvince = customer.Province,
                                        SuggestedProvince = item.SuggestedProvince,
                                        SuggestedCity = item.SuggestedCity,
                                        SuggestedAddress = item.SuggestedAddress,
                                        SuggestedLatitude = item.SuggestedLatitude,
                                        SuggestedLongitude = item.SuggestedLongitude,
                                        Confidence = item.Confidence,
                                        Reasoning = item.Reasoning
                                    });
                                }
                            }
                        }
                    }
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Gemini API error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Gemini API for suggestions");
            }

            return suggestions;
        }

        #region Result Models

        public class AddressSuggestionsResult
        {
            public bool Success { get; set; }
            public int TotalProcessed { get; set; }
            public int Errors { get; set; }
            public string? ErrorMessage { get; set; }
            public List<AddressSuggestion> Suggestions { get; set; } = new();
        }

        public class AddressSuggestion
        {
            public int CustomerId { get; set; }
            public string? CustomerName { get; set; }
            public string? CustomerCode { get; set; }
            public string? CurrentAddress { get; set; }
            public string? CurrentCity { get; set; }
            public string? CurrentProvince { get; set; }
            public string? SuggestedProvince { get; set; }
            public string? SuggestedCity { get; set; }
            public string? SuggestedAddress { get; set; }
            public double? SuggestedLatitude { get; set; }
            public double? SuggestedLongitude { get; set; }
            public double Confidence { get; set; }
            public string? Reasoning { get; set; }
        }

        public class CustomerAddressInfo
        {
            public int CustomerId { get; set; }
            public string? CustomerName { get; set; }
            public string? CustomerCode { get; set; }
            public string? Address { get; set; }
            public string? City { get; set; }
            public string? Province { get; set; }
            public string? PostalCode { get; set; }
            public double? Latitude { get; set; }
            public double? Longitude { get; set; }
            public bool HasMissingAddress { get; set; }
            public bool HasMissingCity { get; set; }
            public bool HasMissingProvince { get; set; }
            public bool HasMissingCoordinates { get; set; }
        }

        private class AddressSuggestionResponse
        {
            [JsonPropertyName("id")]
            public int Id { get; set; }
            
            [JsonPropertyName("suggestedProvince")]
            public string? SuggestedProvince { get; set; }
            
            [JsonPropertyName("suggestedCity")]
            public string? SuggestedCity { get; set; }
            
            [JsonPropertyName("suggestedAddress")]
            public string? SuggestedAddress { get; set; }
            
            [JsonPropertyName("suggestedLatitude")]
            public double? SuggestedLatitude { get; set; }
            
            [JsonPropertyName("suggestedLongitude")]
            public double? SuggestedLongitude { get; set; }
            
            [JsonPropertyName("confidence")]
            public double Confidence { get; set; }
            
            [JsonPropertyName("reasoning")]
            public string? Reasoning { get; set; }
        }

        #endregion

        #region Gemini Response Models

        private class GeminiResponse
        {
            [JsonPropertyName("candidates")]
            public List<Candidate>? Candidates { get; set; }
        }

        private class Candidate
        {
            [JsonPropertyName("content")]
            public ContentResponse? Content { get; set; }
        }

        private class ContentResponse
        {
            [JsonPropertyName("parts")]
            public List<Part>? Parts { get; set; }
        }

        private class Part
        {
            [JsonPropertyName("text")]
            public string? Text { get; set; }
        }

        private class ProvinceMapping
        {
            [JsonPropertyName("id")]
            public int CustomerId { get; set; }

            [JsonPropertyName("province")]
            public string? Province { get; set; }

            [JsonPropertyName("confidence")]
            public double Confidence { get; set; }
        }

        #endregion

        #region Customer Address Lookup

        /// <summary>
        /// Use Gemini AI to find address information for customer names
        /// </summary>
        public async Task<List<CustomerAddressLookupResult>> LookupCustomerAddresses(List<string> customerNames)
        {
            var results = new List<CustomerAddressLookupResult>();

            if (customerNames == null || customerNames.Count == 0)
                return results;

            _logger.LogInformation("Looking up addresses for {Count} customer names using Gemini AI", customerNames.Count);

            try
            {
                var prompt = BuildAddressLookupPrompt(customerNames);
                
                // Build request body
                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.3,
                        maxOutputTokens = 4096
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={_apiKey}";
                var response = await _httpClient.PostAsync(url, content);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    var geminiResponse = JsonSerializer.Deserialize<GeminiResponse>(responseJson);

                    if (geminiResponse?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text is string responseText)
                    {
                        responseText = ExtractJsonFromResponse(responseText);
                        results = ParseAddressLookupResponse(responseText, customerNames);
                    }
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Gemini API error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error looking up customer addresses with Gemini");
            }

            return results;
        }

        private string BuildAddressLookupPrompt(List<string> customerNames)
        {
            var sb = new StringBuilder();
            sb.AppendLine("You are an expert on South African businesses, hospitals, clinics, government facilities, and organizations.");
            sb.AppendLine();
            sb.AppendLine("TASK: Find the GPS coordinates (latitude, longitude) for each customer name from an Excel import.");
            sb.AppendLine("These customer names are mostly hospitals, clinics, pharmacies, and healthcare facilities in South Africa.");
            sb.AppendLine();
            sb.AppendLine("For each customer name below, provide:");
            sb.AppendLine("1. The most likely city/town where this facility is located");
            sb.AppendLine("2. The province (one of: Eastern Cape, Free State, Gauteng, KwaZulu-Natal, Limpopo, Mpumalanga, Northern Cape, North West, Western Cape)");
            sb.AppendLine("3. A full street address if you know it (otherwise provide the suburb/area name)");
            sb.AppendLine("4. Your confidence level (0.0 to 1.0) - be honest, use 0.5 or lower if uncertain");
            sb.AppendLine();
            sb.AppendLine("IMPORTANT GUIDELINES:");
            sb.AppendLine("- These are REAL South African facilities from an actual delivery Excel file");
            sb.AppendLine("- Use your knowledge of SA hospitals, clinics, and healthcare facilities");
            sb.AppendLine("- If the name includes a location (e.g., 'Pretoria Hospital'), use that location");
            sb.AppendLine("- If unsure, provide your best guess with lower confidence (<0.5)");
            sb.AppendLine();
            sb.AppendLine("Customer names from Excel import:");
            for (int i = 0; i < customerNames.Count; i++)
            {
                sb.AppendLine($"{i + 1}. {customerNames[i]}");
            }
            sb.AppendLine();
            sb.AppendLine("Respond ONLY with a valid JSON array in this exact format:");
            sb.AppendLine("[");
            sb.AppendLine("  {");
            sb.AppendLine("    \"customerName\": \"EXACT CUSTOMER NAME FROM ABOVE\",");
            sb.AppendLine("    \"city\": \"City/Town Name\",");
            sb.AppendLine("    \"province\": \"Province Name\",");
            sb.AppendLine("    \"address\": \"Full street address or suburb/area\",");
            sb.AppendLine("    \"confidence\": 0.85,");
            sb.AppendLine("    \"reasoning\": \"How you identified this location\"");
            sb.AppendLine("  }");
            sb.AppendLine("]");
            sb.AppendLine();
            sb.AppendLine("If you cannot identify a customer, still include them with confidence 0.0 and reasoning explaining why.");
            sb.AppendLine("NOTE: The address you provide will be used to get GPS coordinates via geocoding.");

            return sb.ToString();
        }

        private List<CustomerAddressLookupResult> ParseAddressLookupResponse(string response, List<string> originalNames)
        {
            var results = new List<CustomerAddressLookupResult>();

            try
            {
                // Find JSON array in response
                var jsonStart = response.IndexOf('[');
                var jsonEnd = response.LastIndexOf(']');

                if (jsonStart >= 0 && jsonEnd > jsonStart)
                {
                    var jsonContent = response.Substring(jsonStart, jsonEnd - jsonStart + 1);
                    var parsed = JsonSerializer.Deserialize<List<AddressLookupResponse>>(jsonContent, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

                    if (parsed != null)
                    {
                        foreach (var item in parsed)
                        {
                            results.Add(new CustomerAddressLookupResult
                            {
                                CustomerName = item.CustomerName ?? "",
                                City = item.City,
                                Province = NormalizeProvinceName(item.Province),
                                Address = item.Address,
                                Confidence = item.Confidence,
                                Reasoning = item.Reasoning,
                                Source = "GeminiAI"
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing address lookup response: {Response}", response);
            }

            return results;
        }

        private string? NormalizeProvinceName(string? province)
        {
            if (string.IsNullOrEmpty(province))
                return null;

            var lower = province.ToLower().Trim();

            // Map common abbreviations and variations
            if (lower.Contains("gauteng") || lower == "gp")
                return "Gauteng";
            if (lower.Contains("kwazulu") || lower.Contains("kzn") || lower == "kzn")
                return "KwaZulu-Natal";
            if (lower.Contains("western cape") || lower == "wc")
                return "Western Cape";
            if (lower.Contains("eastern cape") || lower == "ec")
                return "Eastern Cape";
            if (lower.Contains("mpumalanga") || lower == "mp")
                return "Mpumalanga";
            if (lower.Contains("limpopo") || lower == "lp")
                return "Limpopo";
            if (lower.Contains("free state") || lower == "fs")
                return "Free State";
            if (lower.Contains("north west") || lower == "nw")
                return "North West";
            if (lower.Contains("northern cape") || lower == "nc")
                return "Northern Cape";

            return province;
        }

        public class CustomerAddressLookupResult
        {
            public string CustomerName { get; set; } = "";
            public string? City { get; set; }
            public string? Province { get; set; }
            public string? Address { get; set; }
            public double Confidence { get; set; }
            public string? Reasoning { get; set; }
            public string Source { get; set; } = "GeminiAI";
        }

        private class AddressLookupResponse
        {
            [JsonPropertyName("customerName")]
            public string? CustomerName { get; set; }

            [JsonPropertyName("city")]
            public string? City { get; set; }

            [JsonPropertyName("province")]
            public string? Province { get; set; }

            [JsonPropertyName("address")]
            public string? Address { get; set; }

            [JsonPropertyName("confidence")]
            public double Confidence { get; set; }

            [JsonPropertyName("reasoning")]
            public string? Reasoning { get; set; }
        }

        #endregion

        #region Bulk City-to-Province Fix

        /// <summary>
        /// Hard-coded dictionary of common South African cities/towns to their provinces.
        /// This avoids unnecessary API calls for well-known locations.
        /// </summary>
        private static readonly Dictionary<string, string> KnownCityProvinceMap = new(StringComparer.OrdinalIgnoreCase)
        {
            // Gauteng
            {"johannesburg", "Gauteng"}, {"sandton", "Gauteng"}, {"pretoria", "Gauteng"}, {"centurion", "Gauteng"},
            {"midrand", "Gauteng"}, {"randburg", "Gauteng"}, {"roodepoort", "Gauteng"}, {"soweto", "Gauteng"},
            {"germiston", "Gauteng"}, {"boksburg", "Gauteng"}, {"benoni", "Gauteng"}, {"kempton park", "Gauteng"},
            {"edenvale", "Gauteng"}, {"alberton", "Gauteng"}, {"springs", "Gauteng"}, {"brakpan", "Gauteng"},
            {"krugersdorp", "Gauteng"}, {"randfontein", "Gauteng"}, {"vereeniging", "Gauteng"}, {"vanderbijlpark", "Gauteng"},
            {"carletonville", "Gauteng"}, {"nigel", "Gauteng"}, {"tembisa", "Gauteng"}, {"fourways", "Gauteng"},
            {"rivonia", "Gauteng"}, {"bedfordview", "Gauteng"}, {"bryanston", "Gauteng"}, {"lonehill", "Gauteng"},
            {"sunninghill", "Gauteng"}, {"isando", "Gauteng"}, {"spartan", "Gauteng"}, {"jet park", "Gauteng"},
            {"meadowdale", "Gauteng"}, {"modderfontein", "Gauteng"}, {"halfway house", "Gauteng"},
            {"kyalami", "Gauteng"}, {"woodmead", "Gauteng"}, {"hatfield", "Gauteng"}, {"menlyn", "Gauteng"},
            {"irene", "Gauteng"}, {"silverton", "Gauteng"}, {"mamelodi", "Gauteng"}, {"atteridgeville", "Gauteng"},
            {"soshanguve", "Gauteng"}, {"ga-rankuwa", "Gauteng"}, {"bronkhorstspruit", "Gauteng"},
            {"heidelberg", "Gauteng"}, {"meyerton", "Gauteng"},
            {"sebenza", "Gauteng"}, {"roodekop", "Gauteng"}, {"katlehong", "Gauteng"}, {"thokoza", "Gauteng"},
            {"vosloorus", "Gauteng"}, {"tsakane", "Gauteng"}, {"daveyton", "Gauteng"}, {"duduza", "Gauteng"},
            {"wattville", "Gauteng"}, {"kya sand", "Gauteng"}, {"diepsloot", "Gauteng"}, {"cosmo city", "Gauteng"},
            {"honeydew", "Gauteng"}, {"northcliff", "Gauteng"}, {"florida", "Gauteng"}, {"rosettenville", "Gauteng"},
            {"booysens", "Gauteng"}, {"turffontein", "Gauteng"}, {"linbro park", "Gauteng"}, {"kelvin", "Gauteng"},
            {"selby", "Gauteng"}, {"city deep", "Gauteng"}, {"aeroton", "Gauteng"}, {"devland", "Gauteng"},
            {"lenasia", "Gauteng"}, {"ennerdale", "Gauteng"}, {"orange farm", "Gauteng"}, {"walkerville", "Gauteng"},
            {"westonaria", "Gauteng"}, {"magaliesburg", "Gauteng"}, {"muldersdrift", "Gauteng"},
            {"lanseria", "Gauteng"}, {"erasmuskloof", "Gauteng"}, {"waterkloof", "Gauteng"}, {"brooklyn", "Gauteng"},
            {"lynnwood", "Gauteng"}, {"faerie glen", "Gauteng"}, {"garsfontein", "Gauteng"}, {"moreleta park", "Gauteng"},
            {"montana", "Gauteng"}, {"wonderboom", "Gauteng"}, {"akasia", "Gauteng"}, {"rosslyn", "Gauteng"},
            {"waltloo", "Gauteng"}, {"koedoespoort", "Gauteng"}, {"hercules", "Gauteng"}, {"capital park", "Gauteng"},
            {"gezina", "Gauteng"}, {"rietfontein", "Gauteng"}, {"derdepoort", "Gauteng"},
            {"ekurhuleni", "Gauteng"}, {"tshwane", "Gauteng"}, {"jhb", "Gauteng"}, {"pta", "Gauteng"},
            {"fourways gardens", "Gauteng"}, {"dainfern", "Gauteng"}, {"chartwell", "Gauteng"},
            {"kempton pk", "Gauteng"}, {"pomona", "Gauteng"}, {"glen marais", "Gauteng"},
            {"bartlett", "Gauteng"}, {"primrose", "Gauteng"}, {"elsburg", "Gauteng"},
            {"elandsfontein", "Gauteng"}, {"wadeville", "Gauteng"}, {"alrode", "Gauteng"},
            {"brackendowns", "Gauteng"}, {"brackengate", "Gauteng"}, {"glenvista", "Gauteng"},
            {"the reeds", "Gauteng"}, {"zwartkop", "Gauteng"}, {"lyttleton", "Gauteng"},
            {"raslouw", "Gauteng"}, {"highveld", "Gauteng"}, {"rooihuiskraal", "Gauteng"},
            
            // KwaZulu-Natal
            {"durban", "KwaZulu-Natal"}, {"pietermaritzburg", "KwaZulu-Natal"}, {"richards bay", "KwaZulu-Natal"},
            {"newcastle", "KwaZulu-Natal"}, {"ladysmith", "KwaZulu-Natal"}, {"port shepstone", "KwaZulu-Natal"},
            {"pinetown", "KwaZulu-Natal"}, {"umhlanga", "KwaZulu-Natal"}, {"ballito", "KwaZulu-Natal"},
            {"amanzimtoti", "KwaZulu-Natal"}, {"chatsworth", "KwaZulu-Natal"}, {"phoenix", "KwaZulu-Natal"},
            {"verulam", "KwaZulu-Natal"}, {"tongaat", "KwaZulu-Natal"}, {"stanger", "KwaZulu-Natal"},
            {"kwadukuza", "KwaZulu-Natal"}, {"empangeni", "KwaZulu-Natal"}, {"eshowe", "KwaZulu-Natal"},
            {"ulundi", "KwaZulu-Natal"}, {"vryheid", "KwaZulu-Natal"}, {"dundee", "KwaZulu-Natal"},
            {"glencoe", "KwaZulu-Natal"}, {"kokstad", "KwaZulu-Natal"}, {"margate", "KwaZulu-Natal"},
            {"scottburgh", "KwaZulu-Natal"}, {"umkomaas", "KwaZulu-Natal"}, {"howick", "KwaZulu-Natal"},
            {"hilton", "KwaZulu-Natal"}, {"estcourt", "KwaZulu-Natal"}, {"bergville", "KwaZulu-Natal"},
            {"winterton", "KwaZulu-Natal"}, {"greytown", "KwaZulu-Natal"}, {"paulpietersburg", "KwaZulu-Natal"},
            {"pongola", "KwaZulu-Natal"}, {"mtubatuba", "KwaZulu-Natal"}, {"hluhluwe", "KwaZulu-Natal"},
            {"ixopo", "KwaZulu-Natal"}, {"harding", "KwaZulu-Natal"}, {"hibberdene", "KwaZulu-Natal"},
            {"pennington", "KwaZulu-Natal"}, {"park rynie", "KwaZulu-Natal"}, {"umzinto", "KwaZulu-Natal"},
            {"westville", "KwaZulu-Natal"}, {"hillcrest", "KwaZulu-Natal"}, {"kloof", "KwaZulu-Natal"},
            {"gillitts", "KwaZulu-Natal"}, {"waterfall", "KwaZulu-Natal"}, {"shallcross", "KwaZulu-Natal"},
            {"merebank", "KwaZulu-Natal"}, {"jacobs", "KwaZulu-Natal"}, {"mobeni", "KwaZulu-Natal"},
            {"prospecton", "KwaZulu-Natal"}, {"isipingo", "KwaZulu-Natal"}, {"umlazi", "KwaZulu-Natal"},
            {"kwamashu", "KwaZulu-Natal"}, {"ntuzuma", "KwaZulu-Natal"}, {"inanda", "KwaZulu-Natal"},
            {"cato ridge", "KwaZulu-Natal"}, {"camperdown", "KwaZulu-Natal"}, {"hammarsdale", "KwaZulu-Natal"},
            {"mpumalanga", "KwaZulu-Natal"}, // Mpumalanga township in KZN, not the province
            {"mandeni", "KwaZulu-Natal"}, {"isiThebe", "KwaZulu-Natal"}, {"nkandla", "KwaZulu-Natal"},
            {"melmoth", "KwaZulu-Natal"}, {"jozini", "KwaZulu-Natal"}, {"mkuze", "KwaZulu-Natal"},
            {"mbazwana", "KwaZulu-Natal"}, {"nongoma", "KwaZulu-Natal"}, {"babanango", "KwaZulu-Natal"},
            {"dbn", "KwaZulu-Natal"}, {"pmb", "KwaZulu-Natal"}, {"durban north", "KwaZulu-Natal"},
            {"umgeni park", "KwaZulu-Natal"}, {"mayville", "KwaZulu-Natal"}, {"berea", "KwaZulu-Natal"},
            {"morningside", "KwaZulu-Natal"}, {"musgrave", "KwaZulu-Natal"}, {"glenwood", "KwaZulu-Natal"},
            {"overport", "KwaZulu-Natal"}, {"sydenham", "KwaZulu-Natal"}, {"sherwood", "KwaZulu-Natal"},
            {"new germany", "KwaZulu-Natal"}, {"reservoir hills", "KwaZulu-Natal"},
            {"la lucia", "KwaZulu-Natal"}, {"mount edgecombe", "KwaZulu-Natal"}, {"cornubia", "KwaZulu-Natal"},
            {"redcliffe", "KwaZulu-Natal"}, {"canelands", "KwaZulu-Natal"}, {"shakas head", "KwaZulu-Natal"},
            
            // Western Cape
            {"cape town", "Western Cape"}, {"stellenbosch", "Western Cape"}, {"paarl", "Western Cape"},
            {"george", "Western Cape"}, {"knysna", "Western Cape"}, {"mossel bay", "Western Cape"},
            {"worcester", "Western Cape"}, {"bellville", "Western Cape"}, {"brackenfell", "Western Cape"},
            {"durbanville", "Western Cape"}, {"kraaifontein", "Western Cape"}, {"kuilsriver", "Western Cape"},
            {"kuils river", "Western Cape"}, {"mitchells plain", "Western Cape"}, {"khayelitsha", "Western Cape"},
            {"somerset west", "Western Cape"}, {"strand", "Western Cape"}, {"gordon's bay", "Western Cape"},
            {"hermanus", "Western Cape"}, {"franschhoek", "Western Cape"}, {"wellington", "Western Cape"},
            {"malmesbury", "Western Cape"}, {"atlantis", "Western Cape"}, {"table view", "Western Cape"},
            {"milnerton", "Western Cape"}, {"bloubergstrand", "Western Cape"}, {"parow", "Western Cape"},
            {"goodwood", "Western Cape"}, {"plumstead", "Western Cape"}, {"wynberg", "Western Cape"},
            {"claremont", "Western Cape"}, {"rondebosch", "Western Cape"}, {"newlands", "Western Cape"},
            {"constantia", "Western Cape"}, {"hout bay", "Western Cape"}, {"fish hoek", "Western Cape"},
            {"simons town", "Western Cape"}, {"muizenberg", "Western Cape"}, {"tokai", "Western Cape"},
            {"retreat", "Western Cape"}, {"grassy park", "Western Cape"}, {"ottery", "Western Cape"},
            {"lansdowne", "Western Cape"}, {"athlone", "Western Cape"}, {"langa", "Western Cape"},
            {"gugulethu", "Western Cape"}, {"nyanga", "Western Cape"}, {"philippi", "Western Cape"},
            {"epping", "Western Cape"}, {"maitland", "Western Cape"}, {"woodstock", "Western Cape"},
            {"salt river", "Western Cape"}, {"observatory", "Western Cape"}, {"gardens", "Western Cape"},
            {"sea point", "Western Cape"}, {"green point", "Western Cape"}, {"camps bay", "Western Cape"},
            {"clifton", "Western Cape"}, {"century city", "Western Cape"}, {"montague gardens", "Western Cape"},
            {"blackheath", "Western Cape"}, {"blue downs", "Western Cape"}, {"eerste river", "Western Cape"},
            {"macassar", "Western Cape"}, {"grabouw", "Western Cape"}, {"caledon", "Western Cape"},
            {"bredasdorp", "Western Cape"}, {"swellendam", "Western Cape"}, {"beaufort west", "Western Cape"},
            {"oudtshoorn", "Western Cape"}, {"plettenberg bay", "Western Cape"}, {"wilderness", "Western Cape"},
            {"riversdale", "Western Cape"}, {"albertinia", "Western Cape"}, {"ladismith", "Western Cape"},
            {"clanwilliam", "Western Cape"}, {"citrusdal", "Western Cape"}, {"piketberg", "Western Cape"},
            {"darling", "Western Cape"}, {"saldanha", "Western Cape"}, {"langebaan", "Western Cape"},
            {"vredenburg", "Western Cape"}, {"st helena bay", "Western Cape"}, {"velddrif", "Western Cape"},
            {"cpt", "Western Cape"}, {"cape twn", "Western Cape"},
            {"delft", "Western Cape"}, {"elsies river", "Western Cape"}, {"bonteheuwel", "Western Cape"},
            {"ravensmead", "Western Cape"}, {"bishop lavis", "Western Cape"}, {"edgemead", "Western Cape"},
            {"bothasig", "Western Cape"}, {"plattekloof", "Western Cape"}, {"panorama", "Western Cape"},
            {"tyger valley", "Western Cape"}, {"tygervalley", "Western Cape"},
            {"stikland", "Western Cape"}, {"kensington", "Western Cape"},
            
            // Eastern Cape
            {"port elizabeth", "Eastern Cape"}, {"east london", "Eastern Cape"}, {"mthatha", "Eastern Cape"},
            {"umtata", "Eastern Cape"}, {"grahamstown", "Eastern Cape"}, {"makhanda", "Eastern Cape"},
            {"king williams town", "Eastern Cape"}, {"king william's town", "Eastern Cape"},
            {"queenstown", "Eastern Cape"}, {"uitenhage", "Eastern Cape"}, {"kariega", "Eastern Cape"},
            {"despatch", "Eastern Cape"}, {"jeffreys bay", "Eastern Cape"}, {"humansdorp", "Eastern Cape"},
            {"graaff-reinet", "Eastern Cape"}, {"cradock", "Eastern Cape"}, {"fort beaufort", "Eastern Cape"},
            {"aliwal north", "Eastern Cape"}, {"elliot", "Eastern Cape"}, {"butterworth", "Eastern Cape"},
            {"gcuwa", "Eastern Cape"}, {"komani", "Eastern Cape"}, {"bisho", "Eastern Cape"},
            {"bhisho", "Eastern Cape"}, {"mdantsane", "Eastern Cape"}, {"zwelitsha", "Eastern Cape"},
            {"stutterheim", "Eastern Cape"}, {"cathcart", "Eastern Cape"}, {"tarkastad", "Eastern Cape"},
            {"steynsburg", "Eastern Cape"}, {"burgersdorp", "Eastern Cape"}, {"sterkstroom", "Eastern Cape"},
            {"cofimvaba", "Eastern Cape"}, {"lady frere", "Eastern Cape"}, {"engcobo", "Eastern Cape"},
            {"mount frere", "Eastern Cape"}, {"mount ayliff", "Eastern Cape"}, {"flagstaff", "Eastern Cape"},
            {"lusikisiki", "Eastern Cape"}, {"port st johns", "Eastern Cape"}, {"willowvale", "Eastern Cape"},
            {"idutywa", "Eastern Cape"}, {"dutywa", "Eastern Cape"}, {"centane", "Eastern Cape"},
            {"pe", "Eastern Cape"}, {"gqeberha", "Eastern Cape"}, {"nelson mandela bay", "Eastern Cape"},
            {"colchester", "Eastern Cape"}, {"addo", "Eastern Cape"}, {"sundays river", "Eastern Cape"},
            {"somerset east", "Eastern Cape"}, {"adelaide", "Eastern Cape"}, {"bedford", "Eastern Cape"},
            {"kenton on sea", "Eastern Cape"}, {"port alfred", "Eastern Cape"}, {"bathurst", "Eastern Cape"},
            
            // Free State
            {"bloemfontein", "Free State"}, {"welkom", "Free State"}, {"kroonstad", "Free State"},
            {"bethlehem", "Free State"}, {"harrismith", "Free State"}, {"parys", "Free State"},
            {"sasolburg", "Free State"}, {"virginia", "Free State"}, {"phuthaditjhaba", "Free State"},
            {"qwaqwa", "Free State"}, {"ficksburg", "Free State"}, {"ladybrand", "Free State"},
            {"senekal", "Free State"}, {"reitz", "Free State"}, {"frankfort", "Free State"},
            {"heilbron", "Free State"}, {"vrede", "Free State"}, {"warden", "Free State"},
            {"zastron", "Free State"}, {"trompsburg", "Free State"}, {"philippolis", "Free State"},
            {"boshof", "Free State"}, {"brandfort", "Free State"}, {"winburg", "Free State"},
            {"theunissen", "Free State"}, {"hennenman", "Free State"}, {"odendaalsrus", "Free State"},
            {"botshabelo", "Free State"}, {"thaba nchu", "Free State"}, {"mangaung", "Free State"},
            
            // Limpopo
            {"polokwane", "Limpopo"}, {"tzaneen", "Limpopo"}, {"mokopane", "Limpopo"},
            {"lephalale", "Limpopo"}, {"musina", "Limpopo"}, {"louis trichardt", "Limpopo"},
            {"makhado", "Limpopo"}, {"thohoyandou", "Limpopo"}, {"giyani", "Limpopo"},
            {"phalaborwa", "Limpopo"}, {"modimolle", "Limpopo"}, {"nylstroom", "Limpopo"},
            {"bela-bela", "Limpopo"}, {"warmbaths", "Limpopo"}, {"thabazimbi", "Limpopo"},
            {"marble hall", "Limpopo"}, {"groblersdal", "Limpopo"}, {"burgersfort", "Limpopo"},
            {"jane furse", "Limpopo"}, {"lebowakgomo", "Limpopo"}, {"seshego", "Limpopo"},
            {"mankweng", "Limpopo"}, {"botlokwa", "Limpopo"}, {"dendron", "Limpopo"},
            {"mogwadi", "Limpopo"}, {"pietersburg", "Limpopo"}, {"naboomspruit", "Limpopo"},
            {"ellisras", "Limpopo"}, {"messina", "Limpopo"},
            {"hoedspruit", "Limpopo"}, {"klaserie", "Limpopo"},
            
            // Mpumalanga
            {"nelspruit", "Mpumalanga"}, {"mbombela", "Mpumalanga"}, {"witbank", "Mpumalanga"},
            {"emalahleni", "Mpumalanga"}, {"middelburg", "Mpumalanga"}, {"secunda", "Mpumalanga"},
            {"standerton", "Mpumalanga"}, {"ermelo", "Mpumalanga"}, {"piet retief", "Mpumalanga"},
            {"volksrust", "Mpumalanga"}, {"barberton", "Mpumalanga"}, {"komatipoort", "Mpumalanga"},
            {"malelane", "Mpumalanga"}, {"white river", "Mpumalanga"}, {"hazyview", "Mpumalanga"},
            {"sabie", "Mpumalanga"}, {"graskop", "Mpumalanga"}, {"lydenburg", "Mpumalanga"},
            {"mashishing", "Mpumalanga"}, {"bethal", "Mpumalanga"}, {"hendrina", "Mpumalanga"},
            {"ogies", "Mpumalanga"}, {"kinross", "Mpumalanga"}, {"evander", "Mpumalanga"},
            {"trichardt", "Mpumalanga"}, {"carolina", "Mpumalanga"}, {"badplaas", "Mpumalanga"},
            {"delmas", "Mpumalanga"}, {"kriel", "Mpumalanga"}, {"phola", "Mpumalanga"},
            {"bushbuckridge", "Mpumalanga"}, {"acornhoek", "Mpumalanga"}, {"thulamahashe", "Mpumalanga"},
            {"kabokweni", "Mpumalanga"}, {"kanyamazane", "Mpumalanga"}, {"matsulu", "Mpumalanga"},
            
            // North West
            {"rustenburg", "North West"}, {"potchefstroom", "North West"}, {"klerksdorp", "North West"},
            {"mahikeng", "North West"}, {"mafikeng", "North West"}, {"mmabatho", "North West"},
            {"brits", "North West"}, {"hartbeespoort", "North West"}, {"sun city", "North West"},
            {"lichtenburg", "North West"}, {"vryburg", "North West"}, {"zeerust", "North West"},
            {"christiana", "North West"}, {"wolmaransstad", "North West"}, {"schweizer-reneke", "North West"},
            {"stilfontein", "North West"}, {"orkney", "North West"}, {"coligny", "North West"},
            {"delareyville", "North West"}, {"sannieshof", "North West"}, {"swartruggens", "North West"},
            {"koster", "North West"}, {"derby", "North West"}, {"mogale city", "North West"},
            {"madibeng", "North West"}, {"mooinooi", "North West"}, {"bapong", "North West"},
            {"ga-motlatla", "North West"}, {"phokeng", "North West"}, {"tlhabane", "North West"},
            
            // Northern Cape
            {"kimberley", "Northern Cape"}, {"upington", "Northern Cape"}, {"springbok", "Northern Cape"},
            {"de aar", "Northern Cape"}, {"kuruman", "Northern Cape"}, {"kathu", "Northern Cape"},
            {"postmasburg", "Northern Cape"}, {"jan kempdorp", "Northern Cape"}, {"warrenton", "Northern Cape"},
            {"prieska", "Northern Cape"}, {"colesberg", "Northern Cape"}, {"hanover", "Northern Cape"},
            {"richmond", "Northern Cape"}, {"victoria west", "Northern Cape"}, {"carnarvon", "Northern Cape"},
            {"calvinia", "Northern Cape"}, {"sutherland", "Northern Cape"}, {"kakamas", "Northern Cape"},
            {"kenhardt", "Northern Cape"}, {"pofadder", "Northern Cape"}, {"douglas", "Northern Cape"},
            {"griekwastad", "Northern Cape"}, {"danielskuil", "Northern Cape"}, {"lime acres", "Northern Cape"},
            {"olifantshoek", "Northern Cape"}, {"sishen", "Northern Cape"},
            {"port nolloth", "Northern Cape"}, {"kleinsee", "Northern Cape"}, {"alexander bay", "Northern Cape"},
            
            // === Extended mappings: misspellings, suburbs, smaller towns ===
            
            // Gauteng - suburbs and misspellings
            {"braamfontein", "Gauteng"}, {"cullinan", "Gauteng"}, {"lyttelton", "Gauteng"},
            {"hillbrow", "Gauteng"}, {"parktown", "Gauteng"}, {"pretoria east", "Gauteng"},
            {"pretoria west", "Gauteng"}, {"arcadia", "Gauteng"}, {"bertsham", "Gauteng"},
            {"brixton", "Gauteng"}, {"bramley", "Gauteng"}, {"boschkop", "Gauteng"},
            {"bergvlei", "Gauteng"}, {"diepkloof", "Gauteng"}, {"douglasdale", "Gauteng"},
            {"boipatong", "Gauteng"}, {"pyramid", "Gauteng"}, {"temba", "Gauteng"},
            {"protea north", "Gauteng"}, {"langlaagte", "Gauteng"}, {"cleveland", "Gauteng"},
            {"laudium", "Gauteng"}, {"sinoville", "Gauteng"}, {"sunnyside", "Gauteng"},
            {"silver lakes", "Gauteng"}, {"hennopspark", "Gauteng"}, {"garsfontein east", "Gauteng"},
            {"vereeninging", "Gauteng"}, {"vanderbilpark", "Gauteng"}, {"mondeor", "Gauteng"},
            {"highland north", "Gauteng"}, {"highlands north", "Gauteng"}, {"linden", "Gauteng"},
            {"parkview", "Gauteng"}, {"fairland", "Gauteng"}, {"meadowlands", "Gauteng"},
            {"orlando east", "Gauteng"}, {"chiawelo", "Gauteng"}, {"sebokeng", "Gauteng"},
            {"sharpville", "Gauteng"}, {"khutsong", "Gauteng"}, {"oberholzer", "Gauteng"},
            {"mabopane", "Gauteng"}, {"hammanskraal", "Gauteng"}, {"morula", "Gauteng"},
            {"katleheng", "Gauteng"}, {"dunswart", "Gauteng"}, {"primrose park", "Gauteng"},
            {"greater nigel", "Gauteng"}, {"devon", "Gauteng"}, {"balfour", "Gauteng"},
            {"glenanda", "Gauteng"}, {"southdale", "Gauteng"}, {"south hills", "Gauteng"},
            {"eldorado park ext 5", "Gauteng"}, {"kliptown", "Gauteng"}, {"kliprivier", "Gauteng"},
            {"ekangala", "Gauteng"}, {"lynn east", "Gauteng"}, {"pretpria", "Gauteng"},
            {"mamelodi west", "Gauteng"}, {"prinshof pretoria", "Gauteng"}, {"rietondale", "Gauteng"},
            {"jpohannesburg", "Gauteng"}, {"gp", "Gauteng"},
            {"rivonia boulevard", "Gauteng"}, {"lonehill fourways", "Gauteng"},
            {"fochville", "Gauteng"}, {"wedela", "Gauteng"},
            {"waverley", "Gauteng"}, {"petit", "Gauteng"}, {"west rand k9 unit", "Gauteng"},
            {"o.r tambo international airport", "Gauteng"}, {"riverdale road, jhb", "Gauteng"},
            {"farm 163 mogale city", "Gauteng"},
            {"luipaardsvlei", "Gauteng"}, {"welgedacht road", "Gauteng"},
            {"zandfontein 317jr", "Gauteng"}, {"rietvlei", "Gauteng"},
            {"van riebeeck park", "Gauteng"}, {"grootvlei", "Gauteng"},
            
            // KwaZulu-Natal - suburbs, misspellings, smaller towns
            {"kwa mashu", "KwaZulu-Natal"}, {"bizana", "KwaZulu-Natal"}, {"dalton", "KwaZulu-Natal"},
            {"umzimkhulu", "KwaZulu-Natal"}, {"umzimkulu", "KwaZulu-Natal"}, {"bluff", "KwaZulu-Natal"},
            {"bluff military base", "KwaZulu-Natal"}, {"cascades", "KwaZulu-Natal"}, {"cato manor", "KwaZulu-Natal"},
            {"chesterville", "KwaZulu-Natal"}, {"colenso", "KwaZulu-Natal"}, {"congela", "KwaZulu-Natal"},
            {"congella", "KwaZulu-Natal"}, {"creighton", "KwaZulu-Natal"}, {"cramond", "KwaZulu-Natal"},
            {"dalbridge", "KwaZulu-Natal"}, {"darnall", "KwaZulu-Natal"}, {"ndwedwe", "KwaZulu-Natal"},
            {"mtwalume", "KwaZulu-Natal"}, {"gamalakhe", "KwaZulu-Natal"}, {"glen anil", "KwaZulu-Natal"},
            {"glen ashley", "KwaZulu-Natal"}, {"glenashley", "KwaZulu-Natal"}, {"greyville", "KwaZulu-Natal"},
            {"highflats", "KwaZulu-Natal"}, {"hlabisa", "KwaZulu-Natal"}, {"ingwavuma", "KwaZulu-Natal"},
            {"kwangwanase", "KwaZulu-Natal"}, {"kwalugedlane", "KwaZulu-Natal"},
            {"empangeni rail", "KwaZulu-Natal"}, {"plessislaer", "KwaZulu-Natal"},
            {"newlands west", "KwaZulu-Natal"}, {"newlands east", "KwaZulu-Natal"},
            {"umbumbulu", "KwaZulu-Natal"}, {"umhlali", "KwaZulu-Natal"}, {"mooi river", "KwaZulu-Natal"},
            {"asherville", "KwaZulu-Natal"}, {"ashley", "KwaZulu-Natal"}, {"ashwood", "KwaZulu-Natal"},
            {"austerville", "KwaZulu-Natal"}, {"bellair", "KwaZulu-Natal"}, {"brighton beach", "KwaZulu-Natal"},
            {"dormerton", "KwaZulu-Natal"}, {"anerly", "KwaZulu-Natal"}, {"braidene", "KwaZulu-Natal"},
            {"berea , durban", "KwaZulu-Natal"}, {"aquaville", "KwaZulu-Natal"},
            {"durban central", "KwaZulu-Natal"}, {"durban ( smith street)", "KwaZulu-Natal"},
            {"point durban", "KwaZulu-Natal"}, {"marine parade", "KwaZulu-Natal"},
            {"greenwood park", "KwaZulu-Natal"}, {"ceza", "KwaZulu-Natal"},
            {"besters", "KwaZulu-Natal"}, {"boston", "KwaZulu-Natal"}, {"bulwer", "KwaZulu-Natal"},
            {"donnybrook", "KwaZulu-Natal"}, {"utrecht", "KwaZulu-Natal"},
            {"sundumbili", "KwaZulu-Natal"}, {"mandini", "KwaZulu-Natal"}, {"gingindlovu", "KwaZulu-Natal"},
            {"esikhaleni", "KwaZulu-Natal"}, {"mtunzini", "KwaZulu-Natal"}, {"muden", "KwaZulu-Natal"},
            {"kranskop", "KwaZulu-Natal"}, {"wasbank", "KwaZulu-Natal"}, {"weenen", "KwaZulu-Natal"},
            {"la mercy", "KwaZulu-Natal"}, {"mount edgecombe, kzn", "KwaZulu-Natal"},
            {"mt edgecombe", "KwaZulu-Natal"}, {"kzn", "KwaZulu-Natal"},
            {"kwazulu natal", "KwaZulu-Natal"}, {"malvern", "KwaZulu-Natal"},
            {"marianhill", "KwaZulu-Natal"}, {"marianridge", "KwaZulu-Natal"},
            {"ozwathini", "KwaZulu-Natal"}, {"ozwatini", "KwaZulu-Natal"},
            {"scottville", "KwaZulu-Natal"}, {"wandsbeck", "KwaZulu-Natal"},
            {"wartburg", "KwaZulu-Natal"}, {"kloof, kwazulu-natal", "KwaZulu-Natal"},
            {"manor kwadukuza", "KwaZulu-Natal"}, {"kwambonambi", "KwaZulu-Natal"},
            {"paulpietsburg", "KwaZulu-Natal"}, {"pietermaritburg", "KwaZulu-Natal"},
            {"pinelands, pinetown", "KwaZulu-Natal"}, {"northway", "KwaZulu-Natal"},
            {"botha hill", "KwaZulu-Natal"}, {"mid-illovo", "KwaZulu-Natal"},
            {"moseley", "KwaZulu-Natal"}, {"montclair", "KwaZulu-Natal"},
            {"umbilo", "KwaZulu-Natal"}, {"umhlatuzana", "KwaZulu-Natal"},
            {"umgababa amanzimtoti", "KwaZulu-Natal"}, {"waterloo", "KwaZulu-Natal"},
            {"port shepston", "KwaZulu-Natal"}, {"port edward", "KwaZulu-Natal"},
            {"oribi village, pmb", "KwaZulu-Natal"}, {"rossburgh", "KwaZulu-Natal"},
            {"paddock", "KwaZulu-Natal"}, {"paradise valley", "KwaZulu-Natal"},
            {"glendale kearsney", "KwaZulu-Natal"}, {"nottingham road", "KwaZulu-Natal"},
            {"underberg", "KwaZulu-Natal"}, {"himeville", "KwaZulu-Natal"},
            {"maphumulo", "KwaZulu-Natal"}, {"mapumulo", "KwaZulu-Natal"},
            {"mahlabathini", "KwaZulu-Natal"}, {"mahlabatini", "KwaZulu-Natal"},
            {"nqutu", "KwaZulu-Natal"}, {"ubombo", "KwaZulu-Natal"},
            {"pomeroy", "KwaZulu-Natal"}, {"emondlo", "KwaZulu-Natal"},
            {"madadeni", "KwaZulu-Natal"}, {"osizweni", "KwaZulu-Natal"},
            {"ezakheni", "KwaZulu-Natal"}, {"laxmi", "KwaZulu-Natal"},
            {"red hill", "KwaZulu-Natal"},
            {"redhill", "KwaZulu-Natal"}, {"redfern phoenix", "KwaZulu-Natal"},
            {"ingwavjma", "KwaZulu-Natal"}, {"mount moreland", "KwaZulu-Natal"},
            {"z 1894 umlazi", "KwaZulu-Natal"}, {"sunningdale", "KwaZulu-Natal"},
            {"new hanover saps", "KwaZulu-Natal"}, {"st wendolins", "KwaZulu-Natal"},
            {"tabankulu", "KwaZulu-Natal"},
            {"ezinqoleni", "KwaZulu-Natal"}, {"hlobane", "KwaZulu-Natal"},
            {"impendle", "KwaZulu-Natal"}, {"mkhuhlu", "KwaZulu-Natal"},
            {"ntokozweni", "KwaZulu-Natal"}, {"nyoni", "KwaZulu-Natal"},
            
            // Western Cape - suburbs, misspellings
            {"capetown", "Western Cape"}, {"cape town office", "Western Cape"},
            {"kraafontein", "Western Cape"}, {"pinelands", "Western Cape"},
            {"ysterplaat", "Western Cape"}, {"howard place", "Western Cape"},
            {"clareinch", "Western Cape"}, {"ceres", "Western Cape"},
            {"robertson", "Western Cape"}, {"vredendal", "Western Cape"},
            {"dieprivier", "Western Cape"}, {"parklands", "Western Cape"},
            {"sanlamhof", "Western Cape"}, {"tygerberg", "Western Cape"},
            {"oceanview", "Western Cape"}, {"suider-paarl", "Western Cape"},
            {"tulbagh", "Western Cape"}, {"wolseley", "Western Cape"}, {"mcgregor", "Western Cape"},
            {"villiersdorp", "Western Cape"}, {"genadendal", "Western Cape"},
            {"riviersonderend", "Western Cape"}, {"kleinmond", "Western Cape"},
            {"porterville", "Western Cape"}, {"riebeeck west", "Western Cape"},
            {"malmesburg", "Western Cape"}, {"piketberg road", "Western Cape"},
            {"storms river", "Western Cape"}, {"storms river mouth rest camp", "Western Cape"},
            {"oudshoorn", "Western Cape"}, {"oudshroon", "Western Cape"}, {"oustshoorn", "Western Cape"},
            {"greenpoint", "Western Cape"}, {"windermere centre", "Western Cape"},
            {"kasselsvlei", "Western Cape"}, {"po langebaanweg", "Western Cape"},
            {"lavistown", "Western Cape"}, {"riversdal", "Western Cape"},
            {"st francis bay", "Western Cape"}, {"simonstown", "Western Cape"},
            {"leo road, diep river", "Western Cape"},
            
            // Eastern Cape - suburbs, misspellings, smaller towns
            {"qumbu", "Eastern Cape"}, {"alice", "Eastern Cape"}, {"tsolo", "Eastern Cape"},
            {"mqanduli", "Eastern Cape"}, {"libode", "Eastern Cape"},
            {"kirkwood", "Eastern Cape"}, {"dimbaza", "Eastern Cape"}, {"motherwell", "Eastern Cape"},
            {"linton grange", "Eastern Cape"}, {"sterkspruit", "Eastern Cape"},
            {"cala", "Eastern Cape"}, {"berlin", "Eastern Cape"}, {"dordrecht", "Eastern Cape"},
            {"bityi", "Eastern Cape"}, {"ngcobo", "Eastern Cape"}, {"ngqeleni", "Eastern Cape"},
            {"algoa park", "Eastern Cape"}, {"walmer", "Eastern Cape"},
            {"middledrift", "Eastern Cape"}, {"matatiele", "Eastern Cape"},
            {"mount fletcher", "Eastern Cape"}, {"mt fletcher", "Eastern Cape"},
            {"mt frere", "Eastern Cape"}, {"mt ayliff", "Eastern Cape"},
            {"burgesdorp", "Eastern Cape"}, {"aliwal noord", "Eastern Cape"},
            {"willowmore", "Eastern Cape"}, {"aberdeen", "Eastern Cape"},
            {"graaff reinett", "Eastern Cape"}, {"graaf reinet", "Eastern Cape"},
            {"graaf-reinet", "Eastern Cape"}, {"uittenhage", "Eastern Cape"},
            {"belvedere", "Eastern Cape"}, {"macleantown", "Eastern Cape"},
            {"maclear", "Eastern Cape"}, {"kind willams town", "Eastern Cape"},
            {"king williamstown", "Eastern Cape"}, {"indwe", "Eastern Cape"},
            {"kwanobuhle", "Eastern Cape"}, {"peddie", "Eastern Cape"},
            {"patensie", "Eastern Cape"}, {"paterson", "Eastern Cape"},
            {"joubertina", "Eastern Cape"}, {"kareedouw", "Eastern Cape"},
            {"hankey", "Eastern Cape"}, {"jansenville", "Eastern Cape"},
            {"hofmeyr", "Eastern Cape"}, {"molteno", "Eastern Cape"},
            {"steynburg", "Eastern Cape"}, {"elliotdale", "Eastern Cape"},
            {"port -elizabeth", "Eastern Cape"}, {"east end", "Eastern Cape"},
            {"farningham ridge", "Eastern Cape"}, {"greenfields", "Eastern Cape"},
            {"george botha park", "Eastern Cape"}, {"st albans", "Eastern Cape"},
            {"whittlesea", "Eastern Cape"}, {"zwelitsha]", "Eastern Cape"},
            {"hogsback", "Eastern Cape"}, {"clareendon", "Eastern Cape"},
            {"scottsburgh", "Eastern Cape"}, {"jamestown", "Eastern Cape"},
            {"maluti", "Eastern Cape"}, // Maluti is in EC (near Mount Fletcher)
            {"staffords post", "Eastern Cape"}, {"lusikisi", "Eastern Cape"},
            
            // Free State - suburbs, misspellings
            {"bloemfontein fs", "Free State"}, {"brandhof", "Free State"},
            {"qwa qwa", "Free State"}, {"free state", "Free State"},
            {"bethlem", "Free State"}, {"mafatsana", "Free State"},
            {"phahameng", "Free State"}, {"thabong", "Free State"},
            {"zamdela", "Free State"},
            {"hoopstad", "Free State"}, {"leeudoringstad", "Free State"},
            {"jagersfontein", "Free State"}, {"edenburg", "Free State"},
            {"smithfield", "Free State"}, {"lady grey", "Free State"},
            {"witsieshoek", "Free State"}, {"fauresmith", "Free State"},
            {"amersfoort", "Free State"}, {"bloemhof", "North West"},
            
            // Limpopo - suburbs, misspellings, smaller towns
            {"bela bela", "Limpopo"}, {"alldays", "Limpopo"},
            {"namakgale", "Limpopo"}, {"shayandima", "Limpopo"},
            {"sibasa", "Limpopo"}, {"sibasa venda", "Limpopo"},
            {"sovenga", "Limpopo"}, {"lenyenye", "Limpopo"},
            {"driekop", "Limpopo"}, {"limpopo", "Limpopo"},
            {"nkowankowa township", "Limpopo"}, {"zebediela", "Limpopo"},
            {"mahwelereng", "Limpopo"}, {"mookgophong", "Limpopo"},
            {"mogwase", "North West"}, // Mogwase is in NW near Sun City
            {"tazneen", "Limpopo"}, // misspelling of Tzaneen
            {"gakgapane", "Limpopo"}, {"ka-kgapane", "Limpopo"},
            {"lulekani", "Limpopo"}, {"morokweng", "North West"},
            {"lebokwakgomo", "Limpopo"}, // misspelling of Lebowakgomo
            {"1st floor lebowakgomo", "Limpopo"},
            {"dwarsfontein", "Limpopo"}, {"laersdrift", "Limpopo"},
            {"under makhado municipality", "Limpopo"}, {"schoemansdal", "Limpopo"},
            {"vongani", "Limpopo"}, {"skukuza", "Mpumalanga"},
            
            // Mpumalanga - suburbs, misspellings
            {"belfast", "Mpumalanga"}, {"middleburg", "Mpumalanga"}, // misspelling of Middelburg
            {"barbeton", "Mpumalanga"}, // misspelling of Barberton
            {"hazuview", "Mpumalanga"}, // misspelling of Hazyview
            {"dennilton", "Limpopo"}, {"elukwatini", "Mpumalanga"},
            {"embalenhle", "Mpumalanga"}, {"emzinoni", "Mpumalanga"},
            {"kaapmuiden", "Mpumalanga"}, {"waterval boven", "Mpumalanga"},
            {"leslie", "Mpumalanga"}, {"mbombela, mpumalanga", "Mpumalanga"},
            {"nelspruit central", "Mpumalanga"}, {"nelspruit, mpumalanga", "Mpumalanga"},
            {"kwamhlanga", "Mpumalanga"}, {"malelame", "Mpumalanga"},
            {"915 tweefontein", "Mpumalanga"}, {"blinkpan", "Mpumalanga"},
            
            // North West - suburbs, misspellings
            {"delaryville", "North West"}, // misspelling of Delareyville
            {"taung", "North West"}, {"taung district", "North West"},
            {"taung station", "North West"}, {"hartswater", "North West"},
            {"kreugersdorp", "Gauteng"}, // misspelling, Krugersdorp is in Gauteng
            {"portchefstroom", "North West"}, // misspelling of Potchefstroom
            {"lichenburg", "North West"}, // misspelling of Lichtenburg
            {"schweizer reneke", "North West"}, {"ganyesa", "North West"},
            {"pudimoe", "North West"}, {"skilpadshek poe", "North West"},
            {"ventersdorp", "North West"}, {"east end rustenburg", "North West"},
            {"noordbrug", "North West"}, {"mahikeng road", "North West"},
            
            // Northern Cape - smaller towns
            {"marydale", "Northern Cape"}, {"hopetown", "Northern Cape"},
            {"galeshewe", "Northern Cape"}, {"vanrhynsdorp", "Western Cape"},
            {"vanwyksvlei", "Northern Cape"}, {"loxton", "Northern Cape"},
            {"vosburg", "Northern Cape"},
            
            // Province names used as city (map to themselves)
            {"eastern cape", "Eastern Cape"}, {"gauteng", "Gauteng"},
            {"north west", "North West"}, {"western cape", "Western Cape"},
            {"northern cape", "Northern Cape"},
            
            // Misc/Suburbs that can be mapped
            {"auckland land", "KwaZulu-Natal"}, {"bakerville heights", "North West"},
            {"atholl heights", "Gauteng"}, {"block 14", "Gauteng"}, {"block 4", "Gauteng"},
            {"clernaville", "KwaZulu-Natal"}, {"diskobolos", "KwaZulu-Natal"},
            {"mmakau", "Gauteng"}, {"mmametlhake", "Mpumalanga"},
            {"orange farms", "Gauteng"}, {"thornhill", "Eastern Cape"},
            {"seloshesha", "Free State"}, {"westenburg", "Limpopo"},
            {"louwsburg", "KwaZulu-Natal"}, {"franklin", "KwaZulu-Natal"},
            
            // === Third wave: remaining recognizable cities ===
            {"hammersdale", "KwaZulu-Natal"}, {"isipingo rail", "KwaZulu-Natal"},
            {"south beach", "KwaZulu-Natal"}, {"yeoville", "Gauteng"},
            {"hartbeespoortdam", "North West"}, {"mosselbay", "Western Cape"},
            {"mossel bag", "Western Cape"}, // misspelling of Mossel Bay
            {"glen cowie", "Limpopo"}, {"ivoorpark", "Limpopo"},
            {"kiasha park", "Gauteng"}, {"lakefeild ext 21", "Gauteng"},
            {"kingsley", "KwaZulu-Natal"}, {"kwa xuma", "Gauteng"},
            {"everest height", "Gauteng"}, {"everest heights", "Gauteng"},
            {"volkrust", "Mpumalanga"}, // misspelling of Volksrust
            {"steynberg", "Eastern Cape"}, {"swartberg", "Eastern Cape"},
            {"ruimsing", "Gauteng"}, {"sibhayi", "KwaZulu-Natal"},
            {"tswelelang", "North West"}, {"staplein", "Gauteng"},
            {"untumjambili", "KwaZulu-Natal"}, {"tinmyne", "Gauteng"},
            {"kanama", "Limpopo"}, {"lerato", "Free State"},
            {"13 morningside", "Gauteng"}, // Morningside suburb
        };

        public class BulkProvinceFixResult
        {
            public bool Success { get; set; }
            public int TotalCustomersWithNoProvince { get; set; }
            public int TotalWithCityNoProvince { get; set; }
            public int FixedByDictionary { get; set; }
            public int FixedByGemini { get; set; }
            public int TotalFixed { get; set; }
            public int StillUnresolved { get; set; }
            public int UniqueUnknownCities { get; set; }
            public int GeminiApiCalls { get; set; }
            public string? ErrorMessage { get; set; }
            public List<string> UnresolvedCities { get; set; } = new();
            public Dictionary<string, int> FixedByProvince { get; set; } = new();
        }

        /// <summary>
        /// Bulk fix missing provinces by mapping cities to provinces.
        /// First uses a hard-coded dictionary, then falls back to Gemini AI for unknown cities.
        /// </summary>
        public async Task<BulkProvinceFixResult> BulkFixMissingProvinces()
        {
            var result = new BulkProvinceFixResult();

            try
            {
                // Step 1: Get all customers with city but no province
                var customers = await _context.LogisticsCustomers
                    .Where(c => 
                        (string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince)) &&
                        (!string.IsNullOrEmpty(c.City) || !string.IsNullOrEmpty(c.DeliveryCity)))
                    .ToListAsync();

                result.TotalCustomersWithNoProvince = await _context.LogisticsCustomers
                    .CountAsync(c => string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince));
                result.TotalWithCityNoProvince = customers.Count;

                _logger.LogInformation("Bulk province fix: {Total} customers with city but no province", customers.Count);

                // Step 2: Build a map of unique cities that need resolving
                var cityToProvince = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var unknownCities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var customer in customers)
                {
                    var city = (customer.City ?? customer.DeliveryCity ?? "").Trim();
                    if (string.IsNullOrEmpty(city) || cityToProvince.ContainsKey(city)) continue;

                    if (KnownCityProvinceMap.TryGetValue(city, out var province))
                    {
                        cityToProvince[city] = province;
                    }
                    else
                    {
                        unknownCities.Add(city);
                    }
                }

                _logger.LogInformation("Dictionary resolved {Known} cities, {Unknown} cities need Gemini",
                    cityToProvince.Count, unknownCities.Count);
                result.UniqueUnknownCities = unknownCities.Count;

                // Step 3: Send unknown cities to Gemini in batches of 50
                if (unknownCities.Count > 0 && !string.IsNullOrEmpty(_apiKey))
                {
                    var unknownList = unknownCities.ToList();
                    var batchSize = 50;
                    
                    for (int i = 0; i < unknownList.Count; i += batchSize)
                    {
                        var batch = unknownList.Skip(i).Take(batchSize).ToList();
                        result.GeminiApiCalls++;

                        try
                        {
                            var mappings = await GetProvincesFromGeminiByCityNames(batch);
                            foreach (var kvp in mappings)
                            {
                                if (!string.IsNullOrEmpty(kvp.Value) && SouthAfricanProvinces.Contains(kvp.Value))
                                {
                                    cityToProvince[kvp.Key] = kvp.Value;
                                    unknownCities.Remove(kvp.Key);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Gemini batch {Batch} failed", i / batchSize + 1);
                        }

                        // Rate limit between batches
                        if (i + batchSize < unknownList.Count)
                            await Task.Delay(1000);
                    }
                }

                // Step 4: Apply all resolved mappings to customers
                int fixedCount = 0;
                var provinceCounters = new Dictionary<string, int>();

                foreach (var customer in customers)
                {
                    var city = (customer.City ?? customer.DeliveryCity ?? "").Trim();
                    if (string.IsNullOrEmpty(city)) continue;

                    if (cityToProvince.TryGetValue(city, out var resolvedProvince))
                    {
                        if (string.IsNullOrEmpty(customer.Province))
                            customer.Province = resolvedProvince;
                        if (string.IsNullOrEmpty(customer.DeliveryProvince))
                            customer.DeliveryProvince = resolvedProvince;
                        customer.UpdatedAt = DateTime.UtcNow;
                        fixedCount++;

                        if (!provinceCounters.ContainsKey(resolvedProvince))
                            provinceCounters[resolvedProvince] = 0;
                        provinceCounters[resolvedProvince]++;
                    }
                }

                await _context.SaveChangesAsync();

                // Step 5: Also fix LoadStops that have city but no province
                var stopsToFix = await _context.LoadStops
                    .Where(s => (string.IsNullOrEmpty(s.Province)) &&
                                (!string.IsNullOrEmpty(s.City)))
                    .ToListAsync();

                int stopsFixed = 0;
                foreach (var stop in stopsToFix)
                {
                    var city = stop.City?.Trim() ?? "";
                    if (cityToProvince.TryGetValue(city, out var prov))
                    {
                        stop.Province = prov;
                        stopsFixed++;
                    }
                }
                if (stopsFixed > 0)
                    await _context.SaveChangesAsync();

                _logger.LogInformation("Bulk province fix: {Fixed} customers + {Stops} stops fixed", fixedCount, stopsFixed);

                result.Success = true;
                result.TotalFixed = fixedCount;
                result.FixedByDictionary = fixedCount; // We'll refine this below
                result.FixedByProvince = provinceCounters;
                result.StillUnresolved = customers.Count - fixedCount;
                result.UnresolvedCities = unknownCities.OrderBy(c => c).Take(100).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in bulk province fix");
                result.Success = false;
                result.ErrorMessage = ex.Message;
            }

            return result;
        }

        /// <summary>
        /// Send a batch of city names to Gemini and get their provinces back
        /// </summary>
        private async Task<Dictionary<string, string>> GetProvincesFromGeminiByCityNames(List<string> cities)
        {
            var results = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            var citiesJson = JsonSerializer.Serialize(cities);
            var prompt = $@"You are a South African geography expert. For each city/town name below, determine which South African province it is located in.

The valid provinces are EXACTLY:
- Eastern Cape
- Free State
- Gauteng
- KwaZulu-Natal
- Limpopo
- Mpumalanga
- Northern Cape
- North West
- Western Cape

Cities to map:
{citiesJson}

Return a JSON object mapping each city to its province. Example:
{{""Pretoria"": ""Gauteng"", ""Durban"": ""KwaZulu-Natal""}}

If you cannot determine the province for a city, map it to null.
Return ONLY the JSON object, no other text.";

            try
            {
                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.1,
                        maxOutputTokens = 4096
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={_apiKey}";
                var response = await _httpClient.PostAsync(url, content);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    var geminiResponse = JsonSerializer.Deserialize<GeminiResponse>(responseJson);

                    if (geminiResponse?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text is string responseText)
                    {
                        responseText = ExtractJsonFromResponse(responseText);
                        
                        var mappings = JsonSerializer.Deserialize<Dictionary<string, string?>>(responseText,
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        if (mappings != null)
                        {
                            foreach (var kvp in mappings)
                            {
                                if (!string.IsNullOrEmpty(kvp.Value))
                                {
                                    results[kvp.Key] = kvp.Value;
                                }
                            }
                        }
                    }
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Gemini API error in city batch: {StatusCode} - {Error}", response.StatusCode, errorContent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Gemini for city batch");
            }

            return results;
        }

        #endregion
    }
}
