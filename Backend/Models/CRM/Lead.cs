using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class Lead
    {
        [Key]
        public int LeadId { get; set; }

        [Required]
        public int OperatingCompanyId { get; set; }

        // Contact Information
        [Required]
        [MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? LastName { get; set; }

        [MaxLength(200)]
        public string? CompanyName { get; set; }

        [MaxLength(100)]
        public string? JobTitle { get; set; }

        [MaxLength(100)]
        [EmailAddress]
        public string? Email { get; set; }

        [MaxLength(20)]
        public string? Phone { get; set; }

        [MaxLength(20)]
        public string? MobilePhone { get; set; }

        [MaxLength(20)]
        public string? AlternatePhone { get; set; }

        // Address
        [MaxLength(200)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        [MaxLength(20)]
        public string? PostalCode { get; set; }

        [MaxLength(100)]
        public string? Country { get; set; } = "South Africa";

        // Lead Source & Tracking
        [MaxLength(100)]
        public string? Source { get; set; } // Web, Referral, Cold Call, Campaign, etc.

        [MaxLength(100)]
        public string? Area { get; set; } // Geographic area / territory

        public int? CampaignId { get; set; }

        // Status & Assignment
        public int? LeadStatusId { get; set; }

        public int? LastDispositionId { get; set; }

        public int? AssignedAgentId { get; set; }

        // Callback tracking
        public DateTime? NextCallbackAt { get; set; }

        public DateTime? LastContactedAt { get; set; }

        public int TotalCallAttempts { get; set; } = 0;

        // DNC (Do Not Call) compliance
        public bool DoNotCall { get; set; } = false;

        [MaxLength(500)]
        public string? DoNotCallReason { get; set; }

        public DateTime? DoNotCallSetAt { get; set; }

        public int? DoNotCallSetById { get; set; }

        // Lead scoring
        public int? LeadScore { get; set; }

        public bool IsHot { get; set; } = false;

        // Notes
        public string? Notes { get; set; }

        // Value tracking
        [Column(TypeName = "decimal(18,2)")]
        public decimal? EstimatedValue { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ActualValue { get; set; }

        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public int? CreatedById { get; set; }
        public int? UpdatedById { get; set; }

        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public int? DeletedById { get; set; }

        // Navigation properties
        [ForeignKey("OperatingCompanyId")]
        public virtual OperatingCompany? OperatingCompany { get; set; }

        [ForeignKey("LeadStatusId")]
        public virtual LeadStatus? LeadStatus { get; set; }

        [ForeignKey("LastDispositionId")]
        public virtual Disposition? LastDisposition { get; set; }

        [ForeignKey("AssignedAgentId")]
        public virtual User? AssignedAgent { get; set; }

        [ForeignKey("CampaignId")]
        public virtual Campaign? Campaign { get; set; }

        public virtual ICollection<LeadLog> Logs { get; set; } = new List<LeadLog>();
        public virtual ICollection<LeadInterest> Interests { get; set; } = new List<LeadInterest>();
        public virtual ICollection<LeadAssignmentHistory> AssignmentHistory { get; set; } = new List<LeadAssignmentHistory>();
    }
}
