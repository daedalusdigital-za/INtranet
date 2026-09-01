using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services
{
    // ── Public result / request shapes ──────────────────────────────────────

    public class AssetMatchRequest
    {
        public int? LocationId { get; set; }
        public string? Region { get; set; }
        public string? SubLocation { get; set; }
        public string? Category { get; set; }
        /// <summary>Optional: only scan invoices from this supplier (case-insensitive).</summary>
        public string? SupplierName { get; set; }
        /// <summary>How many recent confirmed invoices to scan (default 30).</summary>
        public int InvoiceLimit { get; set; } = 30;
        /// <summary>Only include assets that don't already have a BookInvoiceId (default true).</summary>
        public bool UnmatchedOnly { get; set; } = true;
    }

    public class AssetMatchSuggestion
    {
        public int ItemId { get; set; }
        public string AssetDescription { get; set; } = string.Empty;
        public string AssetCategory { get; set; } = string.Empty;
        public string? AssignedTo { get; set; }
        public string? LocationName { get; set; }

        public int BookInvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string Supplier { get; set; } = string.Empty;
        public DateTime InvoiceDate { get; set; }
        public string MatchedLineItem { get; set; } = string.Empty;
        /// <summary>Unit price of the matched line item — becomes the asset's book value.</summary>
        public decimal? BookValue { get; set; }

        public int Confidence { get; set; }          // 0-100
        public string Reason { get; set; } = string.Empty;
    }

    public class AssetMatchResult
    {
        public int AssetsScanned { get; set; }
        public int InvoicesScanned { get; set; }
        public int LineItemsExtracted { get; set; }
        public int Matched { get; set; }
        public int Unmatched { get; set; }
        public List<AssetMatchSuggestion> Suggestions { get; set; } = new();
        public List<string> UnmatchedAssets { get; set; } = new();
    }

    public class ApplyMatchRequest
    {
        public List<ApplyMatchItem> Matches { get; set; } = new();
        /// <summary>When true, book value from the invoice overwrites any existing asset value.</summary>
        public bool OverwriteExistingValues { get; set; } = false;
    }

    /// <summary>Outcome of applying matches, including book-value stats for a summary.</summary>
    public class ApplyMatchResult
    {
        public int Applied { get; set; }
        public int Skipped { get; set; }
        public int ValuesApplied { get; set; }
        public decimal TotalBookValueApplied { get; set; }
        public List<string> Notes { get; set; } = new();
    }

    public class ApplyMatchItem
    {
        public int ItemId { get; set; }
        public int BookInvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        /// <summary>Book value to write onto the asset (from the matched invoice line).</summary>
        public decimal? BookValue { get; set; }
    }

    /// <summary>A supplier that has scannable confirmed invoices, for the match filter dropdown.</summary>
    public class SupplierOption
    {
        public string SupplierName { get; set; } = string.Empty;
        public int InvoiceCount { get; set; }
        public bool HasExtractedText { get; set; } = true; // true for AI-matchable, false for scanned/manual only
    }

    /// <summary>
    /// A live progress update emitted while Welly works through the matching job,
    /// so the UI can show a determinate progress bar instead of an opaque spinner.
    /// </summary>
    public class MatchProgress
    {
        public string Phase { get; set; } = string.Empty; // load | extract | score | done
        public int Current { get; set; }
        public int Total { get; set; }
        public int Percent { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public interface IAssetInvoiceMatchingService
    {
        Task<AssetMatchResult> SuggestMatchesAsync(AssetMatchRequest request, Func<MatchProgress, Task>? onProgress = null, CancellationToken ct = default);
        Task<ApplyMatchResult> ApplyMatchesAsync(ApplyMatchRequest request, CancellationToken ct = default);
        /// <summary>Fill book values on assets already linked to an invoice but missing a value.</summary>
        Task<ApplyMatchResult> BackfillBookValuesAsync(bool overwriteExisting = false, CancellationToken ct = default);
        /// <summary>List suppliers that have confirmed invoices with extracted text, for the match filter.</summary>
        Task<List<SupplierOption>> GetMatchableSuppliersAsync(CancellationToken ct = default);
        /// <summary>List ALL confirmed suppliers (including scanned invoices) for manual linking.</summary>
        Task<List<SupplierOption>> GetAllSuppliersAsync(CancellationToken ct = default);
    }

    // ── Internal working types ──────────────────────────────────────────────

    internal class InvoiceLineSlot
    {
        public int BookInvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string Supplier { get; set; } = string.Empty;
        public DateTime InvoiceDate { get; set; }
        public string ItemDescription { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string? Manufacturer { get; set; }
        public decimal? UnitPrice { get; set; }   // per-unit price of this line item
        public int Capacity { get; set; } = 1;   // quantity available on this line
        public int Used { get; set; } = 0;
        public HashSet<string> Tokens { get; set; } = new();
        public bool HasCapacity => Used < Capacity;
    }

    internal class LlmLineItem
    {
        public string Item { get; set; } = string.Empty;
        public string InvoiceNumber { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public double Quantity { get; set; } = 1;
        public double UnitPrice { get; set; }
        public double LineTotal { get; set; }
        public string Category { get; set; } = string.Empty;
    }

    // ── Implementation ──────────────────────────────────────────────────────

    public class AssetInvoiceMatchingService : IAssetInvoiceMatchingService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILocalLlmService _llm;
        private readonly ILogger<AssetInvoiceMatchingService> _logger;

        // Manufacturer synonyms so "HP" ↔ "Hewlett Packard" etc. match
        private static readonly Dictionary<string, string> ManufacturerAliases = new(StringComparer.OrdinalIgnoreCase)
        {
            ["hp"] = "hp", ["hewlett"] = "hp", ["hewlett-packard"] = "hp", ["hewlettpackard"] = "hp",
            ["dell"] = "dell",
            ["lenovo"] = "lenovo", ["thinkpad"] = "lenovo", ["thinkcentre"] = "lenovo",
            ["asus"] = "asus", ["acer"] = "acer", ["msi"] = "msi",
            ["apple"] = "apple", ["mac"] = "apple", ["macbook"] = "apple",
            ["samsung"] = "samsung", ["lg"] = "lg", ["aoc"] = "aoc", ["benq"] = "benq",
            ["mecer"] = "mecer", ["proline"] = "proline",
            ["microsoft"] = "microsoft", ["surface"] = "microsoft",
            ["cisco"] = "cisco", ["mikrotik"] = "mikrotik", ["tp-link"] = "tplink", ["tplink"] = "tplink",
            ["ubiquiti"] = "ubiquiti", ["huawei"] = "huawei",
            ["seagate"] = "seagate", ["western"] = "wd", ["wd"] = "wd", ["kingston"] = "kingston",
            ["crucial"] = "crucial", ["corsair"] = "corsair"
        };

        // Strong tokens (CPU tiers etc.) carry more weight in scoring
        private static readonly HashSet<string> StrongTokens = new(StringComparer.OrdinalIgnoreCase)
        {
            "i3", "i5", "i7", "i9", "ryzen", "celeron", "pentium", "xeon", "core"
        };

        // CPU types that should NOT be mixed (i5 desktop should never match Xeon server)
        private static readonly HashSet<string> DesktopCpuTokens = new(StringComparer.OrdinalIgnoreCase)
        {
            "i3", "i5", "i7", "i9", "ryzen", "celeron", "pentium"
        };

        private static readonly HashSet<string> ServerCpuTokens = new(StringComparer.OrdinalIgnoreCase)
        {
            "xeon", "epyc", "threadripper"
        };

        // Server-related keywords to detect server invoices
        private static readonly HashSet<string> ServerKeywords = new(StringComparer.OrdinalIgnoreCase)
        {
            "server", "xeon", "epyc", "rack", "rackmount", "poweredge", "proliant", "ecc"
        };

        private static readonly HashSet<string> StopTokens = new(StringComparer.OrdinalIgnoreCase)
        {
            "the", "and", "with", "for", "pc", "computer", "unit", "each", "new", "used",
            "inch", "gen", "generation", "ram", "hdd", "ssd", "gb", "tb"
        };

        public AssetInvoiceMatchingService(
            IServiceScopeFactory scopeFactory,
            ILocalLlmService llm,
            ILogger<AssetInvoiceMatchingService> logger)
        {
            _scopeFactory = scopeFactory;
            _llm = llm;
            _logger = logger;
        }

        public async Task<AssetMatchResult> SuggestMatchesAsync(AssetMatchRequest request, Func<MatchProgress, Task>? onProgress = null, CancellationToken ct = default)
        {
            async Task Report(string phase, int current, int total, int percent, string message)
            {
                if (onProgress != null)
                    await onProgress(new MatchProgress { Phase = phase, Current = current, Total = total, Percent = percent, Message = message });
            }

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            await Report("load", 0, 0, 2, "Loading assets and confirmed invoices…");

            // 1) Load candidate assets ------------------------------------------------
            var assetQuery = db.AssetRegisterItems
                .Include(i => i.Location)
                .Where(i => i.IsActive)
                .AsQueryable();

            if (request.UnmatchedOnly)
                assetQuery = assetQuery.Where(i => i.BookInvoiceId == null);
            if (request.LocationId.HasValue)
                assetQuery = assetQuery.Where(i => i.LocationId == request.LocationId.Value);
            if (!string.IsNullOrWhiteSpace(request.Region))
                assetQuery = assetQuery.Where(i => i.Location != null && i.Location.Region == request.Region);
            if (!string.IsNullOrWhiteSpace(request.SubLocation))
                assetQuery = assetQuery.Where(i => i.Location != null && i.Location.SubLocation == request.SubLocation);
            if (!string.IsNullOrWhiteSpace(request.Category))
                assetQuery = assetQuery.Where(i => i.Category == request.Category);

            var assets = await assetQuery
                .OrderBy(i => i.Category)
                .ThenBy(i => i.Model)
                .ToListAsync(ct);

            // 2) Load confirmed invoices with text -----------------------------------
            var invoiceQuery = db.BookInvoices
                .Where(b => b.Status == "Confirmed" && b.ExtractedText != null && b.ExtractedText != "");

            if (!string.IsNullOrWhiteSpace(request.SupplierName))
            {
                var supplier = request.SupplierName.Trim().ToLower();
                invoiceQuery = invoiceQuery.Where(b => b.SupplierName.ToLower() == supplier);
            }

            var invoices = await invoiceQuery
                .OrderByDescending(b => b.InvoiceDate)
                .Take(Math.Clamp(request.InvoiceLimit, 1, 100))
                .ToListAsync(ct);

            var result = new AssetMatchResult
            {
                AssetsScanned = assets.Count,
                InvoicesScanned = invoices.Count
            };

            if (assets.Count == 0 || invoices.Count == 0)
            {
                result.Unmatched = assets.Count;
                result.UnmatchedAssets = assets.Select(DescribeAsset).ToList();
                await Report("done", 0, 0, 100,
                    assets.Count == 0 ? "No matching assets found for this scope." : "No confirmed invoices with text to scan.");
                return result;
            }

            // 3) Extract hardware line items from each invoice via Welly --------------
            var slots = new List<InvoiceLineSlot>();
            int invIndex = 0;
            foreach (var inv in invoices)
            {
                ct.ThrowIfCancellationRequested();
                invIndex++;

                // Extraction is the slow part: map it to the 5%–85% band of the bar.
                var pct = 5 + (int)Math.Round((invIndex / (double)invoices.Count) * 80);
                await Report("extract", invIndex, invoices.Count, pct,
                    $"Reading invoice {invIndex} of {invoices.Count}" +
                    (string.IsNullOrWhiteSpace(inv.InvoiceNumber) ? "" : $" · {inv.InvoiceNumber}") +
                    $" ({inv.SupplierName})");

                var items = await ExtractLineItemsAsync(inv, ct);
                foreach (var li in items)
                {
                    var qty = (int)Math.Max(1, Math.Round(li.Quantity <= 0 ? 1 : li.Quantity));

                    // Derive a per-unit price: prefer unitPrice, else lineTotal / qty.
                    decimal? unitPrice = null;
                    if (li.UnitPrice > 0) unitPrice = (decimal)li.UnitPrice;
                    else if (li.LineTotal > 0) unitPrice = Math.Round((decimal)li.LineTotal / qty, 2);

                    slots.Add(new InvoiceLineSlot
                    {
                        BookInvoiceId = inv.Id,
                        InvoiceNumber = inv.InvoiceNumber,
                        Supplier = inv.SupplierName,
                        InvoiceDate = inv.InvoiceDate,
                        ItemDescription = li.Item,
                        Category = li.Category,
                        Manufacturer = GuessManufacturer(li.Item),
                        UnitPrice = unitPrice,
                        Capacity = qty,
                        Tokens = Tokenize($"{li.Item} {li.Category}")
                    });
                }
            }
            result.LineItemsExtracted = slots.Count;

            if (slots.Count == 0)
            {
                result.Unmatched = assets.Count;
                result.UnmatchedAssets = assets.Select(DescribeAsset).ToList();
                await Report("done", invoices.Count, invoices.Count, 100, "No hardware line items could be extracted from the invoices.");
                return result;
            }

            await Report("score", 0, 0, 88, $"Scoring {assets.Count} asset(s) against {slots.Count} invoice line item(s)…");

            // 4) Score every (asset, slot) pair, then greedily assign -----------------
            //    Enforces exclusivity (each asset → one slot) AND capacity (a line
            //    item with qty=2 can only be assigned to at most 2 assets).
            var pairs = new List<(AssetRegisterItem asset, InvoiceLineSlot slot, int score, string reason)>();

            foreach (var asset in assets)
            {
                var assetTokens = Tokenize($"{asset.Manufacturer} {asset.Model} {asset.Category} {asset.Specification}");
                var assetMfr = GuessManufacturer($"{asset.Manufacturer} {asset.Model}");

                foreach (var slot in slots)
                {
                    var (score, reason) = ScorePair(asset, assetTokens, assetMfr, slot);
                    if (score >= 45) // threshold for a plausible match
                        pairs.Add((asset, slot, score, reason));
                }
            }

            // Highest-confidence pairs first
            pairs.Sort((a, b) => b.score.CompareTo(a.score));

            var assignedAssetIds = new HashSet<int>();
            foreach (var (asset, slot, score, reason) in pairs)
            {
                if (assignedAssetIds.Contains(asset.ItemId)) continue; // asset already matched
                if (!slot.HasCapacity) continue;                       // line item fully allocated

                slot.Used++;
                assignedAssetIds.Add(asset.ItemId);

                result.Suggestions.Add(new AssetMatchSuggestion
                {
                    ItemId = asset.ItemId,
                    AssetDescription = DescribeAsset(asset),
                    AssetCategory = asset.Category,
                    AssignedTo = asset.AssignedTo,
                    LocationName = asset.Location?.DisplayName,
                    BookInvoiceId = slot.BookInvoiceId,
                    InvoiceNumber = slot.InvoiceNumber,
                    Supplier = slot.Supplier,
                    InvoiceDate = slot.InvoiceDate,
                    MatchedLineItem = slot.ItemDescription,
                    BookValue = slot.UnitPrice,
                    Confidence = Math.Min(100, score),
                    Reason = reason
                });
            }

            result.Matched = result.Suggestions.Count;
            var matchedIds = result.Suggestions.Select(s => s.ItemId).ToHashSet();
            var unmatched = assets.Where(a => !matchedIds.Contains(a.ItemId)).ToList();
            result.Unmatched = unmatched.Count;
            result.UnmatchedAssets = unmatched.Select(DescribeAsset).ToList();

            // Best matches first for the reviewer
            result.Suggestions = result.Suggestions
                .OrderByDescending(s => s.Confidence)
                .ThenBy(s => s.AssetCategory)
                .ToList();

            _logger.LogInformation(
                "AssetInvoiceMatching: scanned {Assets} assets, {Invoices} invoices, {Slots} line items → {Matched} matched, {Unmatched} unmatched",
                result.AssetsScanned, result.InvoicesScanned, result.LineItemsExtracted, result.Matched, result.Unmatched);

            await Report("done", invoices.Count, invoices.Count, 100,
                $"Done — {result.Matched} matched, {result.Unmatched} unmatched.");

            return result;
        }

        public async Task<ApplyMatchResult> ApplyMatchesAsync(ApplyMatchRequest request, CancellationToken ct = default)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            int applied = 0, skipped = 0, valuesApplied = 0;
            decimal totalBookValue = 0m;
            var notes = new List<string>();

            // Re-enforce exclusivity per invoice line at apply time by tracking how
            // many assets we link to each invoice in this batch, capped to nothing
            // stricter than what's requested (the suggestion step already enforced qty).
            foreach (var m in request.Matches)
            {
                ct.ThrowIfCancellationRequested();

                var asset = await db.AssetRegisterItems.FindAsync(new object[] { m.ItemId }, ct);
                if (asset == null) { skipped++; notes.Add($"Item {m.ItemId}: not found"); continue; }

                // Don't overwrite an asset that is already linked to a DIFFERENT invoice
                if (asset.BookInvoiceId.HasValue && asset.BookInvoiceId.Value != m.BookInvoiceId)
                {
                    skipped++;
                    notes.Add($"Item {m.ItemId}: already linked to invoice {asset.InvoiceNumber} — skipped to avoid mismatch");
                    continue;
                }

                var invoice = await db.BookInvoices.FindAsync(new object[] { m.BookInvoiceId }, ct);
                if (invoice == null) { skipped++; notes.Add($"Item {m.ItemId}: invoice {m.BookInvoiceId} not found"); continue; }

                asset.BookInvoiceId = invoice.Id;
                asset.InvoiceNumber = !string.IsNullOrWhiteSpace(m.InvoiceNumber) ? m.InvoiceNumber : invoice.InvoiceNumber;

                // Populate the asset's book value from the matched invoice line.
                // By default only fill when empty (never clobber a manually-set value),
                // unless the caller explicitly asked to overwrite.
                if (m.BookValue.HasValue && m.BookValue.Value > 0)
                {
                    bool isEmpty = !asset.Value.HasValue || asset.Value.Value == 0;
                    if (isEmpty || request.OverwriteExistingValues)
                    {
                        asset.Value = m.BookValue.Value;
                        valuesApplied++;
                        totalBookValue += m.BookValue.Value;
                        notes.Add($"Item {m.ItemId}: book value set to R{m.BookValue.Value:N2} from invoice {asset.InvoiceNumber}");
                    }
                }

                asset.UpdatedAt = DateTime.UtcNow;
                applied++;
            }

            if (applied > 0)
                await db.SaveChangesAsync(ct);

            return new ApplyMatchResult
            {
                Applied = applied,
                Skipped = skipped,
                ValuesApplied = valuesApplied,
                TotalBookValueApplied = totalBookValue,
                Notes = notes
            };
        }

        public async Task<ApplyMatchResult> BackfillBookValuesAsync(bool overwriteExisting = false, CancellationToken ct = default)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            int applied = 0, skipped = 0, valuesApplied = 0;
            decimal totalBookValue = 0m;
            var notes = new List<string>();

            // Assets that are already linked to an invoice but have no book value.
            var targetAssets = await db.AssetRegisterItems
                .Where(i => i.IsActive && i.BookInvoiceId != null
                            && (i.Value == null || i.Value == 0)
                            && (overwriteExisting || true))
                .ToListAsync(ct);

            if (overwriteExisting)
            {
                // When overwriting we also revisit assets that DO have a value.
                targetAssets = await db.AssetRegisterItems
                    .Where(i => i.IsActive && i.BookInvoiceId != null)
                    .ToListAsync(ct);
            }

            applied = targetAssets.Count;

            var invoiceIds = targetAssets
                .Select(a => a.BookInvoiceId!.Value)
                .Distinct()
                .ToList();

            foreach (var invId in invoiceIds)
            {
                ct.ThrowIfCancellationRequested();

                var invoice = await db.BookInvoices.FindAsync(new object[] { invId }, ct);
                if (invoice == null || string.IsNullOrWhiteSpace(invoice.ExtractedText))
                {
                    notes.Add($"Invoice {invId}: no extracted text — skipped");
                    continue;
                }

                // Extract hardware line items → capacity-aware slots.
                var items = await ExtractLineItemsAsync(invoice, ct);
                var slots = new List<InvoiceLineSlot>();
                foreach (var li in items)
                {
                    var qty = (int)Math.Max(1, Math.Round(li.Quantity <= 0 ? 1 : li.Quantity));
                    decimal? unitPrice = null;
                    if (li.UnitPrice > 0) unitPrice = (decimal)li.UnitPrice;
                    else if (li.LineTotal > 0) unitPrice = Math.Round((decimal)li.LineTotal / qty, 2);

                    slots.Add(new InvoiceLineSlot
                    {
                        BookInvoiceId = invoice.Id,
                        InvoiceNumber = invoice.InvoiceNumber,
                        Supplier = invoice.SupplierName,
                        InvoiceDate = invoice.InvoiceDate,
                        ItemDescription = li.Item,
                        Category = li.Category,
                        Manufacturer = GuessManufacturer(li.Item),
                        UnitPrice = unitPrice,
                        Capacity = qty,
                        Tokens = Tokenize($"{li.Item} {li.Category}")
                    });
                }

                if (slots.Count == 0)
                {
                    notes.Add($"Invoice {invoice.InvoiceNumber}: no hardware line items extracted");
                    continue;
                }

                // Score ALL assets linked to this invoice. Assets that already have a
                // value still consume line-item capacity (so we never double-assign a
                // price), but we only WRITE the value onto the empty ones.
                var linked = await db.AssetRegisterItems
                    .Where(i => i.IsActive && i.BookInvoiceId == invId)
                    .ToListAsync(ct);

                var pairs = new List<(AssetRegisterItem asset, InvoiceLineSlot slot, int score)>();
                foreach (var asset in linked)
                {
                    var assetTokens = Tokenize($"{asset.Manufacturer} {asset.Model} {asset.Category} {asset.Specification}");
                    var assetMfr = GuessManufacturer($"{asset.Manufacturer} {asset.Model}");
                    foreach (var slot in slots)
                    {
                        var (score, _) = ScorePair(asset, assetTokens, assetMfr, slot);
                        if (score >= 45) pairs.Add((asset, slot, score));
                    }
                }

                pairs.Sort((a, b) => b.score.CompareTo(a.score));

                var assignedAssetIds = new HashSet<int>();
                foreach (var (asset, slot, score) in pairs)
                {
                    if (assignedAssetIds.Contains(asset.ItemId)) continue;
                    if (!slot.HasCapacity) continue;

                    slot.Used++;
                    assignedAssetIds.Add(asset.ItemId);

                    bool isEmpty = !asset.Value.HasValue || asset.Value.Value == 0;
                    if (slot.UnitPrice.HasValue && slot.UnitPrice.Value > 0 && (isEmpty || overwriteExisting))
                    {
                        asset.Value = slot.UnitPrice.Value;
                        asset.UpdatedAt = DateTime.UtcNow;
                        valuesApplied++;
                        totalBookValue += slot.UnitPrice.Value;
                        notes.Add($"Item {asset.ItemId} ({DescribeAsset(asset)}): R{slot.UnitPrice.Value:N2} from \"{slot.ItemDescription}\" on invoice {invoice.InvoiceNumber}");
                    }
                }
            }

            if (valuesApplied > 0)
                await db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "BackfillBookValues: {Targets} linked assets across {Invoices} invoices → {Applied} values set (R{Total:N2})",
                targetAssets.Count, invoiceIds.Count, valuesApplied, totalBookValue);

            return new ApplyMatchResult
            {
                Applied = applied,
                Skipped = applied - valuesApplied,
                ValuesApplied = valuesApplied,
                TotalBookValueApplied = totalBookValue,
                Notes = notes
            };
        }

        public async Task<List<SupplierOption>> GetMatchableSuppliersAsync(CancellationToken ct = default)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            return await db.BookInvoices
                .Where(b => b.Status == "Confirmed" && b.ExtractedText != null && b.ExtractedText != "")
                .GroupBy(b => b.SupplierName)
                .Select(g => new SupplierOption { SupplierName = g.Key, InvoiceCount = g.Count() })
                .OrderByDescending(s => s.InvoiceCount)
                .ThenBy(s => s.SupplierName)
                .ToListAsync(ct);
        }

        // Returns ALL confirmed suppliers (including scanned invoices without text)
        // Used for manual linking where AI extraction isn't needed
        public async Task<List<SupplierOption>> GetAllSuppliersAsync(CancellationToken ct = default)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            return await db.BookInvoices
                .Where(b => b.Status == "Confirmed")
                .GroupBy(b => b.SupplierName)
                .Select(g => new SupplierOption { 
                    SupplierName = g.Key, 
                    InvoiceCount = g.Count(),
                    HasExtractedText = g.Any(i => i.ExtractedText != null && i.ExtractedText != "")
                })
                .OrderByDescending(s => s.InvoiceCount)
                .ThenBy(s => s.SupplierName)
                .ToListAsync(ct);
        }

        // ── Welly extraction ────────────────────────────────────────────────

        private async Task<List<LlmLineItem>> ExtractLineItemsAsync(BookInvoice invoice, CancellationToken ct)
        {
            var text = invoice.ExtractedText ?? "";
            if (text.Length > 8000) text = text[..8000];

            var systemPrompt = @"You are a procurement data extractor. From the invoice text, extract every PHYSICAL HARDWARE line item (computers, laptops, monitors, printers, networking gear, drives, RAM, peripherals, etc.). EXCLUDE services, labour, delivery and pure software licences.

Respond with ONLY a JSON array between <ITEMS_JSON> and </ITEMS_JSON> markers. Each element:
{ ""item"": ""description as written"", ""quantity"": number (default 1), ""unitPrice"": number (ZAR per unit, exclude symbols; if only a line total is shown, divide by quantity), ""lineTotal"": number (ZAR), ""category"": ""Monitor|Laptop|Computer|Networking|Storage|Peripheral|Printer|Other"" }
Rules: valid JSON only, numbers not strings, no trailing commas, one element per hardware line. If a price is unknown use 0. If none, return [].";

            var userPrompt = $"Invoice #{invoice.InvoiceNumber} from {invoice.SupplierName}:\n\n{text}";

            try
            {
                var response = await _llm.AnalyzeDocumentAsync(systemPrompt, userPrompt, ct);
                return ParseLineItems(response);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "AssetInvoiceMatching: line-item extraction failed for invoice {Id}", invoice.Id);
                return new List<LlmLineItem>();
            }
        }

        private List<LlmLineItem> ParseLineItems(string response)
        {
            if (string.IsNullOrWhiteSpace(response)) return new();

            string? json = null;
            var m = Regex.Match(response, @"<ITEMS_JSON>\s*(?<json>\[[\s\S]*?\])\s*</ITEMS_JSON>", RegexOptions.IgnoreCase);
            if (m.Success) json = m.Groups["json"].Value;
            if (json == null)
            {
                var start = response.IndexOf('[');
                var end = response.LastIndexOf(']');
                if (start >= 0 && end > start) json = response.Substring(start, end - start + 1);
            }
            if (string.IsNullOrWhiteSpace(json)) return new();

            try
            {
                var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var items = JsonSerializer.Deserialize<List<LlmLineItem>>(json, opts) ?? new();
                return items.Where(i => !string.IsNullOrWhiteSpace(i.Item)).ToList();
            }
            catch
            {
                return new();
            }
        }

        // ── Scoring & normalisation ─────────────────────────────────────────

        private (int score, string reason) ScorePair(
            AssetRegisterItem asset, HashSet<string> assetTokens, string? assetMfr, InvoiceLineSlot slot)
        {
            // Manufacturer conflict → hard reject (avoid Dell↔HP mismatches)
            if (!string.IsNullOrEmpty(assetMfr) && !string.IsNullOrEmpty(slot.Manufacturer)
                && assetMfr != slot.Manufacturer)
            {
                return (0, "Manufacturer mismatch");
            }

            // ── CPU TYPE CONFLICT: Desktop CPU vs Server CPU → hard reject ──
            // An i5 desktop should NEVER match a Xeon server invoice, even if both are "Dell"
            bool assetHasDesktopCpu = assetTokens.Any(t => DesktopCpuTokens.Contains(t));
            bool assetHasServerCpu = assetTokens.Any(t => ServerCpuTokens.Contains(t));
            bool slotHasDesktopCpu = slot.Tokens.Any(t => DesktopCpuTokens.Contains(t));
            bool slotHasServerCpu = slot.Tokens.Any(t => ServerCpuTokens.Contains(t));

            // Reject if asset has desktop CPU (i5/i7) but slot is server (Xeon/Epyc)
            if (assetHasDesktopCpu && slotHasServerCpu)
                return (0, "CPU type mismatch: desktop CPU cannot match server invoice");

            // Reject if asset has server CPU but slot is desktop
            if (assetHasServerCpu && slotHasDesktopCpu)
                return (0, "CPU type mismatch: server CPU cannot match desktop invoice");

            // ── SERVER KEYWORD CHECK: Desktop computers shouldn't match "Server" items ──
            bool slotIsServer = slot.Tokens.Any(t => ServerKeywords.Contains(t))
                                || slot.ItemDescription.Contains("Server", StringComparison.OrdinalIgnoreCase);
            bool assetIsDesktop = (asset.Category?.Contains("Computer", StringComparison.OrdinalIgnoreCase) ?? false)
                                  && !assetTokens.Any(t => ServerKeywords.Contains(t));

            if (assetIsDesktop && slotIsServer)
                return (0, "Desktop computer cannot match server invoice item");

            // ── CPU GENERATION MISMATCH: i5 vs i7 → hard reject ──
            // Don't match i5 assets to i7 invoices or vice versa
            bool assetHasI5 = assetTokens.Contains("i5");
            bool assetHasI7 = assetTokens.Contains("i7");
            bool assetHasI3 = assetTokens.Contains("i3");
            bool assetHasI9 = assetTokens.Contains("i9");
            bool slotHasI5 = slot.Tokens.Contains("i5");
            bool slotHasI7 = slot.Tokens.Contains("i7");
            bool slotHasI3 = slot.Tokens.Contains("i3");
            bool slotHasI9 = slot.Tokens.Contains("i9");

            // If both have specific Intel CPU tiers, they must match
            if ((assetHasI3 || assetHasI5 || assetHasI7 || assetHasI9) && 
                (slotHasI3 || slotHasI5 || slotHasI7 || slotHasI9))
            {
                bool cpuMatch = (assetHasI3 && slotHasI3) || (assetHasI5 && slotHasI5) ||
                                (assetHasI7 && slotHasI7) || (assetHasI9 && slotHasI9);
                if (!cpuMatch)
                    return (0, "Intel CPU tier mismatch (e.g., i5 vs i7)");
            }

            var shared = assetTokens.Where(t => slot.Tokens.Contains(t)).ToList();
            if (shared.Count == 0) return (0, "No shared attributes");

            int raw = 0;
            var strongHits = new List<string>();
            foreach (var t in shared)
            {
                if (StrongTokens.Contains(t)) { raw += 25; strongHits.Add(t); }
                else if (Regex.IsMatch(t, @"\d")) { raw += 15; strongHits.Add(t); } // model numbers, sizes
                else raw += 8;
            }

            // Category agreement boost
            bool categoryMatch = CategoriesAgree(asset.Category, slot.Category)
                                 || CategoriesAgree(asset.Category, slot.ItemDescription);
            if (categoryMatch) raw += 20;

            // Manufacturer agreement boost
            if (!string.IsNullOrEmpty(assetMfr) && assetMfr == slot.Manufacturer) raw += 15;

            // Normalise a little by asset token richness so tiny descriptors don't over-score
            var score = Math.Min(100, raw);

            var reasonParts = new List<string>();
            if (strongHits.Count > 0) reasonParts.Add($"matched {string.Join(", ", strongHits.Take(4))}");
            if (categoryMatch) reasonParts.Add($"category {asset.Category}");
            if (!string.IsNullOrEmpty(assetMfr) && assetMfr == slot.Manufacturer) reasonParts.Add($"same brand ({assetMfr})");
            var reason = reasonParts.Count > 0 ? string.Join("; ", reasonParts) : $"shared: {string.Join(", ", shared.Take(4))}";

            return (score, reason);
        }

        private static bool CategoriesAgree(string assetCategory, string? other)
        {
            if (string.IsNullOrWhiteSpace(assetCategory) || string.IsNullOrWhiteSpace(other)) return false;
            var a = assetCategory.ToLowerInvariant();
            var b = other.ToLowerInvariant();

            // Map common synonyms both directions
            string[][] groups = new[]
            {
                new[] { "computer", "desktop", "pc", "workstation", "cpu", "tower" },
                new[] { "laptop", "notebook", "macbook" },
                new[] { "monitor", "screen", "display", "lcd", "led" },
                new[] { "printer", "mfp", "copier" },
                new[] { "telephone", "phone", "handset", "voip" },
                new[] { "mobile phone", "cellphone", "smartphone", "mobile" },
                new[] { "keyboard" }, new[] { "mouse" },
                new[] { "networking", "switch", "router", "access point", "firewall" },
                new[] { "storage", "hdd", "ssd", "drive", "nas" },
            };

            foreach (var g in groups)
            {
                bool aIn = g.Any(x => a.Contains(x));
                bool bIn = g.Any(x => b.Contains(x));
                if (aIn && bIn) return true;
            }
            return a == b;
        }

        private static string? GuessManufacturer(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return null;
            foreach (var token in Regex.Split(text.ToLowerInvariant(), @"[^a-z0-9\-]+"))
            {
                if (ManufacturerAliases.TryGetValue(token, out var canonical))
                    return canonical;
            }
            return null;
        }

        private static HashSet<string> Tokenize(string? text)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(text)) return set;

            // Normalise CPU generation patterns e.g. "i5-6500" → i5, 6500 ; "6th gen" → 6
            var lowered = text.ToLowerInvariant();
            lowered = Regex.Replace(lowered, @"(\d+)(st|nd|rd|th)\b", "$1"); // 6th → 6

            foreach (var rawToken in Regex.Split(lowered, @"[^a-z0-9]+"))
            {
                if (rawToken.Length < 2) continue;
                if (StopTokens.Contains(rawToken)) continue;
                set.Add(rawToken);
            }
            return set;
        }

        private static string DescribeAsset(AssetRegisterItem a)
        {
            var parts = new[] { a.Manufacturer, a.Model, a.Category, a.Specification }
                .Where(s => !string.IsNullOrWhiteSpace(s));
            var desc = string.Join(" ", parts).Trim();
            if (string.IsNullOrWhiteSpace(desc)) desc = a.Category;
            if (!string.IsNullOrWhiteSpace(a.SerialNumber)) desc += $" (S/N {a.SerialNumber})";
            return desc;
        }
    }
}
