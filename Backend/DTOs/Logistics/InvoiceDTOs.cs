namespace ProjectTracker.API.DTOs.Logistics
{
    // Invoice DTOs
    public class InvoiceDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public int? LoadId { get; set; }
        public string? LoadNumber { get; set; }
        public DateTime InvoiceDate { get; set; }
        public DateTime DueDate { get; set; }
        public decimal SubTotal { get; set; }
        public decimal? VatAmount { get; set; }
        public decimal Total { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal Balance => Total - AmountPaid;
        public string Status { get; set; } = string.Empty;
        public string? PaymentMethod { get; set; }
        public DateTime? PaymentDate { get; set; }
        public string? PaymentReference { get; set; }
        public string? Notes { get; set; }
        public List<InvoiceLineItemDto> LineItems { get; set; } = new();
    }

    public class CreateInvoiceDto
    {
        public int CustomerId { get; set; }
        public int? LoadId { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public int DueDays { get; set; } = 30;
        public decimal? VatRate { get; set; } = 15;
        public string? Notes { get; set; }
        public List<CreateInvoiceLineItemDto> LineItems { get; set; } = new();
    }

    public class InvoiceLineItemDto
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Total { get; set; }
        public decimal? VatRate { get; set; }
    }

    public class CreateInvoiceLineItemDto
    {
        public string Description { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal? VatRate { get; set; }
    }

    public class RecordPaymentDto
    {
        public decimal Amount { get; set; }
        public string? PaymentMethod { get; set; }
        public DateTime? PaymentDate { get; set; }
        public string? PaymentReference { get; set; }
    }

    // Vehicle Maintenance DTOs
    public class VehicleMaintenanceDto
    {
        public int Id { get; set; }
        public int VehicleId { get; set; }
        public string VehicleRegistration { get; set; } = string.Empty;
        public string? VehicleType { get; set; }
        public string MaintenanceType { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime ScheduledDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public decimal? OdometerReading { get; set; }
        public decimal? Cost { get; set; }
        public string? ServiceProvider { get; set; }
        public string? InvoiceReference { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Priority { get; set; }
        public string? AssignedTo { get; set; }
        public string? Notes { get; set; }
        public string? ProofOfWorkPath { get; set; }
        public string? ProofOfPaymentPath { get; set; }
        public DateTime? NextServiceDate { get; set; }
        public decimal? NextServiceOdometer { get; set; }
        public DateTime? LicenseExpiryDate { get; set; }
        public int? DaysUntilExpiry { get; set; }
    }

    public class CreateVehicleMaintenanceDto
    {
        public int VehicleId { get; set; }
        public string MaintenanceType { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime ScheduledDate { get; set; }
        public decimal? Cost { get; set; }
        public string? ServiceProvider { get; set; }
        public string? Notes { get; set; }
        public DateTime? NextServiceDate { get; set; }
        public decimal? NextServiceOdometer { get; set; }
    }

    public class UpdateVehicleMaintenanceDto
    {
        public string? Status { get; set; }
        public DateTime? CompletedDate { get; set; }
        public decimal? OdometerReading { get; set; }
        public decimal? Cost { get; set; }
        public string? InvoiceReference { get; set; }
        public string? Notes { get; set; }
        public string? ProofOfWorkPath { get; set; }
        public string? ProofOfPaymentPath { get; set; }
    }

    public class CompleteMaintenanceDto
    {
        public decimal? OdometerReading { get; set; }
        public decimal? Cost { get; set; }
        public string? Notes { get; set; }
        public string? ProofOfWorkPath { get; set; }
        public string? ProofOfPaymentPath { get; set; }
    }

    // Customer Contract DTOs
    public class CustomerContractDto
    {
        public int Id { get; set; }
        public string ContractNumber { get; set; } = string.Empty;
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? ContractName { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal? MonthlyValue { get; set; }
        public decimal? TotalValue { get; set; }
        public string? BillingFrequency { get; set; }
        public decimal? RatePerKm { get; set; }
        public decimal? RatePerLoad { get; set; }
        public decimal? MinimumCharge { get; set; }
        public string? Terms { get; set; }
        public string? DocumentUrl { get; set; }
        public string? SignedBy { get; set; }
        public DateTime? SignedDate { get; set; }
    }

    public class CreateCustomerContractDto
    {
        public int CustomerId { get; set; }
        public string? ContractName { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal? MonthlyValue { get; set; }
        public decimal? TotalValue { get; set; }
        public string? BillingFrequency { get; set; }
        public decimal? RatePerKm { get; set; }
        public decimal? RatePerLoad { get; set; }
        public decimal? MinimumCharge { get; set; }
        public string? Terms { get; set; }
        public string? DocumentUrl { get; set; }
    }

    // ==========================================
    // Imported Invoice DTOs (for ERP Integration)
    // ==========================================

    /// <summary>
    /// DTO for displaying imported invoice data
    /// </summary>
    public class ImportedInvoiceDto
    {
        public int Id { get; set; }
        
        // Customer Info
        public string CustomerNumber { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public int? CustomerId { get; set; }
        
        // Product Info
        public string ProductCode { get; set; } = string.Empty;
        public string ProductDescription { get; set; } = string.Empty;
        
        // Transaction Info
        public int Year { get; set; }
        public string Period { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        public DateTime TransactionDate { get; set; }
        public string TransactionNumber { get; set; } = string.Empty;
        
        // Classification
        public int? Category { get; set; }
        public int? Location { get; set; }
        
        // Financial
        public decimal Quantity { get; set; }
        public decimal SalesAmount { get; set; }
        public decimal SalesReturns { get; set; }
        public decimal CostOfSales { get; set; }
        public decimal? MarginPercent { get; set; }
        public decimal NetSales { get; set; }
        public decimal GrossProfit { get; set; }
        
        // Status & Assignment
        public string Status { get; set; } = string.Empty;
        public int? LoadId { get; set; }
        public string? LoadNumber { get; set; }
        
        // Delivery Info
        public string? DeliveryAddress { get; set; }
        public string? DeliveryCity { get; set; }
        public string? DeliveryProvince { get; set; }
        public string? DeliveryPostalCode { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public string? DeliveryNotes { get; set; }
        
        // Import Info
        public DateTime ImportedAt { get; set; }
        public string? ImportBatchId { get; set; }
        public string? SourceSystem { get; set; }
        public string? SourceCompany { get; set; }
    }

    /// <summary>
    /// DTO for importing invoice from ERP system (matches the JSON structure)
    /// </summary>
    public class ImportInvoiceDto
    {
        public CustomerInfoDto Customer { get; set; } = new();
        public ProductInfoDto Product { get; set; } = new();
        public int Year { get; set; }
        public string Prd { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string TransactionNumber { get; set; } = string.Empty;
        public int? Category { get; set; }
        public int? Location { get; set; }
        public decimal Quantity { get; set; }
        public decimal SalesAmount { get; set; }
        public decimal SalesReturns { get; set; }
        public decimal CostOfSales { get; set; }
        public decimal? Percent { get; set; }
    }

    public class CustomerInfoDto
    {
        public string CustomerNumber { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
    }

    public class ProductInfoDto
    {
        public string ProductCode { get; set; } = string.Empty;
        public string ProductDescription { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for bulk importing multiple invoices
    /// </summary>
    public class BulkImportInvoicesDto
    {
        public List<ImportInvoiceDto> Invoices { get; set; } = new();
        public string? SourceSystem { get; set; }
        public string? FileName { get; set; }
    }

    /// <summary>
    /// DTO for updating delivery information on imported invoice
    /// </summary>
    public class UpdateImportedInvoiceDeliveryDto
    {
        public string? DeliveryAddress { get; set; }
        public string? DeliveryCity { get; set; }
        public string? DeliveryProvince { get; set; }
        public string? DeliveryPostalCode { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public string? DeliveryNotes { get; set; }
    }

    /// <summary>
    /// DTO for creating a trip sheet from selected imported invoices
    /// </summary>
    public class CreateTripSheetFromInvoicesDto
    {
        public List<int> InvoiceIds { get; set; } = new();
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public int? WarehouseId { get; set; }
        public DateTime? ScheduledPickupDate { get; set; }
        public string? SpecialInstructions { get; set; }
        public string? Notes { get; set; }
    }

    /// <summary>
    /// DTO for import batch information
    /// </summary>
    public class ImportBatchDto
    {
        public int Id { get; set; }
        public string BatchId { get; set; } = string.Empty;
        public string? FileName { get; set; }
        public string? SourceSystem { get; set; }
        public int TotalRecords { get; set; }
        public int SuccessfulRecords { get; set; }
        public int FailedRecords { get; set; }
        public DateTime ImportedAt { get; set; }
        public string? ImportedByUserName { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    /// <summary>
    /// Response for import operation
    /// </summary>
    public class ImportResultDto
    {
        public bool Success { get; set; }
        public string BatchId { get; set; } = string.Empty;
        public int TotalRecords { get; set; }
        public int SuccessfulRecords { get; set; }
        public int FailedRecords { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<ImportedInvoiceDto> ImportedInvoices { get; set; } = new();
    }
}
