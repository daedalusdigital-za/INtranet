using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class VehicleMaintenance
    {
        [Key]
        public int Id { get; set; }

        public int VehicleId { get; set; }

        [MaxLength(50)]
        public string MaintenanceType { get; set; } = "Service"; // Service, Repair, Inspection, Tire Change, etc.

        [MaxLength(500)]
        public string? Description { get; set; }

        public DateTime ScheduledDate { get; set; }
        public DateTime? CompletedDate { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? OdometerReading { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? Cost { get; set; }

        [MaxLength(200)]
        public string? ServiceProvider { get; set; }

        [MaxLength(100)]
        public string? InvoiceReference { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Scheduled"; // Scheduled, In Progress, Completed, Cancelled

        [MaxLength(1000)]
        public string? Notes { get; set; }

    // File attachments
    [MaxLength(500)]
    public string? ProofOfWorkPath { get; set; }
    
    [MaxLength(500)]
    public string? ProofOfPaymentPath { get; set; }

    // Next service reminder
    public DateTime? NextServiceDate { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal? NextServiceOdometer { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("VehicleId")]
        public virtual Vehicle Vehicle { get; set; } = null!;
    }
}
