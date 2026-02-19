using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models
{
    public class StaffOperatingCompany
    {
        [Key]
        public int StaffOperatingCompanyId { get; set; }

        public int StaffMemberId { get; set; }

        public int OperatingCompanyId { get; set; }

        [MaxLength(50)]
        public string? CompanyRole { get; set; }

        public bool IsPrimaryCompany { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public OperatingCompany OperatingCompany { get; set; } = null!;
    }
}
