using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class Warehouse
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? Code { get; set; }

        // Location
        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(20)]
        public string? PostalCode { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Latitude { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? Longitude { get; set; }

        [MaxLength(100)]
        public string? ManagerName { get; set; }

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        // Specifications
        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalCapacity { get; set; } // in cubic meters or units
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AvailableCapacity { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<WarehouseInventory> Inventory { get; set; } = new List<WarehouseInventory>();
        public virtual ICollection<StockTransfer> TransfersFrom { get; set; } = new List<StockTransfer>();
        public virtual ICollection<StockTransfer> TransfersTo { get; set; } = new List<StockTransfer>();
    }
}
