using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ProjectTracker.API.Models.Logistics;

/// <summary>
/// Tracks all stock movements - transfers, receipts, issues, adjustments
/// Provides complete audit trail for inventory changes
/// </summary>
[Index(nameof(FromBuildingId), Name = "IX_StockMovements_FromBuildingId")]
[Index(nameof(ToBuildingId), Name = "IX_StockMovements_ToBuildingId")]
[Index(nameof(ItemCode), Name = "IX_StockMovements_ItemCode")]
[Index(nameof(CreatedAt), Name = "IX_StockMovements_CreatedAt")]
public class StockMovement
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Type of movement: Transfer, Receipt, Issue, Adjustment, Count
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string MovementType { get; set; } = string.Empty;

    /// <summary>
    /// Source building (for transfers and issues)
    /// </summary>
    public int? FromBuildingId { get; set; }

    /// <summary>
    /// Destination building (for transfers and receipts)
    /// </summary>
    public int? ToBuildingId { get; set; }

    /// <summary>
    /// Item code being moved
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string ItemCode { get; set; } = string.Empty;

    /// <summary>
    /// Item description
    /// </summary>
    [MaxLength(500)]
    public string? ItemDescription { get; set; }

    /// <summary>
    /// Quantity moved (positive for in, negative for out on adjustments)
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal Quantity { get; set; }

    /// <summary>
    /// Unit of measure
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Uom { get; set; } = "Each";

    /// <summary>
    /// Reference number (PO#, SO#, Transfer#, etc)
    /// </summary>
    [MaxLength(100)]
    public string? Reference { get; set; }

    /// <summary>
    /// Additional notes
    /// </summary>
    [MaxLength(1000)]
    public string? Notes { get; set; }

    /// <summary>
    /// User who created this movement
    /// </summary>
    public int? CreatedById { get; set; }

    /// <summary>
    /// User name for display
    /// </summary>
    [MaxLength(200)]
    public string? CreatedByName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(FromBuildingId))]
    public virtual WarehouseBuilding? FromBuilding { get; set; }

    [ForeignKey(nameof(ToBuildingId))]
    public virtual WarehouseBuilding? ToBuilding { get; set; }
}

/// <summary>
/// Movement type constants
/// </summary>
public static class MovementTypes
{
    public const string Transfer = "Transfer";
    public const string Receipt = "Receipt";
    public const string Issue = "Issue";
    public const string Adjustment = "Adjustment";
    public const string Count = "Count";
}
