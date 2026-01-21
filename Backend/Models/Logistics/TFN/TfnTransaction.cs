using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics.TFN
{
    /// <summary>
    /// TruckFuelNet Fuel Transaction
    /// </summary>
    public class TfnTransaction
    {
        [Key]
        public int Id { get; set; }

        [MaxLength(100)]
        public string? TfnTransactionId { get; set; }

        [Required]
        [MaxLength(100)]
        public string TransactionNumber { get; set; } = string.Empty;

        // Links
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public int? LoadId { get; set; }
        public int? TfnOrderId { get; set; }
        public int? TfnDepotId { get; set; }

        // Transaction details
        public DateTime TransactionDate { get; set; }

        [MaxLength(50)]
        public string? FuelType { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Litres { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal PricePerLitre { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? VatAmount { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? DiscountAmount { get; set; }

        // Vehicle metrics at time of transaction
        [Column(TypeName = "decimal(18,2)")]
        public decimal? OdometerReading { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? DistanceSinceLastFill { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? FuelEfficiency { get; set; } // km/l

        [MaxLength(100)]
        public string? VirtualCardNumber { get; set; }

        [MaxLength(100)]
        public string? AttendantName { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        // Variance tracking
        [Column(TypeName = "decimal(18,2)")]
        public decimal? ExpectedLitres { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? VarianceLitres { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? VariancePercentage { get; set; }

        public bool IsAnomaly { get; set; } = false; // Flag for unusual consumption
        [MaxLength(500)]
        public string? AnomalyReason { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastSyncedAt { get; set; }

        // Navigation
        [ForeignKey("VehicleId")]
        public virtual Vehicle? Vehicle { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }

        [ForeignKey("LoadId")]
        public virtual Load? Load { get; set; }

        [ForeignKey("TfnOrderId")]
        public virtual TfnOrder? Order { get; set; }

        [ForeignKey("TfnDepotId")]
        public virtual TfnDepot? Depot { get; set; }
    }
}
