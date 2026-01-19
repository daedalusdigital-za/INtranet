using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class WarehouseInventory
    {
        [Key]
        public int Id { get; set; }

        // Foreign Keys
        public int WarehouseId { get; set; }
        public int CommodityId { get; set; }

        public decimal QuantityOnHand { get; set; }
        public decimal? ReorderLevel { get; set; }
        public decimal? MaximumLevel { get; set; }

        [MaxLength(50)]
        public string? BinLocation { get; set; }

        public DateTime? LastCountDate { get; set; }
        public DateTime? LastRestockDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("WarehouseId")]
        public virtual Warehouse Warehouse { get; set; } = null!;

        [ForeignKey("CommodityId")]
        public virtual Commodity Commodity { get; set; } = null!;

        public virtual ICollection<Backorder> Backorders { get; set; } = new List<Backorder>();
    }
}
