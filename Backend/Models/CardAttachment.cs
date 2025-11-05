using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class CardAttachment
    {
        [Key]
        public int AttachmentId { get; set; }

        [Required]
        public int CardId { get; set; }

        [ForeignKey("CardId")]
        public Card Card { get; set; } = null!;

        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string FileUrl { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? FileType { get; set; }

        public long FileSize { get; set; }

        public int UploadedByUserId { get; set; }

        [ForeignKey("UploadedByUserId")]
        public User UploadedBy { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
