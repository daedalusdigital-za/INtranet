namespace ProjectTracker.API.Models.Finance.Creditors;

/// <summary>
/// Batch life-cycle:
/// Draft → (Submit, checks run) → ChecksFailed | AwaitingAccountant → QueriedByAccountant | AwaitingDirector
/// → QueriedByDirector | Rejected | Approved → LoadedOnBank → Paid → Closed.
/// Prepayments: Paid stays "open" per item until the tax invoice + GRV are uploaded.
/// Roles are permission keys on the user; the company table narrows accountant/director to the paying company.
/// </summary>
public static class CreditorWorkflow
{
    public const string Draft = "Draft";
    public const string ChecksFailed = "ChecksFailed";
    public const string AwaitingAccountant = "AwaitingAccountant";
    public const string QueriedByAccountant = "QueriedByAccountant";
    public const string AwaitingDirector = "AwaitingDirector";
    public const string QueriedByDirector = "QueriedByDirector";
    public const string Rejected = "Rejected";
    public const string Approved = "Approved";
    public const string LoadedOnBank = "LoadedOnBank";
    public const string Paid = "Paid";
    public const string Closed = "Closed";

    public static readonly string[] Ordered =
    {
        Draft, AwaitingAccountant, AwaitingDirector, Approved, LoadedOnBank, Paid, Closed
    };

    /// <summary>Statuses where the preparer may still edit items and documents.</summary>
    public static readonly HashSet<string> PreparerEditable = new() { Draft, ChecksFailed, QueriedByAccountant, QueriedByDirector };

    /// <summary>Statuses from which the batch is locked (director signed).</summary>
    public static readonly HashSet<string> Locked = new() { Approved, LoadedOnBank, Paid, Closed };

    /// <summary>Statuses that sit on the Payment Schedule: signed and waiting to be loaded / paid / closed with POP.</summary>
    public static readonly HashSet<string> OnSchedule = new() { Approved, LoadedOnBank, Paid };

    /// <summary>The group pays suppliers on Mondays and Wednesdays.</summary>
    public static readonly DayOfWeek[] PayDays = { DayOfWeek.Monday, DayOfWeek.Wednesday };
    private static readonly TimeSpan Sast = TimeSpan.FromHours(2);
    /// <summary>Cut-off (SAST) after which a same-day pay-run is considered closed.</summary>
    private const int CutOffHourSast = 10;

    /// <summary>Next pay-run on or after <paramref name="utc"/> (same day only if before the cut-off). Returned as a date (midnight).</summary>
    public static DateTime NextPayDay(DateTime utc)
    {
        var local = utc + Sast;
        var d = local.Date;
        for (var i = 0; i < 8; i++)
        {
            var c = d.AddDays(i);
            if (!PayDays.Contains(c.DayOfWeek)) continue;
            if (i == 0 && local.Hour >= CutOffHourSast) continue;
            return c;
        }
        return d;
    }

    /// <summary>The next <paramref name="count"/> pay-runs from now.</summary>
    public static List<DateTime> UpcomingPayDays(DateTime utc, int count)
    {
        var list = new List<DateTime>();
        var d = NextPayDay(utc);
        while (list.Count < count) { if (PayDays.Contains(d.DayOfWeek)) list.Add(d); d = d.AddDays(1); }
        return list;
    }

    // Permission keys (Users.Permissions)
    public const string RoleClerk = "cred.clerk";            // creditors clerk: prepare, submit, close
    public const string RoleAccountant = "cred.accountant";  // company accountant (narrowed by CreditorCompany)
    public const string RoleDirector = "cred.director";      // director sign-off (Duran; Nash where delegated)
    public const string RoleBank = "cred.bank";              // export bank file, mark loaded/paid
    public const string RoleReadOnly = "cred.readonly";      // audit / Nash view-only
    public const string RoleAdmin = "cred.admin";            // companies, approvers, rules

    public static readonly (string Key, string Title, string Description)[] Roles =
    {
        (RoleClerk, "Creditors clerk", "Creates batches, uploads documents, completes the schedule and recon, submits, uploads proof of payment."),
        (RoleAccountant, "Company accountant", "Mandatory approval for the paying company before the director sees the pack."),
        (RoleDirector, "Director", "Approves, queries or rejects each payment and signs the batch electronically."),
        (RoleBank, "Bank user", "Exports the bank file for approved payments, marks loaded and paid."),
        (RoleReadOnly, "Read-only / audit", "Sees everything, changes nothing."),
        (RoleAdmin, "Creditors admin", "Manages companies, responsible accountants, directors and check rules."),
    };

    public static string Title(string status) => status switch
    {
        Draft => "Draft",
        ChecksFailed => "Checks failed — back with preparer",
        AwaitingAccountant => "Awaiting company accountant",
        QueriedByAccountant => "Queried by accountant",
        AwaitingDirector => "Awaiting director sign-off",
        QueriedByDirector => "Queried by director",
        Rejected => "Rejected by director",
        Approved => "Approved — ready to load",
        LoadedOnBank => "Loaded on bank",
        Paid => "Paid",
        Closed => "Closed",
        _ => status
    };
}

