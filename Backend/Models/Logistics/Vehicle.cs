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

        // Province/Region assignment
        [MaxLength(100)]
        public string? Province { get; set; }

        // CarTrack Integration
        [MaxLength(100)]
        public string? CarTrackId { get; set; }

        [MaxLength(200)]
        public string? CarTrackName { get; set; }

        // TruckFuelNet Integration
        [MaxLength(100)]
        public string? TfnVehicleId { get; set; }

        [MaxLength(100)]
        public string? TfnSubAccountNumber { get; set; }

        [MaxLength(100)]
        public string? TfnVirtualCardNumber { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TfnCreditLimit { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? TfnCurrentBalance { get; set; }
        public DateTime? TfnLastSyncedAt { get; set; }
        
        // Additional TFN fields
        [MaxLength(100)]
        public string? TfnFleetNumber { get; set; }
        
        [MaxLength(100)]
        public string? TfnExternalNumber { get; set; }
        
        [MaxLength(50)]
        public string? TfnStatus { get; set; }
        
        public bool IsLinkedToTfn { get; set; } = false;

        // Last Known Location (persisted from CarTrack)
        [Column(TypeName = "decimal(18,10)")]
        public decimal? LastKnownLatitude { get; set; }
        
        [Column(TypeName = "decimal(18,10)")]
        public decimal? LastKnownLongitude { get; set; }
        
        [MaxLength(500)]
        public string? LastKnownAddress { get; set; }
        
        public DateTime? LastLocationUpdate { get; set; }
        
        [MaxLength(50)]
        public string? LastKnownStatus { get; set; }  // moving, stopped, idling, offline

        // Vehicle Status
        [MaxLength(50)]
        public string Status { get; set; } = "Available"; // Available, In Use, Under Maintenance, Decommissioned

        // Specifications
        [MaxLength(50)]
        public string? FuelType { get; set; } // Diesel, Petrol, etc.

        [Column(TypeName = "decimal(18,2)")]
        public decimal? FuelCapacity { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? TankSize { get; set; } // Litres
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AverageFuelConsumption { get; set; } // km/l
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal? CurrentOdometer { get; set; }
        public DateTime? LastServiceDate { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
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
