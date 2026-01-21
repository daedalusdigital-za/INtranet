using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics.TFN
{
    /// <summary>
    /// TruckFuelNet Account Balance/Credit Limit
    /// </summary>
    public class TfnAccountBalance
    {
        [Key]
        public int Id { get; set; }

        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }

        [MaxLength(100)]
        public string? TfnAccountNumber { get; set; }

        [MaxLength(100)]
        public string? SubAccountNumber { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentBalance { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal CreditLimit { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal AvailableCredit { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MonthToDateSpend { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal YearToDateSpend { get; set; }

        public DateTime? LastTransactionDate { get; set; }
        public DateTime BalanceDate { get; set; } = DateTime.UtcNow;

        public bool IsActive { get; set; } = true;
        public bool IsSuspended { get; set; } = false;

        [MaxLength(500)]
        public string? SuspensionReason { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }

        // Navigation
        [ForeignKey("VehicleId")]
        public virtual Vehicle? Vehicle { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }
    }
}
