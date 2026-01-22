namespace ProjectTracker.API.DTOs.Logistics
{
    // Warehouse DTOs
    public class WarehouseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? Province { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string? ManagerName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
        public decimal? TotalCapacity { get; set; }
        public decimal? AvailableCapacity { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class WarehouseSummaryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Location { get; set; }
        public string? ManagerName { get; set; }
        public int TotalItems { get; set; }
        public decimal TotalStockValue { get; set; }
        public int CapacityPercent { get; set; }
        public decimal? TotalCapacity { get; set; }
        public decimal? AvailableCapacity { get; set; }
        public string Status { get; set; } = "Active";
    }

    public class CreateWarehouseDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? Province { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string? ManagerName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
        public decimal? TotalCapacity { get; set; }
    }

    // Inventory DTOs
    public class WarehouseInventoryDto
    {
        public int Id { get; set; }
        public int WarehouseId { get; set; }
        public string WarehouseName { get; set; } = string.Empty;
        public int CommodityId { get; set; }
        public string CommodityName { get; set; } = string.Empty;
        public decimal QuantityOnHand { get; set; }
        public decimal? ReorderLevel { get; set; }
        public decimal? MaximumLevel { get; set; }
        public string? BinLocation { get; set; }
        public DateTime? LastCountDate { get; set; }
        public DateTime? LastRestockDate { get; set; }
    }

    public class CreateWarehouseInventoryDto
    {
        public int WarehouseId { get; set; }
        public int CommodityId { get; set; }
        public decimal QuantityOnHand { get; set; }
        public decimal? ReorderLevel { get; set; }
        public decimal? MaximumLevel { get; set; }
        public string? BinLocation { get; set; }
    }

    public class UpdateInventoryDto
    {
        public decimal QuantityOnHand { get; set; }
        public decimal? ReorderLevel { get; set; }
        public decimal? MaximumLevel { get; set; }
        public string? BinLocation { get; set; }
    }

    // Stock Transfer DTOs
    public class StockTransferDto
    {
        public int Id { get; set; }
        public string TransferNumber { get; set; } = string.Empty;
        public int FromWarehouseId { get; set; }
        public string FromWarehouseName { get; set; } = string.Empty;
        public int ToWarehouseId { get; set; }
        public string ToWarehouseName { get; set; } = string.Empty;
        public int CommodityId { get; set; }
        public string CommodityName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime RequestedDate { get; set; }
        public DateTime? ShippedDate { get; set; }
        public DateTime? ReceivedDate { get; set; }
        public string? RequestedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public string? Notes { get; set; }
    }

    public class CreateStockTransferDto
    {
        public int FromWarehouseId { get; set; }
        public int ToWarehouseId { get; set; }
        public int CommodityId { get; set; }
        public decimal Quantity { get; set; }
        public string? RequestedBy { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateStockTransferDto
    {
        public string? Status { get; set; }
        public DateTime? ShippedDate { get; set; }
        public DateTime? ReceivedDate { get; set; }
        public string? ApprovedBy { get; set; }
        public string? Notes { get; set; }
    }

    // Backorder DTOs
    public class BackorderDto
    {
        public int Id { get; set; }
        public string BackorderNumber { get; set; } = string.Empty;
        public int InventoryId { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public decimal QuantityOrdered { get; set; }
        public decimal QuantityFulfilled { get; set; }
        public decimal QuantityRemaining => QuantityOrdered - QuantityFulfilled;
        public string Status { get; set; } = string.Empty;
        public DateTime OrderedDate { get; set; }
        public DateTime? ExpectedFulfillmentDate { get; set; }
        public DateTime? FulfilledDate { get; set; }
        public string? Notes { get; set; }
    }

    public class CreateBackorderDto
    {
        public int InventoryId { get; set; }
        public int CustomerId { get; set; }
        public decimal QuantityOrdered { get; set; }
        public DateTime? ExpectedFulfillmentDate { get; set; }
        public string? Notes { get; set; }
    }

    // Commodity DTOs
    public class CommodityDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public decimal? UnitWeight { get; set; }
        public decimal? UnitVolume { get; set; }
        public string? UnitOfMeasure { get; set; }
        public bool RequiresRefrigeration { get; set; }
        public bool IsFragile { get; set; }
        public bool IsHazardous { get; set; }
        public string? HandlingInstructions { get; set; }
    }

    public class CreateCommodityDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public decimal? UnitWeight { get; set; }
        public decimal? UnitVolume { get; set; }
        public string? UnitOfMeasure { get; set; }
        public bool RequiresRefrigeration { get; set; }
        public bool IsFragile { get; set; }
        public bool IsHazardous { get; set; }
        public string? HandlingInstructions { get; set; }
    }
}
