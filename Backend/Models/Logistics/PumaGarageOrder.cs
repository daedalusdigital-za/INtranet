using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// A fuel fill-up captured from the Puma Garage (Bronkhorstspruit, GP) via
    /// Rocket Freight. Puma Garage is used as an alternative fuel source to TFN.
    /// Mirrors the "ROCKET FREIGHT / PUMA GARAGE" monthly sheet.
    /// </summary>
    public class PumaGarageOrder
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Order/reference number, e.g. ROCF092.</summary>
        [Required]
        [StringLength(50)]
        public string OrderNumber { get; set; } = string.Empty;

        [StringLength(150)]
        public string? DriverName { get; set; }

        /// <summary>Vehicle class, e.g. 8 TON, 14 TON, LINK, CAR, FORKLIFT.</summary>
        [StringLength(50)]
        public string? VehicleType { get; set; }

        [StringLength(50)]
        public string? Registration { get; set; }

        /// <summary>Tank capacity in litres (null when non-numeric, e.g. "OIL X 10").</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? Capacity { get; set; }

        /// <summary>Litres actually filled.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? LitersFilled { get; set; }

        /// <summary>Rand value of the fill.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? Value { get; set; }

        public DateTime? Date { get; set; }

        /// <summary>Optional month/period label from the source sheet, e.g. "MARCH 2026".</summary>
        [StringLength(50)]
        public string? Period { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }

        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
