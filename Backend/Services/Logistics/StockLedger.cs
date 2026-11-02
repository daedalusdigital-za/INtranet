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
    /// punctuation; a code that normalises to more than one stock item is left unmatched rather than guessed.
    /// </summary>
    public static class CommodityCodeMatcher
    {
        public static string Normalize(string? code) =>
            new string((code ?? "").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

        public static async Task<Dictionary<string, int>> BuildAsync(ApplicationDbContext db, IEnumerable<string?> codes)
        {
            var wanted = codes.Select(Normalize).Where(c => c.Length > 0).ToHashSet();
            if (wanted.Count == 0) return new Dictionary<string, int>();

            var all = await db.Commodities.AsNoTracking()
                .Where(c => c.Code != null && c.Code != "")
                .Select(c => new { c.Id, c.Code })
                .ToListAsync();

            return all
                .Select(c => new { c.Id, Key = Normalize(c.Code) })
                .Where(c => wanted.Contains(c.Key))
                .GroupBy(c => c.Key)
                .Where(g => g.Count() == 1)
                .ToDictionary(g => g.Key, g => g.First().Id);
        }

        public static int? Match(Dictionary<string, int> map, string? code) =>
            map.TryGetValue(Normalize(code), out var id) ? id : null;
    }
}
