using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    public class Payment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string PaymentNumber { get; set; } = string.Empty;

        // What is being paid: Expense, PurchaseOrder, Invoice, Other
        [Required]
        [MaxLength(50)]
        public string PaymentType { get; set; } = "Expense";

        // Link to related entity
        public int? ExpenseId { get; set; }

        [ForeignKey("ExpenseId")]
        public Expense? Expense { get; set; }

        public int? PurchaseOrderId { get; set; }

        [ForeignKey("PurchaseOrderId")]
        public PurchaseOrder? PurchaseOrder { get; set; }

        public int? BookInvoiceId { get; set; }

        [Required]
        [MaxLength(300)]
        public string Payee { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        // Status: Pending, Processing, Completed, Failed, Cancelled
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending";

        // Payment method: EFT, Cash, Card, Cheque, Other
        [Required]
        [MaxLength(100)]
        public string PaymentMethod { get; set; } = "EFT";

        [MaxLength(200)]
        public string? PaymentReference { get; set; }

        [MaxLength(200)]
        public string? BankReference { get; set; }

        public DateTime PaymentDate { get; set; }

        public DateTime? ProcessedDate { get; set; }

        [MaxLength(200)]
        public string? ProcessedBy { get; set; }

        [MaxLength(200)]
        public string? ApprovedBy { get; set; }

        public DateTime? ApprovedDate { get; set; }

        // Bank details
        [MaxLength(200)]
        public string? BankName { get; set; }

        [MaxLength(50)]
        public string? AccountNumber { get; set; }

        [MaxLength(50)]
        public string? BranchCode { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        // Proof of payment
        [MaxLength(500)]
        public string? ProofPath { get; set; }

        [MaxLength(255)]
        public string? ProofFileName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
