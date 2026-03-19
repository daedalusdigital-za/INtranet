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

    public class CreateCondomSampleDto
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

        [Required]
        [Range(1, int.MaxValue)]
        public int Quantity { get; set; }

        [Required]
        public DateTime DateSent { get; set; }

        [MaxLength(30)]
        public string Status { get; set; } = "Pending";

        [MaxLength(100)]
        public string? Recipient { get; set; }

        [MaxLength(250)]
        public string? Notes { get; set; }
    }

    public class CreateCondomArtworkDto
    {
        [Required]
        [MaxLength(50)]
        public string Scent { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(30)]
        public string Status { get; set; } = "Draft";

        [MaxLength(50)]
        public string? Version { get; set; }

        [MaxLength(100)]
        public string? Designer { get; set; }

        [MaxLength(250)]
        public string? Notes { get; set; }
    }

    public class UpdateStatusDto
    {
        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = string.Empty;
    }
}
