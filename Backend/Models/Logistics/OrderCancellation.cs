using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Represents a cancelled order with tracking information
    /// </summary>
    public class OrderCancellation
    {
        [Key]
        public int Id { get; set; }

        // Original Order Reference
        [Required]
        [MaxLength(50)]
        public string OrderNumber { get; set; } = string.Empty;

        // Link to ImportedInvoice if applicable
        public int? ImportedInvoiceId { get; set; }

        // Customer Information
        [Required]
        [MaxLength(50)]
        public string CustomerNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string CustomerName { get; set; } = string.Empty;

        public int? CustomerId { get; set; }

        // Order Details
        [Column(TypeName = "decimal(18,2)")]
        public decimal OrderAmount { get; set; }

        public int ItemCount { get; set; }

        public DateTime OriginalOrderDate { get; set; }

        // Cancellation Details
        [Required]
        [MaxLength(50)]
        public string CancellationReason { get; set; } = string.Empty; // CustomerRequest, OutOfStock, PriceDispute, DuplicateOrder, DeliveryIssue, Other

        [MaxLength(1000)]
        public string? CancellationNotes { get; set; }

        public DateTime CancelledAt { get; set; } = DateTime.UtcNow;

        public int CancelledByUserId { get; set; }

        [MaxLength(100)]
        public string? CancelledByUserName { get; set; }

        // Approval Workflow
        [MaxLength(20)]
        public string ApprovalStatus { get; set; } = "Pending"; // Pending, Approved, Rejected

        public int? ApprovedByUserId { get; set; }

        [MaxLength(100)]
        public string? ApprovedByUserName { get; set; }

        public DateTime? ApprovedAt { get; set; }

        [MaxLength(500)]
        public string? ApprovalNotes { get; set; }

        // Financial Impact
        [Column(TypeName = "decimal(18,2)")]
        public decimal? RefundAmount { get; set; }

        public bool RefundProcessed { get; set; }

        public DateTime? RefundProcessedAt { get; set; }

        // Company
        [MaxLength(10)]
        public string? CompanyCode { get; set; } // PMT, ACM, PHT, SBT

        // Audit
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation Properties
        [ForeignKey("ImportedInvoiceId")]
        public virtual ImportedInvoice? ImportedInvoice { get; set; }

        [ForeignKey("CustomerId")]
        public virtual Customer? Customer { get; set; }

        [ForeignKey("CancelledByUserId")]
        public virtual Models.User? CancelledByUser { get; set; }

        [ForeignKey("ApprovedByUserId")]
        public virtual Models.User? ApprovedByUser { get; set; }
    }

    /// <summary>
    /// Statistics for order cancellations
    /// </summary>
    public class CancellationStats
    {
        public int TotalCancellations { get; set; }
        public int PendingApproval { get; set; }
        public int ApprovedToday { get; set; }
        public int RejectedToday { get; set; }
        public decimal TotalRefundAmount { get; set; }
        public decimal PendingRefundAmount { get; set; }
        public Dictionary<string, int> ByReason { get; set; } = new();
        public Dictionary<string, int> ByCompany { get; set; } = new();
    }
}
