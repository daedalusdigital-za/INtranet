using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Represents a sleep out allowance (food allowance) for drivers
    /// </summary>
    public class SleepOut
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int DriverId { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        public DateTime Date { get; set; }

        [Required]
        [StringLength(50)]
        public string Status { get; set; } = "Requested"; // Requested, Approved, Rejected, Paid

        [StringLength(500)]
        public string? Reason { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }

        // Trip/Load reference (optional)
        public int? LoadId { get; set; }

        [ForeignKey("LoadId")]
        public virtual Load? Load { get; set; }

        // Approval tracking
        public int? ApprovedByUserId { get; set; }
        public DateTime? ApprovedAt { get; set; }

        // Audit
        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
