using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class SupportTicket
    {
        [Key]
        public int TicketId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Priority { get; set; } = "Medium"; // Low, Medium, High, Critical

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Open"; // Open, InProgress, Resolved, Closed

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = "General"; // IT Support, Software, Hardware, Network, Account, Access, Other

        [Required]
        [MaxLength(100)]
        public string SubmittedBy { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? SubmittedByEmail { get; set; }

        public int? SubmittedByUserId { get; set; }

        [ForeignKey("SubmittedByUserId")]
        public User? SubmittedByUser { get; set; }

        [MaxLength(100)]
        public string? AssignedTo { get; set; }

        public int? AssignedToUserId { get; set; }

        [ForeignKey("AssignedToUserId")]
        public User? AssignedToUser { get; set; }

        public DateTime SubmittedDate { get; set; } = DateTime.UtcNow;

        public DateTime? FirstResponseDate { get; set; }

        public DateTime? ResolvedDate { get; set; }

        public DateTime? ClosedDate { get; set; }

        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        [MaxLength(1000)]
        public string? Resolution { get; set; }

        // Navigation property for comments/updates
        public ICollection<TicketComment> Comments { get; set; } = new List<TicketComment>();
    }

    public class TicketComment
    {
        [Key]
        public int CommentId { get; set; }

        public int TicketId { get; set; }

        [ForeignKey("TicketId")]
        public SupportTicket? Ticket { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Author { get; set; } = string.Empty;

        public int? AuthorUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsInternal { get; set; } = false; // Internal notes vs public comments
    }
}
