using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Requisitions
{
    /// <summary>
    /// A creditor/supplier requisition invoice moving through the multi-tier
    /// finance approval workflow (distinct from the petty-cash e-wallet
    /// <see cref="Logistics.Requisition"/> form).
    ///
    /// We deliberately split WHERE it is (<see cref="Stage"/> — the happy-path
    /// position) from its condition (<see cref="State"/> — Active / OnHold /
    /// Returned / Rejected / Cancelled). That way an On-Hold invoice remembers
    /// which stage to resume at.
    /// </summary>
    public class RequisitionInvoice
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Human-friendly reference, e.g. "REQ-2026-0001". Generated on create.</summary>
        [StringLength(40)]
        public string? ReferenceNumber { get; set; }

        [StringLength(100)]
        public string? SupplierName { get; set; }

        [StringLength(60)]
        public string? InvoiceNumber { get; set; }

        /// <summary>Sage 300 reference captured by the Creditors Clerk.</summary>
        [StringLength(60)]
        public string? Sage300Reference { get; set; }

        public DateTime? InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal VatAmount { get; set; }

        [StringLength(10)]
        public string Currency { get; set; } = "ZAR";

        [StringLength(1000)]
        public string? Description { get; set; }

        [StringLength(100)]
        public string? Department { get; set; }

        // ---- Workflow position & condition ----

        /// <summary>Current happy-path stage. See <see cref="RequisitionWorkflow"/>.</summary>
        [Required]
        [StringLength(50)]
        public string Stage { get; set; } = RequisitionWorkflow.Draft;

        /// <summary>Active | OnHold | Returned | Rejected | Cancelled | Paid | Closed.</summary>
        [Required]
        [StringLength(20)]
        public string State { get; set; } = "Active";

        /// <summary>When On Hold / Returned, the stage to resume at.</summary>
        [StringLength(50)]
        public string? ResumeStage { get; set; }

        // ---- Payment details (captured at the Nash payment step) ----
        [StringLength(60)]
        public string? PaymentReference { get; set; }

        [StringLength(50)]
        public string? PaymentMethod { get; set; }

        public DateTime? PaidDate { get; set; }

        // ---- Audit ----
        public int? CreatedByUserId { get; set; }
        [StringLength(200)]
        public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        /// <summary>Timestamp the invoice entered its current stage (for aging/SLA).</summary>
        public DateTime StageEnteredAt { get; set; } = DateTime.UtcNow;

        public ICollection<RequisitionApprovalStep> ApprovalSteps { get; set; } = new List<RequisitionApprovalStep>();
    }

    /// <summary>
    /// Append-only history of every workflow action taken on a requisition invoice.
    /// This is the business/audit trail; each approval/rejection can link to an
    /// electronic signature.
    /// </summary>
    public class RequisitionApprovalStep
    {
        [Key]
        public int Id { get; set; }

        public int RequisitionInvoiceId { get; set; }

        [ForeignKey(nameof(RequisitionInvoiceId))]
        public RequisitionInvoice? RequisitionInvoice { get; set; }

        /// <summary>Stage the invoice was in when this action was taken.</summary>
        [StringLength(50)]
        public string FromStage { get; set; } = string.Empty;

        /// <summary>Stage the invoice moved to after this action.</summary>
        [StringLength(50)]
        public string ToStage { get; set; } = string.Empty;

        /// <summary>Approve | Reject | Return | Hold | Resume | Cancel | Submit | Pay.</summary>
        [Required]
        [StringLength(30)]
        public string Action { get; set; } = string.Empty;

        [StringLength(2000)]
        public string? Comment { get; set; }

        // Who acted
        public int? ActorUserId { get; set; }
        [StringLength(200)]
        public string? ActorName { get; set; }
        [StringLength(100)]
        public string? ActorRole { get; set; }

        /// <summary>Optional link to the electronic signature captured for this action.</summary>
        public int? SignatureId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
