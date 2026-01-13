using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class TodoTask
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [Required]
        public DateTime DueDate { get; set; }

        public DateTime? DueTime { get; set; }

        [Required]
        public int CreatedByUserId { get; set; }

        [ForeignKey("CreatedByUserId")]
        public User CreatedByUser { get; set; } = null!;

        [Required]
        public int AssignedToUserId { get; set; }

        [ForeignKey("AssignedToUserId")]
        public User AssignedToUser { get; set; } = null!;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Accepted, Declined, Completed

        public bool IsCompleted { get; set; } = false;

        public DateTime? CompletedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        [MaxLength(20)]
        public string Priority { get; set; } = "Normal"; // Low, Normal, High, Urgent

        [MaxLength(50)]
        public string? Category { get; set; }

        // For recurring tasks (optional)
        public bool IsRecurring { get; set; } = false;

        [MaxLength(20)]
        public string? RecurrencePattern { get; set; } // Daily, Weekly, Monthly
    }

    public class TodoNotification
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int TodoTaskId { get; set; }

        [ForeignKey("TodoTaskId")]
        public TodoTask TodoTask { get; set; } = null!;

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string NotificationType { get; set; } = string.Empty; // TaskAssigned, TaskAccepted, TaskDeclined, TaskCompleted

        [Required]
        [MaxLength(500)]
        public string Message { get; set; } = string.Empty;

        public bool IsRead { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ReadAt { get; set; }
    }
}
