using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class CustomerContract
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string ContractNumber { get; set; } = string.Empty;

        public int CustomerId { get; set; }

        [MaxLength(200)]
        public string? ContractName { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Active"; // Draft, Active, Expired, Terminated

        // Pricing Terms
        public decimal? MonthlyValue { get; set; }
        public decimal? TotalValue { get; set; }

        [MaxLength(50)]
        public string? BillingFrequency { get; set; } // Monthly, Quarterly, Per Delivery

        // Rate Information
        public decimal? RatePerKm { get; set; }
        public decimal? RatePerLoad { get; set; }
        public decimal? MinimumCharge { get; set; }

        [MaxLength(1000)]
        public string? Terms { get; set; }

        [MaxLength(500)]
        public string? DocumentUrl { get; set; }

        [MaxLength(100)]
        public string? SignedBy { get; set; }

        public DateTime? SignedDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("CustomerId")]
        public virtual Customer Customer { get; set; } = null!;
    }
}
