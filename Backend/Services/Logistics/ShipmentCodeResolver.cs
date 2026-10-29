using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics.Shipments;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// The one resolver for every scanned/typed code: waybill number, item label
    /// (WB-…-01), booking number, tracking token or full tracking URL → shipment.
    /// Used by the driver app endpoints, warehouse scanners and portal search.
    /// </summary>
    public static class ShipmentCodeResolver
    {
        public static IQueryable<Shipment> Full(ApplicationDbContext db) => db.Shipments
            .Include(s => s.Booking).ThenInclude(b => b.Customer)
            .Include(s => s.PickupAddress).Include(s => s.DeliveryAddress)
            .Include(s => s.Items).Include(s => s.Waybill).Include(s => s.Load);

        public static async Task<Shipment?> ResolveAsync(ApplicationDbContext db, string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var code = raw.Trim();
            var idx = code.LastIndexOf("/t/", StringComparison.OrdinalIgnoreCase);
            if (idx >= 0) code = code[(idx + 3)..].Trim('/');
            var upper = code.ToUpperInvariant();

            var q = Full(db);
            Shipment? s = null;
            if (upper.StartsWith("WB-"))
            {
                var parts = upper.Split('-');
                var wbNo = parts.Length >= 3 ? string.Join('-', parts.Take(3)) : upper;
                s = await q.FirstOrDefaultAsync(x => x.Waybill != null && x.Waybill.WaybillNo == wbNo);
            }
            else if (upper.StartsWith("BK-"))
                s = await q.FirstOrDefaultAsync(x => x.Booking.BookingNo == upper);
            var lower = code.ToLowerInvariant();
            s ??= await q.FirstOrDefaultAsync(x => x.Waybill != null && x.Waybill.TrackingToken == lower);
            return s;
        }
    }
}
