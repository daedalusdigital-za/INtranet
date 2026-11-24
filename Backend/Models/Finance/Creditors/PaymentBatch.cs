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
    /// <summary>The operating company users are assigned to (StaffOperatingCompanies); drives who may see this company in Finance.</summary>
    public int? OperatingCompanyId { get; set; }
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
    /// <summary>DailyCreditor | MonthlyCreditor | Prepayment | Intercompany | Utility | StaffPayment | RequisitionForm | CreditNote</summary>
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

    // Who the pack was sent to (chosen at submit / approve from the company's approvers). CSV of user ids; empty = all of them.
    [MaxLength(200)] public string? RequestedApproverIds { get; set; }
    [MaxLength(600)] public string? RequestedApproverNames { get; set; }
    [MaxLength(200)] public string? RequestedDirectorIds { get; set; }
    [MaxLength(600)] public string? RequestedDirectorNames { get; set; }

    [NotMapped] public IReadOnlyList<int> RequestedApproverIdList => ParseIds(RequestedApproverIds);
    [NotMapped] public IReadOnlyList<int> RequestedDirectorIdList => ParseIds(RequestedDirectorIds);
    public static IReadOnlyList<int> ParseIds(string? csv) => string.IsNullOrWhiteSpace(csv) ? Array.Empty<int>() : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(s => int.TryParse(s, out var i) ? i : 0).Where(i => i > 0).ToList();

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

public static class CreditorPaymentModes
{
    public const string Normal = "Normal";
    public const string PayAndClear = "PayAndClear";
    public static readonly string[] All = { Normal, PayAndClear };
    public static string Title(string? m) => m == PayAndClear ? "Pay and clear" : "Normal payment";
    public static string Normalise(string? m) => m == PayAndClear ? PayAndClear : Normal;
}

/// <summary>How a staff payment is paid out.</summary>
public static class StaffPayoutMethods
{
    public const string Eft = "EFT";
    public const string EWallet = "EWallet";
    /// <summary>BankName stored on eWallet payments.</summary>
    public const string EWalletBankName = "eWallet";
    public static string Normalise(string? m) => string.Equals(m, EWallet, StringComparison.OrdinalIgnoreCase) ? EWallet : Eft;
    public static string Title(string? m) => m == EWallet ? "eWallet" : "EFT";
}

/// <summary>Compliance payments: what kind of compliance payment a line is. "Other" carries a free-text description.</summary>
public static class CreditorComplianceKinds
{
    public const string Invoice = "Invoice";
    public const string Licence = "Licence";
    public const string CrossBorder = "CrossBorder";
    public const string Other = "Other";

    public static readonly (string Key, string Title)[] All =
    {
        (Invoice, "Invoice"), (Licence, "Licence"), (CrossBorder, "Cross-border payment"), (Other, "Other"),
    };

    /// <summary>The stored key for <paramref name="kind"/> (case-insensitive), or null if it isn't a known kind.</summary>
    public static string? Normalise(string? kind) => All.Where(k => string.Equals(k.Key, kind?.Trim(), StringComparison.OrdinalIgnoreCase)).Select(k => k.Key).FirstOrDefault();

    /// <summary>"Licence", "Cross-border payment", or "Other — {detail}".</summary>
    public static string? Title(string? kind, string? detail)
    {
        if (kind == null) return null;
        if (kind == Other) return string.IsNullOrWhiteSpace(detail) ? "Other" : $"Other — {detail.Trim()}";
        return All.Where(k => k.Key == kind).Select(k => k.Title).FirstOrDefault() ?? kind;
    }
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

    /// <summary>Flagged by the preparer: this one must go out ahead of the normal run.</summary>
    public bool IsUrgent { get; set; }
    /// <summary>Normal (default) | PayAndClear — pay and clear the supplier account in the same run.</summary>
    [Required, MaxLength(20)] public string PaymentMode { get; set; } = CreditorPaymentModes.Normal;

    /// <summary>
    /// Staff payments only: EFT (bank details captured, usually read off the staff member's bank statement) or
    /// EWallet (cellphone number). For eWallet the number is kept in <see cref="AccountNumber"/> and BankName is "eWallet",
    /// so the schedule, bank file and PDFs show it without special-casing. Null for every other payment type.
    /// </summary>
    [MaxLength(10)] public string? PayoutMethod { get; set; }

    /// <summary>Compliance payments only: see <see cref="CreditorComplianceKinds"/>. Null for every other payment type.</summary>
    [MaxLength(20)] public string? ComplianceKind { get; set; }
    /// <summary>Compliance payments of kind Other: what the payment is for.</summary>
    [MaxLength(200)] public string? ComplianceDetail { get; set; }

    /// <summary>"Compliance · Licence" style label for the line, or null when it isn't a compliance payment.</summary>
    [NotMapped] public string? ComplianceTitle => CreditorComplianceKinds.Title(ComplianceKind, ComplianceDetail);
    /// <summary>Description as shown on schedules and PDFs: the compliance kind in front of the typed description.</summary>
    [NotMapped] public string? DisplayDescription => ComplianceTitle == null ? Description
        : string.IsNullOrWhiteSpace(Description) ? $"Compliance: {ComplianceTitle}" : $"Compliance: {ComplianceTitle} — {Description}";

    /// <summary>Pending | Approved | Queried | Rejected — the director's decision per payment.</summary>
    [Required, MaxLength(20)] public string DecisionStatus { get; set; } = "Pending";
    [MaxLength(1000)] public string? DecisionComment { get; set; }
    public DateTime? DecidedAt { get; set; }

    // ── Director query on one payment ──
    // The director's question is kept here (DecisionComment is overwritten once the director decides again).
    // When the director signs a pack that also has approved payments, the queried ones move to their own pack
    // (QueriedFromBatchNumber says where they came from) so the rest can be paid. The preparer or accountant answers,
    // and once every query on the pack is answered it goes straight back to the director.
    [MaxLength(1000)] public string? QueryQuestion { get; set; }
    [MaxLength(150)] public string? QueryAskedByName { get; set; }
    public DateTime? QueryAskedAt { get; set; }
    [MaxLength(2000)] public string? QueryResponse { get; set; }
    [MaxLength(150)] public string? QueryRespondedByName { get; set; }
    public DateTime? QueryRespondedAt { get; set; }
    [MaxLength(20)] public string? QueriedFromBatchNumber { get; set; }
    /// <summary>Rejected by the director, then fixed and put on a new draft pack: that pack's number (so it's only resubmitted once).</summary>
    [MaxLength(20)] public string? ResubmittedAsBatchNumber { get; set; }

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
