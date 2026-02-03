using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class ProofOfDelivery
    {
        [Key]
        public int Id { get; set; }

        public int LoadId { get; set; }

        [MaxLength(100)]
        public string? RecipientName { get; set; }

        [MaxLength(500)]
        public string? SignatureUrl { get; set; } // Path to signature image

        public DateTime DeliveredAt { get; set; } = DateTime.UtcNow;

        // GPS coordinates at delivery
        public decimal? DeliveryLatitude { get; set; }
        public decimal? DeliveryLongitude { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        [MaxLength(1000)]
        public string? PhotoUrls { get; set; } // JSON array or comma-separated URLs

        // Condition on delivery
        [MaxLength(50)]
        public string? ConditionOnDelivery { get; set; } // Good, Damaged, Partial, etc.

        [MaxLength(1000)]
        public string? DamageNotes { get; set; }

        // POD file upload
        [MaxLength(500)]
        public string? FilePath { get; set; } // Server file path

        [MaxLength(255)]
        public string? FileName { get; set; } // Original filename

        public DateTime? UploadedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("LoadId")]
        public virtual Load Load { get; set; } = null!;
    }
}
