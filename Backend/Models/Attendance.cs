using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class Attendance
    {
        [Key]
        public int AttendanceId { get; set; }

        [Required]
        public int EmployeeId { get; set; }

        [Required]
        public DateTime Date { get; set; }

        public DateTime? TimeIn { get; set; }
        public DateTime? TimeOut { get; set; }

        [StringLength(50)]
        public string? Shift { get; set; }

        [StringLength(20)]
        public string Status { get; set; } = "Absent"; // Present, Absent, Late, OnLeave

        public bool IsLate { get; set; } = false;

        public int? LateMinutes { get; set; }

        [StringLength(500)]
        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation property
        [ForeignKey("EmployeeId")]
        public virtual Employee? Employee { get; set; }
    }
}
