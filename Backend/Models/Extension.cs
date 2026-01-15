using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class Extension
    {
        [Key]
        public int ExtensionId { get; set; }

        [Required]
        [MaxLength(20)]
        public string ExtensionNumber { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Label { get; set; } // e.g., "Main Line", "Direct Line", "Fax"

        [MaxLength(50)]
        public string? ExtensionType { get; set; } // Phone, Fax, Mobile, etc.

        [MaxLength(255)]
        public string? Description { get; set; }

        // Link to user (nullable - extension might not be assigned yet)
        public int? UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        // Department extension (for department-level extensions like reception)
        public int? DepartmentId { get; set; }

        [ForeignKey("DepartmentId")]
        public Department? Department { get; set; }

        // PBX-related fields for future integration
        [MaxLength(100)]
        public string? PbxDeviceId { get; set; } // ID in the PBX system

        [MaxLength(100)]
        public string? MacAddress { get; set; } // Phone MAC address

        [MaxLength(100)]
        public string? PhoneModel { get; set; } // e.g., "Yealink T46S", "Cisco 7940"

        [MaxLength(255)]
        public string? Location { get; set; } // Physical location of the phone

        public bool IsActive { get; set; } = true;

        public bool IsPrimary { get; set; } = false; // Primary extension for user

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }
}
