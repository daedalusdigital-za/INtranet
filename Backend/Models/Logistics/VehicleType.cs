using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class VehicleType
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        // Capacity specifications
    [Column(TypeName = "decimal(18,2)")]
    public decimal? MaxLoadWeight { get; set; } // in kg
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal? MaxLoadVolume { get; set; } // in cubic meters

        [MaxLength(50)]
        public string? FuelType { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    }
}
