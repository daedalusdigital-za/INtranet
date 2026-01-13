using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class Promotion
    {
        [Key]
        public int PromotionId { get; set; }

        [Required]
        public int OperatingCompanyId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        // Promo details
        [MaxLength(50)]
        public string? PromoCode { get; set; }

        [MaxLength(50)]
        public string? DiscountType { get; set; } // Percentage, Fixed, FreeItem, Bundle

        [Column(TypeName = "decimal(18,2)")]
        public decimal? DiscountValue { get; set; }

        // Active period
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        public bool IsActive { get; set; } = true;

        // Terms & conditions
        public string? Terms { get; set; }

        // Script hint for agents
        public string? AgentScript { get; set; }

        // Targeting
        [MaxLength(500)]
        public string? TargetProducts { get; set; }

        [MaxLength(500)]
        public string? TargetAudience { get; set; }

        // Audit
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public int? CreatedById { get; set; }
        public int? UpdatedById { get; set; }

        public bool IsDeleted { get; set; } = false;

        // Navigation
        [ForeignKey("OperatingCompanyId")]
        public virtual OperatingCompany? OperatingCompany { get; set; }

        public virtual ICollection<LeadInterest> LeadInterests { get; set; } = new List<LeadInterest>();
    }
}
