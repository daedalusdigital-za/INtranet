using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Represents an invoice imported from an external ERP/accounting system
    /// Used to create trip sheets and loads in the logistics module
    /// </summary>
    public class ImportedInvoice
    {
        [Key]
        public int Id { get; set; }

        // Customer Information
        [Required]
        [MaxLength(50)]
        public string CustomerNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string CustomerName { get; set; } = string.Empty;

        // Product Information
        [Required]
        [MaxLength(50)]
        public string ProductCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string ProductDescription { get; set; } = string.Empty;

        // Transaction Information
        public int Year { get; set; }

        [MaxLength(10)]
        public string Period { get; set; } = string.Empty; // PRD field

        [MaxLength(10)]
        public string TransactionType { get; set; } = string.Empty; // IN, CR, etc.

        public DateTime TransactionDate { get; set; }

        [Required]
        [MaxLength(50)]
        public string TransactionNumber { get; set; } = string.Empty;

        // Classification
        public int? Category { get; set; }
        public int? Location { get; set; }

        // Financial Information
        [Column(TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SalesAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SalesReturns { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal CostOfSales { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal? MarginPercent { get; set; }

        // Computed Properties
        [Column(TypeName = "decimal(18,2)")]
        public decimal NetSales => SalesAmount - SalesReturns;

        [Column(TypeName = "decimal(18,2)")]
        public decimal GrossProfit => NetSales - CostOfSales;

        // Processing Status
        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Assigned, InProgress, Delivered, Cancelled

        // Link to Load/Trip Sheet (when assigned)
        public int? LoadId { get; set; }

        // Link to internal customer (when matched)
        public int? CustomerId { get; set; }

        // Delivery Information (filled when creating trip sheet)
        [MaxLength(500)]
        public string? DeliveryAddress { get; set; }

        [MaxLength(100)]
        public string? DeliveryCity { get; set; }

        [MaxLength(50)]
        public string? DeliveryProvince { get; set; }

        [MaxLength(20)]
        public string? DeliveryPostalCode { get; set; }

        [MaxLength(100)]
        public string? ContactPerson { get; set; }

        [MaxLength(50)]
        public string? ContactPhone { get; set; }

        [MaxLength(100)]
        public string? ContactEmail { get; set; }

        // Scheduling
        public DateTime? ScheduledDeliveryDate { get; set; }

        [MaxLength(500)]
        public string? DeliveryNotes { get; set; }

        // Import Tracking
        public DateTime ImportedAt { get; set; } = DateTime.UtcNow;

        public int? ImportedByUserId { get; set; }

        [MaxLength(100)]
        public string? ImportBatchId { get; set; }

        [MaxLength(200)]
        public string? SourceSystem { get; set; }

        // Company/Division that owns this invoice
        [MaxLength(10)]
        public string? SourceCompany { get; set; } // PMT, ACM, PHT, SBT

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation Properties
        [ForeignKey("LoadId")]
        public virtual Load? Load { get; set; }

        [ForeignKey("CustomerId")]
        public virtual Customer? Customer { get; set; }

        [ForeignKey("ImportedByUserId")]
        public virtual Models.User? ImportedByUser { get; set; }
    }

    /// <summary>
    /// Represents a batch of imported invoices for tracking purposes
    /// </summary>
    public class ImportBatch
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string BatchId { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? FileName { get; set; }

        [MaxLength(200)]
        public string? SourceSystem { get; set; }

        public int TotalRecords { get; set; }
        public int SuccessfulRecords { get; set; }
        public int FailedRecords { get; set; }

        public int? ImportedByUserId { get; set; }

        public DateTime ImportedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(1000)]
        public string? Notes { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Completed"; // InProgress, Completed, PartialFailure, Failed

        // Navigation Properties
        [ForeignKey("ImportedByUserId")]
        public virtual Models.User? ImportedByUser { get; set; }
    }
}
