using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance;

/// <summary>
/// An invoice "pack": the complete paper trail for one sale — delivery note, tax invoice, order
/// confirmation, the customer's order e-mail and the filled-in order form — kept as a single PDF
/// and tracked by invoice number. Today packs are scanned and uploaded as one file; later they
/// can be assembled from individual components (see <see cref="InvoicePackFile"/>) and from
/// documents the intranet already holds.
/// </summary>
public class InvoicePack
{
    [Key] public int Id { get; set; }

    /// <summary>Human-friendly number, "PK000123".</summary>
    [MaxLength(30)] public string? PackNumber { get; set; }

    /// <summary>Sage invoice number (IN######) — the key the pack is tracked by.</summary>
    [Required, MaxLength(50)] public string InvoiceNumber { get; set; } = "";

    [MaxLength(100)] public string? OrderNumber { get; set; }
    [MaxLength(50)] public string? CustomerNumber { get; set; }
    [MaxLength(255)] public string? CustomerName { get; set; }
    /// <summary>PMT / ACM / PHT / SBT.</summary>
    [MaxLength(10)] public string? Company { get; set; }
    public DateTime? InvoiceDate { get; set; }
    public decimal? InvoiceTotal { get; set; }

    /// <summary>Scanned (one PDF uploaded) or Assembled (built from components).</summary>
    [MaxLength(20)] public string Source { get; set; } = "Scanned";
    /// <summary>Complete / Incomplete — derived from the contents checklist.</summary>
    [MaxLength(20)] public string Status { get; set; } = "Complete";

    // Contents checklist — what the pack actually contains.
    public bool HasDeliveryNote { get; set; }
    public bool HasTaxInvoice { get; set; }
    public bool HasOrderConfirmation { get; set; }
    public bool HasOrderEmail { get; set; }
    public bool HasOrderForm { get; set; }

    /// <summary>Invoice number was read off the scan and confirmed by the uploader.</summary>
    public bool InvoiceVerified { get; set; }
    /// <summary>Invoice number was found in the Sage sales history at upload time.</summary>
    public bool InSage { get; set; }

    /// <summary>Order confirmation number (ORD######) read off the pack.</summary>
    [MaxLength(50)] public string? ConfirmationNumber { get; set; }
    /// <summary>PASS | FAIL | REVIEW | UNKNOWN — result of the H1–H3 pack rules.</summary>
    [MaxLength(20)] public string? ValidationStatus { get; set; }
    /// <summary>Full per-page analysis (PackAnalyzer.Result as JSON).</summary>
    public string? ValidationJson { get; set; }
    public bool ProofOfDelivery { get; set; }
    public bool PartDelivery { get; set; }
    public bool AmendedOrder { get; set; }

    [MaxLength(1000)] public string? Notes { get; set; }

    // The combined PDF.
    [Required, MaxLength(255)] public string FileName { get; set; } = "";
    [MaxLength(255)] public string? OriginalFileName { get; set; }
    [MaxLength(100)] public string? ContentType { get; set; }
    public long Size { get; set; }
    /// <summary>Relative to DocumentsPath, forward slashes.</summary>
    [Required, MaxLength(500)] public string StoragePath { get; set; } = "";
    public int PageCount { get; set; }

    public int UploadedBy { get; set; }
    [MaxLength(150)] public string? UploadedByName { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<InvoicePackFile> Files { get; set; } = new List<InvoicePackFile>();
}

/// <summary>One component document inside a pack (kept so a pack can be rebuilt or audited).</summary>
public class InvoicePackFile
{
    [Key] public int Id { get; set; }
    [Required] public int PackId { get; set; }
    /// <summary>DeliveryNote | TaxInvoice | OrderConfirmation | OrderEmail | OrderForm | Other | FullPack</summary>
    [Required, MaxLength(30)] public string Kind { get; set; } = "Other";
    public int SortOrder { get; set; }
    [Required, MaxLength(255)] public string FileName { get; set; } = "";
    [MaxLength(255)] public string? OriginalFileName { get; set; }
    [MaxLength(100)] public string? ContentType { get; set; }
    public long Size { get; set; }
    [Required, MaxLength(500)] public string StoragePath { get; set; } = "";
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(PackId))] public virtual InvoicePack? Pack { get; set; }
}
