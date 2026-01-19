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
        public string MaintenanceType { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime ScheduledDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public decimal? OdometerReading { get; set; }
        public decimal? Cost { get; set; }
        public string? ServiceProvider { get; set; }
        public string? InvoiceReference { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public DateTime? NextServiceDate { get; set; }
        public decimal? NextServiceOdometer { get; set; }
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
}
