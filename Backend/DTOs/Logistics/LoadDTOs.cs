namespace ProjectTracker.API.DTOs.Logistics
{
    // Load DTOs
    public class LoadDto
    {
        public int Id { get; set; }
        public string LoadNumber { get; set; } = string.Empty;
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public int? VehicleId { get; set; }
        public string? VehicleRegistration { get; set; }
        public int? DriverId { get; set; }
        public string? DriverName { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? ScheduledPickupDate { get; set; }
        public DateTime? ActualPickupDate { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public DateTime? ActualDeliveryDate { get; set; }
        public decimal? EstimatedCost { get; set; }
        public decimal? ActualCost { get; set; }
        public decimal? ChargeAmount { get; set; }
        public decimal? EstimatedDistance { get; set; }
        public decimal? ActualDistance { get; set; }
        public string? SpecialInstructions { get; set; }
        public string? Notes { get; set; }
        public List<LoadStopDto> Stops { get; set; } = new();
        public List<LoadItemDto> Items { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class CreateLoadDto
    {
        public int CustomerId { get; set; }
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public DateTime? ScheduledPickupDate { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public decimal? EstimatedCost { get; set; }
        public decimal? ChargeAmount { get; set; }
        public decimal? EstimatedDistance { get; set; }
        public string? SpecialInstructions { get; set; }
        public string? Notes { get; set; }
        public List<CreateLoadStopDto> Stops { get; set; } = new();
        public List<CreateLoadItemDto> Items { get; set; } = new();
    }

    public class UpdateLoadDto
    {
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public string? Status { get; set; }
        public DateTime? ScheduledPickupDate { get; set; }
        public DateTime? ActualPickupDate { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public DateTime? ActualDeliveryDate { get; set; }
        public decimal? EstimatedCost { get; set; }
        public decimal? ActualCost { get; set; }
        public decimal? ChargeAmount { get; set; }
        public decimal? ActualDistance { get; set; }
        public string? Notes { get; set; }
    }

    public class LoadStopDto
    {
        public int Id { get; set; }
        public int StopSequence { get; set; }
        public string StopType { get; set; } = string.Empty;
        public string? LocationName { get; set; }
        public string Address { get; set; } = string.Empty;
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public DateTime? ScheduledArrival { get; set; }
        public DateTime? ActualArrival { get; set; }
        public DateTime? ActualDeparture { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    public class CreateLoadStopDto
    {
        public int StopSequence { get; set; }
        public string StopType { get; set; } = string.Empty;
        public string? LocationName { get; set; }
        public string Address { get; set; } = string.Empty;
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public DateTime? ScheduledArrival { get; set; }
        public string? Notes { get; set; }
    }

    public class LoadItemDto
    {
        public int Id { get; set; }
        public int CommodityId { get; set; }
        public string CommodityName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal? Weight { get; set; }
        public decimal? Volume { get; set; }
        public string? Description { get; set; }
    }

    public class CreateLoadItemDto
    {
        public int CommodityId { get; set; }
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal? Weight { get; set; }
        public decimal? Volume { get; set; }
        public string? Description { get; set; }
    }

    // Proof of Delivery DTOs
    public class ProofOfDeliveryDto
    {
        public int Id { get; set; }
        public int LoadId { get; set; }
        public string? RecipientName { get; set; }
        public string? SignatureUrl { get; set; }
        public DateTime DeliveredAt { get; set; }
        public decimal? DeliveryLatitude { get; set; }
        public decimal? DeliveryLongitude { get; set; }
        public string? Notes { get; set; }
        public string? PhotoUrls { get; set; }
        public string? ConditionOnDelivery { get; set; }
        public string? DamageNotes { get; set; }
    }

    public class CreateProofOfDeliveryDto
    {
        public int LoadId { get; set; }
        public string? RecipientName { get; set; }
        public string? SignatureUrl { get; set; }
        public decimal? DeliveryLatitude { get; set; }
        public decimal? DeliveryLongitude { get; set; }
        public string? Notes { get; set; }
        public string? PhotoUrls { get; set; }
        public string? ConditionOnDelivery { get; set; }
        public string? DamageNotes { get; set; }
    }
}
