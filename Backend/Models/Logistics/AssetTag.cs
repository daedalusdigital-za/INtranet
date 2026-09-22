using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Universal barcode / QR-code registry for the logistics module.
    ///
    /// A single AssetTag represents one scannable label (its <see cref="Code"/>)
    /// that can point at ANY tracked thing — a stock item, a fixed asset
    /// (furniture / safe / equipment / vehicle), an invoice, a tripsheet (Load)
    /// or a commodity. Only the relevant link field(s) are populated for a given
    /// <see cref="TagType"/>; the rest stay null.
    ///
    /// The scannable value is stored as <see cref="Code"/> and is what a QR/1D
    /// barcode encodes. A user can also type this code manually when a scanner
    /// is unavailable, and the resolver will return everything linked to it.
    /// </summary>
    [Index(nameof(Code), IsUnique = true, Name = "UQ_AssetTags_Code")]
    [Index(nameof(ItemCode), Name = "IX_AssetTags_ItemCode")]
    [Index(nameof(LoadId), Name = "IX_AssetTags_LoadId")]
    [Index(nameof(AssetItemId), Name = "IX_AssetTags_AssetItemId")]
    [Index(nameof(ImportedInvoiceId), Name = "IX_AssetTags_ImportedInvoiceId")]
    public class AssetTag
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// The scannable value encoded on the barcode / QR label. Unique.
        /// e.g. "PMT-ITM-000123" or an existing manufacturer barcode number.
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string Code { get; set; } = string.Empty;

        /// <summary>
        /// Symbology of the physical label: QR, CODE128, EAN13, etc.
        /// QR is the default because it scans reliably from a phone camera.
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Symbology { get; set; } = "QR";

        /// <summary>
        /// What kind of thing this tag identifies:
        /// StockItem, Asset, Invoice, Load, Commodity, Custom
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string TagType { get; set; } = "Custom";

        // ── Link fields (only the relevant one(s) populated per TagType) ──

        /// <summary>Stock item code (BuildingInventory / StockMovement / Commodity.Code / ImportedInvoice.ProductCode).</summary>
        [MaxLength(50)]
        public string? ItemCode { get; set; }

        /// <summary>Fixed asset (furniture / safe / equipment / vehicle) in the Asset Register.</summary>
        public int? AssetItemId { get; set; }

        /// <summary>Tripsheet / Load this tag belongs to.</summary>
        public int? LoadId { get; set; }

        /// <summary>Imported invoice this tag identifies.</summary>
        public int? ImportedInvoiceId { get; set; }

        /// <summary>Commodity this tag identifies.</summary>
        public int? CommodityId { get; set; }

        // ── Descriptive / operational fields ──

        [MaxLength(300)]
        public string? Label { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(100)]
        public string? SerialNumber { get; set; }

        /// <summary>Active, Retired, Lost, Damaged.</summary>
        [MaxLength(30)]
        public string Status { get; set; } = "Active";

        /// <summary>Last known physical location / building / warehouse.</summary>
        [MaxLength(200)]
        public string? CurrentLocation { get; set; }

        /// <summary>Owning operating company (PMT, ACM, PHT, SBT).</summary>
        [MaxLength(10)]
        public string? SourceCompany { get; set; }

        public int? CreatedByUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        [ForeignKey("LoadId")]
        public virtual Load? Load { get; set; }

        [ForeignKey("ImportedInvoiceId")]
        public virtual ImportedInvoice? ImportedInvoice { get; set; }

        [ForeignKey("CommodityId")]
        public virtual Commodity? Commodity { get; set; }

        public virtual ICollection<ScanEvent> ScanEvents { get; set; } = new List<ScanEvent>();
    }

    /// <summary>
    /// Immutable audit record of a single scan (or manual code entry).
    /// Every lookup, check-in, check-out, load and delivery is captured here
    /// so cargo, assets and consignments can be traced end to end.
    /// </summary>
    [Index(nameof(ScannedCode), Name = "IX_ScanEvents_ScannedCode")]
    [Index(nameof(AssetTagId), Name = "IX_ScanEvents_AssetTagId")]
    [Index(nameof(LoadId), Name = "IX_ScanEvents_LoadId")]
    [Index(nameof(ScannedAt), Name = "IX_ScanEvents_ScannedAt")]
    public class ScanEvent
    {
        [Key]
        public int Id { get; set; }

        /// <summary>The raw code that was scanned or typed (may be unregistered).</summary>
        [Required]
        [MaxLength(100)]
        public string ScannedCode { get; set; } = string.Empty;

        /// <summary>Resolved tag, if the code matched a registered AssetTag.</summary>
        public int? AssetTagId { get; set; }

        /// <summary>
        /// What the scan represents:
        /// Lookup, CheckIn, CheckOut, LoadOnVehicle, Offload, Deliver, Verify, Register
        /// </summary>
        [Required]
        [MaxLength(30)]
        public string Action { get; set; } = "Lookup";

        /// <summary>How the code was captured: Camera, Manual, Import.</summary>
        [MaxLength(20)]
        public string ScanMethod { get; set; } = "Camera";

        /// <summary>Tripsheet / Load context this scan happened against, if any.</summary>
        public int? LoadId { get; set; }

        [MaxLength(200)]
        public string? Location { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? Latitude { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? Longitude { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public int? ScannedByUserId { get; set; }

        [MaxLength(200)]
        public string? ScannedByName { get; set; }

        public DateTime ScannedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("AssetTagId")]
        public virtual AssetTag? AssetTag { get; set; }

        [ForeignKey("LoadId")]
        public virtual Load? Load { get; set; }
    }
}
