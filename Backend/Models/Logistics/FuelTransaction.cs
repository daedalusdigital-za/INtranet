using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Monthly fuel report transaction record - imported from fuel reports
    /// </summary>
    public class FuelTransaction
    {
        [Key]
        public int Id { get; set; }

        // Vehicle link
        public int? VehicleId { get; set; }

        [Required]
        [MaxLength(50)]
        public string RegistrationNumber { get; set; } = string.Empty;

        /// <summary>
        /// TFN transaction GUID (from /api/TransactionsWithUtilisedOrders/{id}).
        /// Used to de-duplicate automatically-synced fuel transactions so the same
        /// TFN fill is never imported twice. Null for manually-imported rows.
        /// </summary>
        [MaxLength(50)]
        public string? TfnTransactionId { get; set; }

        [MaxLength(50)]
        public string? CardNumber { get; set; }

        // Depot / fuel point info
        [MaxLength(200)]
        public string? DepotName { get; set; }

        // Fuel quantities
        [Column(TypeName = "decimal(18,2)")]
        public decimal AllocationLitres { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LitresUsed { get; set; }

        // Transaction timing
        public DateTime TransactionDate { get; set; }

        // Cost
        [Column(TypeName = "decimal(18,2)")]
        public decimal AmountSpent { get; set; }

        // Assignment/Region (e.g., "KZN - LINK", "GP - 14 TON", "CPT - TRANSIT")
        [MaxLength(100)]
        public string? DepotAssignment { get; set; }

        /// <summary>Fuel source: "TFN" (TruckFuelNet) or "PUMA" (Puma Garage).</summary>
        [MaxLength(20)]
        public string Source { get; set; } = "TFN";

        // Report period tracking
        public int ReportMonth { get; set; }
        public int ReportYear { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("VehicleId")]
        public virtual Vehicle? Vehicle { get; set; }
    }
}
