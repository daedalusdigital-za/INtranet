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

        public static object Blocked(string? loadNumber, string refusedAction)
        {
            var text = $"Stock has already been deducted for {loadNumber ?? "this load"}, so you can't {refusedAction}. " +
                       "Reverse its dispatch in Stock › Movements first, then try again.";
            return new { error = text, message = text, code = Code };
        }
    }
}
