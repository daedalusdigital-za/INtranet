using System.Text;
using System.Text.Json;

namespace ProjectTracker.API.Services.TFN
{
    public class TfnTokenService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<TfnTokenService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _baseUrl;
        
        private string? _accessToken;
        private string? _refreshToken;
        private DateTime _tokenExpiry;
        private readonly SemaphoreSlim _tokenLock = new(1, 1);

        public TfnTokenService(
            IHttpClientFactory httpClientFactory, 
            ILogger<TfnTokenService> logger,
            IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _configuration = configuration;

            // Configure base URL
            _baseUrl = _configuration["TFN:BaseUrl"] ?? "https://api.tfn.co.za";
        }

        public async Task<string?> LoginAsync()
        {
            await _tokenLock.WaitAsync();
            try
            {
                var username = _configuration["TFN:Username"];
                var password = _configuration["TFN:Password"];
                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";

                if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
                {
                    _logger.LogError("TFN credentials not configured");
                    return null;
                }

                // OAuth 2.0 requires form-urlencoded format with client_ID
                var loginData = new Dictionary<string, string>
                {
                    { "grant_type", "password" },
                    { "username", username },
                    { "password", password },
                    { "client_ID", "customerAPI" }  // Required by TFN API
                };

                var content = new FormUrlEncodedContent(loginData);

                var httpClient = _httpClientFactory.CreateClient();
                var response = await httpClient.PostAsync($"{_baseUrl}/api/token?api-version={apiVersion}", content);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("TFN Login failed: {StatusCode} - {Error}", 
                        response.StatusCode, errorContent);
                    return null;
                }

                var tokenResponse = await response.Content.ReadFromJsonAsync<TfnTokenResponse>();
                
                if (tokenResponse != null)
                {
                    _accessToken = tokenResponse.AccessToken;
                    _refreshToken = tokenResponse.RefreshToken;
                    _tokenExpiry = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn - 60); // Refresh 1 min early

                    _logger.LogInformation("TFN Login successful. Token expires at {Expiry}", _tokenExpiry);
                    return _accessToken;
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during TFN login");
                return null;
            }
            finally
            {
                _tokenLock.Release();
            }
        }

        public async Task<string?> RefreshAsync()
        {
            await _tokenLock.WaitAsync();
            try
            {
                if (string.IsNullOrEmpty(_refreshToken))
                {
                    _logger.LogWarning("No refresh token available, performing full login");
                    return await LoginAsync();
                }

                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";

                // OAuth 2.0 requires form-urlencoded format
                var refreshData = new Dictionary<string, string>
                {
                    { "refresh_token", _refreshToken },
                    { "grant_type", "refresh_token" }
                };

                var content = new FormUrlEncodedContent(refreshData);

                var httpClient = _httpClientFactory.CreateClient();
                var response = await httpClient.PostAsync($"{_baseUrl}/api/token#RefreshAccessToken?api-version={apiVersion}", content);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Token refresh failed, performing full login");
                    return await LoginAsync();
                }

                var tokenResponse = await response.Content.ReadFromJsonAsync<TfnTokenResponse>();

                if (tokenResponse != null)
                {
                    _accessToken = tokenResponse.AccessToken;
                    _refreshToken = tokenResponse.RefreshToken;
                    _tokenExpiry = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn - 60);

                    _logger.LogInformation("TFN Token refreshed. New expiry: {Expiry}", _tokenExpiry);
                    return _accessToken;
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during TFN token refresh");
                return await LoginAsync();
            }
            finally
            {
                _tokenLock.Release();
            }
        }

        public async Task<string?> GetValidTokenAsync()
        {
            // Check if token exists and is valid
            if (!string.IsNullOrEmpty(_accessToken) && DateTime.UtcNow < _tokenExpiry)
            {
                return _accessToken;
            }

            // Token expired or doesn't exist
            if (!string.IsNullOrEmpty(_refreshToken))
            {
                return await RefreshAsync();
            }

            return await LoginAsync();
        }

        public async Task LogoutAsync()
        {
            await _tokenLock.WaitAsync();
            try
            {
                var apiVersion = _configuration["TFN:ApiVersion"] ?? "2.0";
                
                if (!string.IsNullOrEmpty(_accessToken))
                {
                    var httpClient = _httpClientFactory.CreateClient();
                    httpClient.DefaultRequestHeaders.Authorization = 
                        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
                    
                    await httpClient.PostAsync($"{_baseUrl}/api/LogOut?api-version={apiVersion}", null);
                }

                _accessToken = null;
                _refreshToken = null;
                _tokenExpiry = DateTime.MinValue;

                _logger.LogInformation("TFN Logout successful");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during TFN logout");
            }
            finally
            {
                _tokenLock.Release();
            }
        }
    }

    public class TfnTokenResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("access_token")]
        public string AccessToken { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("refresh_token")]
        public string RefreshToken { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("token_type")]
        public string TokenType { get; set; } = "Bearer";
        
        [System.Text.Json.Serialization.JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }
    }
}
