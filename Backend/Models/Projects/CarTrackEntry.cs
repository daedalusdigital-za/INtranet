using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Projects
{
    /// <summary>
    /// Tracks sales rep car visits/locations for the HBA1C project.
    /// </summary>
    [Table("CarTrackEntries")]
    public class CarTrackEntry
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(150)]
        public string SalesRepName { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? RegistrationNumber { get; set; }

        [Required]
        [MaxLength(250)]
        public string Location { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Province { get; set; }

        [MaxLength(500)]
        public string? Purpose { get; set; }

        [MaxLength(200)]
        public string? ClientVisited { get; set; }

        public DateTime VisitDate { get; set; }

        public TimeSpan? TimeArrived { get; set; }

        public TimeSpan? TimeDeparted { get; set; }

        public double? KilometerStart { get; set; }

        public double? KilometerEnd { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Completed"; // Completed, In Transit, Scheduled

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public int? CreatedByUserId { get; set; }
    }
}
