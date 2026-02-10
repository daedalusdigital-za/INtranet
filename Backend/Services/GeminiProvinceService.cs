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
    }
}
