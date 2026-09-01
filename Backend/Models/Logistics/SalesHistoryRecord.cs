using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Historical sales invoice record (header level) imported from an ERP
    /// "Sales Invoices by Date &amp; Customer" export. Used to power the
    /// Sales History tab and to reconcile/backfill live sales analytics.
    /// </summary>
    public class SalesHistoryRecord
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string CustomerName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? CustomerNumber { get; set; }

        [Required]
        [MaxLength(50)]
        public string InvoiceNumber { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? ShipmentNumber { get; set; }

        [MaxLength(50)]
        public string? OrderNumber { get; set; }

        public DateTime InvoiceDate { get; set; }

        [MaxLength(20)]
        public string? Location { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SalesAmount { get; set; }

        // ── Cost / margin (populated by enrichment from the detailed line report) ──
        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? GrossProfit { get; set; }

        [Column(TypeName = "decimal(9,4)")]
        public decimal? MarginPercent { get; set; }

        /// <summary>True when detailed product line items exist for this invoice.</summary>
        public bool HasLineDetail { get; set; }

        /// <summary>Company code that owns this record (PMT, ACM, PHT, SBT).</summary>
        [MaxLength(10)]
        public string? SourceCompany { get; set; }

        [MaxLength(100)]
        public string? ImportBatchId { get; set; }

        [MaxLength(255)]
        public string? SourceFileName { get; set; }

        /// <summary>True when a matching live invoice exists in ImportedInvoices.</summary>
        public bool IsReconciled { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Detailed product line item for a historical sales invoice, imported from a
    /// "Detail Sales Report" export. Enriches <see cref="SalesHistoryRecord"/> with
    /// product, quantity, unit price and cost so gross-profit/margin can be computed.
    /// </summary>
    public class SalesHistoryLineItem
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Optional link to the header record (matched by invoice number).</summary>
        public int? SalesHistoryRecordId { get; set; }

        [Required]
        [MaxLength(50)]
        public string InvoiceNumber { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? CustomerNumber { get; set; }

        [MaxLength(200)]
        public string? CustomerName { get; set; }

        [MaxLength(50)]
        public string? ItemCode { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(20)]
        public string? RegCode { get; set; }

        public DateTime InvoiceDate { get; set; }

        [MaxLength(20)]
        public string? Location { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SalesAmount { get; set; }

        [Column(TypeName = "decimal(18,6)")]
        public decimal UnitCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ExtCost { get; set; }

        [MaxLength(20)]
        public string? ItemCategory { get; set; }

        [MaxLength(10)]
        public string? SourceCompany { get; set; }

        [MaxLength(100)]
        public string? ImportBatchId { get; set; }

        [ForeignKey("SalesHistoryRecordId")]
        public virtual SalesHistoryRecord? SalesHistoryRecord { get; set; }
    }
}
