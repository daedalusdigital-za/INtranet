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
        /// <summary>Page copied in from another pack that shares the same order (multi-invoice orders).</summary>
        public bool Shared { get; set; }
        public int Rotation { get; set; }
        public decimal? AmountDue { get; set; }
        /// <summary>All order numbers seen on the page (an e-mail may list several orders).</summary>
        public List<string> OrderNumbers { get; set; } = new();
        public List<LineItem> Lines { get; set; } = new();
        /// <summary>Low-confidence read of the confirmation number (faded OC header).</summary>
        public bool ConfirmationLowConfidence { get; set; }
        public string? Supplier { get; set; }
        public string? Customer { get; set; }
        /// <summary>Official-order detail (layout, order number by label/barcode, totals, handwriting) — PO pages only.</summary>
        public OfficialOrderReader.Result? OfficialOrder { get; set; }
        public List<string> Hits { get; set; } = new();
        public int TextLength { get; set; }
    }

    public class LineItem
    {
        public string? ItemNumber { get; set; }
        public string Description { get; set; } = "";
        public decimal? QtyOrdered { get; set; }
        public decimal? QtyShipped { get; set; }
        public decimal? QtyBackorder { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? Value { get; set; }
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
        /// <summary>Layout id of the official order (A–G or UNKNOWN), when one was found.</summary>
        public string? PoLayout { get; set; }
        public string? PoIssuer { get; set; }
        public decimal? PoTotal { get; set; }
        public bool ProofOfDelivery { get; set; }
        public bool PartDelivery { get; set; }
        public bool Amended { get; set; }
        public string? Supplier { get; set; }
        public string? Customer { get; set; }
        public List<LineItem> Lines { get; set; } = new();
        /// <summary>Invoice total incl. VAT (from the tax invoice).</summary>
        public decimal? InvoiceTotal { get; set; }
        /// <summary>Order total incl. VAT (order confirmation, else official order).</summary>
        public decimal? OrderTotal { get; set; }
        /// <summary>Value of lines still on back-order (order total − invoice total when a part delivery; else Σ backorder × price).</summary>
        public decimal? OutstandingValue { get; set; }
        public bool ConfirmationLowConfidence { get; set; }

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
    private static readonly Regex AmountRx = new(@"(?:AMOUNT\s+DUE|TOTAL\s+DUE|GRAND\s+TOTAL|INVOICE\s+TOTAL|TOTAL\s+INCL\w*|TOTAL\s*\(INCL[^)]*\)|\bTOTAL)\b[^0-9\n]{0,25}?(\d{1,3}(?:[ ,.]\d{3})*[.,]\d{2}|\d{3,8}[.,]\d{2})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex InvLabelRx = new(@"(?:TAX\s+)?INVOICE\s*(?:NO|NUMBER|#)?\s*[:.\-]?\s*((?:[I1L][NMH])?[\s\-]?[0-9OQDILSBZGT]{5,8})(?![A-Z0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // Order confirmation (Sage sales order): strictly ORD + 5–8 digits. Checked BEFORE order numbers.
    private static readonly Regex OrdRx = new(@"(?<![A-Z0-9])[O0Q]RD[\s\-.:]?([0-9OQDILSBZGT]{5,8})(?![A-Z0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // In the dark header band the first glyph is often lost ("Qf RD107038", "N024737"): accept the
    // tail of the token when it sits in the [HEADER] segment of the page text.
    private static readonly Regex HeaderOrdRx = new(@"(?<![A-Z])[O0Q]?RD[\s\-.:]?(\d{5,8})(?![A-Z0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex HeaderInvRx = new(@"(?<![A-Z0-9])(?:[I1L]?[NMH]|[I1L][NMH]?)[\s\-.:]?(0\d{5,7})(?![A-Z0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // Customer order number: 1–4 letter prefix + 5–8 digits, hyphen/space optional (OR-000190 KZN, GL-003586 Limpopo).
    private static readonly Regex OrderTokenRx = new(@"(?<![A-Z0-9])([A-Z]{1,4})[ \t\-/]?([0-9OQDILSBZGT]{5,8})(?![A-Z0-9])", RegexOptions.Compiled);
    /// <summary>Known per-province order prefixes — only used to raise confidence, never to exclude.</summary>
    public static readonly string[] KnownOrderPrefixes = { "OR", "GL" };
    // Prefixes that are never a customer order: invoices, confirmations, and labels that sit directly in front of a number.
    private static readonly HashSet<string> NotOrderPrefixes = new() { "IN", "ORD", "TEL", "FAX", "VAT", "REG", "CSD", "MAAA", "MAA", "GST", "BOX", "REF", "PO", "ACC", "NO", "CELL", "PAGE", "QTY", "RT", "ITEM", "CODE", "DATE", "NR", "NUM", "ID", "TAX", "ABN" };
    private static readonly Regex PoLabelRx = new(@"(?:CUSTOMER\s+)?(?:P\.?O\.?|PURCHASE\s+ORDER|ORDER)\s*(?:NO|NUMBER|#|REF)?\.?\s*[:.\-]?\s*([A-Z]{1,4}[\s\-/]?\d{5,8}|\d{5,8})(?![0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CustRx = new(@"(?:CUSTOMER|ACCOUNT|ACC|DEBTOR)\s*(?:NO|NUMBER|CODE|#)?\.?\s*[:.\-]?\s*(\d{2}-[A-Z]{3}-\d{3}|[A-Z]{2,4}\d{3,6}|\d{2}[A-Z]{3}\d{3})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex DateRx = new(@"\b(\d{1,2}[\/\-.\s](?:\d{1,2}|[A-Z]{3,9})[\/\-.\s]\d{2,4}|\d{4}[\/\-.]\d{2}[\/\-.]\d{2})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // Hospital-issued long order numbers: PT-ORD/26-07-36872, PH-ORD/26-10-0011, MK-ORD/26-05-0174, LE-ORD/26-10-1754.
    private static readonly Regex LongOrderRx = new(@"(?<![A-Z0-9])([A-Z]{2,4})\s?[-\u2013/]\s?ORD\s?[\/\-]\s?(\d{2})\s?[-\u2013]\s?(\d{2})\s?[-\u2013]\s?(\d{3,6})(?![0-9])", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // E-mail shorthand: a line that is just "-36872" (or "- 36872") takes the prefix of the long number above it.
    private static readonly Regex ShorthandRx = new(@"(?:^|(?<=\s))[-\u2013]\s?(\d{3,6})(?=\s|$|[,.;:)])", RegexOptions.Multiline | RegexOptions.Compiled);
    // Sage line: item number, description, Ord/Shp/B-O quantities, unit price, amount — tolerant of OCR gaps.
    private static readonly Regex SageLineRx = new(@"^\s*(\d{5,9}|[A-Z]{1,3}\d{2,4}-?\d{2,6})\s+(.{4,70}?)\s+(\d{1,5})\s+(\d{1,5})\s+(\d{1,5})\s+(?:EA|EACH|BAG|BOX|PK|PKT|UNIT|CS|CASE|KG|\d*\s?KG\s?BAG)?\s*R?\s?(\d{1,3}(?:[ ,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})\s+R?\s?(\d{1,3}(?:[ ,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MoneyRx = new(@"R?\s?(\d{1,3}(?:[ ,]\d{3})*[.,]\d{2}|\d{3,8}[.,]\d{2})", RegexOptions.Compiled);
    private static readonly Regex SupplierRx = new(@"(SEBENZANI\s+TRADING(?:\s+622)?(?:\s*\(PTY\)\s*LTD)?|PROMED\s+TECHNOLOGIES(?:\s*\(PTY\)\s*LTD)?|ACCESS\s+MEDICAL(?:\s+SUPPLIES)?(?:\s*\(PTY\)\s*LTD)?|PHARMATECH(?:\s*\(PTY\)\s*LTD)?)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CustomerRx = new(@"(?:SOLD\s+TO|BILL\s+TO|CUSTOMER|SHIP\s+TO|DELIVER(?:Y)?\s+TO)\s*[:.\-]?\s*\n?\s*([A-Z][A-Z0-9 &'.\-]{5,70}?(?:HOSPITAL|CLINIC|CENTRE|CENTER|DEPOT|HC|CHC|HEALTH[A-Z ]{0,30}|PHARMACY|STORES?))\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

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
        // Long hospital format first: PT-ORD/26-07-36872 → PTORD260736872 (letters + ORD + all digits).
        var lm = LongOrderRx.Match(raw.ToUpperInvariant());
        if (lm.Success && lm.Index == 0) return $"{lm.Groups[1].Value}ORD{lm.Groups[2].Value}{lm.Groups[3].Value}{lm.Groups[4].Value}";
        var s = Regex.Replace(raw.ToUpperInvariant(), @"[\s\-/.:#]", "");
        var lm2 = Regex.Match(s, @"^([A-Z]{2,4})ORD(\d{7,10})$");
        if (lm2.Success) return s;
        var m = Regex.Match(s, @"^([A-Z]{1,4})([0-9OQDILSBZGT]{5,8})$");
        if (m.Success)
        {
            var prefix = m.Groups[1].Value; var body = m.Groups[2].Value;
            // OCR often reads the "O" of OR as 0/Q.
            if (prefix is "0R" or "QR") prefix = "OR";
            // A digit read as a letter at the prefix/number boundary ("ORO00190" = OR + O00190): if peeling
            // trailing confusable letters off the prefix leaves a known prefix, they belong to the digits.
            while (prefix.Length > 1 && !KnownOrderPrefixes.Contains(prefix) && "OQDILSBZGT".Contains(prefix[^1]) && KnownOrderPrefixes.Any(k => prefix.StartsWith(k)))
            { body = prefix[^1] + body; prefix = prefix[..^1]; }
            if (NotOrderPrefixes.Contains(prefix)) return null;
            if (body.Count(char.IsDigit) < 4 || body.Length > 8) return null;
            return prefix + Digits(body);
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

    /// <summary>"R5 865,60" / "77,601,00" / "21,180.65" → decimal. Last separator is the decimal point when 2 digits follow it.</summary>
    public static decimal? Money(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = Regex.Replace(s.ToUpperInvariant(), @"[R\s]", "");
        var m = Regex.Match(t, @"^(.*?)[.,](\d{2})$");
        if (!m.Success) return decimal.TryParse(Regex.Replace(t, @"[^\d]", ""), out var w) ? w : null;
        var whole = Regex.Replace(m.Groups[1].Value, @"[^\d]", "");
        return decimal.TryParse(whole + "." + m.Groups[2].Value, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : null;
    }

    // ───────── classification ─────────

    private record Sig(string Type, (string kw, double w)[] Keywords);
    private static readonly Sig[] Signatures =
    {
        new("DN",  new[] { ("DELIVERY NOTE", 3.0), ("QTY RECEIVED", 1.5), ("QUANTITY RECEIVED", 1.5), ("RECEIVED BY", 1.5), ("RECEIVEL BY", 1.5), ("RECEIVED IN GOOD", 1.0), ("BACK ORDER", .5), ("B/O", .3), ("SHIPPED", .5) }),
        new("INV", new[] { ("TAX INVOICE", 3.0), ("UNIT PRICE", 1.0), ("SUBTOTAL", 1.0), ("SUB TOTAL", 1.0), ("AMOUNT DUE", 1.5), ("VAT", .5), ("BANKING DETAILS", 1.0), ("BANK DETAILS", 1.0), ("ACCOUNT NUMBER", .3), ("PART DELIVERY", .5) }),
        // The Sage order-confirmation header is usually a graphic, so lean on its table layout:
        // Salesperson / Ship Via / Order Date / Ord. Shp. B/O columns / Order Discount / Total order.
        new("OC",  new[] { ("ORDER CONFIRMATION", 3.0), ("ORDER CONF", 2.0), ("CONFIRMATION NO", 1.5), ("CONFIRMATION NUMBER", 1.5), ("TOTAL ORDER", 2.0), ("ORDER DISCOUNT", 1.5), ("SALESPERSON", 1.0), ("SHIP VIA", 1.0), ("ORDER DATE", 1.0), ("ORD. SHP", 1.5), ("ORD SHP", 1.5), ("SHP. B/O", 1.5), ("REFERENCE PO", .8), ("PO NUMBER", .5), ("INCLUDED TAX", 1.5), ("REFERENCE", .5) }),
        new("EML", new[] { ("GMAIL", 2.0), ("FROM:", 1.5), ("TO:", 1.0), ("SUBJECT", 1.5), ("SENT:", 1.0), ("@KZNHEALTH.GOV.ZA", 2.0), (".GOV.ZA", 1.0), ("@PROMEDTECHNOLOGIES", 1.5), ("@", .3), ("FORWARDED MESSAGE", 1.5), ("ATTACHMENT", .5), ("OUTLOOK", 1.5), ("@GMAIL.COM", 1.5), ("OUTLET ORDER NO", 1.0), ("CC:", .8), ("WROTE:", 1.0) }),
        new("PO",  new[] { ("KZN: HEALTH", 3.0), ("KZN HEALTH", 2.5), (": HEALTH", 2.0), ("ORDER\\SERVICE", 2.0), ("ORDER/SERVICE", 2.0), ("ORDER NO", 1.5), ("OFFICIAL ORDER", 2.5), ("AUTHORISATIONS", 2.0), ("GOVERNMENT CONTRACT", 2.0), ("PROVINCE OF", 1.0), ("DEPARTMENT OF HEALTH", 1.5), ("STORE NUMBER", 1.5), ("SUPPLIER NAME", 1.0), ("AMENDED ORDER", 1.5), ("CSD", .5), ("MAAA", .8), ("DELIVERY DATE", .5),
                           // other buyer layouts (B–G)
                           ("PURCHASE ORDER", 2.5), ("SUPPLIED BY", 1.5), ("ORDERED BY", 1.5), ("AUTHORISER", 1.5), ("EST. COST", 1.0),
                           ("ORDER FOR MEDICAL GOODS", 3.0), ("PARTICULARS OF REQUIREMENT", 2.0), ("DEMAND NO", 1.0), ("PRINT BATCH", 1.0),
                           ("GAUTENG PROVINCE", 2.5), ("PO NUMBER", 1.5), ("VENDOR NUMBER", 1.5), ("MATERIAL / SERVICE", 1.0),
                           ("SUPPLIER ORDER", 2.5), ("MPUMALANGA", 1.5), ("BESKRYWING", 1.5), ("TOTAAL", 1.0), ("PLEASE USE OUR ORDER", 2.0),
                           ("SOUTH AFRICAN POLICE SERVICE", 3.0), ("FORM CODE 1430", 2.0), ("VERPLIGTING", 1.5), ("COMMITMENT IN RESPECT", 2.0),
                           ("LIMPOPO", 1.5), ("PROVINCIAL GOVERNMENT", 1.5), ("OUTLET CODE", 1.5), ("OUTLET ORDER", 1.5), ("[BARCODE]", 1.0) }),
    };

    public static PageResult AnalyzePage(int pageNo, string text)
    {
        var up = (text ?? "").ToUpperInvariant();
        var collapsed = Regex.Replace(up, @"[ \t]+", " ");
        // OCR frequently drops the space in headers ("DeliveryNote", "TaxInvoice") — match on both.
        var squashed = Regex.Replace(up, @"\s+", "");
        bool Has(string kw) => collapsed.Contains(kw) || squashed.Contains(kw.Replace(" ", ""));
        var r = new PageResult { Page = pageNo, TextLength = collapsed.Trim().Length };
        // Text from the dedicated header-band OCR pass (see ServerOcrService) — where IN… / ORD… live.
        var hdrIdx = collapsed.IndexOf("[HEADER]", StringComparison.Ordinal);
        var header = hdrIdx >= 0 ? collapsed[(hdrIdx + 8)..] : "";

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
        // OC with a blank header band (title + ORD number lost in the scan): recognise it from the body alone —
        // supplier letterhead + Reference / PO Number / Salesperson / Ship Via / Included Tax / Total order.
        if (!isInvHeader && !isDnHeader && !isOcHeader && SupplierRx.IsMatch(collapsed))
        {
            var body = new[] { "REFERENCE", "PO NUMBER", "SALESPERSON", "SHIP VIA", "INCLUDED TAX", "TOTAL ORDER" }.Count(Has);
            if (body >= 3) { scores["OC"] = Math.Max(scores["OC"], 3.0 + body * 0.5); r.Hits.Add("OC body (no header band)"); }
        }
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
        if (invs.Count == 0 && header.Length > 0)
            foreach (Match m in HeaderInvRx.Matches(header)) { var n = NormalizeInvoice(m.Groups[1].Value); if (n != null) invs.Add(n); }
        r.InvoiceNumber = invs.GroupBy(x => x).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault();

        // Confirmation (ORD…) is checked first so it can never be mistaken for an order number.
        var confs = new List<string>();
        foreach (Match m in OrdRx.Matches(collapsed)) { var n = NormalizeConfirmation(m.Value); if (n != null) confs.Add(n); }
        if (confs.Count == 0 && header.Length > 0)
            foreach (Match m in HeaderOrdRx.Matches(header)) confs.Add("ORD" + m.Groups[1].Value);
        r.ConfirmationNumber = confs.GroupBy(x => x).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault();

        // Order number: labelled value ("Customer PO Number", "PO Number", "ORDER NO.") counts double;
        // then any prefixed token anywhere on the page (subject line, attachment name). Known province
        // prefixes (OR, GL) get extra weight. IN… / ORD… / customer / CSD / VAT numbers are excluded.
        var ords = new List<(string norm, string raw, double w)>();
        // Long hospital numbers (PT-ORD/26-07-36872) anywhere on the page, and e-mail shorthand "-36872" lines
        // that borrow the prefix of the nearest long number above them. Also bare numbers that follow a
        // long number on the same line (attachment lists: "36831 36829 36904").
        string? lastLongPrefix = null;
        foreach (var line in collapsed.Split('\n'))
        {
            var any = false;
            foreach (Match lm in LongOrderRx.Matches(line))
            {
                var n = NormalizeOrder(lm.Value); if (n == null) continue;
                ords.Add((n, lm.Value.Trim(), 2.5)); any = true;
                lastLongPrefix = $"{lm.Groups[1].Value.ToUpperInvariant()}ORD{lm.Groups[2].Value}{lm.Groups[3].Value}";
            }
            if (lastLongPrefix != null)
            {
                foreach (Match sm in ShorthandRx.Matches(line))
                    ords.Add((lastLongPrefix + sm.Groups[1].Value, sm.Value.Trim(), 1.2));
            }
        }
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
        // Every order the page mentions with reasonable weight (e-mails list several); used by the splitter.
        r.OrderNumbers = ords.GroupBy(x => x.norm).Where(g => g.Sum(x => x.w) >= 1.0 || g.Key == r.OrderNumber).Select(g => g.Key).ToList();

        // Sage line items (INV / DN / OC): item, description, Ord Shp B/O, unit price, amount.
        foreach (Match m in SageLineRx.Matches(collapsed))
        {
            var li = new LineItem { ItemNumber = m.Groups[1].Value, Description = Regex.Replace(m.Groups[2].Value.Trim(), @"\s{2,}", " "), UnitPrice = Money(m.Groups[6].Value), Value = Money(m.Groups[7].Value) };
            if (decimal.TryParse(m.Groups[3].Value, out var q1)) li.QtyOrdered = q1;
            if (decimal.TryParse(m.Groups[4].Value, out var q2)) li.QtyShipped = q2;
            if (decimal.TryParse(m.Groups[5].Value, out var q3)) li.QtyBackorder = q3;
            // Sanity: ordered = shipped + backorder, or price × qty ≈ value; otherwise it is probably not a line.
            var arith = (li.QtyOrdered == li.QtyShipped + li.QtyBackorder) || (li.UnitPrice is decimal price && li.Value is decimal v && (Math.Abs(price * (li.QtyShipped ?? 0) - v) < 0.05m || Math.Abs(price * (li.QtyOrdered ?? 0) - v) < 0.05m));
            if (arith) r.Lines.Add(li);
        }
        var sup = SupplierRx.Match(collapsed);
        if (sup.Success) r.Supplier = Regex.Replace(sup.Value.Trim(), @"\s+", " ");
        var cu = CustomerRx.Match(collapsed);
        if (cu.Success) r.Customer = Regex.Replace(cu.Groups[1].Value.Trim(), @"\s+", " ");

        var cm = CustRx.Match(collapsed);
        if (cm.Success) r.CustomerNumber = cm.Groups[1].Value;
        else { var cb = CustBareRx.Match(collapsed); if (cb.Success) r.CustomerNumber = cb.Groups[1].Value; }
        var dm = DateRx.Match(collapsed);
        if (dm.Success) r.Date = dm.Groups[1].Value;
        // Largest "total"-style amount on the page ≈ amount due incl. VAT.
        decimal? amt = null;
        foreach (Match m in AmountRx.Matches(collapsed))
            if (Money(m.Groups[1].Value) is decimal v && (amt == null || v > amt)) amt = v;
        r.AmountDue = amt;

        r.Signed = Regex.IsMatch(collapsed, @"RECEIVED\s+BY|SIGNATURE|SIGNED");
        r.Stamped = Regex.IsMatch(collapsed, @"\bSTAMP|RECEIVED\s+\d{1,2}|HOSPITAL|STORES?\b|RECEIVING");
        r.PartDelivery = collapsed.Contains("PART DELIVERY") || collapsed.Contains("PARTIAL DELIVERY") || collapsed.Contains("BACK ORDER") || collapsed.Contains("BACKORDER");
        r.Amended = collapsed.Contains("AMENDED");
        return r;
    }

    // ───────── validation ─────────

    public static Result Analyze(IList<string> pageTexts) => Analyze(pageTexts, null);

    /// <param name="barcodes">Per-page decoded barcode values (same index as <paramref name="pageTexts"/>), when available.</param>
    public static Result Analyze(IList<string> pageTexts, IList<List<string>>? barcodes) => Analyze(pageTexts, barcodes, null);

    /// <param name="rotations">Per-page rotation applied by the OCR step (0/90/180/270), for the page report.</param>
    /// <param name="shared">Per-page flag: page copied in from another pack of the same order.</param>
    public static Result Analyze(IList<string> pageTexts, IList<List<string>>? barcodes, IList<int>? rotations, IList<bool>? shared = null)
    {
        var res = new Result();
        for (var i = 0; i < pageTexts.Count; i++)
        {
            var pr = AnalyzePage(i + 1, pageTexts[i]);
            if (rotations != null && i < rotations.Count) pr.Rotation = rotations[i];
            if (shared != null && i < shared.Count) pr.Shared = shared[i];
            res.Pages.Add(pr);
        }

        var readable = res.Pages.Where(p => p.TextLength >= 40).ToList();
        if (readable.Count == 0)
        {
            res.Status = "UNKNOWN";
            res.Notes.Add("No text could be read from the document — the invoice number must be typed in and the pack checked by eye.");
            return res;
        }

        // Official order: read by layout. Last page first (it is usually the PO), then any other PO page.
        // The supplier documents' order numbers let an unknown layout still be matched.
        var supplierOrders = res.Pages.Where(p => p.Type is "DN" or "INV" or "OC" && p.OrderNumber != null).Select(p => p.OrderNumber!).Distinct().ToList();
        DateTime? packDate = null;
        foreach (var d in res.Pages.Where(p => p.Type is "INV" or "DN").Select(p => p.Date))
        { var iso = OfficialOrderReader.DateParser.ToIso(d ?? ""); if (iso != null && DateTime.TryParse(iso, out var dt)) { packDate = dt; break; } }
        var poPages = res.Pages.Where(p => p.Type == "PO" || (p.Type == "UNK" && p.TextLength >= 80)).OrderByDescending(p => p.Page == res.Pages.Count).ThenBy(p => p.Page).ToList();
        foreach (var p in poPages)
        {
            var codes = barcodes != null && p.Page - 1 < barcodes.Count ? barcodes[p.Page - 1] : null;
            var oo = OfficialOrderReader.Read(pageTexts[p.Page - 1], codes, supplierOrders, packDate);
            if (p.Type == "UNK" && !oo.IsOfficialOrder) continue;
            if (p.Type == "UNK") { p.Type = "PO"; p.Confidence = 0.5; p.Hits.Add("OFFICIAL ORDER (structure)"); }
            p.OfficialOrder = oo;
            if (oo.OrderNumber.Has) { p.OrderNumber = oo.OrderNumber.Value; p.OrderNumberRaw = oo.OrderNumber.Raw; }
            else if (oo.LayoutId != "UNKNOWN") p.OrderNumber = null; // layout known but no number at its label → don't trust a stray token
            if (oo.HandwrittenOrd.Count > 0 && p.ConfirmationNumber == null) p.ConfirmationNumber = oo.HandwrittenOrd[0];
            if (oo.HandwrittenCustomerNo.Has && p.CustomerNumber == null) p.CustomerNumber = oo.HandwrittenCustomerNo.Value;
            if (oo.OrderDate.Has) p.Date = oo.OrderDate.Value;
            p.Amended |= oo.Amended; p.Signed |= oo.Authorised; p.Stamped |= oo.Stamps.Count > 0;
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
        res.Supplier = Vote(docs.Where(p => p.Type is "INV" or "DN" or "OC").Select(p => p.Supplier)) ?? Vote(res.Pages.Select(p => p.Supplier));
        res.Customer = Vote(docs.Where(p => p.Type is "INV").Select(p => p.Customer)) ?? Vote(docs.Select(p => p.Customer));
        // Low confidence when the OC number was not read on the order confirmation itself (blank header band)
        // but taken from a handwritten note on another document (typically "ORD 107040" written on the PO).
        var ocHasConf = docs.Any(p => p.Type == "OC" && p.ConfirmationNumber == res.ConfirmationNumber);
        res.ConfirmationLowConfidence = res.ConfirmationNumber != null && !ocHasConf && docs.Any(p => p.Type == "OC");
        if (res.ConfirmationLowConfidence) res.Warnings.Add($"Order confirmation number {res.ConfirmationNumber} was not readable on the confirmation itself — taken from a handwritten note; check it on the paper copy.");

        // Lines: the order confirmation carries the full order (Ord / Shp / B-O); the invoice carries what was shipped.
        var ocPage = docs.Where(p => p.Type == "OC").OrderByDescending(p => p.Lines.Count).FirstOrDefault();
        var lineSrc = (ocPage?.Lines.Count ?? 0) > 0 ? ocPage! : (inv?.Lines.Count ?? 0) > 0 ? inv! : (dn?.Lines.Count ?? 0) > 0 ? dn! : null;
        if (lineSrc != null)
        {
            foreach (var l in lineSrc.Lines)
            {
                var li = new LineItem { ItemNumber = l.ItemNumber, Description = l.Description, QtyOrdered = l.QtyOrdered, QtyShipped = l.QtyShipped, QtyBackorder = l.QtyBackorder, UnitPrice = l.UnitPrice, Value = l.Value };
                // Shipped / back-order from the DN or INV override the OC when the same item is on them.
                var shipped = (inv ?? dn)?.Lines.FirstOrDefault(x => x.ItemNumber == l.ItemNumber && lineSrc.Type == "OC");
                if (shipped != null) { li.QtyShipped = shipped.QtyShipped; li.QtyBackorder = shipped.QtyBackorder; }
                res.Lines.Add(li);
            }
        }
        res.InvoiceTotal = inv?.AmountDue ?? dn?.AmountDue;
        res.OrderTotal = ocPage?.AmountDue ?? docs.Where(p => p.Type == "PO" && p.OfficialOrder?.Total2 != null).Select(p => p.OfficialOrder!.Total2).FirstOrDefault();
        var bo = res.Lines.Where(l => l.QtyBackorder > 0 && l.UnitPrice != null).Sum(l => l.QtyBackorder!.Value * l.UnitPrice!.Value);
        if (bo > 0) res.OutstandingValue = Math.Round(bo * (res.OrderTotal is decimal ot && res.Lines.Sum(l => l.Value ?? 0) > 0 && Math.Abs(ot - res.Lines.Sum(l => l.Value ?? 0) * 1.15m) < 1m ? 1.15m : 1m), 2);
        else if (res.PartDelivery && res.OrderTotal is decimal o && res.InvoiceTotal is decimal it && o > it) res.OutstandingValue = Math.Round(o - it, 2);

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

        // H3 — order number agreement across ≥3 documents. A page that lists several orders (an e-mail covering
        // two orders, an attachment list) agrees when any of them is the pack's order.
        var withOrder = docs.Where(p => p.OrderNumber != null).ToList();
        var packOrder = res.OrderNumber ?? withOrder.Select(p => p.OrderNumber!).GroupBy(o => o).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault();
        var disagree = withOrder.Where(p => p.OrderNumber != packOrder && !(p.OrderNumbers?.Contains(packOrder ?? "") ?? false)).ToList();
        var distinct = withOrder.Select(p => p.OrderNumber!).Distinct().ToList();
        bool h3; string d3;
        if (withOrder.Count < 3) { h3 = false; d3 = $"Order number found on only {withOrder.Count} document(s); need at least 3."; }
        else if (disagree.Count > 0) { h3 = false; d3 = "Order number mismatch: " + string.Join("; ", withOrder.Select(p => $"{TypeNames[p.Type]} (p{p.Page}) = {p.OrderNumberRaw}")); }
        else { h3 = true; d3 = distinct.Count > 1 ? $"{withOrder.Count} documents agree on {packOrder} (one page also lists other orders)." : $"{withOrder.Count} documents agree on {distinct[0]}."; }
        res.Rules.Add(new RuleResult { Code = "H3", Title = "Order number agrees across the pack", Pass = h3, Detail = d3 });

        // Soft checks → warnings
        var ocs = docs.Where(p => p.ConfirmationNumber != null).Select(p => p.ConfirmationNumber!).Distinct().ToList();
        if (ocs.Count > 1) res.Warnings.Add("Different order-confirmation numbers seen: " + string.Join(", ", ocs) + ".");
        var custs = docs.Where(p => p.CustomerNumber != null).Select(p => p.CustomerNumber!).Distinct().ToList();
        if (custs.Count > 1) res.Warnings.Add("Customer number differs between documents: " + string.Join(", ", custs) + ".");
        if (dn != null && !res.ProofOfDelivery) res.Warnings.Add("No 'Received by' signature or receiving stamp could be read on the delivery note — check the paper copy.");
        if (res.PartDelivery) res.Notes.Add("Marked as a part delivery — the balance is on back-order." + (res.OutstandingValue is decimal ov ? $" Outstanding ≈ R {ov:N2}." : ""));
        if (res.Amended) res.Notes.Add("Amended order in the pack — amended values apply.");
        var sharedPages = res.Pages.Where(p => p.Shared).Select(p => p.Page).ToList();
        if (sharedPages.Count > 0) res.Notes.Add($"Page{(sharedPages.Count > 1 ? "s" : "")} {string.Join(", ", sharedPages)} shared from another invoice of the same order.");

        // Official-order detail → pack-level fields, warnings and REVIEW triggers.
        var poDoc = docs.Where(p => p.Type == "PO" && p.OfficialOrder != null).OrderByDescending(p => p.Amended).FirstOrDefault();
        if (poDoc?.OfficialOrder is { } po)
        {
            res.PoLayout = po.LayoutId; res.PoIssuer = po.Issuer; res.PoTotal = po.Total2;
            if (po.LayoutId == "UNKNOWN") res.Notes.Add($"Official order (p{poDoc.Page}) is in a layout we have not seen before.");
            else res.Notes.Add($"Official order (p{poDoc.Page}): layout {po.LayoutId} — {po.LayoutName}; order number from {po.OrderNumber.Source ?? "n/a"}.");
            foreach (var w in po.Warnings) res.Warnings.Add($"Official order: {w}");
            foreach (var why in po.ReviewReasons) res.Warnings.Add($"Official order: {why}");
            if (po.HandwrittenOrd.Count > 0 && res.ConfirmationNumber != null && !po.HandwrittenOrd.Contains(res.ConfirmationNumber))
                res.Warnings.Add($"ORD number written on the official order ({string.Join("/", po.HandwrittenOrd)}) does not match the order confirmation ({res.ConfirmationNumber}).");
            if (po.Total2 is decimal pt && res.AmountDue is decimal due && !res.PartDelivery && Math.Abs(pt - due) > 0.05m)
                res.Warnings.Add($"Order total R {pt:N2} differs from the invoice amount due R {due:N2}.");
        }
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
