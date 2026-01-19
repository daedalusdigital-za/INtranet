using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class Invoice
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string InvoiceNumber { get; set; } = string.Empty;

        // Foreign Keys
        public int CustomerId { get; set; }
        public int? LoadId { get; set; }

        public DateTime InvoiceDate { get; set; } = DateTime.UtcNow;
        public DateTime DueDate { get; set; }

        // Amounts
        public decimal SubTotal { get; set; }
        public decimal? VatAmount { get; set; }
        public decimal Total { get; set; }

        public decimal AmountPaid { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Unpaid"; // Unpaid, Partially Paid, Paid, Overdue, Cancelled

        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        public DateTime? PaymentDate { get; set; }

        [MaxLength(100)]
        public string? PaymentReference { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("CustomerId")]
        public virtual Customer Customer { get; set; } = null!;

        [ForeignKey("LoadId")]
        public virtual Load? Load { get; set; }

        public virtual ICollection<InvoiceLineItem> LineItems { get; set; } = new List<InvoiceLineItem>();
    }
}
