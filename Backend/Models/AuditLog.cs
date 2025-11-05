using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class AuditLog
    {
        [Key]
        public int LogId { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string Action { get; set; } = string.Empty; // Created, Updated, Deleted, Moved

        [Required]
        [MaxLength(50)]
        public string EntityType { get; set; } = string.Empty; // Card, Board, List, etc.

        public int EntityId { get; set; }

        [MaxLength(2000)]
        public string? Details { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
