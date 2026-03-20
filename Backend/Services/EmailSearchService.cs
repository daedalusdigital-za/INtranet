using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Services
{
    public class EmailSearchResult
    {
        public string MessageId { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string From { get; set; } = string.Empty;
        public string FromEmail { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string AccountEmail { get; set; } = string.Empty;
        public string AccountDisplayName { get; set; } = string.Empty;
        public bool HasAttachments { get; set; }
        public string Preview { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public string Priority { get; set; } = "Normal";
        public List<string> To { get; set; } = new();
        public List<string> Cc { get; set; } = new();
        public List<string> FoundInAccounts { get; set; } = new();
    }

    public class EmailSearchRequest
    {
        public List<string> AccountEmails { get; set; } = new();
        public string? SubjectKeyword { get; set; }
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
        public int MaxResults { get; set; } = 50;
    }

    public class EmailSearchService
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailSearchService> _logger;

        public EmailSearchService(
            ApplicationDbContext context,
            IConfiguration configuration,
            ILogger<EmailSearchService> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<List<EmailSearchResult>> SearchIncomingOrdersAsync(EmailSearchRequest request)
        {
            var results = new List<EmailSearchResult>();
            var imapHost = _configuration["ImapSettings:Host"] ?? "mail.promedtechnologies.co.za";
            var imapPort = int.Parse(_configuration["ImapSettings:Port"] ?? "993");
            var useSsl = bool.Parse(_configuration["ImapSettings:UseSsl"] ?? "true");
            var timeout = int.Parse(_configuration["ImapSettings:TimeoutSeconds"] ?? "15") * 1000;

            // Get accounts to search
            var accountQuery = _context.EmailAccounts.Where(e => e.IsActive);
            if (request.AccountEmails.Any())
            {
                accountQuery = accountQuery.Where(e => request.AccountEmails.Contains(e.Email));
            }
            else
            {
                // Default: search orders and sales accounts
                accountQuery = accountQuery.Where(e =>
                    e.Email.StartsWith("orders") ||
                    e.Email.StartsWith("sales") ||
                    e.Email.StartsWith("pvtsales"));
            }

            var accounts = await accountQuery.ToListAsync();

            if (!accounts.Any())
            {
                _logger.LogWarning("No email accounts found for IMAP search");
                return results;
            }

            // Search each account in parallel with limited concurrency
            var semaphore = new SemaphoreSlim(5); // Max 5 concurrent IMAP connections
            var tasks = accounts.Select(async account =>
            {
                await semaphore.WaitAsync();
                try
                {
                    var accountResults = await SearchAccountAsync(
                        account.Email,
                        account.Password,
                        account.DisplayName ?? account.Email,
                        imapHost,
                        imapPort,
                        useSsl,
                        timeout,
                        request);
                    return accountResults;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to search IMAP for account {Email}", account.Email);
                    return new List<EmailSearchResult>();
                }
                finally
                {
                    semaphore.Release();
                }
            });

            var allResults = await Task.WhenAll(tasks);
            
            // Deduplicate by MessageId — same email CC'd to multiple mailboxes should only appear once
            var deduped = new Dictionary<string, EmailSearchResult>(StringComparer.OrdinalIgnoreCase);
            foreach (var email in allResults.SelectMany(r => r).OrderByDescending(r => r.Date))
            {
                if (deduped.TryGetValue(email.MessageId, out var existing))
                {
                    // Already seen this email — just track which additional mailbox had it
                    if (!existing.FoundInAccounts.Contains(email.AccountEmail, StringComparer.OrdinalIgnoreCase))
                        existing.FoundInAccounts.Add(email.AccountEmail);
                }
                else
                {
                    email.FoundInAccounts = new List<string> { email.AccountEmail };
                    deduped[email.MessageId] = email;
                }
            }

            results = deduped.Values
                .OrderByDescending(r => r.Date)
                .Take(request.MaxResults)
                .ToList();

            return results;
        }

        private async Task<List<EmailSearchResult>> SearchAccountAsync(
            string email,
            string password,
            string displayName,
            string host,
            int port,
            bool useSsl,
            int timeout,
            EmailSearchRequest request)
        {
            var results = new List<EmailSearchResult>();

            using var client = new ImapClient();
            client.Timeout = timeout;

            // Accept self-signed certificates (internal mail server)
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            try
            {
                await client.ConnectAsync(host, port, useSsl);
                await client.AuthenticateAsync(email, password);

                var inbox = client.Inbox;
                await inbox.OpenAsync(FolderAccess.ReadOnly);

                // Build search query
                var dateFrom = request.DateFrom ?? DateTime.Today;
                var dateTo = request.DateTo ?? DateTime.Today.AddDays(1);

                SearchQuery query = SearchQuery.DeliveredAfter(dateFrom)
                    .And(SearchQuery.DeliveredBefore(dateTo));

                if (!string.IsNullOrWhiteSpace(request.SubjectKeyword))
                {
                    query = query.And(SearchQuery.SubjectContains(request.SubjectKeyword));
                }

                var uids = await inbox.SearchAsync(query);

                // Fetch message summaries (headers only - fast)
                if (uids.Any())
                {
                    var items = MessageSummaryItems.Envelope |
                                MessageSummaryItems.Flags |
                                MessageSummaryItems.BodyStructure |
                                MessageSummaryItems.Size;

                    var summaries = await inbox.FetchAsync(uids, items);

                    foreach (var summary in summaries.OrderByDescending(s => s.Date))
                    {
                        var result = new EmailSearchResult
                        {
                            MessageId = summary.Envelope?.MessageId ?? summary.UniqueId.ToString(),
                            Subject = summary.Envelope?.Subject ?? "(No Subject)",
                            From = summary.Envelope?.From?.FirstOrDefault()?.Name ??
                                   summary.Envelope?.From?.FirstOrDefault()?.ToString() ?? "Unknown",
                            FromEmail = (summary.Envelope?.From?.Mailboxes?.FirstOrDefault())?.Address ?? "unknown",
                            Date = summary.Date.LocalDateTime,
                            AccountEmail = email,
                            AccountDisplayName = displayName,
                            HasAttachments = summary.Attachments?.Any() == true,
                            IsRead = summary.Flags?.HasFlag(MessageFlags.Seen) == true,
                            Priority = GetPriority(summary),
                            To = summary.Envelope?.To?.Select(a => a.ToString()).ToList() ?? new List<string>(),
                            Cc = summary.Envelope?.Cc?.Select(a => a.ToString()).ToList() ?? new List<string>()
                        };

                        // Try to get a preview from the body structure
                        if (summary.TextBody != null)
                        {
                            try
                            {
                                var textPart = (MimeKit.TextPart)await inbox.GetBodyPartAsync(summary.UniqueId, summary.TextBody);
                                result.Preview = textPart.Text?.Length > 200
                                    ? textPart.Text.Substring(0, 200) + "..."
                                    : textPart.Text ?? "";
                            }
                            catch
                            {
                                result.Preview = "";
                            }
                        }

                        results.Add(result);

                        if (results.Count >= request.MaxResults)
                            break;
                    }
                }

                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "IMAP error for {Email} on {Host}:{Port}", email, host, port);
                throw;
            }

            return results;
        }

        private static string GetPriority(IMessageSummary summary)
        {
            if (summary.Flags?.HasFlag(MessageFlags.Flagged) == true)
                return "High";
            return "Normal";
        }

        public async Task<List<string>> GetAvailableAccountsAsync()
        {
            return await _context.EmailAccounts
                .Where(e => e.IsActive &&
                    (e.Email.StartsWith("orders") ||
                     e.Email.StartsWith("sales") ||
                     e.Email.StartsWith("pvtsales")))
                .Select(e => e.Email)
                .OrderBy(e => e)
                .ToListAsync();
        }
    }
}
