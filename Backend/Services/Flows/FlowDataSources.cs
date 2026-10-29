using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics.Shipments;

namespace ProjectTracker.API.Services.Flows
{
    public sealed record FlowSourceItem(string? EntityType, string? EntityKey, JsonObject Data);

    public sealed record FlowDataSourceInfo(string Key, string Name, string Description, string EntityType, string[] Params, string[] Fields);

    /// <summary>
    /// Named queries over existing systems that a scheduled flow can poll ("every 30 minutes, for each shipment
    /// delivered > 24h ago without a POD, start a run"). Each item becomes <c>entity.*</c> in the run context.
    /// </summary>
    public interface IFlowDataSources
    {
        IReadOnlyList<FlowDataSourceInfo> Catalog { get; }
        Task<List<FlowSourceItem>> QueryAsync(string key, Dictionary<string, string>? parameters, CancellationToken ct);
        /// <summary>Build the <c>entity</c> object for a shipment (shared by event publishing and data sources).</summary>
        Task<JsonObject?> ShipmentEntityAsync(int shipmentId, CancellationToken ct);
    }

    public class FlowDataSources : IFlowDataSources
    {
        private readonly ApplicationDbContext _db;
        public FlowDataSources(ApplicationDbContext db) { _db = db; }

        private static readonly string[] ShipmentFields =
        {
            "id", "waybillNo", "bookingNo", "clientReference", "status", "customerName", "customerCode",
            "collectionDate", "requestedDeliveryDate", "deliveredAt", "hoursSinceDelivered", "hoursOverdue",
            "hasPod", "loadNumber", "driverName", "vehicleReg", "deliveryCity", "deliveryContact", "deliveryPhone",
            "pickupCity", "totalWeightKg", "totalParcels", "openExceptions", "lastException.type", "lastException.reasonCode", "lastException.note"
        };

        public IReadOnlyList<FlowDataSourceInfo> Catalog { get; } = new List<FlowDataSourceInfo>
        {
            new("shipments_missing_pod", "Shipments delivered without POD",
                "Shipments marked DELIVERED more than N hours ago that have no proof of delivery captured.",
                "shipment", new[] { "hours (default 24)" }, ShipmentFields),
            new("shipments_overdue", "Shipments past requested delivery date",
                "Active shipments whose requested delivery date is more than N hours in the past and are not delivered.",
                "shipment", new[] { "hours (default 0)" }, ShipmentFields),
            new("open_shipment_exceptions", "Unresolved shipment exceptions",
                "Shipments with a COLLECTION_FAILED / DELIVERY_FAILED exception that has not been resolved for N hours.",
                "shipment", new[] { "hours (default 2)" }, ShipmentFields),
            new("shipments_unplanned", "Confirmed shipments not yet planned",
                "Shipments CONFIRMED but not assigned to a load, collecting within N hours.",
                "shipment", new[] { "hours (default 24)" }, ShipmentFields),
            new("overdue_flow_tasks", "Overdue flow tasks",
                "Flow tasks/approvals still open after their due date (for escalation digests).",
                "flowtask", Array.Empty<string>(), new[] { "id", "title", "assignee", "runNumber", "dueAt", "hoursOverdue" }),
        };

        public async Task<List<FlowSourceItem>> QueryAsync(string key, Dictionary<string, string>? p, CancellationToken ct)
        {
            double Hours(string name, double dflt) => p != null && p.TryGetValue(name, out var v) && double.TryParse(v, out var d) ? d : dflt;
            var now = DateTime.UtcNow;

            switch ((key ?? "").ToLowerInvariant())
            {
                case "shipments_missing_pod":
                    {
                        var cutoff = now.AddHours(-Hours("hours", 24));
                        var ids = await _db.Shipments.AsNoTracking()
                            .Where(s => s.Status == ShipmentStatus.Delivered && s.Pod == null && (s.DeliveredAt ?? s.UpdatedAt ?? s.CreatedAt) <= cutoff)
                            .OrderBy(s => s.DeliveredAt).Select(s => s.Id).Take(100).ToListAsync(ct);
                        return await ShipmentsAsync(ids, ct);
                    }
                case "shipments_overdue":
                    {
                        var cutoff = now.AddHours(-Hours("hours", 0));
                        var ids = await _db.Shipments.AsNoTracking()
                            .Where(s => ShipmentStatus.Active.Contains(s.Status) && s.RequestedDeliveryDate <= cutoff)
                            .OrderBy(s => s.RequestedDeliveryDate).Select(s => s.Id).Take(100).ToListAsync(ct);
                        return await ShipmentsAsync(ids, ct);
                    }
                case "open_shipment_exceptions":
                    {
                        var cutoff = now.AddHours(-Hours("hours", 2));
                        var ids = await _db.ShipmentExceptions.AsNoTracking()
                            .Where(e => e.ResolvedAt == null && e.CreatedAt <= cutoff)
                            .Select(e => e.ShipmentId).Distinct().Take(100).ToListAsync(ct);
                        return await ShipmentsAsync(ids, ct);
                    }
                case "shipments_unplanned":
                    {
                        var horizon = now.AddHours(Hours("hours", 24));
                        var ids = await _db.Shipments.AsNoTracking()
                            .Where(s => s.Status == ShipmentStatus.Confirmed && s.LoadId == null && s.CollectionDate <= horizon)
                            .OrderBy(s => s.CollectionDate).Select(s => s.Id).Take(100).ToListAsync(ct);
                        return await ShipmentsAsync(ids, ct);
                    }
                case "overdue_flow_tasks":
                    {
                        var tasks = await _db.FlowTasks.AsNoTracking().Include(t => t.Run)
                            .Where(t => (t.Status == "open" || t.Status == "escalated") && t.DueAt != null && t.DueAt < now)
                            .Take(200).ToListAsync(ct);
                        return tasks.Select(t => new FlowSourceItem("flowtask", t.Id.ToString(), new JsonObject
                        {
                            ["id"] = t.Id, ["title"] = t.Title, ["assignee"] = t.AssigneeLabel, ["runNumber"] = t.Run.RunNumber,
                            ["runTitle"] = t.Run.Title, ["dueAt"] = t.DueAt?.ToString("yyyy-MM-dd HH:mm"),
                            ["hoursOverdue"] = Math.Round((now - t.DueAt!.Value).TotalHours, 1)
                        })).ToList();
                    }
                case "none":
                case "":
                    return new List<FlowSourceItem>();
                default:
                    throw new InvalidOperationException($"Unknown data source '{key}'");
            }
        }

