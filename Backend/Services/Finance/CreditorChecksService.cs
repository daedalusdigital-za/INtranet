using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance.Creditors;

namespace ProjectTracker.API.Services.Finance;

/// <summary>
/// Reads text off creditor documents, suggests a document type, and runs the automatic
/// checks on a payment batch (required documents, bank letter age, account match,
/// duplicates, VAT number, invoice vs PO/GRV, changed bank details…).
/// Hard failures send the batch back to the preparer; soft findings go to the accountant.
/// </summary>
public class CreditorChecksService
{
    private readonly ApplicationDbContext _db;
    private readonly ServerOcrService _ocr;
    private readonly ILogger<CreditorChecksService> _log;

    public CreditorChecksService(ApplicationDbContext db, ServerOcrService ocr, ILogger<CreditorChecksService> log)
    { _db = db; _ocr = ocr; _log = log; }

    // ───────────────────────── result shapes ─────────────────────────

    public sealed class Finding
    {
        public string Code { get; set; } = "";
        public string Title { get; set; } = "";
        /// <summary>FAIL (blocks submit) | REVIEW (accountant must look) | PASS</summary>
        public string Severity { get; set; } = "PASS";
        public string Detail { get; set; } = "";
        public int? ItemId { get; set; }
        public string? Supplier { get; set; }
        public string? DocType { get; set; }
    }

    public sealed class Result
    {
        public string Status { get; set; } = "PASS";
        public DateTime RanAt { get; set; } = DateTime.UtcNow;
        public int Fail { get; set; }
        public int Review { get; set; }
        public int Pass { get; set; }
        public List<Finding> Findings { get; set; } = new();
    }

    // ───────────────────────── document reading ─────────────────────────

