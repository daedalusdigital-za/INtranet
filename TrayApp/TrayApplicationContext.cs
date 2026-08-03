using System.Diagnostics;

namespace IntranetNotifier;

/// <summary>
/// The heart of the tray app. Owns the NotifyIcon, manages login/session,
/// keeps the SignalR connection alive, performs silent token refresh, shows
/// balloon notifications, and opens the intranet in the browser on click.
/// </summary>
public class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _tray;
    private readonly ApiClient _api = new();
    private NotificationClient? _notifier;
    private readonly System.Windows.Forms.Timer _refreshTimer;
    private readonly System.Windows.Forms.Timer _watchdogTimer;
    private int _unreadCount;
    private string? _lastClickUrl;

    // Hidden control whose handle is created on the UI thread. We use its
    // Invoke/BeginInvoke to marshal work from background (SignalR) threads onto
    // the UI thread reliably — SynchronizationContext.Current is null on those
    // threads, so relying on it caused toasts to be created off the UI thread
    // (they logged "Toast shown" but never actually rendered).
    private readonly Control _uiMarshal;

    public TrayApplicationContext()
    {
        // Force handle creation on the current (UI) thread so Invoke works.
        _uiMarshal = new Control();
        var _ = _uiMarshal.Handle;
        _tray = new NotifyIcon
        {
            Icon = IconFactory.CreateTrayIcon(false),
            Text = "Promed Intranet Notifier",
            Visible = true,
            ContextMenuStrip = BuildMenu()
        };
        _tray.BalloonTipClicked += OnBalloonClicked;
        _tray.DoubleClick += (s, e) => OpenIntranet(null);

        // Silent refresh check every 10 minutes
        _refreshTimer = new System.Windows.Forms.Timer { Interval = 10 * 60 * 1000 };
        _refreshTimer.Tick += async (s, e) => await EnsureTokenFreshAsync();
        _refreshTimer.Start();

        // Connection watchdog every 60s: if SignalR dropped (backend restart,
        // network blip, long sleep), restart it and re-register the user group.
        _watchdogTimer = new System.Windows.Forms.Timer { Interval = 60 * 1000 };
        _watchdogTimer.Tick += async (s, e) =>
        {
            if (_notifier != null) await _notifier.EnsureConnectedAsync();
        };
        _watchdogTimer.Start();

        // Kick off startup on the UI thread once the message loop is running
        BeginInvokeOnUi(async () => await StartupAsync());
    }

    // ---- startup / auth flow ----
    private async Task StartupAsync()
    {
        var stored = TokenStore.Load();
        if (stored?.RefreshToken != null)
        {
            var ok = await _api.RefreshAsync(stored.RefreshToken);
            if (ok)
            {
                PersistSession();
                await ConnectNotificationsAsync();
                ShowInfo("Connected", $"Signed in as {_api.CurrentUser?.FullName}. You'll get live notifications.");
                UpdateMenu();
                return;
            }
            // refresh token expired/revoked → fall through to login
            TokenStore.Clear();
        }

        PromptLogin(stored?.Email);
    }

    private void PromptLogin(string? prefillEmail = null)
    {
        using var form = new LoginForm(_api, prefillEmail);
        var dr = form.ShowDialog();
        if (dr == DialogResult.OK && form.Result?.Token != null)
        {
            PersistSession();
            _ = ConnectNotificationsAsync();
            ShowInfo("Signed in", $"Welcome {_api.CurrentUser?.FullName}. Notifications are now active.");
            UpdateMenu();
        }
        else
        {
            // User cancelled login — keep the tray icon; they can sign in from the menu.
            UpdateMenu();
        }
    }

    private void PersistSession()
    {
        if (_api.CurrentUser == null || _api.RefreshToken == null) return;
        TokenStore.Save(new StoredSession
        {
            RefreshToken = _api.RefreshToken,
            UserId = _api.CurrentUser.UserId,
            UserName = _api.CurrentUser.FullName,
            Email = _api.CurrentUser.Email
        });
    }

    private async Task EnsureTokenFreshAsync()
    {
        if (_api.CurrentUser == null) return;
        // Refresh if the access token expires within the next 20 minutes
        if (_api.AccessTokenExpiresAt - DateTime.UtcNow < TimeSpan.FromMinutes(20))
        {
            if (!string.IsNullOrEmpty(_api.RefreshToken))
            {
                var ok = await _api.RefreshAsync(_api.RefreshToken);
                if (ok) PersistSession();
                else
                {
                    // Refresh token no longer valid → require login again
                    TokenStore.Clear();
                    if (_notifier != null) await _notifier.StopAsync();
                    PromptLogin(_api.CurrentUser?.Email);
                }
            }
        }
    }

    // ---- SignalR ----
    private async Task ConnectNotificationsAsync()
    {
        if (_api.CurrentUser == null) return;

        if (_notifier == null)
        {
            _notifier = new NotificationClient(() => _api.AccessToken);
            _notifier.NotificationReceived += OnNotification;
            _notifier.ConnectionStateChanged += OnConnectionStateChanged;
        }

        try
        {
            Logger.Log($"Connecting notifications for userId={_api.CurrentUser.UserId} ({_api.CurrentUser.Email})");
            await _notifier.StartAsync(_api.CurrentUser.UserId);
        }
        catch (Exception ex)
        {
            Logger.Log($"ConnectNotifications error: {ex.Message}");
            OnConnectionStateChanged(false);
        }
    }

    private void OnConnectionStateChanged(bool connected)
    {
        BeginInvokeOnUi(() =>
        {
            _tray.Icon = IconFactory.CreateTrayIcon(_unreadCount > 0);
            _tray.Text = connected
                ? $"Promed Intranet Notifier — Online ({_api.CurrentUser?.FullName})"
                : "Promed Intranet Notifier — Reconnecting…";
        });
    }

    private void OnNotification(NotificationMessage msg)
    {
        BeginInvokeOnUi(() =>
        {
            _unreadCount++;
            _lastClickUrl = msg.Url;
            _tray.Icon = IconFactory.CreateTrayIcon(true);

            var tipTitle = string.IsNullOrWhiteSpace(msg.Title) ? "Intranet" : msg.Title;
            var tipText = string.IsNullOrWhiteSpace(msg.Body) ? "You have a new notification" : msg.Body;

            // Primary: our own always-on-top toast popup. This cannot be
            // suppressed by Focus Assist / per-app notification settings, so it
            // reliably surfaces even when the browser is minimized.
            try
            {
                var url = msg.Url;
                var toast = new ToastForm(tipTitle, tipText, () =>
                {
                    _unreadCount = 0;
                    _tray.Icon = IconFactory.CreateTrayIcon(false);
                    OpenIntranet(url);
                });
                toast.Show();
                Logger.Log($"Toast shown: '{tipTitle}' - '{tipText}' (uiThread={!_uiMarshal.InvokeRequired})");
            }
            catch (Exception ex)
            {
                Logger.Log($"Toast failed, falling back to balloon: {ex.Message}");
                // Fallback to the classic balloon if the toast fails for any reason.
                _tray.ShowBalloonTip(6000, tipTitle, tipText, ToolTipIcon.Info);
            }
        });
    }

    private void OnBalloonClicked(object? sender, EventArgs e)
    {
        _unreadCount = 0;
        _tray.Icon = IconFactory.CreateTrayIcon(false);
        OpenIntranet(_lastClickUrl);
    }

    // ---- tray menu ----
    private ContextMenuStrip BuildMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Open Intranet", null, (s, e) => OpenIntranet(null));
        menu.Items.Add("Open Messages", null, (s, e) => OpenIntranet("/messages"));
        menu.Items.Add("Open Todo", null, (s, e) => OpenIntranet("/dashboard?open=todo"));
        menu.Items.Add("Open Calendar", null, (s, e) => OpenIntranet("/calendar"));
        menu.Items.Add(new ToolStripSeparator());

        var autostart = new ToolStripMenuItem("Start with Windows")
        {
            CheckOnClick = true,
            Checked = AutoStart.IsEnabled()
        };
        autostart.CheckedChanged += (s, e) =>
        {
            if (autostart.Checked) AutoStart.Enable(); else AutoStart.Disable();
        };
        menu.Items.Add(autostart);

        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Sign in / Switch user", null, (s, e) => PromptLogin(_api.CurrentUser?.Email));
        menu.Items.Add("Sign out", null, async (s, e) => await SignOutAsync());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit", null, (s, e) => ExitApp());
        return menu;
    }

    private void UpdateMenu()
    {
        // nothing dynamic beyond autostart checkbox for now; placeholder for future counts
    }

    private async Task SignOutAsync()
    {
        await _api.LogoutAsync();
        TokenStore.Clear();
        if (_notifier != null) await _notifier.StopAsync();
        _unreadCount = 0;
        _tray.Icon = IconFactory.CreateTrayIcon(false);
        _tray.Text = "Promed Intranet Notifier — Signed out";
        ShowInfo("Signed out", "You will no longer receive notifications until you sign in again.");
    }

    private void OpenIntranet(string? relativePath)
    {
        try
        {
            var url = AppConfig.WebBaseUrl.TrimEnd('/');
            if (!string.IsNullOrEmpty(relativePath))
                url += "/" + relativePath.TrimStart('/');
            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
            _unreadCount = 0;
            _tray.Icon = IconFactory.CreateTrayIcon(false);
        }
        catch { }
    }

    private void ShowInfo(string title, string text)
    {
        BeginInvokeOnUi(() => _tray.ShowBalloonTip(4000, title, text, ToolTipIcon.Info));
    }

    private void ExitApp()
    {
        _refreshTimer.Stop();
        _tray.Visible = false;
        _tray.Dispose();
        _ = _notifier?.DisposeAsync();
        Application.Exit();
    }

    // Run an action on the UI thread once the message loop is available.
    private void BeginInvokeOnUi(Action action)
    {
        try
        {
            if (_uiMarshal.IsHandleCreated && _uiMarshal.InvokeRequired)
                _uiMarshal.BeginInvoke(action);
            else
                action();
        }
        catch
        {
            // Last-resort fallback so we never lose a notification.
            try { action(); } catch { }
        }
    }

    private void BeginInvokeOnUi(Func<Task> asyncAction)
    {
        BeginInvokeOnUi(() => { _ = asyncAction(); });
    }
}
