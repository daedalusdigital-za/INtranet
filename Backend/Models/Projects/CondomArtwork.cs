using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Projects
{
    /// <summary>
    /// Tracks condom packaging artwork/design status
    /// </summary>
    public class CondomArtwork
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
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;  // e.g. "Vanilla FC Inner Box"

        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Draft";  // Draft, In Review, Revision, Approved, Printing

        [MaxLength(50)]
        public string? Version { get; set; }  // e.g. "v1.0", "v2.3"

        [MaxLength(100)]
        public string? Designer { get; set; }

        public DateTime? ApprovalDate { get; set; }

        [MaxLength(250)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
