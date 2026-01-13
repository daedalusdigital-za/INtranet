using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class StaffOperatingCompany
    {
        [Key]
        public int StaffOperatingCompanyId { get; set; }

        [Required]
        public int StaffMemberId { get; set; }

        [Required]
        public int OperatingCompanyId { get; set; }

        public bool IsActive { get; set; } = true;

        public bool IsPrimaryCompany { get; set; } = false;

        // Role within this operating company
        [MaxLength(50)]
        public string? CompanyRole { get; set; } // SalesManager, SalesAgent, etc.

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("StaffMemberId")]
        public virtual User? StaffMember { get; set; }

        [ForeignKey("OperatingCompanyId")]
        public virtual OperatingCompany? OperatingCompany { get; set; }
    }
}
