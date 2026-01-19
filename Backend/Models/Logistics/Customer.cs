using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Logistics
{
    public class Customer
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? CompanyRegistration { get; set; }

        [MaxLength(50)]
        public string? VatNumber { get; set; }

        // Contact Information
        [MaxLength(100)]
        public string? ContactPerson { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        [MaxLength(20)]
        public string? MobileNumber { get; set; }

        // Address
        [MaxLength(500)]
        public string? PhysicalAddress { get; set; }

        [MaxLength(500)]
        public string? PostalAddress { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(20)]
        public string? PostalCode { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        [MaxLength(100)]
        public string? Country { get; set; } = "South Africa";

        // Business Details
        [MaxLength(50)]
        public string Status { get; set; } = "Active"; // Active, Inactive, Suspended

        [MaxLength(50)]
        public string? PaymentTerms { get; set; } // e.g., "Net 30", "COD", etc.

        public decimal? CreditLimit { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<Load> Loads { get; set; } = new List<Load>();
        public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public virtual ICollection<CustomerContract> Contracts { get; set; } = new List<CustomerContract>();
    }
}
