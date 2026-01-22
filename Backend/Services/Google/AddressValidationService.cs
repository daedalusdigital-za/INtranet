using System.Text;
using System.Text.Json;

namespace ProjectTracker.API.Services.Google
{
    /// <summary>
    /// Address Validation Service using Google Address Validation API
    /// Validates and standardizes addresses for South Africa
    /// </summary>
    public class AddressValidationService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<AddressValidationService> _logger;

        public AddressValidationService(IHttpClientFactory httpClientFactory, ILogger<AddressValidationService> logger)
        {
            _httpClient = httpClientFactory.CreateClient();
            _logger = logger;
        }

        #region DTOs

        public class AddressValidationResult
        {
            public bool IsValid { get; set; }
            public string ValidationGranularity { get; set; } = ""; // PREMISE, SUB_PREMISE, ROUTE, etc.
            public double ConfidenceScore { get; set; }
            public AddressInput InputAddress { get; set; } = new();
            public StandardizedAddress StandardizedAddress { get; set; } = new();
            public GeoLocation? Geocode { get; set; }
            public List<string> UnconfirmedComponents { get; set; } = new();
            public List<string> MissingComponents { get; set; } = new();
            public string? Error { get; set; }
        }

        public class AddressInput
        {
            public string? AddressLine1 { get; set; }
            public string? AddressLine2 { get; set; }
            public string? City { get; set; }
            public string? Province { get; set; }
            public string? PostalCode { get; set; }
            public string? Country { get; set; }
        }

        public class StandardizedAddress
        {
            public string? FormattedAddress { get; set; }
            public string? StreetNumber { get; set; }
            public string? Route { get; set; }
            public string? Suburb { get; set; }
            public string? City { get; set; }
            public string? Province { get; set; }
            public string? PostalCode { get; set; }
            public string? Country { get; set; }
            public string? PlaceId { get; set; }
        }

        public class GeoLocation
        {
            public double Latitude { get; set; }
            public double Longitude { get; set; }
        }

        public class BatchValidationResult
        {
            public int Total { get; set; }
            public int Valid { get; set; }
            public int Invalid { get; set; }
            public int NeedsReview { get; set; }
            public List<BatchValidationItem> Results { get; set; } = new();
        }

        public class BatchValidationItem
        {
            public int? ReferenceId { get; set; }
            public string InputAddress { get; set; } = "";
            public AddressValidationResult Result { get; set; } = new();
        }

        #endregion

