using System.Text.Json.Serialization;

namespace ProjectTracker.API.Services.SchoolDelivery
{
    // ------------------------------------------------------------------
    // Configuration options (bound from appsettings "SchoolDelivery")
    // ------------------------------------------------------------------
    public class SchoolDeliveryOptions
    {
        public bool Enabled { get; set; } = true;
        public int TimeoutSeconds { get; set; } = 30;
        public Dictionary<string, SchoolDeliveryRegion> Regions { get; set; } = new();
    }

    public class SchoolDeliveryRegion
    {
        public string Name { get; set; } = string.Empty;
        public string BaseUrl { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    // ------------------------------------------------------------------
    // Login response from the external SDM API (POST /api/auth/login)
    // ------------------------------------------------------------------
    public class SdmLoginResponse
    {
        [JsonPropertyName("token")]
        public string? Token { get; set; }

        [JsonPropertyName("accessToken")]
        public string? AccessToken { get; set; }

        [JsonPropertyName("expiresAt")]
        public DateTime? ExpiresAt { get; set; }

        [JsonPropertyName("expiration")]
        public DateTime? Expiration { get; set; }

        public string? ResolvedToken => !string.IsNullOrEmpty(Token) ? Token : AccessToken;
    }

    // ------------------------------------------------------------------
    // Aggregated DTOs returned to the intranet frontend. The external
    // API payloads are large and vary slightly per region, so we return
    // the raw JSON element for lists and provide typed summaries where
    // it matters (statistics / health).
    // ------------------------------------------------------------------
    public class RegionResult<T>
    {
        public string RegionCode { get; set; } = string.Empty;
        public string RegionName { get; set; } = string.Empty;
        public bool Success { get; set; }
        public string? Error { get; set; }
        public T? Data { get; set; }
    }

    public class SdmConnectionStatus
    {
        public string RegionCode { get; set; } = string.Empty;
        public string RegionName { get; set; } = string.Empty;
        public string BaseUrl { get; set; } = string.Empty;
        public bool Configured { get; set; }
        public bool Reachable { get; set; }
        public bool Authenticated { get; set; }
        public string? Message { get; set; }
    }
}
