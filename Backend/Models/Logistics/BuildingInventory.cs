using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ProjectTracker.API.Models.Logistics;

/// <summary>
/// Live inventory per building - real-time stock levels
/// This replaces snapshots for daily operations
/// </summary>
[Index(nameof(BuildingId), nameof(ItemCode), IsUnique = true, Name = "UQ_BuildingInventory_Building_Item")]
[Index(nameof(BuildingId), Name = "IX_BuildingInventory_BuildingId")]
[Index(nameof(ItemCode), Name = "IX_BuildingInventory_ItemCode")]
public class BuildingInventory
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// The building this inventory belongs to
    /// </summary>
    [Required]
    public int BuildingId { get; set; }

    /// <summary>
    /// Item/Product code
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
    /// Unit of Measure
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Uom { get; set; } = "Each";

    /// <summary>
    /// Current quantity on hand
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal QuantityOnHand { get; set; }

    /// <summary>
    /// Quantity reserved for sales orders
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal QuantityReserved { get; set; }

    /// <summary>
    /// Quantity on purchase order (incoming)
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal QuantityOnOrder { get; set; }

    /// <summary>
    /// Computed: QuantityOnHand - QuantityReserved
    /// </summary>
    [NotMapped]
    public decimal QuantityAvailable => QuantityOnHand - QuantityReserved;

    /// <summary>
    /// Minimum stock level before reorder
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? ReorderLevel { get; set; }

    /// <summary>
    /// Maximum stock level
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? MaxLevel { get; set; }

    /// <summary>
    /// Unit cost
    /// </summary>
    [Column(TypeName = "decimal(18,6)")]
    public decimal? UnitCost { get; set; }

    /// <summary>
    /// Physical bin/shelf location in the building
    /// </summary>
    [MaxLength(50)]
    public string? BinLocation { get; set; }

    /// <summary>
    /// Last time stock moved (in or out)
    /// </summary>
    public DateTime? LastMovementDate { get; set; }

    /// <summary>
    /// Last physical count date
    /// </summary>
    public DateTime? LastCountDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(BuildingId))]
    public virtual WarehouseBuilding? Building { get; set; }
}
