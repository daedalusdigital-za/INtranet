using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class LoadItem
    {
        [Key]
        public int Id { get; set; }

        // Foreign Keys
        public int LoadId { get; set; }
        public int CommodityId { get; set; }

        public decimal Quantity { get; set; }

        [MaxLength(20)]
        public string? UnitOfMeasure { get; set; }

        public decimal? Weight { get; set; } // Total weight in kg
        public decimal? Volume { get; set; } // Total volume in cubic meters

        [MaxLength(500)]
        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("LoadId")]
        public virtual Load Load { get; set; } = null!;

        [ForeignKey("CommodityId")]
        public virtual Commodity Commodity { get; set; } = null!;
    }
}
