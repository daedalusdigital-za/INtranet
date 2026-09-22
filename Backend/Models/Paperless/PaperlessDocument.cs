using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Paperless
{
    /// <summary>
    /// A Paperless document. The binary file lives on disk (FilePath); all
    /// workflow state (recipients, activity, annotations, signatures) is stored
    /// as JSON so the client keeps full control of the shape while the server
    /// remains the single source of truth (shared across users, no 5&#160;MB
    /// localStorage cap). Stacked supporting documents are ordinary rows that
    /// point at their parent via <see cref="ParentId"/>.
    /// </summary>
    public class PaperlessDocument
    {
        /// <summary>Client-generated stable id (also used in the file name).</summary>
        [Key]
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        [MaxLength(400)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(160)]
        public string Mime { get; set; } = "application/octet-stream";

        public long SizeBytes { get; set; }

        [MaxLength(40)]
        public string Status { get; set; } = "draft";

        public int Progress { get; set; } = 8;

        [MaxLength(20)]
        public string Routing { get; set; } = "sequential";

        public DateTime? DueDate { get; set; }

        /// <summary>Page rotation in degrees (0, 90, 180, 270) — persisted so
        /// everyone sees the document the right way up.</summary>
        public int Rotation { get; set; }

        /// <summary>When set, this document is stacked under another.</summary>
        [MaxLength(64)]
        public string? ParentId { get; set; }

        /// <summary>For stacked children: the supporting-document kind.</summary>
        [MaxLength(40)]
        public string? StackKind { get; set; }

        /// <summary>Business workflow category chosen at upload/link time, e.g.
        /// InterCompanies, InterCode, ThreeQuote, TaxPayment, Payment,
        /// CreditRequest, Recon, Other.</summary>
        [MaxLength(40)]
        public string? Category { get; set; }

        /// <summary>Absolute path of the stored binary on the server.</summary>
        [MaxLength(700)]
        public string FilePath { get; set; } = string.Empty;

        // Workflow state serialised as JSON arrays.
        public string RecipientsJson { get; set; } = "[]";
        public string ActivityJson { get; set; } = "[]";
        public string AnnotationsJson { get; set; } = "[]";
        public string SignaturesJson { get; set; } = "[]";

        /// <summary>
        /// User ids (system users) that have been granted access to this
        /// document because they were added as a recipient (signer / approver /
        /// viewer) or the document was shared with them. Stored as a JSON array
        /// of integers, e.g. <c>[12,34]</c>. Access is granted to a document and
        /// its whole stack together.
        /// </summary>
        public string AccessUserIdsJson { get; set; } = "[]";

        [MaxLength(200)]
        public string? CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
