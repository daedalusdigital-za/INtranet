using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services.Finance;

/// <summary>
/// Splits one long scan (many invoice packs fed through the scanner in one go) into packs.
///
/// Each page is classified by <see cref="PackAnalyzer.AnalyzePage"/>; pages are then grouped by the
/// numbers they carry (IN… invoice, OR-/GL- customer order, ORD… confirmation) and by document order
/// (a pack is usually DN → INV → OC → EML → PO, so a second DN after an INV starts a new pack).
/// Pages that could not be placed are returned unassigned so the user can drag them where they belong.
/// </summary>
public static class PackSplitter
{
    public class Page
    {
        public int Number { get; set; }
        public string Type { get; set; } = "UNK";
        public double Confidence { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? OrderNumber { get; set; }
        public string? ConfirmationNumber { get; set; }
        public string? CustomerNumber { get; set; }
        public string? Date { get; set; }
        public int TextLength { get; set; }
        public bool Continuation { get; set; }
        /// <summary>Why the page landed in its group (for the UI tooltip).</summary>
        public string? Reason { get; set; }
    }

    public class Group
    {
        public int Index { get; set; }
        public List<int> Pages { get; set; } = new();
        public string? InvoiceNumber { get; set; }
        public string? OrderNumber { get; set; }
        public string? ConfirmationNumber { get; set; }
        public string? CustomerNumber { get; set; }
        /// <summary>high | medium | low — how sure the splitter is that these pages are one pack.</summary>
        public string Confidence { get; set; } = "low";
        public List<string> Reasons { get; set; } = new();
        public PackAnalyzer.Result? Analysis { get; set; }
    }

    public class Result
    {
        public List<Page> Pages { get; set; } = new();
        public List<Group> Groups { get; set; } = new();
        public List<int> Unassigned { get; set; } = new();
        public List<string> Notes { get; set; } = new();
    }

