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

    // 3D Warehouse View DTOs
    public class Warehouse3DViewDto
    {
        public int WarehouseId { get; set; }
        public string WarehouseName { get; set; } = string.Empty;
        public List<Warehouse3DBoxDto> Boxes { get; set; } = new();
        public Warehouse3DConfigDto Config { get; set; } = new();
    }

    public class Warehouse3DBoxDto
    {
        public string Id { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public int PositionX { get; set; }
        public int PositionY { get; set; }
        public int StackLevel { get; set; } = 1;
        public string Status { get; set; } = "Active"; // Active, LowStock, Empty, Blocked
        public int Quantity { get; set; }
        public string? Sku { get; set; }
        public string? CommodityName { get; set; }
        public string? BinLocation { get; set; }
    }

    public class Warehouse3DConfigDto
    {
        public int GridColumns { get; set; } = 20;
        public int GridRows { get; set; } = 10;
        public decimal BoxWidth { get; set; } = 1;
        public decimal BoxDepth { get; set; } = 1;
        public decimal BoxHeight { get; set; } = 1;
        public decimal GridSpacing { get; set; } = 0.2m;
    }

    // Warehouse Building DTOs
    public class WarehouseBuildingDto
    {
        public int Id { get; set; }
        public int WarehouseId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? ManagerName { get; set; }
        public string? PhoneNumber { get; set; }
        public decimal? TotalCapacity { get; set; }
        public decimal? AvailableCapacity { get; set; }
        public int ItemCount { get; set; }
    }

    public class CreateWarehouseBuildingDto
    {
        public int WarehouseId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? ManagerName { get; set; }
        public string? PhoneNumber { get; set; }
        public decimal? TotalCapacity { get; set; }
    }

    // Building Inventory DTOs
    public class BuildingInventoryDto
    {
        public int Id { get; set; }
        public int BuildingId { get; set; }
        public string BuildingCode { get; set; } = string.Empty;
        public string ItemCode { get; set; } = string.Empty;
        public string? ItemDescription { get; set; }
        public string Uom { get; set; } = "Each";
        public decimal QuantityOnHand { get; set; }
        public decimal QuantityReserved { get; set; }
        public decimal QuantityOnOrder { get; set; }
        public decimal QuantityAvailable { get; set; }
        public decimal? ReorderLevel { get; set; }
        public decimal? MaxLevel { get; set; }
        public decimal? UnitCost { get; set; }
        public string? BinLocation { get; set; }
        public DateTime? LastMovementDate { get; set; }
    }

    public class UpdateBuildingInventoryDto
    {
        public decimal? QuantityOnHand { get; set; }
        public decimal? QuantityReserved { get; set; }
        public decimal? ReorderLevel { get; set; }
        public decimal? MaxLevel { get; set; }
        public decimal? UnitCost { get; set; }
        public string? BinLocation { get; set; }
    }

    // Stock Movement DTOs
    public class StockMovementDto
    {
        public int Id { get; set; }
        public string MovementType { get; set; } = string.Empty;
        public int? FromBuildingId { get; set; }
        public string? FromBuildingCode { get; set; }
        public int? ToBuildingId { get; set; }
        public string? ToBuildingCode { get; set; }
        public string ItemCode { get; set; } = string.Empty;
        public string? ItemDescription { get; set; }
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = "Each";
        public string? Reference { get; set; }
        public string? Notes { get; set; }
        public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateStockMovementDto
    {
        public string MovementType { get; set; } = string.Empty; // Transfer, Receipt, Issue, Adjustment
        public int? FromBuildingId { get; set; }
        public int? ToBuildingId { get; set; }
        public string ItemCode { get; set; } = string.Empty;
        public string? ItemDescription { get; set; }
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = "Each";
        public string? Reference { get; set; }
        public string? Notes { get; set; }
    }

    public class BuildingStockTransferDto
    {
        public int FromBuildingId { get; set; }
        public int ToBuildingId { get; set; }
        public string ItemCode { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string? Reference { get; set; }
        public string? Notes { get; set; }
    }
}
