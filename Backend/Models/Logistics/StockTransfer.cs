using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class StockTransfer
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string TransferNumber { get; set; } = string.Empty;

        // Foreign Keys
        public int FromWarehouseId { get; set; }
        public int ToWarehouseId { get; set; }
        public int CommodityId { get; set; }

        public decimal Quantity { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, In Transit, Received, Cancelled

        public DateTime RequestedDate { get; set; } = DateTime.UtcNow;
        public DateTime? ShippedDate { get; set; }
        public DateTime? ReceivedDate { get; set; }

        [MaxLength(100)]
        public string? RequestedBy { get; set; }

        [MaxLength(100)]
        public string? ApprovedBy { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("FromWarehouseId")]
        public virtual Warehouse FromWarehouse { get; set; } = null!;

        [ForeignKey("ToWarehouseId")]
        public virtual Warehouse ToWarehouse { get; set; } = null!;

        [ForeignKey("CommodityId")]
        public virtual Commodity Commodity { get; set; } = null!;
    }
}
