using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    [Table("empregistration")]
    public class EmpRegistration
    {
        [Key]
        [Column("empid")]
        [MaxLength(50)]
        public string EmpId { get; set; } = string.Empty;

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

        [Column("Address")]
        [MaxLength(200)]
        public string? Address { get; set; }

        [Column("MobileNo")]
        [MaxLength(20)]
        public string? MobileNo { get; set; }

        [Column("Date")]
        public DateTime? Date { get; set; }

        [Column("Photo", TypeName = "varbinary(max)")]
        public byte[]? Photo { get; set; }

        // Navigation property
        public virtual ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
    }
}
