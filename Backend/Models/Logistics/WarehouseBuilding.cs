using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics;

/// <summary>
/// Represents a physical building within a warehouse/province location
/// Example: KZN has 2 buildings (KZN-1, KZN-2), GP has 5 buildings
/// </summary>
public class WarehouseBuilding
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Parent warehouse (province level)
    /// </summary>
    [Required]
    public int WarehouseId { get; set; }

    /// <summary>
    /// Unique code for the building (e.g., KZN-1, GP-3)
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Building name
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Building address
    /// </summary>
    [MaxLength(500)]
    public string? Address { get; set; }

    /// <summary>
    /// Building manager name
    /// </summary>
    [MaxLength(200)]
    public string? ManagerName { get; set; }

    /// <summary>
    /// Contact phone number
    /// </summary>
    [MaxLength(50)]
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Total storage capacity in units
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? TotalCapacity { get; set; }

    /// <summary>
    /// Available storage capacity in units
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? AvailableCapacity { get; set; }

    /// <summary>
    /// Whether the building is active
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(WarehouseId))]
    public virtual Warehouse? Warehouse { get; set; }

    public virtual ICollection<BuildingInventory> Inventory { get; set; } = new List<BuildingInventory>();
}
