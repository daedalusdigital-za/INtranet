using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// A geofence used by the logistics/security controller to monitor vehicles.
    /// Typically a circular parking/depot zone. During curfew hours any vehicle that
    /// leaves its parking geofence (or moves at all) raises an alert.
    /// </summary>
    public class Geofence
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        /// <summary>Parking, Depot, Restricted, Customer, Other</summary>
        [MaxLength(30)]
        public string Type { get; set; } = "Parking";

        [Column(TypeName = "decimal(10,7)")]
        public decimal Latitude { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal Longitude { get; set; }

        /// <summary>Radius of the circular geofence in metres.</summary>
        public int RadiusMeters { get; set; } = 200;

        /// <summary>Optional region tag e.g. GP, KZN.</summary>
        [MaxLength(20)]
        public string? Region { get; set; }

        /// <summary>Hex colour used to draw the zone on the map.</summary>
        [MaxLength(20)]
        public string? Color { get; set; }

        public bool IsActive { get; set; } = true;

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [MaxLength(150)]
        public string? CreatedBy { get; set; }
    }
}
