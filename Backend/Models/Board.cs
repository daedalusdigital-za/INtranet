using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class Board
    {
        [Key]
        public int BoardId { get; set; }

        [Required]
        public int DepartmentId { get; set; }

        [ForeignKey("DepartmentId")]
        public Department Department { get; set; } = null!;

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        // Creator information
        public int? CreatedByUserId { get; set; }

        [ForeignKey("CreatedByUserId")]
        public User? CreatedBy { get; set; }

        // Board status: Planning, InProgress, Completed, OnHold
        [MaxLength(50)]
        public string Status { get; set; } = "Planning";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public ICollection<List> Lists { get; set; } = new List<List>();

        // Board-level checklist items
        public ICollection<BoardChecklistItem> ChecklistItems { get; set; } = new List<BoardChecklistItem>();

        // Board members (invited users)
        public ICollection<BoardMember> Members { get; set; } = new List<BoardMember>();
    }

    public class BoardMember
    {
        [Key]
        public int BoardMemberId { get; set; }

        [Required]
        public int BoardId { get; set; }

        [ForeignKey("BoardId")]
        public Board Board { get; set; } = null!;

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        // Role in the board: Owner, Admin, Member
        [MaxLength(50)]
        public string Role { get; set; } = "Member";

        public DateTime InvitedAt { get; set; } = DateTime.UtcNow;

        public int? InvitedByUserId { get; set; }

        [ForeignKey("InvitedByUserId")]
        public User? InvitedBy { get; set; }
    }

    public class BoardChecklistItem
    {
        [Key]
        public int ChecklistItemId { get; set; }

        [Required]
        public int BoardId { get; set; }

        [ForeignKey("BoardId")]
        public Board Board { get; set; } = null!;

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        public bool IsCompleted { get; set; } = false;

        public int Position { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? CompletedAt { get; set; }

        public int? CompletedByUserId { get; set; }

        [ForeignKey("CompletedByUserId")]
        public User? CompletedBy { get; set; }
    }
}