    private static readonly Regex ContinuationRx = new(@"PAGE\s*([2-9]|\d{2})\s*(?:OF|/)\s*\d+|CONTINUED|CONT\.|B/F|BROUGHT\s+FORWARD", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly string[] DocOrder = { "DN", "INV", "OC", "EML", "PO" };

    public static Result Split(IList<string> pageTexts, IList<List<string>>? barcodes = null)
    {
        var res = new Result();
        var analysed = new List<PackAnalyzer.PageResult>();
        for (var i = 0; i < pageTexts.Count; i++)
        {
            var pr = PackAnalyzer.AnalyzePage(i + 1, pageTexts[i]);
            analysed.Add(pr);
            res.Pages.Add(new Page
            {
                Number = pr.Page, Type = pr.Type, Confidence = pr.Confidence, InvoiceNumber = pr.InvoiceNumber, OrderNumber = pr.OrderNumber,
                ConfirmationNumber = pr.ConfirmationNumber, CustomerNumber = pr.CustomerNumber, Date = pr.Date, TextLength = pr.TextLength,
                Continuation = ContinuationRx.IsMatch(pageTexts[i] ?? "") && pr.InvoiceNumber == null,
            });
        }

        // ── pass 1: sequential grouping ──
        var groups = new List<Group>();
        Group? cur = null;
        Group NewGroup(int page, string why)
        {
            var g = new Group { Index = groups.Count };
            groups.Add(g);
            Add(g, page, why);
            return g;
        }
        void Add(Group g, int page, string why)
        {
            g.Pages.Add(page);
            var p = res.Pages[page - 1];
            p.Reason = why;
            g.InvoiceNumber ??= p.InvoiceNumber;
            g.OrderNumber ??= p.OrderNumber;
            g.ConfirmationNumber ??= p.ConfirmationNumber;
            g.CustomerNumber ??= p.CustomerNumber;
        }
        bool Links(Group g, Page p) =>
            (p.OrderNumber != null && g.OrderNumber == p.OrderNumber) ||
            (p.ConfirmationNumber != null && g.ConfirmationNumber == p.ConfirmationNumber);
        bool Conflicts(Group g, Page p) =>
            (p.InvoiceNumber != null && g.InvoiceNumber != null && p.InvoiceNumber != g.InvoiceNumber) ||
            (p.OrderNumber != null && g.OrderNumber != null && p.OrderNumber != g.OrderNumber && p.InvoiceNumber == null && p.ConfirmationNumber == null) ||
            (p.ConfirmationNumber != null && g.ConfirmationNumber != null && p.ConfirmationNumber != g.ConfirmationNumber);
        bool TypeRepeats(Group g, Page p)
        {
            if (p.Type == "UNK") return false;
            var types = g.Pages.Select(n => res.Pages[n - 1].Type).ToList();
            // A second copy of a DN / INV / OC only counts as a pack boundary when the group already looks like a pack.
            return types.Contains(p.Type) && types.Distinct().Count(t => t != "UNK") >= 2;
        }
        bool OrderResets(Group g, Page p)
        {
            // DN or INV appearing after later-stage documents (OC/EML/PO) in the same group → next pack has started.
            if (p.Type is not ("DN" or "INV")) return false;
            var stages = g.Pages.Select(n => Array.IndexOf(DocOrder, res.Pages[n - 1].Type)).Where(s => s >= 0).ToList();
            return stages.Count > 0 && stages.Max() >= 2 && Array.IndexOf(DocOrder, p.Type) < stages.Max();
        }

        foreach (var p in res.Pages)
        {
            var n = p.Number;
            if (cur == null) { cur = NewGroup(n, "first page"); continue; }

            // Blank / unreadable page: stays with the current pack but is flagged.
            if (p.TextLength < 40 && p.Type == "UNK") { Add(cur, n, "almost no text — kept with the previous pages"); continue; }

            if (p.Continuation) { Add(cur, n, "continuation page"); continue; }

            if (p.InvoiceNumber != null)
            {
                if (cur.InvoiceNumber == null || cur.InvoiceNumber == p.InvoiceNumber) { Add(cur, n, $"invoice {p.InvoiceNumber}"); continue; }
                // Different invoice: does an earlier group own it (pages scanned out of order)?
                var owner = groups.FirstOrDefault(g => g.InvoiceNumber == p.InvoiceNumber);
                if (owner != null) { Add(owner, n, $"invoice {p.InvoiceNumber} belongs to pack {owner.Index + 1}"); continue; }
                cur = NewGroup(n, $"new invoice {p.InvoiceNumber}");
                continue;
            }

            if (Links(cur, p) && !Conflicts(cur, p)) { Add(cur, n, p.OrderNumber != null ? $"order {p.OrderNumber}" : $"confirmation {p.ConfirmationNumber}"); continue; }
            var linked = groups.FirstOrDefault(g => Links(g, p) && !Conflicts(g, p));
            if (linked != null) { Add(linked, n, $"matches pack {linked.Index + 1} by {(p.OrderNumber != null ? "order " + p.OrderNumber : "confirmation " + p.ConfirmationNumber)}"); continue; }

            if (Conflicts(cur, p) || OrderResets(cur, p) || TypeRepeats(cur, p))
            {
                cur = NewGroup(n, Conflicts(cur, p) ? "different order / confirmation number" : OrderResets(cur, p) ? $"a {PackAnalyzer.TypeNames.GetValueOrDefault(p.Type, p.Type).ToLowerInvariant()} after the previous pack's later documents" : $"second {PackAnalyzer.TypeNames.GetValueOrDefault(p.Type, p.Type).ToLowerInvariant()}");
                continue;
            }

            Add(cur, n, p.Type == "UNK" ? "unrecognised — kept with the previous pages" : "follows on from the previous page");
        }

        // ── pass 2: merge groups that turn out to be the same pack (same invoice / order / confirmation) ──
        for (var i = groups.Count - 1; i > 0; i--)
        {
            var g = groups[i];
            var same = groups.Take(i).FirstOrDefault(o =>
                (g.InvoiceNumber != null && o.InvoiceNumber == g.InvoiceNumber) ||
                (g.InvoiceNumber == null && o.InvoiceNumber == null && ((g.OrderNumber != null && o.OrderNumber == g.OrderNumber) || (g.ConfirmationNumber != null && o.ConfirmationNumber == g.ConfirmationNumber))));
            if (same == null) continue;
            foreach (var pg in g.Pages) { same.Pages.Add(pg); res.Pages[pg - 1].Reason += $" (merged into pack {same.Index + 1})"; }
            same.OrderNumber ??= g.OrderNumber; same.ConfirmationNumber ??= g.ConfirmationNumber; same.CustomerNumber ??= g.CustomerNumber;
            groups.RemoveAt(i);
        }

        // ── pass 3: a lone group with no numbers and no DN/INV is "unassigned" rather than a pack ──
        foreach (var g in groups.ToList())
        {
            var types = g.Pages.Select(n => res.Pages[n - 1].Type).ToList();
            if (g.InvoiceNumber == null && g.OrderNumber == null && g.ConfirmationNumber == null && !types.Contains("DN") && !types.Contains("INV"))
            {
                res.Unassigned.AddRange(g.Pages);
                foreach (var pg in g.Pages) res.Pages[pg - 1].Reason = "could not be matched to a pack";
                groups.Remove(g);
            }
        }

        // ── finalise: order pages inside each group, re-index, analyse, grade ──
        for (var i = 0; i < groups.Count; i++)
        {
            var g = groups[i];
            g.Index = i;
            g.Pages.Sort();
            var texts = g.Pages.Select(n => pageTexts[n - 1]).ToList();
            var codes = barcodes == null ? null : g.Pages.Select(n => n - 1 < barcodes.Count ? barcodes[n - 1] : new List<string>()).ToList();
            try { g.Analysis = PackAnalyzer.Analyze(texts, codes); } catch { g.Analysis = null; }
            g.InvoiceNumber = g.Analysis?.InvoiceNumber ?? g.InvoiceNumber;
            g.OrderNumber = g.Analysis?.OrderNumber ?? g.OrderNumber;
            g.ConfirmationNumber = g.Analysis?.ConfirmationNumber ?? g.ConfirmationNumber;
            g.CustomerNumber = g.Analysis?.CustomerNumber ?? g.CustomerNumber;

            var types = g.Pages.Select(n => res.Pages[n - 1].Type).Where(t => t != "UNK").Distinct().Count();
            var unk = g.Pages.Count(n => res.Pages[n - 1].Type == "UNK");
            var invPages = g.Pages.Count(n => res.Pages[n - 1].InvoiceNumber != null);
            var otherInv = g.Pages.Select(n => res.Pages[n - 1].InvoiceNumber).Where(x => x != null && x != g.InvoiceNumber).Distinct().ToList();
            if (otherInv.Count > 0) g.Reasons.Add("Pages carry different invoice numbers: " + string.Join(", ", otherInv) + ".");
            if (g.InvoiceNumber == null) g.Reasons.Add("No invoice number could be read — type it in.");
            if (unk > 0) g.Reasons.Add($"{unk} page(s) not recognised.");
            if (types < 2) g.Reasons.Add("Only one document type found.");
            g.Confidence = otherInv.Count == 0 && g.InvoiceNumber != null && invPages >= 1 && types >= 3 && unk == 0 ? "high"
                         : otherInv.Count == 0 && (g.InvoiceNumber != null || types >= 2) ? "medium" : "low";
        }
        res.Groups = groups;
        res.Unassigned.Sort();

        res.Notes.Add($"{pageTexts.Count} page(s) → {groups.Count} pack(s)" + (res.Unassigned.Count > 0 ? $", {res.Unassigned.Count} page(s) unplaced" : "") + ".");
        return res;
    }
}
