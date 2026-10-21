using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class StockIssue
    {
        public int Id { get; set; }

        public int? WarehouseId { get; set; }
        [ForeignKey("WarehouseId")]
        public Warehouse? Warehouse { get; set; }

        [MaxLength(100)]
        public string? Company { get; set; }

        [MaxLength(100)]
        public string? ItemCode { get; set; }

        [MaxLength(500)]
        public string? ItemDescription { get; set; }

        [MaxLength(200)]
        public string IssueType { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Detail { get; set; }

        public DateTime? IssueDate { get; set; }

        [MaxLength(30)]
        public string Status { get; set; } = "Open"; // Open | InProgress | Resolved | Dismissed

        [MaxLength(2000)]
        public string? Resolution { get; set; }

        [MaxLength(200)]
        public string? ResolvedBy { get; set; }
        public DateTime? ResolvedAt { get; set; }

        [MaxLength(200)]
        public string? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(30)]
        public string Source { get; set; } = "Manual"; // Import | Manual
    }
}
