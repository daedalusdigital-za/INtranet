using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Signatures
{
    /// <summary>
    /// A generic, reusable electronic signature that can be attached to ANY entity
    /// in the system (requisition invoices, HR documents, contracts, collaborative
    /// docs, etc.) via a polymorphic EntityType + EntityId reference.
    ///
    /// Designed to satisfy the intent/attribution/tamper-evidence expectations of an
    /// electronic signature under South Africa's ECT Act:
    ///   - Who signed (identity + role/authority)
    ///   - What they intended (Action)
    ///   - When (SignedAtUtc)
    ///   - What exactly they signed (PayloadHash — SHA-256 of the record state)
    ///   - From where (IpAddress / UserAgent) for non-repudiation
    /// The PayloadHash means any later change to the signed record can be detected.
    /// </summary>
    public class ElectronicSignature
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Logical type of the signed entity, e.g. "RequisitionInvoice".</summary>
        [Required]
        [StringLength(100)]
        public string EntityType { get; set; } = string.Empty;

        /// <summary>Primary key of the signed entity.</summary>
        public int EntityId { get; set; }

        /// <summary>Optional workflow stage/context this signature was captured at,
        /// e.g. "DuranApproval". Lets one entity carry many stage signatures.</summary>
        [StringLength(100)]
        public string? Context { get; set; }

        // ---- Signer identity & authority ----
        public int SignerUserId { get; set; }

        [StringLength(200)]
        public string SignerName { get; set; } = string.Empty;

        [StringLength(255)]
        public string? SignerEmail { get; set; }

        /// <summary>Role/authority the signer acted under at signing time.</summary>
        [StringLength(100)]
        public string? SignerRole { get; set; }

        // ---- Intent ----
        /// <summary>Approve, Reject, Acknowledge, Return, Sign.</summary>
        [Required]
        [StringLength(30)]
        public string Action { get; set; } = "Approve";

        /// <summary>Optional signer comment / reason (esp. for reject/return).</summary>
        [StringLength(2000)]
        public string? Comment { get; set; }

        // ---- Tamper evidence ----
        /// <summary>SHA-256 (hex) of the canonical record state at signing time.</summary>
        [StringLength(64)]
        public string? PayloadHash { get; set; }

        // ---- Attribution / non-repudiation ----
        [StringLength(64)]
        public string? IpAddress { get; set; }

        [StringLength(512)]
        public string? UserAgent { get; set; }

        /// <summary>How the signature was captured: Typed, Drawn, ReAuth, Click.</summary>
        [StringLength(30)]
        public string Method { get; set; } = "Click";

        /// <summary>Optional drawn/scanned signature image (base64 data URL or PNG bytes).</summary>
        public byte[]? SignatureImage { get; set; }

        [StringLength(50)]
        public string? SignatureImageMimeType { get; set; }

        /// <summary>Optional ordered-chain link to the previous signature on the same entity.</summary>
        public int? PreviousSignatureId { get; set; }

        /// <summary>True once the signer re-authenticated (e.g. re-entered password/OTP)
        /// at the moment of signing — used for higher-assurance stages.</summary>
        public bool ReAuthenticated { get; set; }

        public DateTime SignedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
