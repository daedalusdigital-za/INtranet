using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.DTOs.Logistics.Shipments
{
    public class AddressInputDto
    {
        /// <summary>Use a saved address-book entry instead of the fields below.</summary>
        public int? AddressId { get; set; }
        public string? Label { get; set; }
        public string? Line1 { get; set; }
        public string? Line2 { get; set; }
        public string? Suburb { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? GooglePlaceId { get; set; }
        public string? ContactName { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public bool SaveToAddressBook { get; set; }
    }

    public class ShipmentItemInputDto
    {
        public string Type { get; set; } = "parcel";
        public int Qty { get; set; } = 1;
        public decimal WeightKg { get; set; }
        public decimal? LengthCm { get; set; }
        public decimal? WidthCm { get; set; }
        public decimal? HeightCm { get; set; }
        public string? Description { get; set; }
    }

    public class ShipmentInputDto
    {
        [Required] public AddressInputDto Pickup { get; set; } = new();
        [Required] public AddressInputDto Delivery { get; set; } = new();
        public DateTime CollectionDate { get; set; }
        public string? CollectionWindowFrom { get; set; }
        public string? CollectionWindowTo { get; set; }
        public DateTime RequestedDeliveryDate { get; set; }
        public List<ShipmentItemInputDto> Items { get; set; } = new();
        public bool Fragile { get; set; }
        public bool Hazardous { get; set; }
        public string? HazardClass { get; set; }
        public string? TemperatureRange { get; set; }
        public string? SpecialInstructions { get; set; }
    }

    public class CreateBookingDto
    {
        public int CustomerId { get; set; }
        public string Source { get; set; } = "ops"; // portal | csv | api | ops
        public string? ClientReference { get; set; }
        public string? RequestedByName { get; set; }
        public string? RequestedByEmail { get; set; }
        public string? RequestedByPhone { get; set; }
        public string? Notes { get; set; }
        [Required, MinLength(1)] public List<ShipmentInputDto> Shipments { get; set; } = new();
    }

    public class RejectBookingDto { [Required] public string Reason { get; set; } = string.Empty; }
    public class NoteDto { public string? Note { get; set; } }

    public class PlanShipmentsDto
    {
        [Required, MinLength(1)] public List<int> ShipmentIds { get; set; } = new();
        /// <summary>Create pickup/delivery stops on the load's tripsheet (default true).</summary>
        public bool CreateStops { get; set; } = true;
    }

    public class DriverScanDto
    {
        [Required] public string ScanId { get; set; } = string.Empty;   // client UUID, idempotency key
        [Required] public string Code { get; set; } = string.Empty;     // waybill no, item code or tracking token/URL
        [Required] public string Type { get; set; } = "collect";        // collect | deliver
        public int? DriverId { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public DateTime? OccurredAt { get; set; }
        public string? DeviceId { get; set; }
        // Delivery-only
        public string? ReceiverName { get; set; }
        public string? Note { get; set; }
        public bool Damaged { get; set; }
        public bool Short { get; set; }
        /// <summary>Optional data-URL / base64 PNG signature when not using multipart.</summary>
        public string? SignatureBase64 { get; set; }
    }

    public class DriverExceptionDto
    {
        [Required] public string ScanId { get; set; } = string.Empty;
        [Required] public string Code { get; set; } = string.Empty;
        [Required] public string Stage { get; set; } = "delivery"; // collection | delivery
        [Required] public string ReasonCode { get; set; } = string.Empty;
        public string? Note { get; set; }
        public int? DriverId { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public DateTime? OccurredAt { get; set; }
    }
}
