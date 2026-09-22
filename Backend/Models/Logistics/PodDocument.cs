using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Standalone POD (Proof of Delivery) document - stored by driver + date + region.
    /// Unlike ProofOfDelivery (linked 1:1 to a Load), PodDocuments are daily driver PODs
    /// that may cover multiple deliveries on that date.
    /// </summary>
    public class PodDocument
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Human-readable, barcode-friendly POD identifier (auto-generated on save),
        /// e.g. "POD000123". Used in place of the driver as the primary POD reference.
        /// </summary>
        [MaxLength(30)]
        public string? PodNumber { get; set; }

        // Driver link (optional - matched by name)
        public int? DriverId { get; set; }

        [Required]
        [MaxLength(100)]
        public string DriverName { get; set; } = string.Empty;

        // Delivery date this POD covers
        [Required]
        public DateTime DeliveryDate { get; set; }

        // Region: GP, KZN, etc.
        [Required]
        [MaxLength(20)]
        public string Region { get; set; } = string.Empty;

        // File storage
        [Required]
        [MaxLength(500)]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? OriginalFileName { get; set; }

        [MaxLength(20)]
        public string? ContentType { get; set; }

        public long FileSize { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Tripsheet link (optional)
        public int? LoadId { get; set; }

        // Legacy single invoice link (optional)
        // Kept for backward compatibility while supporting multi-invoice links.
        public int? InvoiceId { get; set; }

        // Navigation
        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }

        [ForeignKey("LoadId")]
        public virtual Load? Load { get; set; }

        [ForeignKey("InvoiceId")]
        public virtual ImportedInvoice? Invoice { get; set; }

        public virtual ICollection<PodDocumentInvoiceLink> InvoiceLinks { get; set; } = new List<PodDocumentInvoiceLink>();
    }
}
