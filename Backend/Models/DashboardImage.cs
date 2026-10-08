using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// An image uploaded by an admin to be shown in the dashboard slideshow
    /// (the widget that alternates between the Quote of the Day and a rotating
    /// set of images). Up to 30 images may be stored; the dashboard shows a
    /// random subset of them.
    /// </summary>
    [Table("dashboard_images")]
    public class DashboardImage
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string ContentType { get; set; } = "image/jpeg";

        /// <summary>Raw image bytes.</summary>
        [Required]
        public byte[] Data { get; set; } = Array.Empty<byte>();

        public int? UploadedByUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
