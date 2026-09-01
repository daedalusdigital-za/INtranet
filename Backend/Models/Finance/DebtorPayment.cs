using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    /// <summary>
    /// A collection / receipt recorded against a customer's sales balance.
    /// Debtors (Accounts Receivable) are derived from imported ERP sales
    /// transactions (net sales per customer). Since those transactions carry
    /// no settlement flag, we track money actually collected here. A customer's
    /// outstanding balance = net sales - sum of collections.
    /// Scoped per source company (PMT / ACM / PHT / SBT) so each division's
    /// receivables are settled independently.
    /// </summary>
    public class DebtorPayment
    {
        [Key]
        public int Id { get; set; }

        /// <summary>ERP customer number this collection applies to.</summary>
        [Required]
        [MaxLength(50)]
        public string CustomerNumber { get; set; } = string.Empty;

        /// <summary>Snapshot of the customer name at time of capture.</summary>
        [MaxLength(200)]
        public string? CustomerName { get; set; }

        /// <summary>Owning company/division code: PMT, ACM, PHT, SBT.</summary>
        [MaxLength(10)]
        public string? SourceCompany { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

        /// <summary>EFT, Cash, Cheque, Card, DebitOrder, Other.</summary>
        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        [MaxLength(100)]
        public string? PaymentReference { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public int? RecordedByUserId { get; set; }

        [MaxLength(150)]
        public string? RecordedByName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
