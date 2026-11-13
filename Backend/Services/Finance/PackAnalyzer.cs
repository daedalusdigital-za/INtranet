using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services.Finance;

/// <summary>
/// Classifies each page of an invoice pack (DN / INV / OC / EML / PO), extracts the key numbers
/// and applies the pack validation rules:
///   H1 minimum documents (4 or 5 distinct types), H2 DN↔INV invoice match,
///   H3 order number agreement across ≥3 documents.  Soft checks only add warnings.
/// Pure text logic — OCR / text extraction happens before this is called.
/// </summary>
public static class PackAnalyzer
{
    public static readonly string[] Types = { "DN", "INV", "OC", "EML", "PO" };
    public static readonly Dictionary<string, string> TypeNames = new()
    {
        ["DN"] = "Delivery note", ["INV"] = "Tax invoice", ["OC"] = "Order confirmation", ["EML"] = "Customer order e-mail", ["PO"] = "Official order",
    };

    public class PageResult
    {
        public int Page { get; set; }
        public string Type { get; set; } = "UNK";
        public double Confidence { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? OrderNumber { get; set; }
        public string? OrderNumberRaw { get; set; }
        public string? ConfirmationNumber { get; set; }
        public string? CustomerNumber { get; set; }
        public string? Date { get; set; }
        public bool Signed { get; set; }
        public bool Stamped { get; set; }
        public bool PartDelivery { get; set; }
        public bool Amended { get; set; }
        public bool Duplicate { get; set; }
        public decimal? AmountDue { get; set; }
        public List<string> Hits { get; set; } = new();
        public int TextLength { get; set; }
    }

    public class RuleResult
    {
        public string Code { get; set; } = "";
        public string Title { get; set; } = "";
        public bool Pass { get; set; }
        public string Detail { get; set; } = "";
    }

