using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Logistics
{
    public class Commodity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Code { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(50)]
        public string? Category { get; set; }

        // Physical Properties
        public decimal? UnitWeight { get; set; } // in kg
        public decimal? UnitVolume { get; set; } // in cubic meters

        [MaxLength(20)]
        public string? UnitOfMeasure { get; set; } // Pallets, Boxes, Tons, etc.

        // Handling Requirements
        public bool RequiresRefrigeration { get; set; }
        public bool IsFragile { get; set; }
        public bool IsHazardous { get; set; }

        [MaxLength(500)]
        public string? HandlingInstructions { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<LoadItem> LoadItems { get; set; } = new List<LoadItem>();
        public virtual ICollection<WarehouseInventory> InventoryRecords { get; set; } = new List<WarehouseInventory>();
    }
}
