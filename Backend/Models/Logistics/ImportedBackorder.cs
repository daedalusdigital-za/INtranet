using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// A backorder line imported from an ERP "Back Order" report (Excel/CSV)
    /// via Admin > Data Import. Snapshot-style: each import replaces the
    /// previous set for that company.
    /// </summary>
    public class ImportedBackorder
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Company code: PMT / ACM / PHT / SBT / SAW / KOG</summary>
        [MaxLength(10)]
        public string SourceCompany { get; set; } = string.Empty;

        [MaxLength(50)]
        public string OrderNumber { get; set; } = string.Empty;

        public DateTime? OrderDate { get; set; }

        [MaxLength(50)]
        public string CustomerNo { get; set; } = string.Empty;

        [MaxLength(255)]
        public string CustomerName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string PoNo { get; set; } = string.Empty;

        [MaxLength(255)]
        public string ItemDesc { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Location { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Uom { get; set; } = string.Empty;

        public decimal QtyBackOrder { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ExtPrice { get; set; }

        [MaxLength(100)]
        public string Contract { get; set; } = string.Empty;

        [MaxLength(50)]
        public string AccountSet { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? ImportBatchId { get; set; }

        public DateTime ImportedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(100)]
        public string? ImportedBy { get; set; }
    }
}
