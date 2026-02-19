using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models
{
    public class OperatingCompany
    {
        [Key]
        public int OperatingCompanyId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(100)]
        public string? LogoUrl { get; set; }

        [MaxLength(50)]
        public string? PrimaryColor { get; set; }

        public bool IsActive { get; set; } = true;

        public int? CreatedById { get; set; }
        public int? UpdatedById { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public ICollection<StaffOperatingCompany> StaffMappings { get; set; } = new List<StaffOperatingCompany>();
    }
}
