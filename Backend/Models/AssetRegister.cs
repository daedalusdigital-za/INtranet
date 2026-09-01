using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    [Table("AssetRegisterLocations")]
    public class AssetRegisterLocation
    {
        [Key]
        public int LocationId { get; set; }

        [Required, MaxLength(100)]
        public string Region { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? SubLocation { get; set; }

        [Required, MaxLength(150)]
        public string DisplayName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? SourceFile { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<AssetRegisterItem> Items { get; set; } = new List<AssetRegisterItem>();
    }

    [Table("AssetRegisterItems")]
    public class AssetRegisterItem
    {
        [Key]
        public int ItemId { get; set; }

        public int LocationId { get; set; }

        [ForeignKey("LocationId")]
        public virtual AssetRegisterLocation? Location { get; set; }

        [MaxLength(50)]
        public string? AssetCode { get; set; }

        [MaxLength(150)]
        public string? AssignedTo { get; set; }

        [MaxLength(150)]
        public string? Workstation { get; set; }

        [Required, MaxLength(100)]
        public string Category { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Manufacturer { get; set; }

        [MaxLength(255)]
        public string? Model { get; set; }

        [MaxLength(255)]
        public string? SerialNumber { get; set; }

        [MaxLength(255)]
        public string? Specification { get; set; }

        // ── Invoice linkage (links an asset to a Books BookInvoice) ──────────
        [MaxLength(100)]
        public string? InvoiceNumber { get; set; }

        public int? BookInvoiceId { get; set; }

        [MaxLength(50)]
        public string? Condition { get; set; } = "Not Assessed";

        // Monetary value of the asset (e.g. purchase/book value)
        [Column(TypeName = "decimal(12,2)")]
        public decimal? Value { get; set; }

        // Current market value of the asset (for comparison against book value)
        [Column(TypeName = "decimal(12,2)")]
        public decimal? MarketValue { get; set; }

        [MaxLength(50)]
        public string? OwnershipType { get; set; } = "Assigned";

        [MaxLength(500)]
        public string? Notes { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
