using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Hr
{
    /// <summary>
    /// A document or contract attached to an HR employee — e.g. employment contract,
    /// ID copy, qualification, disciplinary letter, medical certificate. Files are
    /// stored on the documents volume at {DocumentsPath}/HR/Employees/{EmployeeId}/.
    /// </summary>
    [Table("HrEmployeeDocuments")]
    public class HrEmployeeDocument
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int EmployeeId { get; set; }

        /// <summary>
        /// Contract, ID Document, Passport, Qualification, Certificate, Disciplinary,
        /// Medical, Policy, Payroll, Other.
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = "Other";

        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        /// <summary>Stored (unique) file name on disk.</summary>
        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        /// <summary>Original file name as uploaded by the user.</summary>
        [MaxLength(255)]
        public string? OriginalFileName { get; set; }

        [Required]
        [MaxLength(1000)]
        public string FilePath { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? ContentType { get; set; }

        public long FileSize { get; set; }

        /// <summary>Optional expiry (for contracts, work permits, certificates) — drives alerts.</summary>
        public DateTime? ExpiryDate { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public int? UploadedByUserId { get; set; }

        [MaxLength(150)]
        public string? UploadedByName { get; set; }

        [ForeignKey(nameof(EmployeeId))]
        public virtual HrEmployee? Employee { get; set; }
    }
}
