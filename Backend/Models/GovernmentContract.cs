using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models;

/// <summary>
/// Represents a government tender contract held by one of our operating companies
/// </summary>
public class GovernmentContract
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// The company that holds this contract (PMT, ACM, PHT, SBT)
    /// </summary>
    [Required]
    [MaxLength(10)]
    public string CompanyCode { get; set; } = string.Empty;

    /// <summary>
    /// Full company name
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string CompanyName { get; set; } = string.Empty;

    /// <summary>
    /// Tender reference number (e.g., RT32-2019, RT75-2025)
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string TenderNumber { get; set; } = string.Empty;

    /// <summary>
    /// Description of goods/services covered by this tender
    /// </summary>
    [Required]
    [MaxLength(255)]
    public string Commodity { get; set; } = string.Empty;

    /// <summary>
    /// Contract duration in years
    /// </summary>
    public int ContractDurationYears { get; set; }

    /// <summary>
    /// Contract start date
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// Contract expiry date
    /// </summary>
    public DateTime? ExpiryDate { get; set; }

    /// <summary>
    /// Whether the contract is currently active
    /// </summary>
    public bool IsActive { get; set; }

    /// <summary>
    /// Contract status: Active, Expired, Expiring Soon, Pending
    /// </summary>
    [MaxLength(50)]
    public string Status { get; set; } = "Active";

    /// <summary>
    /// Government department or entity that issued the tender
    /// </summary>
    [MaxLength(255)]
    public string? IssuingAuthority { get; set; }

    /// <summary>
    /// Additional notes or comments
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Estimated annual contract value
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? EstimatedAnnualValue { get; set; }

    /// <summary>
    /// Category for grouping (Medical Supplies, PPE, Dental, etc.)
    /// </summary>
    [MaxLength(100)]
    public string? Category { get; set; }

    /// <summary>
    /// When this record was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When this record was last updated
    /// </summary>
    public DateTime? UpdatedAt { get; set; }
}
