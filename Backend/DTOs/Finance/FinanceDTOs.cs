using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.DTOs.Finance
{
    // ============================================================================
    // FINANCE CATEGORY DTOs
    // ============================================================================

    public class CreateFinanceCategoryDto
    {
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = "expense"; // income, expense, both

        [MaxLength(50)]
        public string? Code { get; set; }

        public int? ParentCategoryId { get; set; }
    }

    public class UpdateFinanceCategoryDto
    {
        [MaxLength(200)]
        public string? Name { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(50)]
        public string? Type { get; set; }

        [MaxLength(50)]
        public string? Code { get; set; }

        public int? ParentCategoryId { get; set; }

        public bool? IsActive { get; set; }
    }

    public class FinanceCategoryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Type { get; set; } = "expense";
        public string? Code { get; set; }
        public int? ParentCategoryId { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ============================================================================
    // BUDGET DTOs
    // ============================================================================

    public class BudgetLineItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public decimal AllocatedAmount { get; set; }
        public decimal SpentAmount { get; set; }
        public decimal RemainingAmount { get; set; }
    }

    public class CreateBudgetLineItemDto
    {
        [Required]
        [MaxLength(300)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public int? CategoryId { get; set; }

        public decimal AllocatedAmount { get; set; }
    }

    public class CreateBudgetDto
    {
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [Required]
        [MaxLength(20)]
        public string FiscalYear { get; set; } = DateTime.UtcNow.Year.ToString();

        [MaxLength(20)]
        public string? Period { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        public decimal TotalBudget { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        public List<CreateBudgetLineItemDto> LineItems { get; set; } = new();
    }

    public class UpdateBudgetDto
    {
        [MaxLength(200)]
        public string? Name { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(20)]
        public string? FiscalYear { get; set; }

        [MaxLength(20)]
        public string? Period { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        [MaxLength(50)]
        public string? Status { get; set; }

        public decimal? TotalBudget { get; set; }

        [MaxLength(10)]
        public string? Currency { get; set; }

        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }
    }

    public class BudgetDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string FiscalYear { get; set; } = string.Empty;
        public string? Period { get; set; }
        public string? Department { get; set; }
        public string Status { get; set; } = "Draft";
        public decimal TotalBudget { get; set; }
        public decimal AllocatedAmount { get; set; }
        public decimal SpentAmount { get; set; }
        public decimal RemainingAmount { get; set; }
        public string Currency { get; set; } = "ZAR";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? CreatedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<BudgetLineItemDto> LineItems { get; set; } = new();
    }

    // ============================================================================
    // EXPENSE DTOs
    // ============================================================================

    public class CreateExpenseDto
    {
        [Required]
        [MaxLength(50)]
        public string ExpenseNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        public string Vendor { get; set; } = string.Empty;

        public decimal Amount { get; set; }

        public decimal? VatAmount { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        public int? CategoryId { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        public DateTime ExpenseDate { get; set; }

        public DateTime? DueDate { get; set; }

        [MaxLength(200)]
        public string? InvoiceNumber { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        public bool IsRecurring { get; set; }

        [MaxLength(50)]
        public string? RecurrencePattern { get; set; }

        public int? BudgetId { get; set; }

        public int? PurchaseOrderId { get; set; }
    }

    public class UpdateExpenseDto
    {
        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(300)]
        public string? Vendor { get; set; }

        [MaxLength(50)]
        public string? Status { get; set; }

        public decimal? Amount { get; set; }

        public decimal? VatAmount { get; set; }

        public int? CategoryId { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        public DateTime? ExpenseDate { get; set; }

        public DateTime? DueDate { get; set; }

        [MaxLength(100)]
        public string? PaymentMethod { get; set; }

        [MaxLength(200)]
        public string? PaymentReference { get; set; }

        [MaxLength(200)]
        public string? InvoiceNumber { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        public bool? IsRecurring { get; set; }

        [MaxLength(50)]
        public string? RecurrencePattern { get; set; }
    }

    public class ExpenseDto
    {
        public int Id { get; set; }
        public string ExpenseNumber { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Vendor { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending";
        public decimal Amount { get; set; }
        public decimal? VatAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string Currency { get; set; } = "ZAR";
        public int? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public string? Department { get; set; }
        public DateTime ExpenseDate { get; set; }
        public DateTime? DueDate { get; set; }
        public string? SubmittedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public string? PaymentMethod { get; set; }
        public string? PaymentReference { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Notes { get; set; }
        public string? ReceiptPath { get; set; }
        public string? ReceiptFileName { get; set; }
        public bool IsRecurring { get; set; }
        public string? RecurrencePattern { get; set; }
        public int? BudgetId { get; set; }
        public string? BudgetName { get; set; }
        public int? PurchaseOrderId { get; set; }
        public string? PurchaseOrderNumber { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    // ============================================================================
    // PURCHASE ORDER DTOs
    // ============================================================================

    public class PurchaseOrderItemDto
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? ProductCode { get; set; }
        public decimal Quantity { get; set; }
        public string? Unit { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
        public decimal? ReceivedQuantity { get; set; }
    }

    public class CreatePurchaseOrderItemDto
    {
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? ProductCode { get; set; }

        public decimal Quantity { get; set; }

        [MaxLength(50)]
        public string? Unit { get; set; }

        public decimal UnitPrice { get; set; }
    }

    public class CreatePurchaseOrderDto
    {
        [Required]
        [MaxLength(50)]
        public string PoNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        public string SupplierName { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? SupplierContact { get; set; }

        [MaxLength(500)]
        public string? SupplierEmail { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        public int? CategoryId { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        public DateTime? ExpectedDeliveryDate { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        [MaxLength(500)]
        public string? DeliveryAddress { get; set; }

        public List<CreatePurchaseOrderItemDto> Items { get; set; } = new();
    }

    public class UpdatePurchaseOrderDto
    {
        [MaxLength(300)]
        public string? SupplierName { get; set; }

        [MaxLength(200)]
        public string? SupplierContact { get; set; }

        [MaxLength(500)]
        public string? SupplierEmail { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(50)]
        public string? Status { get; set; }

        public int? CategoryId { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        public DateTime? ExpectedDeliveryDate { get; set; }

        public DateTime? ReceivedDate { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        [MaxLength(500)]
        public string? DeliveryAddress { get; set; }
    }

    public class PurchaseOrderDto
    {
        public int Id { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public string SupplierName { get; set; } = string.Empty;
        public string? SupplierContact { get; set; }
        public string? SupplierEmail { get; set; }
        public string? Description { get; set; }
        public string Status { get; set; } = "Draft";
        public decimal SubTotal { get; set; }
        public decimal VatAmount { get; set; }
        public decimal Total { get; set; }
        public string Currency { get; set; } = "ZAR";
        public int? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public string? Department { get; set; }
        public DateTime OrderDate { get; set; }
        public DateTime? ExpectedDeliveryDate { get; set; }
        public DateTime? ReceivedDate { get; set; }
        public string? RequestedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public string? Notes { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? AttachmentPath { get; set; }
        public string? AttachmentFileName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<PurchaseOrderItemDto> Items { get; set; } = new();
    }

    // ============================================================================
    // PAYMENT DTOs
    // ============================================================================

    public class CreatePaymentDto
    {
        [Required]
        [MaxLength(50)]
        public string PaymentNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string PaymentType { get; set; } = "Expense";

        public int? ExpenseId { get; set; }

        public int? PurchaseOrderId { get; set; }

        public int? BookInvoiceId { get; set; }

        [Required]
        [MaxLength(300)]
        public string Payee { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public decimal Amount { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        [Required]
        [MaxLength(100)]
        public string PaymentMethod { get; set; } = "EFT";

        [MaxLength(200)]
        public string? PaymentReference { get; set; }

        public DateTime PaymentDate { get; set; }

        [MaxLength(200)]
        public string? BankName { get; set; }

        [MaxLength(50)]
        public string? AccountNumber { get; set; }

        [MaxLength(50)]
        public string? BranchCode { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }
    }

    public class UpdatePaymentDto
    {
        [MaxLength(300)]
        public string? Payee { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        public decimal? Amount { get; set; }

        [MaxLength(50)]
        public string? Status { get; set; }

        [MaxLength(100)]
        public string? PaymentMethod { get; set; }

        [MaxLength(200)]
        public string? PaymentReference { get; set; }

        [MaxLength(200)]
        public string? BankReference { get; set; }

        public DateTime? PaymentDate { get; set; }

        public DateTime? ProcessedDate { get; set; }

        [MaxLength(200)]
        public string? BankName { get; set; }

        [MaxLength(50)]
        public string? AccountNumber { get; set; }

        [MaxLength(50)]
        public string? BranchCode { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }
    }

    public class PaymentDto
    {
        public int Id { get; set; }
        public string PaymentNumber { get; set; } = string.Empty;
        public string PaymentType { get; set; } = "Expense";
        public int? ExpenseId { get; set; }
        public string? ExpenseNumber { get; set; }
        public int? PurchaseOrderId { get; set; }
        public string? PurchaseOrderNumber { get; set; }
        public int? BookInvoiceId { get; set; }
        public string Payee { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "ZAR";
        public string Status { get; set; } = "Pending";
        public string PaymentMethod { get; set; } = "EFT";
        public string? PaymentReference { get; set; }
        public string? BankReference { get; set; }
        public DateTime PaymentDate { get; set; }
        public DateTime? ProcessedDate { get; set; }
        public string? ProcessedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public string? BankName { get; set; }
        public string? AccountNumber { get; set; }
        public string? BranchCode { get; set; }
        public string? Notes { get; set; }
        public string? ProofPath { get; set; }
        public string? ProofFileName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
