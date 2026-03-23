using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Tenders
{
    /// <summary>
    /// Artwork files for tender samples and marketing materials
    /// </summary>
    public class ArtworkFile
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(300)]
        public string FileName { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? FilePath { get; set; }

        [Required]
        [MaxLength(20)]
        public string FileType { get; set; } = "pdf"; // pdf, image

        public long FileSize { get; set; }

        [MaxLength(100)]
        public string? MimeType { get; set; }

        [Required]
        [MaxLength(10)]
        public string CompanyCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty; 
        // Label, Box, Insert, Brochure, TenderDoc, SampleLabel, Certificate, Marketing, Logo, Other

        public int? TenderId { get; set; }

        [MaxLength(50)]
        public string? TenderNumber { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public int? UploadedByUserId { get; set; }

        [MaxLength(100)]
        public string? UploadedByUserName { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public bool SentToMarketing { get; set; }

        public DateTime? SentToMarketingAt { get; set; }

        [MaxLength(500)]
        public string? SentToMarketingRecipients { get; set; }

        [MaxLength(20)]
        public string? SentToMarketingPriority { get; set; }

        [MaxLength(2000)]
        public string? SentToMarketingMessage { get; set; }

        public DateTime? SentToMarketingRequestedBy { get; set; }

        [MaxLength(100)]
        public string? SentToMarketingRequestedByUser { get; set; }

        // Navigation properties
        public virtual ICollection<ArtworkAnnotation> Annotations { get; set; } = new List<ArtworkAnnotation>();

        [ForeignKey("TenderId")]
        public virtual Tender? Tender { get; set; }
    }

    /// <summary>
    /// Annotations/notes made on artwork files for change requests
    /// </summary>
    public class ArtworkAnnotation
    {
        [Key]
        public int Id { get; set; }

        public int ArtworkFileId { get; set; }

        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = "note"; // note, highlight, arrow

        public double X { get; set; } // Position as percentage (0-100)

        public double Y { get; set; } // Position as percentage (0-100)

        [MaxLength(2000)]
        public string? Text { get; set; }

        [MaxLength(20)]
        public string Color { get; set; } = "#FF5722";

        public int? CreatedByUserId { get; set; }

        [MaxLength(100)]
        public string? CreatedByUserName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ArtworkFileId")]
        public virtual ArtworkFile? ArtworkFile { get; set; }
    }
}
