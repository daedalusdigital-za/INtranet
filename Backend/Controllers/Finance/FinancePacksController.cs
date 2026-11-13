using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using iText.IO.Image;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Utils;
using iText.Layout;
using iText.Layout.Element;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.Finance;

namespace ProjectTracker.API.Controllers.Finance;

/// <summary>
/// Invoice packs — the full paper trail for a sale (delivery note, tax invoice, order confirmation,
/// customer's order e-mail, filled-in order form) as one PDF, tracked by invoice number.
///
/// Flow: POST detect (read invoice / order / customer off the scan) → user confirms the invoice number
/// → GET lookup/{invoice} fills customer + company from Sage → POST upload (one scanned PDF) or
/// POST assemble (several component files merged into one PDF).
/// </summary>
[Authorize]
[ApiController]
[Route("api/finance/packs")]
[RequireModule("finance", AlsoAllowRoles = "Finance,Sales,Manager,Admin")]
public class FinancePacksController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<FinancePacksController> _log;
    private readonly string _root;

    public static readonly string[] Kinds = { "DeliveryNote", "TaxInvoice", "OrderConfirmation", "OrderEmail", "OrderForm", "Other" };

    public FinancePacksController(ApplicationDbContext db, IConfiguration cfg, ILogger<FinancePacksController> log)
    {
        _db = db; _log = log;
        _root = cfg.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
    }

    private int UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
    private string UserName => User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name ?? "";

    // ───────────────────────── helpers ─────────────────────────

    private static readonly Regex InvoiceRx = new(@"\b[I1L][NMH][\s.\-:#]?(\d{5,7})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex InvoiceLabelRx = new(@"(?:TAX\s+)?INV(?:OICE)?\s*(?:NO|NUMBER|#)?\s*[:.\-]?\s*([A-Z]{0,2}\s?\d{5,7})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex OrderRx = new(@"(?:(?:PURCHASE|CUSTOMER|YOUR|P\.?)\s*)?(?:ORDER|P/?O)\s*(?:NO|NUMBER|#|REF(?:ERENCE)?)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,24})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CustomerNoRx = new(@"(?:ACCOUNT|ACC|CUSTOMER|CUST|DEBTOR)\s*(?:NO|NUMBER|CODE|#)?\s*[:.\-]?\s*(\d{2}-[A-Z]{3}-\d{3}|[A-Z]{2,4}\d{3,6}|\d{2}[A-Z]{3}\d{3})", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Normalise an OCR'd invoice token to IN######.</summary>
    public static string? NormalizeInvoice(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.ToUpperInvariant().Replace(" ", "").Replace("-", "").Replace(".", "").Replace(":", "").Replace("#", "");
        var m = Regex.Match(s, @"^(?:[I1L][NMH])?([0-9OQDILSBZGT]{5,8})$");
        if (!m.Success) return null;
        var digits = new StringBuilder();
        foreach (var ch in m.Groups[1].Value)
            digits.Append(ch switch { 'O' or 'Q' or 'D' => '0', 'I' or 'L' => '1', 'Z' => '2', 'S' => '5', 'B' => '8', 'G' => '6', 'T' => '7', _ => ch });
        var d = digits.ToString();
        return d.Length is >= 5 and <= 7 ? "IN" + d : null;
    }

    private static string? CompanyCode(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = s.Trim().ToUpperInvariant();
        if (t is "PMT" or "ACM" or "PHT" or "SBT") return t;
        if (t.Contains("PHARMATECH")) return "PHT";
        if (t.Contains("PROMED")) return "PMT";
        if (t.Contains("ACCESS")) return "ACM";
        if (t.Contains("SEBENZANI")) return "SBT";
        return t.Length <= 10 ? t : null;
    }

    private static string? GuessCompanyFromText(string text)
    {
        var t = text.ToUpperInvariant();
        if (t.Contains("PHARMATECH")) return "PHT";
        if (t.Contains("PROMED TECHNOLOGIES") || t.Contains("PROMED TECH")) return "PMT";
        if (t.Contains("ACCESS MEDICAL")) return "ACM";
        if (t.Contains("SEBENZANI")) return "SBT";
        return null;
    }

    private static string PdfText(string path, int maxPages = 30)
    {
        try
        {
            using var reader = new PdfReader(path);
            using var pdf = new PdfDocument(reader);
            var sb = new StringBuilder();
            for (var i = 1; i <= Math.Min(pdf.GetNumberOfPages(), maxPages); i++)
                sb.AppendLine(PdfTextExtractor.GetTextFromPage(pdf.GetPage(i)));
            return sb.ToString();
        }
        catch { return ""; }
    }

    private static int PdfPages(string path)
    {
        try { using var pdf = new PdfDocument(new PdfReader(path)); return pdf.GetNumberOfPages(); }
        catch { return 0; }
    }

    public record SageHit(string? company, string? customerNumber, string? customerName, DateTime date, decimal total, int lines, int? loadId, string? orderNumber, int pods, List<string?> otherCompanies);

    private async Task<SageHit?> SageLookupAsync(string invoice, string? company)
    {
        var coCode = CompanyCode(company);
        var rows = await _db.ImportedInvoices.AsNoTracking()
            .Where(i => i.TransactionNumber == invoice)
            .GroupBy(i => i.SourceCompany)
            .Select(g => new
            {
                company = g.Key,
                customerNumber = g.Max(x => x.CustomerNumber),
                customerName = g.Max(x => x.CustomerName),
                date = g.Min(x => x.TransactionDate),
                total = g.Sum(x => x.SalesAmount),
                lines = g.Count(),
                loadId = g.Max(x => x.LoadId),
            })
            .ToListAsync();
        if (rows.Count == 0) return null;
        var hit = rows.FirstOrDefault(r => coCode != null && r.company == coCode) ?? rows.OrderByDescending(r => r.lines).First();
        // Order number lives on the aging, if the invoice is still open there.
        var aging = await _db.ArAgingItems.AsNoTracking().Where(a => a.DocumentNumber == invoice)
            .OrderByDescending(a => a.SnapshotId).Select(a => new { a.OrderNumber, a.PoNumber }).FirstOrDefaultAsync();
        var pods = await _db.PodDocumentInvoiceLinks.AsNoTracking().CountAsync(l => l.InvoiceNumber == invoice || (l.Invoice != null && l.Invoice.TransactionNumber == invoice));
        return new SageHit(hit.company, hit.customerNumber, hit.customerName, hit.date, hit.total, hit.lines, hit.loadId,
            aging?.PoNumber ?? aging?.OrderNumber, pods,
            rows.Where(r => r.company != hit.company).Select(r => r.company).ToList());
    }

    private static object Dto(InvoicePack p) => new
    {
        p.Id, p.PackNumber, p.InvoiceNumber, p.OrderNumber, p.CustomerNumber, p.CustomerName, p.Company,
        p.InvoiceDate, p.InvoiceTotal, p.Source, p.Status,
        contents = new { deliveryNote = p.HasDeliveryNote, taxInvoice = p.HasTaxInvoice, orderConfirmation = p.HasOrderConfirmation, orderEmail = p.HasOrderEmail, orderForm = p.HasOrderForm },
        p.InvoiceVerified, p.InSage, p.Notes,
        p.ConfirmationNumber, p.ValidationStatus, p.ProofOfDelivery, p.PartDelivery, p.AmendedOrder,
        validation = PackAnalyzer.Result.FromJson(p.ValidationJson),
        p.FileName, p.OriginalFileName, p.ContentType, p.Size, p.PageCount,
        p.UploadedBy, p.UploadedByName, p.UploadedAt, p.UpdatedAt,
        files = p.Files?.OrderBy(f => f.SortOrder).Select(f => new { f.Id, f.Kind, f.SortOrder, f.OriginalFileName, f.ContentType, f.Size, f.AddedAt }).ToList(),
    };

    private static string Status(InvoicePack p) =>
        p.HasDeliveryNote && p.HasTaxInvoice && p.HasOrderConfirmation && p.HasOrderEmail && p.HasOrderForm ? "Complete" : "Incomplete";

    private string FullPath(string rel) => Path.Combine(_root, rel.Replace('/', Path.DirectorySeparatorChar));

    private (string full, string rel) NewStoragePath(string invoice, string ext, string? sub = null)
    {
        var dir = Path.Combine(_root, "finance", "packs", DateTime.UtcNow.ToString("yyyy"));
        if (sub != null) dir = Path.Combine(dir, sub);
        Directory.CreateDirectory(dir);
        var safeInv = Regex.Replace(invoice, @"[^A-Za-z0-9\-]", "");
        var stored = $"{safeInv}_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}"[..Math.Min(80, safeInv.Length + 48)] + ext;
        var full = Path.Combine(dir, stored);
        return (full, Path.GetRelativePath(_root, full).Replace('\\', '/'));
    }

    // ───────────────────────── read ─────────────────────────

    /// <summary>GET api/finance/packs?search=&company=&status=&from=&to=&page=&pageSize=</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, [FromQuery] string? company, [FromQuery] string? status,
        [FromQuery] string? source, [FromQuery] string? validation, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 200);
        var q = _db.InvoicePacks.AsNoTracking().AsQueryable();
        var co = CompanyCode(company);
        if (co != null) q = q.Where(p => p.Company == co);
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(p => p.Status == status);
        if (!string.IsNullOrWhiteSpace(source)) q = q.Where(p => p.Source == source);
        if (!string.IsNullOrWhiteSpace(validation)) q = q.Where(p => p.ValidationStatus == validation);
        if (from.HasValue) q = q.Where(p => p.UploadedAt >= from.Value);
        if (to.HasValue) q = q.Where(p => p.UploadedAt < to.Value.AddDays(1));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            var inv = NormalizeInvoice(s);
            q = q.Where(p => p.InvoiceNumber.Contains(s) || (inv != null && p.InvoiceNumber == inv)
                || (p.OrderNumber != null && p.OrderNumber.Contains(s))
                || (p.CustomerNumber != null && p.CustomerNumber.Contains(s))
                || (p.CustomerName != null && p.CustomerName.Contains(s))
                || (p.PackNumber != null && p.PackNumber.Contains(s)));
        }
        var total = await q.CountAsync();
        var rows = await q.OrderByDescending(p => p.UploadedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { total, page, pageSize, data = rows.Select(Dto) });
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var q = _db.InvoicePacks.AsNoTracking();
        var total = await q.CountAsync();
        var complete = await q.CountAsync(p => p.Status == "Complete");
        var notInSage = await q.CountAsync(p => !p.InSage);
        var byCompany = await q.GroupBy(p => p.Company).Select(g => new { company = g.Key, count = g.Count() }).ToListAsync();
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var thisMonth = await q.CountAsync(p => p.UploadedAt >= monthStart);
        var missing = new
        {
            deliveryNote = await q.CountAsync(p => !p.HasDeliveryNote),
            taxInvoice = await q.CountAsync(p => !p.HasTaxInvoice),
            orderConfirmation = await q.CountAsync(p => !p.HasOrderConfirmation),
            orderEmail = await q.CountAsync(p => !p.HasOrderEmail),
            orderForm = await q.CountAsync(p => !p.HasOrderForm),
        };
        return Ok(new { total, complete, incomplete = total - complete, notInSage, thisMonth, byCompany, missing,
            validation = new {
                pass = await q.CountAsync(p => p.ValidationStatus == "PASS"),
                review = await q.CountAsync(p => p.ValidationStatus == "REVIEW"),
                fail = await q.CountAsync(p => p.ValidationStatus == "FAIL"),
                unknown = await q.CountAsync(p => p.ValidationStatus == null || p.ValidationStatus == "UNKNOWN"),
            } });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var p = await _db.InvoicePacks.AsNoTracking().Include(x => x.Files).FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound();
        var sage = await SageLookupAsync(p.InvoiceNumber, p.Company);
        return Ok(new { pack = Dto(p), sage });
    }

    /// <summary>Does a pack already exist for this invoice? Used by the uploader to warn on duplicates.</summary>
    [HttpGet("by-invoice/{invoice}")]
    public async Task<IActionResult> ByInvoice(string invoice)
    {
        var inv = NormalizeInvoice(invoice) ?? invoice.Trim().ToUpperInvariant();
        var rows = await _db.InvoicePacks.AsNoTracking().Where(p => p.InvoiceNumber == inv).OrderByDescending(p => p.UploadedAt).ToListAsync();
        return Ok(rows.Select(Dto));
    }

    /// <summary>Sage details for an invoice number — fills customer, company, date and total in the uploader.</summary>
    [HttpGet("lookup/{invoice}")]
    public async Task<IActionResult> Lookup(string invoice, [FromQuery] string? company)
    {
        var inv = NormalizeInvoice(invoice) ?? invoice.Trim().ToUpperInvariant();
        var sage = await SageLookupAsync(inv, company);
        var existing = await _db.InvoicePacks.AsNoTracking().Where(p => p.InvoiceNumber == inv).Select(p => new { p.Id, p.PackNumber, p.UploadedAt, p.UploadedByName }).ToListAsync();
        return Ok(new { invoiceNumber = inv, inSage = sage != null, sage, existingPacks = existing });
    }

    [HttpGet("{id:int}/file")]
    public async Task<IActionResult> File(int id, [FromQuery] bool download = false)
    {
        var p = await _db.InvoicePacks.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound();
        var full = FullPath(p.StoragePath);
        if (!System.IO.File.Exists(full)) return NotFound(new { error = "Pack file is missing on the server." });
        var ct = p.ContentType ?? "application/pdf";
        var name = p.OriginalFileName ?? p.FileName;
        if (download) return PhysicalFile(full, ct, name);
        Response.Headers.ContentDisposition = $"inline; filename=\"{name}\"";
        return PhysicalFile(full, ct);
    }

    [HttpGet("{id:int}/files/{fileId:int}")]
    public async Task<IActionResult> ComponentFile(int id, int fileId, [FromQuery] bool download = false)
    {
        var f = await _db.InvoicePackFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == fileId && x.PackId == id);
        if (f == null) return NotFound();
        var full = FullPath(f.StoragePath);
        if (!System.IO.File.Exists(full)) return NotFound(new { error = "File is missing on the server." });
        var ct = f.ContentType ?? "application/octet-stream";
        var name = f.OriginalFileName ?? f.FileName;
        if (download) return PhysicalFile(full, ct, name);
        Response.Headers.ContentDisposition = $"inline; filename=\"{name}\"";
        return PhysicalFile(full, ct);
    }

    // ───────────────────────── detect ─────────────────────────

    /// <summary>Per-page text: iText for text PDFs, server OCR (per page, rotation-aware) for scans/images.</summary>
    private async Task<(List<string> pages, string method)> PageTextsAsync(string path, string? contentType, ServerOcrService ocr)
    {
        var isPdf = path.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
        var pages = new List<string>();
        if (isPdf)
        {
            try
            {
                using var pdf = new PdfDocument(new PdfReader(path));
                for (var i = 1; i <= Math.Min(pdf.GetNumberOfPages(), 30); i++)
                    pages.Add(PdfTextExtractor.GetTextFromPage(pdf.GetPage(i)) ?? "");
            }
            catch { }
        }
        // A scanned PDF yields pages with (almost) no text → OCR the lot so page numbering stays aligned.
        var readable = pages.Count(t => t.Trim().Length >= 40);
        if (readable < Math.Max(1, pages.Count / 2))
        {
            if (!ServerOcrService.IsAvailable) return (pages, "none");
            try { return (await ocr.ExtractPageTextsAsync(path, contentType), "ocr"); }
            catch (Exception ex) { _log.LogWarning(ex, "Pack OCR failed for {Path}", path); return (pages, "none"); }
        }
        return (pages, "text");
    }

    private async Task<object> BuildDetectResponseAsync(PackAnalyzer.Result a, string method, string fileName, IEnumerable<string> pageTexts)
    {
        // Rank invoice candidates: pack vote first, then any other page reads, then the filename.
        var cands = new List<string>();
        if (a.InvoiceNumber != null) cands.Add(a.InvoiceNumber);
        cands.AddRange(a.Pages.Where(p => p.InvoiceNumber != null).Select(p => p.InvoiceNumber!));
        var fromName = PackAnalyzer.NormalizeInvoice(Regex.Match(Path.GetFileNameWithoutExtension(fileName), @"[I1L][NMH][\s.\-_]?\d{5,7}", RegexOptions.IgnoreCase).Value);
        if (fromName != null) cands.Add(fromName);
        var ranked = cands.GroupBy(c => c).OrderByDescending(g => g.Count()).ThenBy(g => cands.IndexOf(g.Key)).Select(g => g.Key).Take(8).ToList();
        string? how = ranked.Count > 0 ? "read" : null;

        // The IN number is often part of a header graphic OCR cannot read. Fall back to Sage:
        // (1) the aging knows the customer PO / Sage order (ORD) per open invoice;
        // (2) the invoice total (incl. VAT) is unique enough per customer to pin the invoice down.
        if (ranked.Count == 0)
        {
            var byRef = new List<string>();
            var refs = new[] { a.OrderNumber, a.ConfirmationNumber }.Where(s => !string.IsNullOrEmpty(s)).Select(s => s!).ToList();
            if (refs.Count > 0)
            {
                var alt = refs.SelectMany(r => new[] { r, Regex.Replace(r, @"^([A-Z]+)(\d+)$", "$1-$2") }).Distinct().ToList();
                byRef = await _db.ArAgingItems.AsNoTracking()
                    .Where(x => (x.PoNumber != null && alt.Contains(x.PoNumber)) || (x.OrderNumber != null && alt.Contains(x.OrderNumber)) || (x.Reference != null && alt.Contains(x.Reference)))
                    .Where(x => x.DocumentNumber.StartsWith("IN"))
                    .Select(x => x.DocumentNumber).Distinct().Take(5).ToListAsync();
                if (byRef.Count > 0) { ranked.AddRange(byRef); how = "order"; }
            }
            if (ranked.Count == 0 && a.AmountDue is decimal due && due > 0)
            {
                var since = DateTime.UtcNow.AddYears(-3);
                var ex = Math.Round(due / 1.15m, 2);
                var byAmt = await _db.ImportedInvoices.AsNoTracking()
                    .Where(i => i.TransactionDate >= since && i.TransactionNumber.StartsWith("IN"))
                    .GroupBy(i => new { i.TransactionNumber, i.SourceCompany })
                    .Select(g => new { g.Key.TransactionNumber, g.Key.SourceCompany, total = g.Sum(x => x.SalesAmount), cust = g.Max(x => x.CustomerNumber), date = g.Min(x => x.TransactionDate) })
                    .Where(g => (g.total >= ex - 0.06m && g.total <= ex + 0.06m) || (g.total >= due - 0.06m && g.total <= due + 0.06m))
                    .OrderByDescending(g => g.date).Take(12).ToListAsync();
                if (a.CustomerNumber != null && byAmt.Any(x => x.cust == a.CustomerNumber)) byAmt = byAmt.Where(x => x.cust == a.CustomerNumber).ToList();
                var co = GuessCompanyFromText(string.Join("\n", pageTexts));
                if (co != null && byAmt.Any(x => x.SourceCompany == co)) byAmt = byAmt.Where(x => x.SourceCompany == co).ToList();
                if (byAmt.Count is > 0 and <= 5) { ranked.AddRange(byAmt.Select(x => x.TransactionNumber).Distinct()); how = "amount"; }
            }
        }
        var sageHits = ranked.Count == 0 ? new List<string>()
            : await _db.ImportedInvoices.AsNoTracking().Where(i => ranked.Contains(i.TransactionNumber)).Select(i => i.TransactionNumber).Distinct().ToListAsync();
        var best = ranked.FirstOrDefault(c => sageHits.Contains(c)) ?? ranked.FirstOrDefault();

        var company = GuessCompanyFromText(string.Join("\n", pageTexts));
        var sage = best != null ? await SageLookupAsync(best, company) : null;
        var existing = best == null ? new() : await _db.InvoicePacks.AsNoTracking().Where(p => p.InvoiceNumber == best).Select(p => new { p.Id, p.PackNumber, p.UploadedAt }).ToListAsync();

        return new
        {
            method, pages = a.Pages.Count,
            invoiceNumber = best, candidates = ranked, sageMatches = sageHits, invoiceSource = how, amountDue = a.AmountDue,
            orderNumber = a.OrderNumber, confirmationNumber = a.ConfirmationNumber, customerNumber = a.CustomerNumber, company = company ?? sage?.company,
            sage, existingPacks = existing,
            ocrAvailable = ServerOcrService.IsAvailable,
            analysis = a,
            // Trimmed per-page text so the dialog can hand it to "Ask Welly" without a second OCR run.
            pageTexts = pageTexts.Select(t => t.Length > 4000 ? t[..4000] : t).ToList(),
        };
    }

    public class AskWellyRequest
    {
        public int? PackId { get; set; }
        public List<string>? PageTexts { get; set; }
        public PackAnalyzer.Result? Analysis { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Question { get; set; }
    }

    /// <summary>
    /// Hand the OCR text + rule results to Welly and ask it to work out what the pack checks missed:
    /// which page is which, the invoice / order / confirmation numbers, and what the clerk should verify.
    /// Uses the same provider order as the chat (local LLM → Claude → rule-based summary).
    /// </summary>
    [HttpPost("ask-welly")]
    public async Task<IActionResult> AskWelly([FromBody] AskWellyRequest req, [FromServices] ServerOcrService ocr,
        [FromServices] ILocalLlmService localLlm, [FromServices] IClaudeAIService claude, [FromServices] IConfiguration cfg, CancellationToken ct)
    {
        var pages = req.PageTexts ?? new List<string>();
        var analysis = req.Analysis;
        if (pages.Count == 0 && req.PackId is int id)
        {
            var p = await _db.InvoicePacks.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (p == null) return NotFound();
            var full = FullPath(p.StoragePath);
            if (!System.IO.File.Exists(full)) return NotFound(new { error = "Pack file is missing on the server." });
            (pages, _) = await PageTextsAsync(full, p.ContentType, ocr);
            analysis ??= PackAnalyzer.Result.FromJson(p.ValidationJson);
        }
        if (pages.Count == 0) return BadRequest(new { error = "Nothing to review — no page text was supplied." });
        analysis ??= PackAnalyzer.Analyze(pages);

        var sb = new StringBuilder();
        sb.AppendLine("You are Welly, the finance assistant. A clerk scanned an invoice pack (delivery note, tax invoice, order confirmation, customer order e-mail, official order form). Our automatic checker read the pages below with OCR and produced the result that follows. The OCR is noisy: 0/O, 1/I/L, 5/S, 8/B are often swapped, spaces disappear in headers, and logos are not read.");
        sb.AppendLine("Number formats: invoice IN + 6 digits (e.g. IN024737); customer order OR + 6 digits, written OR000190 or OR-000190; Sage order confirmation ORD + 6 digits; customer number like 01-UCR-001.");
        sb.AppendLine();
        sb.AppendLine("=== CHECKER RESULT ===");
        sb.AppendLine($"Status: {analysis.Status}. Invoice: {analysis.InvoiceNumber ?? "not read"}. Order: {analysis.OrderNumber ?? "not read"}. Confirmation: {analysis.ConfirmationNumber ?? "not read"}. Customer: {analysis.CustomerNumber ?? "not read"}.");
        foreach (var r in analysis.Rules) sb.AppendLine($"{r.Code} {(r.Pass ? "PASS" : "FAIL")}: {r.Title} — {r.Detail}");
        foreach (var w in analysis.Warnings) sb.AppendLine("Warning: " + w);
        sb.AppendLine("Pages: " + string.Join("; ", analysis.Pages.Select(p => $"p{p.Page}={p.Type}")));
        if (!string.IsNullOrWhiteSpace(req.InvoiceNumber)) sb.AppendLine($"The clerk typed invoice number: {req.InvoiceNumber}.");
        sb.AppendLine();
        sb.AppendLine("=== OCR TEXT ===");
        for (var i = 0; i < pages.Count; i++)
        {
            var t = Regex.Replace(pages[i] ?? "", @"[ \t]+", " ").Trim();
            if (t.Length > 1800) t = t[..1800] + " …";
            sb.AppendLine($"--- Page {i + 1} ---");
            sb.AppendLine(t.Length == 0 ? "(no text read)" : t);
        }
        sb.AppendLine();
        sb.AppendLine("=== TASK ===");
        sb.AppendLine(string.IsNullOrWhiteSpace(req.Question)
            ? "In plain English, for a finance clerk, in under 180 words: (1) say which page is which document type, correcting the checker where it is wrong; (2) give the invoice number, customer order number and order confirmation number you can read, flagging any you are unsure of; (3) explain each failed check and whether it is a real problem or an OCR miss; (4) list what the clerk should confirm on the paper copy before saving. Use short bullet points."
            : req.Question);

        var prompt = sb.ToString();
        string? answer = null; string provider = "rules";
        try
        {
            if (cfg.GetValue<bool>("LocalLlm:Enabled", true) && await localLlm.IsAvailableAsync())
            { answer = await localLlm.AnalyzeDocumentAsync("You are Welly, the finance assistant. Answer concisely in plain English with short bullet points.", prompt, ct); provider = "local-llm"; }
            else if (cfg.GetValue<bool>("Claude:Enabled", false) && await claude.IsAvailableAsync())
            { answer = await claude.ChatAsync(prompt, ct); provider = "claude"; }
        }
        catch (Exception ex) { _log.LogWarning(ex, "Ask Welly (packs) LLM call failed"); answer = null; }

        if (string.IsNullOrWhiteSpace(answer))
        {
            // No model available — give a structured plain-text summary of what the checker saw.
            var o = new StringBuilder();
            o.AppendLine("Welly's model is offline, so here is what the checker could read:");
            foreach (var p in analysis.Pages)
                o.AppendLine($"• Page {p.Page}: {(p.Type == "UNK" ? "not recognised" : PackAnalyzer.TypeNames[p.Type])}" +
                    (p.InvoiceNumber != null ? $", invoice {p.InvoiceNumber}" : "") + (p.OrderNumber != null ? $", order {p.OrderNumber}" : "") + (p.ConfirmationNumber != null ? $", confirmation {p.ConfirmationNumber}" : "") +
                    (p.TextLength < 40 ? " — almost no text read (faint or image-only page)" : ""));
            foreach (var r in analysis.Rules.Where(r => !r.Pass)) o.AppendLine($"• {r.Code} failed: {r.Detail}");
            o.AppendLine("Please confirm the invoice and order numbers against the paper copy before saving.");
            answer = o.ToString();
        }

        return Ok(new { answer = answer.Trim(), provider, invoiceNumber = analysis.InvoiceNumber, orderNumber = analysis.OrderNumber, confirmationNumber = analysis.ConfirmationNumber });
    }

    /// <summary>
    /// Read the uploaded scan page by page: classify each page (delivery note / tax invoice / order
    /// confirmation / order e-mail / official order), pull the invoice, order and confirmation numbers,
    /// and run the pack rules. The user always confirms the invoice number before the pack is saved.
    /// </summary>
    [HttpPost("detect")]
    [RequestSizeLimit(60_000_000)]
    public async Task<IActionResult> Detect([FromForm] IFormFile file, [FromServices] ServerOcrService ocr)
    {
        if (file == null || file.Length == 0) return BadRequest(new { error = "No file." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var tmp = Path.Combine(Path.GetTempPath(), $"pack_{Guid.NewGuid():N}{ext}");
        try
        {
            await using (var fs = System.IO.File.Create(tmp)) await file.CopyToAsync(fs);
            var (pages, method) = await PageTextsAsync(tmp, file.ContentType, ocr);
            var analysis = PackAnalyzer.Analyze(pages);
            return Ok(await BuildDetectResponseAsync(analysis, method, file.FileName, pages));
        }
        finally { try { System.IO.File.Delete(tmp); } catch { } }
    }

    /// <summary>Re-run the page classification + rules on a stored pack (e.g. after OCR is installed).</summary>
    [HttpPost("{id:int}/reanalyse")]
    public async Task<IActionResult> Reanalyse(int id, [FromServices] ServerOcrService ocr)
    {
        var p = await _db.InvoicePacks.Include(x => x.Files).FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound();
        var full = FullPath(p.StoragePath);
        if (!System.IO.File.Exists(full)) return NotFound(new { error = "Pack file is missing on the server." });
        var (pages, _) = await PageTextsAsync(full, p.ContentType, ocr);
        ApplyAnalysis(p, PackAnalyzer.Analyze(pages));
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(Dto(p));
    }

    private static void ApplyAnalysis(InvoicePack p, PackAnalyzer.Result a, bool respectUserChecklist = false)
    {
        p.ValidationStatus = a.Status;
        p.ValidationJson = a.ToJson();
        p.ProofOfDelivery = a.ProofOfDelivery;
        p.PartDelivery = a.PartDelivery;
        p.AmendedOrder = a.Amended;
        p.ConfirmationNumber ??= a.ConfirmationNumber;
        p.OrderNumber ??= a.OrderNumber;
        p.CustomerNumber ??= a.CustomerNumber;
        // The contents checklist follows what the analyser saw — unless the user ticked it themselves
        // (they can see the paper; the OCR can't) or the pack is unreadable.
        if (a.Status != "UNKNOWN" && !respectUserChecklist)
        {
            p.HasDeliveryNote = a.TypesFound.Contains("DN");
            p.HasTaxInvoice = a.TypesFound.Contains("INV");
            p.HasOrderConfirmation = a.TypesFound.Contains("OC");
            p.HasOrderEmail = a.TypesFound.Contains("EML");
            p.HasOrderForm = a.TypesFound.Contains("PO");
            p.Status = Status(p);
        }
    }

    // ───────────────────────── write ─────────────────────────

    public class UploadForm
    {
        public IFormFile File { get; set; } = null!;
        public string InvoiceNumber { get; set; } = "";
        public string? OrderNumber { get; set; }
        public string? CustomerNumber { get; set; }
        public string? CustomerName { get; set; }
        public string? Company { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public decimal? InvoiceTotal { get; set; }
        public string? Notes { get; set; }
        public bool InvoiceVerified { get; set; }
        public bool HasDeliveryNote { get; set; } = true;
        public bool HasTaxInvoice { get; set; } = true;
        public bool HasOrderConfirmation { get; set; } = true;
        public bool HasOrderEmail { get; set; } = true;
        public bool HasOrderForm { get; set; } = true;
        public bool AllowDuplicate { get; set; }
        public string? ConfirmationNumber { get; set; }
        /// <summary>PackAnalyzer.Result JSON from the detect step (optional).</summary>
        public string? AnalysisJson { get; set; }
    }

    /// <summary>Upload one scanned PDF (or image) that is the whole pack.</summary>
    [HttpPost("upload")]
    [RequestSizeLimit(60_000_000)]
    public async Task<IActionResult> Upload([FromForm] UploadForm form, [FromServices] ServerOcrService ocr)
    {
        if (form.File == null || form.File.Length == 0) return BadRequest(new { error = "No file." });
        var ext = Path.GetExtension(form.File.FileName).ToLowerInvariant();
        if (ext is not (".pdf" or ".jpg" or ".jpeg" or ".png")) return BadRequest(new { error = "Only PDF, JPG or PNG files are accepted." });
        var inv = NormalizeInvoice(form.InvoiceNumber);
        if (inv == null) return BadRequest(new { error = "Enter a valid invoice number (IN followed by 5–7 digits)." });
        if (!form.InvoiceVerified) return BadRequest(new { error = "Please confirm the invoice number matches the document." });

        if (!form.AllowDuplicate && await _db.InvoicePacks.AnyAsync(p => p.InvoiceNumber == inv))
            return Conflict(new { error = $"A pack already exists for {inv}. Open it, or tick 'Add anyway' to store a second copy." });

        var (full, rel) = NewStoragePath(inv, ext);
        await using (var fs = System.IO.File.Create(full)) await form.File.CopyToAsync(fs);

        var p = await BuildPackAsync(form, inv, full, rel, form.File, "Scanned");
        if (!string.IsNullOrWhiteSpace(form.AnalysisJson))
        {
            // The uploader already ran detect; reuse its result rather than OCR-ing twice.
            var a = PackAnalyzer.Result.FromJson(form.AnalysisJson);
            if (a != null) ApplyAnalysis(p, a, respectUserChecklist: true);
        }
        else
        {
            try { var (pages, _) = await PageTextsAsync(full, form.File.ContentType, ocr); ApplyAnalysis(p, PackAnalyzer.Analyze(pages), respectUserChecklist: true); }
            catch (Exception ex) { _log.LogWarning(ex, "Pack analysis failed for {Inv}", inv); }
        }
        _db.InvoicePacks.Add(p);
        await _db.SaveChangesAsync();
        p.PackNumber = $"PK{p.Id:D6}";
        await _db.SaveChangesAsync();
        return Ok(new { pack = Dto(p) });
    }

    public class AssembleForm : UploadForm
    {
        public new IFormFile? File { get; set; }
        /// <summary>Parallel to Files: kind per file.</summary>
        public List<string> Kinds { get; set; } = new();
        public List<IFormFile> Files { get; set; } = new();
    }

    /// <summary>
    /// Build a pack from separate component files (PDF/JPG/PNG), in the order given. Each component is kept
    /// and a merged PDF is produced as the pack file. Later this is where intranet-held documents get pulled in.
    /// </summary>
    [HttpPost("assemble")]
    [RequestSizeLimit(120_000_000)]
    public async Task<IActionResult> Assemble([FromForm] AssembleForm form, [FromServices] ServerOcrService ocr)
    {
        if (form.Files.Count == 0) return BadRequest(new { error = "Add at least one document." });
        var inv = NormalizeInvoice(form.InvoiceNumber);
        if (inv == null) return BadRequest(new { error = "Enter a valid invoice number (IN followed by 5–7 digits)." });
        if (!form.InvoiceVerified) return BadRequest(new { error = "Please confirm the invoice number." });
        if (!form.AllowDuplicate && await _db.InvoicePacks.AnyAsync(p => p.InvoiceNumber == inv))
            return Conflict(new { error = $"A pack already exists for {inv}." });

        var comps = new List<InvoicePackFile>();
        var sources = new List<(string full, string ext)>();
        for (var i = 0; i < form.Files.Count; i++)
        {
            var f = form.Files[i];
            var ext = Path.GetExtension(f.FileName).ToLowerInvariant();
            if (ext is not (".pdf" or ".jpg" or ".jpeg" or ".png")) return BadRequest(new { error = $"{f.FileName}: only PDF, JPG or PNG." });
            var kind = i < form.Kinds.Count && Kinds.Contains(form.Kinds[i]) ? form.Kinds[i] : "Other";
            var (full, rel) = NewStoragePath(inv, ext, "parts");
            await using (var fs = System.IO.File.Create(full)) await f.CopyToAsync(fs);
            sources.Add((full, ext));
            comps.Add(new InvoicePackFile { Kind = kind, SortOrder = i, FileName = Path.GetFileName(full), OriginalFileName = Path.GetFileName(f.FileName), ContentType = f.ContentType, Size = f.Length, StoragePath = rel });
        }

        var (mergedFull, mergedRel) = NewStoragePath(inv, ".pdf");
        var pages = MergeToPdf(sources, mergedFull);
        var fi = new FileInfo(mergedFull);

        // Contents flags derive from the components actually supplied.
        form.HasDeliveryNote = comps.Any(c => c.Kind == "DeliveryNote");
        form.HasTaxInvoice = comps.Any(c => c.Kind == "TaxInvoice");
        form.HasOrderConfirmation = comps.Any(c => c.Kind == "OrderConfirmation");
        form.HasOrderEmail = comps.Any(c => c.Kind == "OrderEmail");
        form.HasOrderForm = comps.Any(c => c.Kind == "OrderForm");

        var p = await BuildPackAsync(form, inv, mergedFull, mergedRel, null, "Assembled");
        p.OriginalFileName = $"{inv}-pack.pdf"; p.ContentType = "application/pdf"; p.Size = fi.Length; p.PageCount = pages;
        foreach (var c in comps) p.Files.Add(c);
        try { var (texts, _) = await PageTextsAsync(mergedFull, "application/pdf", ocr); ApplyAnalysis(p, PackAnalyzer.Analyze(texts), respectUserChecklist: true); }
        catch (Exception ex) { _log.LogWarning(ex, "Pack analysis failed for {Inv}", inv); }
        _db.InvoicePacks.Add(p);
        await _db.SaveChangesAsync();
        p.PackNumber = $"PK{p.Id:D6}";
        await _db.SaveChangesAsync();
        return Ok(new { pack = Dto(p) });
    }

    private async Task<InvoicePack> BuildPackAsync(UploadForm form, string inv, string full, string rel, IFormFile? file, string source)
    {
        var sage = await SageLookupAsync(inv, form.Company);
        var p = new InvoicePack
        {
            InvoiceNumber = inv,
            OrderNumber = Trunc(form.OrderNumber, 100) ?? sage?.orderNumber,
            CustomerNumber = Trunc(form.CustomerNumber, 50) ?? sage?.customerNumber,
            CustomerName = Trunc(form.CustomerName, 255) ?? sage?.customerName,
            Company = CompanyCode(form.Company) ?? sage?.company,
            InvoiceDate = form.InvoiceDate ?? sage?.date,
            InvoiceTotal = form.InvoiceTotal ?? sage?.total,
            Source = source,
            HasDeliveryNote = form.HasDeliveryNote, HasTaxInvoice = form.HasTaxInvoice, HasOrderConfirmation = form.HasOrderConfirmation,
            HasOrderEmail = form.HasOrderEmail, HasOrderForm = form.HasOrderForm,
            InvoiceVerified = form.InvoiceVerified,
            InSage = sage != null,
            Notes = Trunc(form.Notes, 1000),
            ConfirmationNumber = Trunc(form.ConfirmationNumber, 50),
            FileName = Path.GetFileName(full),
            OriginalFileName = file != null ? Path.GetFileName(file.FileName) : null,
            ContentType = file?.ContentType ?? "application/pdf",
            Size = file?.Length ?? 0,
            StoragePath = rel,
            PageCount = full.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ? PdfPages(full) : 1,
            UploadedBy = UserId, UploadedByName = UserName,
        };
        p.Status = Status(p);
        return p;
    }

    private static string? Trunc(string? s, int n) => string.IsNullOrWhiteSpace(s) ? null : (s.Trim().Length > n ? s.Trim()[..n] : s.Trim());

    /// <summary>Merge PDFs and images into one PDF (images become one A4 page each, scaled to fit).</summary>
    private static int MergeToPdf(List<(string full, string ext)> sources, string outPath)
    {
        using var writer = new PdfWriter(outPath);
        using var dest = new PdfDocument(writer);
        var merger = new PdfMerger(dest);
        var total = 0;
        foreach (var (full, ext) in sources)
        {
            if (ext == ".pdf")
            {
                using var src = new PdfDocument(new PdfReader(full));
                var n = src.GetNumberOfPages();
                merger.Merge(src, 1, n);
                total += n;
            }
            else
            {
                // Render the image into a temporary single-page PDF, then merge it so page numbering stays consistent.
                using var ms = new MemoryStream();
                using (var w = new PdfWriter(ms)) using (var tmpPdf = new PdfDocument(w))
                {
                    var page = iText.Kernel.Geom.PageSize.A4;
                    tmpPdf.SetDefaultPageSize(page);
                    using var doc = new Document(tmpPdf, page, false);
                    doc.SetMargins(18, 18, 18, 18);
                    var img = new Image(ImageDataFactory.Create(full));
                    img.SetAutoScale(true);
                    doc.Add(img);
                }
                using var src = new PdfDocument(new PdfReader(new MemoryStream(ms.ToArray())));
                merger.Merge(src, 1, src.GetNumberOfPages());
                total += src.GetNumberOfPages();
            }
        }
        return total;
    }

    public class UpdateDto
    {
        public string? InvoiceNumber { get; set; }
        public string? OrderNumber { get; set; }
        public string? CustomerNumber { get; set; }
        public string? CustomerName { get; set; }
        public string? Company { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public decimal? InvoiceTotal { get; set; }
        public string? Notes { get; set; }
        public bool? HasDeliveryNote { get; set; }
        public bool? HasTaxInvoice { get; set; }
        public bool? HasOrderConfirmation { get; set; }
        public bool? HasOrderEmail { get; set; }
        public bool? HasOrderForm { get; set; }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateDto dto)
    {
        var p = await _db.InvoicePacks.FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound();
        if (dto.InvoiceNumber != null)
        {
            var inv = NormalizeInvoice(dto.InvoiceNumber);
            if (inv == null) return BadRequest(new { error = "Invalid invoice number." });
            if (inv != p.InvoiceNumber)
            {
                p.InvoiceNumber = inv; p.InvoiceVerified = true;
                var sage = await SageLookupAsync(inv, dto.Company ?? p.Company);
                p.InSage = sage != null;
                if (sage != null)
                {
                    p.CustomerNumber ??= sage.customerNumber; p.CustomerName ??= sage.customerName;
                    p.Company ??= sage.company; p.InvoiceDate ??= sage.date; p.InvoiceTotal ??= sage.total;
                }
            }
        }
        if (dto.OrderNumber != null) p.OrderNumber = Trunc(dto.OrderNumber, 100);
        if (dto.CustomerNumber != null) p.CustomerNumber = Trunc(dto.CustomerNumber, 50);
        if (dto.CustomerName != null) p.CustomerName = Trunc(dto.CustomerName, 255);
        if (dto.Company != null) p.Company = CompanyCode(dto.Company);
        if (dto.InvoiceDate.HasValue) p.InvoiceDate = dto.InvoiceDate;
        if (dto.InvoiceTotal.HasValue) p.InvoiceTotal = dto.InvoiceTotal;
        if (dto.Notes != null) p.Notes = Trunc(dto.Notes, 1000);
        if (dto.HasDeliveryNote.HasValue) p.HasDeliveryNote = dto.HasDeliveryNote.Value;
        if (dto.HasTaxInvoice.HasValue) p.HasTaxInvoice = dto.HasTaxInvoice.Value;
        if (dto.HasOrderConfirmation.HasValue) p.HasOrderConfirmation = dto.HasOrderConfirmation.Value;
        if (dto.HasOrderEmail.HasValue) p.HasOrderEmail = dto.HasOrderEmail.Value;
        if (dto.HasOrderForm.HasValue) p.HasOrderForm = dto.HasOrderForm.Value;
        p.Status = Status(p);
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(Dto(p));
    }

    [HttpDelete("{id:int}")]
    [RequireModule("finance", AlsoAllowRoles = "Finance,Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await _db.InvoicePacks.Include(x => x.Files).FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound();
        foreach (var rel in p.Files.Select(f => f.StoragePath).Append(p.StoragePath))
        {
            try { var full = FullPath(rel); if (System.IO.File.Exists(full)) System.IO.File.Delete(full); }
            catch (Exception ex) { _log.LogWarning(ex, "Could not delete pack file {Path}", rel); }
        }
        _db.InvoicePacks.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
