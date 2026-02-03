using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class PartDeliveryHistory
    {
        [Key]
        public int Id { get; set; }

        // Link to ImportedInvoice
        public int ImportedInvoiceId { get; set; }
        public virtual ImportedInvoice? ImportedInvoice { get; set; }

        // Delivery details
        [Column(TypeName = "decimal(18,4)")]
        public decimal QuantityDelivered { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        [MaxLength(100)]
        public string? Reference { get; set; }

        // Driver/Vehicle info (optional - for when delivery is from a load)
        public int? LoadId { get; set; }
        public virtual Load? Load { get; set; }

        public int? DriverId { get; set; }
        public virtual Driver? Driver { get; set; }

        public int? VehicleId { get; set; }
        public virtual Vehicle? Vehicle { get; set; }

        // Tracking
        public DateTime DeliveredAt { get; set; } = DateTime.UtcNow;
        
        public int? RecordedByUserId { get; set; }
        
        [MaxLength(100)]
        public string? RecordedByUserName { get; set; }
    }
}
