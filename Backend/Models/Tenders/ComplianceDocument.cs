using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Tenders
{
    /// <summary>
    /// Compliance documents required for tender submissions
    /// </summary>
    public class ComplianceDocument
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(10)]
        public string CompanyCode { get; set; } = string.Empty; // PMT, SBT, ACM

        [Required]
        [MaxLength(50)]
        public string DocumentType { get; set; } = string.Empty; 
        // CSD, TaxClearance, BBBEE, CIDB, CompanyRegistration, BankConfirmation, COIDA, ISO

        [MaxLength(100)]
        public string? DocumentNumber { get; set; }

        [Required]
        public DateTime IssueDate { get; set; }

        [Required]
        public DateTime ExpiryDate { get; set; }

        [MaxLength(200)]
        public string? IssuingAuthority { get; set; }

        [MaxLength(500)]
        public string? FilePath { get; set; }

        [MaxLength(200)]
        public string? FileName { get; set; }

        public long? FileSize { get; set; }

        [MaxLength(100)]
        public string? MimeType { get; set; }

        // Upload tracking
        public int? UploadedByUserId { get; set; }

        [MaxLength(100)]
        public string? UploadedByUserName { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        // Alert tracking
        public bool Alert45DaysSent { get; set; }
        public bool Alert30DaysSent { get; set; }
        public bool Alert7DaysSent { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        // Computed properties
        [NotMapped]
        public int DaysLeft => (ExpiryDate.Date - DateTime.UtcNow.Date).Days;

        [NotMapped]
        public string ComputedStatus
        {
            get
            {
                if (DaysLeft < 0) return "Expired";
                if (DaysLeft <= 30) return "Warning";
                if (DaysLeft <= 60) return "Expiring";
                return "Valid";
            }
        }
    }

    /// <summary>
    /// Alert log for compliance documents
    /// </summary>
    public class ComplianceAlert
    {
        [Key]
        public int Id { get; set; }

        public int ComplianceDocumentId { get; set; }

        [Required]
        [MaxLength(50)]
        public string AlertType { get; set; } = string.Empty; // 45Day, 30Day, 7Day

        [MaxLength(500)]
        public string? Message { get; set; }

        public int DaysRemaining { get; set; }

        public bool IsAcknowledged { get; set; }

        public int? AcknowledgedByUserId { get; set; }

        [MaxLength(100)]
        public string? AcknowledgedByUserName { get; set; }

        public DateTime? AcknowledgedAt { get; set; }

        [MaxLength(500)]
        public string? AcknowledgmentNotes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ComplianceDocumentId")]
        public virtual ComplianceDocument? ComplianceDocument { get; set; }
    }
}
