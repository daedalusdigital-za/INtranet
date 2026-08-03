using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace IntranetNotifier;

public class UserInfo
{
    [JsonPropertyName("userId")] public int UserId { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("surname")] public string? Surname { get; set; }
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("role")] public string? Role { get; set; }
    public string FullName => $"{Name} {Surname}".Trim();
}

public class AuthResult
{
    [JsonPropertyName("token")] public string? Token { get; set; }
    [JsonPropertyName("refreshToken")] public string? RefreshToken { get; set; }
    [JsonPropertyName("accessTokenExpiresAt")] public DateTime? AccessTokenExpiresAt { get; set; }
    [JsonPropertyName("user")] public UserInfo? User { get; set; }
}

/// <summary>
/// Authenticates against the existing intranet API (same users, hashing, JWT).
/// Holds the current access token in memory and exposes silent refresh.
/// </summary>
public class ApiClient
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(30) };

    public string? AccessToken { get; private set; }
    public string? RefreshToken { get; private set; }
    public DateTime AccessTokenExpiresAt { get; private set; } = DateTime.MinValue;
    public UserInfo? CurrentUser { get; private set; }

    public async Task<AuthResult?> LoginAsync(string email, string password)
    {
        var body = new { email, password };
        using var resp = await _http.PostAsJsonAsync($"{AppConfig.ApiUrl}/auth/login", body);
        if (!resp.IsSuccessStatusCode) return null;

        var result = await resp.Content.ReadFromJsonAsync<AuthResult>();
        ApplyResult(result);
        return result;
    }

    public async Task<bool> RefreshAsync(string refreshToken)
    {
        try
        {
            var body = new { refreshToken, clientId = AppConfig.ClientId };
            using var resp = await _http.PostAsJsonAsync($"{AppConfig.ApiUrl}/auth/refresh", body);
            if (!resp.IsSuccessStatusCode) return false;

            var result = await resp.Content.ReadFromJsonAsync<AuthResult>();
            ApplyResult(result);
            return result?.Token != null;
        }
        catch
        {
            return false;
        }
    }

    public async Task LogoutAsync()
    {
        try
        {
            if (!string.IsNullOrEmpty(RefreshToken))
            {
                var body = new { refreshToken = RefreshToken, clientId = AppConfig.ClientId };
                using var _ = await _http.PostAsJsonAsync($"{AppConfig.ApiUrl}/auth/logout", body);
            }
        }
        catch { }
        finally
        {
            AccessToken = null;
            RefreshToken = null;
            CurrentUser = null;
            AccessTokenExpiresAt = DateTime.MinValue;
        }
    }

    private void ApplyResult(AuthResult? result)
    {
        if (result == null) return;
        AccessToken = result.Token;
        RefreshToken = result.RefreshToken ?? RefreshToken;
        CurrentUser = result.User;
        AccessTokenExpiresAt = result.AccessTokenExpiresAt ?? DateTime.UtcNow.AddHours(1);
    }
}
