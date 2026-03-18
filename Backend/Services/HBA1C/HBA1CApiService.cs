using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectTracker.API.Services.HBA1C
{
    public interface IHBA1CApiService
    {
        Task<string?> LoginAsync();
        Task<T?> GetAsync<T>(string endpoint, Dictionary<string, string>? queryParams = null);
        Task<T?> PostAsync<T>(string endpoint, object body);
        Task<T?> PatchAsync<T>(string endpoint, object body);
        Task<bool> DeleteAsync(string endpoint, Dictionary<string, string>? queryParams = null);
    }

    public class HBA1CApiService : IHBA1CApiService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<HBA1CApiService> _logger;
        private string? _token;
        private DateTime _tokenExpiry = DateTime.MinValue;
        private readonly SemaphoreSlim _tokenLock = new(1, 1);

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        public HBA1CApiService(HttpClient httpClient, IConfiguration configuration, ILogger<HBA1CApiService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;

            var baseUrl = _configuration["HBA1C:BaseUrl"] ?? "https://ngcanduapi.azurewebsites.net";
            _httpClient.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
        }

        public async Task<string?> LoginAsync()
        {
            await _tokenLock.WaitAsync();
            try
            {
                // Return cached token if still valid (with 5 min buffer)
                if (_token != null && DateTime.UtcNow < _tokenExpiry.AddMinutes(-5))
                    return _token;

                var email = _configuration["HBA1C:Email"] ?? "";
                var password = _configuration["HBA1C:Password"] ?? "";

                if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
                {
                    _logger.LogWarning("HBA1C API credentials not configured");
                    return null;
                }

                var loginBody = new { email, password };
                var content = new StringContent(JsonSerializer.Serialize(loginBody, JsonOptions), Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("api/Auth/Login", content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("HBA1C login failed: {Status} - {Body}", response.StatusCode, errorBody);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);

                // Extract token from response
                if (doc.RootElement.TryGetProperty("token", out var tokenProp))
                {
                    _token = tokenProp.GetString();
                }
                else if (doc.RootElement.TryGetProperty("Token", out var tokenProp2))
                {
                    _token = tokenProp2.GetString();
                }

                // Set expiry (default 60 min if not specified)
                _tokenExpiry = DateTime.UtcNow.AddMinutes(55);

                _logger.LogInformation("HBA1C API login successful");
                return _token;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HBA1C API login error");
                return null;
            }
            finally
            {
                _tokenLock.Release();
            }
        }

        private async Task EnsureAuthenticatedAsync()
        {
            var token = await LoginAsync();
            if (token != null)
            {
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }
        }

        public async Task<T?> GetAsync<T>(string endpoint, Dictionary<string, string>? queryParams = null)
        {
            try
            {
                await EnsureAuthenticatedAsync();

                var url = endpoint;
                if (queryParams?.Count > 0)
                {
                    var qs = string.Join("&", queryParams.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));
                    url = $"{endpoint}?{qs}";
                }

                _logger.LogDebug("HBA1C GET: {Url}", url);
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("HBA1C GET {Url} failed: {Status} - {Body}", url, response.StatusCode, errorBody);
                    return default;
                }

                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<T>(json, JsonOptions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HBA1C GET {Endpoint} error", endpoint);
                return default;
            }
        }

        public async Task<T?> PostAsync<T>(string endpoint, object body)
        {
            try
            {
                await EnsureAuthenticatedAsync();

                var content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
                _logger.LogDebug("HBA1C POST: {Endpoint}", endpoint);
                var response = await _httpClient.PostAsync(endpoint, content);

                var json = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("HBA1C POST {Endpoint} failed: {Status} - {Body}", endpoint, response.StatusCode, json);
                    return default;
                }

                return JsonSerializer.Deserialize<T>(json, JsonOptions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HBA1C POST {Endpoint} error", endpoint);
                return default;
            }
        }

        public async Task<T?> PatchAsync<T>(string endpoint, object body)
        {
            try
            {
                await EnsureAuthenticatedAsync();

                var content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
                var request = new HttpRequestMessage(HttpMethod.Patch, endpoint) { Content = content };
                _logger.LogDebug("HBA1C PATCH: {Endpoint}", endpoint);
                var response = await _httpClient.SendAsync(request);

                var json = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("HBA1C PATCH {Endpoint} failed: {Status} - {Body}", endpoint, response.StatusCode, json);
                    return default;
                }

                return JsonSerializer.Deserialize<T>(json, JsonOptions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HBA1C PATCH {Endpoint} error", endpoint);
                return default;
            }
        }

        public async Task<bool> DeleteAsync(string endpoint, Dictionary<string, string>? queryParams = null)
        {
            try
            {
                await EnsureAuthenticatedAsync();

                var url = endpoint;
                if (queryParams?.Count > 0)
                {
                    var qs = string.Join("&", queryParams.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));
                    url = $"{endpoint}?{qs}";
                }

                _logger.LogDebug("HBA1C DELETE: {Url}", url);
                var response = await _httpClient.DeleteAsync(url);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HBA1C DELETE {Endpoint} error", endpoint);
                return false;
            }
        }
    }
}
