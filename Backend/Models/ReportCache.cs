using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// Stores previously generated reports so identical requests return instantly.
    /// Key = SHA256(ReportType + FromDate + ToDate + extra params).
    /// Auto-invalidated when new invoice data is imported.
    /// </summary>
    public class ReportCache
    {
        [Key]
        public int Id { get; set; }

        /// <summary>SHA256 hash of the cache key (ReportType|FromDate|ToDate|Params)</summary>
        [Required]
        [MaxLength(64)]
        public string CacheKey { get; set; } = string.Empty;

        /// <summary>Report type: sales-summary, customer-analysis, province-breakdown, product-performance, daily-dispatch, invoice-summary</summary>
        [Required]
        [MaxLength(50)]
        public string ReportType { get; set; } = string.Empty;

        /// <summary>Start of the reporting period</summary>
        public DateTime FromDate { get; set; }

        /// <summary>End of the reporting period</summary>
        public DateTime ToDate { get; set; }

        /// <summary>Any additional parameters that affect the report (JSON serialized)</summary>
        [MaxLength(500)]
        public string? Parameters { get; set; }

        /// <summary>The full report response serialized as JSON (charts + summary + analysis)</summary>
        [Required]
        [Column(TypeName = "nvarchar(max)")]
        public string ResultJson { get; set; } = string.Empty;

        /// <summary>When this report was generated</summary>
        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

        /// <summary>When this cache entry expires (stale after this time)</summary>
        public DateTime ExpiresAt { get; set; }

        /// <summary>How long the original report took to generate (ms) — shows the user what they're saving</summary>
        public int GenerationTimeMs { get; set; }

        /// <summary>How many times this cached report has been served</summary>
        public int HitCount { get; set; }

        /// <summary>Last time this cached report was served</summary>
        public DateTime? LastAccessedAt { get; set; }

        /// <summary>Size of ResultJson in bytes for monitoring</summary>
        public long ResultSizeBytes { get; set; }

        /// <summary>Who requested the report (for audit trail)</summary>
        [MaxLength(100)]
        public string? GeneratedBy { get; set; }
    }
}
