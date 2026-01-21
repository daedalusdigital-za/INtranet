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
        public string LoadNumber { get; set; } = string.Empty; // e.g., LD-000001

        // Foreign Keys
        public int? CustomerId { get; set; }
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public int? WarehouseId { get; set; }
        public int? VehicleTypeId { get; set; }

        // Created By
        public int? CreatedByUserId { get; set; }

        // Origin/Destination (Summary)
        [MaxLength(500)]
        public string? PickupLocation { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? PickupLatitude { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? PickupLongitude { get; set; }

        [MaxLength(500)]
        public string? DeliveryLocation { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? DeliveryLatitude { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? DeliveryLongitude { get; set; }

        // Load Details
        [MaxLength(50)]
        public string Status { get; set; } = "Available"; // Available, Assigned, InTransit, Delivered, Cancelled

        [MaxLength(50)]
        public string Priority { get; set; } = "Normal"; // Low, Normal, High, Urgent

        public DateTime? ScheduledPickupDate { get; set; }
        public DateTime? ScheduledPickupTime { get; set; }
        public DateTime? ActualPickupDate { get; set; }
        public DateTime? ScheduledDeliveryDate { get; set; }
        public DateTime? ScheduledDeliveryTime { get; set; }
        public DateTime? ActualDeliveryDate { get; set; }

        // Route Information
        [Column(TypeName = "decimal(10,2)")]
        public decimal? EstimatedDistance { get; set; } // in km

        [Column(TypeName = "decimal(10,2)")]
        public decimal? ActualDistance { get; set; }

        public int? EstimatedTimeMinutes { get; set; }
        public int? ActualTimeMinutes { get; set; }

        // Pricing
        [Column(TypeName = "decimal(18,2)")]
        public decimal? EstimatedCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ActualCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ChargeAmount { get; set; }

        // Weight/Volume Totals
        [Column(TypeName = "decimal(18,3)")]
        public decimal? TotalWeight { get; set; } // in kg

        [Column(TypeName = "decimal(18,3)")]
        public decimal? TotalVolume { get; set; } // in cubic meters

        [MaxLength(1000)]
        public string? SpecialInstructions { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("CustomerId")]
        public virtual Customer? Customer { get; set; }

        [ForeignKey("VehicleId")]
        public virtual Vehicle? Vehicle { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }

        [ForeignKey("WarehouseId")]
        public virtual Warehouse? Warehouse { get; set; }

        [ForeignKey("VehicleTypeId")]
        public virtual VehicleType? VehicleType { get; set; }

        public virtual ICollection<LoadItem> LoadItems { get; set; } = new List<LoadItem>();
        public virtual ICollection<LoadStop> Stops { get; set; } = new List<LoadStop>();
        public virtual ProofOfDelivery? ProofOfDelivery { get; set; }
        public virtual Invoice? Invoice { get; set; }
    }
}
