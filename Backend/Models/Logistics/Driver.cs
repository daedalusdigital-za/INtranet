using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Logistics
{
    public class Driver
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string LicenseNumber { get; set; } = string.Empty;

        [MaxLength(50)]
        public string LicenseType { get; set; } = string.Empty; // e.g., Code 14, Code 10, etc.

        public DateTime? LicenseExpiryDate { get; set; }

        [MaxLength(50)]
        public string? EmployeeNumber { get; set; }

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Active"; // Active, Inactive, On Leave, Suspended

        public DateTime? DateOfBirth { get; set; }
        public DateTime? HireDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<Load> Loads { get; set; } = new List<Load>();
        public virtual ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    }
}
