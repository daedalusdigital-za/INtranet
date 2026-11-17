using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance.Creditors;

/// <summary>
/// A group company that pays creditors through the intranet. Carries the people who must
/// approve its payment packs: the responsible accountant (mandatory step), a back-up
/// approver, and the director(s) who sign. Edited by the system admin only.
/// </summary>
public class CreditorCompany
{
    [Key] public int Id { get; set; }
    [Required, MaxLength(10)] public string Code { get; set; } = "";
    [Required, MaxLength(120)] public string Name { get; set; } = "";
    [MaxLength(200)] public string? Activity { get; set; }
    public int? AccountantUserId { get; set; }
    public int? BackupApproverUserId { get; set; }
    public int? DirectorUserId { get; set; }
    public int? DelegateDirectorUserId { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

/// <summary>
/// One payment batch ("pack") for one paying company: the payment schedule, the
/// supporting documents and the approval trail. Statuses are in <see cref="CreditorWorkflow"/>.
/// </summary>
public class PaymentBatch
{
    [Key] public int Id { get; set; }
    /// <summary>CB-2026-0001</summary>
    [Required, MaxLength(20)] public string BatchNumber { get; set; } = "";
    [Required, MaxLength(10)] public string CompanyCode { get; set; } = "";
    /// <summary>DailyCreditor | MonthlyCreditor | Prepayment | Intercompany | Utility | StaffPayment | CreditNote</summary>
    [Required, MaxLength(20)] public string PaymentType { get; set; } = "DailyCreditor";
    public DateTime BatchDate { get; set; } = DateTime.UtcNow.Date;
    [Required, MaxLength(30)] public string Status { get; set; } = CreditorWorkflow.Draft;
    [MaxLength(1000)] public string? Notes { get; set; }
    public decimal TotalAmount { get; set; }

    // Preparer
    public int PreparedByUserId { get; set; }
    [MaxLength(150)] public string? PreparedByName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }

    // Automatic checks (CreditorChecks.Result as JSON)
    public DateTime? ChecksRunAt { get; set; }
    /// <summary>PASS | FAIL | REVIEW</summary>
    [MaxLength(10)] public string? ChecksStatus { get; set; }
    public string? ChecksJson { get; set; }

    // Accountant step (mandatory)
    public int? AccountantUserId { get; set; }
    [MaxLength(150)] public string? AccountantName { get; set; }
    public DateTime? AccountantApprovedAt { get; set; }
    [MaxLength(1000)] public string? AccountantComment { get; set; }

    // Director sign-off
    public int? DirectorUserId { get; set; }
    [MaxLength(150)] public string? DirectorName { get; set; }
    public DateTime? DirectorSignedAt { get; set; }
    [MaxLength(1000)] public string? DirectorComment { get; set; }

    /// <summary>Set when the director signs. From then on the batch and its files are read-only.</summary>
    public DateTime? LockedAt { get; set; }
    /// <summary>SHA-256 of the batch state at signing (items + document hashes).</summary>
    [MaxLength(64)] public string? LockHash { get; set; }

    // Bank + close
    /// <summary>Pay-run this batch is booked on (Mondays and Wednesdays). Set when the director signs; the treasurer may move it.</summary>
    public DateTime? ScheduledPayDate { get; set; }
    public DateTime? BankExportedAt { get; set; }
    public int? BankExportedByUserId { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    /// <summary>Why the batch was last sent back (checks, accountant or director).</summary>
    [MaxLength(2000)] public string? ReturnReason { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<PaymentBatchItem> Items { get; set; } = new List<PaymentBatchItem>();
    public virtual ICollection<PaymentBatchDocument> Documents { get; set; } = new List<PaymentBatchDocument>();
    public virtual ICollection<PaymentBatchEvent> Events { get; set; } = new List<PaymentBatchEvent>();
}

/// <summary>One payment (one beneficiary) inside a batch — a line on the payment schedule.</summary>
public class PaymentBatchItem
{
    [Key] public int Id { get; set; }
    [Required] public int BatchId { get; set; }
    [Required, MaxLength(200)] public string SupplierName { get; set; } = "";
    [MaxLength(20)] public string? SupplierVatNumber { get; set; }
    /// <summary>Comma-separated invoice / reference numbers being settled.</summary>
    [MaxLength(1000)] public string? InvoiceNumbers { get; set; }
    [MaxLength(500)] public string? Description { get; set; }
    public decimal Amount { get; set; }

    // Beneficiary bank details as captured on the schedule (checked against the bank letter)
    [MaxLength(100)] public string? BankName { get; set; }
    [MaxLength(40)] public string? AccountNumber { get; set; }
    [MaxLength(20)] public string? BranchCode { get; set; }
    [MaxLength(200)] public string? AccountHolder { get; set; }
    [MaxLength(50)] public string? PaymentReference { get; set; }

    /// <summary>Credit notes only: stock physically came back → warehouse GRV + collection slip are mandatory.</summary>
    public bool StockReturned { get; set; }

    /// <summary>Pending | Approved | Queried | Rejected — the director's decision per payment.</summary>
    [Required, MaxLength(20)] public string DecisionStatus { get; set; } = "Pending";
    [MaxLength(1000)] public string? DecisionComment { get; set; }
    public DateTime? DecidedAt { get; set; }

    /// <summary>Prepayments: stays true after payment until the tax invoice and GRV are uploaded.</summary>
    public bool PrepaymentOpen { get; set; }
    public DateTime? PaidAt { get; set; }
    public int SortOrder { get; set; }

    [ForeignKey(nameof(BatchId))] public virtual PaymentBatch? Batch { get; set; }
}

/// <summary>A supporting document (one PDF = one document) attached to a batch or to one payment in it.</summary>
public class PaymentBatchDocument
{
    [Key] public int Id { get; set; }
    [Required] public int BatchId { get; set; }
    /// <summary>Null = batch-level (payment schedule, creditors recon, Sage report…).</summary>
    public int? ItemId { get; set; }
    /// <summary>See <see cref="CreditorDocTypes"/>.</summary>
    [Required, MaxLength(30)] public string DocType { get; set; } = CreditorDocTypes.Other;
    /// <summary>What the system guessed from the file name and page text; the clerk confirms DocType.</summary>
    [MaxLength(30)] public string? SuggestedDocType { get; set; }

    /// <summary>A required document marked "not applicable" instead of uploaded. No file then.</summary>
    public bool IsNotApplicable { get; set; }
    [MaxLength(500)] public string? NaReason { get; set; }

    [MaxLength(255)] public string? FileName { get; set; }
    [MaxLength(255)] public string? OriginalFileName { get; set; }
    [MaxLength(100)] public string? ContentType { get; set; }
    public long Size { get; set; }
    /// <summary>Relative to DocumentsPath, forward slashes.</summary>
    [MaxLength(500)] public string? StoragePath { get; set; }
    [MaxLength(64)] public string? Sha256 { get; set; }
    public int PageCount { get; set; }
    /// <summary>Text read off the document (iText or OCR), capped, used by the checks.</summary>
    public string? ExtractedText { get; set; }
    /// <summary>itext | ocr | none</summary>
    [MaxLength(10)] public string? TextMethod { get; set; }

    // Values the system read off the page (for checks)
    public DateTime? DocumentDate { get; set; }
    [MaxLength(40)] public string? ExtractedAccountNumber { get; set; }
    [MaxLength(20)] public string? ExtractedVatNumber { get; set; }
    [MaxLength(100)] public string? ExtractedInvoiceNumber { get; set; }
    public decimal? ExtractedAmount { get; set; }

    public int UploadedByUserId { get; set; }
    [MaxLength(150)] public string? UploadedByName { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Versioning after lock: a replacement points at the file it supersedes and carries a reason.</summary>
    public int Version { get; set; } = 1;
    public int? SupersedesDocumentId { get; set; }
    [MaxLength(500)] public string? VersionReason { get; set; }

    [ForeignKey(nameof(BatchId))] public virtual PaymentBatch? Batch { get; set; }
}

/// <summary>Append-only audit trail: every status change, decision and upload.</summary>
public class PaymentBatchEvent
{
    [Key] public int Id { get; set; }
    [Required] public int BatchId { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
    public int UserId { get; set; }
    [MaxLength(150)] public string? UserName { get; set; }
    [Required, MaxLength(40)] public string Action { get; set; } = "";
    [MaxLength(30)] public string? FromStatus { get; set; }
    [MaxLength(30)] public string? ToStatus { get; set; }
    [MaxLength(2000)] public string? Comment { get; set; }

    [ForeignKey(nameof(BatchId))] public virtual PaymentBatch? Batch { get; set; }
}
