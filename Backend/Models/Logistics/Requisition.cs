using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// A petty-cash / e-wallet requisition (Rocket Freight "Requisition Form").
    /// Captures who was paid, how much (e-wallet), the reason, and any portion
    /// that was diesel. Cancelled forms are kept for the audit trail but flagged.
    /// </summary>
    public class Requisition
    {
        [Key]
        public int Id { get; set; }

        /// <summary>RF number as written on the form. Kept as text because the
        /// source data can repeat a number across several line items (e.g. one
        /// RF covering multiple relocation payments) and can be blank.</summary>
        [StringLength(50)]
        public string? RfNumber { get; set; }

        /// <summary>Date on the form. Nullable for cancelled / blank rows.</summary>
        public DateTime? Date { get; set; }

        [StringLength(200)]
        public string? PaidTo { get; set; }

        [StringLength(100)]
        public string? CellNumber { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AmountEwallet { get; set; }

        [StringLength(1000)]
        public string? Reason { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DieselAmount { get; set; }

        /// <summary>Active or Cancelled.</summary>
        [StringLength(20)]
        public string Status { get; set; } = "Active";

        /// <summary>
        /// Finance payment workflow status, independent of the logistics
        /// Active/Cancelled state: Requested (awaiting payment), Paid, Rejected.
        /// </summary>
        [StringLength(20)]
        public string FinanceStatus { get; set; } = "Requested";

        /// <summary>When the requisition was marked paid by finance.</summary>
        public DateTime? PaidDate { get; set; }

        /// <summary>Optional finance note (e.g. rejection reason, payment ref).</summary>
        [StringLength(1000)]
        public string? FinanceNotes { get; set; }

        /// <summary>Originating department, e.g. "Logistics". Defaults to Logistics
        /// since that is currently the only source of requisitions.</summary>
        [StringLength(100)]
        public string? Department { get; set; } = "Logistics";

        /// <summary>Payment method label, e.g. E-Wallet, Bank Transfer, Cash.</summary>
        [StringLength(50)]
        public string? PaymentMethod { get; set; }

        // Denormalised period fields for fast month grouping (SAST calendar).
        public int PeriodYear { get; set; }
        public int PeriodMonth { get; set; }

        // Audit
        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
