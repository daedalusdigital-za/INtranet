using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Hr
{
    /// <summary>
    /// Master HR employee registry. Unlike the biometric <c>empregistration</c> table
    /// (which only covers the Main Office clock-in system) this table is the single,
    /// writable source of truth for HR across EVERY site and company that reports to
    /// HR — Main Office, Security, Condom Factory, Sanitary Pads, and the branches
    /// (New Road, Cape Town, Bronkhorspruit, Port Elizabeth) as well as Logistics
    /// drivers. HR can search, view, edit and attach documents/contracts here.
    /// </summary>
    [Table("HrEmployees")]
    public class HrEmployee
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        /// <summary>Company/site payroll or clock-in number (may be blank for new hires).</summary>
        [MaxLength(50)]
        public string? EmployeeNumber { get; set; }

        /// <summary>SA ID number (13 digits) or national ID.</summary>
        [MaxLength(50)]
        public string? IdNumber { get; set; }

        /// <summary>Passport number for non-SA employees.</summary>
        [MaxLength(50)]
        public string? PassportNumber { get; set; }

        [MaxLength(60)]
        public string? Nationality { get; set; } = "South African";

        /// <summary>Which site/company this person works at. See HrSites constants.</summary>
        [Required]
        [MaxLength(60)]
        public string Site { get; set; } = "Main Office";

        [MaxLength(100)]
        public string? Department { get; set; }

        [MaxLength(100)]
        public string? JobTitle { get; set; }

        /// <summary>Permanent, Contract, Temporary, Internship.</summary>
        [MaxLength(30)]
        public string EmploymentType { get; set; } = "Permanent";

        /// <summary>Active, On Leave, Serving Notice, Suspended, Terminated.</summary>
        [MaxLength(30)]
        public string Status { get; set; } = "Active";

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        [MaxLength(150)]
        public string? Email { get; set; }

        [MaxLength(250)]
        public string? Address { get; set; }

        [MaxLength(120)]
        public string? EmergencyContactName { get; set; }

        [MaxLength(20)]
        public string? EmergencyContactPhone { get; set; }

        public DateTime? DateOfBirth { get; set; }
        public DateTime? HireDate { get; set; }

        /// <summary>Contract end date (for Contract/Temporary staff); drives expiry alerts.</summary>
        public DateTime? ContractEndDate { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        /// <summary>Where this record was first sourced from: Manual, Biometric, Logistics.</summary>
        [MaxLength(30)]
        public string Source { get; set; } = "Manual";

        /// <summary>Link back to the biometric empid when sourced from empregistration.</summary>
        [MaxLength(50)]
        public string? BiometricEmpId { get; set; }

        /// <summary>Link back to the logistics Drivers.Id when sourced from Logistics.</summary>
        public int? DriverId { get; set; }

        /// <summary>Relative path to the profile photo file on disk.</summary>
        [MaxLength(500)]
        public string? ProfilePhotoPath { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [MaxLength(150)]
        public string? CreatedByName { get; set; }

        [MaxLength(150)]
        public string? UpdatedByName { get; set; }

        public virtual ICollection<HrEmployeeDocument> Documents { get; set; } = new List<HrEmployeeDocument>();
    }

    /// <summary>Canonical list of sites/companies that report to HR.</summary>
    public static class HrSites
    {
        public const string MainOffice = "Main Office";
        public const string Security = "Security";
        public const string CondomFactory = "Condom Factory";
        public const string SanitaryPads = "Sanitary Pads";
        public const string NewRoad = "New Road";
        public const string CapeTown = "Cape Town";
        public const string Bronkhorstspruit = "Bronkhorstspruit";
        public const string PortElizabeth = "Port Elizabeth";
        public const string Logistics = "Logistics";
        public const string Pharmacare = "Pharmacare";

        public static readonly string[] All =
        {
            MainOffice, Security, CondomFactory, SanitaryPads,
            NewRoad, CapeTown, Bronkhorstspruit, PortElizabeth, Logistics, Pharmacare
        };
    }

    /// <summary>Canonical company department list used across HR.</summary>
    public static class HrDepartments
    {
        public static readonly string[] All =
        {
            "Management",
            "Construction",
            "Logistics",
            "Security",
            "Sales",
            "Call Center",
            "IT&Marketing",
            "Tender",
            "Reception",
            "Admin",
            "Projects",
            "Finance",
            "Warehousing",
            "Mini Mart",
            "Cleaners"
        };
    }
}
