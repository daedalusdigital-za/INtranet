namespace ProjectTracker.API.DTOs.Logistics
{
    // Load DTOs
    public class LoadDto
    {
        public int Id { get; set; }
        public string LoadNumber { get; set; } = string.Empty;
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public int? VehicleId { get; set; }
        public string? VehicleRegistration { get; set; }
        public int? DriverId { get; set; }
        public string? DriverName { get; set; }
        public int? WarehouseId { get; set; }
        public string? WarehouseName { get; set; }
        public int? VehicleTypeId { get; set; }
        public string? VehicleTypeName { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = "Normal";
        public string? PickupLocation { get; set; }
        public decimal? PickupLatitude { get; set; }
        public decimal? PickupLongitude { get; set; }
        public string? DeliveryLocation { get; set; }
        public decimal? DeliveryLatitude { get; set; }
        public decimal? DeliveryLongitude { get; set; }
        public DateTime? ScheduledPickupDate { get; set; }
        public DateTime? ScheduledPickupTime { get; set; }
        public DateTime? ActualPickupDate { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public DateTime? ScheduledDeliveryTime { get; set; }
        public DateTime? ActualDeliveryDate { get; set; }
        public decimal? EstimatedDistance { get; set; }
        public decimal? ActualDistance { get; set; }
        public int? EstimatedTimeMinutes { get; set; }
        public int? ActualTimeMinutes { get; set; }
        public decimal? EstimatedCost { get; set; }
        public decimal? ActualCost { get; set; }
        public decimal? ChargeAmount { get; set; }
        public decimal? TotalWeight { get; set; }
        public decimal? TotalVolume { get; set; }
        public string? SpecialInstructions { get; set; }
        public string? Notes { get; set; }
        public List<LoadStopDto> Stops { get; set; } = new();
        public List<LoadItemDto> Items { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class CreateLoadDto
    {
        // Origin Warehouse
        public int? WarehouseId { get; set; }
        
        // Optional Customer (if the load is for a specific customer)
        public int? CustomerId { get; set; }
        
        // Vehicle Assignment (optional at creation)
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public int? VehicleTypeId { get; set; }
        
        public string Priority { get; set; } = "Normal";
        
        // Scheduling
        public DateTime? ScheduledPickupDate { get; set; }
        public DateTime? ScheduledPickupTime { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public DateTime? ScheduledDeliveryTime { get; set; }
        
        // Pricing/Estimates
        public decimal? EstimatedCost { get; set; }
        public decimal? ChargeAmount { get; set; }
        public decimal? EstimatedDistance { get; set; }
        public int? EstimatedTimeMinutes { get; set; }
        
        public string? SpecialInstructions { get; set; }
        public string? Notes { get; set; }
        
        // Stops (pickup, intermediate stops, destination)
        public List<CreateLoadStopDto> Stops { get; set; } = new();
        
        // Legacy items (for backward compatibility)
        public List<CreateLoadItemDto> Items { get; set; } = new();
    }

    public class UpdateLoadDto
    {
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public int? VehicleTypeId { get; set; }
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public DateTime? ScheduledPickupDate { get; set; }
        public DateTime? ScheduledPickupTime { get; set; }
        public DateTime? ActualPickupDate { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public DateTime? ScheduledDeliveryTime { get; set; }
        public DateTime? ActualDeliveryDate { get; set; }
        public decimal? EstimatedCost { get; set; }
        public decimal? ActualCost { get; set; }
        public decimal? ChargeAmount { get; set; }
        public decimal? ActualDistance { get; set; }
        public int? ActualTimeMinutes { get; set; }
        public string? Notes { get; set; }
    }

    public class LoadStopDto
    {
        public int Id { get; set; }
        public int StopSequence { get; set; }
        public string StopType { get; set; } = string.Empty; // Pickup, Stop, Destination
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public int? WarehouseId { get; set; }
        public string? WarehouseName { get; set; }
        public string? CompanyName { get; set; }
        public string? LocationName { get; set; }
        public string Address { get; set; } = string.Empty;
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public string? OrderNumber { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? ScheduledArrival { get; set; }
        public DateTime? ActualArrival { get; set; }
        public DateTime? ActualDeparture { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
        
        // Commodities at this stop
        public List<StopCommodityDto> Commodities { get; set; } = new();
    }

    public class CreateLoadStopDto
    {
        public int StopSequence { get; set; }
        public string StopType { get; set; } = string.Empty; // Pickup, Stop, Destination
        public int? CustomerId { get; set; }
        public int? WarehouseId { get; set; }
        public string? CompanyName { get; set; }
        public string? LocationName { get; set; }
        public string Address { get; set; } = string.Empty;
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public string? OrderNumber { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? ScheduledArrival { get; set; }
        public string? Notes { get; set; }
        
        // Commodities to pick up or deliver at this stop
        public List<CreateStopCommodityDto> Commodities { get; set; } = new();
    }

    public class StopCommodityDto
    {
        public int Id { get; set; }
        public int CommodityId { get; set; }
        public string CommodityName { get; set; } = string.Empty;
        public string? CommodityCode { get; set; }
        public int? ContractId { get; set; }
        public string? ContractName { get; set; }
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? TotalPrice { get; set; }
        public decimal? Weight { get; set; }
        public decimal? Volume { get; set; }
        public string? OrderNumber { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Comment { get; set; }
    }

    public class CreateStopCommodityDto
    {
        public int CommodityId { get; set; }
        public int? ContractId { get; set; }
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? Weight { get; set; }
        public decimal? Volume { get; set; }
        public string? OrderNumber { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Comment { get; set; }
    }

    public class LoadItemDto
    {
        public int Id { get; set; }
        public int? CommodityId { get; set; }
        public string CommodityName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal? Weight { get; set; }
        public decimal? Volume { get; set; }
        public string? Description { get; set; }
    }

    public class CreateLoadItemDto
    {
        public int? CommodityId { get; set; }
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
