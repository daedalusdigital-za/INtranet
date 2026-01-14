using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class AuditLog
    {
        [Key]
        public int LogId { get; set; }

        public int? UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        [MaxLength(100)]
        public string Action { get; set; } = string.Empty; // Login, Logout, Created, Updated, Deleted, etc.

        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty; // security, user, announcement, settings, system, document, crm

        [Required]
        [MaxLength(50)]
        public string EntityType { get; set; } = string.Empty; // User, Card, Board, Document, etc.

        public int? EntityId { get; set; }

        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Details { get; set; } // JSON for additional data

        [MaxLength(200)]
        public string? UserName { get; set; }

        [MaxLength(200)]
        public string? UserEmail { get; set; }

        [MaxLength(50)]
        public string? UserRole { get; set; }

        [MaxLength(50)]
        public string? IpAddress { get; set; }

        [MaxLength(500)]
        public string? UserAgent { get; set; }

        [MaxLength(50)]
        public string Severity { get; set; } = "info"; // info, warning, error, critical

        public bool IsSuccess { get; set; } = true;

        [MaxLength(500)]
        public string? ErrorMessage { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

