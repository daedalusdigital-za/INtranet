using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// A virtual share of a document file/folder. The underlying file is never
    /// copied - this record grants a department or a specific user access to an
    /// item that lives in another department's folder.
    /// </summary>
    public class DocumentShare
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string SourceDepartment { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string SourcePath { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string ItemName { get; set; } = string.Empty;

        public bool IsFolder { get; set; }

        public int SharedByUserId { get; set; }

        [MaxLength(200)]
        public string? SharedByName { get; set; }

        [Required]
        [MaxLength(20)]
        public string ShareWithType { get; set; } = "Department"; // Department | User

        [MaxLength(100)]
        public string? ShareWithDepartment { get; set; }

        public int? ShareWithUserId { get; set; }

        [MaxLength(1000)]
        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
