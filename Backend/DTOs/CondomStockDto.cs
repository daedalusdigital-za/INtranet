using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.DTOs
{
    public class CreateCondomStockDto
    {
        [Required]
        [MaxLength(50)]
        public string Scent { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty;

        [Required]
        [MaxLength(30)]
        public string BatchCode { get; set; } = string.Empty;

        [MaxLength(20)]
        public string UOM { get; set; } = "CASES";

        [Required]
        public DateTime ScheduleDate { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1")]
        public int Quantity { get; set; }

        [MaxLength(50)]
        public string? QuantityNote { get; set; }
    }
}
