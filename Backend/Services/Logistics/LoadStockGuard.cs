using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Once stock has come off for a load (an approved, unreversed Dispatch row in the stock
    /// ledger), the load's goods must not change until that dispatch is reversed. Deleting,
    /// cancelling, or changing the load's lines, invoices or warehouse would leave the deduction
    /// behind, and the same invoices could then be deducted again on another load.
    /// </summary>
    public static class LoadStockGuard
    {
        public const string Code = "stock-deducted";

        public static Task<bool> HasLiveDeductionAsync(ApplicationDbContext db, int loadId) =>
            db.WarehouseStockMovements.AnyAsync(m =>
                m.LoadId == loadId && m.MovementType == "Dispatch" && m.Status == "Approved" && m.ReversedByMovementId == null);

        /// <summary>
        /// The 409 body: says what was refused and how to unblock it. Carries both `error` and
        /// `message` because Logistics and Stock screens read different keys.
        /// </summary>
        /// <summary>
        /// When the load's stock left the warehouse — the date compared with stock-count dates. Pickup comes
        /// first because goods leave at pickup, not delivery; CreatedAt is last because tripsheets are often
        /// captured weeks after the trip.
        /// </summary>
        public static DateTime DispatchDate(Models.Logistics.Load load) =>
            load.ActualPickupDate ?? load.ScheduledPickupDate ?? load.ActualDeliveryDate ?? load.ScheduledDeliveryDate ?? load.CreatedAt;

        // ───────────── Lines that must not deduct (again) ─────────────

        private static readonly System.Text.RegularExpressions.Regex PickupRef = new(
            @"^\s*(P\s*/\s*U\s*P?|PICK\s*-?\s*UP|PICKUP|P\.?U\.?)\b|^\s*P/U",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled);

        /// <summary>
        /// A pick-up line ("P/UP EMI070", "PICK UP NC002", "PICKUP-NKM005"): the driver collects goods
        /// at the customer, so nothing leaves our warehouse and it is never a stock deduction.
        /// </summary>
        public static bool IsPickupLine(string? invoiceNumber) =>
            !string.IsNullOrWhiteSpace(invoiceNumber) && PickupRef.IsMatch(invoiceNumber);

        /// <summary>The separate invoice numbers on a line ("IN1, IN2" → IN1, IN2), normalised for comparison.</summary>
        public static IEnumerable<string> InvoiceTokens(string? invoiceNumber) =>
            string.IsNullOrWhiteSpace(invoiceNumber) || IsPickupLine(invoiceNumber)
                ? Enumerable.Empty<string>()
                : invoiceNumber.Split(new[] { ',', ';', '&', '+' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(t => System.Text.RegularExpressions.Regex.Replace(t.ToUpperInvariant(), @"INV\s*NO\.?|[^A-Z0-9]", ""))
                    .Where(t => t.Length >= 4 && t.Any(char.IsDigit))
                    .Distinct();

        public record LineInfo(int Id, int LoadId, int? CommodityId, string? InvoiceNumber, decimal Quantity);

        /// <summary>Why a line on a load awaiting approval must not deduct stock, or null when it should.</summary>
        public record Exclusion(int LineId, string Reason, string? OtherLoadNumber);

        /// <summary>
        /// Lines on the given (not yet deducted) loads that must not take stock off: pick-up lines, and lines
        /// whose invoice + stock item already came off on ANOTHER load (an invoice re-tripsheeted after a failed
        /// or rescheduled trip). Approving those again is the double deduction that drives stock negative.
        /// </summary>
        public static async Task<Dictionary<int, Exclusion>> ExclusionsAsync(ApplicationDbContext db, ICollection<int> loadIds)
        {
            var result = new Dictionary<int, Exclusion>();
            if (loadIds.Count == 0) return result;

            var mine = await db.StopCommodities.AsNoTracking()
                .Where(sc => loadIds.Contains(sc.LoadStop.LoadId) && sc.Quantity > 0)
                .Select(sc => new LineInfo(sc.Id, sc.LoadStop.LoadId, sc.CommodityId, sc.InvoiceNumber, sc.Quantity))
                .ToListAsync();

            foreach (var l in mine.Where(l => IsPickupLine(l.InvoiceNumber)))
                result[l.Id] = new Exclusion(l.Id, "Pick-up — goods are collected at the customer, not taken from stock", null);

            var wanted = mine.Where(l => l.CommodityId != null && !result.ContainsKey(l.Id))
                .SelectMany(l => InvoiceTokens(l.InvoiceNumber).Select(t => (Token: t, Commodity: l.CommodityId!.Value, Line: l)))
                .ToList();
            if (wanted.Count == 0) return result;

            // Loads (other than these) whose stock already came off, per stock item
            var commodityIds = wanted.Select(w => w.Commodity).Distinct().ToList();
            var deducted = await db.WarehouseStockMovements.AsNoTracking()
                .Where(m => m.LoadId != null && !loadIds.Contains(m.LoadId.Value) && m.MovementType == "Dispatch"
                         && m.Status == "Approved" && m.ReversedByMovementId == null && commodityIds.Contains(m.CommodityId))
                .Select(m => new { LoadId = m.LoadId!.Value, m.CommodityId })
                .Distinct().ToListAsync();
            if (deducted.Count == 0) return result;
            var deductedLoadIds = deducted.Select(d => d.LoadId).Distinct().ToList();
            var deductedPairs = deducted.Select(d => (d.LoadId, d.CommodityId)).ToHashSet();

            var otherLines = await db.StopCommodities.AsNoTracking()
                .Where(sc => deductedLoadIds.Contains(sc.LoadStop.LoadId) && sc.CommodityId != null && sc.InvoiceNumber != null
                          && sc.LoadStop.Load.Status != "Cancelled")
                .Select(sc => new { sc.LoadStop.LoadId, sc.LoadStop.Load.LoadNumber, CommodityId = sc.CommodityId!.Value, sc.InvoiceNumber })
                .ToListAsync();
            var taken = new Dictionary<(string, int), string>();
            foreach (var o in otherLines.Where(o => deductedPairs.Contains((o.LoadId, o.CommodityId))))
                foreach (var t in InvoiceTokens(o.InvoiceNumber))
                    taken.TryAdd((t, o.CommodityId), o.LoadNumber);

            foreach (var w in wanted)
            {
                if (result.ContainsKey(w.Line.Id) || !taken.TryGetValue((w.Token, w.Commodity), out var other)) continue;
                result[w.Line.Id] = new Exclusion(w.Line.Id, $"Invoice {w.Token} — this item was already deducted on {other}", other);
            }
            return result;
        }

        public static object Blocked(string? loadNumber, string refusedAction)
        {
            var text = $"Stock has already been deducted for {loadNumber ?? "this load"}, so you can't {refusedAction}. " +
                       "Reverse its dispatch in Stock › Movements first, then try again.";
            return new { error = text, message = text, code = Code };
        }
    }
}
