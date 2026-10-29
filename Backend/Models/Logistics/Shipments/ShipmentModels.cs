using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics.Shipments
{
    /// <summary>Shipment lifecycle statuses. Status lives on the shipment, never on the load.</summary>
    public static class ShipmentStatus
    {
        public const string Booked = "BOOKED";
        public const string Confirmed = "CONFIRMED";
        public const string Rejected = "REJECTED";
        public const string Planned = "PLANNED";
        public const string WaybillIssued = "WAYBILL_ISSUED";
        public const string Collected = "COLLECTED";
        public const string CollectionFailed = "COLLECTION_FAILED";
        public const string InTransit = "IN_TRANSIT";
        public const string Arriving = "ARRIVING";
        public const string Delivered = "DELIVERED";
        public const string DeliveryFailed = "DELIVERY_FAILED";
        public const string Cancelled = "CANCELLED";

        public static readonly string[] Active =
            { Booked, Confirmed, Planned, WaybillIssued, Collected, CollectionFailed, InTransit, Arriving, DeliveryFailed };

        public static readonly string[] OnTheRoad = { Collected, InTransit, Arriving };
        public static readonly string[] Closed = { Delivered, Rejected, Cancelled };

        /// <summary>Allowed transitions (section 3 of the spec). Anything else is rejected by the status engine.</summary>
        public static readonly Dictionary<string, string[]> Transitions = new()
        {
            [Booked]            = new[] { Confirmed, Rejected, Cancelled },
            [Confirmed]         = new[] { Planned, Cancelled },
            [Planned]           = new[] { WaybillIssued, Confirmed, Cancelled },
            [WaybillIssued]     = new[] { Collected, CollectionFailed, Confirmed, Cancelled },
            [Collected]         = new[] { InTransit, Delivered, DeliveryFailed, Cancelled },
            [InTransit]         = new[] { Arriving, Delivered, DeliveryFailed, Cancelled },
            [Arriving]          = new[] { Delivered, DeliveryFailed, InTransit, Cancelled },
            [CollectionFailed]  = new[] { Confirmed, Cancelled },
            [DeliveryFailed]    = new[] { Confirmed, Cancelled },
            [Delivered]         = Array.Empty<string>(),
            [Rejected]          = Array.Empty<string>(),
            [Cancelled]         = Array.Empty<string>(),
        };

        public static bool CanTransition(string from, string to)
            => Transitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
    }

    public static class ShipmentEventSource
    {
        public const string Client = "client";
        public const string Ops = "ops";
        public const string Driver = "driver";
        public const string Cartrack = "cartrack";
        public const string System = "system";
    }

    /// <summary>Client address book entry (pickup or delivery). Geocoded once at save time.</summary>
    [Table("ShipmentAddresses")]
    public class ShipmentAddress
    {
        public int Id { get; set; }
        /// <summary>Owning client (Customers.Id). Null for ad-hoc addresses captured by ops.</summary>
        public int? CustomerId { get; set; }
        [MaxLength(100)] public string? Label { get; set; }
        [Required, MaxLength(200)] public string Line1 { get; set; } = string.Empty;
        [MaxLength(200)] public string? Line2 { get; set; }
        [MaxLength(100)] public string? Suburb { get; set; }
        [MaxLength(100)] public string? City { get; set; }
        [MaxLength(100)] public string? Province { get; set; }
        [MaxLength(20)] public string? PostalCode { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        [MaxLength(512)] public string? GooglePlaceId { get; set; }
        [MaxLength(150)] public string? ContactName { get; set; }
        [MaxLength(50)] public string? ContactPhone { get; set; }
        [MaxLength(200)] public string? ContactEmail { get; set; }
        /// <summary>Geofence radius in metres used for IN_TRANSIT / ARRIVING detection.</summary>
        public int GeofenceRadiusM { get; set; } = 500;
        public bool IsSaved { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public int? CreatedByUserId { get; set; }

        [NotMapped]
        public string OneLine => string.Join(", ", new[] { Line1, Line2, Suburb, City, Province, PostalCode }.Where(s => !string.IsNullOrWhiteSpace(s)));
    }

    /// <summary>A client booking: one or more shipments submitted together.</summary>
    [Table("ClientBookings")]
    public class ClientBooking
    {
        public int Id { get; set; }
        [Required, MaxLength(20)] public string BookingNo { get; set; } = string.Empty; // BK-YYYY-NNNNNN
        public int CustomerId { get; set; }
        [MaxLength(20)] public string Source { get; set; } = "portal"; // portal | csv | api | ops
        [MaxLength(50)] public string? ClientReference { get; set; }
        [MaxLength(30)] public string Status { get; set; } = ShipmentStatus.Booked; // BOOKED | CONFIRMED | REJECTED | CANCELLED
        [MaxLength(150)] public string? RequestedByName { get; set; }
        [MaxLength(200)] public string? RequestedByEmail { get; set; }
        [MaxLength(50)] public string? RequestedByPhone { get; set; }
        [MaxLength(500)] public string? RejectionReason { get; set; }
        [MaxLength(1000)] public string? Notes { get; set; }
        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? ConfirmedAt { get; set; }
        public int? ConfirmedByUserId { get; set; }

        public virtual Customer? Customer { get; set; }
        public virtual ICollection<Shipment> Shipments { get; set; } = new List<Shipment>();
    }

    /// <summary>One pickup to one delivery. The record that sits between a booking and a load.</summary>
    [Table("Shipments")]
    public class Shipment
    {
        public int Id { get; set; }
        public int BookingId { get; set; }
        public int PickupAddressId { get; set; }
        public int DeliveryAddressId { get; set; }
        public DateTime CollectionDate { get; set; }
        [MaxLength(5)] public string? CollectionWindowFrom { get; set; } // "08:00"
        [MaxLength(5)] public string? CollectionWindowTo { get; set; }   // "12:00"
        public DateTime RequestedDeliveryDate { get; set; }
        [Required, MaxLength(30)] public string Status { get; set; } = ShipmentStatus.Booked;

        public int? LoadId { get; set; }
        public int? PickupStopId { get; set; }
        public int? DeliveryStopId { get; set; }
        public DateTime? Eta { get; set; }

        public bool Fragile { get; set; }
        public bool Hazardous { get; set; }
        [MaxLength(20)] public string? HazardClass { get; set; }
        [MaxLength(50)] public string? TemperatureRange { get; set; }
        public bool DamagedFlag { get; set; }
        public bool ShortFlag { get; set; }
        [MaxLength(1000)] public string? SpecialInstructions { get; set; }

        /// <summary>Denormalised totals for load-capacity checks and lists.</summary>
        public decimal TotalWeightKg { get; set; }
        public int TotalPallets { get; set; }
        public int TotalParcels { get; set; }

        public DateTime? CollectedAt { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public virtual ClientBooking Booking { get; set; } = null!;
        public virtual ShipmentAddress PickupAddress { get; set; } = null!;
        public virtual ShipmentAddress DeliveryAddress { get; set; } = null!;
        public virtual Load? Load { get; set; }
        public virtual ShipmentWaybill? Waybill { get; set; }
        public virtual ShipmentPod? Pod { get; set; }
        public virtual ICollection<ShipmentItem> Items { get; set; } = new List<ShipmentItem>();
        public virtual ICollection<ShipmentEvent> Events { get; set; } = new List<ShipmentEvent>();
        public virtual ICollection<ShipmentException> Exceptions { get; set; } = new List<ShipmentException>();
    }

    [Table("ShipmentItems")]
    public class ShipmentItem
    {
        public int Id { get; set; }
        public int ShipmentId { get; set; }
        [MaxLength(20)] public string Type { get; set; } = "parcel"; // parcel | pallet
        public int Qty { get; set; } = 1;
        public decimal WeightKg { get; set; }
        public decimal? LengthCm { get; set; }
        public decimal? WidthCm { get; set; }
        public decimal? HeightCm { get; set; }
        [MaxLength(300)] public string? Description { get; set; }
        [MaxLength(40)] public string? ItemBarcode { get; set; } // WB-2026-000123-01
        public virtual Shipment Shipment { get; set; } = null!;
    }

    [Table("ShipmentWaybills")]
    public class ShipmentWaybill
    {
        public int Id { get; set; }
        [Required, MaxLength(20)] public string WaybillNo { get; set; } = string.Empty; // WB-YYYY-NNNNNN
        public int ShipmentId { get; set; }
        [MaxLength(40)] public string BarcodeValue { get; set; } = string.Empty;   // = WaybillNo (Code128)
        [MaxLength(300)] public string QrValue { get; set; } = string.Empty;       // tracking URL
        [Required, MaxLength(40)] public string TrackingToken { get; set; } = string.Empty; // random, never the waybill no
        public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
        public int? IssuedByUserId { get; set; }
        public virtual Shipment Shipment { get; set; } = null!;
    }

    /// <summary>Append-only status log. Client timeline, notifications and webhooks all read from here.</summary>
    [Table("ShipmentEvents")]
    public class ShipmentEvent
    {
        public int Id { get; set; }
        public int ShipmentId { get; set; }
        [MaxLength(30)] public string? FromStatus { get; set; }
        [Required, MaxLength(30)] public string ToStatus { get; set; } = string.Empty;
        [MaxLength(20)] public string Source { get; set; } = ShipmentEventSource.System;
        public int? UserId { get; set; }
        [MaxLength(150)] public string? UserName { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        [MaxLength(300)] public string? ScannedCode { get; set; }
        [MaxLength(1000)] public string? Note { get; set; }
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual Shipment Shipment { get; set; } = null!;
    }

    [Table("ShipmentPods")]
    public class ShipmentPod
    {
        public int Id { get; set; }
        public int ShipmentId { get; set; }
        [MaxLength(150)] public string? ReceiverName { get; set; }
        [MaxLength(300)] public string? SignaturePath { get; set; }
        /// <summary>JSON array of relative photo paths.</summary>
        public string? PhotoPathsJson { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public DateTime DeliveredAt { get; set; } = DateTime.UtcNow;
        public int? DriverId { get; set; }
        [MaxLength(100)] public string? DeviceId { get; set; }
        [MaxLength(1000)] public string? Note { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual Shipment Shipment { get; set; } = null!;
    }

    [Table("ShipmentExceptions")]
    public class ShipmentException
    {
        public int Id { get; set; }
        public int ShipmentId { get; set; }
        [MaxLength(30)] public string Type { get; set; } = string.Empty; // COLLECTION_FAILED | DELIVERY_FAILED
        [MaxLength(50)] public string? ReasonCode { get; set; }
        [MaxLength(1000)] public string? Note { get; set; }
        public string? PhotoPathsJson { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public int? LoggedByDriverId { get; set; }
        public int? LoggedByUserId { get; set; }
        public int? ResolvedByUserId { get; set; }
        [MaxLength(30)] public string? Resolution { get; set; } // replan | cancel | return_to_sender
        public DateTime? ResolvedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual Shipment Shipment { get; set; } = null!;
    }

    /// <summary>Every driver scan, keyed by the app-generated ScanId so offline retries are idempotent.</summary>
    [Table("ShipmentDriverScans")]
    public class ShipmentDriverScan
    {
        public int Id { get; set; }
        [Required, MaxLength(64)] public string ScanId { get; set; } = string.Empty;
        public int? ShipmentId { get; set; }
        [MaxLength(300)] public string Code { get; set; } = string.Empty;
        [MaxLength(20)] public string ScanType { get; set; } = string.Empty; // collect | deliver | exception
        public int? DriverId { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public DateTime OccurredAt { get; set; }
        public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
        [MaxLength(30)] public string Result { get; set; } = string.Empty; // applied | duplicate | rejected | stale
        [MaxLength(500)] public string? Message { get; set; }
    }

    [Table("ShipmentNotificationLogs")]
    public class ShipmentNotificationLog
    {
        public int Id { get; set; }
        public int ShipmentId { get; set; }
        [MaxLength(10)] public string Channel { get; set; } = "email"; // email | sms
        [MaxLength(200)] public string Recipient { get; set; } = string.Empty;
        [MaxLength(50)] public string Template { get; set; } = string.Empty;
        [MaxLength(20)] public string Status { get; set; } = "queued"; // sent | failed | skipped
        [MaxLength(200)] public string? ProviderMessageId { get; set; }
        [MaxLength(1000)] public string? Error { get; set; }
        public DateTime? SentAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Server-side number sequences (BK-2026, WB-2026). Never client generated.</summary>
    [Table("NumberSequences")]
    public class NumberSequence
    {
        [Key, MaxLength(30)] public string Key { get; set; } = string.Empty;
        public int NextValue { get; set; } = 1;
    }
}
