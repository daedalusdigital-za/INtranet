namespace ProjectTracker.API.DTOs.HBA1C
{
    // ============================================================================
    // Auth DTOs
    // ============================================================================
    public class HBA1CLoginRequest
    {
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
    }

    public class HBA1CLoginResponse
    {
        public int Id { get; set; }
        public string? Token { get; set; }
        public string? Email { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public List<string>? Role { get; set; }
    }

    // ============================================================================
    // Dashboard - Training Stats (TrainingStatsModel)
    // ============================================================================
    public class HBA1CMonthlyTrainingStats
    {
        public string? Month { get; set; }
        public int Sessions { get; set; }
        public int Participants { get; set; }
    }

    public class HBA1CProvinceTrainingStats
    {
        public string? Province { get; set; }
        public int Sessions { get; set; }
        public int Participants { get; set; }
        public int Trainers { get; set; }
    }

    public class HBA1CTrainingStats
    {
        public int TotalSessions { get; set; }
        public int CompletedSessions { get; set; }
        public int InProgressSessions { get; set; }
        public int TotalParticipants { get; set; }
        public double CompletionRate { get; set; }
        public List<HBA1CMonthlyTrainingStats>? MonthlyStats { get; set; }
        public List<HBA1CProvinceTrainingStats>? ProvinceStats { get; set; }
    }

    // ============================================================================
    // Dashboard - Province Stats (ProvinceStatsModel - wrapper)
    // ============================================================================
    public class HBA1CProvinceBreakdown
    {
        public string? Province { get; set; }
        public int Sessions { get; set; }
        public int Participants { get; set; }
        public int Trainers { get; set; }
        public decimal Revenue { get; set; }
        public int Deliveries { get; set; }
    }

    public class HBA1CProvinceStatsWrapper
    {
        public List<HBA1CProvinceBreakdown>? ProvinceBreakdowns { get; set; }
    }

    // ============================================================================
    // Dashboard - National Totals (NationalTotalsModel)
    // ============================================================================
    public class HBA1CNationalTotals
    {
        public int TotalTrainingSessions { get; set; }
        public int TotalTrainers { get; set; }
        public int TotalParticipants { get; set; }
        public double CompletionRate { get; set; }
        public int TotalSales { get; set; }
        public decimal TotalRevenue { get; set; }
        public int TotalDeliveries { get; set; }
    }

    // ============================================================================
    // Dashboard - Equipment Stats (EquipmentStatsModel - wrapper)
    // ============================================================================
    public class HBA1CProvinceDistribution
    {
        public string? Province { get; set; }
        public int Ordered { get; set; }
        public int Delivered { get; set; }
        public double Percentage { get; set; }
    }

    public class HBA1CItemBreakdown
    {
        public string? ItemType { get; set; }
        public int Quantity { get; set; }
        public decimal Value { get; set; }
    }

    public class HBA1CEquipmentDistribution
    {
        public string? EquipmentType { get; set; }
        public int TotalOrdered { get; set; }
        public int TotalDelivered { get; set; }
        public double DeliveryRate { get; set; }
        public List<HBA1CProvinceDistribution>? ProvinceDistribution { get; set; }
        public List<HBA1CItemBreakdown>? ItemBreakdown { get; set; }
    }

    public class HBA1CEquipmentStatsWrapper
    {
        public List<HBA1CEquipmentDistribution>? Distributions { get; set; }
    }

    // ============================================================================
    // Sales Stats (SalesStatsModel)
    // ============================================================================
    public class HBA1CSalesStats
    {
        public int TotalSales { get; set; }
        public decimal MonthlyRevenue { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal AverageOrderValue { get; set; }
        public int PendingOrders { get; set; }
        public int CompletedOrders { get; set; }
    }

    // ============================================================================
    // Training Session (TrainingSessionViewModel)
    // ============================================================================
    public class HBA1CTrainingSession
    {
        public int? Id { get; set; }
        public string? TrainingName { get; set; }
        public string? TrainingType { get; set; }
        public DateTime? StartDate { get; set; }
        public int ProvinceId { get; set; }
        public string? ProvinceName { get; set; }
        public string? Venue { get; set; }
        public int TrainerId { get; set; }
        public HBA1CTrainer? Trainer { get; set; }
        public string? TargetAudience { get; set; }
        public int NumberOfParticipants { get; set; }
        public int Status { get; set; }
        public string? StatusText { get; set; }
        public DateTime DateCreated { get; set; }
        public DateTime? LastUpdated { get; set; }
        public string? CreatedByUserName { get; set; }
    }

    // ============================================================================
    // Trainer (TrainerViewModel)
    // ============================================================================
    public class HBA1CTrainer
    {
        public int Id { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Specialization { get; set; }
        public int? Experience { get; set; }
        public string? Certification { get; set; }
        public bool IsActive { get; set; }
        public bool IsDeleted { get; set; }
        public int? ProvinceId { get; set; }
        public DateTime DateCreated { get; set; }
    }

    // ============================================================================
    // Inventory (InventoryItemViewModel)
    // ============================================================================
    public class HBA1CCategoryStats
    {
        public int Category { get; set; }
        public string? CategoryName { get; set; }
        public int ItemCount { get; set; }
        public decimal TotalValue { get; set; }
    }

    public class HBA1CInventoryItem
    {
        public int? Id { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int Category { get; set; }
        public string? CategoryText { get; set; }
        public string? SKU { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal UnitPrice { get; set; }
        public int StockAvailable { get; set; }
        public int ReorderLevel { get; set; }
        public string? Supplier { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string? BatchNumber { get; set; }
        public int Status { get; set; }
        public string? StatusText { get; set; }
        public DateTime DateCreated { get; set; }
        public DateTime? LastUpdated { get; set; }
        public string? CreatedByUserName { get; set; }
    }

    // ============================================================================
    // Inventory Stats (InventoryStatsModel)
    // ============================================================================
    public class HBA1CInventoryStats
    {
        public int TotalItems { get; set; }
        public int InStockItems { get; set; }
        public int LowStockItems { get; set; }
        public int OutOfStockItems { get; set; }
        public decimal TotalValue { get; set; }
        public List<HBA1CCategoryStats>? CategoryStats { get; set; }
    }

    // ============================================================================
    // Sales (SaleViewModel / SaleItemViewModel)
    // ============================================================================
    public class HBA1CSaleItem
    {
        public int? Id { get; set; }
        public int SaleId { get; set; }
        public int InventoryItemId { get; set; }
        public string? InventoryItemName { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal TotalPrice { get; set; }
    }

    public class HBA1CSale
    {
        public int? Id { get; set; }
        public string? SaleNumber { get; set; }
        public DateTime? SaleDate { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public decimal Total { get; set; }
        public string? Notes { get; set; }
        public List<HBA1CSaleItem>? SaleItems { get; set; }
        public DateTime DateCreated { get; set; }
        public bool HasCreditNote { get; set; }
        public decimal? CreditedAmount { get; set; }
    }

    // ============================================================================
    // Provincial Sales Data (ProvincialSalesData)
    // ============================================================================
    public class HBA1CProvincialSalesData
    {
        public string? Province { get; set; }
        public int TotalOrdered { get; set; }
        public int TotalDelivered { get; set; }
        public decimal Revenue { get; set; }
        public int OrderCount { get; set; }
        public double DeliveryRate { get; set; }
    }

    // ============================================================================
    // Top Product (TopProductModel)
    // ============================================================================
    public class HBA1CTopProduct
    {
        public int ProductId { get; set; }
        public string? ProductName { get; set; }
        public int QuantitySold { get; set; }
        public decimal Revenue { get; set; }
        public int OrderCount { get; set; }
    }

    // ============================================================================
    // Credit Notes (CreditNoteViewModel)
    // ============================================================================
    public class HBA1CCreditNote
    {
        public int Id { get; set; }
        public string? CreditNoteNumber { get; set; }
        public int InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public decimal OriginalAmount { get; set; }
        public decimal CreditAmount { get; set; }
        public string? Reason { get; set; }
        public string? Status { get; set; }
        public bool ReverseStock { get; set; }
        public bool ReverseSale { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public string? ApprovedBy { get; set; }
    }

    // ============================================================================
    // Locations (ProvinceViewModel / ClinicViewModel)
    // ============================================================================
    public class HBA1CProvince
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Code { get; set; }
        public long? Population { get; set; }
        public int? HealthFacilities { get; set; }
    }

    public class HBA1CClinic
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Code { get; set; }
        public string? ProvinceName { get; set; }
        public int Type { get; set; }
        public string? TypeText { get; set; }
        public string? Address { get; set; }
        public string? ContactNumber { get; set; }
        public string? Email { get; set; }
        public int Status { get; set; }
        public string? StatusText { get; set; }
    }

    // ============================================================================
    // Combined Dashboard (assembled by controller)
    // ============================================================================
    public class HBA1CProjectDashboard
    {
        public HBA1CTrainingStats? TrainingStats { get; set; }
        public HBA1CNationalTotals? NationalTotals { get; set; }
        public List<HBA1CProvinceBreakdown>? ProvinceStats { get; set; }
        public List<HBA1CEquipmentDistribution>? EquipmentStats { get; set; }
        public HBA1CSalesStats? SalesStats { get; set; }
        public List<HBA1CSale>? RecentSales { get; set; }
        public List<HBA1CProvincialSalesData>? ProvincialData { get; set; }
        public List<HBA1CTopProduct>? TopProducts { get; set; }
        public HBA1CInventoryStats? InventoryStats { get; set; }
        public List<HBA1CInventoryItem>? LowStockItems { get; set; }
        public List<HBA1CTrainingSession>? RecentTrainings { get; set; }
    }
}
