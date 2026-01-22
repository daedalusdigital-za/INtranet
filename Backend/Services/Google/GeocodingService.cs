using System.Text.Json;
using System.Text.Json.Serialization;
using System.Web;

namespace ProjectTracker.API.Services.Google
{
    /// <summary>
    /// Enhanced Geocoding Service using Google Maps Geocoding API
    /// Provides address lookup, reverse geocoding, and province extraction
    /// </summary>
    public class GeocodingService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<GeocodingService> _logger;

        public GeocodingService(IHttpClientFactory httpClientFactory, ILogger<GeocodingService> logger)
        {
            _httpClient = httpClientFactory.CreateClient();
            _logger = logger;
        }

        #region DTOs

        public class GeocodingResult
        {
            public bool Success { get; set; }
            public string? FormattedAddress { get; set; }
            public double? Latitude { get; set; }
            public double? Longitude { get; set; }
            public string? StreetNumber { get; set; }
            public string? Route { get; set; }
            public string? Suburb { get; set; }
            public string? City { get; set; }
            public string? Province { get; set; }
            public string? PostalCode { get; set; }
            public string? Country { get; set; }
            public string? PlaceId { get; set; }
            public string? Error { get; set; }
            public AddressComponent[] RawComponents { get; set; } = Array.Empty<AddressComponent>();
        }

        public class AddressComponent
        {
            public string LongName { get; set; } = "";
            public string ShortName { get; set; } = "";
            public string[] Types { get; set; } = Array.Empty<string>();
        }

        public class BatchGeocodingResult
        {
            public int TotalRequests { get; set; }
            public int Successful { get; set; }
            public int Failed { get; set; }
            public List<GeocodingBatchItem> Results { get; set; } = new();
        }

        public class GeocodingBatchItem
        {
            public string InputAddress { get; set; } = "";
            public int? ReferenceId { get; set; }
            public GeocodingResult Result { get; set; } = new();
        }

        #endregion

        /// <summary>
        /// Geocode an address string to get coordinates and structured address components
        /// </summary>
        public async Task<GeocodingResult> GeocodeAddressAsync(string address, string? region = "ZA")
        {
            try
            {
                if (string.IsNullOrWhiteSpace(address))
                {
                    return new GeocodingResult { Success = false, Error = "Address is required" };
                }

                var encodedAddress = HttpUtility.UrlEncode(address);
                var url = $"{GoogleMapsConfig.GeocodingApiUrl}?address={encodedAddress}&key={GoogleMapsConfig.ApiKey}";
                
                if (!string.IsNullOrEmpty(region))
                {
                    url += $"&region={region}&components=country:{region}";
                }

                var response = await _httpClient.GetStringAsync(url);
                var json = JsonDocument.Parse(response);
                var root = json.RootElement;

                var status = root.GetProperty("status").GetString();

                if (status != "OK")
                {
                    _logger.LogWarning("Geocoding failed for address '{Address}': {Status}", address, status);
                    return new GeocodingResult 
                    { 
                        Success = false, 
                        Error = status == "ZERO_RESULTS" ? "Address not found" : $"API error: {status}" 
                    };
                }

                var result = root.GetProperty("results")[0];
                var location = result.GetProperty("geometry").GetProperty("location");

                var geocodingResult = new GeocodingResult
                {
                    Success = true,
                    FormattedAddress = result.GetProperty("formatted_address").GetString(),
                    Latitude = location.GetProperty("lat").GetDouble(),
                    Longitude = location.GetProperty("lng").GetDouble(),
                    PlaceId = result.GetProperty("place_id").GetString()
                };

                // Parse address components
                var components = result.GetProperty("address_components");
                var componentsList = new List<AddressComponent>();

                foreach (var component in components.EnumerateArray())
                {
                    var types = component.GetProperty("types").EnumerateArray()
                        .Select(t => t.GetString() ?? "")
                        .ToArray();

                    var comp = new AddressComponent
                    {
                        LongName = component.GetProperty("long_name").GetString() ?? "",
                        ShortName = component.GetProperty("short_name").GetString() ?? "",
                        Types = types
                    };
                    componentsList.Add(comp);

                    // Extract specific fields
                    if (types.Contains("street_number"))
                        geocodingResult.StreetNumber = comp.LongName;
                    else if (types.Contains("route"))
                        geocodingResult.Route = comp.LongName;
                    else if (types.Contains("sublocality_level_1") || types.Contains("neighborhood"))
                        geocodingResult.Suburb = comp.LongName;
                    else if (types.Contains("locality"))
                        geocodingResult.City = comp.LongName;
                    else if (types.Contains("administrative_area_level_2") && string.IsNullOrEmpty(geocodingResult.City))
                        geocodingResult.City = comp.LongName;
                    else if (types.Contains("administrative_area_level_1"))
                        geocodingResult.Province = comp.LongName;
                    else if (types.Contains("postal_code"))
                        geocodingResult.PostalCode = comp.LongName;
                    else if (types.Contains("country"))
                        geocodingResult.Country = comp.LongName;
                }

                geocodingResult.RawComponents = componentsList.ToArray();

                _logger.LogInformation("Geocoded '{Address}' -> {Province}, {City}", 
                    address, geocodingResult.Province, geocodingResult.City);

                return geocodingResult;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error geocoding address: {Address}", address);
                return new GeocodingResult { Success = false, Error = ex.Message };
            }
        }

