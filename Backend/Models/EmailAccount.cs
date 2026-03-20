using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models
{
    public class EmailAccount
    {
        [Key]
        public int EmailAccountId { get; set; }

        [Required]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Password { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? DisplayName { get; set; }

        [MaxLength(255)]
        public string? Department { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
