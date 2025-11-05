using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    [Table("attendance")]
    public class AttendanceRecord
    {
        [Key]
        [Column("Id")]
        public int Id { get; set; }

        [Required]
        [Column("empID")]
        [MaxLength(50)]
        public string EmpID { get; set; } = string.Empty;

        [Column("Name")]
        [MaxLength(100)]
        public string? Name { get; set; }

        [Column("LastName")]
        [MaxLength(100)]
        public string? LastName { get; set; }

        [Column("IdNum")]
        [MaxLength(50)]
        public string? IdNum { get; set; }

        [Column("Department")]
        [MaxLength(100)]
        public string? Department { get; set; }

        [Column("JobTitle")]
        [MaxLength(100)]
        public string? JobTitle { get; set; }

        [Column("Shift")]
        [MaxLength(50)]
        public string? Shift { get; set; }

        [Column("DaysWorked")]
        public int? DaysWorked { get; set; }

        [Column("Date")]
        public DateTime? Date { get; set; }

        [Column("Day")]
        [MaxLength(20)]
        public string? Day { get; set; }

        [Column("timein", TypeName = "time")]
        public TimeOnly? TimeIn { get; set; }

        [Column("timeout", TypeName = "time")]
        public TimeOnly? TimeOut { get; set; }

        [Column("Status")]
        [MaxLength(20)]
        public string? Status { get; set; }

        // Foreign key
        [ForeignKey("EmpID")]
        public virtual EmpRegistration? Employee { get; set; }
    }
}
