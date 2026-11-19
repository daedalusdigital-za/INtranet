using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// A request for quotations (goods / services / equipment) raised by any staff member and approved by Finance.
    /// Replaces the old "stationery request" on the Finance › Approvals tab. Quotes already in hand are attached as files.
    /// </summary>
    public class QuotationRequest
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        [MaxLength(200)] public string RequestedBy { get; set; } = "";
        [MaxLength(200)] public string? RequestedByEmail { get; set; }
        [MaxLength(120)] public string? Department { get; set; }
        /// <summary>Paying company this is for, when the requester knows it (e.g. "Promed Technologies").</summary>
        [MaxLength(120)] public string? Company { get; set; }
        [MaxLength(300)] public string Subject { get; set; } = "";
        public string? Details { get; set; }
        [MaxLength(20)] public string Priority { get; set; } = "Normal";
        /// <summary>Estimated value if known.</summary>
        public decimal? EstimatedAmount { get; set; }
        /// <summary>Pending | Approved | Declined</summary>
        [MaxLength(20)] public string Status { get; set; } = "Pending";
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public int? ReviewedByUserId { get; set; }
        [MaxLength(200)] public string? ReviewedBy { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewNotes { get; set; }
        /// <summary>Paperless document created when the requester chose the sign-off workflow.</summary>
        public int? PaperlessDocumentId { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public List<QuotationRequestFile> Files { get; set; } = new();
    }

    public class QuotationRequestFile
    {
        public int Id { get; set; }
        public int QuotationRequestId { get; set; }
        public QuotationRequest? Request { get; set; }
        [MaxLength(260)] public string FileName { get; set; } = "";
        [MaxLength(120)] public string ContentType { get; set; } = "application/octet-stream";
        public long Size { get; set; }
        [MaxLength(500)] public string StoragePath { get; set; } = "";
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
