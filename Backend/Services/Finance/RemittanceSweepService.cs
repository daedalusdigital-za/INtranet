using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance;

namespace ProjectTracker.API.Services.Finance
{
    public class RemittanceInvoiceMatch
    {
        public string InvoiceNumber { get; set; } = string.Empty;
        public decimal? Amount { get; set; }          // amount printed next to the invoice (if we could read one)
        public string Source { get; set; } = "";      // subject | body | attachment:<file>
        public bool InAging { get; set; }
        public string? CustomerCode { get; set; }
        public string? CustomerName { get; set; }
        public decimal? AgingBalance { get; set; }
        public int? DaysOver { get; set; }
        public string? Company { get; set; }
    }

    public class RemittanceExtraction
    {
        public List<RemittanceInvoiceMatch> Invoices { get; set; } = new();
        public List<decimal> Amounts { get; set; } = new();   // other money amounts seen (for totals/short-pay checks)
        public string? PaymentDate { get; set; }
        public string? PaymentReference { get; set; }
    }

    public interface IRemittanceSweepService
    {
        Task<RemittanceScan> SweepAsync(string trigger, CancellationToken ct);
        string[] Mailboxes { get; }
        string[] Keywords { get; }
    }

    /// <summary>
    /// Reads the finance mailbox(es) for remittance advices / proofs of payment, stores each one with
    /// its attachments and the email context, extracts invoice numbers (subject, body, PDF text) and
    /// matches them to the latest debtors' aging so Finance can allocate quickly.
    /// One IMAP login per mailbox per sweep — never a retry loop (the mail server blacklists spammy logins).
    /// </summary>
    public class RemittanceSweepService : IRemittanceSweepService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly IConfiguration _cfg;
        private readonly ILogger<RemittanceSweepService> _log;
        private readonly string _root;
        private static readonly SemaphoreSlim Gate = new(1, 1);
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        public string[] Mailboxes { get; }
        public string[] Keywords { get; }

        public RemittanceSweepService(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<RemittanceSweepService> log)
        {
            _scopes = scopes; _cfg = cfg; _log = log;
            Mailboxes = cfg.GetSection("Finance:Remittances:Mailboxes").Get<string[]>()?.Where(m => !string.IsNullOrWhiteSpace(m)).Select(m => m.Trim().ToLowerInvariant()).ToArray()
                        ?? new[] { "finance@promedtechnologies.co.za" };
            Keywords = cfg.GetSection("Finance:Remittances:Keywords").Get<string[]>()
                        ?? new[] { "remittance", "remitance", "remit", "payment advice", "proof of payment", "pop ", "eft payment", "payment notification", "payment confirmation" };
            _root = cfg.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        }

