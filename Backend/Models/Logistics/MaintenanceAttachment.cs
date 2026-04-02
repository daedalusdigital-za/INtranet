using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics;

/// <summary>
/// Stores file attachment metadata for vehicle maintenance records (invoices, payments, receipts, etc.).
/// </summary>
public class MaintenanceAttachment
{
    [Key]
    public int Id { get; set; }

    /// <summary>FK to VehicleMaintenance record.</summary>
    public int MaintenanceRecordId { get; set; }

    /// <summary>Original file name as uploaded by the user.</summary>
    [Required]
    [MaxLength(500)]
    public string FileName { get; set; } = string.Empty;

    /// <summary>Stored file name on disk (unique, to avoid collisions).</summary>
    [Required]
    [MaxLength(500)]
    public string StoredFileName { get; set; } = string.Empty;

    /// <summary>MIME content type (e.g. application/pdf, image/png).</summary>
    [MaxLength(100)]
    public string? ContentType { get; set; }

    /// <summary>File size in bytes.</summary>
    public long FileSize { get; set; }

    /// <summary>Who uploaded the file.</summary>
    [MaxLength(200)]
    public string? UploadedBy { get; set; }

    /// <summary>Vehicle registration for quick reference.</summary>
    [MaxLength(50)]
    public string? VehicleRegistration { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(MaintenanceRecordId))]
    public VehicleMaintenance? MaintenanceRecord { get; set; }
}