        /// <summary>
        /// Validate a single address using Google Address Validation API
        /// </summary>
        public async Task<AddressValidationResult> ValidateAddressAsync(AddressInput address)
        {
            try
            {
                var requestBody = new
                {
                    address = new
                    {
                        regionCode = address.Country ?? "ZA",
                        addressLines = BuildAddressLines(address)
                    },
                    enableUspsCass = false
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = $"{GoogleMapsConfig.AddressValidationApiUrl}?key={GoogleMapsConfig.ApiKey}";
                var response = await _httpClient.PostAsync(url, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Address validation API error: {StatusCode} - {Error}", 
                        response.StatusCode, errorBody);
                    
                    return new AddressValidationResult 
                    { 
                        IsValid = false, 
                        InputAddress = address,
                        Error = $"API error: {response.StatusCode}" 
                    };
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var doc = JsonDocument.Parse(responseJson);
                var root = doc.RootElement;

                return ParseValidationResponse(root, address);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating address");
                return new AddressValidationResult 
                { 
                    IsValid = false, 
                    InputAddress = address,
                    Error = ex.Message 
                };
            }
        }

        /// <summary>
        /// Validate address from a single string
        /// </summary>
        public async Task<AddressValidationResult> ValidateAddressStringAsync(string addressString)
        {
            var address = new AddressInput
            {
                AddressLine1 = addressString,
                Country = "ZA"
            };
            return await ValidateAddressAsync(address);
        }

        /// <summary>
        /// Batch validate multiple addresses
        /// </summary>
        public async Task<BatchValidationResult> BatchValidateAsync(
            IEnumerable<(AddressInput address, int? referenceId)> addresses)
        {
            var result = new BatchValidationResult();
            var addressList = addresses.ToList();
            result.Total = addressList.Count;

            foreach (var (address, referenceId) in addressList)
            {
                var validationResult = await ValidateAddressAsync(address);
                
                result.Results.Add(new BatchValidationItem
                {
                    ReferenceId = referenceId,
                    InputAddress = BuildFullAddressString(address),
                    Result = validationResult
                });

                if (validationResult.IsValid && validationResult.ConfidenceScore >= 0.8)
                    result.Valid++;
                else if (validationResult.ConfidenceScore >= 0.5)
                    result.NeedsReview++;
                else
                    result.Invalid++;

                // Rate limiting
                await Task.Delay(100);
            }

            return result;
        }

        /// <summary>
        /// Quick validation check for delivery address
        /// </summary>
        public async Task<(bool isDeliverable, string? issue)> IsDeliverableAsync(string address)
        {
            var result = await ValidateAddressStringAsync(address);
            
            if (!result.IsValid)
                return (false, result.Error ?? "Address could not be validated");

            if (result.ConfidenceScore < 0.5)
                return (false, "Address is too ambiguous for reliable delivery");

            if (result.MissingComponents.Any(c => c.Contains("route") || c.Contains("street")))
                return (false, "Street address is missing or incomplete");

            if (result.ValidationGranularity == "OTHER" || result.ValidationGranularity == "ROUTE")
                return (false, "Address not specific enough - need building or unit number");

            return (true, null);
        }

        #region Private Methods

        private string[] BuildAddressLines(AddressInput address)
        {
            var lines = new List<string>();
            
            if (!string.IsNullOrWhiteSpace(address.AddressLine1))
                lines.Add(address.AddressLine1);
            if (!string.IsNullOrWhiteSpace(address.AddressLine2))
                lines.Add(address.AddressLine2);
            
            var cityLine = new List<string>();
            if (!string.IsNullOrWhiteSpace(address.City))
                cityLine.Add(address.City);
            if (!string.IsNullOrWhiteSpace(address.Province))
                cityLine.Add(address.Province);
            if (!string.IsNullOrWhiteSpace(address.PostalCode))
                cityLine.Add(address.PostalCode);
            
            if (cityLine.Any())
                lines.Add(string.Join(", ", cityLine));
            
            if (!string.IsNullOrWhiteSpace(address.Country) && address.Country != "ZA")
                lines.Add(address.Country);

            return lines.ToArray();
        }

        private string BuildFullAddressString(AddressInput address)
        {
            return string.Join(", ", BuildAddressLines(address));
        }

        private AddressValidationResult ParseValidationResponse(JsonElement root, AddressInput inputAddress)
        {
            var result = new AddressValidationResult
            {
                InputAddress = inputAddress
            };

            try
            {
                if (!root.TryGetProperty("result", out var resultElement))
                {
                    result.IsValid = false;
                    result.Error = "No result in response";
                    return result;
                }

                // Get verdict
                if (resultElement.TryGetProperty("verdict", out var verdict))
                {
                    var granularity = verdict.TryGetProperty("validationGranularity", out var g) 
                        ? g.GetString() : "OTHER";
                    result.ValidationGranularity = granularity ?? "OTHER";

                    // Determine validity based on granularity
                    result.IsValid = granularity is "PREMISE" or "SUB_PREMISE" or "PREMISE_PROXIMITY";
                    
                    // Calculate confidence score
                    var hasUnconfirmed = verdict.TryGetProperty("hasUnconfirmedComponents", out var uc) && uc.GetBoolean();
                    var hasInferred = verdict.TryGetProperty("hasInferredComponents", out var ic) && ic.GetBoolean();
                    var hasReplaced = verdict.TryGetProperty("hasReplacedComponents", out var rc) && rc.GetBoolean();

                    result.ConfidenceScore = granularity switch
                    {
                        "PREMISE" => hasUnconfirmed ? 0.85 : 1.0,
                        "SUB_PREMISE" => hasUnconfirmed ? 0.9 : 1.0,
                        "PREMISE_PROXIMITY" => 0.75,
                        "BLOCK" => 0.6,
                        "ROUTE" => 0.4,
                        _ => 0.2
                    };

                    if (hasReplaced) result.ConfidenceScore -= 0.1;
                    if (hasInferred) result.ConfidenceScore -= 0.05;
                }

                // Get standardized address
                if (resultElement.TryGetProperty("address", out var addressElement))
                {
                    result.StandardizedAddress = new StandardizedAddress();

                    if (addressElement.TryGetProperty("formattedAddress", out var fa))
                        result.StandardizedAddress.FormattedAddress = fa.GetString();

                    // Parse address components
                    if (addressElement.TryGetProperty("addressComponents", out var components))
                    {
                        foreach (var comp in components.EnumerateArray())
                        {
                            var types = comp.TryGetProperty("componentType", out var ct) 
                                ? ct.GetString() : "";
                            var text = comp.TryGetProperty("componentName", out var cn)
                                ? (cn.TryGetProperty("text", out var t) ? t.GetString() : "") : "";
                            var confirmationLevel = comp.TryGetProperty("confirmationLevel", out var cl)
                                ? cl.GetString() : "";

                            if (confirmationLevel == "UNCONFIRMED_BUT_PLAUSIBLE" || confirmationLevel == "UNCONFIRMED_AND_SUSPICIOUS")
                                result.UnconfirmedComponents.Add($"{types}: {text}");

                            switch (types)
                            {
                                case "street_number":
                                    result.StandardizedAddress.StreetNumber = text;
                                    break;
                                case "route":
                                    result.StandardizedAddress.Route = text;
                                    break;
                                case "sublocality_level_1":
                                case "neighborhood":
                                    result.StandardizedAddress.Suburb = text;
                                    break;
                                case "locality":
                                    result.StandardizedAddress.City = text;
                                    break;
                                case "administrative_area_level_1":
                                    result.StandardizedAddress.Province = text;
                                    break;
                                case "postal_code":
                                    result.StandardizedAddress.PostalCode = text;
                                    break;
                                case "country":
                                    result.StandardizedAddress.Country = text;
                                    break;
                            }
                        }
                    }

                    // Get missing components
                    if (addressElement.TryGetProperty("missingComponentTypes", out var missing))
                    {
                        result.MissingComponents = missing.EnumerateArray()
                            .Select(m => m.GetString() ?? "")
                            .Where(m => !string.IsNullOrEmpty(m))
                            .ToList();
                    }
                }

                // Get geocode
                if (resultElement.TryGetProperty("geocode", out var geocode))
                {
                    if (geocode.TryGetProperty("location", out var loc))
                    {
                        result.Geocode = new GeoLocation
                        {
                            Latitude = loc.GetProperty("latitude").GetDouble(),
                            Longitude = loc.GetProperty("longitude").GetDouble()
                        };
                    }

                    if (geocode.TryGetProperty("placeId", out var placeId))
                        result.StandardizedAddress.PlaceId = placeId.GetString();
                }

                _logger.LogInformation("Address validation: {Valid}, Granularity: {Granularity}, Confidence: {Confidence}",
                    result.IsValid, result.ValidationGranularity, result.ConfidenceScore);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing validation response");
                result.Error = "Error parsing response";
            }

            return result;
        }

        #endregion
    }
}
