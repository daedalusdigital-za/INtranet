using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    /// <summary>
    /// One imported Sage "Customer Transaction / Aged Trial Balance" workbook for one company
    /// (Access Medical, Promed Technologies, Promed Pharatech, Sebenzani Trading…). The report is a
    /// point-in-time list of every open debtor document, so each upload is kept as a snapshot.
    /// </summary>
    [Table("ArAgingSnapshots")]
    public class ArAgingSnapshot
    {
        public int Id { get; set; }
        [Required, MaxLength(100)] public string Company { get; set; } = string.Empty;
        /// <summary>Date the report was run in Sage ("as at"). Ages are calculated from here.</summary>
        public DateTime AsOfDate { get; set; }
        [MaxLength(255)] public string? SourceFileName { get; set; }
        public int UploadedBy { get; set; }
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
        public int CustomerCount { get; set; }
        public int DocumentCount { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal TotalBalance { get; set; }
        [MaxLength(1000)] public string? Notes { get; set; }
        public virtual ICollection<ArAgingItem> Items { get; set; } = new List<ArAgingItem>();
    }

    /// <summary>One open document (invoice, receipt, prepayment, credit note…) on a debtor's account.</summary>
    [Table("ArAgingItems")]
    public class ArAgingItem
    {
        public int Id { get; set; }
        public int SnapshotId { get; set; }
        [Required, MaxLength(50)] public string CustomerCode { get; set; } = string.Empty;
        [Required, MaxLength(255)] public string CustomerName { get; set; } = string.Empty;
        [Required, MaxLength(50)] public string DocumentNumber { get; set; } = string.Empty;
        /// <summary>Sage type: IN invoice, CR credit note, PY receipt, PI prepayment, DB debit note, UC unapplied cash, AD adjustment, WO write-off…</summary>
        [Required, MaxLength(5)] public string DocumentType { get; set; } = string.Empty;
        [MaxLength(50)] public string? OrderNumber { get; set; }
        [MaxLength(100)] public string? PoNumber { get; set; }
        public DateTime? DocumentDate { get; set; }
        public DateTime? DueDate { get; set; }
        /// <summary>Receipt / prepayment reference (what Sage prints in the due-date column for PY/PI).</summary>
        [MaxLength(100)] public string? Reference { get; set; }
        [MaxLength(50)] public string? BatchEntry { get; set; }
        /// <summary>Days past due as printed by Sage (null for payments).</summary>
        public int? DaysOver { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal Amount { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal Balance { get; set; }
        /// <summary>Age in days from the document date to the snapshot date.</summary>
        public int AgeDays { get; set; }
        /// <summary>0 current, 1 = 30 days, 2 = 60, 3 = 90, 4 = 120+ (aged on document date, like the Sage ATB).</summary>
        public byte Bucket { get; set; }
        [ForeignKey(nameof(SnapshotId))] public virtual ArAgingSnapshot Snapshot { get; set; } = null!;
    }
}