        public async Task<RemittanceScan> SweepAsync(string trigger, CancellationToken ct)
        {
            if (!await Gate.WaitAsync(0, ct)) throw new InvalidOperationException("A remittance scan is already running.");
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var scan = new RemittanceScan { Trigger = trigger, Mailboxes = string.Join(", ", Mailboxes) };
                db.RemittanceScans.Add(scan);
                await db.SaveChangesAsync(ct);

                try
                {
                    if (!_cfg.GetValue("EmailEnabled", true)) throw new InvalidOperationException("Email is disabled in configuration.");
                    var accounts = await db.EmailAccounts.AsNoTracking().Where(a => a.IsActive && Mailboxes.Contains(a.Email.ToLower())).ToListAsync(ct);
                    if (accounts.Count == 0) throw new InvalidOperationException($"No active mailbox credentials found for: {string.Join(", ", Mailboxes)}");

                    var lastScan = await db.RemittanceScans.AsNoTracking().Where(s => s.Id != scan.Id && s.FinishedAt != null && s.Error == null).OrderByDescending(s => s.FinishedAt).Select(s => s.FinishedAt).FirstOrDefaultAsync(ct);
                    var lookbackDays = _cfg.GetValue<int?>("Finance:Remittances:FirstRunLookbackDays") ?? 60;
                    var since = (lastScan ?? DateTime.UtcNow.AddDays(-lookbackDays)).AddDays(-1).Date; // overlap a day; dedup by MessageId

                    var aging = await LoadAgingIndexAsync(db, ct);

                    foreach (var acc in accounts)
                    {
                        ct.ThrowIfCancellationRequested();
                        var (checkedN, foundN) = await SweepMailboxAsync(db, acc.Email, acc.Password, since, aging, ct);
                        scan.MessagesChecked += checkedN; scan.RemittancesFound += foundN;
                    }
                }
                catch (Exception ex)
                {
                    scan.Error = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
                    _log.LogError(ex, "Remittance sweep failed");
                }
                scan.FinishedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                _log.LogInformation("Remittance sweep ({Trigger}): {Checked} messages checked, {Found} remittances saved{Err}", trigger, scan.MessagesChecked, scan.RemittancesFound, scan.Error == null ? "" : " — " + scan.Error);
                return scan;
            }
            finally { Gate.Release(); }
        }

        // ------------------------------------------------------------------ aging index

        private sealed record AgingRow(string Code, string Name, decimal Balance, int? DaysOver, string Company);

        private static async Task<Dictionary<string, AgingRow>> LoadAgingIndexAsync(ApplicationDbContext db, CancellationToken ct)
        {
            // Latest snapshot per company → invoice number → row
            var latest = await db.ArAgingSnapshots.AsNoTracking().GroupBy(s => s.Company).Select(g => g.OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id).First()).ToListAsync(ct);
            var ids = latest.Select(s => s.Id).ToList();
            if (ids.Count == 0) return new();
            var rows = await db.ArAgingItems.AsNoTracking().Where(i => ids.Contains(i.SnapshotId) && i.DocumentType == "IN")
                .Select(i => new { i.SnapshotId, i.DocumentNumber, i.CustomerCode, i.CustomerName, i.Balance, i.DaysOver }).ToListAsync(ct);
            var company = latest.ToDictionary(s => s.Id, s => s.Company);
            var idx = new Dictionary<string, AgingRow>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in rows) idx[r.DocumentNumber.Trim()] = new AgingRow(r.CustomerCode, r.CustomerName, r.Balance, r.DaysOver, company[r.SnapshotId]);
            return idx;
        }

        // ------------------------------------------------------------------ mailbox

        /// <summary>Invoices not on any aging snapshot: still name the customer from the intranet's imported sales invoices.</summary>
        private static async Task FillFromImportedInvoicesAsync(ApplicationDbContext db, RemittanceExtraction ex, CancellationToken ct)
        {
            var missing = ex.Invoices.Where(i => !i.InAging).Select(i => i.InvoiceNumber).Distinct().ToList();
            if (missing.Count == 0) return;
            var rows = await db.ImportedInvoices.AsNoTracking().Where(i => missing.Contains(i.TransactionNumber))
                .GroupBy(i => i.TransactionNumber).Select(g => new { No = g.Key, g.First().CustomerNumber, g.First().CustomerName }).ToListAsync(ct);
            var map = rows.ToDictionary(r => r.No, r => r, StringComparer.OrdinalIgnoreCase);
            foreach (var i in ex.Invoices.Where(i => !i.InAging))
                if (map.TryGetValue(i.InvoiceNumber, out var r)) { i.CustomerCode = r.CustomerNumber; i.CustomerName = r.CustomerName; i.Source += " · intranet"; }
        }

        private async Task<(int checkedN, int foundN)> SweepMailboxAsync(ApplicationDbContext db, string email, string password, DateTime since, Dictionary<string, AgingRow> aging, CancellationToken ct)
        {
            var host = _cfg["ImapSettings:Host"] ?? "mail.promedtechnologies.co.za";
            var port = int.Parse(_cfg["ImapSettings:Port"] ?? "993");
            var ssl = bool.Parse(_cfg["ImapSettings:UseSsl"] ?? "true");
            int checkedN = 0, foundN = 0;

            using var client = new ImapClient { Timeout = 60_000 };
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;
            await client.ConnectAsync(host, port, ssl, ct);
            await client.AuthenticateAsync(email, password, ct);
            var inbox = client.Inbox;
            await inbox.OpenAsync(FolderAccess.ReadOnly, ct);

            var uids = await inbox.SearchAsync(SearchQuery.DeliveredAfter(since), ct);
            var known = (await db.RemittanceEmails.AsNoTracking().Where(r => r.Mailbox == email).Select(r => r.MessageId).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var summaries = await inbox.FetchAsync(uids, MessageSummaryItems.Envelope | MessageSummaryItems.BodyStructure | MessageSummaryItems.UniqueId, ct);

            foreach (var s in summaries)
            {
                ct.ThrowIfCancellationRequested();
                checkedN++;
                var msgId = s.Envelope?.MessageId ?? $"uid:{s.UniqueId.Id}@{email}";
                if (known.Contains(msgId)) continue;

                var subject = s.Envelope?.Subject ?? "";
                var attachmentNames = s.BodyParts.Where(p => p.IsAttachment || !string.IsNullOrEmpty(p.FileName)).Select(p => p.FileName ?? "").ToList();
                var hit = Hit(subject, "subject") ?? attachmentNames.Select(n => Hit(n, "attachment")).FirstOrDefault(h => h != null);

                MimeMessage? msg = null;
                string body = "";
                if (hit == null)
                {
                    // Cheap pre-filter missed; only download the body when it has a PDF/XLS attachment (remittances almost always do).
                    if (!attachmentNames.Any(n => n.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) || n.EndsWith(".xls", StringComparison.OrdinalIgnoreCase) || n.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) || n.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))) continue;
                    msg = await inbox.GetMessageAsync(s.UniqueId, ct);
                    body = BodyText(msg);
                    hit = Hit(body, "body");
                    if (hit == null) continue;
                }
                msg ??= await inbox.GetMessageAsync(s.UniqueId, ct);
                if (string.IsNullOrEmpty(body)) body = BodyText(msg);

                var from = msg.From.Mailboxes.FirstOrDefault();
                var rem = new RemittanceEmail
                {
                    Mailbox = email, MessageId = msgId.Length > 300 ? msgId[..300] : msgId,
                    FromName = Trunc(from?.Name, 200), FromEmail = Trunc(from?.Address, 200), Subject = Trunc(subject, 500),
                    ReceivedAt = (s.Envelope?.Date ?? msg.Date).UtcDateTime, BodyText = body.Length > 20000 ? body[..20000] : body, MatchedOn = hit
                };
                db.RemittanceEmails.Add(rem);
                await db.SaveChangesAsync(ct); // need Id for the folder

                var folder = Path.Combine("Finance", "Remittances", rem.ReceivedAt.ToString("yyyy"), rem.Id.ToString());
                Directory.CreateDirectory(Path.Combine(_root, folder));
                var texts = new List<(string source, string text)> { ("subject", subject), ("body", body) };
                foreach (var part in msg.Attachments.OfType<MimePart>().Concat(msg.BodyParts.OfType<MimePart>().Where(p => !string.IsNullOrEmpty(p.FileName) && !p.IsAttachment && p.ContentType.MimeType == "application/pdf")).DistinctBy(p => p))
                {
                    var name = SafeName(part.FileName ?? $"attachment-{rem.Attachments.Count + 1}");
                    var rel = Path.Combine(folder, name);
                    await using (var fs = File.Create(Path.Combine(_root, rel))) await part.Content.DecodeToAsync(fs, ct);
                    var att = new RemittanceAttachment { RemittanceEmailId = rem.Id, FileName = name, ContentType = part.ContentType.MimeType, Size = new FileInfo(Path.Combine(_root, rel)).Length, StoragePath = rel.Replace('\\', '/') };
                    if (att.ContentType == "application/pdf" || name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                    {
                        var t = PdfText(Path.Combine(_root, rel));
                        att.ExtractedText = t.Length > 20000 ? t[..20000] : t;
                        if (t.Length > 0) texts.Add(("attachment:" + name, t));
                    }
                    rem.Attachments.Add(att);
                }

                var ex = Extract(texts, aging);
                await FillFromImportedInvoicesAsync(db, ex, ct);
                rem.ExtractedJson = JsonSerializer.Serialize(ex, Json);
                rem.InvoiceCount = ex.Invoices.Count;
                rem.MatchedCount = ex.Invoices.Count(i => i.InAging);
                rem.MatchedBalance = ex.Invoices.Where(i => i.InAging).Sum(i => i.AgingBalance ?? 0);
                rem.TotalAmount = ex.Invoices.Any(i => i.Amount.HasValue) ? ex.Invoices.Sum(i => i.Amount ?? 0) : (ex.Amounts.Count > 0 ? ex.Amounts.Max() : null);
                // Customer = most common customer across the invoices (aging first, then intranet invoice history)
                var cust = ex.Invoices.Where(i => i.CustomerCode != null).GroupBy(i => i.CustomerCode).OrderByDescending(g => g.Count(x => x.InAging)).ThenByDescending(g => g.Count()).FirstOrDefault()?.First();
                rem.CustomerCode = cust?.CustomerCode; rem.CustomerName = cust?.CustomerName;
                await db.SaveChangesAsync(ct);
                known.Add(msgId); foundN++;
            }
            await client.DisconnectAsync(true, ct);
            return (checkedN, foundN);
        }

        private string? Hit(string text, string where)
        {
            if (string.IsNullOrEmpty(text)) return null;
            foreach (var k in Keywords) if (text.Contains(k, StringComparison.OrdinalIgnoreCase)) return $"{where}: \"{k.Trim()}\"";
            return null;
        }

        private static string BodyText(MimeMessage msg)
        {
            var t = msg.TextBody;
            if (string.IsNullOrWhiteSpace(t) && !string.IsNullOrWhiteSpace(msg.HtmlBody))
            {
                t = Regex.Replace(msg.HtmlBody, "<(br|/p|/div|/tr|/li)[^>]*>", "\n", RegexOptions.IgnoreCase);
                t = Regex.Replace(t, "<[^>]+>", " ");
                t = System.Net.WebUtility.HtmlDecode(t);
            }
            t = Regex.Replace(t ?? "", @"[ \t]+", " ");
            t = Regex.Replace(t, @"(\r?\n\s*){3,}", "\n\n");
            return t.Trim();
        }

        private static string PdfText(string path)
        {
            try
            {
                using var reader = new PdfReader(path);
                using var pdf = new PdfDocument(reader);
                var sb = new StringBuilder();
                for (var i = 1; i <= Math.Min(pdf.GetNumberOfPages(), 20); i++) sb.AppendLine(PdfTextExtractor.GetTextFromPage(pdf.GetPage(i)));
                return sb.ToString();
            }
            catch { return ""; }
        }

        // ------------------------------------------------------------------ extraction

        private static readonly Regex InvoiceRx = new(@"\bIN\s?-?\s?(\d{5,7})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex MoneyRx = new(@"(?<!\d)R?\s?(\d{1,3}(?:[ ,]\d{3})+|\d+)\.(\d{2})(?!\d)", RegexOptions.Compiled);
        private static readonly Regex DateRx = new(@"\b(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2})\b", RegexOptions.Compiled);
        private static readonly Regex RefRx = new(@"(?:ref(?:erence)?|payment\s*ref|our\s*ref)\s*[:#]?\s*([A-Z0-9\-/]{4,30})", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static RemittanceExtraction Extract(List<(string source, string text)> texts, Dictionary<string, AgingRow> aging)
        {
            var ex = new RemittanceExtraction();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var (source, text) in texts)
            {
                if (string.IsNullOrEmpty(text)) continue;
                foreach (Match m in InvoiceRx.Matches(text))
                {
                    var no = "IN" + m.Groups[1].Value;
                    if (!seen.Add(no)) continue;
                    // amount on the same line, if any
                    var lineStart = text.LastIndexOf('\n', Math.Max(0, m.Index - 1)) + 1;
                    var lineEnd = text.IndexOf('\n', m.Index); if (lineEnd < 0) lineEnd = text.Length;
                    var line = text[lineStart..lineEnd];
                    decimal? amt = null;
                    var monies = MoneyRx.Matches(line).Select(x => ParseMoney(x.Value)).Where(v => v.HasValue && v > 0).Select(v => v!.Value).ToList();
                    if (monies.Count > 0) amt = monies.Last();
                    var row = aging.TryGetValue(no, out var r) ? r : null;
                    ex.Invoices.Add(new RemittanceInvoiceMatch
                    {
                        InvoiceNumber = no, Amount = amt, Source = source, InAging = row != null,
                        CustomerCode = row?.Code, CustomerName = row?.Name, AgingBalance = row?.Balance, DaysOver = row?.DaysOver, Company = row?.Company
                    });
                }
                foreach (Match m in MoneyRx.Matches(text)) { var v = ParseMoney(m.Value); if (v.HasValue && v > 0 && ex.Amounts.Count < 200) ex.Amounts.Add(v.Value); }
                ex.PaymentDate ??= DateRx.Match(text) is { Success: true } d ? d.Value : null;
                ex.PaymentReference ??= RefRx.Match(text) is { Success: true } rf ? rf.Groups[1].Value : null;
            }
            ex.Amounts = ex.Amounts.Distinct().OrderByDescending(a => a).Take(20).ToList();
            return ex;
        }

        private static decimal? ParseMoney(string s)
        {
            s = s.Replace("R", "").Replace(" ", "").Replace(",", "");
            return decimal.TryParse(s, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : null;
        }
        private static string? Trunc(string? s, int n) => string.IsNullOrEmpty(s) ? s : (s.Length > n ? s[..n] : s);
        private static string SafeName(string name)
        {
            foreach (var c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '_');
            return name.Length > 150 ? name[^150..] : name;
        }
    }

    /// <summary>Runs the remittance sweep every night at 00:00 (server local time).</summary>
    public class RemittanceSweepScheduler : BackgroundService
    {
        private readonly IRemittanceSweepService _sweep;
        private readonly IConfiguration _cfg;
        private readonly ILogger<RemittanceSweepScheduler> _log;
        public RemittanceSweepScheduler(IRemittanceSweepService sweep, IConfiguration cfg, ILogger<RemittanceSweepScheduler> log) { _sweep = sweep; _cfg = cfg; _log = log; }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            if (!_cfg.GetValue("Finance:Remittances:Enabled", true)) { _log.LogInformation("Remittance sweep disabled."); return; }
            var at = TimeSpan.TryParse(_cfg["Finance:Remittances:RunAt"] ?? "00:00", out var t) ? t : TimeSpan.Zero;
            while (!ct.IsCancellationRequested)
            {
                var now = DateTime.Now;
                var next = now.Date.Add(at); if (next <= now) next = next.AddDays(1);
                _log.LogInformation("Next remittance sweep at {Next}", next);
                try { await Task.Delay(next - now, ct); } catch (OperationCanceledException) { break; }
                try { await _sweep.SweepAsync("schedule", ct); }
                catch (Exception ex) { _log.LogError(ex, "Scheduled remittance sweep failed"); }
            }
        }
    }
}
