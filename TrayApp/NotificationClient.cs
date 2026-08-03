using Microsoft.AspNetCore.SignalR.Client;
using System.Text.Json.Serialization;

namespace IntranetNotifier;

/// <summary>Reconnect policy that never gives up — waits at most 30s between tries.</summary>
public sealed class InfiniteRetryPolicy : IRetryPolicy
{
    public TimeSpan? NextRetryDelay(RetryContext retryContext)
    {
        var seconds = Math.Min(30, Math.Pow(2, Math.Min(retryContext.PreviousRetryCount, 5)));
        return TimeSpan.FromSeconds(seconds);
    }
}

public class NotificationMessage
{
    [JsonPropertyName("type")] public string Type { get; set; } = "info";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("body")] public string Body { get; set; } = "";
    [JsonPropertyName("url")] public string? Url { get; set; }
    [JsonPropertyName("count")] public int? Count { get; set; }
    [JsonPropertyName("timestamp")] public DateTime Timestamp { get; set; }
}

/// <summary>
/// Wraps the SignalR connection to /hubs/notifications. Uses the access token
/// (query string) for auth, auto-reconnects, and raises an event on each
/// incoming notification. Calls RegisterUser after (re)connect.
/// </summary>
public class NotificationClient : IAsyncDisposable
{
    private HubConnection? _connection;
    private readonly Func<string?> _accessTokenProvider;
    private int _userId;

    public event Action<NotificationMessage>? NotificationReceived;
    public event Action<bool>? ConnectionStateChanged; // true = connected

    public NotificationClient(Func<string?> accessTokenProvider)
    {
        _accessTokenProvider = accessTokenProvider;
    }

    public bool IsConnected => _connection?.State == HubConnectionState.Connected;

    public async Task StartAsync(int userId)
    {
        _userId = userId;

        _connection = new HubConnectionBuilder()
            .WithUrl(AppConfig.NotificationsHubUrl, options =>
            {
                options.AccessTokenProvider = () => Task.FromResult(_accessTokenProvider());
            })
            .WithAutomaticReconnect(new InfiniteRetryPolicy())
            .Build();

        // If the server is down longer than the automatic-reconnect window,
        // SignalR permanently closes the connection. We never want that for a
        // background notifier, so on close we keep trying to restart forever.
        _connection.ServerTimeout = TimeSpan.FromSeconds(60);
        _connection.KeepAliveInterval = TimeSpan.FromSeconds(15);

        _connection.On<NotificationMessage>("ReceiveNotification", msg =>
        {
            Logger.Log($"ReceiveNotification: type={msg.Type} title='{msg.Title}' body='{msg.Body}' url={msg.Url}");
            NotificationReceived?.Invoke(msg);
        });

        _connection.Reconnected += async _ =>
        {
            ConnectionStateChanged?.Invoke(true);
            await RegisterAsync();
        };

        _connection.Reconnecting += _ =>
        {
            ConnectionStateChanged?.Invoke(false);
            return Task.CompletedTask;
        };

        _connection.Closed += async error =>
        {
            ConnectionStateChanged?.Invoke(false);
            Logger.Log($"SignalR closed: {error?.Message ?? "(no error)"} — will keep retrying");
            // Keep trying to reconnect forever (network back, backend restarted, etc.)
            await RestartLoopAsync();
        };

        await _connection.StartAsync();
        Logger.Log($"SignalR connected to {AppConfig.NotificationsHubUrl} as userId={userId}");
        ConnectionStateChanged?.Invoke(true);
        await RegisterAsync();
    }

    private async Task RegisterAsync()
    {
        try
        {
            if (_connection is { State: HubConnectionState.Connected })
            {
                await _connection.InvokeAsync("RegisterUser", _userId);
                Logger.Log($"RegisterUser invoked for userId={_userId}");
            }
        }
        catch (Exception ex) { Logger.Log($"RegisterAsync error: {ex.Message}"); }
    }

    private bool _restarting;

    /// <summary>Keeps trying to start the connection until it succeeds. Used when
    /// SignalR gives up (Closed) so the notifier reconnects after long outages.</summary>
    private async Task RestartLoopAsync()
    {
        if (_restarting) return;
        _restarting = true;
        try
        {
            while (_connection != null && _connection.State == HubConnectionState.Disconnected)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(10));
                    if (_connection.State != HubConnectionState.Disconnected) break;
                    await _connection.StartAsync();
                    Logger.Log("SignalR restarted after being closed");
                    ConnectionStateChanged?.Invoke(true);
                    await RegisterAsync();
                    break;
                }
                catch (Exception ex)
                {
                    Logger.Log($"Restart attempt failed: {ex.Message}");
                }
            }
        }
        finally { _restarting = false; }
    }

    /// <summary>Watchdog called periodically by the app: if the connection is
    /// disconnected, kick off the restart loop.</summary>
    public async Task EnsureConnectedAsync()
    {
        if (_connection == null) return;
        if (_connection.State == HubConnectionState.Disconnected)
        {
            Logger.Log("Watchdog: connection disconnected, restarting");
            await RestartLoopAsync();
        }
        else if (_connection.State == HubConnectionState.Connected)
        {
            // Re-assert group membership in case a silent reconnect lost it.
            await RegisterAsync();
        }
    }

    public async Task StopAsync()
    {
        if (_connection != null)
        {
            try { await _connection.StopAsync(); } catch { }
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection != null)
        {
            await _connection.DisposeAsync();
            _connection = null;
        }
    }
}
