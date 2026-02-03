using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class StopCommodity
    {
        [Key]
        public int Id { get; set; }

        // Foreign Keys
        public int LoadStopId { get; set; }
        public int? CommodityId { get; set; }  // Made nullable - imported invoices don't reference Commodities table
        public int? ContractId { get; set; }

        // Quantity and Pricing
        public decimal Quantity { get; set; }

        [MaxLength(50)]
        public string? UnitOfMeasure { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalPrice { get; set; }

        // Weights
        [Column(TypeName = "decimal(18,3)")]
        public decimal? Weight { get; set; } // in kg

        [Column(TypeName = "decimal(18,3)")]
        public decimal? Volume { get; set; } // in cubic meters

        // Reference Numbers
        [MaxLength(100)]
        public string? OrderNumber { get; set; }

        [MaxLength(100)]
        public string? InvoiceNumber { get; set; }

        [MaxLength(500)]
        public string? Comment { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("LoadStopId")]
        public virtual LoadStop LoadStop { get; set; } = null!;

        [ForeignKey("CommodityId")]
        public virtual Commodity Commodity { get; set; } = null!;

        [ForeignKey("ContractId")]
        public virtual CustomerContract? Contract { get; set; }
    }
}
