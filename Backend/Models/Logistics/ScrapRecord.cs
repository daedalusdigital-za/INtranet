using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class ScrapRecord
    {
        [Key]
        public int Id { get; set; }

        // Foreign Keys
        public int WarehouseId { get; set; }
        public int CommodityId { get; set; }
        public int? UserId { get; set; } // User who recorded the scrap

        [Column(TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; }

        [Required]
        [MaxLength(50)]
        public string Reason { get; set; } = string.Empty; // damaged, expired, defective, contaminated, obsolete, other

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime ScrapDate { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("WarehouseId")]
        public virtual Warehouse Warehouse { get; set; } = null!;

        [ForeignKey("CommodityId")]
        public virtual Commodity Commodity { get; set; } = null!;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
