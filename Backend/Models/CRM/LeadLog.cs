using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class LeadLog
    {
        [Key]
        public int LeadLogId { get; set; }

        [Required]
        public int LeadId { get; set; }

        [Required]
        public int OperatingCompanyId { get; set; }

        [Required]
        public int AgentId { get; set; }

        // Call details
        [Required]
        [MaxLength(50)]
        public string LogType { get; set; } = "Call"; // Call, Email, SMS, Note, Meeting

        public DateTime LogDateTime { get; set; } = DateTime.UtcNow;

        public int? DurationSeconds { get; set; }

        // Disposition (required for calls)
        public int? DispositionId { get; set; }

        // Callback scheduled from this call
        public DateTime? ScheduledCallbackAt { get; set; }

        // Notes
        [Required]
        public string Notes { get; set; } = string.Empty;

        // Outcome tracking
        public bool WasContacted { get; set; } = false; // Did we reach someone?

        public bool IsPositiveOutcome { get; set; } = false;

        // Status change triggered by this log
        public int? NewLeadStatusId { get; set; }

        // Promotion discussed
        public int? PromotionId { get; set; }

        // Audit
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("LeadId")]
        public virtual Lead? Lead { get; set; }

        [ForeignKey("OperatingCompanyId")]
        public virtual OperatingCompany? OperatingCompany { get; set; }

        [ForeignKey("AgentId")]
        public virtual User? Agent { get; set; }

        [ForeignKey("DispositionId")]
        public virtual Disposition? Disposition { get; set; }

        [ForeignKey("PromotionId")]
        public virtual Promotion? Promotion { get; set; }
    }
}