    public class Result
    {
        /// <summary>PASS | FAIL | REVIEW | UNKNOWN (no text could be read).</summary>
        public string Status { get; set; } = "UNKNOWN";
        public List<PageResult> Pages { get; set; } = new();
        public List<string> TypesFound { get; set; } = new();
        public List<string> TypesMissing { get; set; } = new();
        public List<RuleResult> Rules { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public List<string> Notes { get; set; } = new();
        public string? InvoiceNumber { get; set; }
        public string? OrderNumber { get; set; }
        public string? ConfirmationNumber { get; set; }
        public string? CustomerNumber { get; set; }
        /// <summary>Invoice total (incl. VAT) read off the tax invoice / delivery note — used to find the invoice in Sage when the IN number is unreadable.</summary>
        public decimal? AmountDue { get; set; }
        public bool ProofOfDelivery { get; set; }
        public bool PartDelivery { get; set; }
        public bool Amended { get; set; }

        public string ToJson() => JsonSerializer.Serialize(this, JsonOpts);
        public static Result? FromJson(string? s) { try { return s == null ? null : JsonSerializer.Deserialize<Result>(s, JsonOpts); } catch { return null; } }
    }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    // ───────── patterns ─────────
    // No leading \b: scanners glue dashes/underscores to the token ("—1N024737", "_IN024737"). IN\d{5,8}.
    private static readonly Regex InvRx = new(@"(?<![A-Z0-9])[I1L][NMH][\s.\-:#]?([0-9OQDILSBZGT]{5,8})(?![A-Z0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // Bare 6-digit number near an invoice / delivery-note header (the IN prefix is often a logo glyph).
    private static readonly Regex BareInvRx = new(@"(?:INVOICE|DELIVERY\s*NOTE)[^\n]{0,40}?(?<![A-Z0-9])(?<![A-Z][\s\-/])(0\d{5,7})(?![A-Z0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CustBareRx = new(@"\b(\d{2}-[A-Z]{3}-\d{3})\b", RegexOptions.Compiled);
    private static readonly Regex AmountRx = new(@"(?:AMOUNT\s+DUE|TOTAL\s+DUE|GRAND\s+TOTAL|INVOICE\s+TOTAL|TOTAL\s+INCL\w*|\bTOTAL)\b[^0-9\n]{0,25}?(\d{1,3}(?:[ ,]\d{3})*\.\d{2}|\d{3,8}\.\d{2})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex InvLabelRx = new(@"(?:TAX\s+)?INVOICE\s*(?:NO|NUMBER|#)?\s*[:.\-]?\s*((?:[I1L][NMH])?[\s\-]?[0-9OQDILSBZGT]{5,8})(?![A-Z0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // Order confirmation (Sage sales order): strictly ORD + 5–8 digits. Checked BEFORE order numbers.
    private static readonly Regex OrdRx = new(@"(?<![A-Z0-9])[O0Q]RD[\s\-.:]?([0-9OQDILSBZGT]{5,8})(?![A-Z0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // Customer order number: 1–4 letter prefix + 5–8 digits, hyphen/space optional (OR-000190 KZN, GL-003586 Limpopo).
    private static readonly Regex OrderTokenRx = new(@"(?<![A-Z0-9])([A-Z]{1,4})[\s\-/]?([0-9OQDILSBZGT]{5,8})(?![A-Z0-9])", RegexOptions.Compiled);
    /// <summary>Known per-province order prefixes — only used to raise confidence, never to exclude.</summary>
    public static readonly string[] KnownOrderPrefixes = { "OR", "GL" };
    // Prefixes that are never a customer order: invoices, confirmations, and labels that sit directly in front of a number.
    private static readonly HashSet<string> NotOrderPrefixes = new() { "IN", "ORD", "TEL", "FAX", "VAT", "REG", "CSD", "MAAA", "MAA", "GST", "BOX", "REF", "PO", "ACC", "NO", "CELL", "PAGE", "QTY", "RT", "ITEM", "CODE", "DATE", "NR", "NUM", "ID", "TAX", "ABN" };
    private static readonly Regex PoLabelRx = new(@"(?:CUSTOMER\s+)?(?:P\.?O\.?|PURCHASE\s+ORDER|ORDER)\s*(?:NO|NUMBER|#|REF)?\.?\s*[:.\-]?\s*([A-Z]{1,4}[\s\-/]?\d{5,8}|\d{5,8})(?![0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CustRx = new(@"(?:CUSTOMER|ACCOUNT|ACC|DEBTOR)\s*(?:NO|NUMBER|CODE|#)?\.?\s*[:.\-]?\s*(\d{2}-[A-Z]{3}-\d{3}|[A-Z]{2,4}\d{3,6}|\d{2}[A-Z]{3}\d{3})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex DateRx = new(@"\b(\d{1,2}[\/\-.\s](?:\d{1,2}|[A-Z]{3,9})[\/\-.\s]\d{2,4}|\d{4}[\/\-.]\d{2}[\/\-.]\d{2})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string? NormalizeInvoice(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = Regex.Replace(raw.ToUpperInvariant(), @"[\s\-.:#]", "");
        var m = Regex.Match(s, @"^(?:[I1L][NMH])?([0-9OQDILSBZGT]{5,8})$");
        if (!m.Success) return null;
        // At least 3 real digits so words like "INSOLID" never become invoice numbers.
        if (m.Groups[1].Value.Count(char.IsDigit) < 3) return null;
        var d = Digits(m.Groups[1].Value);
        return d.Length is >= 5 and <= 8 ? "IN" + d : null;
    }

    /// <summary>
    /// Customer order number: uppercase, strip spaces / hyphens / slashes, 1–4 letters + 5–8 digits
    /// ("OR-000190" → OR000190, "GL-003586" → GL003586). OCR swaps are fixed in the digit part only.
    /// ORD… (confirmation) and IN… (invoice) are never order numbers.
    /// </summary>
    public static string? NormalizeOrder(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = Regex.Replace(raw.ToUpperInvariant(), @"[\s\-/.:#]", "");
        var m = Regex.Match(s, @"^([A-Z]{1,4})([0-9OQDILSBZGT]{5,8})$");
        if (m.Success)
        {
            var prefix = m.Groups[1].Value;
            if (NotOrderPrefixes.Contains(prefix)) return null;
            if (m.Groups[2].Value.Count(char.IsDigit) < 4) return null;
            // OCR often reads the "O" of OR as 0/Q.
            if (prefix is "0R" or "QR") prefix = "OR";
            return prefix + Digits(m.Groups[2].Value);
        }
        // Plain numeric order numbers are only accepted when they sit under an order label (see PoLabelRx);
        // long numbers (attachment ids like 5020706054) are never orders.
        return Regex.IsMatch(s, @"^\d{5,8}$") ? s : null;
    }

    /// <summary>Order confirmation: strictly ORD + 5–8 digits.</summary>
    public static string? NormalizeConfirmation(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = Regex.Replace(raw.ToUpperInvariant(), @"[\s\-/.:#]", "");
        var m = Regex.Match(s, @"^[O0Q]RD([0-9OQDILSBZGT]{5,8})$");
        return m.Success && m.Groups[1].Value.Count(char.IsDigit) >= 3 ? "ORD" + Digits(m.Groups[1].Value) : null;
    }

    public static bool LooksLikeConfirmation(string? raw) => NormalizeConfirmation(raw) != null;

    private static string Digits(string s)
    {
        var sb = new System.Text.StringBuilder();
        foreach (var ch in s) sb.Append(ch switch { 'O' or 'Q' or 'D' => '0', 'I' or 'L' => '1', 'Z' => '2', 'S' => '5', 'B' => '8', 'G' => '6', 'T' => '7', _ => ch });
        return sb.ToString();
    }

    // ───────── classification ─────────

    private record Sig(string Type, (string kw, double w)[] Keywords);
    private static readonly Sig[] Signatures =
    {
        new("DN",  new[] { ("DELIVERY NOTE", 3.0), ("QTY RECEIVED", 1.5), ("QUANTITY RECEIVED", 1.5), ("RECEIVED BY", 1.5), ("RECEIVEL BY", 1.5), ("RECEIVED IN GOOD", 1.0), ("BACK ORDER", .5), ("B/O", .3), ("SHIPPED", .5) }),
        new("INV", new[] { ("TAX INVOICE", 3.0), ("UNIT PRICE", 1.0), ("SUBTOTAL", 1.0), ("SUB TOTAL", 1.0), ("AMOUNT DUE", 1.5), ("VAT", .5), ("BANKING DETAILS", 1.0), ("BANK DETAILS", 1.0), ("ACCOUNT NUMBER", .3), ("PART DELIVERY", .5) }),
        // The Sage order-confirmation header is usually a graphic, so lean on its table layout:
        // Salesperson / Ship Via / Order Date / Ord. Shp. B/O columns / Order Discount / Total order.
        new("OC",  new[] { ("ORDER CONFIRMATION", 3.0), ("CONFIRMATION NO", 1.5), ("CONFIRMATION NUMBER", 1.5), ("TOTAL ORDER", 2.0), ("ORDER DISCOUNT", 1.5), ("SALESPERSON", 1.0), ("SHIP VIA", 1.0), ("ORDER DATE", 1.0), ("ORD. SHP", 1.5), ("ORD SHP", 1.5), ("SHP. B/O", 1.5), ("REFERENCE PO", .8), ("PO NUMBER", .5) }),
        new("EML", new[] { ("GMAIL", 2.0), ("FROM:", 1.5), ("TO:", 1.0), ("SUBJECT", 1.5), ("SENT:", 1.0), ("@KZNHEALTH.GOV.ZA", 2.0), (".GOV.ZA", 1.0), ("@PROMEDTECHNOLOGIES", 1.5), ("@", .3), ("FORWARDED MESSAGE", 1.5), ("ATTACHMENT", .5), ("OUTLOOK", 1.5) }),
        new("PO",  new[] { ("KZN: HEALTH", 3.0), ("KZN HEALTH", 2.5), (": HEALTH", 2.0), ("ORDER\\SERVICE", 2.0), ("ORDER/SERVICE", 2.0), ("ORDER NO", 1.5), ("OFFICIAL ORDER", 2.5), ("AUTHORISATIONS", 2.0), ("GOVERNMENT CONTRACT", 2.0), ("PROVINCE OF", 1.0), ("DEPARTMENT OF HEALTH", 1.5), ("STORE NUMBER", 1.5), ("SUPPLIER NAME", 1.0), ("AMENDED ORDER", 1.5), ("CSD", .5), ("MAAA", .8), ("DELIVERY DATE", .5) }),
    };

    public static PageResult AnalyzePage(int pageNo, string text)
    {
        var up = (text ?? "").ToUpperInvariant();
        var collapsed = Regex.Replace(up, @"[ \t]+", " ");
        // OCR frequently drops the space in headers ("DeliveryNote", "TaxInvoice") — match on both.
        var squashed = Regex.Replace(up, @"\s+", "");
        bool Has(string kw) => collapsed.Contains(kw) || squashed.Contains(kw.Replace(" ", ""));
        var r = new PageResult { Page = pageNo, TextLength = collapsed.Trim().Length };

        // Score each type.
        var scores = new Dictionary<string, double>();
        foreach (var sig in Signatures)
        {
            double s = 0;
            foreach (var (kw, w) in sig.Keywords)
                if (Has(kw)) { s += w; if (w >= 1.5) r.Hits.Add(kw); }
            scores[sig.Type] = s;
        }
        var isInvHeader = Has("TAX INVOICE");
        var isDnHeader = Has("DELIVERY NOTE");
        var isOcHeader = Has("ORDER CONFIRMATION");
        // Structural hints: the explicit header wins; a Sage INV/DN shares the OC table words, so the
        // structural OC score only counts when there is no invoice / delivery-note header on the page.
        // (Scans printed from Gmail carry a "Gmail" footer on every page — that alone must not sway types.)
        if (isInvHeader && !isDnHeader) scores["DN"] = 0;
        if (isDnHeader && !isInvHeader) scores["INV"] = Math.Min(scores["INV"], 1.0);
        if (!isOcHeader && (isInvHeader || isDnHeader)) scores["OC"] = 0;
        if (isOcHeader) { scores["INV"] = 0; scores["DN"] = 0; }
        // A page with order-confirmation structure but no invoice header is an OC, not an invoice.
        if (!isInvHeader && !isDnHeader && scores["OC"] >= 3.5) scores["INV"] = Math.Min(scores["INV"], 1.0);
        var best = scores.OrderByDescending(kv => kv.Value).First();
        if (best.Value >= 1.5) { r.Type = best.Key; r.Confidence = Math.Min(1, best.Value / 5.0); }

        // Numbers.
        var invs = new List<string>();
        foreach (Match m in InvLabelRx.Matches(collapsed))
        {
            var tok = m.Groups[1].Value.Trim();
            // A labelled value must be IN… or a bare number — never another prefixed token (GL-003586 after "Tax Invoice … PO Number").
            if (Regex.IsMatch(tok, @"^[A-Z]", RegexOptions.IgnoreCase) && !Regex.IsMatch(tok, @"^[I1L][NMH]", RegexOptions.IgnoreCase)) continue;
            var n = NormalizeInvoice(tok); if (n != null) invs.Add(n);
        }
        foreach (Match m in InvRx.Matches(collapsed)) { var n = NormalizeInvoice(m.Value); if (n != null) invs.Add(n); }
        if (invs.Count == 0 && (isInvHeader || isDnHeader))
            foreach (Match m in BareInvRx.Matches(collapsed)) { var n = NormalizeInvoice(m.Groups[1].Value); if (n != null) invs.Add(n); }
        r.InvoiceNumber = invs.GroupBy(x => x).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault();

        // Confirmation (ORD…) is checked first so it can never be mistaken for an order number.
        var confs = new List<string>();
        foreach (Match m in OrdRx.Matches(collapsed)) { var n = NormalizeConfirmation(m.Value); if (n != null) confs.Add(n); }
        r.ConfirmationNumber = confs.GroupBy(x => x).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault();

        // Order number: labelled value ("Customer PO Number", "PO Number", "ORDER NO.") counts double;
        // then any prefixed token anywhere on the page (subject line, attachment name). Known province
        // prefixes (OR, GL) get extra weight. IN… / ORD… / customer / CSD / VAT numbers are excluded.
        var ords = new List<(string norm, string raw, double w)>();
        foreach (Match m in PoLabelRx.Matches(collapsed))
        {
            var tok = m.Groups[1].Value;
            if (NormalizeInvoice(tok) != null && Regex.IsMatch(tok, @"^[I1L][NMH]", RegexOptions.IgnoreCase)) continue;
            if (LooksLikeConfirmation(tok)) continue;
            var n = NormalizeOrder(tok); if (n != null) ords.Add((n, tok.Trim(), 2.0));
        }
        foreach (Match m in OrderTokenRx.Matches(up))
        {
            var tok = m.Value;
            if (LooksLikeConfirmation(tok) || Regex.IsMatch(tok, @"^[I1L][NMH]")) continue;
            var n = NormalizeOrder(tok); if (n == null) continue;
            var prefix = Regex.Match(n, @"^[A-Z]+").Value;
            ords.Add((n, tok.Trim(), KnownOrderPrefixes.Contains(prefix) ? 1.5 : 0.6));
        }
        var bestOrd = ords.GroupBy(x => x.norm).OrderByDescending(g => g.Sum(x => x.w)).FirstOrDefault();
        if (bestOrd != null) { r.OrderNumber = bestOrd.Key; r.OrderNumberRaw = bestOrd.First().raw; }

        var cm = CustRx.Match(collapsed);
        if (cm.Success) r.CustomerNumber = cm.Groups[1].Value;
        else { var cb = CustBareRx.Match(collapsed); if (cb.Success) r.CustomerNumber = cb.Groups[1].Value; }
        var dm = DateRx.Match(collapsed);
        if (dm.Success) r.Date = dm.Groups[1].Value;
        // Largest "total"-style amount on the page ≈ amount due incl. VAT.
        decimal? amt = null;
        foreach (Match m in AmountRx.Matches(collapsed))
            if (decimal.TryParse(m.Groups[1].Value.Replace(" ", "").Replace(",", ""), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var v) && (amt == null || v > amt)) amt = v;
        r.AmountDue = amt;

        r.Signed = Regex.IsMatch(collapsed, @"RECEIVED\s+BY|SIGNATURE|SIGNED");
        r.Stamped = Regex.IsMatch(collapsed, @"\bSTAMP|RECEIVED\s+\d{1,2}|HOSPITAL|STORES?\b|RECEIVING");
        r.PartDelivery = collapsed.Contains("PART DELIVERY") || collapsed.Contains("PARTIAL DELIVERY") || collapsed.Contains("BACK ORDER") || collapsed.Contains("BACKORDER");
        r.Amended = collapsed.Contains("AMENDED");
        return r;
    }

    // ───────── validation ─────────

    public static Result Analyze(IList<string> pageTexts)
    {
        var res = new Result();
        for (var i = 0; i < pageTexts.Count; i++) res.Pages.Add(AnalyzePage(i + 1, pageTexts[i]));

        var readable = res.Pages.Where(p => p.TextLength >= 40).ToList();
        if (readable.Count == 0)
        {
            res.Status = "UNKNOWN";
            res.Notes.Add("No text could be read from the document — the invoice number must be typed in and the pack checked by eye.");
            return res;
        }

        // Duplicate pages: same type + same key numbers → count once. E-mails run over several pages, so
        // they are never treated as duplicates (a pack may well have more than 5 pages).
        var seen = new HashSet<string>();
        foreach (var p in res.Pages.Where(p => p.Type != "UNK" && p.Type != "EML"))
        {
            var key = $"{p.Type}|{p.InvoiceNumber}|{p.OrderNumber}|{p.ConfirmationNumber}|{p.Amended}";
            if (!seen.Add(key)) { p.Duplicate = true; res.Notes.Add($"Page {p.Page} looks like a second copy of a {TypeNames[p.Type].ToLowerInvariant()} — counted once."); }
        }
        var docs = res.Pages.Where(p => p.Type != "UNK" && !p.Duplicate).ToList();

        // Amended PO: if both original and amended exist, use the amended one.
        var pos = docs.Where(p => p.Type == "PO").ToList();
        if (pos.Count > 1 && pos.Any(p => p.Amended))
        {
            foreach (var p in pos.Where(p => !p.Amended)) { p.Duplicate = true; res.Notes.Add($"Page {p.Page}: original order superseded by the amended order."); }
            docs = docs.Where(p => !p.Duplicate).ToList();
        }

        res.TypesFound = Types.Where(t => docs.Any(d => d.Type == t)).ToList();
        res.TypesMissing = Types.Except(res.TypesFound).ToList();
        res.Amended = docs.Any(p => p.Amended && p.Type is "PO" or "EML");
        res.PartDelivery = docs.Any(p => p.PartDelivery && p.Type is "INV" or "DN");
        // Prefer the DN / INV page that actually yielded an invoice number.
        var dn = docs.Where(p => p.Type == "DN").OrderByDescending(p => p.InvoiceNumber != null).FirstOrDefault();
        var inv = docs.Where(p => p.Type == "INV").OrderByDescending(p => p.InvoiceNumber != null).FirstOrDefault();
        res.ProofOfDelivery = docs.Any(p => p.Type == "DN" && (p.Signed || p.Stamped));

        // Pack-level numbers (most common across documents, INV/DN preferred for invoice).
        res.InvoiceNumber = Vote(docs.Where(p => p.Type is "INV" or "DN").Select(p => p.InvoiceNumber)) ?? Vote(res.Pages.Select(p => p.InvoiceNumber));
        res.OrderNumber = Vote(docs.Select(p => p.OrderNumber)) ?? Vote(res.Pages.Select(p => p.OrderNumber));
        res.ConfirmationNumber = Vote(docs.Select(p => p.ConfirmationNumber));
        res.CustomerNumber = Vote(docs.Select(p => p.CustomerNumber));
        res.AmountDue = (inv ?? dn)?.AmountDue ?? docs.Where(p => p.Type is "INV" or "DN").Select(p => p.AmountDue).FirstOrDefault(a => a != null);

        // H1 — minimum documents
        var h1 = res.TypesFound.Count >= 4;
        res.Rules.Add(new RuleResult
        {
            Code = "H1", Title = "Minimum documents (4 of 5)", Pass = h1,
            Detail = h1 ? $"{res.TypesFound.Count} of 5 document types found." : $"Only {res.TypesFound.Count} of 5 documents; missing: {string.Join(", ", res.TypesMissing.Select(t => TypeNames[t]))}.",
        });

        // H2 — DN ↔ INV invoice number match. The IN number is often part of a header graphic that OCR
        // cannot read on one of the two pages; a single clean read is accepted with a warning — only a
        // genuine mismatch, or no read at all, fails.
        bool h2; string d2;
        if (dn == null || inv == null) { h2 = false; d2 = dn == null && inv == null ? "Delivery note and tax invoice not found." : dn == null ? "Delivery note not found." : "Tax invoice not found."; }
        else if (dn.InvoiceNumber == null && inv.InvoiceNumber == null)
        {
            h2 = res.InvoiceNumber != null;
            d2 = h2 ? $"Invoice number {res.InvoiceNumber} read elsewhere in the pack but not on the delivery note or tax invoice — confirm by eye."
                    : "Invoice number could not be read on the delivery note or the tax invoice.";
            if (h2) res.Warnings.Add(d2);
        }
        else if (dn.InvoiceNumber == null || inv.InvoiceNumber == null)
        {
            h2 = true;
            var readOn = dn.InvoiceNumber != null ? $"delivery note (p{dn.Page})" : $"tax invoice (p{inv.Page})";
            var missingOn = dn.InvoiceNumber != null ? $"tax invoice (p{inv.Page})" : $"delivery note (p{dn.Page})";
            d2 = $"{dn.InvoiceNumber ?? inv.InvoiceNumber} read on the {readOn}; not legible on the {missingOn} — confirm they match.";
            res.Warnings.Add(d2);
        }
        else { h2 = dn.InvoiceNumber == inv.InvoiceNumber; d2 = h2 ? $"Both read {inv.InvoiceNumber}." : $"Invoice mismatch: DN={dn.InvoiceNumber} INV={inv.InvoiceNumber}."; }
        res.Rules.Add(new RuleResult { Code = "H2", Title = "Delivery note and invoice carry the same invoice number", Pass = h2, Detail = d2 });

        // H3 — order number agreement across ≥3 documents
        var withOrder = docs.Where(p => p.OrderNumber != null).ToList();
        var distinct = withOrder.Select(p => p.OrderNumber!).Distinct().ToList();
        bool h3; string d3;
        if (withOrder.Count < 3) { h3 = false; d3 = $"Order number found on only {withOrder.Count} document(s); need at least 3."; }
        else if (distinct.Count > 1) { h3 = false; d3 = "Order number mismatch: " + string.Join("; ", withOrder.Select(p => $"{TypeNames[p.Type]} (p{p.Page}) = {p.OrderNumberRaw}")); }
        else { h3 = true; d3 = $"{withOrder.Count} documents agree on {distinct[0]}."; }
        res.Rules.Add(new RuleResult { Code = "H3", Title = "Order number agrees across the pack", Pass = h3, Detail = d3 });

        // Soft checks → warnings
        var ocs = docs.Where(p => p.ConfirmationNumber != null).Select(p => p.ConfirmationNumber!).Distinct().ToList();
        if (ocs.Count > 1) res.Warnings.Add("Different order-confirmation numbers seen: " + string.Join(", ", ocs) + ".");
        var custs = docs.Where(p => p.CustomerNumber != null).Select(p => p.CustomerNumber!).Distinct().ToList();
        if (custs.Count > 1) res.Warnings.Add("Customer number differs between documents: " + string.Join(", ", custs) + ".");
        if (dn != null && !res.ProofOfDelivery) res.Warnings.Add("No 'Received by' signature or receiving stamp could be read on the delivery note — check the paper copy.");
        if (res.PartDelivery) res.Notes.Add("Marked as a part delivery — the balance is on back-order.");
        if (res.Amended) res.Notes.Add("Amended order in the pack — amended values apply.");
        var unk = res.Pages.Where(p => p.Type == "UNK" && p.TextLength >= 40).Select(p => p.Page).ToList();
        if (unk.Count > 0) res.Warnings.Add($"Page{(unk.Count > 1 ? "s" : "")} {string.Join(", ", unk)} could not be classified.");
        var blank = res.Pages.Where(p => p.TextLength < 40).Select(p => p.Page).ToList();
        if (blank.Count > 0) res.Warnings.Add($"Page{(blank.Count > 1 ? "s" : "")} {string.Join(", ", blank)} returned almost no text (faint scan or image only).");

        res.Status = res.Rules.All(r => r.Pass) ? (res.Warnings.Count > 0 ? "REVIEW" : "PASS") : "FAIL";
        return res;
    }

    private static string? Vote(IEnumerable<string?> values) =>
        values.Where(v => v != null).GroupBy(v => v!).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault();
}
