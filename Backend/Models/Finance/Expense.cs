using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    public class Expense
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string ExpenseNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        public string Vendor { get; set; } = string.Empty;

        // Status: Pending, Approved, Rejected, Paid, Reimbursed
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending";

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? VatAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        public int? CategoryId { get; set; }

        [ForeignKey("CategoryId")]
        public FinanceCategory? Category { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        public DateTime ExpenseDate { get; set; }

        public DateTime? DueDate { get; set; }

        [MaxLength(200)]
        public string? SubmittedBy { get; set; }

        [MaxLength(200)]
        public string? ApprovedBy { get; set; }

        public DateTime? ApprovedDate { get; set; }

        [MaxLength(100)]
        public string? PaymentMethod { get; set; }

        [MaxLength(200)]
        public string? PaymentReference { get; set; }

        [MaxLength(200)]
        public string? InvoiceNumber { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        // Receipt / proof attachment
        [MaxLength(500)]
        public string? ReceiptPath { get; set; }

        [MaxLength(255)]
        public string? ReceiptFileName { get; set; }

        // Is this a recurring expense?
        public bool IsRecurring { get; set; }

        [MaxLength(50)]
        public string? RecurrencePattern { get; set; } // Monthly, Weekly, Quarterly, Annually

        // Link to budget
        public int? BudgetId { get; set; }

        [ForeignKey("BudgetId")]
        public Budget? Budget { get; set; }

        // Link to PO
        public int? PurchaseOrderId { get; set; }

        [ForeignKey("PurchaseOrderId")]
        public PurchaseOrder? PurchaseOrder { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