    private static readonly Regex AccountRx = new(@"(?:ACC(?:OUNT)?|A/C)\s*(?:NO|NUMBER|#|\.)?\s*[:.\-]?\s*(\d[\d\s\-]{6,20}\d)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex VatRx = new(@"VAT\s*(?:REG(?:ISTRATION)?)?\s*(?:NO|NUMBER|#)?\s*[:.\-]?\s*(4\d{9})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex InvoiceRx = new(@"(?:TAX\s+)?INV(?:OICE)?\s*(?:NO|NUMBER|#)?\s*[:.\-]?\s*([A-Z]{0,4}[\-/]?\d{3,10})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex TotalRx = new(@"(?:TOTAL(?:\s+DUE|\s+INCL(?:\.|USIVE)?(?:\s+VAT)?|\s+AMOUNT)?|AMOUNT\s+DUE|GRAND\s+TOTAL)\s*[:\-]?\s*R?\s*([\d\s]{1,12}[.,]\d{2})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex DateRx = new(@"\b(\d{1,2})[\s/\-\.]([A-Za-z]{3,9}|\d{1,2})[\s/\-\.](20\d{2})\b|\b(20\d{2})[\-/](\d{2})[\-/](\d{2})\b", RegexOptions.Compiled);
    // "VAT @ 15%  R 1 234.56" / "VAT 15% : 1,234.56" / "Total VAT 1234.56" — but never the registration number ("VAT NO 4xxxxxxxxx")
    private static readonly Regex VatAmountRx = new(@"(?:TOTAL\s+)?VAT(?!\s*(?:REG|NO|NUMBER|#))\s*(?:@|AT)?\s*(?:15\s*%)?\s*[:\-]?\s*R?\s*([\d\s]{1,12}[.,]\d{2})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public sealed class Extracted
    {
        public string Text { get; set; } = "";
        public string Method { get; set; } = "none";
        public int Pages { get; set; }
        public bool Encrypted { get; set; }
        public string? SuggestedType { get; set; }
        public DateTime? DocumentDate { get; set; }
        public string? AccountNumber { get; set; }
        public string? VatNumber { get; set; }
        public string? InvoiceNumber { get; set; }
        public decimal? Amount { get; set; }
        public decimal? VatAmount { get; set; }
        /// <summary>Best guess at who issued the document (first meaningful line); callers may override with a known-supplier match.</summary>
        public string? SupplierName { get; set; }
    }

    public async Task<Extracted> ReadAsync(string absolutePath, string? contentType, string fileName)
    {
        var ex = new Extracted();
        try
        {
            using var reader = new PdfReader(absolutePath);
            using var pdf = new PdfDocument(reader);
            ex.Pages = pdf.GetNumberOfPages();
            var sb = new StringBuilder();
            for (var i = 1; i <= Math.Min(ex.Pages, 25); i++)
                sb.AppendLine(PdfTextExtractor.GetTextFromPage(pdf.GetPage(i)));
            ex.Text = sb.ToString();
            if (ex.Text.Trim().Length > 40) ex.Method = "itext";
        }
        catch (iText.Kernel.Exceptions.BadPasswordException) { ex.Encrypted = true; return ex; }
        catch (Exception e) when (e.Message.Contains("password", StringComparison.OrdinalIgnoreCase)) { ex.Encrypted = true; return ex; }
        catch (Exception e) { _log.LogDebug(e, "iText read failed for {File}", fileName); }

        if (ex.Method == "none")
        {
            try
            {
                var pages = await _ocr.ExtractPageTextsAsync(absolutePath, contentType, 15);
                ex.Text = string.Join("\n", pages);
                if (ex.Text.Trim().Length > 0) ex.Method = "ocr";
                if (ex.Pages == 0) ex.Pages = pages.Count;
            }
            catch (Exception e) { _log.LogDebug(e, "OCR failed for {File}", fileName); }
        }

        if (ex.Text.Length > 60_000) ex.Text = ex.Text[..60_000];
        var t = ex.Text;
        ex.SuggestedType = SuggestType(fileName, t);
        ex.AccountNumber = Digits(AccountRx.Match(t).Groups[1].Value);
        ex.VatNumber = VatRx.Match(t) is { Success: true } vm ? vm.Groups[1].Value : null;
        ex.InvoiceNumber = InvoiceRx.Match(t) is { Success: true } im ? im.Groups[1].Value.ToUpperInvariant() : null;
        ex.Amount = ParseAmount(TotalRx.Match(t).Groups[1].Value);
        ex.VatAmount = ParseAmount(VatAmountRx.Match(t).Groups[1].Value);
        if (ex.VatAmount != null && ex.Amount != null && ex.VatAmount >= ex.Amount) ex.VatAmount = null; // misread
        ex.SupplierName = GuessSupplier(t);
        ex.DocumentDate = ParseDate(t);
        return ex;
    }

    private static readonly string[] NotASupplier = { "TAX INVOICE", "INVOICE", "STATEMENT", "QUOTATION", "QUOTE", "PROFORMA", "PAGE", "DATE", "ORIGINAL", "COPY", "CUSTOMER", "BILL TO", "DELIVER TO", "VAT", "TEL", "FAX", "EMAIL", "WWW", "P.O", "PO BOX", "REG" };

    /// <summary>The first line near the top that looks like a trading name (letters, not a document heading, not an address/contact line).</summary>
    public static string? GuessSupplier(string text)
    {
        foreach (var raw in (text ?? "").Split('\n').Take(25))
        {
            var line = Regex.Replace(raw, @"\s+", " ").Trim();
            if (line.Length < 3 || line.Length > 60) continue;
            if (!Regex.IsMatch(line, @"[A-Za-z]{3}")) continue;
            if (Regex.IsMatch(line, @"\d{5,}")) continue; // phone / reg / account numbers
            if (line.Contains('@') || line.Contains("http", StringComparison.OrdinalIgnoreCase)) continue;
            var up = line.ToUpperInvariant();
            if (NotASupplier.Any(w => up.StartsWith(w) || up == w)) continue;
            return line;
        }
        return null;
    }

    public static string SuggestType(string fileName, string text)
    {
        var f = (fileName ?? "").ToUpperInvariant();
        var t = (text ?? "").ToUpperInvariant();
        bool Has(params string[] words) => words.Any(w => f.Contains(w) || t.Contains(w));

        if (Has("PROOF OF PAYMENT", "PAYMENT NOTIFICATION", "PAYMENT CONFIRMATION", " POP")) return CreditorDocTypes.ProofOfPayment;
        if (Has("BANK CONFIRMATION", "CONFIRMATION OF BANK", "ACCOUNT VERIFICATION", "BANK LETTER", "AVS")) return CreditorDocTypes.BankLetter;
        if (Has("PAYMENT SCHEDULE", "PAYMENT_SCHEDULE", "SCHEDULE OF PAYMENTS")) return CreditorDocTypes.PaymentSchedule;
        if (Has("CREDITORS RECON", "RECONCILIATION", "RECON")) return CreditorDocTypes.CreditorsRecon;
        if (Has("AGED PAYABLES", "A/P AGED", "AP AGED", "SAGE 300", "PAYABLES BATCH")) return CreditorDocTypes.SageAgedPayables;
        if (Has("CREDIT NOTE SUMMARY", "CREDIT NOTE REQUEST", "CREDIT NOTE")) return CreditorDocTypes.CreditNoteForm;
        if (Has("RETURN GRV", "GOODS RETURNED", "RETURNS NOTE")) return CreditorDocTypes.WarehouseReturnGrv;
        if (Has("COLLECTION SLIP", "COLLECTED BY")) return CreditorDocTypes.CustomerCollectionSlip;
        if (Has("STATEMENT OF ACCOUNT", "STATEMENT")) return CreditorDocTypes.SupplierStatement;
        if (Has("PURCHASE ORDER", "P/O NUMBER", "PO NUMBER", "ORDER NO")) return CreditorDocTypes.PurchaseOrder;
        if (Has("GOODS RECEIVED", "GRV", "DELIVERY NOTE", "PROOF OF DELIVERY", "RECEIVED IN GOOD ORDER")) return CreditorDocTypes.Grv;
        if (Has("QUOTATION", "QUOTE")) return CreditorDocTypes.Quote;
        if (Has("REQUISITION", "PAYMENT REQUEST")) return CreditorDocTypes.Requisition;
        if (Has("TAX INVOICE", "INVOICE")) return CreditorDocTypes.TaxInvoice;
        if (Has("INSTRUCTION", "PLEASE SETTLE", "KINDLY SETTLE")) return CreditorDocTypes.WrittenInstruction;
        if (Has("JOB CARD", "FITMENT", "CHECKLIST", "PHOTO")) return CreditorDocTypes.ProofOfWork;
        return CreditorDocTypes.Other;
    }

    private static string? Digits(string s) { var d = Regex.Replace(s ?? "", @"\D", ""); return d.Length >= 7 ? d : null; }

    private static decimal? ParseAmount(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var clean = s.Replace(" ", "").Replace(",", ".");
        var lastDot = clean.LastIndexOf('.');
        if (lastDot > 0) clean = clean[..lastDot].Replace(".", "") + clean[lastDot..];
        return decimal.TryParse(clean, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : null;
    }

    private static DateTime? ParseDate(string text)
    {
        DateTime? best = null;
        foreach (Match m in DateRx.Matches(text))
        {
            DateTime d;
            if (m.Groups[4].Success)
            {
                if (!DateTime.TryParseExact($"{m.Groups[4].Value}-{m.Groups[5].Value}-{m.Groups[6].Value}", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d)) continue;
            }
            else
            {
                var raw = $"{m.Groups[1].Value} {m.Groups[2].Value} {m.Groups[3].Value}";
                var fmts = new[] { "d M yyyy", "d MMM yyyy", "d MMMM yyyy", "dd MM yyyy" };
                if (!DateTime.TryParseExact(raw, fmts, CultureInfo.InvariantCulture, DateTimeStyles.None, out d)) continue;
            }
            if (d > DateTime.UtcNow.AddDays(1) || d < DateTime.UtcNow.AddYears(-5)) continue;
            if (best == null || d > best) best = d; // the most recent sensible date on the page
        }
        return best;
    }

    // ───────────────────────── the checks ─────────────────────────

    public async Task<Result> RunAsync(PaymentBatch batch)
    {
        var r = new Result();
        var items = batch.Items.OrderBy(i => i.SortOrder).ToList();
        var docs = batch.Documents.ToList();
        var closingPrepayment = CreditorWorkflow.Locked.Contains(batch.Status);

        void Add(string code, string title, string sev, string detail, PaymentBatchItem? item = null, string? docType = null)
            => r.Findings.Add(new Finding { Code = code, Title = title, Severity = sev, Detail = detail, ItemId = item?.Id, Supplier = item?.SupplierName, DocType = docType });

        // C0 — schedule has payments
        if (items.Count == 0) Add("C0", "Payment schedule", "FAIL", "The batch has no payments on it.");
        if (items.Any(i => i.Amount <= 0)) Add("C0", "Payment schedule", "FAIL", "Every payment needs an amount greater than zero.");

        // C1 — required documents (batch level and per payment)
        foreach (var dt in CreditorDocRules.RequiredForBatch(batch.PaymentType))
            if (!docs.Any(d => d.DocType == dt && d.ItemId == null && (d.IsNotApplicable || d.StoragePath != null)))
                Add("C1", "Required document missing", "FAIL", $"{Label(dt)} is required for a {Label(batch.PaymentType)} batch.", null, dt);

        foreach (var it in items)
            foreach (var dt in CreditorDocRules.RequiredForItem(batch.PaymentType, it.StockReturned, closingPrepayment))
                if (!docs.Any(d => d.DocType == dt && d.ItemId == it.Id && (d.IsNotApplicable || d.StoragePath != null)))
                    Add("C1", "Required document missing", "FAIL", $"{Label(dt)} is missing for {it.SupplierName}.", it, dt);

        // C1b — credit note rule: stock back but no warehouse GRV ⇒ no credit note (already FAIL via matrix; spell it out)
        if (batch.PaymentType == CreditorPaymentTypes.CreditNote)
            foreach (var it in items.Where(i => i.StockReturned))
                if (!docs.Any(d => d.ItemId == it.Id && d.DocType == CreditorDocTypes.WarehouseReturnGrv && d.StoragePath != null))
                    Add("C10", "No warehouse GRV, no credit note", "FAIL", $"Stock came back for {it.SupplierName} but the warehouse return GRV has not been uploaded.", it, CreditorDocTypes.WarehouseReturnGrv);

        // C8 — unreadable / encrypted / non-PDF
        foreach (var d in docs.Where(d => d.StoragePath != null))
        {
            if (d.TextMethod == "none")
                Add("C8", "Document could not be read", "REVIEW", $"{Label(d.DocType)} '{d.OriginalFileName}' has no readable text (poor scan?). The checks below could not look at it.", items.FirstOrDefault(i => i.Id == d.ItemId), d.DocType);
            if (d.PageCount == 0 && d.Size > 0)
                Add("C8", "Document could not be opened", "FAIL", $"'{d.OriginalFileName}' is not a readable PDF (password-protected or corrupt).", items.FirstOrDefault(i => i.Id == d.ItemId), d.DocType);
        }

        // C2 / C3 — bank letter age and account match
        foreach (var it in items)
        {
            var letter = docs.FirstOrDefault(d => d.ItemId == it.Id && d.DocType == CreditorDocTypes.BankLetter && d.StoragePath != null);
            if (letter == null) continue;
            if (letter.DocumentDate is { } ld)
            {
                if (ld < DateTime.UtcNow.AddMonths(-3))
                    Add("C2", "Bank letter older than 3 months", "FAIL", $"Bank letter for {it.SupplierName} is dated {ld:dd MMM yyyy}.", it, CreditorDocTypes.BankLetter);
            }
            else Add("C2", "Bank letter date not found", "REVIEW", $"Could not read a date off the bank letter for {it.SupplierName} — confirm it is less than 3 months old.", it, CreditorDocTypes.BankLetter);

            var acc = Digits(it.AccountNumber ?? "");
            if (acc == null) Add("C3", "Account number missing on schedule", "FAIL", $"No bank account number captured for {it.SupplierName}.", it);
            else if (letter.ExtractedAccountNumber == null && !(letter.ExtractedText ?? "").Replace(" ", "").Contains(acc))
                Add("C3", "Bank account not confirmed by letter", "REVIEW", $"Could not find account {Mask(acc)} on the bank letter for {it.SupplierName}.", it, CreditorDocTypes.BankLetter);
            else if (letter.ExtractedAccountNumber != null && letter.ExtractedAccountNumber != acc && !(letter.ExtractedText ?? "").Replace(" ", "").Contains(acc))
                Add("C3", "Bank account differs from letter", "FAIL", $"Schedule says {Mask(acc)} but the bank letter for {it.SupplierName} shows {Mask(letter.ExtractedAccountNumber)}.", it, CreditorDocTypes.BankLetter);
        }

        // C4 — duplicate invoice numbers (inside the batch and against other batches of the same company)
        var invMap = new Dictionary<string, List<PaymentBatchItem>>(StringComparer.OrdinalIgnoreCase);
        foreach (var it in items)
            foreach (var inv in SplitInvoices(it.InvoiceNumbers))
            { if (!invMap.TryGetValue(inv, out var l)) invMap[inv] = l = new(); l.Add(it); }
        foreach (var (inv, list) in invMap.Where(k => k.Value.Count > 1))
            Add("C4", "Duplicate invoice in batch", "FAIL", $"Invoice {inv} appears {list.Count} times ({string.Join(", ", list.Select(l => l.SupplierName).Distinct())}).", list[0]);

        if (invMap.Count > 0)
        {
            var others = await _db.PaymentBatchItems.AsNoTracking()
                .Where(i => i.BatchId != batch.Id && i.Batch!.CompanyCode == batch.CompanyCode
                            && i.Batch.Status != CreditorWorkflow.Rejected && i.InvoiceNumbers != null)
                .Select(i => new { i.SupplierName, i.InvoiceNumbers, i.Batch!.BatchNumber, i.Batch.Status })
                .ToListAsync();
            foreach (var o in others)
                foreach (var inv in SplitInvoices(o.InvoiceNumbers))
                    if (invMap.TryGetValue(inv, out var mine))
                        Add("C4", "Invoice already paid or in another batch", "FAIL", $"Invoice {inv} ({o.SupplierName}) is on batch {o.BatchNumber} ({CreditorWorkflow.Title(o.Status)}).", mine[0]);
        }

        // C5 — VAT number format (SA: 10 digits starting with 4)
        foreach (var it in items)
        {
            var vat = it.SupplierVatNumber?.Replace(" ", "");
            var inv = docs.FirstOrDefault(d => d.ItemId == it.Id && d.DocType == CreditorDocTypes.TaxInvoice && d.StoragePath != null);
            if (string.IsNullOrEmpty(vat)) vat = inv?.ExtractedVatNumber;
            if (string.IsNullOrEmpty(vat))
            {
                if (inv != null && batch.PaymentType != CreditorPaymentTypes.StaffPayment)
                    Add("C5", "VAT number not found", "REVIEW", $"No VAT number captured or read off the tax invoice for {it.SupplierName}.", it, CreditorDocTypes.TaxInvoice);
            }
            else if (!Regex.IsMatch(vat, @"^4\d{9}$"))
                Add("C5", "VAT number invalid", "FAIL", $"VAT number '{vat}' for {it.SupplierName} is not a valid SA VAT number (10 digits starting with 4).", it);
            else if (inv?.ExtractedVatNumber != null && inv.ExtractedVatNumber != vat)
                Add("C5", "VAT number differs from invoice", "REVIEW", $"Schedule VAT {vat} but the invoice shows {inv.ExtractedVatNumber} for {it.SupplierName}.", it, CreditorDocTypes.TaxInvoice);
        }

        // C6 — invoice total vs schedule amount; C7 — PO number appears on invoice / GRV
        foreach (var it in items)
        {
            var inv = docs.FirstOrDefault(d => d.ItemId == it.Id && d.DocType == CreditorDocTypes.TaxInvoice && d.StoragePath != null);
            var po = docs.FirstOrDefault(d => d.ItemId == it.Id && d.DocType == CreditorDocTypes.PurchaseOrder && d.StoragePath != null);
            var grv = docs.FirstOrDefault(d => d.ItemId == it.Id && d.DocType == CreditorDocTypes.Grv && d.StoragePath != null);

            if (inv?.ExtractedAmount is { } amt && SplitInvoices(it.InvoiceNumbers).Count() <= 1)
            {
                var diff = Math.Abs(amt - it.Amount);
                if (diff > 1m)
                    Add("C6", "Invoice total differs from schedule", diff > it.Amount * 0.1m ? "FAIL" : "REVIEW",
                        $"Schedule pays R{it.Amount:N2} but the invoice total reads R{amt:N2} for {it.SupplierName}.", it, CreditorDocTypes.TaxInvoice);
            }
            if (inv != null && inv.ExtractedInvoiceNumber != null && !string.IsNullOrWhiteSpace(it.InvoiceNumbers)
                && !SplitInvoices(it.InvoiceNumbers).Any(n => Norm(n) == Norm(inv.ExtractedInvoiceNumber) || Norm(inv.ExtractedInvoiceNumber).EndsWith(Norm(n))))
                Add("C6", "Invoice number differs from schedule", "REVIEW", $"Schedule lists {it.InvoiceNumbers} but the invoice reads {inv.ExtractedInvoiceNumber} for {it.SupplierName}.", it, CreditorDocTypes.TaxInvoice);

            if (po != null && inv != null)
            {
                var poNo = Regex.Match(po.ExtractedText ?? "", @"(?:ORDER|P/?O)\s*(?:NO|NUMBER|#)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,20})", RegexOptions.IgnoreCase).Groups[1].Value;
                if (poNo.Length >= 4)
                {
                    var n = Norm(poNo);
                    var invHas = Norm(inv.ExtractedText ?? "").Contains(n);
                    var grvHas = grv == null || Norm(grv.ExtractedText ?? "").Contains(n);
                    if (!invHas) Add("C7", "PO number not on invoice", "REVIEW", $"Order {poNo} is not referenced on the tax invoice for {it.SupplierName}.", it, CreditorDocTypes.PurchaseOrder);
                    if (!grvHas) Add("C7", "PO number not on GRV", "REVIEW", $"Order {poNo} is not referenced on the GRV for {it.SupplierName}.", it, CreditorDocTypes.Grv);
                }
            }

            if (batch.PaymentType == CreditorPaymentTypes.DailyCreditor)
            {
                var quotes = docs.Count(d => d.ItemId == it.Id && d.DocType == CreditorDocTypes.Quote && d.StoragePath != null);
                var naQuote = docs.Any(d => d.ItemId == it.Id && d.DocType == CreditorDocTypes.Quote && d.IsNotApplicable);
                if (quotes is > 0 and < 3 && !naQuote)
                    Add("C9", "Fewer than three quotes", "REVIEW", $"{quotes} quote(s) attached for {it.SupplierName} — three where possible.", it, CreditorDocTypes.Quote);
            }
        }

        // C11 — fraud alert: beneficiary bank details changed vs. last approved payment to the same supplier
        var supplierNames = items.Select(i => i.SupplierName.Trim().ToUpperInvariant()).Distinct().ToList();
        var history = await _db.PaymentBatchItems.AsNoTracking()
            .Where(i => i.BatchId != batch.Id && CreditorWorkflow.Locked.Contains(i.Batch!.Status) && i.AccountNumber != null)
            .OrderByDescending(i => i.Batch!.DirectorSignedAt)
            .Select(i => new { i.SupplierName, i.AccountNumber, i.BranchCode, i.Amount, i.Batch!.BatchNumber, i.Batch.DirectorSignedAt, i.Batch.CompanyCode })
            .Take(5000).ToListAsync();
        foreach (var it in items)
        {
            var key = it.SupplierName.Trim().ToUpperInvariant();
            var prev = history.FirstOrDefault(h => h.SupplierName.Trim().ToUpperInvariant() == key);
            if (prev == null) { Add("C11", "First payment to this beneficiary", "REVIEW", $"{it.SupplierName} has not been paid through the system before — verify the bank letter by phone (AVS).", it); continue; }
            if (Digits(prev.AccountNumber ?? "") != Digits(it.AccountNumber ?? ""))
                Add("C11", "Bank account changed", "FAIL", $"{it.SupplierName} was last paid into {Mask(Digits(prev.AccountNumber ?? ""))} (batch {prev.BatchNumber}); this schedule uses {Mask(Digits(it.AccountNumber ?? ""))}. Confirm with the supplier before approving.", it);

            // C12 — same amount to the same supplier within 7 days
            var dup = history.FirstOrDefault(h => h.SupplierName.Trim().ToUpperInvariant() == key && h.Amount == it.Amount && h.DirectorSignedAt > DateTime.UtcNow.AddDays(-7));
            if (dup != null) Add("C12", "Same amount paid recently", "REVIEW", $"R{it.Amount:N2} was approved for {it.SupplierName} on batch {dup.BatchNumber} within the last 7 days.", it);
        }

        // Prepayments: closing documents outstanding (informational once paid)
        if (batch.PaymentType == CreditorPaymentTypes.Prepayment && closingPrepayment)
            foreach (var it in items.Where(i => i.PrepaymentOpen))
                Add("C13", "Prepayment open", "REVIEW", $"Tax invoice and GRV still outstanding for {it.SupplierName} — upload them to close.", it);

        r.Fail = r.Findings.Count(f => f.Severity == "FAIL");
        r.Review = r.Findings.Count(f => f.Severity == "REVIEW");
        r.Pass = r.Findings.Count(f => f.Severity == "PASS");
        r.Status = r.Fail > 0 ? "FAIL" : r.Review > 0 ? "REVIEW" : "PASS";
        if (r.Findings.Count == 0) r.Findings.Add(new Finding { Code = "OK", Title = "All checks passed", Severity = "PASS", Detail = "Documents complete, bank details confirmed, no duplicates found." });
        return r;
    }

    public static string Serialize(Result r) => JsonSerializer.Serialize(r, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

    private static IEnumerable<string> SplitInvoices(string? s) =>
        (s ?? "").Split(new[] { ',', ';', '/', '\n', ' ' }, StringSplitOptions.RemoveEmptyEntries).Select(x => x.Trim()).Where(x => x.Length >= 3).Distinct(StringComparer.OrdinalIgnoreCase);

    private static string Norm(string s) => Regex.Replace(s.ToUpperInvariant(), @"[^A-Z0-9]", "");
    private static string Mask(string? acc) => string.IsNullOrEmpty(acc) ? "?" : acc.Length <= 4 ? acc : new string('•', acc.Length - 4) + acc[^4..];

    public static string Label(string key)
    {
        var d = CreditorDocTypes.All.FirstOrDefault(x => x.Key == key);
        if (d.Key != null) return d.Title;
        var p = CreditorPaymentTypes.All.FirstOrDefault(x => x.Key == key);
        return p.Key != null ? p.Title : key;
    }
}