public static class CreditorPaymentTypes
{
    public const string DailyCreditor = "DailyCreditor";
    public const string MonthlyCreditor = "MonthlyCreditor";
    public const string Prepayment = "Prepayment";
    public const string Intercompany = "Intercompany";
    public const string Utility = "Utility";
    public const string StaffPayment = "StaffPayment";
    public const string CreditNote = "CreditNote";

    public static readonly (string Key, string Title)[] All =
    {
        (DailyCreditor, "Daily creditor"), (MonthlyCreditor, "Monthly creditor"), (Prepayment, "Prepayment"),
        (Intercompany, "Intercompany"), (Utility, "Utility"), (StaffPayment, "Staff payment"), (CreditNote, "Credit note"),
    };
}

/// <summary>Document types a file can be tagged with (one document per file).</summary>
public static class CreditorDocTypes
{
    public const string PaymentSchedule = "PaymentSchedule";
    public const string CreditorsRecon = "CreditorsRecon";
    public const string SupplierStatement = "SupplierStatement";
    public const string SageAgedPayables = "SageAgedPayables";
    public const string TaxInvoice = "TaxInvoice";
    /// <summary>Per-payment supplier reconciliation (Excel or PDF) — expected with every invoice.</summary>
    public const string SupplierRecon = "SupplierRecon";
    public const string Quote = "Quote";
    public const string PurchaseOrder = "PurchaseOrder";
    public const string Grv = "GRV";
    public const string ProofOfWork = "ProofOfWork";
    public const string BankLetter = "BankLetter";
    public const string WrittenInstruction = "WrittenInstruction";
    /// <summary>Legacy — requisitions / payment requests live in their own module now and are no longer attached to packs.</summary>
    public const string Requisition = "Requisition";
    public const string CreditNoteForm = "CreditNoteForm";
    public const string CustomerReason = "CustomerReason";
    public const string CustomerCollectionSlip = "CustomerCollectionSlip";
    public const string WarehouseReturnGrv = "WarehouseReturnGRV";
    public const string ReinvoiceNumber = "ReinvoiceNumber";
    public const string ProofOfPayment = "ProofOfPayment";
    public const string Other = "Other";

    public static readonly (string Key, string Title, string Scope)[] All =
    {
        (PaymentSchedule, "Payment schedule", "batch"),
        (CreditorsRecon, "Creditors recon", "batch"),
        (SupplierStatement, "Supplier statement", "item"),
        (TaxInvoice, "Tax invoice", "item"),
        (SupplierRecon, "Supplier recon (Excel or PDF)", "item"),
        (Quote, "Quote (3 where possible)", "item"),
        (PurchaseOrder, "Purchase order", "item"),
        (Grv, "GRV / delivery note / POD", "item"),
        (ProofOfWork, "Proof of work (photos, reg, sign-off)", "item"),
        (BankLetter, "Bank letter < 3 months + AVS", "item"),
        (SageAgedPayables, "Sage aged payables (PDF)", "item"),
        (WrittenInstruction, "Written instruction + invoices settled", "item"),
        (CreditNoteForm, "Credit note + summary form (all signatures)", "item"),
        (CustomerReason, "Customer e-mail / reason + original invoice", "item"),
        (CustomerCollectionSlip, "Customer collection slip", "item"),
        (WarehouseReturnGrv, "Warehouse return GRV", "item"),
        (ReinvoiceNumber, "Re-invoice number (if re-billed)", "item"),
        (ProofOfPayment, "Proof of payment", "item"),
        (Other, "Other", "any"),
    };

    public static bool IsBatchLevel(string docType) => docType is PaymentSchedule or CreditorsRecon;
    /// <summary>Document slots that accept spreadsheets as well as PDFs.</summary>
    public static bool AllowsSpreadsheet(string docType) => docType is SupplierRecon or CreditorsRecon or PaymentSchedule;
}

/// <summary>
/// The "documents required per payment type" matrix. Required = needed to submit.
/// Required=false (and no other flag) = recommended: shown as a slot, missing ones raise a REVIEW warning but never block.
/// AfterDelivery = needed to close a prepayment. IfReturned = mandatory when stock came back (credit notes).
/// Requisitions / payment requests are handled in their own module and are not part of the pack.
/// </summary>
public static class CreditorDocRules
{
    public sealed record Rule(string DocType, bool Required, bool AfterDelivery = false, bool IfReturned = false, bool WithRecon = false);

    /// <summary>Sage aged payables sits under the payment (after the bank letter) and becomes mandatory the moment a supplier recon is attached.</summary>
    private static readonly Rule Sage = new(CreditorDocTypes.SageAgedPayables, false, WithRecon: true);

