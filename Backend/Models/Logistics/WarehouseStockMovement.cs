using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Unified stock ledger. Stock on hand = imported baseline + sum of approved movements.
    /// WarehouseInventory.QuantityOnHand is a cached total updated in the same transaction.
    /// Rows are never edited or deleted — corrections are made with reversing entries.
    /// </summary>
    public class WarehouseStockMovement
    {
        public int Id { get; set; }

        public int WarehouseId { get; set; }
        [ForeignKey("WarehouseId")]
        public Warehouse? Warehouse { get; set; }

        public int CommodityId { get; set; }
        [ForeignKey("CommodityId")]
        public Commodity? Commodity { get; set; }

        /// <summary>Receive | Dispatch | Transfer | Return | Adjustment | Scrap | Reversal | Historical</summary>
        [MaxLength(30)]
        public string MovementType { get; set; } = string.Empty;

        /// <summary>Signed: negative = stock out, positive = stock in</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; }

        public int? LoadId { get; set; }
        public int? TransferId { get; set; }

        [MaxLength(200)]
        public string? Reference { get; set; }

        [MaxLength(1000)]
        public string? Reason { get; set; }

        /// <summary>Approved affects balances; Historical never does</summary>
        [MaxLength(30)]
        public string Status { get; set; } = "Approved";

        [Column(TypeName = "decimal(18,2)")]
        public decimal? BalanceAfter { get; set; }

        public int? ReversedByMovementId { get; set; }
        public int? ReversesMovementId { get; set; }

        [MaxLength(200)]
        public string? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
