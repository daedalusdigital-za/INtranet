using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.DTOs
{
    public class CreateAnnouncementDto
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        public DateTime? ExpiresAt { get; set; }

        [MaxLength(50)]
        public string Priority { get; set; } = "Normal";

        [MaxLength(50)]
        public string? Category { get; set; }
    }

    public class UpdateAnnouncementDto
    {
        [MaxLength(200)]
        public string? Title { get; set; }

        public string? Content { get; set; }

        public DateTime? ExpiresAt { get; set; }

        [MaxLength(50)]
        public string? Priority { get; set; }

        [MaxLength(50)]
        public string? Category { get; set; }

        public bool? IsActive { get; set; }
    }

    public class AnnouncementDto
    {
        public int AnnouncementId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public int CreatedByUserId { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public string? CreatedByProfilePicture { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public string Priority { get; set; } = "Normal";
        public bool IsActive { get; set; }
        public string? Category { get; set; }
        public int ReadCount { get; set; }
        public bool IsRead { get; set; }
    }

    public class AnnouncementListDto
    {
        public int AnnouncementId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string Priority { get; set; } = "Normal";
        public string? Category { get; set; }
        public bool IsRead { get; set; }
    }
}