        /// <summary>
        /// Reverse geocode coordinates to get address
        /// </summary>
        public async Task<GeocodingResult> ReverseGeocodeAsync(double latitude, double longitude)
        {
            try
            {
                var url = $"{GoogleMapsConfig.GeocodingApiUrl}?latlng={latitude},{longitude}&key={GoogleMapsConfig.ApiKey}";
                
                var response = await _httpClient.GetStringAsync(url);
                var json = JsonDocument.Parse(response);
                var root = json.RootElement;

                var status = root.GetProperty("status").GetString();

                if (status != "OK")
                {
                    return new GeocodingResult 
                    { 
                        Success = false, 
                        Error = $"Reverse geocoding failed: {status}" 
                    };
                }

                var result = root.GetProperty("results")[0];
                
                var geocodingResult = new GeocodingResult
                {
                    Success = true,
                    FormattedAddress = result.GetProperty("formatted_address").GetString(),
                    Latitude = latitude,
                    Longitude = longitude,
                    PlaceId = result.GetProperty("place_id").GetString()
                };

                // Parse components
                var components = result.GetProperty("address_components");
                foreach (var component in components.EnumerateArray())
                {
                    var types = component.GetProperty("types").EnumerateArray()
                        .Select(t => t.GetString() ?? "")
                        .ToArray();

                    var longName = component.GetProperty("long_name").GetString() ?? "";

                    if (types.Contains("locality"))
                        geocodingResult.City = longName;
                    else if (types.Contains("administrative_area_level_1"))
                        geocodingResult.Province = longName;
                    else if (types.Contains("postal_code"))
                        geocodingResult.PostalCode = longName;
                    else if (types.Contains("country"))
                        geocodingResult.Country = longName;
                }

                return geocodingResult;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reverse geocoding: {Lat},{Lng}", latitude, longitude);
                return new GeocodingResult { Success = false, Error = ex.Message };
            }
        }

        /// <summary>
        /// Batch geocode multiple addresses with rate limiting
        /// </summary>
        public async Task<BatchGeocodingResult> BatchGeocodeAsync(IEnumerable<(string address, int? referenceId)> addresses)
        {
            var result = new BatchGeocodingResult();
            var addressList = addresses.ToList();
            result.TotalRequests = addressList.Count;

            foreach (var (address, referenceId) in addressList)
            {
                var geocodeResult = await GeocodeAddressAsync(address);
                
                result.Results.Add(new GeocodingBatchItem
                {
                    InputAddress = address,
                    ReferenceId = referenceId,
                    Result = geocodeResult
                });

                if (geocodeResult.Success)
                    result.Successful++;
                else
                    result.Failed++;

                // Rate limiting - respect Google's quotas
                await Task.Delay(100); // 10 requests per second max
            }

            return result;
        }

        /// <summary>
        /// Extract South African province from various address formats
        /// </summary>
        public string? ExtractSAProvince(string? input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return null;

            var lower = input.ToLowerInvariant();

            var provinceMap = new Dictionary<string[], string>
            {
                { new[] { "kwazulu", "natal", "kzn", "durban", "pietermaritzburg", "richards bay", "newcastle" }, "KwaZulu-Natal" },
                { new[] { "gauteng", "johannesburg", "pretoria", "sandton", "soweto", "centurion", "midrand" }, "Gauteng" },
                { new[] { "western cape", "cape town", "stellenbosch", "paarl", "george" }, "Western Cape" },
                { new[] { "eastern cape", "port elizabeth", "east london", "grahamstown", "gqeberha" }, "Eastern Cape" },
                { new[] { "limpopo", "polokwane", "thohoyandou", "tzaneen", "louis trichardt" }, "Limpopo" },
                { new[] { "mpumalanga", "nelspruit", "mbombela", "witbank", "secunda" }, "Mpumalanga" },
                { new[] { "north west", "north-west", "rustenburg", "klerksdorp", "potchefstroom", "mahikeng" }, "North West" },
                { new[] { "free state", "bloemfontein", "welkom", "bethlehem" }, "Free State" },
                { new[] { "northern cape", "kimberley", "upington", "springbok" }, "Northern Cape" }
            };

            foreach (var (keywords, province) in provinceMap)
            {
                if (keywords.Any(k => lower.Contains(k)))
                    return province;
            }

            return null;
        }
    }
}
