using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Projects;

/// <summary>
/// Stores file attachment metadata for HBA1C credit notes.
/// The credit note itself lives on the external API; this table only tracks uploaded files on our file system.
/// </summary>
public class CreditNoteAttachment
{
    [Key]
    public int Id { get; set; }

    /// <summary>Credit note ID from the external HBA1C API.</summary>
    public int CreditNoteId { get; set; }

    /// <summary>Credit note number for display (e.g. "CN-001").</summary>
    [MaxLength(100)]
    public string? CreditNoteNumber { get; set; }

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

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