    private static readonly Dictionary<string, Rule[]> Matrix = new()
    {
        [CreditorPaymentTypes.DailyCreditor] = new[]
        {
            new Rule(CreditorDocTypes.PaymentSchedule, true),
            new Rule(CreditorDocTypes.TaxInvoice, true), new Rule(CreditorDocTypes.SupplierRecon, true),
            new Rule(CreditorDocTypes.Quote, false), new Rule(CreditorDocTypes.PurchaseOrder, false), new Rule(CreditorDocTypes.Grv, false),
            new Rule(CreditorDocTypes.ProofOfWork, false), new Rule(CreditorDocTypes.BankLetter, false), Sage,
        },
        [CreditorPaymentTypes.MonthlyCreditor] = new[]
        {
            new Rule(CreditorDocTypes.PaymentSchedule, true), new Rule(CreditorDocTypes.CreditorsRecon, true),
            new Rule(CreditorDocTypes.SupplierStatement, true),
            new Rule(CreditorDocTypes.TaxInvoice, true), new Rule(CreditorDocTypes.SupplierRecon, true),
            new Rule(CreditorDocTypes.PurchaseOrder, false), new Rule(CreditorDocTypes.Grv, false), new Rule(CreditorDocTypes.BankLetter, false), Sage,
        },
        [CreditorPaymentTypes.Prepayment] = new[]
        {
            new Rule(CreditorDocTypes.PaymentSchedule, true),
            new Rule(CreditorDocTypes.TaxInvoice, false, AfterDelivery: true), new Rule(CreditorDocTypes.SupplierRecon, false, AfterDelivery: true),
            new Rule(CreditorDocTypes.Quote, false), new Rule(CreditorDocTypes.PurchaseOrder, false), new Rule(CreditorDocTypes.Grv, false, AfterDelivery: true),
            new Rule(CreditorDocTypes.BankLetter, false), Sage,
        },
        [CreditorPaymentTypes.Intercompany] = new[]
        {
            new Rule(CreditorDocTypes.PaymentSchedule, true), new Rule(CreditorDocTypes.CreditorsRecon, true),
            new Rule(CreditorDocTypes.SupplierStatement, true),
            new Rule(CreditorDocTypes.TaxInvoice, true), new Rule(CreditorDocTypes.SupplierRecon, true),
            new Rule(CreditorDocTypes.Grv, false), new Rule(CreditorDocTypes.BankLetter, false), Sage, new Rule(CreditorDocTypes.WrittenInstruction, true),
        },
        [CreditorPaymentTypes.Utility] = new[]
        {
            new Rule(CreditorDocTypes.PaymentSchedule, true), new Rule(CreditorDocTypes.CreditorsRecon, true),
            new Rule(CreditorDocTypes.SupplierStatement, true),
            new Rule(CreditorDocTypes.TaxInvoice, true), new Rule(CreditorDocTypes.SupplierRecon, true), Sage,
        },
        [CreditorPaymentTypes.StaffPayment] = new[]
        {
            new Rule(CreditorDocTypes.PaymentSchedule, true), new Rule(CreditorDocTypes.BankLetter, false),
        },
        [CreditorPaymentTypes.CreditNote] = new[]
        {
            new Rule(CreditorDocTypes.CreditNoteForm, true),
            new Rule(CreditorDocTypes.CustomerReason, true), new Rule(CreditorDocTypes.ReinvoiceNumber, true),
            new Rule(CreditorDocTypes.CustomerCollectionSlip, false, IfReturned: true),
            new Rule(CreditorDocTypes.WarehouseReturnGrv, false, IfReturned: true),
        },
    };

    public static Rule[] For(string paymentType) => Matrix.TryGetValue(paymentType, out var r) ? r : Array.Empty<Rule>();

    /// <summary>
    /// Document types that must be present (or marked N/A) for a given payment, taking the
    /// per-item flags into account. Batch-level types are evaluated once per batch.
    /// </summary>
    public static IEnumerable<string> RequiredForItem(string paymentType, bool stockReturned, bool closingPrepayment, bool hasRecon = false)
    {
        foreach (var r in For(paymentType))
        {
            if (CreditorDocTypes.IsBatchLevel(r.DocType)) continue;
            if (r.Required) yield return r.DocType;
            else if (r.IfReturned && stockReturned) yield return r.DocType;
            else if (r.AfterDelivery && closingPrepayment) yield return r.DocType;
            else if (r.WithRecon && hasRecon) yield return r.DocType;
        }
    }

    public static IEnumerable<string> RequiredForBatch(string paymentType) =>
        For(paymentType).Where(r => r.Required && CreditorDocTypes.IsBatchLevel(r.DocType)).Select(r => r.DocType);

    /// <summary>
    /// Optional-but-wanted documents for a payment: shown as slots and raise a warning when missing, never block.
    /// Excludes anything that is currently required for the item.
    /// </summary>
    public static IEnumerable<string> RecommendedForItem(string paymentType, bool stockReturned, bool closingPrepayment, bool hasRecon = false)
    {
        var req = RequiredForItem(paymentType, stockReturned, closingPrepayment, hasRecon).ToHashSet();
        foreach (var r in For(paymentType))
        {
            if (CreditorDocTypes.IsBatchLevel(r.DocType) || r.Required || req.Contains(r.DocType)) continue;
            if (r.AfterDelivery || r.IfReturned) continue; // become required later / conditionally — not "recommended now"
            yield return r.DocType;
        }
    }
}
