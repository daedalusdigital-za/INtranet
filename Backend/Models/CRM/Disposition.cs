using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.CRM
{
    public class Disposition
    {
        [Key]
        public int DispositionId { get; set; }

        [Required]
        public int OperatingCompanyId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(50)]
        public string? Color { get; set; }

        [MaxLength(50)]
        public string? Icon { get; set; }

        public int SortOrder { get; set; } = 0;

        // Behavior flags
        public bool RequiresCallback { get; set; } = false; // Must set NextCallbackAt

        public bool RequiresNotes { get; set; } = false; // Must add notes

        public bool IsFinal { get; set; } = false; // Ends the lead journey (DNC, Not Interested, Won)

        public bool IsPositive { get; set; } = false; // Interested, Won

        public bool IsDoNotCall { get; set; } = false; // Marks lead as DNC

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        [ForeignKey("OperatingCompanyId")]
        public virtual OperatingCompany? OperatingCompany { get; set; }

        public virtual ICollection<LeadLog> LeadLogs { get; set; } = new List<LeadLog>();
    }
}
