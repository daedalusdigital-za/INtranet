using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics.TFN
{
    /// <summary>
    /// TruckFuelNet Fuel Order/Allocation
    /// </summary>
    public class TfnOrder
    {
        [Key]
        public int Id { get; set; }

        [MaxLength(100)]
        public string? TfnOrderId { get; set; }

        [Required]
        [MaxLength(100)]
        public string OrderNumber { get; set; } = string.Empty;

        // Link to internal system
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public int? LoadId { get; set; }

        [MaxLength(100)]
        public string? VirtualCardNumber { get; set; }
        
        [MaxLength(100)]
        public string? CustomerReference { get; set; }
        
        [MaxLength(50)]
        public string? CardNumber { get; set; }
        
        /// <summary>
        /// Vehicle registration directly from TFN order entry
        /// </summary>
        [MaxLength(50)]
        public string? VehicleRegistration { get; set; }
        
        /// <summary>
        /// Product code from TFN (e.g., D0, D1, P0, P1)
        /// </summary>
        [MaxLength(20)]
        public string? ProductCode { get; set; }

        // Order details
        [Column(TypeName = "decimal(18,2)")]
        public decimal AllocatedLitres { get; set; }
    
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AllocatedAmount { get; set; }

        [MaxLength(50)]
        public string? FuelType { get; set; } // Diesel, Petrol, etc.

        public DateTime OrderDate { get; set; } = DateTime.UtcNow;
        public DateTime? ExpiryDate { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Active, Used, Expired, Cancelled

        [Column(TypeName = "decimal(18,2)")]
        public decimal UsedLitres { get; set; } = 0;
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal UsedAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal RemainingLitres { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? RemainingAmount { get; set; }
        
        // TFN-specific fields
        public bool IsPlanned { get; set; }
        
        [MaxLength(500)]
        public string? PlannedReasons { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }

        // Navigation
        [ForeignKey("VehicleId")]
        public virtual Vehicle? Vehicle { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }

        [ForeignKey("LoadId")]
        public virtual Load? Load { get; set; }

        public virtual ICollection<TfnTransaction> Transactions { get; set; } = new List<TfnTransaction>();
    }
}
