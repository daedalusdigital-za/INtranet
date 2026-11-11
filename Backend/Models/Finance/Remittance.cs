using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    /// <summary>
    /// A remittance advice / proof of payment email pulled from a finance mailbox by the nightly
    /// sweep. We keep the email's context (sender, subject, body) and its attachments so Finance can
    /// allocate the receipt in Sage without going back to the inbox.
    /// </summary>
    [Table("RemittanceEmails")]
    public class RemittanceEmail
    {
        public int Id { get; set; }
        [Required, MaxLength(200)] public string Mailbox { get; set; } = string.Empty;
        [Required, MaxLength(300)] public string MessageId { get; set; } = string.Empty;
        [MaxLength(200)] public string? FromName { get; set; }
        [MaxLength(200)] public string? FromEmail { get; set; }
        [MaxLength(500)] public string? Subject { get; set; }
        public DateTime ReceivedAt { get; set; }
        /// <summary>Plain-text body, trimmed to a sensible size.</summary>
        public string? BodyText { get; set; }
        /// <summary>Why the sweep picked this message up (subject / body / attachment keyword).</summary>
        [MaxLength(200)] public string? MatchedOn { get; set; }
        /// <summary>Best-guess debtor from the aging (customer name matched on sender domain / body).</summary>
        [MaxLength(50)] public string? CustomerCode { get; set; }
        [MaxLength(255)] public string? CustomerName { get; set; }
        /// <summary>JSON: invoice numbers and amounts extracted from subject, body and attachments, with aging matches.</summary>
        public string? ExtractedJson { get; set; }
        public int InvoiceCount { get; set; }
        public int MatchedCount { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal? TotalAmount { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal MatchedBalance { get; set; }
        /// <summary>New | Reviewed | Allocated | Ignored</summary>
        [MaxLength(20)] public string Status { get; set; } = "New";
        [MaxLength(2000)] public string? Notes { get; set; }
        public int? ReviewedBy { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual ICollection<RemittanceAttachment> Attachments { get; set; } = new List<RemittanceAttachment>();
    }

    [Table("RemittanceAttachments")]
    public class RemittanceAttachment
    {
        public int Id { get; set; }
        public int RemittanceEmailId { get; set; }
        [Required, MaxLength(255)] public string FileName { get; set; } = string.Empty;
        [MaxLength(100)] public string? ContentType { get; set; }
        public long Size { get; set; }
        /// <summary>Path relative to the documents root.</summary>
        [Required, MaxLength(500)] public string StoragePath { get; set; } = string.Empty;
        /// <summary>Text pulled from PDF attachments for invoice-number extraction (trimmed).</summary>
        public string? ExtractedText { get; set; }
        [ForeignKey(nameof(RemittanceEmailId))] public virtual RemittanceEmail Email { get; set; } = null!;
    }

    /// <summary>One row per sweep so Finance can see when the mailbox was last read and what came in.</summary>
    [Table("RemittanceScans")]
    public class RemittanceScan
    {
        public int Id { get; set; }
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? FinishedAt { get; set; }
        [MaxLength(500)] public string? Mailboxes { get; set; }
        public int MessagesChecked { get; set; }
        public int RemittancesFound { get; set; }
        [MaxLength(20)] public string Trigger { get; set; } = "schedule"; // schedule | manual
        [MaxLength(1000)] public string? Error { get; set; }
    }
}
