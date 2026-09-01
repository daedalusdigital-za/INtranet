using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    /// <summary>
    /// A recurring monthly financial commitment / debit order — e.g. fibre line,
    /// VoIP airtime, insurance, rent, software subscription. These are not one-off
    /// invoices; they repeat every period. The finance team keeps a living list of
    /// them so nothing is forgotten and monthly cash-flow is predictable.
    /// </summary>
    public class RecurringPayment
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Friendly name, e.g. "Fibre — Head Office", "VoIP Airtime".</summary>
        [Required]
        [MaxLength(300)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(300)]
        public string? Supplier { get; set; }

        /// <summary>Fibre, Airtime, VoIP, DebitOrder, Rent, Insurance, Subscription, Utility, Other.</summary>
        [MaxLength(100)]
        public string Category { get; set; } = "Other";

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        /// <summary>Monthly, Quarterly, Annually. Defaults to Monthly.</summary>
        [MaxLength(50)]
        public string Frequency { get; set; } = "Monthly";

        /// <summary>Day of the month the debit/payment goes off (1-31). Null = unspecified.</summary>
        public int? DayOfMonth { get; set; }

        /// <summary>Which department/company this commitment belongs to (e.g. IT).</summary>
        public int? DepartmentId { get; set; }

        [ForeignKey("DepartmentId")]
        public Department? Department { get; set; }

        [MaxLength(200)]
        public string? CompanyName { get; set; }

        /// <summary>Payment method label, e.g. Debit Order, EFT, Card.</summary>
        [MaxLength(100)]
        public string? PaymentMethod { get; set; }

        [MaxLength(200)]
        public string? AccountReference { get; set; }

        /// <summary>Active commitments are billed each period; inactive are paused/ended.</summary>
        public bool IsActive { get; set; } = true;

        public DateTime StartDate { get; set; } = DateTime.UtcNow;

        /// <summary>Optional end date after which the commitment stops.</summary>
        public DateTime? EndDate { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        // Audit
        public int? CreatedByUserId { get; set; }

        [MaxLength(200)]
        public string? CreatedByName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
