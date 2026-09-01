using System.Collections.Concurrent;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Services
{
    /// <summary>
    /// Keeps a single, persistent IMAP connection open per sales mailbox and uses
    /// IMAP IDLE (server push) to learn about new mail in real time, with periodic
    /// NOOP keepalives. Recent order emails are cached in memory so the dashboard can
    /// read them WITHOUT ever opening a new IMAP login.
    ///
    /// This replaces the previous behaviour where every dashboard refresh opened a
    /// fresh connect→authenticate→disconnect cycle per account — which the mail
    /// provider flagged as brute-force abuse and blacklisted the IP.
    /// </summary>
    public class SalesMailboxMonitorService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<SalesMailboxMonitorService> _logger;

        // Per-account cache of today's messages (account email -> results).
        private readonly ConcurrentDictionary<string, List<EmailSearchResult>> _cache = new(StringComparer.OrdinalIgnoreCase);
        // Per-account status for diagnostics.
        private readonly ConcurrentDictionary<string, MailboxStatus> _status = new(StringComparer.OrdinalIgnoreCase);

        public SalesMailboxMonitorService(
            IServiceScopeFactory scopeFactory,
            IConfiguration config,
            ILogger<SalesMailboxMonitorService> logger)
        {
            _scopeFactory = scopeFactory;
            _config = config;
            _logger = logger;
        }

        public class MailboxStatus
        {
            public string Email { get; set; } = "";
            public bool Connected { get; set; }
            public DateTime? LastUpdate { get; set; }
            public string? LastError { get; set; }
            public int CachedCount { get; set; }
            public bool Disabled { get; set; }        // permanently stopped (e.g. bad credentials)
            public int AuthFailures { get; set; }      // consecutive authentication failures
        }

        private static readonly Random _jitter = new();

        /// <summary>Read cached order emails without touching the mail server.</summary>
        public List<EmailSearchResult> GetCachedOrders(IEnumerable<string>? accounts, string? keyword)
        {
            var accountFilter = accounts?.Where(a => !string.IsNullOrWhiteSpace(a))
                                         .Select(a => a.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var all = _cache
                .Where(kv => accountFilter == null || accountFilter.Count == 0 || accountFilter.Contains(kv.Key))
                .SelectMany(kv => kv.Value)
                // Today only — guards the midnight rollover if IDLE hasn't refreshed yet.
                .Where(m => m.Date.Date == DateTime.Today);

            if (!string.IsNullOrWhiteSpace(keyword))
                all = all.Where(m => (m.Subject ?? "").Contains(keyword, StringComparison.OrdinalIgnoreCase));

            // Deduplicate by MessageId (same email CC'd to multiple mailboxes).
            var deduped = new Dictionary<string, EmailSearchResult>(StringComparer.OrdinalIgnoreCase);
            foreach (var m in all.OrderByDescending(m => m.Date))
            {
                var key = string.IsNullOrEmpty(m.MessageId) ? Guid.NewGuid().ToString() : m.MessageId;
                if (deduped.TryGetValue(key, out var existing))
                {
                    if (!existing.FoundInAccounts.Contains(m.AccountEmail, StringComparer.OrdinalIgnoreCase))
                        existing.FoundInAccounts.Add(m.AccountEmail);
                }
                else
                {
                    m.FoundInAccounts = new List<string> { m.AccountEmail };
                    deduped[key] = m;
                }
            }

            return deduped.Values.OrderByDescending(m => m.Date).ToList();
        }

        public bool IsReady => _status.Values.Any(s => s.Connected);
        public IReadOnlyCollection<MailboxStatus> GetStatus() => _status.Values.ToList();

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_config.GetValue<bool>("EmailEnabled", true))
            {
                _logger.LogInformation("SalesMailboxMonitor: email disabled via config; not starting.");
                return;
            }
            if (!_config.GetValue<bool>("SalesMonitor:Enabled", true))
            {
                _logger.LogInformation("SalesMailboxMonitor: disabled via SalesMonitor:Enabled=false.");
                return;
            }

            // Small delay so the app/db finish starting up.
            try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
            catch (OperationCanceledException) { return; }

            List<(string Email, string Password, string Display)> accounts;
            try
            {
                accounts = await LoadSalesAccountsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SalesMailboxMonitor: failed to load accounts.");
                return;
            }

            if (accounts.Count == 0)
            {
                _logger.LogWarning("SalesMailboxMonitor: no active sales/orders accounts found.");
                return;
            }

            _logger.LogInformation("SalesMailboxMonitor: starting persistent IDLE monitors for {Count} mailbox(es).", accounts.Count);

            // One long-running loop per account. Each logs in ONCE and stays connected.
            // Stagger the initial connections so we don't fire N simultaneous logins from
            // one IP (which itself looks like an attack). ~3s between each mailbox.
            var staggerSeconds = _config.GetValue<int?>("SalesMonitor:StaggerSeconds") ?? 3;
            var tasks = accounts.Select((a, i) =>
                MonitorAccountAsync(a.Email, a.Password, a.Display, i * staggerSeconds, stoppingToken));
            await Task.WhenAll(tasks);
        }

        private async Task<List<(string, string, string)>> LoadSalesAccountsAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Explicit mailboxes to track (from SalesMonitor:Mailboxes in appsettings).
            var explicitList = _config.GetSection("SalesMonitor:Mailboxes").Get<string[]>()
                ?? Array.Empty<string>();
            var explicitSet = explicitList
                .Where(e => !string.IsNullOrWhiteSpace(e))
                .Select(e => e.Trim().ToLowerInvariant())
                .ToHashSet();

            // Monitor ONLY the explicitly configured mailboxes. Nothing else.
            var accounts = await db.EmailAccounts
                .Where(e => e.IsActive && explicitSet.Contains(e.Email.ToLower()))
                .ToListAsync(ct);

            return accounts.Select(a => (a.Email, a.Password, a.DisplayName ?? a.Email)).ToList();
        }

        private async Task MonitorAccountAsync(string email, string password, string display, int initialDelaySeconds, CancellationToken stoppingToken)
        {
            var host = _config["ImapSettings:Host"] ?? "mail.promedtechnologies.co.za";
            var port = int.Parse(_config["ImapSettings:Port"] ?? "993");
            var useSsl = bool.Parse(_config["ImapSettings:UseSsl"] ?? "true");
            var keepAliveMinutes = _config.GetValue<int?>("SalesMonitor:KeepAliveMinutes") ?? 9;
            // After this many consecutive auth failures, permanently stop this mailbox so we
            // never sit in a failed-login loop (the classic brute-force blacklist trigger).
            var maxAuthFailures = _config.GetValue<int?>("SalesMonitor:MaxAuthFailures") ?? 2;
            // Backoff bounds for TRANSIENT (network/server) errors only.
            var minBackoff = _config.GetValue<int?>("SalesMonitor:MinBackoffSeconds") ?? 60;
            var maxBackoff = _config.GetValue<int?>("SalesMonitor:MaxBackoffSeconds") ?? 1800; // 30 min

            _status[email] = new MailboxStatus { Email = email };

            // Stagger startup so N mailboxes don't all authenticate at the same instant.
            if (initialDelaySeconds > 0)
            {
                try { await Task.Delay(TimeSpan.FromSeconds(initialDelaySeconds), stoppingToken); }
                catch (OperationCanceledException) { return; }
            }

            var backoffSeconds = minBackoff;

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var client = new ImapClient();
                    client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                    await client.ConnectAsync(host, port, useSsl, stoppingToken);
                    await client.AuthenticateAsync(email, password, stoppingToken);
                    await client.Inbox.OpenAsync(FolderAccess.ReadOnly, stoppingToken);

                    _status[email].Connected = true;
                    _status[email].LastError = null;
                    _status[email].AuthFailures = 0;   // clean auth resets the counter
                    backoffSeconds = minBackoff;        // reset backoff on success
                    _logger.LogInformation("SalesMailboxMonitor: connected & IDLE for {Email}", email);

                    // Initial load of today's messages.
                    await RefreshAsync(client.Inbox, email, display, stoppingToken);

                    // React to new mail / flag changes without re-logging in.
                    var inbox = client.Inbox;

                    while (!stoppingToken.IsCancellationRequested)
                    {
                        if (client.Capabilities.HasFlag(ImapCapabilities.Idle))
                        {
                            bool changed = false;
                            EventHandler<EventArgs> onChanged = (s, e) => changed = true;
                            inbox.CountChanged += onChanged;

                            try
                            {
                                using var idleTimeout = new CancellationTokenSource(TimeSpan.FromMinutes(keepAliveMinutes));
                                using var linked = CancellationTokenSource.CreateLinkedTokenSource(idleTimeout.Token, stoppingToken);
                                await client.IdleAsync(linked.Token, stoppingToken);
                            }
                            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested) { /* keepalive elapsed */ }
                            finally
                            {
                                inbox.CountChanged -= onChanged;
                            }

                            if (changed)
                                await RefreshAsync(inbox, email, display, stoppingToken);
                        }
                        else
                        {
                            // Server lacks IDLE: gentle NOOP keepalive on the SAME connection (still one login).
                            await Task.Delay(TimeSpan.FromMinutes(keepAliveMinutes), stoppingToken);
                            await client.NoOpAsync(stoppingToken);
                            await RefreshAsync(inbox, email, display, stoppingToken);
                        }
                    }

                    await client.DisconnectAsync(true, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break; // shutting down
                }
                catch (AuthenticationException aex)
                {
                    // Wrong credentials. Retrying is pointless AND harmful — repeated failed
                    // logins are exactly what gets an IP blacklisted. Stop after a small number.
                    _status[email].Connected = false;
                    _status[email].AuthFailures++;
                    _status[email].LastError = "Authentication failed: " + aex.Message;

                    if (_status[email].AuthFailures >= maxAuthFailures)
                    {
                        _status[email].Disabled = true;
                        _logger.LogError(
                            "SalesMailboxMonitor: DISABLING {Email} after {N} authentication failures. " +
                            "Fix the stored password, then restart the backend. No further login attempts will be made.",
                            email, _status[email].AuthFailures);
                        break; // permanently stop this mailbox
                    }

                    // One brief pause before a single re-verification attempt (covers a stale-password race).
                    _logger.LogWarning("SalesMailboxMonitor: auth failed for {Email} ({N}/{Max}); re-verifying once.",
                        email, _status[email].AuthFailures, maxAuthFailures);
                    try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
                    catch (OperationCanceledException) { break; }
                }
                catch (Exception ex)
                {
                    // Transient (network blip, server restart, dropped IDLE). Safe to reconnect,
                    // but with a generous, jittered backoff so we never hammer the server.
                    _status[email].Connected = false;
                    _status[email].LastError = ex.Message;

                    var jitter = _jitter.Next(0, Math.Max(1, backoffSeconds / 4));
                    var delay = backoffSeconds + jitter;
                    _logger.LogWarning(ex,
                        "SalesMailboxMonitor: connection lost for {Email}; reconnecting in {Sec}s", email, delay);
                    try { await Task.Delay(TimeSpan.FromSeconds(delay), stoppingToken); }
                    catch (OperationCanceledException) { break; }
                    backoffSeconds = Math.Min(backoffSeconds * 2, maxBackoff); // exponential, capped
                }
            }

            if (_status.TryGetValue(email, out var st)) st.Connected = false;
        }

        private async Task RefreshAsync(IMailFolder inbox, string email, string display, CancellationToken ct)
        {
            try
            {
                if (!inbox.IsOpen)
                    await inbox.OpenAsync(FolderAccess.ReadOnly, ct);

                // Today's messages ONLY (delivered on today's date).
                var query = SearchQuery.DeliveredOn(DateTime.Today);
                var uids = await inbox.SearchAsync(query, ct);

                var results = new List<EmailSearchResult>();
                if (uids.Count > 0)
                {
                    var items = MessageSummaryItems.Envelope | MessageSummaryItems.Flags |
                                MessageSummaryItems.BodyStructure | MessageSummaryItems.Size;
                    var summaries = await inbox.FetchAsync(uids, items, ct);

                    foreach (var s in summaries)
                    {
                        var fromMailbox = s.Envelope?.From?.Mailboxes?.FirstOrDefault();
                        results.Add(new EmailSearchResult
                        {
                            MessageId = s.Envelope?.MessageId ?? s.UniqueId.ToString(),
                            Subject = s.Envelope?.Subject ?? "(No Subject)",
                            From = fromMailbox?.Name ?? fromMailbox?.Address ?? "Unknown",
                            FromEmail = fromMailbox?.Address ?? "",
                            Date = (s.Envelope?.Date ?? s.Date).DateTime,
                            AccountEmail = email,
                            AccountDisplayName = display,
                            HasAttachments = s.Attachments?.Any() ?? false,
                            IsRead = s.Flags?.HasFlag(MessageFlags.Seen) ?? false,
                            Priority = "Normal",
                            To = s.Envelope?.To?.Mailboxes?.Select(m => m.Address).ToList() ?? new(),
                            Cc = s.Envelope?.Cc?.Mailboxes?.Select(m => m.Address).ToList() ?? new()
                        });
                    }
                }

                _cache[email] = results;
                if (_status.TryGetValue(email, out var st))
                {
                    st.LastUpdate = DateTime.UtcNow;
                    st.CachedCount = results.Count;
                    st.Connected = true;
                }
                _logger.LogDebug("SalesMailboxMonitor: refreshed {Count} message(s) for {Email}", results.Count, email);
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SalesMailboxMonitor: refresh failed for {Email}", email);
            }
        }
    }
}
