using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Projects
{
    /// <summary>
    /// Daily production/stock schedule for condom project batches
    /// </summary>
    public class CondomProductionSchedule
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Scent { get; set; } = string.Empty;  // Vanilla, Strawberry, Banana, Grape

        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty;    // Female, Male

        [Required]
        [MaxLength(30)]
        public string BatchCode { get; set; } = string.Empty; // F1K 2501, PG 2555, etc.

        [Required]
        [MaxLength(20)]
        public string UOM { get; set; } = "CASES";           // BOXES, CASES

        public DateTime ScheduleDate { get; set; }

        public int Quantity { get; set; }

        [MaxLength(50)]
        public string? QuantityNote { get; set; }  // For entries like "10 boxes", "24+20 BOX"

        [MaxLength(20)]
        public string? ScentGroup { get; set; }  // Groups batches under a scent header

        public int SortOrder { get; set; }  // For display ordering

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Delivery request for condom stock to be fulfilled by logistics
    /// </summary>
    public class CondomDeliveryRequest
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string ReferenceNumber { get; set; } = string.Empty; // Auto-generated DR-YYYYMMDD-NNN

        [Required]
        [MaxLength(50)]
        public string Department { get; set; } = "Condoms"; // Condoms, Sanitary Pads, etc.

        [MaxLength(50)]
        public string? Scent { get; set; }

        [MaxLength(20)]
        public string? Type { get; set; }

        [MaxLength(30)]
        public string? BatchCode { get; set; }

        [MaxLength(100)]
        public string? InvoiceNumber { get; set; }

        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty; // What is being requested

        public int Quantity { get; set; }

        [MaxLength(20)]
        public string UOM { get; set; } = "CASES";

        [MaxLength(200)]
        public string? DeliveryAddress { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        [Required]
        [MaxLength(20)]
        public string Priority { get; set; } = "Normal"; // Normal, Urgent

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Approved, In Transit, Delivered, Cancelled

        public DateTime RequestedDate { get; set; } = DateTime.UtcNow;

        [MaxLength(100)]
        public string? RequestedBy { get; set; }

        public DateTime? ApprovedDate { get; set; }

        public DateTime? DeliveredDate { get; set; }

        [MaxLength(100)]
        public string? HandledBy { get; set; }  // Logistics person

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
