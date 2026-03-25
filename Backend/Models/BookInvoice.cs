using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class BookInvoice
    {
        [Key]
        public int Id { get; set; }

        // Supplier / Vendor Info
        [Required]
        [MaxLength(500)]
        public string SupplierName { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? SupplierAccount { get; set; }

        // Invoice Details
        [MaxLength(200)]
        public string? InvoiceNumber { get; set; }

        public DateTime InvoiceDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? VatAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? SubTotal { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        // Payment Info
        public DateTime? PaymentDate { get; set; }

        [MaxLength(100)]
        public string? PaymentMethod { get; set; }

        [MaxLength(200)]
        public string? PaymentReference { get; set; }

        // Categorization
        [MaxLength(200)]
        public string? Category { get; set; }

        [MaxLength(200)]
        public string? CompanyName { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        // File Storage
        [Required]
        [MaxLength(500)]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? OriginalFileName { get; set; }

        [MaxLength(100)]
        public string ContentType { get; set; } = "application/pdf";

        public long FileSize { get; set; }

        [MaxLength(64)]
        public string? FileHash { get; set; }

        // Extracted text from PDF (for search)
        public string? ExtractedText { get; set; }

        // Status: Draft (just uploaded, pending confirmation), Confirmed, Archived
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Draft";

        // Department Scoping
        [Required]
        public int DepartmentId { get; set; }

        [ForeignKey("DepartmentId")]
        public Department? Department { get; set; }

        // Audit
        [Required]
        public int UploadedByUserId { get; set; }

        [ForeignKey("UploadedByUserId")]
        public User? UploadedByUser { get; set; }

        [MaxLength(200)]
        public string? UploadedByName { get; set; }

        public int? ConfirmedByUserId { get; set; }

        [ForeignKey("ConfirmedByUserId")]
        public User? ConfirmedByUser { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ConfirmedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
