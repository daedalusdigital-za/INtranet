using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class Vehicle
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string RegistrationNumber { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? VinNumber { get; set; }

        [Required]
        [MaxLength(100)]
        public string Make { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Model { get; set; } = string.Empty;

        public int? Year { get; set; }

        [MaxLength(50)]
        public string? Color { get; set; }

        // Foreign Keys
        public int VehicleTypeId { get; set; }
        public int? CurrentDriverId { get; set; }

        // CarTrack Integration
        [MaxLength(100)]
        public string? CarTrackId { get; set; }

        [MaxLength(200)]
        public string? CarTrackName { get; set; }

        // Vehicle Status
        [MaxLength(50)]
        public string Status { get; set; } = "Available"; // Available, In Use, Under Maintenance, Decommissioned

        // Specifications
        public decimal? FuelCapacity { get; set; }
        public decimal? CurrentOdometer { get; set; }
        public DateTime? LastServiceDate { get; set; }
        public decimal? NextServiceOdometer { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("VehicleTypeId")]
        public virtual VehicleType VehicleType { get; set; } = null!;

        [ForeignKey("CurrentDriverId")]
        public virtual Driver? CurrentDriver { get; set; }

        public virtual ICollection<Load> Loads { get; set; } = new List<Load>();
        public virtual ICollection<VehicleMaintenance> MaintenanceRecords { get; set; } = new List<VehicleMaintenance>();
    }
}
