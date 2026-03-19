using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Projects
{
    /// <summary>
    /// Daily production/stock schedule for condom project batches
    /// </summary>
    public class CondomProductionSchedule
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Scent { get; set; } = string.Empty;  // Vanilla, Strawberry, Banana, Grape

        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty;    // Female, Male

        [Required]
        [MaxLength(30)]
        public string BatchCode { get; set; } = string.Empty; // F1K 2501, PG 2555, etc.

        [Required]
        [MaxLength(20)]
        public string UOM { get; set; } = "CASES";           // BOXES, CASES

        public DateTime ScheduleDate { get; set; }

        public int Quantity { get; set; }

        [MaxLength(50)]
        public string? QuantityNote { get; set; }  // For entries like "10 boxes", "24+20 BOX"

        [MaxLength(20)]
        public string? ScentGroup { get; set; }  // Groups batches under a scent header

        public int SortOrder { get; set; }  // For display ordering

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
