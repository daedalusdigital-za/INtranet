using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    /// <summary>
    /// A signed credit-note PDF uploaded by a manager / Finance. The credit note itself lives in Sage
    /// (we see it as CN lines in ImportedInvoices and, while unapplied, as a CR row in the aging). This
    /// row is the paper trail: who authorised the credit, why, and the scanned signed copy.
    /// </summary>
    [Table("CreditNoteDocuments")]
    public class CreditNoteDocument
    {
        public int Id { get; set; }
        /// <summary>Sage document number, e.g. CN103513.</summary>
        [Required, MaxLength(50)] public string CreditNoteNumber { get; set; } = string.Empty;
        /// <summary>Source company code: PMT, ACM, PHT, SBT (null if unknown at upload time).</summary>
        [MaxLength(10)] public string? Company { get; set; }
        [MaxLength(50)] public string? CustomerNumber { get; set; }
        [MaxLength(255)] public string? CustomerName { get; set; }
        /// <summary>Invoice(s) this credit relates to, comma separated, as typed by the uploader.</summary>
        [MaxLength(200)] public string? InvoiceNumbers { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal? Amount { get; set; }
        /// <summary>Returns | Pricing | Short delivery | Damaged | Expired | Duplicate | Other</summary>
        [MaxLength(50)] public string? Reason { get; set; }
        [MaxLength(1000)] public string? Notes { get; set; }
        /// <summary>Name of the manager whose signature is on the document.</summary>
        [MaxLength(150)] public string? SignedBy { get; set; }
        public DateTime? SignedOn { get; set; }
        [Required, MaxLength(255)] public string FileName { get; set; } = string.Empty;
        [MaxLength(255)] public string? OriginalFileName { get; set; }
        [MaxLength(100)] public string? ContentType { get; set; }
        public long Size { get; set; }
        /// <summary>Path relative to the documents root.</summary>
        [Required, MaxLength(500)] public string StoragePath { get; set; } = string.Empty;
        public int UploadedBy { get; set; }
        [MaxLength(150)] public string? UploadedByName { get; set; }
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
