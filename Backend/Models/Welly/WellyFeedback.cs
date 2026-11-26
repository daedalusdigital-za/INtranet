using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Welly
{
    /// <summary>
    /// A labelled example: something Welly proposed and what a person did with it (accepted as is, edited, or rejected
    /// with a reason). Collected from day one so trust levels can be promoted on evidence and, later, the model tuned.
    /// </summary>
    [Table("WellyFeedback")]
    public class WellyFeedback
    {
        public long Id { get; set; }
        [Required, MaxLength(80)] public string SkillKey { get; set; } = string.Empty;
        public int? FlowRunId { get; set; }
        public int? FlowTaskId { get; set; }
        [MaxLength(60)] public string? StepId { get; set; }
        /// <summary>accepted | edited | rejected</summary>
        [Required, MaxLength(12)] public string Outcome { get; set; } = string.Empty;
        /// <summary>The skill's inputs and what Welly proposed (summary, evidence, prefill).</summary>
        public string? ProposalJson { get; set; }
        /// <summary>What the person finally submitted.</summary>
        public string? FinalJson { get; set; }
        [MaxLength(1000)] public string? Reason { get; set; }
        public int? UserId { get; set; }
        [MaxLength(150)] public string? UserName { get; set; }
        /// <summary>Model that produced the proposal, or "rules" for skills that are plain lookups.</summary>
        [MaxLength(80)] public string? Model { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
