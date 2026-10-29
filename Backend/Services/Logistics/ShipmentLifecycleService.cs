using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics.Shipments;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Server-side, transaction-safe number sequences (BK-YYYY-NNNNNN, WB-YYYY-NNNNNN).
    /// Uses a single atomic UPDATE ... OUTPUT so concurrent bookings never collide,
    /// unlike the read-then-insert LoadNumber pattern.
    /// </summary>
    public interface INumberSequenceService
    {
        Task<string> NextAsync(string prefix, DateTime? now = null);
    }

    public class NumberSequenceService : INumberSequenceService
    {
        private readonly ApplicationDbContext _db;
        public NumberSequenceService(ApplicationDbContext db) => _db = db;

        public async Task<string> NextAsync(string prefix, DateTime? now = null)
        {
            var year = (now ?? DateTime.UtcNow.AddHours(2)).Year; // SAST
            var key = $"{prefix}-{year}";

            // Ensure the row exists (idempotent), then atomically increment and read.
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"IF NOT EXISTS (SELECT 1 FROM NumberSequences WITH (UPDLOCK, HOLDLOCK) WHERE [Key] = {key}) INSERT INTO NumberSequences ([Key],[NextValue]) VALUES ({key}, 1)");

            // UPDATE…OUTPUT is not composable, so materialise with AsAsyncEnumerable rather than FirstAsync.
            var next = 0;
            await foreach (var v in _db.Database
                .SqlQuery<int>($"UPDATE NumberSequences SET NextValue = NextValue + 1 OUTPUT INSERTED.NextValue - 1 AS [Value] WHERE [Key] = {key}")
                .AsAsyncEnumerable())
            {
                next = v;
                break;
            }

            return $"{key}-{next:D6}";
        }
    }

    /// <summary>SMS gateway abstraction. No provider is configured yet; swap in Clickatell/BulkSMS here.</summary>
    public interface ISmsService
    {
        bool IsConfigured { get; }
        Task<(bool ok, string? providerId, string? error)> SendAsync(string toE164, string message);
    }

    public class LoggingSmsService : ISmsService
    {
        private readonly ILogger<LoggingSmsService> _logger;
        public LoggingSmsService(ILogger<LoggingSmsService> logger) => _logger = logger;
        public bool IsConfigured => false;
        public Task<(bool ok, string? providerId, string? error)> SendAsync(string toE164, string message)
        {
            _logger.LogInformation("SMS (no provider configured) to {To}: {Message}", toE164, message);
            return Task.FromResult<(bool, string?, string?)>((false, null, "No SMS provider configured"));
        }
    }

    public class ShipmentTransitionException : InvalidOperationException
    {
        public string Code { get; }
        public ShipmentTransitionException(string code, string message) : base(message) => Code = code;
    }

    public record TransitionContext(
        string Source,
        int? UserId = null,
        string? UserName = null,
        string? Note = null,
        double? Latitude = null,
        double? Longitude = null,
        string? ScannedCode = null,
        DateTime? OccurredAt = null);

    /// <summary>
    /// The status engine. Every change goes through <see cref="TransitionAsync"/>, which
    /// validates the move against <see cref="ShipmentStatus.Transitions"/>, writes an
    /// append-only ShipmentEvent, updates denormalised timestamps, and hands the event to
    /// the notification service. Nothing else may set Shipment.Status.
    /// </summary>
    public interface IShipmentLifecycleService
    {
        Task<ShipmentEvent> TransitionAsync(Shipment shipment, string toStatus, TransitionContext ctx, bool save = true);
        Task<ShipmentEvent> RecordInitialAsync(Shipment shipment, TransitionContext ctx);
    }

    public class ShipmentLifecycleService : IShipmentLifecycleService
    {
        private readonly ApplicationDbContext _db;
        private readonly IShipmentNotificationService _notifications;
        private readonly ILogger<ShipmentLifecycleService> _logger;
        private readonly Services.Flows.IFlowEventPublisher? _flows;

        public ShipmentLifecycleService(ApplicationDbContext db, IShipmentNotificationService notifications, ILogger<ShipmentLifecycleService> logger, Services.Flows.IFlowEventPublisher? flows = null)
        {
            _db = db; _notifications = notifications; _logger = logger; _flows = flows;
        }

        private void PublishFlowEvent(Shipment shipment, string? from, string to, TransitionContext ctx)
        {
            if (_flows == null) return;
            var name = to switch
            {
                ShipmentStatus.Delivered => "shipment.delivered",
                ShipmentStatus.DeliveryFailed => "shipment.delivery_failed",
                ShipmentStatus.CollectionFailed => "shipment.collection_failed",
                ShipmentStatus.Booked => "shipment.booked",
                ShipmentStatus.Cancelled => "shipment.cancelled",
                _ => "shipment.status_changed"
            };
            _flows.PublishShipmentEvent(name, shipment.Id, new System.Text.Json.Nodes.JsonObject
            {
                ["fromStatus"] = from, ["toStatus"] = to, ["source"] = ctx.Source, ["note"] = ctx.Note, ["userName"] = ctx.UserName
            });
        }

        public async Task<ShipmentEvent> RecordInitialAsync(Shipment shipment, TransitionContext ctx)
        {
            var ev = NewEvent(shipment, null, ShipmentStatus.Booked, ctx);
            shipment.Status = ShipmentStatus.Booked;
            _db.ShipmentEvents.Add(ev);
            await _db.SaveChangesAsync();
            await _notifications.OnEventAsync(shipment, ev);
            PublishFlowEvent(shipment, null, ShipmentStatus.Booked, ctx);
            return ev;
        }

        public async Task<ShipmentEvent> TransitionAsync(Shipment shipment, string toStatus, TransitionContext ctx, bool save = true)
        {
            var from = shipment.Status;
            if (from == toStatus)
                throw new ShipmentTransitionException("ALREADY_IN_STATUS", $"Shipment is already {toStatus}.");
            if (!ShipmentStatus.CanTransition(from, toStatus))
                throw new ShipmentTransitionException("INVALID_TRANSITION", $"Cannot move a shipment from {from} to {toStatus}.");

            var ev = NewEvent(shipment, from, toStatus, ctx);
            shipment.Status = toStatus;
            shipment.UpdatedAt = DateTime.UtcNow;
            if (toStatus == ShipmentStatus.Collected) shipment.CollectedAt = ev.OccurredAt;
            if (toStatus == ShipmentStatus.Delivered) shipment.DeliveredAt = ev.OccurredAt;
            if (toStatus == ShipmentStatus.Confirmed && (from == ShipmentStatus.CollectionFailed || from == ShipmentStatus.DeliveryFailed || from == ShipmentStatus.Planned || from == ShipmentStatus.WaybillIssued))
            {
                // Re-plan: the shipment leaves its load; waybill stays (re-issued only if missing).
                shipment.LoadId = null; shipment.PickupStopId = null; shipment.DeliveryStopId = null; shipment.Eta = null;
            }

            _db.ShipmentEvents.Add(ev);
            if (save)
            {
                await _db.SaveChangesAsync();
                await _notifications.OnEventAsync(shipment, ev);
                PublishFlowEvent(shipment, from, toStatus, ctx);
            }
            _logger.LogInformation("Shipment {Id} {From} -> {To} by {Source}", shipment.Id, from, toStatus, ctx.Source);
            return ev;
        }

        private static ShipmentEvent NewEvent(Shipment s, string? from, string to, TransitionContext ctx) => new()
        {
            ShipmentId = s.Id,
            Shipment = s,
            FromStatus = from,
            ToStatus = to,
            Source = ctx.Source,
            UserId = ctx.UserId,
            UserName = ctx.UserName,
            Note = ctx.Note,
            Latitude = ctx.Latitude,
            Longitude = ctx.Longitude,
            ScannedCode = ctx.ScannedCode,
            OccurredAt = ctx.OccurredAt ?? DateTime.UtcNow
        };
    }
}
