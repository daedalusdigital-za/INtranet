namespace ProjectTracker.API.Models.Requisitions
{
    /// <summary>
    /// Central definition of the requisition-invoice approval workflow: the ordered
    /// stages, the role required to act at each stage, and the allowed transitions.
    /// Stages are ROLE-driven, never person-driven — assign users to roles so the
    /// workflow keeps working when people change.
    /// </summary>
    public static class RequisitionWorkflow
    {
        // ---- Stage constants (the happy path) ----
        public const string Draft = "Draft";
        public const string AwaitingReconciliation = "AwaitingReconciliation";
        public const string AwaitingAccountantApproval = "AwaitingAccountantApproval";     // Line manager (Thando/Colette)
        public const string AwaitingPaymentPreparation = "AwaitingPaymentPreparation";      // Creditors clerk builds schedule
        public const string AwaitingFinanceApproval = "AwaitingFinanceApproval";            // Aista / Zamir
        public const string AwaitingLeonaReview = "AwaitingLeonaReview";
        public const string AwaitingDuranApproval = "AwaitingDuranApproval";
        public const string AwaitingNashPayment = "AwaitingNashPayment";
        public const string Paid = "Paid";
        public const string Closed = "Closed";

        // ---- Role constants (assign users to these) ----
        public const string RoleCreditorsClerk = "req.creditors_clerk";
        public const string RoleAccountant = "req.accountant";        // line-manager approvers
        public const string RoleFinanceApprover = "req.finance_approver";
        public const string RoleLeona = "req.leona_review";
        public const string RoleDuran = "req.duran_approval";
        public const string RoleNash = "req.nash_payment";

        /// <summary>Ordered list of the happy-path stages for progress display.</summary>
        public static readonly string[] OrderedStages =
        {
            Draft,
            AwaitingReconciliation,
            AwaitingAccountantApproval,
            AwaitingPaymentPreparation,
            AwaitingFinanceApproval,
            AwaitingLeonaReview,
            AwaitingDuranApproval,
            AwaitingNashPayment,
            Paid,
            Closed
        };

        public class StageDefinition
        {
            public string Stage { get; init; } = string.Empty;
            public string Title { get; init; } = string.Empty;
            /// <summary>Role permitted to take the forward action at this stage.</summary>
            public string? ActingRole { get; init; }
            /// <summary>The forward-action verb shown to the user, e.g. "Approve".</summary>
            public string ForwardAction { get; init; } = "Approve";
            /// <summary>Stage reached on the forward action.</summary>
            public string? NextStage { get; init; }
            /// <summary>Whether a signature is required to advance from this stage.</summary>
            public bool RequiresSignature { get; init; }
            /// <summary>Whether the actor may send it back for correction.</summary>
            public bool CanReturn { get; init; } = true;
        }

        public static readonly IReadOnlyDictionary<string, StageDefinition> Stages =
            new Dictionary<string, StageDefinition>
            {
                [Draft] = new()
                {
                    Stage = Draft, Title = "Draft — capture invoice & Sage 300 ref",
                    ActingRole = RoleCreditorsClerk, ForwardAction = "Submit",
                    NextStage = AwaitingReconciliation, CanReturn = false
                },
                [AwaitingReconciliation] = new()
                {
                    Stage = AwaitingReconciliation, Title = "Awaiting Reconciliation",
                    ActingRole = RoleCreditorsClerk, ForwardAction = "Complete Reconciliation",
                    NextStage = AwaitingAccountantApproval
                },
                [AwaitingAccountantApproval] = new()
                {
                    Stage = AwaitingAccountantApproval, Title = "Awaiting Accountant (line-manager) Approval",
                    ActingRole = RoleAccountant, ForwardAction = "Approve",
                    NextStage = AwaitingPaymentPreparation, RequiresSignature = true
                },
                [AwaitingPaymentPreparation] = new()
                {
                    Stage = AwaitingPaymentPreparation, Title = "Awaiting Payment Schedule Preparation",
                    ActingRole = RoleCreditorsClerk, ForwardAction = "Submit Payment Schedule",
                    NextStage = AwaitingFinanceApproval
                },
                [AwaitingFinanceApproval] = new()
                {
                    Stage = AwaitingFinanceApproval, Title = "Awaiting Finance Approval",
                    ActingRole = RoleFinanceApprover, ForwardAction = "Approve",
                    NextStage = AwaitingLeonaReview, RequiresSignature = true
                },
                [AwaitingLeonaReview] = new()
                {
                    Stage = AwaitingLeonaReview, Title = "Awaiting Review (Leona)",
                    ActingRole = RoleLeona, ForwardAction = "Send to Duran",
                    NextStage = AwaitingDuranApproval, RequiresSignature = true
                },
                [AwaitingDuranApproval] = new()
                {
                    Stage = AwaitingDuranApproval, Title = "Awaiting Approval (Duran)",
                    ActingRole = RoleDuran, ForwardAction = "Approve",
                    NextStage = AwaitingNashPayment, RequiresSignature = true
                },
                [AwaitingNashPayment] = new()
                {
                    Stage = AwaitingNashPayment, Title = "Awaiting Payment (Nash)",
                    ActingRole = RoleNash, ForwardAction = "Record Payment",
                    NextStage = Paid, RequiresSignature = true
                },
                [Paid] = new()
                {
                    Stage = Paid, Title = "Paid",
                    ActingRole = RoleNash, ForwardAction = "Close",
                    NextStage = Closed, CanReturn = false
                },
                [Closed] = new()
                {
                    Stage = Closed, Title = "Closed", ActingRole = null,
                    ForwardAction = "", NextStage = null, CanReturn = false
                }
            };

        public static StageDefinition? Get(string stage) =>
            Stages.TryGetValue(stage, out var d) ? d : null;

        public static int StageIndex(string stage) => Array.IndexOf(OrderedStages, stage);

        public static bool IsTerminal(string stage) => stage == Closed;
    }
}
