using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    public class PurchaseOrder
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string PoNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        public string SupplierName { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? SupplierContact { get; set; }

        [MaxLength(500)]
        public string? SupplierEmail { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        // Status: Draft, Submitted, Approved, Rejected, Ordered, PartiallyReceived, Received, Cancelled
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Draft";

        [Column(TypeName = "decimal(18,2)")]
        public decimal SubTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal VatAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        public int? CategoryId { get; set; }

        [ForeignKey("CategoryId")]
        public FinanceCategory? Category { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        public DateTime OrderDate { get; set; } = DateTime.UtcNow;

        public DateTime? ExpectedDeliveryDate { get; set; }

        public DateTime? ReceivedDate { get; set; }

        [MaxLength(200)]
        public string? RequestedBy { get; set; }

        [MaxLength(200)]
        public string? ApprovedBy { get; set; }

        public DateTime? ApprovedDate { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        [MaxLength(500)]
        public string? DeliveryAddress { get; set; }

        // File attachment
        [MaxLength(500)]
        public string? AttachmentPath { get; set; }

        [MaxLength(255)]
        public string? AttachmentFileName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
    }

    public class PurchaseOrderItem
    {
        [Key]
        public int Id { get; set; }

        public int PurchaseOrderId { get; set; }

        [ForeignKey("PurchaseOrderId")]
        public PurchaseOrder? PurchaseOrder { get; set; }

        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? ProductCode { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; }

        [MaxLength(50)]
        public string? Unit { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTotal { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal? ReceivedQuantity { get; set; }
    }
}
