using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services.Finance;

/// <summary>
/// Splits a batch of scanned pages (one or many files) into invoice packs.
///
/// Rule: one pack = one invoice. The invoice number is the anchor (printed on the DN and the INV);
/// supporting pages (OC / e-mail / PO) are attached by order number to <b>every</b> pack whose order
/// they show, so an order invoiced twice shares its paperwork. Pages with no readable number join the
/// pack of the page before them. Nothing is dropped: what cannot be placed is listed as unassigned.
/// </summary>
public static class PackSplitter
{
    /// <summary>One scanned page in the batch, identified across files by a global index (1-based).</summary>
    public class Page
    {
        public int Number { get; set; }
        public int FileIndex { get; set; }
        public string FileName { get; set; } = "";
        public int PageInFile { get; set; }
        public string Type { get; set; } = "UNK";
        public double Confidence { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? OrderNumber { get; set; }
        public List<string> OrderNumbers { get; set; } = new();
        public string? ConfirmationNumber { get; set; }
        public string? CustomerNumber { get; set; }
        public string? Supplier { get; set; }
        public string? Date { get; set; }
        public int TextLength { get; set; }
        public int Rotation { get; set; }
        public bool Continuation { get; set; }
        /// <summary>Why the page landed where it did (split log).</summary>
        public string? Reason { get; set; }
        /// <summary>Groups this page belongs to (more than one when shared between invoices of the same order).</summary>
        public List<int> Groups { get; set; } = new();
    }

    public class Group
    {
        public int Index { get; set; }
        /// <summary>Pages in reading order. Shared pages are included (see <see cref="SharedPages"/>).</summary>
        public List<int> Pages { get; set; } = new();
        public List<int> SharedPages { get; set; } = new();
        public string? InvoiceNumber { get; set; }
        public string? OrderNumber { get; set; }
        public string? ConfirmationNumber { get; set; }
        public string? CustomerNumber { get; set; }
        public string? Supplier { get; set; }
        public List<string> SourceFiles { get; set; } = new();
        /// <summary>high | medium | low — how sure the splitter is that these pages are one pack.</summary>
        public string Confidence { get; set; } = "low";
        public bool NeedsReview { get; set; }
        public List<string> Reasons { get; set; } = new();
        public PackAnalyzer.Result? Analysis { get; set; }
    }

    public class LogEntry { public int Page { get; set; } public string File { get; set; } = ""; public int PageInFile { get; set; } public string Type { get; set; } = ""; public string Placed { get; set; } = ""; public string Reason { get; set; } = ""; }

    public class Result
    {
        public List<Page> Pages { get; set; } = new();
        public List<Group> Groups { get; set; } = new();
        public List<int> Unassigned { get; set; } = new();
        public List<LogEntry> SplitLog { get; set; } = new();
        public List<string> Notes { get; set; } = new();
    }

    /// <summary>Input page: text, barcodes, rotation and where it came from.</summary>
    public record Input(string Text, List<string>? Barcodes, int Rotation, int FileIndex, string FileName, int PageInFile);

