using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class User
    {
        [Key]
        public int UserId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Surname { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = "Employee"; // Admin, Manager, Employee

        [MaxLength(100)]
        public string? Title { get; set; } // Job title (e.g., Software Engineer, HR Manager)

        [MaxLength(500)]
        public string? Permissions { get; set; } // Comma-separated permissions or JSON

        [MaxLength(500)]
        public string? ProfilePictureUrl { get; set; } // URL or base64 encoded image

        public byte[]? ProfilePictureData { get; set; } // Binary image data for storing in DB

        [MaxLength(50)]
        public string? ProfilePictureMimeType { get; set; } // image/jpeg, image/png, etc.

        /// <summary>Saved hand signature (PNG/JPEG) used when this person signs documents on the intranet (payment packs etc.).</summary>
        public byte[]? SignatureImageData { get; set; }
        [MaxLength(50)] public string? SignatureImageMimeType { get; set; }
        public DateTime? SignatureUpdatedAt { get; set; }

        public int? DepartmentId { get; set; }

        [ForeignKey("DepartmentId")]
        public Department? Department { get; set; }

        // Link to clock-in system employee
        [MaxLength(50)]
        public string? LinkedEmpId { get; set; }

        [ForeignKey("LinkedEmpId")]
        public EmpRegistration? LinkedEmployee { get; set; }

        // Birthday for calendar display
        public DateTime? Birthday { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime? LastLoginAt { get; set; }

        // Self-service password reset (link emailed by an admin). Only the SHA-256 hash of the
        // token is stored; the link is single-use and a newer link replaces an older one.
        [MaxLength(64)]
        public string? PasswordResetTokenHash { get; set; }
        public DateTime? PasswordResetExpiresAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public ICollection<Card> AssignedCards { get; set; } = new List<Card>();

        // Phone Extensions linked to this user
        public ICollection<Extension> Extensions { get; set; } = new List<Extension>();

        // Computed property for full name
        [NotMapped]
        public string FullName => $"{Name} {Surname}";
    }
}