        private async Task<List<FlowSourceItem>> ShipmentsAsync(List<int> ids, CancellationToken ct)
        {
            var list = new List<FlowSourceItem>();
            foreach (var id in ids)
            {
                var e = await ShipmentEntityAsync(id, ct);
                if (e != null) list.Add(new FlowSourceItem("shipment", id.ToString(), e));
            }
            return list;
        }

        public async Task<JsonObject?> ShipmentEntityAsync(int shipmentId, CancellationToken ct)
        {
            var s = await _db.Shipments.AsNoTracking()
                .Include(x => x.Booking).ThenInclude(b => b.Customer)
                .Include(x => x.Waybill).Include(x => x.Pod)
                .Include(x => x.PickupAddress).Include(x => x.DeliveryAddress)
                .Include(x => x.Load).ThenInclude(l => l!.Driver)
                .Include(x => x.Load).ThenInclude(l => l!.Vehicle)
                .Include(x => x.Exceptions)
                .FirstOrDefaultAsync(x => x.Id == shipmentId, ct);
            if (s == null) return null;

            var now = DateTime.UtcNow;
            var lastEx = s.Exceptions.OrderByDescending(e => e.CreatedAt).FirstOrDefault();
            var obj = new JsonObject
            {
                ["type"] = "shipment",
                ["id"] = s.Id,
                ["waybillNo"] = s.Waybill?.WaybillNo,
                ["bookingNo"] = s.Booking?.BookingNo,
                ["clientReference"] = s.Booking?.ClientReference,
                ["status"] = s.Status,
                ["customerId"] = s.Booking?.CustomerId,
                ["customerName"] = s.Booking?.Customer?.Name,
                ["customerCode"] = s.Booking?.Customer?.CustomerCode,
                ["requestedByEmail"] = s.Booking?.RequestedByEmail,
                ["collectionDate"] = s.CollectionDate.ToString("yyyy-MM-dd"),
                ["requestedDeliveryDate"] = s.RequestedDeliveryDate.ToString("yyyy-MM-dd"),
                ["collectedAt"] = s.CollectedAt?.ToString("yyyy-MM-dd HH:mm"),
                ["deliveredAt"] = s.DeliveredAt?.ToString("yyyy-MM-dd HH:mm"),
                ["hoursSinceDelivered"] = s.DeliveredAt.HasValue ? Math.Round((now - s.DeliveredAt.Value).TotalHours, 1) : null,
                ["hoursOverdue"] = Math.Round((now - s.RequestedDeliveryDate).TotalHours, 1),
                ["hasPod"] = s.Pod != null,
                ["podReceiver"] = s.Pod?.ReceiverName,
                ["loadId"] = s.LoadId,
                ["loadNumber"] = s.Load?.LoadNumber,
                ["driverName"] = s.Load?.Driver == null ? null : $"{s.Load.Driver.FirstName} {s.Load.Driver.LastName}".Trim(),
                ["vehicleReg"] = s.Load?.Vehicle?.RegistrationNumber,
                ["pickupCity"] = s.PickupAddress?.City,
                ["pickupAddress"] = s.PickupAddress?.OneLine,
                ["deliveryCity"] = s.DeliveryAddress?.City,
                ["deliveryAddress"] = s.DeliveryAddress?.OneLine,
                ["deliveryContact"] = s.DeliveryAddress?.ContactName,
                ["deliveryPhone"] = s.DeliveryAddress?.ContactPhone,
                ["deliveryEmail"] = s.DeliveryAddress?.ContactEmail,
                ["totalWeightKg"] = s.TotalWeightKg,
                ["totalParcels"] = s.TotalParcels,
                ["totalPallets"] = s.TotalPallets,
                ["fragile"] = s.Fragile,
                ["hazardous"] = s.Hazardous,
                ["specialInstructions"] = s.SpecialInstructions,
                ["openExceptions"] = s.Exceptions.Count(e => e.ResolvedAt == null),
                ["lastException"] = lastEx == null ? null : new JsonObject
                {
                    ["id"] = lastEx.Id, ["type"] = lastEx.Type, ["reasonCode"] = lastEx.ReasonCode, ["note"] = lastEx.Note,
                    ["createdAt"] = lastEx.CreatedAt.ToString("yyyy-MM-dd HH:mm"), ["resolved"] = lastEx.ResolvedAt != null
                },
                ["url"] = $"/logistics/shipments/{s.Id}"
            };
            return obj;
        }
    }
}
