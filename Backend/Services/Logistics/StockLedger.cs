using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// The single way stock on hand changes. WarehouseInventory.QuantityOnHand is a cached balance of the
    /// WarehouseStockMovements ledger, so every change posts a ledger row and updates the balance in the same
    /// EF change-set (the caller saves and controls the transaction). Anything that sets QuantityOnHand
    /// directly makes the ledger and the balance disagree.
    /// </summary>
    public static class StockLedger
    {
        public const string ConflictMessage = "Stock for this item changed while you were saving. Refresh and try again.";

        /// <summary>
        /// Insert a ledger row and move the cached balance. Auto-creates a missing inventory row (logged as an Issue)
        /// and logs an Issue when a balance goes negative (a reason is then required).
        /// </summary>
        public static async Task<WarehouseStockMovement> ApplyAsync(ApplicationDbContext db, int warehouseId, int commodityId,
            string movementType, decimal signedQty, int? loadId, int? transferId, string? reference, string? reason, string createdBy)
        {
            var inv = await FindInventoryAsync(db, warehouseId, commodityId);

            if (inv == null)
            {
                var commodity = await db.Commodities.FindAsync(commodityId)
                    ?? throw new InvalidOperationException($"Commodity {commodityId} not found");
                inv = new WarehouseInventory
                {
                    WarehouseId = warehouseId,
                    CommodityId = commodityId,
                    QuantityOnHand = 0,
                    CreatedAt = DateTime.UtcNow
                };
                db.WarehouseInventory.Add(inv);

                // Stock arriving at a new line is normal; stock leaving a line that never existed is worth a look
                if (signedQty < 0)
                {
                    db.StockIssues.Add(new StockIssue
                    {
                        WarehouseId = warehouseId,
                        ItemCode = commodity.Code,
                        ItemDescription = commodity.Name,
                        IssueType = "Item not in warehouse stock",
                        Detail = $"A {movementType} movement was recorded for an item with no stock record at this warehouse. Row auto-created at 0.",
                        IssueDate = DateTime.UtcNow,
                        Status = "Open",
                        CreatedBy = createdBy,
                        Source = "System"
                    });
                }
            }

            var newBalance = inv.QuantityOnHand + signedQty;
            if (newBalance < 0)
            {
                if (string.IsNullOrWhiteSpace(reason))
                    throw new InvalidOperationException(
                        $"This would take stock negative ({inv.QuantityOnHand} → {newBalance}). A reason is required.");

                var commodity = await db.Commodities.FindAsync(commodityId);
                db.StockIssues.Add(new StockIssue
                {
                    WarehouseId = warehouseId,
                    ItemCode = commodity?.Code,
                    ItemDescription = commodity?.Name,
                    IssueType = "Negative balance",
                    Detail = $"{movementType} of {signedQty} took balance from {inv.QuantityOnHand} to {newBalance}. Reason: {reason}",
                    IssueDate = DateTime.UtcNow,
                    Status = "Open",
                    CreatedBy = createdBy,
                    Source = "System"
                });
            }

            inv.QuantityOnHand = newBalance;
            inv.UpdatedAt = DateTime.UtcNow;
            if (signedQty > 0) inv.LastRestockDate = DateTime.UtcNow;

            var movement = new WarehouseStockMovement
            {
                WarehouseId = warehouseId,
                CommodityId = commodityId,
                MovementType = movementType,
                Quantity = signedQty,
                LoadId = loadId,
                TransferId = transferId,
                Reference = reference,
                Reason = reason,
                Status = "Approved",
                BalanceAfter = newBalance,
                CreatedBy = createdBy,
                CreatedAt = DateTime.UtcNow
            };
            db.WarehouseStockMovements.Add(movement);
            return movement;
        }

        /// <summary>
        /// Post a counted quantity: the variance from the current balance becomes an Adjustment, and the line's
        /// count date moves to <paramref name="countedAt"/>. Returns the movement, or null when the count matched.
        /// </summary>
        public static async Task<WarehouseStockMovement?> PostCountAsync(ApplicationDbContext db, int warehouseId, int commodityId,
            decimal counted, DateTime countedAt, string reference, string reason, string createdBy)
        {
            var inv = await FindInventoryAsync(db, warehouseId, commodityId);
            var system = inv?.QuantityOnHand ?? 0m;
            var variance = counted - system;

            // Counting an item the warehouse had no line for is expected, not an exception worth an Issue
            if (inv == null && counted != 0)
            {
                inv = new WarehouseInventory { WarehouseId = warehouseId, CommodityId = commodityId, QuantityOnHand = 0, CreatedAt = DateTime.UtcNow };
                db.WarehouseInventory.Add(inv);
            }

            WarehouseStockMovement? movement = null;
            if (variance != 0)
                movement = await ApplyAsync(db, warehouseId, commodityId, "Adjustment", variance, null, null, reference,
                    $"Stock take: counted {counted}, system {system}. {reason}".Trim(), createdBy);
            if (inv != null) inv.LastCountDate = countedAt;
            return movement;
        }

        /// <summary>Finds the inventory row, including one added earlier in this change-set.</summary>
        public static async Task<WarehouseInventory?> FindInventoryAsync(ApplicationDbContext db, int warehouseId, int commodityId) =>
            db.WarehouseInventory.Local.FirstOrDefault(i => i.WarehouseId == warehouseId && i.CommodityId == commodityId)
            ?? await db.WarehouseInventory.FirstOrDefaultAsync(i => i.WarehouseId == warehouseId && i.CommodityId == commodityId);

        /// <summary>True when a save failed because stock moved underneath it (row version or a duplicate live dispatch).</summary>
        public static bool IsStockConflict(Exception ex) =>
            ex is DbUpdateConcurrencyException
            || (ex is DbUpdateException && (ex.InnerException?.Message.Contains("UX_WarehouseStockMovements_LiveDispatch") ?? false));
    }

    /// <summary>
    /// Who may change stock: the same people who can open the Stock page (admins, managers, and users with the
    /// stock_management module) plus explicit dispatch approvers. The PIN prompts in the page are a second
    /// check, not the only one: these rules hold for direct API calls too.
    /// </summary>
    public static class StockAccess
    {
        public const string DispatchApproverPermission = "stock_dispatch_approver";
        public const string Denied = "You need Stock Management access to change stock";

        public static async Task<bool> CanManageAsync(ApplicationDbContext db, System.Security.Claims.ClaimsPrincipal principal)
        {
            var idClaim = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? principal.FindFirst("sub")?.Value;
            if (!int.TryParse(idClaim, out var userId)) return false;
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null) return false;
            var role = (user.Role ?? "").ToLower();
            if (role.Contains("admin") || role.Contains("manager")) return true;
            var perms = (user.Permissions ?? "").ToLower();
            return perms.Contains("stock_management") || perms.Contains(DispatchApproverPermission);
        }
    }

    /// <summary>
    /// Matches sales/tripsheet product codes to stock items. Codes are compared ignoring case, spaces and
    /// punctuation. The same code can legitimately exist under more than one company (e.g. a Promed casting
    /// bandage and an Access coverall both coded RT420104300000 in Gauteng), so when a code resolves to several
    /// stock items the caller's company (Sage code or company name) picks the right one; without a company, or
    /// when no candidate carries that company, the code is left unmatched rather than guessed.
    /// </summary>
    public static class CommodityCodeMatcher
    {
        public readonly record struct Candidate(int Id, string Category);
        public sealed class CodeMap : Dictionary<string, List<Candidate>> { }

        public static string Normalize(string? code) =>
            new string((code ?? "").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

        /// <summary>Sage company code (PMT/ACM/SBT/PHT/KOG) or company name → the name used in Commodities.Category.</summary>
        public static string NormalizeCompany(string? company) => (company ?? "").Trim().ToUpperInvariant() switch
        {
            "PMT" or "PROMED" => "PROMED",
            "ACM" or "ACCESS" or "ACCMED" => "ACCESS",
            "SBT" or "SEBENZANI" or "SEBENZ" => "SEBENZANI",
            "PHT" or "PHARMACARE" or "PHARMA" => "PHARMACARE",
            "KOG" => "KOG",
            var other => other
        };

        public static async Task<CodeMap> BuildAsync(ApplicationDbContext db, IEnumerable<string?> codes)
        {
            var map = new CodeMap();
            var wanted = codes.Select(Normalize).Where(c => c.Length > 0).ToHashSet();
            if (wanted.Count == 0) return map;

            var all = await db.Commodities.AsNoTracking()
                .Where(c => c.Code != null && c.Code != "")
                .Select(c => new { c.Id, c.Code, c.Category })
                .ToListAsync();

            foreach (var c in all)
            {
                var key = Normalize(c.Code);
                if (!wanted.Contains(key)) continue;
                if (!map.TryGetValue(key, out var list)) map[key] = list = new List<Candidate>();
                list.Add(new Candidate(c.Id, NormalizeCompany(c.Category)));
            }
            return map;
        }

        /// <summary>Resolve a code; <paramref name="company"/> (Sage code or name) disambiguates codes shared between companies.</summary>
        public static int? Match(CodeMap map, string? code, string? company = null)
        {
            if (!map.TryGetValue(Normalize(code), out var cands) || cands.Count == 0) return null;
            if (cands.Count == 1) return cands[0].Id;
            var co = NormalizeCompany(company);
            if (co.Length == 0) return null;
            var mine = cands.Where(c => c.Category == co).ToList();
            return mine.Count == 1 ? mine[0].Id : null;
        }
    }

    /// <summary>
    /// Keeps tripsheet lines connected to stock items so dispatch approval can deduct them.
    /// Resolution order per line: stored ProductCode → code(s) on the line's invoice(s) (single code, or the one
    /// whose description matches) → "CODE: Name" comment → exact description match on a Commodity name.
    /// Any invoice code that has no Commodity yet is created first (code + description), so every invoiced item
    /// is a mappable stock item. Lines already linked, and loads whose stock is deducted or cancelled, are untouched.
    /// </summary>
    public static class StopLineLinker
    {
        public record Result(int CommoditiesCreated, int LinesConsidered, int LinesLinked, int StillUnlinked);

        private static readonly System.Text.RegularExpressions.Regex PartQty =
            new(@"\s[xX]\s*(\d[\d ,.]*)\s*$", System.Text.RegularExpressions.RegexOptions.Compiled);

        /// <summary>
        /// A merged multi-product line ("TOILET PAPER 1 PLY x100; TOILET PAPER 2PLY VIRGIN x150") split into its
        /// products with their own quantities. Returns null when the text is a single product or a part has no
        /// quantity of its own (then a split would have to guess).
        /// </summary>
        public static List<(string Name, decimal Qty)>? SplitMerged(string? text)
        {
            if (string.IsNullOrWhiteSpace(text) || !text.Contains(';')) return null;
            var parts = text.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(p => p.Length > 0).ToList();
            if (parts.Count < 2) return null;
            var result = new List<(string, decimal)>();
            foreach (var p in parts)
            {
                var m = PartQty.Match(p);
                if (!m.Success) return null;
                var q = TripSheetImportService.ParseLocaleNumber(m.Groups[1].Value);
                if (q is not > 0) return null;
                result.Add((p[..m.Index].Trim(), q.Value));
            }
            return result;
        }

        /// <summary>Words of a product description, with "2PLY" read as "2 PLY" and punctuation dropped.</summary>
        public static HashSet<string> DescriptionTokens(string? s)
        {
            var t = System.Text.RegularExpressions.Regex.Replace((s ?? "").ToUpperInvariant(), @"(?<=\d)(?=[A-Z])|(?<=[A-Z])(?=\d)", " ");
            return System.Text.RegularExpressions.Regex.Split(t, @"[^A-Z0-9.]+")
                .Select(w => w.Trim('.'))
                .Where(w => w.Length > 0 && w is not ("X" or "OF" or "THE" or "AND" or "WITH" or "FOR" or "IN"))
                .ToHashSet();
        }

        /// <summary>
        /// How well a candidate description covers a line's description, 0..1: the share of the line's words found
        /// in the candidate. Numbers must agree — "1 PLY" never matches "2 PLY", "SIZE 7" never matches "SIZE 8".
        /// </summary>
        public static double DescriptionScore(HashSet<string> line, HashSet<string> candidate)
        {
            if (line.Count == 0 || candidate.Count == 0) return 0;
            var numsLine = line.Where(w => w.Any(char.IsDigit)).ToHashSet();
            var numsCand = candidate.Where(w => w.Any(char.IsDigit)).ToHashSet();
            if (numsCand.Count > 0 && numsLine.Except(numsCand).Any()) return 0;
            return (double)line.Count(candidate.Contains) / line.Count;
        }

        /// <summary>The one candidate that clearly fits a description best (at least 75% of its words, ahead of the rest), or default.</summary>
        public static T? BestByDescription<T>(string? description, IEnumerable<T> candidates, Func<T, string?> describe)
        {
            var line = DescriptionTokens(description);
            if (line.Count < 2) return default;
            var scored = candidates.Select(c => (c, Score: DescriptionScore(line, DescriptionTokens(describe(c)))))
                .Where(x => x.Score >= 0.75).OrderByDescending(x => x.Score).ToList();
            if (scored.Count == 0) return default;
            if (scored.Count > 1 && scored[1].Score >= scored[0].Score - 0.001) return default;
            return scored[0].c;
        }

        /// <summary>
        /// Split unlinked merged multi-product lines into one line per product so each can link to its own stock
        /// item. The value stays on the first part. Does not save; returns how many lines were split.
        /// </summary>
        public static int SplitMergedLines(ApplicationDbContext db, IEnumerable<Models.Logistics.StopCommodity> lines)
        {
            var split = 0;
            foreach (var sc in lines.ToList())
            {
                if (sc.CommodityId != null) continue;
                var parts = SplitMerged(sc.Comment);
                if (parts == null) continue;
                for (int i = 1; i < parts.Count; i++)
                {
                    db.StopCommodities.Add(new Models.Logistics.StopCommodity
                    {
                        LoadStopId = sc.LoadStopId,
                        Quantity = parts[i].Qty,
                        UnitOfMeasure = sc.UnitOfMeasure,
                        UnitPrice = 0,
                        TotalPrice = 0,
                        InvoiceNumber = sc.InvoiceNumber,
                        OrderNumber = sc.OrderNumber,
                        Brand = sc.Brand,
                        Comment = parts[i].Name,
                        CreatedAt = sc.CreatedAt
                    });
                }
                sc.Comment = parts[0].Name;
                sc.Quantity = parts[0].Qty;
                split++;
            }
            return split;
        }

        /// <summary>Sage source-company code → company name used in Commodities.Category.</summary>
        public static string? CompanyName(string? sourceCompany) => sourceCompany?.Trim().ToUpperInvariant() switch
        {
            "PMT" => "PROMED",
            "ACM" => "ACCESS",
            "SBT" => "SEBENZANI",
            "PHT" => "PHARMACARE",
            "" or null => null,
            var other => other
        };

        /// <summary>Create Commodities for every distinct invoice product code that has none. Returns how many were created.</summary>
        public static async Task<int> EnsureCommoditiesForInvoiceCodesAsync(ApplicationDbContext db, IEnumerable<string?>? onlyCodes = null)
        {
            var q = db.ImportedInvoices.AsNoTracking().Where(i => i.ProductCode != null && i.ProductCode != "");
            if (onlyCodes != null)
            {
                var wanted = onlyCodes.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim()).Distinct().ToList();
                if (wanted.Count == 0) return 0;
                q = q.Where(i => wanted.Contains(i.ProductCode));
            }
            var invoiced = await q
                .GroupBy(i => i.ProductCode)
                .Select(g => new { Code = g.Key, Description = g.OrderByDescending(x => x.TransactionDate).Select(x => x.ProductDescription).FirstOrDefault(), Company = g.OrderByDescending(x => x.TransactionDate).Select(x => x.SourceCompany).FirstOrDefault() })
                .ToListAsync();
            if (invoiced.Count == 0) return 0;

            var existing = (await db.Commodities.AsNoTracking().Where(c => c.Code != null && c.Code != "").Select(c => c.Code!).ToListAsync())
                .Select(CommodityCodeMatcher.Normalize).ToHashSet();

            var created = 0;
            foreach (var inv in invoiced)
            {
                var key = CommodityCodeMatcher.Normalize(inv.Code);
                if (key.Length == 0 || existing.Contains(key)) continue;
                // "CAT-nn" rows are Sage category sub-totals on the invoice export, not products
                if (inv.Code!.Trim().StartsWith("CAT-", StringComparison.OrdinalIgnoreCase)) continue;
                existing.Add(key);
                db.Commodities.Add(new Models.Logistics.Commodity
                {
                    Code = inv.Code!.Trim(),
                    Name = string.IsNullOrWhiteSpace(inv.Description) ? inv.Code!.Trim() : inv.Description!.Trim(),
                    Description = "Created from sales invoices",
                    Category = CompanyName(inv.Company),
                    UnitOfMeasure = "Each",
                    CreatedAt = DateTime.UtcNow
                });
                created++;
            }
            if (created > 0) await db.SaveChangesAsync();
            return created;
        }

        /// <summary>Link unlinked lines (optionally only for one load). Saves changes.</summary>
        public static async Task<Result> LinkAsync(ApplicationDbContext db, int? loadId = null, bool createMissingCommodities = true)
        {
            var deductedLoadIds = await db.WarehouseStockMovements
                .Where(m => m.LoadId != null && m.MovementType == "Dispatch" && m.Status == "Approved" && m.ReversedByMovementId == null)
                .Select(m => m.LoadId!.Value).Distinct().ToListAsync();

            var lines = await db.StopCommodities
                .Include(sc => sc.LoadStop)
                .Where(sc => sc.CommodityId == null
                             && (loadId == null || sc.LoadStop.LoadId == loadId)
                             && sc.LoadStop.Load.Status != "Cancelled"
                             && !deductedLoadIds.Contains(sc.LoadStop.LoadId))
                .ToListAsync();
            if (lines.Count == 0) return new Result(0, 0, 0, 0);

            // A merged multi-product line can never link to one stock item: split it first.
            if (SplitMergedLines(db, lines) > 0)
            {
                await db.SaveChangesAsync();
                lines = await db.StopCommodities
                    .Include(sc => sc.LoadStop)
                    .Where(sc => sc.CommodityId == null
                                 && (loadId == null || sc.LoadStop.LoadId == loadId)
                                 && sc.LoadStop.Load.Status != "Cancelled"
                                 && !deductedLoadIds.Contains(sc.LoadStop.LoadId))
                    .ToListAsync();
            }

            static List<string> InvoiceNumbers(string? s) =>
                (s ?? "").Split(new[] { ',', ';', '/' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

            var invoiceNumbers = lines.SelectMany(sc => InvoiceNumbers(sc.InvoiceNumber)).Distinct().ToList();
            var invoiceLines = await db.ImportedInvoices.AsNoTracking()
                .Where(i => invoiceNumbers.Contains(i.TransactionNumber) && i.ProductCode != null && i.ProductCode != "")
                .Select(i => new { i.TransactionNumber, i.ProductCode, i.ProductDescription, i.SourceCompany })
                .ToListAsync();
            var byInvoice = invoiceLines.ToLookup(i => i.TransactionNumber, StringComparer.OrdinalIgnoreCase);

            // Company for a line: the invoice's Sage company, else a "PROMED"/"ACCESS" style brand on the line
            string? CompanyFor(Models.Logistics.StopCommodity sc)
            {
                var cos = InvoiceNumbers(sc.InvoiceNumber).SelectMany(n => byInvoice[n])
                    .Select(i => CommodityCodeMatcher.NormalizeCompany(i.SourceCompany))
                    .Where(c => c.Length > 0).Distinct().ToList();
                if (cos.Count == 1) return cos[0];
                var brand = (sc.Brand ?? "").ToUpperInvariant();
                foreach (var co in new[] { "PROMED", "ACCESS", "SEBENZANI", "PHARMACARE", "KOG" })
                    if (brand.Contains(co)) return co;
                return null;
            }

            string? CodeFor(Models.Logistics.StopCommodity sc)
            {
                if (!string.IsNullOrWhiteSpace(sc.ProductCode)) return sc.ProductCode;
                var candidates = InvoiceNumbers(sc.InvoiceNumber).SelectMany(n => byInvoice[n]).ToList();
                var described = candidates.Where(c => string.Equals((c.ProductDescription ?? "").Trim(), (sc.Comment ?? "").Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
                foreach (var set in new[] { described, candidates })
                {
                    var codes = set.Select(c => c.ProductCode!.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                    if (codes.Count == 1) return codes[0];
                }
                // Several products on the invoice and no exact name: the one whose description clearly fits
                // ("TOILET PAPER 1 PLY" → "Toilet Paper 1 Ply Virgin", never "... 2 Ply ...").
                var best = BestByDescription(sc.Comment, candidates, c => c.ProductDescription);
                if (best != null) return best.ProductCode!.Trim();
                var colon = (sc.Comment ?? "").IndexOf(':');
                return colon > 0 && colon <= 30 ? sc.Comment![..colon].Trim() : null;
            }

            var withCodes = lines.Select(sc => new { sc, Code = CodeFor(sc), Company = CompanyFor(sc) }).ToList();
            foreach (var x in withCodes) if (string.IsNullOrWhiteSpace(x.sc.ProductCode) && x.Code != null) x.sc.ProductCode = x.Code;

            var created = 0;
            if (createMissingCommodities)
                created = await EnsureCommoditiesForInvoiceCodesAsync(db, withCodes.Select(x => x.Code));

            var codeMap = await CommodityCodeMatcher.BuildAsync(db, withCodes.Select(x => x.Code));
            var linked = 0;
            var byDescription = new List<Models.Logistics.StopCommodity>();
            foreach (var x in withCodes)
            {
                var id = CommodityCodeMatcher.Match(codeMap, x.Code, x.Company);
                if (id != null) { x.sc.CommodityId = id; linked++; }
                else if (!string.IsNullOrWhiteSpace(x.sc.Comment)) byDescription.Add(x.sc);
            }

            // Last resort: a description that is exactly one Commodity's name.
            if (byDescription.Count > 0)
            {
                var names = byDescription.Select(sc => sc.Comment!.Trim().ToLowerInvariant()).Distinct().ToList();
                var nameMap = (await db.Commodities.AsNoTracking().Where(c => c.Name != "").Select(c => new { c.Id, c.Name, c.Code }).ToListAsync())
                    .GroupBy(c => c.Name.Trim().ToLowerInvariant())
                    .Where(g => g.Count() == 1 && names.Contains(g.Key))
                    .ToDictionary(g => g.Key, g => g.First());
                var stillOpen = new List<Models.Logistics.StopCommodity>();
                foreach (var sc in byDescription)
                {
                    if (!nameMap.TryGetValue(sc.Comment!.Trim().ToLowerInvariant(), out var c)) { stillOpen.Add(sc); continue; }
                    sc.CommodityId = c.Id;
                    sc.ProductCode ??= c.Code;
                    linked++;
                }

                // Then the stock item in the load's own warehouse whose name clearly fits best.
                if (stillOpen.Count > 0)
                {
                    var stopIds = stillOpen.Select(sc => sc.LoadStopId).Distinct().ToList();
                    var whByStop = await db.LoadStops.AsNoTracking().Where(st => stopIds.Contains(st.Id))
                        .Select(st => new { st.Id, st.Load.WarehouseId }).ToDictionaryAsync(x => x.Id, x => x.WarehouseId);
                    var whIds = whByStop.Values.Where(v => v != null).Select(v => v!.Value).Distinct().ToList();
                    var stockByWh = (await db.WarehouseInventory.AsNoTracking().Where(i => whIds.Contains(i.WarehouseId))
                            .Select(i => new { i.WarehouseId, i.CommodityId, i.Commodity.Name, i.Commodity.Code }).ToListAsync())
                        .ToLookup(i => i.WarehouseId);
                    List<(int Id, string Name, string? Code)>? catalogue = null;
                    foreach (var sc in stillOpen)
                    {
                        if (!whByStop.TryGetValue(sc.LoadStopId, out var wh) || wh == null) continue;
                        // Items named after a merged line ("A x10; B x20", made by the pre-count sweep) are not real products
                        var best = BestByDescription(sc.Comment, stockByWh[wh.Value].Where(i => !i.Name.Contains(';')), i => i.Name);
                        if (best != null)
                        {
                            sc.CommodityId = best.CommodityId;
                            sc.ProductCode ??= best.Code;
                            linked++;
                            continue;
                        }
                        // Nothing in that warehouse yet: the one catalogue item whose name clearly fits
                        catalogue ??= (await db.Commodities.AsNoTracking().Where(c => c.Name != "" && !c.Name.Contains(";"))
                            .Select(c => new { c.Id, c.Name, c.Code }).ToListAsync())
                            .Select(c => (c.Id, c.Name, c.Code)).ToList();
                        var any = BestByDescription(sc.Comment, catalogue, c => c.Name);
                        if (any.Id == 0) continue;
                        sc.CommodityId = any.Id;
                        sc.ProductCode ??= any.Code;
                        linked++;
                    }
                }
            }

            await db.SaveChangesAsync();
            return new Result(created, lines.Count, linked, lines.Count - linked);
        }
    }
}
