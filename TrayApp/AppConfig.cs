namespace IntranetNotifier;

/// <summary>
/// Central configuration. Values can be overridden by a settings.json placed next
/// to the executable, otherwise the built-in defaults (the on-prem server) are used.
/// </summary>
public static class AppConfig
{
    // Backend API + SignalR host
    public static string ApiBaseUrl { get; private set; } = "http://192.168.10.151:5143";
    // Web frontend (opened when a notification is clicked)
    public static string WebBaseUrl { get; private set; } = "http://192.168.10.151:4200";

    public const string ClientId = "tray-app";

    public static string ApiUrl => $"{ApiBaseUrl.TrimEnd('/')}/api";
    public static string NotificationsHubUrl => $"{ApiBaseUrl.TrimEnd('/')}/hubs/notifications";

    public static void Load()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "settings.json");
            if (File.Exists(path))
            {
                using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
                var root = doc.RootElement;
                if (root.TryGetProperty("apiBaseUrl", out var a) && a.ValueKind == System.Text.Json.JsonValueKind.String)
                    ApiBaseUrl = a.GetString()!;
                if (root.TryGetProperty("webBaseUrl", out var w) && w.ValueKind == System.Text.Json.JsonValueKind.String)
                    WebBaseUrl = w.GetString()!;
            }
        }
        catch { /* keep defaults */ }
    }
}
