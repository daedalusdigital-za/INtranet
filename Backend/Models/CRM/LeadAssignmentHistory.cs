using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class LeadAssignmentHistory
    {
        [Key]
        public int LeadAssignmentHistoryId { get; set; }

        [Required]
        public int LeadId { get; set; }

        [Required]
        public int OperatingCompanyId { get; set; }

        // Assignment change
        public int? PreviousAgentId { get; set; }
        public int? NewAgentId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Reason { get; set; } = "Initial Assignment";

        // Who made the change
        [Required]
        public int ChangedById { get; set; }

        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

        // Additional context
        [MaxLength(500)]
        public string? Notes { get; set; }

        // Navigation
        [ForeignKey("LeadId")]
        public virtual Lead? Lead { get; set; }

        [ForeignKey("OperatingCompanyId")]
        public virtual OperatingCompany? OperatingCompany { get; set; }

        [ForeignKey("PreviousAgentId")]
        public virtual User? PreviousAgent { get; set; }

        [ForeignKey("NewAgentId")]
        public virtual User? NewAgent { get; set; }

        [ForeignKey("ChangedById")]
        public virtual User? ChangedBy { get; set; }
    }
}
