using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class Customer
    {
        [Key]
        public int Id { get; set; }

        [MaxLength(50)]
        public string? CustomerCode { get; set; } // External customer reference/number (maps to CustomerNumber from ERP)

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty; // Maps to Description from ERP

        [MaxLength(50)]
        public string? ShortName { get; set; } // Short name from ERP

        [MaxLength(100)]
        public string? CompanyRegistration { get; set; }

        [MaxLength(50)]
        public string? VatNumber { get; set; } // Maps to VatNo from ERP

        // Contact Information
        [MaxLength(100)]
        public string? ContactPerson { get; set; } // Maps to Contact from ERP

        [MaxLength(100)]
        public string? Email { get; set; }

        [MaxLength(100)]
        public string? ContactEmail { get; set; } // Separate contact email from ERP

        [MaxLength(50)]
        public string? PhoneNumber { get; set; } // Maps to Phone from ERP

        [MaxLength(50)]
        public string? MobileNumber { get; set; }

        [MaxLength(50)]
        public string? Fax { get; set; } // Fax from ERP

        [MaxLength(50)]
        public string? ContactPhone { get; set; } // Contact's direct phone from ERP

        [MaxLength(50)]
        public string? ContactFax { get; set; } // Contact's fax from ERP

        // Physical/Billing Address
        [MaxLength(500)]
        public string? Address { get; set; }

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

        // Address lines stored as JSON for ERP compatibility
        [Column(TypeName = "nvarchar(max)")]
        public string? AddressLinesJson { get; set; }

        // Delivery Address (if different from physical)
        [MaxLength(500)]
        public string? DeliveryAddress { get; set; }

        [MaxLength(100)]
        public string? DeliveryCity { get; set; }

        [MaxLength(100)]
        public string? DeliveryProvince { get; set; }

        [MaxLength(20)]
        public string? DeliveryPostalCode { get; set; }

        // Business Details
        [MaxLength(50)]
        public string Status { get; set; } = "Active"; // Active, Inactive, Suspended

        [MaxLength(50)]
        public string? PaymentTerms { get; set; } // e.g., "Net 30", "COD", etc.

        public decimal? CreditLimit { get; set; }

        // ERP Sync tracking
        public DateTime? LastMaintained { get; set; } // Last maintained date from ERP

        [MaxLength(100)]
        public string? SourceSystem { get; set; } // Source system identifier

        [MaxLength(100)]
        public string? ImportBatchId { get; set; } // Batch ID when imported

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<Load> Loads { get; set; } = new List<Load>();
        public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public virtual ICollection<CustomerContract> Contracts { get; set; } = new List<CustomerContract>();
        public virtual ICollection<ImportedInvoice> ImportedInvoices { get; set; } = new List<ImportedInvoice>();
    }
}
