using System.Text.Json;
using ProjectTracker.API.Models.Flows;

namespace ProjectTracker.API.Services.Flows
{
    /// <summary>
    /// Operational flows — one per department — describing how that department's day-to-day work moves
    /// between people, decisions and systems inside the intranet. They are seeded once (if missing) as
    /// real, enabled, manual flows so each department can refine its own diagram over time.
    /// </summary>
    public static class FlowOperationalSeeds
    {
        private static string J(object o) => JsonSerializer.Serialize(o, FlowExpressions.JsonOpts);

        private static object Task(string id, string name, int x, int y, string title, string desc, object assignTo, string? next, int due = 24, string pri = "Normal", object[]? form = null)
            => new { id, type = "task", name, x, y, nextStepId = next, config = new { title, description = desc, assignTo, dueInHours = due, priority = pri, form = form ?? Array.Empty<object>() } };
        private static object Approval(string id, string name, int x, int y, string title, string desc, object assignTo, string approved, string rejected, int due = 24, object? escalateTo = null)
            => new { id, type = "approval", name, x, y, config = new { title, description = desc, assignTo, dueInHours = due, priority = "Normal", approvedStepId = approved, rejectedStepId = rejected, escalateTo } };
        private static object If(string id, string name, int x, int y, string expr, string yes, string? no)
            => new { id, type = "condition", name, x, y, config = new { expression = expr, trueStepId = yes, falseStepId = no } };
        private static object Notify(string id, string name, int x, int y, object to, string title, string body, string? next)
            => new { id, type = "notify", name, x, y, nextStepId = next, config = new { to, title, body } };
        private static object Email(string id, string name, int x, int y, string to, string subject, string body, string? next)
            => new { id, type = "email", name, x, y, nextStepId = next, config = new { to, subject, body } };
        private static object Wait(string id, string name, int x, int y, int hours, string? next)
            => new { id, type = "wait", name, x, y, nextStepId = next, config = new { hours } };
        private static object End(string id, string name, int x, int y, string outcome)
            => new { id, type = "end", name, x, y, config = new { outcome } };
        private static object Field(string key, string label, string type = "text", bool required = false, string[]? options = null)
            => new { key, label, type, required, options };
        private static object Dept(string name) => new { departmentName = name };
        private static object DeptRole(string name, string role) => new { departmentName = name, role };
        private static object Starter() => new { starter = true };
        private static object StarterManager() => new { starterManager = true };

        private static FlowDefinition Def(string dept, string name, string description, object[] inputs, string start, object[] steps, string titleTemplate, int level = 1) => new()
        {
            Name = name, Description = description, Category = "Operations", DepartmentName = dept, Level = level,
            TriggerType = FlowTriggerType.Manual, IsTemplate = false, IsEnabled = true,
            TriggerJson = J(new { titleTemplate }), InputsJson = J(inputs), GraphJson = J(new { startStepId = start, steps })
        };

