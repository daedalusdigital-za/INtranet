using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class LeadInterest
    {
        [Key]
        public int LeadInterestId { get; set; }

        [Required]
        public int LeadId { get; set; }

        [Required]
        public int OperatingCompanyId { get; set; }

        // What they're interested in
        [Required]
        [MaxLength(200)]
        public string ProductOrService { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? InterestLevel { get; set; } // High, Medium, Low

        // Linked promotion if discussed
        public int? PromotionId { get; set; }

        // Notes
        [MaxLength(1000)]
        public string? Notes { get; set; }

        // Agent who recorded this
        public int? RecordedById { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("LeadId")]
        public virtual Lead? Lead { get; set; }

        [ForeignKey("OperatingCompanyId")]
        public virtual OperatingCompany? OperatingCompany { get; set; }

        [ForeignKey("PromotionId")]
        public virtual Promotion? Promotion { get; set; }

        [ForeignKey("RecordedById")]
        public virtual User? RecordedBy { get; set; }
    }
}
