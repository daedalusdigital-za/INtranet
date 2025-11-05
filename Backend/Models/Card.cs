using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class Card
    {
        [Key]
        public int CardId { get; set; }

        [Required]
        public int ListId { get; set; }

        [ForeignKey("ListId")]
        public List List { get; set; } = null!;

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        public int? AssignedToUserId { get; set; }

        [ForeignKey("AssignedToUserId")]
        public User? AssignedTo { get; set; }

        public DateTime? DueDate { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Active"; // Active, Completed, Archived

        [Required]
        public int Position { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public ICollection<CardComment> Comments { get; set; } = new List<CardComment>();
        public ICollection<CardAttachment> Attachments { get; set; } = new List<CardAttachment>();
    }
}
