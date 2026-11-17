using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance.Creditors;

/// <summary>
/// One upload of a Sage 300 "A/P Aged Payables by Due Date" (APAPAYSY) summary for a paying company.
/// Kept as a dated snapshot so months can be compared; the newest snapshot per company feeds the
/// supplier picker on payment packs.
/// </summary>
public class ApAgingSnapshot
{
    [Key] public int Id { get; set; }
    [Required, MaxLength(10)] public string CompanyCode { get; set; } = "";
    /// <summary>Company name as printed on the report (e.g. "Promed Pharmatech").</summary>
    [MaxLength(120)] public string? ReportCompany { get; set; }
    public DateTime AsOfDate { get; set; }
    [MaxLength(255)] public string? SourceFileName { get; set; }
    public int UploadedByUserId { get; set; }
    [MaxLength(150)] public string? UploadedByName { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public int VendorCount { get; set; }
    /// <summary>Vendors with a non-zero balance.</summary>
    public int ActiveVendorCount { get; set; }
    public decimal TotalCurrent { get; set; }
    public decimal TotalOverdue { get; set; }
    public decimal TotalPayables { get; set; }
    [MaxLength(500)] public string? Notes { get; set; }

    public virtual ICollection<ApAgingVendor> Vendors { get; set; } = new List<ApAgingVendor>();
}

/// <summary>One vendor row off the aged payables report: Current / 1–30 / 31–60 / 61–90 / Over 90.</summary>
public class ApAgingVendor
{
    [Key] public int Id { get; set; }
    [Required] public int SnapshotId { get; set; }
    [Required, MaxLength(50)] public string VendorCode { get; set; } = "";
    [Required, MaxLength(255)] public string VendorName { get; set; } = "";
    [MaxLength(5)] public string? Currency { get; set; }
    public decimal Current { get; set; }
    public decimal Days30 { get; set; }
    public decimal Days60 { get; set; }
    public decimal Days90 { get; set; }
    public decimal Over90 { get; set; }
    public decimal Overdue { get; set; }
    public decimal Total { get; set; }

    [ForeignKey(nameof(SnapshotId))] public virtual ApAgingSnapshot? Snapshot { get; set; }
}
