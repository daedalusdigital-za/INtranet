using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services.Finance;

/// <summary>
/// Reads the buyer's official order (PO) page of an invoice pack.
/// Layouts live in Config/PoLayouts.json (anchor words, order-number label / sentence / barcode,
/// date + total labels, decimal style). The page is fingerprinted against the catalogue, then the
/// fields are read by that layout's rules and normalised with the shared amount / date logic.
/// Unknown layouts fall back to generic labels and are sent to REVIEW.
/// </summary>
public static class OfficialOrderReader
{
    // ───────── catalogue ─────────

    public class LayoutOrderNumber
    {
        public List<string> Labels { get; set; } = new();
        public string? Sentence { get; set; }
        public string? Pattern { get; set; }
        public string Source { get; set; } = "label";
        public bool Footer { get; set; }
        public bool Barcode { get; set; }
        public bool FormSerial { get; set; }
    }

    public class Layout
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Issuer { get; set; } = "";
        public List<string> Anchors { get; set; } = new();
        public LayoutOrderNumber OrderNumber { get; set; } = new();
        public List<string> ExcludeLabels { get; set; } = new();
        public List<string> DateLabels { get; set; } = new();
        public List<string> DeliveryDateLabels { get; set; } = new();
        public List<string> TotalLabels { get; set; } = new();
        public string Decimals { get; set; } = "2";
        public bool Rotated { get; set; }
        public bool AlwaysReview { get; set; }
    }

    private class Catalogue { public List<Layout> Layouts { get; set; } = new(); }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true, ReadCommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };
    private static List<Layout>? _layouts;
    private static readonly object Lock = new();

    public static IReadOnlyList<Layout> Layouts
    {
        get
        {
            if (_layouts != null) return _layouts;
            lock (Lock)
            {
                if (_layouts != null) return _layouts;
                var path = Path.Combine(AppContext.BaseDirectory, "Config", "PoLayouts.json");
                if (!File.Exists(path)) path = Path.Combine(Directory.GetCurrentDirectory(), "Config", "PoLayouts.json");
                try { _layouts = JsonSerializer.Deserialize<Catalogue>(File.ReadAllText(path), JsonOpts)?.Layouts ?? new(); }
                catch { _layouts = new(); }
                return _layouts;
            }
        }
    }

    /// <summary>Load a catalogue from JSON (tests / hot reload).</summary>
    public static void LoadCatalogue(string json) { lock (Lock) { _layouts = JsonSerializer.Deserialize<Catalogue>(json, JsonOpts)?.Layouts ?? new(); } }

    // ───────── result ─────────

    public class Field<T>
    {
        private T? _value; private bool _set;
        public T? Value { get => _value; set { _value = value; _set = value != null && !(value is string s && s.Length == 0); } }
        public string? Raw { get; set; }
        public double Confidence { get; set; }
        public string? Source { get; set; }
        public string? Reason { get; set; }
        [JsonIgnore] public bool Has => _set;
    }

    public class Line
    {
        public string? BuyerCode { get; set; }
        public string? Description { get; set; }
        public decimal? Quantity { get; set; }
        public string? Unit { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? LineValue { get; set; }
        public string Raw { get; set; } = "";
    }

    public class Result
    {
        public string LayoutId { get; set; } = "UNKNOWN";
        public string? LayoutName { get; set; }
        public string? Issuer { get; set; }
        public int AnchorHits { get; set; }
        public List<string> AnchorsMatched { get; set; } = new();
        public bool IsOfficialOrder { get; set; }
        public Field<string> OrderNumber { get; set; } = new();
        public List<string> OrderNumberCandidates { get; set; } = new();
        public Field<string> OrderDate { get; set; } = new();
        public Field<string> RequiredDeliveryDate { get; set; } = new();
        public Field<string> SupplierName { get; set; } = new();
        public Field<string> VendorNumber { get; set; } = new();
        public Field<string> CsdNumber { get; set; } = new();
        public Field<string> DeliverTo { get; set; } = new();
        public List<Line> Lines { get; set; } = new();
        public Field<decimal> Subtotal { get; set; } = new();
        public Field<decimal> Vat { get; set; } = new();
        public Field<decimal> Total { get; set; } = new();
        /// <summary>Total rounded to 2 decimals for comparing with the invoice.</summary>
        public decimal? Total2 { get; set; }
        public bool Authorised { get; set; }
        public List<string> HandwrittenOrd { get; set; } = new();
        public Field<string> HandwrittenCustomerNo { get; set; } = new();
        public bool Amended { get; set; }
        public List<string> Stamps { get; set; } = new();
        public bool ArithmeticOk { get; set; }
        public bool NeedsReview { get; set; }
        public List<string> ReviewReasons { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
    }

    // ───────── entry point ─────────

    /// <summary>
    /// Read an official-order page. <paramref name="barcodes"/> are any decoded barcode values from the
    /// page image (layout G); <paramref name="packOrderNumbers"/> are the normalised order numbers already
    /// read from the supplier's documents (DN/INV/OC) so an UNKNOWN layout can still be matched.
    /// </summary>
    public static Result Read(string text, IEnumerable<string>? barcodes = null, IEnumerable<string>? packOrderNumbers = null, DateTime? packDate = null)
    {
        var res = new Result();
        var up = (text ?? "").ToUpperInvariant().Replace('\r', '\n');
        var collapsed = Regex.Replace(up, @"[ \t]+", " ");
        var squashed = Regex.Replace(up, @"\s+", "");
        bool Has(string kw) => collapsed.Contains(kw) || squashed.Contains(Regex.Replace(kw, @"\s+", ""));

        // 1. Is it a PO? Buyer-issued: names the supplier, has an order number word, has an authoriser.
        var namesSupplier = Regex.IsMatch(collapsed, @"SUPPLIER|SUPPLIED BY|VENDOR|PROMED|PHARMATECH|ACCESS MEDICAL|SEBENZANI");
        var hasOrderWord = Regex.IsMatch(collapsed, @"ORDER\s*(NO|NUMBER)|PO\s*NUMBER|PURCHASE ORDER|SUPPLIER ORDER|ORDER[\\/]SERVICE|COMMITMENT IN RESPECT|ORDER FOR MEDICAL");
        var hasAuthoriser = Regex.IsMatch(collapsed, @"AUTHORIS|AUTHORIZ|SIGNATURE|SIGNED|APPROVED|STAMP|HANDTEKENING");
        var supplierLetterhead = Has("TAX INVOICE") || Has("DELIVERY NOTE") || Has("ORDER CONFIRMATION");
        res.IsOfficialOrder = !supplierLetterhead && namesSupplier && hasOrderWord;
        res.Authorised = hasAuthoriser;

        // 2. Fingerprint against the catalogue.
        Layout? best = null; var bestHits = 0; var bestMatched = new List<string>();
        foreach (var l in Layouts)
        {
            var matched = l.Anchors.Where(Has).Distinct().ToList();
            if (matched.Count > bestHits) { best = l; bestHits = matched.Count; bestMatched = matched; }
        }
        if (best != null && bestHits >= 3)
        {
            res.LayoutId = best.Id; res.LayoutName = best.Name; res.Issuer = best.Issuer;
            res.AnchorHits = bestHits; res.AnchorsMatched = bestMatched;
            if (best.AlwaysReview) Review(res, $"Layout {best.Id} ({best.Name}) is mostly handwritten — always checked by a person.");
        }
        else
        {
            res.AnchorHits = bestHits;
            if (res.IsOfficialOrder) Review(res, "Official order in a layout we have not seen before — order number read with generic labels only; page saved as a new layout sample.");
        }
        var layout = res.LayoutId == "UNKNOWN" ? null : best;

        // 3. Order number — trust order: barcode → labelled box → instruction sentence → footer.
        ReadOrderNumber(res, layout, collapsed, barcodes?.ToList() ?? new(), packOrderNumbers?.ToList() ?? new());

        // 4. Dates.
        var dateLabels = layout?.DateLabels.Count > 0 ? layout.DateLabels : new List<string> { "PO NUMBER / DATE", "ORDER DATE", "DATE" };
        res.OrderDate = ReadLabelledDate(collapsed, dateLabels);
        if (!res.OrderDate.Has) { var any = DateParser.FindAll(collapsed).FirstOrDefault(); if (any.iso != null) res.OrderDate = new Field<string> { Value = any.iso, Raw = any.raw, Confidence = 0.5, Source = "first date on page", Reason = "No date next to the order-date label." }; }
        var delivLabels = layout?.DeliveryDateLabels.Count > 0 ? layout.DeliveryDateLabels : new List<string> { "DELIVERY DATE", "REQUIRED DELIVERY DATE", "DELIVERY BY" };
        res.RequiredDeliveryDate = ReadLabelledDate(collapsed, delivLabels);
        if (!res.RequiredDeliveryDate.Has) res.RequiredDeliveryDate.Reason = "Layout has no required delivery date.";

        // 5. Supplier identity / deliver-to.
        res.SupplierName = ReadSupplier(collapsed);
        var vm = Regex.Match(collapsed, @"VENDOR\s*(?:NO|NUMBER)\.?\s*[:.\-]?\s*(\d{6,12})");
        if (vm.Success) res.VendorNumber = new Field<string> { Value = vm.Groups[1].Value, Raw = vm.Value, Confidence = 0.9, Source = "label" }; else res.VendorNumber.Reason = "No vendor number on this layout.";
        var cm = Regex.Match(collapsed, @"CSD\s*(?:NO|NUMBER|REF\w*)?\.?\s*[:.\-]?\s*(MAAA\s?\d{6,8})");
        if (cm.Success) res.CsdNumber = new Field<string> { Value = cm.Groups[1].Value.Replace(" ", ""), Raw = cm.Value, Confidence = 0.9, Source = "label" }; else res.CsdNumber.Reason = "No CSD number on this layout.";
        var dm = Regex.Match(collapsed, @"(?:DELIVER(?:Y)?\s+TO|SHIP\s+TO|DELIVERY\s+ADDRESS|STORE NUMBER & DESCRIPTION|OUTLET)\s*[:.\-]?\s*\n?\s*([^\n]{3,80})");
        if (dm.Success) res.DeliverTo = new Field<string> { Value = Clean(dm.Groups[1].Value), Raw = dm.Groups[1].Value, Confidence = 0.6, Source = "label" }; else res.DeliverTo.Reason = "No delivery block found.";

        // 6. Lines + totals (amount rule with arithmetic disambiguation).
        ReadLinesAndTotals(res, layout, collapsed);

        // 7. Handwriting, stamps, amendments.
        foreach (Match m in Regex.Matches(collapsed, @"(?<![A-Z0-9])[O0Q]RD[\s\-.:]?(\d{5,8})(?![A-Z0-9])"))
        { var v = "ORD" + m.Groups[1].Value; if (!res.HandwrittenOrd.Contains(v)) res.HandwrittenOrd.Add(v); }
        var hc = Regex.Match(collapsed, @"\b(\d{2}-[A-Z]{3}-\d{3})\b");
        if (hc.Success) res.HandwrittenCustomerNo = new Field<string> { Value = hc.Groups[1].Value, Raw = hc.Value, Confidence = 0.7, Source = "handwritten" }; else res.HandwrittenCustomerNo.Reason = "No supplier customer number written on the page.";
        res.Amended = Regex.IsMatch(collapsed, @"AMENDED|AMENDMENT|GEWYSIG");
        foreach (Match m in Regex.Matches(collapsed, @"(FOR URGENT DELIVERY|RECEIVED|SOUTH AFRICAN POLICE SERVICE\s+\d{1,2}\s+[A-Z]{3}\s+\d{4}|[A-Z &]{6,40}(?:CENTRE|CENTER|HOSPITAL|CLINIC|DEPOT)\s+\d{4}-\d{2}-\d{2})"))
            if (!res.Stamps.Contains(m.Value.Trim())) res.Stamps.Add(m.Value.Trim());
        if (res.Stamps.Count > 0) res.Authorised = true;
        if (res.HandwrittenOrd.Count > 1) res.Warnings.Add("Two ORD numbers written on the order — if one is crossed out use the other; both are checked against the order confirmation.");

        // 8. Review triggers.
        if (!res.OrderNumber.Has) Review(res, "Order number could not be read from the official order.");
        else if (res.OrderNumber.Confidence < 0.80) Review(res, $"Order number {res.OrderNumber.Raw} read with low confidence.");
        if (res.Total.Has && !res.ArithmeticOk && res.Lines.Count > 0) Review(res, "No reading of the amounts makes the line and total arithmetic work — check the figures by hand.");
        if (res.Amended && res.Total.Confidence < 0.80) Review(res, "Amended order with a handwritten total that could not be read confidently.");
        if (packDate != null && res.OrderDate.Has && DateTime.TryParse(res.OrderDate.Value, out var od) && od < packDate.Value.AddMonths(-6)) res.Warnings.Add($"Order is dated {res.OrderDate.Value}, much earlier than the rest of the pack.");
        return res;
    }

    private static void Review(Result r, string why) { r.NeedsReview = true; if (!r.ReviewReasons.Contains(why)) r.ReviewReasons.Add(why); }

    // ───────── order number ─────────

    public static string NormalizeOrderNumber(string? raw) => string.IsNullOrWhiteSpace(raw) ? "" : Regex.Replace(raw.ToUpperInvariant(), @"[\s\-/\\.:]", "");

    private static readonly string[] GenericLabels = { "ORDER NO.", "ORDER NO", "ORDER NUMBER", "PO NUMBER", "PO NO", "ORDER NR", "NUMBER", "ORDER:" };
    private static readonly string[] GlobalExclude = { "VOUCHER", "ICN", "SERIAL NO", "DEMAND NO", "LINE NO", "PRINT BATCH", "ITEM NO", "CONTRACT NUMBER", "VENDOR NUMBER", "MATERIAL", "OUR REFERENCE", "YOUR REFERENCE", "OUTLET ORDER NO", "OUTLET CODE", "AUTHORISATION", "OUR REF", "STORE NUMBER", "CSD", "VAT", "TEL", "FAX", "CELL", "ACCOUNT", "CUSTOMER NO", "CUSTOMER NUMBER" };

    private static void ReadOrderNumber(Result res, Layout? layout, string text, List<string> barcodes, List<string> packOrders)
    {
        var found = new List<(string raw, string norm, string source, double conf)>();
        var pattern = layout?.OrderNumber.Pattern != null ? new Regex(layout.OrderNumber.Pattern, RegexOptions.IgnoreCase) : null;
        bool Fits(string raw) => pattern == null || pattern.IsMatch(Regex.Replace(raw.ToUpperInvariant(), @"\s", ""));
        var exclude = (layout?.ExcludeLabels ?? new()).Concat(GlobalExclude).ToList();

        // A token sitting right after a look-alike label (same line, just before our label) is NOT the order number.
        bool AfterExcludedLabel(int idx, string label)
        {
            var lineStart = text.LastIndexOf('\n', Math.Max(0, idx - 1)) + 1;
            var before = text.Substring(lineStart, idx - lineStart);
            if (before.Length > 25) before = before[^25..];
            // "OUTLET ORDER NO." contains "ORDER NO.": the word(s) right before our label make it a different field.
            var withLabel = (before + label).TrimEnd(' ', ':', '.', '-');
            if (exclude.Any(e => withLabel.EndsWith(e) && e.Length > label.TrimEnd('.', ':').Length)) return true;
            return exclude.Any(e => before.EndsWith(e) || before.TrimEnd(' ', ':', '.', '-').EndsWith(e));
        }

        // 1. Barcode.
        if (layout?.OrderNumber.Barcode == true || layout == null)
            foreach (var b in barcodes.Where(b => !string.IsNullOrWhiteSpace(b)))
                if (Fits(b) || layout == null) found.Add((b.Trim(), NormalizeOrderNumber(b), "barcode", 0.98));

        // 2. Labelled box.
        var labels = layout?.OrderNumber.Labels.Count > 0 ? layout.OrderNumber.Labels : GenericLabels.ToList();
        foreach (var label in labels)
        {
            // Value = letters/digits with optional - or / separators, e.g. OR-000190, MK-ORD/26-05-0174, 4251309927, MP/25/7653.
            // OCR often renders table-cell borders as | [ ] between label and value — treat them as separators.
            var rx = new Regex(@"(?<![A-Z])" + Regex.Escape(label) + @"[\s:.\-|\[\]]*(?:\n\s*)?[|\[\]]?\s*([A-Z]{0,4}(?:[\-/][A-Z]{1,4})?[\-/ ]?\d[\d\-/]{3,16}\d|\d{5,12})(?![A-Z0-9])", RegexOptions.IgnoreCase);
            foreach (Match m in rx.Matches(text))
            {
                if (AfterExcludedLabel(m.Index, label)) continue;
                var raw = m.Groups[1].Value.Trim();
                if (label == "NUMBER" && layout?.Id != "B" && !Regex.IsMatch(raw, @"[A-Z]")) continue; // bare "Number 2162" style refs
                if (!Fits(raw)) continue;
                found.Add((raw, NormalizeOrderNumber(raw), "label", 0.9));
            }
        }

        // 3. Instruction sentence.
        var sentence = layout?.OrderNumber.Sentence ?? @"PLEASE\s+USE\s+OUR\s+ORDER\s+(?:NUMBER|NO\.?)\s*[:.]?\s*([A-Z]{0,4}/?\d[\d\-/]{3,16})";
        foreach (Match m in Regex.Matches(text, sentence, RegexOptions.IgnoreCase))
            found.Add((m.Groups[1].Value.Trim(), NormalizeOrderNumber(m.Groups[1].Value), "sentence", 0.92));

        // 4. Footer "Number …" (layout B): the same number repeated at the foot of the page.
        if (layout?.OrderNumber.Footer == true)
        {
            var tail = text.Length > 400 ? text[^400..] : text;
            foreach (Match m in Regex.Matches(tail, @"NUMBER\s*[:.]?\s*([A-Z]{1,4}-?[A-Z]{0,4}/?\d[\d\-/]{5,16})", RegexOptions.IgnoreCase))
                if (Fits(m.Groups[1].Value)) found.Add((m.Groups[1].Value.Trim(), NormalizeOrderNumber(m.Groups[1].Value), "footer", 0.8));
        }

        // 5. Printed form serial (layout F) — to be confirmed by the team, so low confidence.
        if (layout?.OrderNumber.FormSerial == true)
        {
            var m = Regex.Match(text, @"(?<![A-Z0-9])([A-Z]{2})[\s\-]?(\d{6})(?![A-Z0-9])");
            if (m.Success) found.Add(($"{m.Groups[1].Value}-{m.Groups[2].Value}", m.Groups[1].Value + m.Groups[2].Value, "form serial", 0.6));
        }

        // Never an ORD…, customer number, CSD or VAT number.
        found = found.Where(f => !Regex.IsMatch(f.norm, @"^ORD\d+$|^\d{2}[A-Z]{3}\d{3}$|^MAAA\d+$|^4\d{9}$" ) || f.norm.Length == 10 && layout?.Id == "D").ToList();

        res.OrderNumberCandidates = found.Select(f => f.raw).Distinct().ToList();
        if (found.Count == 0)
        {
            // UNKNOWN layout: a value that matches the supplier documents is accepted.
            if (layout == null && packOrders.Count > 0)
                foreach (Match m in Regex.Matches(text, @"(?<![A-Z0-9])([A-Z]{0,4}[\s\-/]?\d[\d\-/]{4,12}\d)(?![A-Z0-9])"))
                {
                    var n = NormalizeOrderNumber(m.Groups[1].Value);
                    if (packOrders.Contains(n)) { res.OrderNumber = new Field<string> { Value = n, Raw = m.Groups[1].Value, Confidence = 0.85, Source = "matched supplier documents" }; return; }
                }
            res.OrderNumber.Reason = "No order number next to the layout's label, sentence or barcode.";
            return;
        }

        var groups = found.GroupBy(f => f.norm).OrderByDescending(g => g.Max(x => x.conf)).ThenByDescending(g => g.Count()).ToList();
        var top = groups[0];
        var pick = top.OrderByDescending(x => x.conf).First();
        res.OrderNumber = new Field<string> { Value = top.Key, Raw = pick.raw, Confidence = Math.Min(1, pick.conf + (top.Count() > 1 ? 0.05 : 0)), Source = pick.source };
        if (groups.Count > 1)
        {
            res.OrderNumber.Confidence = Math.Min(res.OrderNumber.Confidence, 0.7);
            Review(res, "Two different order numbers found on the official order: " + string.Join(" vs ", groups.Select(g => $"{g.First().raw} ({g.First().source})")) + ".");
        }
        if (packOrders.Count > 0 && packOrders.Contains(top.Key)) res.OrderNumber.Confidence = Math.Max(res.OrderNumber.Confidence, 0.95);
    }

    // ───────── dates ─────────

    public static class DateParser
    {
        private static readonly string[] Months = { "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC" };
        private static readonly Regex AnyDate = new(
            @"(?<![\d])(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})(?!\d)" +                       // 2026/08/28, 2025-12-23
            @"|(?<![\d])(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})(?!\d)" +                     // 05.06.2026, 14/04/2026, 12-05-26
            @"|(?<![\dA-Z])(\d{1,2}[\s\/\-.]?[A-Z]{3,9}\.?[\s\/\-.]?\d{2,4})(?![\dA-Z])" + // 05/Oct/2026, 12-May-26, 25 AUG 2026
            @"|(?<![A-Z])([A-Z]{3,9}\.?\s+\d{1,2},?\s+\d{4})(?!\d)",                       // Oct 27, 2026 / October 22, 2026
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public static IEnumerable<(string iso, string raw)> FindAll(string text)
        {
            foreach (Match m in AnyDate.Matches(text))
            {
                var iso = ToIso(m.Value);
                if (iso != null) yield return (iso, m.Value);
            }
        }

        /// <summary>4-digit first part → year first; otherwise day first (South African). 2-digit year → 20YY.</summary>
        public static string? ToIso(string raw)
        {
            var s = raw.Trim().ToUpperInvariant().Replace(",", " ");
            var parts = Regex.Split(s, @"[\s\/\-.]+").Where(p => p.Length > 0).ToArray();
            if (parts.Length != 3) return null;
            int y, mo, d;
            int Mon(string p) { var i = Array.FindIndex(Months, x => p.StartsWith(x)); return i < 0 ? -1 : i + 1; }
            if (parts[0].Length == 4 && int.TryParse(parts[0], out y))
            {
                if (!int.TryParse(parts[1], out mo)) mo = Mon(parts[1]);
                if (!int.TryParse(parts[2], out d)) return null;
            }
            else if (Regex.IsMatch(parts[0], @"^[A-Z]"))
            {   // Oct 27 2026
                mo = Mon(parts[0]); if (!int.TryParse(parts[1], out d) || !int.TryParse(parts[2], out y)) return null;
            }
            else
            {
                if (!int.TryParse(parts[0], out d)) return null;
                if (!int.TryParse(parts[1], out mo)) mo = Mon(parts[1]);
                if (!int.TryParse(parts[2], out y)) return null;
            }
            if (y < 100) y += 2000;
            if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
            try { return new DateTime(y, mo, d).ToString("yyyy-MM-dd"); } catch { return null; }
        }
    }

    private static Field<string> ReadLabelledDate(string text, List<string> labels)
    {
        foreach (var label in labels)
        {
            var rx = new Regex(Regex.Escape(label) + @"\s*[:.\-]?\s*(?:[A-Z]{3,9},?\s+)?(?:\n\s*)?([^\n]{6,40})", RegexOptions.IgnoreCase);
            foreach (Match m in rx.Matches(text))
            {
                var hit = DateParser.FindAll(m.Groups[1].Value).FirstOrDefault();
                if (hit.iso != null) return new Field<string> { Value = hit.iso, Raw = hit.raw, Confidence = 0.9, Source = $"label '{label}'" };
            }
        }
        return new Field<string> { Reason = "No date next to the order-date label." };
    }

    // ───────── amounts ─────────

    /// <summary>
    /// Amount rule: strip R and spaces (space = thousands); comma+dot → last is decimal; single separator
    /// followed by 2 or 4 digits → decimal; followed by 3 digits → ambiguous (both readings returned).
    /// </summary>
    public static List<decimal> ParseAmountReadings(string raw)
    {
        var s = raw.ToUpperInvariant().Replace("R", "").Replace(" ", "").Replace("\u00A0", "").Trim();
        if (s.Length == 0 || !s.Any(char.IsDigit)) return new();
        var lastComma = s.LastIndexOf(','); var lastDot = s.LastIndexOf('.');
        string Digits(string x, char dec)
        {
            var i = x.LastIndexOf(dec);
            var ip = Regex.Replace(x[..i], @"[^\d]", ""); var fp = Regex.Replace(x[(i + 1)..], @"[^\d]", "");
            return ip + "." + fp;
        }
        decimal? P(string x) => decimal.TryParse(x, NumberStyles.Number, CultureInfo.InvariantCulture, out var v) ? v : null;
        if (lastComma >= 0 && lastDot >= 0)
        {
            var v = P(Digits(s, lastComma > lastDot ? ',' : '.')); return v == null ? new() : new() { v.Value };
        }
        var sep = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : '\0';
        if (sep == '\0') { var v = P(Regex.Replace(s, @"[^\d]", "")); return v == null ? new() : new() { v.Value }; }
        // Multiple occurrences of the same separator → all thousands (e.g. "51,520,50" is handled by the 2-digit rule below).
        var groups = s.Split(sep);
        var tail = groups[^1].Length;
        if (groups.Length > 2 && tail != 2 && tail != 3) { var v = P(Regex.Replace(s, @"[^\d]", "")); return v == null ? new() : new() { v.Value }; }
        if (tail == 2 || tail == 4) { var v = P(Digits(s, sep)); return v == null ? new() : new() { v.Value }; }
        if (tail == 3)
        {
            var list = new List<decimal>();
            var asDecimal = P(Digits(s, sep)); if (asDecimal != null) list.Add(asDecimal.Value);
            var asThousands = P(Regex.Replace(s, @"[^\d]", "")); if (asThousands != null && asThousands != asDecimal) list.Add(asThousands.Value);
            return list;
        }
        var fallback = P(Digits(s, sep)); return fallback == null ? new() : new() { fallback.Value };
    }

    private static readonly Regex MoneyRx = new(@"(?<![\d,.])R?\s?\d{1,3}(?:[ ,.]\d{3})*(?:[.,]\d{2,4})?(?![\d])|(?<![\d,.])R?\s?\d+[.,]\d{2,4}(?![\d])", RegexOptions.Compiled);

    private static void ReadLinesAndTotals(Result res, Layout? layout, string text)
    {
        var totalLabels = layout?.TotalLabels.Count > 0 ? layout.TotalLabels : new List<string> { "GRAND TOTAL", "TOTAL AMOUNT", "TOTAL", "TOTAAL" };
        Field<decimal> ReadMoney(string[] labels, string what)
        {
            foreach (var label in labels)
            {
                var rx = new Regex(@"(?<![A-Z])" + Regex.Escape(label) + @"\s*(?:\(?INCL\w*\)?|\(?EXCL\w*\)?)?\s*[:.\-]?\s*(R?\s?[\d][\d ,.]*\d)", RegexOptions.IgnoreCase);
                foreach (Match m in rx.Matches(text))
                {
                    var readings = ParseAmountReadings(m.Groups[1].Value);
                    if (readings.Count == 0) continue;
                    return new Field<decimal> { Value = readings[0], Raw = m.Groups[1].Value.Trim(), Confidence = readings.Count == 1 ? 0.9 : 0.6, Source = $"label '{label}'", Reason = readings.Count > 1 ? "3-decimal reading is ambiguous — resolved by arithmetic where possible." : null };
                }
            }
            return new Field<decimal> { Reason = $"No {what} label on this layout." };
        }
        var total = ReadMoney(totalLabels.ToArray(), "total");
        var sub = ReadMoney(new[] { "SUBTOTAL", "SUB TOTAL", "SUB-TOTAL", "SUBTOTAAL", "TOTAL EXCL", "EXCL VAT", "NET" }, "subtotal");
        var vat = ReadMoney(new[] { "VAT @ 15%", "VAT 15%", "VAT", "BTW", "TAX" }, "VAT");

        // Lines: qty × unit price = value, in that order on a row. Keep candidate readings per cell.
        foreach (var row in text.Split('\n'))
        {
            var nums = MoneyRx.Matches(row).Select(m => m.Value.Trim()).Where(v => v.Any(char.IsDigit)).ToList();
            if (nums.Count < 3) continue;
            var qtyR = ParseAmountReadings(nums[^3]); var upR = ParseAmountReadings(nums[^2]); var lvR = ParseAmountReadings(nums[^1]);
            if (qtyR.Count == 0 || upR.Count == 0 || lvR.Count == 0) continue;
            (decimal q, decimal u, decimal v)? ok = null;
            foreach (var q in qtyR) foreach (var u in upR) foreach (var v in lvR)
                if (Math.Abs(Math.Round(q * u, 2) - Math.Round(v, 2)) <= 0.05m && q > 0 && q < 100000) { ok = (q, u, v); break; }
            if (ok == null) continue;
            var desc = row[..row.IndexOf(nums[^3], StringComparison.Ordinal)].Trim();
            var code = Regex.Match(desc, @"\b([A-Z]{1,4}\d{2,3}-?\d{2,4}|\d{6})\b").Groups[1].Value;
            var unit = Regex.Match(row, @"\b(EA|ROL|BOX|PK|PKT|PACK|CTN|CASE|BAG|KG|L|UNIT|EACH|DOZ|STUK)\b", RegexOptions.IgnoreCase).Value;
            res.Lines.Add(new Line { BuyerCode = code.Length > 0 ? code : null, Description = Clean(Regex.Replace(desc, Regex.Escape(code), "")), Quantity = ok.Value.q, UnitPrice = ok.Value.u, LineValue = ok.Value.v, Unit = unit.Length > 0 ? unit.ToUpperInvariant() : null, Raw = row.Trim() });
        }

        // Arithmetic: subtotal + VAT = total, or total = Σ lines (×1.15 when the lines are ex-VAT).
        var lineSum = res.Lines.Sum(l => l.LineValue ?? 0);
        decimal? Pick(Field<decimal> f, Func<decimal, bool> fits)
        {
            if (!f.Has || f.Raw == null) return f.Has ? f.Value : null;
            var readings = ParseAmountReadings(f.Raw);
            if (readings.Count == 0) return f.Value;
            return readings.FirstOrDefault(fits, readings[0]);
        }
        bool Near(decimal a, decimal b) => Math.Abs(Math.Round(a, 2) - Math.Round(b, 2)) <= 0.05m;
        if (total.Has && total.Raw != null)
        {
            var tReadings = ParseAmountReadings(total.Raw);
            if (tReadings.Count == 0) tReadings.Add(total.Value);
            decimal? chosen = null;
            foreach (var t in tReadings)
            {
                if (sub.Has && vat.Has && sub.Raw != null && vat.Raw != null)
                {
                    var vatReadings = ParseAmountReadings(vat.Raw);
                    var s2 = Pick(sub, s => vatReadings.Any(v => Near(s + v, t)));
                    var v2 = Pick(vat, v => s2 != null && Near(s2.Value + v, t));
                    if (s2 != null && v2 != null && Near(s2.Value + v2.Value, t)) { chosen = t; sub.Value = s2.Value; vat.Value = v2.Value; break; }
                }
                if (res.Lines.Count > 0 && (Near(lineSum, t) || Near(lineSum * 1.15m, t))) { chosen = t; break; }
            }
            if (chosen != null) { total.Value = chosen.Value; total.Confidence = Math.Max(total.Confidence, 0.9); res.ArithmeticOk = true; }
            else if (tReadings.Count > 1) { total.Confidence = 0.5; total.Reason = "Ambiguous decimal separator and the arithmetic did not settle it."; }
            else if (res.Lines.Count == 0 && !(sub.Has && vat.Has)) res.ArithmeticOk = true; // nothing to check against
            res.Total2 = Math.Round(total.Value, 2, MidpointRounding.AwayFromZero);
        }
        res.Total = total; res.Subtotal = sub; res.Vat = vat;
        if (!res.ArithmeticOk && res.Lines.Count > 0 && !total.Has) res.ArithmeticOk = true;
    }

    private static Field<string> ReadSupplier(string text)
    {
        var m = Regex.Match(text, @"(?:SUPPLIER(?:\s+NAME(?:\s*&\s*ADDRESS)?)?|SUPPLIED BY|VENDOR(?:\s+NAME)?)\s*[:.\-]?\s*\n?\s*([A-Z][A-Z0-9 &().,\-]{4,60})");
        if (m.Success) return new Field<string> { Value = Clean(m.Groups[1].Value), Raw = m.Groups[1].Value, Confidence = 0.8, Source = "supplier block" };
        var n = Regex.Match(text, @"(PROMED TECHNOLOGIES[A-Z ()]*|PHARMATECH[A-Z ()]*|ACCESS MEDICAL[A-Z ()]*|SEBENZANI TRADING[A-Z0-9 ()]*)");
        if (n.Success) return new Field<string> { Value = Clean(n.Value), Raw = n.Value, Confidence = 0.7, Source = "company name on page" };
        return new Field<string> { Reason = "Supplier not named on the page." };
    }

    private static string Clean(string s) => Regex.Replace(s, @"\s+", " ").Trim(' ', ':', '.', '-', '|');
}
