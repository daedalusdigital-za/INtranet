using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Hr
{
    /// <summary>
    /// A single line in a manual attendance register. Many sites (and staff in the
    /// main building) do not clock in biometrically — a supervisor instead submits a
    /// daily register recording who is in/out/working. These entries let HR compile a
    /// holistic attendance view that combines biometric clock-ins with manual registers.
    /// </summary>
    [Table("HrRegisterEntries")]
    public class HrRegisterEntry
    {
        [Key]
        public int Id { get; set; }

        /// <summary>The day this register line applies to (date only).</summary>
        [Required]
        public DateTime RegisterDate { get; set; }

        [Required]
        [MaxLength(60)]
        public string Site { get; set; } = "Main Office";

        [MaxLength(100)]
        public string? Department { get; set; }

        /// <summary>Link to the HR employee registry when the person is known.</summary>
        public int? EmployeeId { get; set; }

        /// <summary>Name as written on the register (kept even if not in the registry).</summary>
        [Required]
        [MaxLength(200)]
        public string EmployeeName { get; set; } = string.Empty;

        /// <summary>Present, Absent, On Leave, Sick, Off, Working Offsite, Half Day.</summary>
        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Present";

        [MaxLength(20)]
        public string? TimeIn { get; set; }

        [MaxLength(20)]
        public string? TimeOut { get; set; }

        [MaxLength(300)]
        public string? Notes { get; set; }

        [MaxLength(150)]
        public string? SubmittedByName { get; set; }

        public int? SubmittedByUserId { get; set; }

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [ForeignKey(nameof(EmployeeId))]
        public virtual HrEmployee? Employee { get; set; }
    }

    /// <summary>Allowed register statuses.</summary>
    public static class HrRegisterStatuses
    {
        public const string Present = "Present";
        public const string Absent = "Absent";
        public const string OnLeave = "On Leave";
        public const string Sick = "Sick";
        public const string Off = "Off";
        public const string WorkingOffsite = "Working Offsite";
        public const string HalfDay = "Half Day";

        public static readonly string[] All =
            { Present, Absent, OnLeave, Sick, Off, WorkingOffsite, HalfDay };

        /// <summary>Statuses that count as "at work / accounted-for present".</summary>
        public static readonly string[] PresentLike =
            { Present, WorkingOffsite, HalfDay };
    }
}
