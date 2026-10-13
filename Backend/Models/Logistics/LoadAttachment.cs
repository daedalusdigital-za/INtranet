using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics;

/// <summary>
/// File attachments linked to a Load / trip sheet.
/// Captures the imported Excel plus the generated trip sheet and picking slip PDFs,
/// and allows additional manual uploads later.
/// </summary>
public class LoadAttachment
{
    [Key]
    public int Id { get; set; }

    public int LoadId { get; set; }

    /// <summary>Original file name shown to users.</summary>
    [Required]
    [MaxLength(500)]
    public string FileName { get; set; } = string.Empty;

    /// <summary>Unique stored file name on disk.</summary>
    [Required]
    [MaxLength(500)]
    public string StoredFileName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ContentType { get; set; }

    public long FileSize { get; set; }

    /// <summary>ImportExcel | TripSheet | PickingSlip | Other</summary>
    [MaxLength(50)]
    public string Category { get; set; } = "Other";

    [MaxLength(200)]
    public string? UploadedBy { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(LoadId))]
    public Load? Load { get; set; }
}
