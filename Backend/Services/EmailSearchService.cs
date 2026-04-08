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

            // Global email kill switch
            if (!(_configuration.GetValue<bool>("EmailEnabled", true)))
            {
                _logger.LogWarning("Email DISABLED - skipping IMAP search");
                return results;
            }

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

        /// <summary>
        /// Fetch a user's inbox emails via IMAP with pagination
        /// </summary>
        public async Task<object> FetchUserInboxAsync(
            string email, string password, string? folderName, string? search, int page, int pageSize)
        {
            // Global email kill switch
            if (!(_configuration.GetValue<bool>("EmailEnabled", true)))
            {
                _logger.LogWarning("Email DISABLED - skipping inbox fetch for {Email}", email);
                return new { emails = new List<object>(), total = 0, page, pageSize, disabled = true };
            }

            var imapHost = _configuration["ImapSettings:Host"] ?? "mail.promedtechnologies.co.za";
            var imapPort = int.Parse(_configuration["ImapSettings:Port"] ?? "993");
            var useSsl = bool.Parse(_configuration["ImapSettings:UseSsl"] ?? "true");
            var timeout = int.Parse(_configuration["ImapSettings:TimeoutSeconds"] ?? "15") * 1000;

            using var client = new ImapClient();
            client.Timeout = timeout;
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            await client.ConnectAsync(imapHost, imapPort, useSsl);
            await client.AuthenticateAsync(email, password);

            var folder = string.IsNullOrEmpty(folderName) || folderName == "INBOX"
                ? client.Inbox
                : await FindFolderAsync(client, folderName);

            if (folder == null)
            {
                await client.DisconnectAsync(true);
                return new { emails = new List<object>(), total = 0, page, pageSize };
            }

            await folder.OpenAsync(FolderAccess.ReadOnly);

            // Build search query
            SearchQuery query = SearchQuery.All;
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = SearchQuery.SubjectContains(search)
                    .Or(SearchQuery.FromContains(search))
                    .Or(SearchQuery.BodyContains(search));
            }

            var allUids = await folder.SearchAsync(query);
            var total = allUids.Count;

            // Sort descending (newest first) and paginate
            var sortedUids = allUids.OrderByDescending(u => u.Id).ToList();
            var skip = (page - 1) * pageSize;
            var pagedUids = sortedUids.Skip(skip).Take(pageSize).ToList();

            var emails = new List<object>();

            if (pagedUids.Any())
            {
                var uidSet = new UniqueIdRange(pagedUids.Last(), pagedUids.First());
                var items = MessageSummaryItems.Envelope |
                            MessageSummaryItems.Flags |
                            MessageSummaryItems.BodyStructure |
                            MessageSummaryItems.Size;

                // Fetch summaries for all paged UIDs
                var summaries = await folder.FetchAsync(pagedUids, items);

                foreach (var summary in summaries.OrderByDescending(s => s.Date))
                {
                    var fromMailbox = summary.Envelope?.From?.Mailboxes?.FirstOrDefault();
                    emails.Add(new
                    {
                        uid = summary.UniqueId.Id,
                        subject = summary.Envelope?.Subject ?? "(No Subject)",
                        from = fromMailbox?.Name ?? fromMailbox?.Address ?? "Unknown",
                        fromEmail = fromMailbox?.Address ?? "",
                        to = summary.Envelope?.To?.Mailboxes?.Select(m => new { name = m.Name ?? m.Address, email = m.Address }).ToList(),
                        cc = summary.Envelope?.Cc?.Mailboxes?.Select(m => new { name = m.Name ?? m.Address, email = m.Address }).ToList(),
                        date = summary.Date.LocalDateTime,
                        isRead = summary.Flags?.HasFlag(MessageFlags.Seen) == true,
                        isFlagged = summary.Flags?.HasFlag(MessageFlags.Flagged) == true,
                        hasAttachments = summary.Attachments?.Any() == true,
                        size = summary.Size ?? 0,
                        preview = "" // Preview fetched on-demand via GetEmailBody
                    });
                }
            }

            await client.DisconnectAsync(true);

            return new { emails, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) };
        }

        /// <summary>
        /// Get the list of IMAP folders for a user's mailbox
        /// </summary>
        public async Task<List<object>> GetFoldersAsync(string email, string password)
        {
            // Global email kill switch
            if (!(_configuration.GetValue<bool>("EmailEnabled", true)))
            {
                _logger.LogWarning("Email DISABLED - skipping folder list for {Email}", email);
                return new List<object>();
            }

            var imapHost = _configuration["ImapSettings:Host"] ?? "mail.promedtechnologies.co.za";
            var imapPort = int.Parse(_configuration["ImapSettings:Port"] ?? "993");
            var useSsl = bool.Parse(_configuration["ImapSettings:UseSsl"] ?? "true");
            var timeout = int.Parse(_configuration["ImapSettings:TimeoutSeconds"] ?? "15") * 1000;

            using var client = new ImapClient();
            client.Timeout = timeout;
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            await client.ConnectAsync(imapHost, imapPort, useSsl);
            await client.AuthenticateAsync(email, password);

            var folders = new List<object>();
            var personal = client.GetFolder(client.PersonalNamespaces[0]);
            await AddFoldersRecursive(client, personal, folders);

            // Add INBOX explicitly
            var inbox = client.Inbox;
            await inbox.OpenAsync(FolderAccess.ReadOnly);
            var inboxCount = inbox.Count;
            var inboxUnread = inbox.Unread;
            await inbox.CloseAsync();

            folders.Insert(0, new { name = "INBOX", fullName = "INBOX", total = inboxCount, unread = inboxUnread, icon = "inbox" });

            await client.DisconnectAsync(true);
            return folders;
        }

        private async Task AddFoldersRecursive(ImapClient client, IMailFolder parent, List<object> folders)
        {
            var subfolders = await parent.GetSubfoldersAsync();
            foreach (var folder in subfolders)
            {
                string icon = folder.Name.ToLower() switch
                {
                    "sent" or "sent items" or "sent messages" => "send",
                    "drafts" => "drafts",
                    "trash" or "deleted items" or "deleted messages" => "delete",
                    "spam" or "junk" or "junk email" => "report",
                    "archive" => "archive",
                    _ => "folder"
                };

                try
                {
                    await folder.OpenAsync(FolderAccess.ReadOnly);
                    folders.Add(new { name = folder.Name, fullName = folder.FullName, total = folder.Count, unread = folder.Unread, icon });
                    await folder.CloseAsync();
                }
                catch
                {
                    folders.Add(new { name = folder.Name, fullName = folder.FullName, total = 0, unread = 0, icon });
                }

                // Recurse into subfolders
                await AddFoldersRecursive(client, folder, folders);
            }
        }

        /// <summary>
        /// Get the full body of a specific email by UID
        /// </summary>
        public async Task<object?> GetEmailBodyAsync(string email, string password, string? folderName, uint uid)
        {
            // Global email kill switch
            if (!(_configuration.GetValue<bool>("EmailEnabled", true)))
            {
                _logger.LogWarning("Email DISABLED - skipping email body fetch");
                return null;
            }

            var imapHost = _configuration["ImapSettings:Host"] ?? "mail.promedtechnologies.co.za";
            var imapPort = int.Parse(_configuration["ImapSettings:Port"] ?? "993");
            var useSsl = bool.Parse(_configuration["ImapSettings:UseSsl"] ?? "true");
            var timeout = int.Parse(_configuration["ImapSettings:TimeoutSeconds"] ?? "15") * 1000;

            using var client = new ImapClient();
            client.Timeout = timeout;
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            await client.ConnectAsync(imapHost, imapPort, useSsl);
            await client.AuthenticateAsync(email, password);

            var folder = string.IsNullOrEmpty(folderName) || folderName == "INBOX"
                ? client.Inbox
                : await FindFolderAsync(client, folderName);

            if (folder == null)
            {
                await client.DisconnectAsync(true);
                return null;
            }

            await folder.OpenAsync(FolderAccess.ReadOnly);

            var uniqueId = new MailKit.UniqueId(uid);
            var message = await folder.GetMessageAsync(uniqueId);

            if (message == null)
            {
                await client.DisconnectAsync(true);
                return null;
            }

            var attachments = new List<object>();
            foreach (var attachment in message.Attachments)
            {
                if (attachment is MimeKit.MimePart part)
                {
                    attachments.Add(new
                    {
                        fileName = part.FileName ?? "attachment",
                        contentType = part.ContentType?.MimeType ?? "application/octet-stream",
                        size = part.Content?.Stream?.Length ?? 0
                    });
                }
            }

            var result = new
            {
                uid,
                subject = message.Subject ?? "(No Subject)",
                from = message.From?.ToString() ?? "Unknown",
                fromEmail = (message.From?.Mailboxes?.FirstOrDefault())?.Address ?? "",
                to = message.To?.Mailboxes?.Select(m => new { name = m.Name ?? m.Address, email = m.Address }).ToList(),
                cc = message.Cc?.Mailboxes?.Select(m => new { name = m.Name ?? m.Address, email = m.Address }).ToList(),
                date = message.Date.LocalDateTime,
                htmlBody = message.HtmlBody,
                textBody = message.TextBody,
                attachments,
                hasAttachments = attachments.Any()
            };

            await client.DisconnectAsync(true);
            return result;
        }

        private async Task<IMailFolder?> FindFolderAsync(ImapClient client, string folderName)
        {
            try
            {
                var personal = client.GetFolder(client.PersonalNamespaces[0]);
                return await FindFolderRecursive(personal, folderName);
            }
            catch
            {
                return null;
            }
        }

        private async Task<IMailFolder?> FindFolderRecursive(IMailFolder parent, string folderName)
        {
            var subfolders = await parent.GetSubfoldersAsync();
            foreach (var folder in subfolders)
            {
                if (folder.FullName.Equals(folderName, StringComparison.OrdinalIgnoreCase) ||
                    folder.Name.Equals(folderName, StringComparison.OrdinalIgnoreCase))
                    return folder;

                var found = await FindFolderRecursive(folder, folderName);
                if (found != null) return found;
            }
            return null;
        }
    }
}
