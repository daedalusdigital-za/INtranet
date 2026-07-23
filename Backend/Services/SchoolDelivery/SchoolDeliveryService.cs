using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace ProjectTracker.API.Services.SchoolDelivery
{
    public interface ISchoolDeliveryService
    {
        IReadOnlyCollection<string> RegionCodes { get; }
        bool IsEnabled { get; }

        Task<SdmConnectionStatus> GetStatusAsync(string regionCode, CancellationToken ct = default);
        Task<List<SdmConnectionStatus>> GetAllStatusAsync(CancellationToken ct = default);

        Task<(bool Success, string? Error)> LoginAsync(string regionCode, string email, string password, CancellationToken ct = default);
        void Logout(string regionCode);

        Task<RegionResult<JsonElement>> GetAsync(string regionCode, string relativeUrl, CancellationToken ct = default);
        Task<List<RegionResult<JsonElement>>> GetAllRegionsAsync(string relativeUrl, CancellationToken ct = default);
    }

    /// <summary>
    /// Integration client for the external School Delivery Management (SDM)
    /// APIs (Western Cape, KZN, Eastern Cape) used by the Sanitary Pads
    /// project. Handles per-region JWT login with token caching and proxies
    /// read requests to the regional instances.
    /// </summary>
    public class SchoolDeliveryService : ISchoolDeliveryService
    {
        private readonly HttpClient _http;
        private readonly ILogger<SchoolDeliveryService> _logger;
        private readonly SchoolDeliveryOptions _options;

        // Cached JWT tokens per region: regionCode -> (token, expiresUtc)
        private static readonly ConcurrentDictionary<string, (string Token, DateTime Expires)> _tokens = new();
        // Runtime credentials supplied by users via the login popup: regionCode -> (email, password)
        private static readonly ConcurrentDictionary<string, (string Email, string Password)> _runtimeCreds = new();
        private static readonly SemaphoreSlim _loginLock = new(1, 1);

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public SchoolDeliveryService(
            HttpClient http,
            IOptions<SchoolDeliveryOptions> options,
            ILogger<SchoolDeliveryService> logger)
        {
            _http = http;
            _logger = logger;
            _options = options.Value;
            _http.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds > 0 ? _options.TimeoutSeconds : 30);
        }

        public bool IsEnabled => _options.Enabled;

        public IReadOnlyCollection<string> RegionCodes => _options.Regions.Keys.ToList();

        private SchoolDeliveryRegion? ResolveRegion(string regionCode)
        {
            if (string.IsNullOrWhiteSpace(regionCode)) return null;
            return _options.Regions.TryGetValue(regionCode.ToUpperInvariant(), out var r) ? r : null;
        }

        // ------------------------------------------------------------------
        // Authentication
        // ------------------------------------------------------------------
        private async Task<string?> GetTokenAsync(string regionCode, CancellationToken ct)
        {
            regionCode = regionCode.ToUpperInvariant();
            var region = ResolveRegion(regionCode);
            if (region == null || string.IsNullOrWhiteSpace(region.BaseUrl))
                return null;

            // Return cached token if still valid (60s safety margin)
            if (_tokens.TryGetValue(regionCode, out var cached) &&
                cached.Expires > DateTime.UtcNow.AddSeconds(60))
            {
                return cached.Token;
            }

            // Prefer runtime credentials (from the login popup), fall back to configured ones.
            string? email = region.Username;
            string? password = region.Password;
            if (_runtimeCreds.TryGetValue(regionCode, out var rc))
            {
                email = rc.Email;
                password = rc.Password;
            }

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            {
                _logger.LogWarning("SDM region {Region} has no credentials configured", regionCode);
                return null;
            }

            await _loginLock.WaitAsync(ct);
            try
            {
                // Re-check after acquiring the lock
                if (_tokens.TryGetValue(regionCode, out cached) &&
                    cached.Expires > DateTime.UtcNow.AddSeconds(60))
                {
                    return cached.Token;
                }

                var (token, _) = await PerformLoginAsync(region, regionCode, email!, password!, ct);
                return token;
            }
            finally
            {
                _loginLock.Release();
            }
        }

        // Performs the actual HTTP login against a region and caches the token on success.
        private async Task<(string? Token, string? Error)> PerformLoginAsync(
            SchoolDeliveryRegion region, string regionCode, string email, string password, CancellationToken ct)
        {
            try
            {
                var loginUrl = CombineUrl(region.BaseUrl, "/api/auth/login");
                var payload = JsonSerializer.Serialize(new { email, password });
                using var content = new StringContent(payload, Encoding.UTF8, "application/json");

                using var req = new HttpRequestMessage(HttpMethod.Post, loginUrl) { Content = content };
                using var resp = await _http.SendAsync(req, ct);

                if (!resp.IsSuccessStatusCode)
                {
                    var body = await resp.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("SDM login failed for {Region}: {Status} {Body}",
                        regionCode, (int)resp.StatusCode, Truncate(body, 300));
                    var msg = resp.StatusCode == System.Net.HttpStatusCode.Unauthorized
                        ? "Invalid email or password"
                        : $"Login failed ({(int)resp.StatusCode})";
                    return (null, msg);
                }

                var json = await resp.Content.ReadAsStringAsync(ct);
                var login = JsonSerializer.Deserialize<SdmLoginResponse>(json, JsonOpts);
                var token = login?.ResolvedToken;
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("SDM login for {Region} returned no token", regionCode);
                    return (null, "Login succeeded but no token was returned");
                }

                var expires = login?.ExpiresAt ?? login?.Expiration ?? DateTime.UtcNow.AddHours(23);
                _tokens[regionCode] = (token, expires);
                _logger.LogInformation("SDM authenticated for {Region}, token valid until {Expires}", regionCode, expires);
                return (token, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SDM login error for {Region}", regionCode);
                return (null, ex.Message);
            }
        }

        // ------------------------------------------------------------------
        // Runtime login (from the frontend popup) — stores credentials so
        // tokens can be silently refreshed, and returns a friendly result.
        // ------------------------------------------------------------------
        public async Task<(bool Success, string? Error)> LoginAsync(
            string regionCode, string email, string password, CancellationToken ct = default)
        {
            regionCode = (regionCode ?? "").ToUpperInvariant();
            var region = ResolveRegion(regionCode);
            if (region == null || string.IsNullOrWhiteSpace(region.BaseUrl))
                return (false, "Region not configured");

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                return (false, "Email and password are required");

            await _loginLock.WaitAsync(ct);
            try
            {
                var (token, error) = await PerformLoginAsync(region, regionCode, email, password, ct);
                if (!string.IsNullOrEmpty(token))
                {
                    _runtimeCreds[regionCode] = (email, password);
                    return (true, null);
                }
                return (false, error ?? "Authentication failed");
            }
            finally
            {
                _loginLock.Release();
            }
        }

        public void Logout(string regionCode)
        {
            regionCode = (regionCode ?? "").ToUpperInvariant();
            _tokens.TryRemove(regionCode, out _);
            _runtimeCreds.TryRemove(regionCode, out _);
        }

        // ------------------------------------------------------------------
        // Generic authenticated GET (returns raw JSON element)
        // ------------------------------------------------------------------
        public async Task<RegionResult<JsonElement>> GetAsync(string regionCode, string relativeUrl, CancellationToken ct = default)
        {
            regionCode = (regionCode ?? "").ToUpperInvariant();
            var region = ResolveRegion(regionCode);
            var result = new RegionResult<JsonElement>
            {
                RegionCode = regionCode,
                RegionName = region?.Name ?? regionCode
            };

            if (region == null || string.IsNullOrWhiteSpace(region.BaseUrl))
            {
                result.Error = "Region not configured";
                return result;
            }

            var token = await GetTokenAsync(regionCode, ct);
            if (string.IsNullOrEmpty(token))
            {
                result.Error = "Authentication failed (check credentials)";
                return result;
            }

            try
            {
                var url = CombineUrl(region.BaseUrl, relativeUrl);
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                using var resp = await _http.SendAsync(req, ct);
                var body = await resp.Content.ReadAsStringAsync(ct);

                if (!resp.IsSuccessStatusCode)
                {
                    // Token might have expired server-side; drop cache so next call re-logs in
                    if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                        _tokens.TryRemove(regionCode, out _);

                    result.Error = $"Upstream {(int)resp.StatusCode}: {Truncate(body, 300)}";
                    return result;
                }

                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "null" : body);
                result.Data = doc.RootElement.Clone();
                result.Success = true;
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SDM GET {Url} failed for {Region}", relativeUrl, regionCode);
                result.Error = ex.Message;
                return result;
            }
        }

        public async Task<List<RegionResult<JsonElement>>> GetAllRegionsAsync(string relativeUrl, CancellationToken ct = default)
        {
            var tasks = _options.Regions.Keys.Select(code => GetAsync(code, relativeUrl, ct));
            var results = await Task.WhenAll(tasks);
            return results.ToList();
        }

        // ------------------------------------------------------------------
        // Connection status / health
        // ------------------------------------------------------------------
        public async Task<SdmConnectionStatus> GetStatusAsync(string regionCode, CancellationToken ct = default)
        {
            regionCode = (regionCode ?? "").ToUpperInvariant();
            var region = ResolveRegion(regionCode);
            var hasRuntime = _runtimeCreds.ContainsKey(regionCode) || _tokens.ContainsKey(regionCode);
            var status = new SdmConnectionStatus
            {
                RegionCode = regionCode,
                RegionName = region?.Name ?? regionCode,
                BaseUrl = region?.BaseUrl ?? "",
                Configured = hasRuntime || (region != null &&
                             !string.IsNullOrWhiteSpace(region.Username) &&
                             !string.IsNullOrWhiteSpace(region.Password))
            };

            if (region == null || string.IsNullOrWhiteSpace(region.BaseUrl))
            {
                status.Message = "Region not configured";
                return status;
            }

            // Liveness probe (public endpoint, no auth)
            try
            {
                var url = CombineUrl(region.BaseUrl, "/api/auth/health-simple");
                using var resp = await _http.GetAsync(url, ct);
                status.Reachable = resp.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                status.Message = $"Unreachable: {ex.Message}";
                return status;
            }

            if (!status.Configured)
            {
                status.Message = "Reachable but no credentials configured";
                return status;
            }

            var token = await GetTokenAsync(regionCode, ct);
            status.Authenticated = !string.IsNullOrEmpty(token);
            status.Message = status.Authenticated ? "Connected" : "Authentication failed";
            return status;
        }

        public async Task<List<SdmConnectionStatus>> GetAllStatusAsync(CancellationToken ct = default)
        {
            var tasks = _options.Regions.Keys.Select(code => GetStatusAsync(code, ct));
            var results = await Task.WhenAll(tasks);
            return results.ToList();
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------
        private static string CombineUrl(string baseUrl, string relative)
        {
            return $"{baseUrl.TrimEnd('/')}/{relative.TrimStart('/')}";
        }

        private static string Truncate(string? value, int max)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return value.Length <= max ? value : value.Substring(0, max) + "…";
        }
    }
}
