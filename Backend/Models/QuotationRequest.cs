using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// A request for quotations (goods / services / equipment) raised by any staff member, normally with three quotes.
    /// Flow: requester → Creditors accept (preparer signs) → company accountant signs → director picks one quote and signs
    /// (or rejects all) → the preparer and requester are e-mailed the outcome with the quote approval sheet.
    /// See <see cref="QuoteFlow"/> for the statuses.
    /// </summary>
    public class QuotationRequest
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        [MaxLength(200)] public string RequestedBy { get; set; } = "";
        [MaxLength(200)] public string? RequestedByEmail { get; set; }
        [MaxLength(120)] public string? Department { get; set; }
        /// <summary>Paying company name as the requester picked it (e.g. "Promed Technologies").</summary>
        [MaxLength(120)] public string? Company { get; set; }
        /// <summary>Creditor company code (CreditorCompanies.Code) — decides which accountants and directors can approve.</summary>
        [MaxLength(10)] public string? CompanyCode { get; set; }
        [MaxLength(300)] public string Subject { get; set; } = "";
        public string? Details { get; set; }
        [MaxLength(20)] public string Priority { get; set; } = "Normal";
        /// <summary>Estimated value if known.</summary>
        public decimal? EstimatedAmount { get; set; }
        /// <summary>Why fewer than three quotes were attached (e.g. sole supplier).</summary>
        [MaxLength(500)] public string? FewerQuotesReason { get; set; }
        /// <summary>See <see cref="QuoteFlow"/>.</summary>
        [MaxLength(20)] public string Status { get; set; } = QuoteFlow.Pending;
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Last decision (kept for the old Approvals list): who, when, note.</summary>
        public int? ReviewedByUserId { get; set; }
        [MaxLength(200)] public string? ReviewedBy { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewNotes { get; set; }

        /// <summary>Creditors clerk who accepted it and sent it to the accountant (the "preparer").</summary>
        public int? PreparedByUserId { get; set; }
        [MaxLength(200)] public string? PreparedByName { get; set; }
        public DateTime? PreparedAt { get; set; }
        /// <summary>Accountant(s) / director(s) it was sent to (comma-separated ids and names; empty = any for the company).</summary>
        [MaxLength(200)] public string? RequestedAccountantIds { get; set; }
        [MaxLength(400)] public string? RequestedAccountantNames { get; set; }
        [MaxLength(200)] public string? RequestedDirectorIds { get; set; }
        [MaxLength(400)] public string? RequestedDirectorNames { get; set; }
        public int? AccountantUserId { get; set; }
        [MaxLength(200)] public string? AccountantName { get; set; }
        public DateTime? AccountantApprovedAt { get; set; }
        [MaxLength(1000)] public string? AccountantComment { get; set; }
        public int? DirectorUserId { get; set; }
        [MaxLength(200)] public string? DirectorName { get; set; }
        public DateTime? DirectorDecidedAt { get; set; }
        [MaxLength(1000)] public string? DirectorComment { get; set; }
        /// <summary>The quote the director chose (a QuotationRequestFile id).</summary>
        public int? SelectedFileId { get; set; }
        /// <summary>Why it came back (accountant sent back to the preparer, or creditors declined it).</summary>
        [MaxLength(1000)] public string? ReturnReason { get; set; }
        /// <summary>History as JSON: [{at, by, action, note}].</summary>
        public string? HistoryJson { get; set; }

        /// <summary>Paperless document created when the requester chose the sign-off workflow (older requests).</summary>
        public int? PaperlessDocumentId { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public List<QuotationRequestFile> Files { get; set; } = new();

        [NotMapped] public IReadOnlyList<int> RequestedAccountantIdList => QuoteFlow.Ids(RequestedAccountantIds);
        [NotMapped] public IReadOnlyList<int> RequestedDirectorIdList => QuoteFlow.Ids(RequestedDirectorIds);
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
        /// <summary>Quote 1, 2, 3 … in the order the requester attached them.</summary>
        public int QuoteNumber { get; set; }
        /// <summary>Supplier on the quote, as the requester typed it.</summary>
        [MaxLength(200)] public string? Supplier { get; set; }
        /// <summary>Quoted amount (R), as the requester typed it.</summary>
        public decimal? Amount { get; set; }
    }

    /// <summary>Quotation request statuses.</summary>
    public static class QuoteFlow
    {
        /// <summary>Submitted, waiting for Creditors to accept (or came back from the accountant to the preparer).</summary>
        public const string Pending = "Pending";
        public const string WithAccountant = "WithAccountant";
        public const string WithDirector = "WithDirector";
        /// <summary>Director chose one quote.</summary>
        public const string Approved = "Approved";
        /// <summary>Director rejected all quotes.</summary>
        public const string Rejected = "Rejected";
        /// <summary>Creditors declined it back to the requester.</summary>
        public const string Declined = "Declined";

        public static readonly string[] All = { Pending, WithAccountant, WithDirector, Approved, Rejected, Declined };

        public static string Title(string s) => s switch
        {
            Pending => "With creditors",
            WithAccountant => "With the accountant",
            WithDirector => "With the director",
            Approved => "Quote approved",
            Rejected => "All quotes rejected",
            Declined => "Declined by creditors",
            _ => s
        };

        public static IReadOnlyList<int> Ids(string? csv) =>
            (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => int.TryParse(x, out var i) ? i : 0).Where(i => i > 0).Distinct().ToList();
    }
}
