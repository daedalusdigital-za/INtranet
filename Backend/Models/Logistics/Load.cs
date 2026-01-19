using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class Load
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string LoadNumber { get; set; } = string.Empty;

        // Foreign Keys
        public int CustomerId { get; set; }
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }

        // Load Details
        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Assigned, In Transit, Delivered, Cancelled

        public DateTime? ScheduledPickupDate { get; set; }
        public DateTime? ActualPickupDate { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public DateTime? ActualDeliveryDate { get; set; }

        // Pricing
        public decimal? EstimatedCost { get; set; }
        public decimal? ActualCost { get; set; }
        public decimal? ChargeAmount { get; set; }

        // Route Information
        public decimal? EstimatedDistance { get; set; } // in km
        public decimal? ActualDistance { get; set; }

        [MaxLength(1000)]
        public string? SpecialInstructions { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("CustomerId")]
        public virtual Customer Customer { get; set; } = null!;

        [ForeignKey("VehicleId")]
        public virtual Vehicle? Vehicle { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }

        public virtual ICollection<LoadItem> LoadItems { get; set; } = new List<LoadItem>();
        public virtual ICollection<LoadStop> Stops { get; set; } = new List<LoadStop>();
        public virtual ProofOfDelivery? ProofOfDelivery { get; set; }
        public virtual Invoice? Invoice { get; set; }
    }
}