        public static List<FlowDefinition> All() => new()
        {
            // ── Logistics ─────────────────────────────────────────────────────────────
            Def("Logistics", "Logistics · Delivery operations",
                "How a delivery moves through Logistics: the controller plans the load, a driver delivers, POD is confirmed, exceptions are triaged by the manager and Accounts is told to invoice.",
                new object[] { Field("waybill", "Waybill / order number", required: true), Field("customer", "Customer", required: true), Field("destination", "Destination"), Field("customerEmail", "Customer email") },
                "plan",
                new object[]
                {
                    Task("plan", "Controller plans load", 60, 60, "Plan load for {{inputs.waybill}} · {{inputs.customer}}", "Assign vehicle and driver, confirm route to {{inputs.destination}}.", DeptRole("Logistics", "Manager"), "veh", 4, "High",
                        new[] { Field("vehicleAvailable", "Vehicle available?", "select", true, new[] { "Yes", "No" }), Field("driver", "Driver") }),
                    If("veh", "Vehicle available?", 380, 60, "steps.plan.vehicleAvailable == \"Yes\"", "dispatch", "subcon"),
                    Task("subcon", "Arrange subcontractor", 380, 260, "Arrange subcontractor for {{inputs.waybill}}", "No fleet vehicle available — book an outside carrier.", DeptRole("Logistics", "Manager"), "dispatch", 8, "High"),
                    Task("dispatch", "Driver delivers", 700, 60, "Deliver {{inputs.waybill}} to {{inputs.customer}}", "Driver: {{steps.plan.driver}}. Capture POD on delivery.", Dept("Logistics"), "pod", 24, "Normal",
                        new[] { Field("delivered", "Delivered?", "select", true, new[] { "Yes", "No" }), Field("podReceived", "POD received?", "select", true, new[] { "Yes", "No" }) }),
                    If("pod", "Delivered with POD?", 1020, 60, "steps.dispatch.delivered == \"Yes\" && steps.dispatch.podReceived == \"Yes\"", "bill", "triage"),
                    Notify("bill", "Tell Accounts to invoice", 1340, 60, Dept("Accounts"), "Ready to invoice: {{inputs.waybill}}", "{{inputs.customer}} delivered with POD by {{steps.dispatch.completedBy}}.", "done"),
                    End("done", "Delivered", 1660, 60, "delivered"),
                    Task("triage", "Manager triages exception", 1020, 260, "Exception on {{inputs.waybill}}", "Delivered: {{steps.dispatch.delivered}} · POD: {{steps.dispatch.podReceived}}. Decide redelivery / claim / chase POD.", DeptRole("Logistics", "Manager"), "cust", 8, "Urgent",
                        new[] { Field("action", "Action", "select", true, new[] { "Redeliver", "Chase POD", "Claim", "Cancel" }) }),
                    Email("cust", "Update customer", 1340, 260, "{{inputs.customerEmail}}", "Update on your delivery {{inputs.waybill}}", "Hi {{inputs.customer}}, action taken: {{steps.triage.action}}. {{steps.triage.comment}}", "exc"),
                    End("exc", "Exception handled", 1660, 260, "exception"),
                },
                "Delivery · {{inputs.waybill}} · {{inputs.customer}}"),

            // ── Sales ─────────────────────────────────────────────────────────────────
            Def("Sales", "Sales · Enquiry to order",
                "How Sales turns an enquiry into an order: log, quote, manager sign-off on big deals, send, follow up, and hand over to Stock and Accounts when won.",
                new object[] { Field("customer", "Customer", required: true), Field("customerEmail", "Customer email", required: true), Field("enquiry", "What do they want?", "textarea", true) },
                "quote",
                new object[]
                {
                    Task("quote", "Prepare quote", 60, 60, "Quote for {{inputs.customer}}", "{{inputs.enquiry}}", Dept("Sales"), "big", 24, "Normal",
                        new[] { Field("amount", "Quote total (R)", "number", true), Field("quoteNo", "Quote number") }),
                    If("big", "Over R100 000?", 380, 60, "steps.quote.amount > 100000", "approve", "send"),
                    Approval("approve", "Sales manager sign-off", 380, 260, "Approve quote {{steps.quote.quoteNo}} · R{{steps.quote.amount}}", "Customer {{inputs.customer}}. Prepared by {{steps.quote.completedBy}}.", DeptRole("Sales", "Manager"), "send", "lost", 8),
                    Email("send", "Send quote", 700, 60, "{{inputs.customerEmail}}", "Quote {{steps.quote.quoteNo}} from Sales", "Hi {{inputs.customer}}, please find our quote for R{{steps.quote.amount}}. Prepared by {{run.startedBy}}.", "wait"),
                    Wait("wait", "Give them 2 days", 1020, 60, 48, "follow"),
                    Task("follow", "Follow up", 1340, 60, "Follow up {{inputs.customer}} on quote {{steps.quote.quoteNo}}", "Call / email and record the outcome.", Starter(), "won", 24, "Normal",
                        new[] { Field("outcome", "Outcome", "select", true, new[] { "Won", "Lost", "Pending" }) }),
                    If("won", "Won?", 1660, 60, "steps.follow.outcome == \"Won\"", "handover", "lost"),
                    Notify("handover", "Hand over to Stock & Accounts", 1980, 60, Dept("Stock"), "New order: {{inputs.customer}} · R{{steps.quote.amount}}", "Quote {{steps.quote.quoteNo}} won by {{run.startedBy}} — please pick and invoice.", "acc"),
                    Notify("acc", "Tell Accounts", 2300, 60, Dept("Accounts"), "Invoice required: {{inputs.customer}}", "Order from quote {{steps.quote.quoteNo}} · R{{steps.quote.amount}}.", "end_won"),
                    End("end_won", "Won", 2620, 60, "won"),
                    End("lost", "Lost / declined", 1660, 260, "lost"),
                },
                "Sale · {{inputs.customer}}"),

            // ── Stock ─────────────────────────────────────────────────────────────────
            Def("Stock", "Stock · Goods receiving",
                "How Stock receives goods: check the delivery against the order, raise discrepancies with Accounts and the supplier, bin and update the system, and tell Sales what is available.",
                new object[] { Field("supplier", "Supplier", required: true), Field("poNumber", "PO / order number", required: true), Field("branch", "Branch", "select", true, new[] { "GP", "CPT", "KZN", "PE" }) },
                "check",
                new object[]
                {
                    Task("check", "Check delivery vs PO", 60, 60, "Receive {{inputs.poNumber}} from {{inputs.supplier}} ({{inputs.branch}})", "Count and inspect. Note shortages or damage.", Dept("Stock"), "disc", 8, "High",
                        new[] { Field("matches", "Matches the PO?", "select", true, new[] { "Yes", "No" }), Field("notes", "Discrepancy notes", "textarea") }),
                    If("disc", "Discrepancy?", 380, 60, "steps.check.matches == \"No\"", "query", "bin"),
                    Task("query", "Query supplier", 380, 260, "Supplier query: {{inputs.poNumber}}", "{{steps.check.notes}}", DeptRole("Stock", "Manager"), "tell_acc", 24, "High"),
                    Notify("tell_acc", "Tell Accounts", 700, 260, Dept("Accounts"), "Hold supplier invoice: {{inputs.poNumber}}", "Discrepancy on {{inputs.supplier}} delivery: {{steps.check.notes}}", "bin"),
                    Task("bin", "Bin & update system", 700, 60, "Bin and capture {{inputs.poNumber}}", "Put away, label and update stock on hand.", Dept("Stock"), "sales", 8),
                    Notify("sales", "Tell Sales stock is in", 1020, 60, Dept("Sales"), "Stock received: {{inputs.poNumber}}", "{{inputs.supplier}} goods are available at {{inputs.branch}}.", "end"),
                    End("end", "Received", 1340, 60, "received"),
                },
                "GRV · {{inputs.poNumber}} · {{inputs.supplier}}"),

            // ── Accounts ──────────────────────────────────────────────────────────────
            Def("Accounts", "Accounts · Invoice to payment",
                "How Accounts gets paid: capture the invoice, make sure POD is attached (chase Logistics if not), send it, wait, check payment and escalate overdue accounts.",
                new object[] { Field("customer", "Customer", required: true), Field("invoiceNo", "Invoice number", required: true), Field("amount", "Amount (R)", "number", true), Field("customerEmail", "Customer email") },
                "capture",
                new object[]
                {
                    Task("capture", "Capture invoice", 60, 60, "Capture {{inputs.invoiceNo}} · {{inputs.customer}}", "R{{inputs.amount}}. Attach POD before sending.", Dept("Accounts"), "haspod", 8, "Normal",
                        new[] { Field("podAttached", "POD attached?", "select", true, new[] { "Yes", "No" }) }),
                    If("haspod", "POD attached?", 380, 60, "steps.capture.podAttached == \"Yes\"", "send", "getpod"),
                    Task("getpod", "Logistics: supply POD", 380, 260, "POD needed for invoice {{inputs.invoiceNo}}", "Customer {{inputs.customer}} — upload the signed POD.", Dept("Logistics"), "send", 24, "High"),
                    Email("send", "Send invoice", 700, 60, "{{inputs.customerEmail}}", "Invoice {{inputs.invoiceNo}}", "Dear {{inputs.customer}}, please find invoice {{inputs.invoiceNo}} for R{{inputs.amount}}.", "wait"),
                    Wait("wait", "30-day terms", 1020, 60, 720, "paycheck"),
                    Task("paycheck", "Check payment", 1340, 60, "Payment received for {{inputs.invoiceNo}}?", "Check the bank / allocation.", Dept("Accounts"), "paid", 24, "Normal",
                        new[] { Field("paid", "Paid?", "select", true, new[] { "Yes", "No" }) }),
                    If("paid", "Paid?", 1660, 60, "steps.paycheck.paid == \"Yes\"", "end_paid", "remind"),
                    End("end_paid", "Paid", 1980, 60, "paid"),
                    Email("remind", "Send reminder", 1660, 260, "{{inputs.customerEmail}}", "Reminder: invoice {{inputs.invoiceNo}} overdue", "Invoice {{inputs.invoiceNo}} (R{{inputs.amount}}) is now overdue.", "esc"),
                    Task("esc", "Manager: collections", 1980, 260, "Overdue: {{inputs.customer}} · {{inputs.invoiceNo}}", "Decide on hold / handover / payment plan.", DeptRole("Accounts", "Manager"), "end_over", 48, "Urgent"),
                    End("end_over", "Overdue handled", 2300, 260, "overdue"),
                },
                "Invoice · {{inputs.invoiceNo}} · {{inputs.customer}}"),

            // ── Finance ───────────────────────────────────────────────────────────────
            Def("Finance Department", "Finance · Month-end close",
                "How Finance closes the month: collect expenses, reconcile the bank, review by the finance manager, then report to management.",
                new object[] { Field("period", "Period (e.g. Oct 2026)", required: true) },
                "expenses",
                new object[]
                {
                    Task("expenses", "Collect expense claims", 60, 60, "{{inputs.period}}: collect expense claims", "Chase outstanding claims and receipts in the Expense tracker.", Dept("Finance Department"), "recon", 48),
                    Task("recon", "Reconcile bank", 380, 60, "{{inputs.period}}: bank reconciliation", "Match statements to the ledger; flag unallocated items.", Dept("Finance Department"), "review", 48, "High",
                        new[] { Field("unallocated", "Unallocated items", "number") }),
                    Approval("review", "Finance manager review", 700, 60, "{{inputs.period}} close ready for review", "Unallocated items: {{steps.recon.unallocated}}.", DeptRole("Finance Department", "Manager"), "report", "recon", 24),
                    Notify("report", "Report to management", 1020, 60, new { role = "Super Admin" }, "{{inputs.period}} month-end closed", "Closed by {{steps.review.completedBy}}. {{steps.review.comment}}", "end"),
                    End("end", "Closed", 1340, 60, "closed"),
                },
                "Month-end · {{inputs.period}}"),

            // ── HR ────────────────────────────────────────────────────────────────────
            Def("HR Department", "HR · Staff request handling",
                "How HR handles a staff request (leave, letter, change of details): the line manager approves, HR updates records, the employee is told.",
                new object[] { Field("type", "Request type", "select", true, new[] { "Leave", "Employment letter", "Change of details", "Other" }), Field("details", "Details", "textarea", true) },
                "mgr",
                new object[]
                {
                    Approval("mgr", "Line manager approval", 60, 60, "{{inputs.type}} request from {{run.startedBy}}", "{{inputs.details}}", StarterManager(), "hr", "declined", 24, new { departmentName = "HR Department" }),
                    Task("hr", "HR updates records", 380, 60, "Process {{inputs.type}} for {{run.startedBy}}", "Approved by {{steps.mgr.completedBy}}. {{inputs.details}}", Dept("HR Department"), "tell", 24),
                    Notify("tell", "Tell employee", 700, 60, Starter(), "Your {{inputs.type}} request is done", "Processed by {{steps.hr.completedBy}}.", "end"),
                    End("end", "Done", 1020, 60, "done"),
                    Notify("declined", "Tell employee (declined)", 380, 260, Starter(), "Your {{inputs.type}} request was declined", "{{steps.mgr.comment}}", "end_dec"),
                    End("end_dec", "Declined", 700, 260, "declined"),
                },
                "{{inputs.type}} · {{run.startedBy}}"),

            // ── IT ────────────────────────────────────────────────────────────────────
            Def("IT Department", "IT · Support request",
                "How IT handles a support request: Welly classifies and prioritises it, urgent issues alert the whole team, the technician fixes it and the requester confirms.",
                new object[] { Field("issue", "What's wrong?", "textarea", true), Field("asset", "Device / asset tag") },
                "ai",
                new object[]
                {
                    new { id = "ai", type = "ai_analyze", name = "Welly classifies", x = 60, y = 60, nextStepId = "urgent",
                          config = new { outputKey = "ai", prompt = "Classify this IT support request. Issue: {{inputs.issue}}. Asset: {{inputs.asset}}.",
                                         fields = new object[] { new { key = "category", description = "hardware, software, network, access or other" }, new { key = "priority", description = "Low, Normal, High or Urgent" }, new { key = "summary", description = "One-line summary" } } } },
                    If("urgent", "Urgent?", 380, 60, "ai.priority == \"Urgent\"", "alert", "fix"),
                    Notify("alert", "Alert IT team", 380, 260, Dept("IT Department"), "URGENT: {{ai.summary}}", "From {{run.startedBy}}. {{inputs.issue}}", "fix"),
                    Task("fix", "Technician resolves", 700, 60, "{{ai.category}}: {{ai.summary}}", "{{inputs.issue}}\nAsset: {{inputs.asset}}", Dept("IT Department"), "confirm", 24, "{{ai.priority}}",
                        new[] { Field("resolution", "What was done", "textarea", true) }),
                    Task("confirm", "Requester confirms", 1020, 60, "Is your issue fixed?", "{{steps.fix.completedBy}} says: {{steps.fix.resolution}}", Starter(), "ok", 48, "Normal",
                        new[] { Field("fixed", "Fixed?", "select", true, new[] { "Yes", "No" }) }),
                    If("ok", "Fixed?", 1340, 60, "steps.confirm.fixed == \"Yes\"", "end", "fix"),
                    End("end", "Resolved", 1660, 60, "resolved"),
                },
                "IT · {{inputs.issue}}", 2),

            // ── Marketing ─────────────────────────────────────────────────────────────
            Def("Marketing Department", "Marketing · Campaign & announcement",
                "How Marketing gets a campaign or internal announcement out: brief, manager approval, then it is published on the intranet.",
                new object[] { Field("title", "Title", required: true), Field("message", "Message / brief", "textarea", true), Field("audience", "Audience", "select", false, new[] { "Everyone", "Customers", "Staff" }) },
                "brief",
                new object[]
                {
                    Task("brief", "Prepare content", 60, 60, "Prepare: {{inputs.title}}", "{{inputs.message}}\nAudience: {{inputs.audience}}", Dept("Marketing Department"), "approve", 48),
                    Approval("approve", "Marketing manager approval", 380, 60, "Approve: {{inputs.title}}", "Prepared by {{steps.brief.completedBy}}.", DeptRole("Marketing Department", "Manager"), "publish", "brief", 24),
                    new { id = "publish", type = "welly_action", name = "Publish announcement", x = 700, y = 60, nextStepId = "end",
                          config = new { action = "CREATE_ANNOUNCEMENT", failOnError = false, payload = new { title = "{{inputs.title}}", content = "{{inputs.message}}" } } },
                    End("end", "Published", 1020, 60, "published"),
                },
                "Campaign · {{inputs.title}}"),

            // ── Production ────────────────────────────────────────────────────────────
            Def("Production", "Production · Work order",
                "How Production runs a work order: schedule, produce, QC inspection; rework loops back to QC until it passes, then Stock is told.",
                new object[] { Field("product", "Product", required: true), Field("qty", "Quantity", "number", true), Field("dueDate", "Required by", "date") },
                "schedule",
                new object[]
                {
                    Task("schedule", "Schedule run", 60, 60, "Schedule {{inputs.qty}} × {{inputs.product}}", "Required by {{inputs.dueDate}}. Confirm materials and line.", DeptRole("Production", "Manager"), "produce", 8),
                    Task("produce", "Produce", 380, 60, "Produce {{inputs.qty}} × {{inputs.product}}", "Record actual quantity.", Dept("Production"), "qc", 48, "Normal",
                        new[] { Field("actualQty", "Actual quantity", "number", true) }),
                    Task("qc", "QC inspection", 700, 60, "QC: {{inputs.product}}", "Inspect batch of {{steps.produce.actualQty}}.", Dept("Production"), "pass", 8, "High",
                        new[] { Field("pass", "Pass?", "select", true, new[] { "Yes", "No" }), Field("defects", "Defects noted", "textarea") }),
                    If("pass", "Passed QC?", 1020, 60, "steps.qc.pass == \"Yes\"", "stock", "rework"),
                    Task("rework", "Rework", 1020, 260, "Rework {{inputs.product}}", "{{steps.qc.defects}}", Dept("Production"), "qc", 24, "High"),
                    Notify("stock", "Tell Stock", 1340, 60, Dept("Stock"), "Finished goods: {{steps.produce.actualQty}} × {{inputs.product}}", "Passed QC by {{steps.qc.completedBy}} — ready to receive.", "end"),
                    End("end", "Completed", 1660, 60, "completed"),
                },
                "Work order · {{inputs.product}} × {{inputs.qty}}"),

            // ── Reception ─────────────────────────────────────────────────────────────
            Def("Reception", "Reception · Visitors & deliveries",
                "How Reception handles arrivals: the host is told a visitor is here; parcels are handed to Stock.",
                new object[] { Field("who", "Visitor / courier", required: true), Field("host", "Here to see (name or email)"), Field("kind", "Type", "select", true, new[] { "Visitor", "Parcel", "Both" }) },
                "kind",
                new object[]
                {
                    If("kind", "Parcel?", 60, 60, "inputs.kind == \"Parcel\"", "stock", "host"),
                    Notify("host", "Tell host", 380, 60, new { expression = "{{inputs.host}}" }, "{{inputs.who}} is at reception", "Logged by {{run.startedBy}}.", "meet"),
                    Task("meet", "Host collects visitor", 700, 60, "Collect {{inputs.who}} from reception", "", new { expression = "{{inputs.host}}" }, "both", 1, "High"),
                    If("both", "Also a parcel?", 1020, 60, "inputs.kind == \"Both\"", "stock", "end"),
                    Task("stock", "Stock collects parcel", 1020, 260, "Parcel at reception from {{inputs.who}}", "Collect and book in.", Dept("Stock"), "end", 4),
                    End("end", "Done", 1340, 60, "done"),
                },
                "Reception · {{inputs.who}}"),
        };
    }
}
