using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class CampaignAgent
    {
        [Key]
        public int CampaignAgentId { get; set; }

        [Required]
        public int CampaignId { get; set; }

        [Required]
        public int AgentId { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
        public int? AssignedById { get; set; }

        public DateTime? RemovedAt { get; set; }
        public int? RemovedById { get; set; }

        // Navigation
        [ForeignKey("CampaignId")]
        public virtual Campaign? Campaign { get; set; }

        [ForeignKey("AgentId")]
        public virtual User? Agent { get; set; }
    }
}
