using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ProjectTracker.API.Models.Logistics;

/// <summary>
/// Stock on Hand snapshot data - represents inventory levels at a point in time
/// This is snapshot data, not a transaction ledger
/// </summary>
[Index(nameof(OperatingCompanyId), nameof(AsAtDate), nameof(Location), nameof(ItemCode), nameof(Uom), IsUnique = true, Name = "IX_StockOnHandSnapshot_Unique")]
[Index(nameof(OperatingCompanyId), nameof(AsAtDate), nameof(Location), nameof(ItemCode), Name = "IX_StockOnHandSnapshot_AsAtDate_Location_ItemCode")]
public class StockOnHandSnapshot
{
    [Key]
    public int StockSnapshotId { get; set; }

    /// <summary>
/// The Operating Company this stock belongs to
/// </summary>
[Required]
public int OperatingCompanyId { get; set; }

/// <summary>
    /// </summary>
    [Required]
    public DateTime AsAtDate { get; set; }

    /// <summary>
    /// Item code extracted from "Item Number-Description" (before first hyphen)
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string ItemCode { get; set; } = string.Empty;

    /// <summary>
    /// Item description extracted from "Item Number-Description" (after first hyphen)
    /// </summary>
    [MaxLength(500)]
    public string? ItemDescription { get; set; }

    /// <summary>
    /// Warehouse location (normalized: KZN, KZN 1, KZN 2, etc.)
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Location { get; set; } = string.Empty;

    /// <summary>
    /// Unit of Measure
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Uom { get; set; } = string.Empty;

    /// <summary>
    /// Quantity on Hand
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? QtyOnHand { get; set; }

    /// <summary>
    /// Quantity on Purchase Order
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? QtyOnPO { get; set; }

    /// <summary>
    /// Quantity on Sales Order
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? QtyOnSO { get; set; }

    /// <summary>
    /// Stock Available (from file, not computed)
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? StockAvailable { get; set; }

    /// <summary>
    /// Total Cost for Quantity on Hand
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? TotalCostForQOH { get; set; }

    /// <summary>
    /// Unit Cost for Quantity on Hand
    /// </summary>
    [Column(TypeName = "decimal(18,6)")]
    public decimal? UnitCostForQOH { get; set; }

    /// <summary>
    /// The import batch this record came from
    /// </summary>
    [MaxLength(50)]
    public string? ImportBatchId { get; set; }

    /// <summary>
    /// Row index from the original Excel file (for traceability)
    /// </summary>
    public int? RowIndex { get; set; }

    /// <summary>
    /// When this record was created/imported
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
