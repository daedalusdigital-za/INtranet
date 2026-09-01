using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Hr
{
    /// <summary>
    /// An employee-relations / disciplinary record: warnings, suspensions, grievances,
    /// investigations and dismissals. Kept per employee so HR has a full case history
    /// and the dashboard can flag active/open cases that need action.
    /// </summary>
    [Table("HrDisciplinaryCases")]
    public class HrDisciplinaryCase
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int EmployeeId { get; set; }

        /// <summary>
        /// Verbal Warning, Written Warning, Final Written Warning, Suspension,
        /// Dismissal, Grievance, Investigation, Incident.
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = "Verbal Warning";

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        public DateTime IssuedDate { get; set; } = DateTime.UtcNow;

        /// <summary>When a warning lapses, or a suspension ends.</summary>
        public DateTime? ExpiryDate { get; set; }

        /// <summary>Open, Active, Resolved, Expired, Withdrawn.</summary>
        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Active";

        [MaxLength(500)]
        public string? Outcome { get; set; }

        /// <summary>For suspensions: whether it is paid.</summary>
        public bool IsPaidSuspension { get; set; }

        [MaxLength(150)]
        public string? IssuedByName { get; set; }

        [MaxLength(300)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [MaxLength(150)]
        public string? CreatedByName { get; set; }

        [ForeignKey(nameof(EmployeeId))]
        public virtual HrEmployee? Employee { get; set; }
    }

    public static class HrDisciplinaryTypes
    {
        public static readonly string[] All =
        {
            "Verbal Warning",
            "Written Warning",
            "Final Written Warning",
            "Suspension",
            "Dismissal",
            "Grievance",
            "Investigation",
            "Incident"
        };
    }
}