    private static readonly Regex ContinuationRx = new(@"PAGE\s*([2-9]|\d{2})\s*(?:OF|/)\s*\d+|CONTINUED|CONT\.|B/F|BROUGHT\s+FORWARD", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Single-file convenience overload.</summary>
    public static Result Split(IList<string> pageTexts, IList<List<string>>? barcodes = null, string fileName = "")
        => Split(pageTexts.Select((t, i) => new Input(t, barcodes != null && i < barcodes.Count ? barcodes[i] : null, 0, 0, fileName, i + 1)).ToList());

    public static Result Split(IList<Input> inputs)
    {
        var res = new Result();
        var texts = inputs.Select(i => i.Text ?? "").ToList();
        for (var i = 0; i < inputs.Count; i++)
        {
            var pr = PackAnalyzer.AnalyzePage(i + 1, texts[i]);
            res.Pages.Add(new Page
            {
                Number = i + 1, FileIndex = inputs[i].FileIndex, FileName = inputs[i].FileName, PageInFile = inputs[i].PageInFile,
                Type = pr.Type, Confidence = pr.Confidence, InvoiceNumber = pr.InvoiceNumber, OrderNumber = pr.OrderNumber, OrderNumbers = pr.OrderNumbers,
                ConfirmationNumber = pr.ConfirmationNumber, CustomerNumber = pr.CustomerNumber, Supplier = pr.Supplier, Date = pr.Date, TextLength = pr.TextLength, Rotation = inputs[i].Rotation,
                Continuation = ContinuationRx.IsMatch(texts[i]) && pr.InvoiceNumber == null,
            });
        }
        // Official orders: read the number by layout (label / barcode), which is far more reliable than a stray token.
        var supplierOrders = res.Pages.Where(x => x.Type is "DN" or "INV" or "OC" && x.OrderNumber != null).Select(x => x.OrderNumber!).Distinct().ToList();
        foreach (var p in res.Pages.Where(p => p.Type == "PO" || (p.Type == "UNK" && p.TextLength >= 80)))
        {
            var oo = OfficialOrderReader.Read(texts[p.Number - 1], inputs[p.Number - 1].Barcodes, supplierOrders, null);
            if (p.Type == "UNK" && !oo.IsOfficialOrder) continue;
            if (p.Type == "UNK") p.Type = "PO";
            if (oo.OrderNumber.Has) { p.OrderNumber = oo.OrderNumber.Value; if (!p.OrderNumbers.Contains(p.OrderNumber)) p.OrderNumbers.Insert(0, p.OrderNumber); }
            if (oo.HandwrittenOrd.Count > 0 && p.ConfirmationNumber == null) p.ConfirmationNumber = oo.HandwrittenOrd[0];
        }

        // ── 1. One pack per invoice number (DN / INV pages) ──
        var groups = new List<Group>();
        var byInvoice = new Dictionary<string, Group>();
        foreach (var p in res.Pages.Where(p => p.InvoiceNumber != null && p.Type is "DN" or "INV"))
        {
            if (!byInvoice.TryGetValue(p.InvoiceNumber!, out var g))
            {
                g = new Group { Index = groups.Count, InvoiceNumber = p.InvoiceNumber }; groups.Add(g); byInvoice[p.InvoiceNumber!] = g;
            }
            Place(g, p, $"invoice {p.InvoiceNumber} on the {PackAnalyzer.TypeNames[p.Type].ToLowerInvariant()}");
        }
        // Pages of other types that nonetheless carry an invoice number (an OC quoting the invoice, an e-mail reply).
        foreach (var p in res.Pages.Where(p => p.InvoiceNumber != null && p.Groups.Count == 0 && byInvoice.ContainsKey(p.InvoiceNumber!)))
            Place(byInvoice[p.InvoiceNumber!], p, $"mentions invoice {p.InvoiceNumber}");

        // Order number per pack = vote over its pages; a pack may still have none (unreadable).
        foreach (var g in groups)
        {
            g.OrderNumber = Vote(g.Pages.Select(n => res.Pages[n - 1].OrderNumber));
            g.CustomerNumber = Vote(g.Pages.Select(n => res.Pages[n - 1].CustomerNumber));
            g.Supplier = Vote(g.Pages.Select(n => res.Pages[n - 1].Supplier));
        }

        // ── 2. Attach supporting pages (OC / EML / PO) by order number — to every pack with that order ──
        foreach (var p in res.Pages.Where(p => p.Groups.Count == 0 && p.OrderNumbers.Count > 0))
        {
            var targets = groups.Where(g => g.OrderNumber != null && p.OrderNumbers.Contains(g.OrderNumber)).ToList();
            if (targets.Count == 0) continue;
            foreach (var g in targets)
            {
                // Same order invoiced more than once → the paperwork is shared between those packs.
                var twins = targets.Count(t => t.OrderNumber == g.OrderNumber) > 1;
                Place(g, p, $"order {g.OrderNumber} on the {PackAnalyzer.TypeNames.GetValueOrDefault(p.Type, "page").ToLowerInvariant()}" + (twins ? " — shared, same order invoiced more than once" : ""), shared: twins);
            }
        }
        // Confirmation number as a secondary link (OC with blank band that the PO's handwritten ORD identifies).
        foreach (var g in groups) g.ConfirmationNumber = Vote(g.Pages.Select(n => res.Pages[n - 1].ConfirmationNumber));
        foreach (var p in res.Pages.Where(p => p.Groups.Count == 0 && p.ConfirmationNumber != null))
        {
            var targets = groups.Where(g => g.ConfirmationNumber == p.ConfirmationNumber).ToList();
            foreach (var g in targets) Place(g, p, $"confirmation {p.ConfirmationNumber}", shared: targets.Count > 1);
        }
        // Packs with no order number yet: take it from the supporting pages that joined by confirmation.
        foreach (var g in groups.Where(g => g.OrderNumber == null)) g.OrderNumber = Vote(g.Pages.Select(n => res.Pages[n - 1].OrderNumber));

        // ── 3. Pages with no readable number join the pack of the page before them (same file) ──
        foreach (var p in res.Pages.Where(p => p.Groups.Count == 0))
        {
            var prev = res.Pages.Take(p.Number - 1).Reverse().FirstOrDefault(x => x.FileIndex == p.FileIndex && x.Groups.Count > 0);
            if (prev == null) continue;
            var g = groups[prev.Groups[^1]];
            // A DN / INV whose invoice number is unreadable but whose order differs from the pack is the start of
            // another pack, not a tail of this one — leave it for step 4 / unassigned.
            if (p.Type is "DN" or "INV" && p.OrderNumber != null && g.OrderNumber != null && p.OrderNumber != g.OrderNumber) continue;
            var why = p.TextLength < 40 ? "almost no text — kept with the page before it"
                    : p.Continuation ? "continuation page — kept with the page before it"
                    : p.Type == "UNK" ? "unrecognised — kept with the page before it"
                    : $"{PackAnalyzer.TypeNames[p.Type].ToLowerInvariant()} with no readable number — kept with the page before it";
            Place(g, p, why);
            if (p.OrderNumber != null && g.OrderNumber != null && p.OrderNumber != g.OrderNumber)
            { g.NeedsReview = true; g.Reasons.Add($"Page {p.Number} shows order {p.OrderNumber} but sits with order {g.OrderNumber} — check it belongs here."); }
        }

        // ── 4. Supporting documents for an order with no DN / INV in this batch ──
        //       Kept together as a low-confidence pack so the clerk can type the invoice number, not dropped.
        var orphanByOrder = res.Pages.Where(p => p.Groups.Count == 0 && p.OrderNumber != null && p.Type is "OC" or "PO" or "EML" or "DN" or "INV").GroupBy(p => p.OrderNumber!).ToList();
        foreach (var grp in orphanByOrder)
        {
            if (grp.Count() < 2 && !grp.Any(p => p.Type is "DN" or "INV")) continue; // a single stray supporting page goes to unassigned
            var g = new Group { Index = groups.Count, OrderNumber = grp.Key }; groups.Add(g);
            foreach (var p in grp) Place(g, p, $"order {grp.Key} — no readable invoice number for it in this batch");
            g.Reasons.Add("Invoice number not read for this order — type it in or add the missing pages.");
            g.NeedsReview = true;
        }

        // ── 5. Everything else is unassigned, with a reason ──
        foreach (var p in res.Pages.Where(p => p.Groups.Count == 0))
        {
            p.Reason = p.TextLength < 40 ? "almost no text could be read" : p.Type == "UNK" ? "page type not recognised and no numbers read" : $"{PackAnalyzer.TypeNames[p.Type].ToLowerInvariant()} whose numbers match no pack in the batch";
            res.Unassigned.Add(p.Number);
        }

        // ── finalise ──
        groups.RemoveAll(g => g.Pages.Count == 0);
        for (var i = 0; i < groups.Count; i++)
        {
            var g = groups[i];
            g.Index = i;
            g.Pages.Sort();
            g.SharedPages.Sort();
            g.SourceFiles = g.Pages.Select(n => res.Pages[n - 1].FileName).Distinct().ToList();
            var ptexts = g.Pages.Select(n => texts[n - 1]).ToList();
            var codes = g.Pages.Select(n => inputs[n - 1].Barcodes ?? new List<string>()).ToList();
            var rots = g.Pages.Select(n => res.Pages[n - 1].Rotation).ToList();
            var shared = g.Pages.Select(n => g.SharedPages.Contains(n)).ToList();
            try { g.Analysis = PackAnalyzer.Analyze(ptexts, codes, rots, shared); } catch { g.Analysis = null; }
            g.InvoiceNumber ??= g.Analysis?.InvoiceNumber;
            g.OrderNumber = g.Analysis?.OrderNumber ?? g.OrderNumber;
            g.ConfirmationNumber = g.Analysis?.ConfirmationNumber ?? g.ConfirmationNumber;
            g.CustomerNumber = g.Analysis?.CustomerNumber ?? g.CustomerNumber;
            g.Supplier = g.Analysis?.Supplier ?? g.Supplier;

            var types = g.Pages.Select(n => res.Pages[n - 1].Type).Where(t => t != "UNK").Distinct().Count();
            var unk = g.Pages.Count(n => res.Pages[n - 1].Type == "UNK" && res.Pages[n - 1].TextLength >= 40);
            var otherInv = g.Pages.Select(n => res.Pages[n - 1].InvoiceNumber).Where(x => x != null && x != g.InvoiceNumber).Distinct().ToList();
            if (otherInv.Count > 0) { g.Reasons.Add("Pages carry different invoice numbers: " + string.Join(", ", otherInv) + "."); g.NeedsReview = true; }
            if (g.InvoiceNumber == null) g.Reasons.Add("No invoice number could be read — type it in.");
            if (unk > 0) g.Reasons.Add($"{unk} page(s) not recognised.");
            if (g.SourceFiles.Count > 1) g.Reasons.Add($"Pack spans {g.SourceFiles.Count} files.");
            g.Confidence = otherInv.Count == 0 && g.InvoiceNumber != null && types >= 3 && unk == 0 && !g.NeedsReview ? "high"
                         : otherInv.Count == 0 && (g.InvoiceNumber != null || types >= 2) ? "medium" : "low";
        }
        res.Groups = groups;
        foreach (var p in res.Pages) p.Groups = groups.Where(g => g.Pages.Contains(p.Number)).Select(g => g.Index).ToList();
        res.Unassigned.Sort();

        foreach (var p in res.Pages)
            res.SplitLog.Add(new LogEntry
            {
                Page = p.Number, File = p.FileName, PageInFile = p.PageInFile, Type = p.Type,
                Placed = p.Groups.Count == 0 ? "UNASSIGNED" : string.Join(" + ", p.Groups.Select(gi => $"Pack {gi + 1}" + (groups[gi].InvoiceNumber != null ? $" ({groups[gi].InvoiceNumber})" : ""))),
                Reason = p.Reason ?? "",
            });
        var files = inputs.Select(i => i.FileName).Distinct().Count();
        var sharedCount = res.Pages.Count(p => p.Groups.Count > 1);
        res.Notes.Add($"{inputs.Count} page(s) in {files} file(s) → {groups.Count} pack(s)" + (res.Unassigned.Count > 0 ? $", {res.Unassigned.Count} page(s) unplaced" : "") + (sharedCount > 0 ? $", {sharedCount} page(s) shared between packs" : "") + ".");
        return res;
    }

    private static void Place(Group g, Page p, string why, bool shared = false)
    {
        if (g.Pages.Contains(p.Number)) return;
        g.Pages.Add(p.Number);
        if (shared) g.SharedPages.Add(p.Number);
        p.Groups.Add(g.Index);
        p.Reason = p.Reason == null ? why : p.Reason + "; " + why;
        g.InvoiceNumber ??= p.InvoiceNumber;
        g.ConfirmationNumber ??= p.ConfirmationNumber;
        g.CustomerNumber ??= p.CustomerNumber;
        g.Supplier ??= p.Supplier;
    }

    private static string? Vote(IEnumerable<string?> values) =>
        values.Where(v => v != null).GroupBy(v => v!).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault();
}
