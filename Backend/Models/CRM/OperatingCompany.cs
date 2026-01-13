using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.CRM
{
    public class OperatingCompany
    {
        [Key]
        public int OperatingCompanyId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(100)]
        public string? LogoUrl { get; set; }

        [MaxLength(50)]
        public string? PrimaryColor { get; set; }

        public bool IsActive { get; set; } = true;

        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public int? CreatedById { get; set; }
        public int? UpdatedById { get; set; }

        // Navigation properties
        public virtual ICollection<StaffOperatingCompany> StaffMappings { get; set; } = new List<StaffOperatingCompany>();
        public virtual ICollection<Lead> Leads { get; set; } = new List<Lead>();
        public virtual ICollection<Campaign> Campaigns { get; set; } = new List<Campaign>();
        public virtual ICollection<Promotion> Promotions { get; set; } = new List<Promotion>();
        public virtual ICollection<LeadStatus> LeadStatuses { get; set; } = new List<LeadStatus>();
        public virtual ICollection<Disposition> Dispositions { get; set; } = new List<Disposition>();
    }
}
