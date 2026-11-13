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

        /// <summary>Fleet vehicle matched by registration (null when not on the fleet list).</summary>
        public int? VehicleId { get; set; }

        /// <summary>Driver record matched by name / vehicle assignment (null when ambiguous or unknown).</summary>
        public int? DriverId { get; set; }

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

        /// <summary>"Open" until the filled slip photo is uploaded and the order is closed; then "Closed".</summary>
        [StringLength(20)]
        public string Status { get; set; } = "Open";

        /// <summary>Original file name of the slip photo (jpg/png) proving the fill.</summary>
        [StringLength(260)]
        public string? SlipFileName { get; set; }

        /// <summary>Stored file name under uploads/puma-slips.</summary>
        [StringLength(260)]
        public string? SlipStoredFileName { get; set; }

        [StringLength(100)]
        public string? SlipContentType { get; set; }

        public DateTime? SlipUploadedAt { get; set; }
        public int? SlipUploadedByUserId { get; set; }

        public DateTime? ClosedAt { get; set; }
        public int? ClosedByUserId { get; set; }

        [StringLength(150)]
        public string? ClosedByName { get; set; }

        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
