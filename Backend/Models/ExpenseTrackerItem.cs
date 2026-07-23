using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class ExpenseTrackerItem
    {
        [Key]
        public int Id { get; set; }

        // ── Ownership ────────────────────────────────────────────────────────
        public int DepartmentId { get; set; }
        public int? CategoryId { get; set; }

        // ── Period ────────────────────────────────────────────────────────────
        public int Month { get; set; }   // 1-12
        public int Year  { get; set; }

        // ── Type ─────────────────────────────────────────────────────────────
        /// <summary>PurchaseOrder | Service</summary>
        [MaxLength(50)]
        public string ItemType { get; set; } = "Service";

        // ── Core 7 columns ───────────────────────────────────────────────────
        [Required, MaxLength(500)]
        public string Company { get; set; } = string.Empty;

        [Required, MaxLength(1000)]
        public string ServicesRendered { get; set; } = string.Empty;

        [Required, MaxLength(500)]
        public string InvoicedTo { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [MaxLength(300)]
        public string? PaidBy { get; set; }

        [MaxLength(200)]
        public string? InvoiceNumber { get; set; }

        public DateTime ItemDate { get; set; }

        // ── Status ───────────────────────────────────────────────────────────
        /// <summary>Pending | Paid | Cancelled</summary>
        [MaxLength(50)]
        public string Status { get; set; } = "Pending";

        // ── Link to uploaded BookInvoice ──────────────────────────────────────
        public int? BookInvoiceId { get; set; }

        [ForeignKey("BookInvoiceId")]
        public BookInvoice? BookInvoice { get; set; }

        // ── Extras ────────────────────────────────────────────────────────────
        [MaxLength(2000)]
        public string? Notes { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? VatAmount { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        // ── Audit ────────────────────────────────────────────────────────────
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [MaxLength(200)]
        public string? CreatedBy { get; set; }
    }
}
