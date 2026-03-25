using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Projects
{
    /// <summary>
    /// Stock received (GRV/GRN) record for sanitary pads project
    /// </summary>
    public class PadsStockReceived
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string VendorName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string GrnNumber { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? ItemCode { get; set; }

        [MaxLength(200)]
        public string ItemDescription { get; set; } = "SANITARY PADS";

        [MaxLength(100)]
        public string? Reference { get; set; }

        [MaxLength(100)]
        public string? InvoiceNumber { get; set; }

        [MaxLength(50)]
        public string? Location { get; set; }

        public DateTime InvoiceDate { get; set; }

        [MaxLength(20)]
        public string UOM { get; set; } = "BOX";

        public int QuantityReceived { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SubTotal { get; set; }

        public int? Quarter { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }

    /// <summary>
    /// Stock delivered/dispatched to clients
    /// </summary>
    public class PadsStockDelivered
    {
        [Key]
        public int Id { get; set; }

        [MaxLength(100)]
        public string? DeliveryReference { get; set; }

        [MaxLength(100)]
        public string? InvoiceNumber { get; set; }

        public int QuantityDelivered { get; set; }

        [MaxLength(20)]
        public string UOM { get; set; } = "BOX";

        public int Quarter { get; set; }

        public DateTime DeliveryDate { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Warehouse stock on hand snapshot
    /// </summary>
    public class PadsWarehouseStock
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string WarehouseName { get; set; } = string.Empty;

        [MaxLength(20)]
        public string StockType { get; set; } = "System"; // System, Physical

        public int Quantity { get; set; }

        [MaxLength(20)]
        public string UOM { get; set; } = "BOX";

        public bool IsDamaged { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime SnapshotDate { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Credit notes issued against deliveries
    /// </summary>
    public class PadsCreditNote
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string CreditNoteNumber { get; set; } = string.Empty;

        public DateTime CreditDate { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Amount { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Invoice processed against deliveries
    /// </summary>
    public class PadsInvoiceProcessed
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string InvoiceReference { get; set; } = string.Empty;

        public DateTime InvoiceDate { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Amount { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
