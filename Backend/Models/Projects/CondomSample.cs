using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Projects
{
    /// <summary>
    /// Tracks condom sample submissions for testing/approval
    /// </summary>
    public class CondomSample
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Scent { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty;  // Female, Male

        [Required]
        [MaxLength(30)]
        public string BatchCode { get; set; } = string.Empty;

        public int Quantity { get; set; }

        public DateTime DateSent { get; set; }

        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Pending";  // Pending, Approved, Rejected, In Testing

        [MaxLength(100)]
        public string? Recipient { get; set; }

        [MaxLength(250)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
