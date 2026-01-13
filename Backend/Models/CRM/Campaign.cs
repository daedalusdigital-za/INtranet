using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class Campaign
    {
        [Key]
        public int CampaignId { get; set; }

        [Required]
        public int OperatingCompanyId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        // Campaign type & channel
        [MaxLength(50)]
        public string? CampaignType { get; set; } // Outbound, Inbound, Mixed

        [MaxLength(50)]
        public string? Channel { get; set; } // Phone, Email, SMS, Multi-channel

        // Status
        [MaxLength(50)]
        public string Status { get; set; } = "Draft"; // Draft, Active, Paused, Completed, Cancelled

        // Date range
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        // Targets
        public int? TargetLeads { get; set; }
        public int? TargetConversions { get; set; }

        // Budget
        [Column(TypeName = "decimal(18,2)")]
        public decimal? Budget { get; set; }

        // Script/instructions for agents
        public string? Script { get; set; }

        public string? Instructions { get; set; }

        // Audit
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public int? CreatedById { get; set; }
        public int? UpdatedById { get; set; }

        public bool IsDeleted { get; set; } = false;

        // Navigation
        [ForeignKey("OperatingCompanyId")]
        public virtual OperatingCompany? OperatingCompany { get; set; }

        public virtual ICollection<CampaignAgent> AssignedAgents { get; set; } = new List<CampaignAgent>();
        public virtual ICollection<Lead> Leads { get; set; } = new List<Lead>();
    }
}
