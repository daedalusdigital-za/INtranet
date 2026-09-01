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

        // ---- Fleet-repair / breakdown tracking (Rocket Freight style) ----

        /// <summary>Low | Medium | High | Critical.</summary>
        [MaxLength(20)]
        public string? Priority { get; set; }

        /// <summary>Person/role responsible for the next action (e.g. Workshop, Management, Insurance).</summary>
        [MaxLength(150)]
        public string? ActionOwner { get; set; }

        /// <summary>Province/region the vehicle is standing in. Falls back to the vehicle's province.</summary>
        [MaxLength(100)]
        public string? Province { get; set; }

        /// <summary>Running commentary / latest feedback, distinct from the original issue.</summary>
        [MaxLength(2000)]
        public string? Feedback { get; set; }

        /// <summary>Quoted / estimated cost before the job is done (actual goes in <see cref="Cost"/>).</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? EstimatedCost { get; set; }

        /// <summary>Date the vehicle went off-road / stood. Used to compute days-standing.</summary>
        public DateTime? DateStood { get; set; }

        /// <summary>Target date to have the vehicle back in service.</summary>
        public DateTime? TargetDate { get; set; }

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
