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

    /// <summary>A clerk may delete a pack that was never signed: anything before the director's signature, plus rejected ones.</summary>
    public static readonly HashSet<string> Deletable = new() { Draft, ChecksFailed, AwaitingAccountant, QueriedByAccountant, AwaitingDirector, QueriedByDirector, Rejected };

    /// <summary>Statuses from which the batch is locked (director signed).</summary>
    public static readonly HashSet<string> Locked = new() { Approved, LoadedOnBank, Paid, Closed };

    /// <summary>Statuses that sit on the Payment Schedule: signed and waiting to be loaded / paid / closed with POP.</summary>
    public static readonly HashSet<string> OnSchedule = new() { Approved, LoadedOnBank, Paid };

    /// <summary>Packs still being prepared or approved (not yet signed, not rejected) — shown read-only to Treasury as "In progress".</summary>
    public static readonly HashSet<string> InProgress = new() { Draft, ChecksFailed, AwaitingAccountant, QueriedByAccountant, AwaitingDirector, QueriedByDirector };

    /// <summary>Where an unsigned pack sits: 0 preparing (incl. checks failed / sent back), 1 with the accountant, 2 with the director.</summary>
    public static int StageOf(string status) => status switch
    {
        AwaitingAccountant => 1,
        AwaitingDirector => 2,
        _ => 0
    };

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
    /// <summary>Paid off a requisition form (bank statement usually scanned in with it) — no invoice. Works like a staff payment.</summary>
    public const string RequisitionForm = "RequisitionForm";

    /// <summary>Payment types paid off a requisition (no invoice): requisition + bank statement, EFT or eWallet, lenient checks.</summary>
    public static bool IsRequisitionBased(string? paymentType) => paymentType is StaffPayment or RequisitionForm;
    public const string CreditNote = "CreditNote";
    /// <summary>Compliance payment (licence, cross-border payment, compliance invoice…): amount typed in by the clerk, sub-kind per payment.</summary>
    public const string Compliance = "Compliance";

    public static readonly (string Key, string Title)[] All =
    {
        (DailyCreditor, "Daily creditor"), (MonthlyCreditor, "Monthly creditor"), (Prepayment, "Prepayment"),
        (Intercompany, "Intercompany"), (Utility, "Utility"), (StaffPayment, "Staff payment"), (RequisitionForm, "Requisition form"), (CreditNote, "Credit note"),
        (Compliance, "Compliance payment"),
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
    /// <summary>Internal request / requisition form — optional supporting paper on prepayments.</summary>
    public const string Requisition = "Requisition";
    /// <summary>Staff payments: the staff member's own bank statement — confirms the account the money goes to.</summary>
    public const string BankStatement = "BankStatement";
    public const string CreditNoteForm = "CreditNoteForm";
    public const string CustomerReason = "CustomerReason";
    public const string CustomerCollectionSlip = "CustomerCollectionSlip";
    public const string WarehouseReturnGrv = "WarehouseReturnGRV";
    public const string ReinvoiceNumber = "ReinvoiceNumber";
    public const string ProofOfPayment = "ProofOfPayment";
    /// <summary>Compliance payments: the invoice, licence or payment instruction behind the amount.</summary>
    public const string ComplianceDocument = "ComplianceDocument";
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
        (Requisition, "Requisition / request form", "item"),
        (BankStatement, "Bank statement (staff member)", "item"),
        (BankLetter, "Bank letter < 3 months + AVS", "item"),
        (SageAgedPayables, "Sage aged payables (PDF)", "item"),
        (WrittenInstruction, "Written instruction + invoices settled", "item"),
        (CreditNoteForm, "Credit note + summary form (all signatures)", "item"),
        (CustomerReason, "Customer e-mail / reason + original invoice", "item"),
        (CustomerCollectionSlip, "Customer collection slip", "item"),
        (WarehouseReturnGrv, "Warehouse return GRV", "item"),
        (ReinvoiceNumber, "Re-invoice number (if re-billed)", "item"),
        (ProofOfPayment, "Proof of payment", "item"),
        (ComplianceDocument, "Compliance document (invoice / licence / instruction)", "item"),
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
/// The payment schedule is not an upload either — it is generated from the payments in the batch (GET batches/{id}/schedule).
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
            new Rule(CreditorDocTypes.TaxInvoice, true), new Rule(CreditorDocTypes.SupplierRecon, true),
            new Rule(CreditorDocTypes.Quote, false), new Rule(CreditorDocTypes.PurchaseOrder, false), new Rule(CreditorDocTypes.Grv, false),
            new Rule(CreditorDocTypes.ProofOfWork, false), new Rule(CreditorDocTypes.BankLetter, false), Sage,
        },
        [CreditorPaymentTypes.MonthlyCreditor] = new[]
        {
            new Rule(CreditorDocTypes.CreditorsRecon, true),
            new Rule(CreditorDocTypes.SupplierStatement, true),
            new Rule(CreditorDocTypes.TaxInvoice, true), new Rule(CreditorDocTypes.SupplierRecon, true),
            new Rule(CreditorDocTypes.PurchaseOrder, false), new Rule(CreditorDocTypes.Grv, false), new Rule(CreditorDocTypes.BankLetter, false), Sage,
        },
        // Prepayment: starts from the signed request form, then the quote, bank letter and PO — all four are required before it can go up.
        // Invoice, recon and GRV only become required when the prepayment is closed after delivery.
        [CreditorPaymentTypes.Prepayment] = new[]
        {
            new Rule(CreditorDocTypes.Requisition, true), new Rule(CreditorDocTypes.Quote, true),
            new Rule(CreditorDocTypes.BankLetter, true), new Rule(CreditorDocTypes.PurchaseOrder, true),
            new Rule(CreditorDocTypes.TaxInvoice, false, AfterDelivery: true), new Rule(CreditorDocTypes.SupplierRecon, false, AfterDelivery: true), new Rule(CreditorDocTypes.Grv, false, AfterDelivery: true),
            Sage,
        },
        // Intercompany: the supplier recon, supplier statement and Sage aged payables are required for every payment.
        // Everything else (tax invoice, GRV, bank letter, pack-level creditors recon) is optional.
        [CreditorPaymentTypes.Intercompany] = new[]
        {
            new Rule(CreditorDocTypes.SupplierRecon, true),
            new Rule(CreditorDocTypes.SupplierStatement, true),
            new Rule(CreditorDocTypes.SageAgedPayables, true),
            new Rule(CreditorDocTypes.TaxInvoice, false), new Rule(CreditorDocTypes.Grv, false), new Rule(CreditorDocTypes.BankLetter, false),
            new Rule(CreditorDocTypes.CreditorsRecon, false),
        },
        [CreditorPaymentTypes.Utility] = new[]
        {
            new Rule(CreditorDocTypes.CreditorsRecon, true),
            new Rule(CreditorDocTypes.SupplierStatement, true),
            // The pack-level creditors recon already covers the utility accounts, so the tax invoice is uploaded on its own — no per-invoice supplier recon.
            new Rule(CreditorDocTypes.TaxInvoice, true), Sage,
        },
        // Staff payment: no invoice. The requisition (uploaded, or filled in on the intranet and generated as a PDF) carries it;
        // the staff member's bank statement backs up EFT bank details. Deliberately lenient: the statement is only recommended
        // (a missing one is a REVIEW note, never a block) and is not expected at all for eWallet payouts.
        [CreditorPaymentTypes.StaffPayment] = new[]
        {
            new Rule(CreditorDocTypes.Requisition, true),
            new Rule(CreditorDocTypes.BankStatement, false),
        },
        // Requisition form: same as a staff payment — the requisition (with the bank statement scanned in, or separately) carries it.
        [CreditorPaymentTypes.RequisitionForm] = new[]
        {
            new Rule(CreditorDocTypes.Requisition, true),
            new Rule(CreditorDocTypes.BankStatement, false),
        },
        [CreditorPaymentTypes.CreditNote] = new[]
        {
            new Rule(CreditorDocTypes.CreditNoteForm, true),
            new Rule(CreditorDocTypes.CustomerReason, true), new Rule(CreditorDocTypes.ReinvoiceNumber, true),
            new Rule(CreditorDocTypes.CustomerCollectionSlip, false, IfReturned: true),
            new Rule(CreditorDocTypes.WarehouseReturnGrv, false, IfReturned: true),
        },
        // Compliance payment: amount typed in by hand, not derived from an invoice in the system. Kept loose for now —
        // the supporting document and bank letter are recommended (REVIEW when missing), nothing blocks.
        [CreditorPaymentTypes.Compliance] = new[]
        {
            new Rule(CreditorDocTypes.ComplianceDocument, false),
            new Rule(CreditorDocTypes.BankLetter, false),
        },
    };

    public static Rule[] For(string paymentType) => Matrix.TryGetValue(paymentType, out var r) ? r : Array.Empty<Rule>();

    /// <summary>
    /// Per-company exceptions: (company code, payment type) → document types that are optional there even though the matrix requires them.
    /// Pharmatech (PHC) prepayments: the supplier recon is optional when closing — tax invoice + GRV still close it.
    /// Pharmatech (PHC) utilities: the supplier statement is optional (still shown as a slot, warns when missing).
    /// </summary>
    private static readonly Dictionary<(string Company, string PaymentType), HashSet<string>> OptionalFor = new()
    {
        [("PHC", CreditorPaymentTypes.Prepayment)] = new() { CreditorDocTypes.SupplierRecon },
        [("PHC", CreditorPaymentTypes.Utility)] = new() { CreditorDocTypes.SupplierStatement },
    };

    public static bool IsOptionalFor(string? companyCode, string paymentType, string docType) =>
        companyCode != null && OptionalFor.TryGetValue((companyCode.ToUpperInvariant(), paymentType), out var s) && s.Contains(docType);

    /// <summary>
    /// Document types that must be present (or marked N/A) for a given payment, taking the
    /// per-item flags into account. Batch-level types are evaluated once per batch.
    /// </summary>
    public static IEnumerable<string> RequiredForItem(string paymentType, bool stockReturned, bool closingPrepayment, bool hasRecon = false, string? companyCode = null)
    {
        foreach (var r in For(paymentType))
        {
            if (CreditorDocTypes.IsBatchLevel(r.DocType)) continue;
            if (IsOptionalFor(companyCode, paymentType, r.DocType)) continue;
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
    public static IEnumerable<string> RecommendedForItem(string paymentType, bool stockReturned, bool closingPrepayment, bool hasRecon = false, string? payoutMethod = null, string? companyCode = null)
    {
        var req = RequiredForItem(paymentType, stockReturned, closingPrepayment, hasRecon, companyCode).ToHashSet();
        foreach (var r in For(paymentType))
        {
            if (CreditorDocTypes.IsBatchLevel(r.DocType) || req.Contains(r.DocType)) continue;
            // A company exception turns a required / after-delivery document into an optional slot, shown when it would otherwise have been asked for.
            if (IsOptionalFor(companyCode, paymentType, r.DocType)) { if (r.Required || (r.AfterDelivery && closingPrepayment)) yield return r.DocType; continue; }
            if (r.Required) continue;
            if (r.DocType == CreditorDocTypes.BankStatement && payoutMethod == StaffPayoutMethods.EWallet) continue; // no bank account on an eWallet payout
            if (r.AfterDelivery || r.IfReturned) continue; // become required later / conditionally — not "recommended now"
            yield return r.DocType;
        }
    }
}
