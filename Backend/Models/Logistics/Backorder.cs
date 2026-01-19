using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class Backorder
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string BackorderNumber { get; set; } = string.Empty;

        // Foreign Keys
        public int InventoryId { get; set; }
        public int CustomerId { get; set; }

        public decimal QuantityOrdered { get; set; }
        public decimal QuantityFulfilled { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Partially Fulfilled, Fulfilled, Cancelled

        public DateTime OrderedDate { get; set; } = DateTime.UtcNow;
        public DateTime? ExpectedFulfillmentDate { get; set; }
        public DateTime? FulfilledDate { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("InventoryId")]
        public virtual WarehouseInventory Inventory { get; set; } = null!;

        [ForeignKey("CustomerId")]
        public virtual Customer Customer { get; set; } = null!;
    }
}
