using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Flows;

namespace ProjectTracker.API.Services.Flows
{
    /// <summary>Starter flows. Seeded once as templates (IsTemplate=true); users clone them into live flows.</summary>
    public static class FlowTemplates
    {
        private static bool _checked;

        public static async Task EnsureSeededAsync(ApplicationDbContext db, CancellationToken ct)
        {
            if (_checked) return;
            _checked = true;
            var existing = await db.FlowDefinitions.Where(d => d.IsTemplate).ToListAsync(ct);
            foreach (var t in All())
            {
                var cur = existing.FirstOrDefault(e => e.Name == t.Name);
                if (cur == null) { db.FlowDefinitions.Add(t); continue; }
                // System templates are kept current with the code (users clone them, never edit them in place)
                if (cur.GraphJson != t.GraphJson || cur.TriggerJson != t.TriggerJson || cur.InputsJson != t.InputsJson || cur.Description != t.Description)
                {
                    cur.GraphJson = t.GraphJson; cur.TriggerJson = t.TriggerJson; cur.InputsJson = t.InputsJson; cur.Description = t.Description;
                    cur.Category = t.Category; cur.Level = t.Level; cur.TriggerType = t.TriggerType; cur.Version++; cur.UpdatedAt = DateTime.UtcNow;
                }
            }
            // Operational (department) flows: created once, then owned/edited by the business — never overwritten.
            var opsNames = await db.FlowDefinitions.Where(d => d.DepartmentName != null).Select(d => d.Name).ToListAsync(ct);
            foreach (var o in FlowOperationalSeeds.All())
                if (!opsNames.Contains(o.Name)) db.FlowDefinitions.Add(o);
            await db.SaveChangesAsync(ct);
        }

        private static string J(object o) => JsonSerializer.Serialize(o, FlowExpressions.JsonOpts);

        public static List<FlowDefinition> All() => new()
        {
            // ── Level 1 · Manual ──────────────────────────────────────────────────────
            new FlowDefinition
            {
                Name = "Purchase request approval",
                Description = "Level 1 · Manual. Procure to pay, step one. Anyone raises a purchase request; the department head approves, Accounts signs off above R20 000 and Management above R50 000 (the approval matrix); Accounts is then told to raise the PO.",
                Category = "Finance", Level = 1, TriggerType = FlowTriggerType.Manual, IsTemplate = true, IsEnabled = true,
                TriggerJson = J(new { titleTemplate = "Purchase: {{inputs.item}} — R{{inputs.amount}}" }),
                InputsJson = J(new object[]
                {
                    new { key = "item", label = "What do you need?", type = "text", required = true },
                    new { key = "amount", label = "Estimated amount (R)", type = "number", required = true },
                    new { key = "supplier", label = "Preferred supplier", type = "text" },
                    new { key = "reason", label = "Business reason", type = "textarea", required = true }
                }),
                GraphJson = J(new
                {
                    startStepId = "approve",
                    steps = new object[]
                    {
                        new { id = "approve", type = "approval", name = "Manager approval", x = 80, y = 60,
                              config = new { title = "Approve purchase: {{inputs.item}} (R{{inputs.amount}})",
                                             description = "Requested by {{run.startedBy}}.\nSupplier: {{inputs.supplier}}\nReason: {{inputs.reason}}",
                                             assignTo = new { starterManager = true }, dueInHours = 24, priority = "Normal",
                                             escalateTo = new { role = "Admin" },
                                             approvedStepId = "bigcheck", rejectedStepId = "rejected" } },
                        new { id = "bigcheck", type = "condition", name = "Over R20 000?", x = 80, y = 200,
                              config = new { expression = "inputs.amount > 20000", trueStepId = "finance_approve", falseStepId = "notify_finance" } },
                        new { id = "finance_approve", type = "approval", name = "Finance approval", x = 300, y = 200,
                              config = new { title = "Finance sign-off: {{inputs.item}} (R{{inputs.amount}})",
                                             description = "Manager approved by {{steps.approve.completedBy}}. Comment: {{steps.approve.comment}}",
                                             assignTo = new { departmentName = "Accounts" }, dueInHours = 48, priority = "High",
                                             approvedStepId = "mgmtcheck", rejectedStepId = "rejected" } },
                        new { id = "mgmtcheck", type = "condition", name = "Over R50 000?", x = 520, y = 200,
                              config = new { expression = "inputs.amount > 50000", trueStepId = "mgmt_approve", falseStepId = "notify_finance" } },
                        new { id = "mgmt_approve", type = "approval", name = "Management approval", x = 740, y = 200,
                              config = new { title = "Management sign-off: {{inputs.item}} (R{{inputs.amount}})",
                                             description = "Above the R50 000 limit. Manager: {{steps.approve.completedBy}}. Finance: {{steps.finance_approve.completedBy}} — {{steps.finance_approve.comment}}",
                                             assignTo = new { role = "Admin" }, dueInHours = 48, priority = "High",
                                             approvedStepId = "notify_finance", rejectedStepId = "rejected" } },
                        new { id = "notify_finance", type = "notify", name = "Tell finance + requester", nextStepId = "notify_req_ok", x = 80, y = 340,
                              config = new { to = new { departmentName = "Accounts" }, title = "Purchase approved: {{inputs.item}}",
                                             body = "R{{inputs.amount}} for {{run.startedBy}} — please raise the PO." } },
                        new { id = "notify_req_ok", type = "notify", name = "Notify requester", nextStepId = "done", x = 80, y = 440,
                              config = new { to = new { starter = true }, title = "Your purchase request was approved", body = "{{inputs.item}} — finance will raise the PO." } },
                        new { id = "done", type = "end", name = "Approved", x = 80, y = 540, config = new { outcome = "approved" } },
                        new { id = "rejected", type = "notify", name = "Notify requester (rejected)", nextStepId = "end_rej", x = 520, y = 340,
                              config = new { to = new { starter = true }, title = "Purchase request declined", body = "{{inputs.item}} was declined. Comment: {{lastDecision}} — {{steps.approve.comment}}{{steps.finance_approve.comment}}" } },
                        new { id = "end_rej", type = "end", name = "Rejected", x = 520, y = 440, config = new { outcome = "rejected" } },
                    }
                })
            },

            // ── Level 2 · AI-assisted ─────────────────────────────────────────────────
            new FlowDefinition
            {
                Name = "Delivery exception triage",
                Description = "Level 2 · AI-assisted. When a driver logs a failed delivery or collection, Welly reads the exception, classifies it, suggests a resolution and priority, then hands a pre-filled task to Ops. If the customer is at fault, the account manager is looped in.",
                Category = "Logistics", Level = 2, TriggerType = FlowTriggerType.Event, IsTemplate = true, IsEnabled = true,
                TriggerJson = J(new { @event = "shipment.status_changed", filter = "entity.status in [\"DELIVERY_FAILED\",\"COLLECTION_FAILED\"]", dedupeByEntity = true,
                                      titleTemplate = "{{entity.status}} · {{entity.waybillNo}} · {{entity.customerName}}" }),
                InputsJson = "[]",
                GraphJson = J(new
                {
                    startStepId = "analyse",
                    steps = new object[]
                    {
                        new { id = "analyse", type = "ai_analyze", name = "Welly classifies the exception", nextStepId = "severe", x = 80, y = 60,
                              config = new { outputKey = "ai",
                                             prompt = "A shipment failed. Classify the root cause from lastException (reasonCode/note) as one of: customer_closed, wrong_address, customer_refused, driver_issue, vehicle_issue, access_problem, unknown. Decide whether the customer is at fault (true/false). Suggest the single best next action for Ops in one sentence. Set priority Urgent if the shipment is fragile/hazardous or the customer has multiple open exceptions, otherwise High for delivery failures and Normal for collection failures.",
                                             fields = new object[]
                                             {
                                                 new { key = "category", description = "one of the categories listed" },
                                                 new { key = "customerAtFault", description = "true or false" },
                                                 new { key = "priority", description = "Low, Normal, High or Urgent" },
                                                 new { key = "nextAction", description = "one sentence recommendation for Ops" },
                                                 new { key = "summary", description = "two sentence plain-English summary for a manager" }
                                             } } },
                        new { id = "severe", type = "condition", name = "Urgent?", x = 80, y = 200,
                              config = new { expression = "ai.priority == \"Urgent\"", trueStepId = "alert_mgr", falseStepId = "ops_task" } },
                        new { id = "alert_mgr", type = "notify", name = "Alert logistics managers", nextStepId = "ops_task", x = 320, y = 200,
                              config = new { to = new { role = "Manager" }, title = "🚨 Urgent exception {{entity.waybillNo}}", body = "{{ai.summary}}" } },
                        new { id = "ops_task", type = "task", name = "Ops resolves", nextStepId = "cust_fault", x = 80, y = 340,
                              config = new { title = "Resolve {{entity.status}} on {{entity.waybillNo}} ({{entity.customerName}})",
                                             description = "Welly: {{ai.summary}}\n\nRecommended: {{ai.nextAction}}\nCategory: {{ai.category}}\nDriver: {{entity.driverName}} · Load {{entity.loadNumber}}\nDelivery: {{entity.deliveryAddress}} ({{entity.deliveryContact}} {{entity.deliveryPhone}})\nException note: {{entity.lastException.note}}",
                                             assignTo = new { departmentName = "Logistics" }, priority = "{{ai.priority}}", dueInHours = 4,
                                             escalateTo = new { role = "Manager" },
                                             form = new object[] { new { key = "resolution", label = "Resolution", type = "select", options = new[] { "replan", "return_to_sender", "cancel" }, required = true } } } },
                        new { id = "cust_fault", type = "condition", name = "Customer at fault?", x = 80, y = 480,
                              config = new { expression = "ai.customerAtFault == true", trueStepId = "notify_sales", falseStepId = "end" } },
                        new { id = "notify_sales", type = "notify", name = "Loop in account manager", nextStepId = "end", x = 320, y = 480,
                              config = new { to = new { departmentName = "Sales" }, title = "Customer-caused failure: {{entity.customerName}}", body = "{{entity.waybillNo}} — {{ai.summary}} Ops resolution: {{steps.ops_task.resolution}}" } },
                        new { id = "end", type = "end", name = "Closed", x = 80, y = 620, config = new { outcome = "resolved:{{steps.ops_task.resolution}}" } },
                    }
                })
            },

            // ── Level 3 · Automated ───────────────────────────────────────────────────
            new FlowDefinition
            {
                Name = "Missing POD chaser",
                Description = "Level 3 · Automated. Every 30 minutes find shipments delivered 24h+ ago without a proof of delivery. Welly drafts a chase, Ops gets a task to upload the POD; if still missing after 24h it escalates to the logistics manager and the customer's account manager is informed.",
                Category = "Logistics", Level = 3, TriggerType = FlowTriggerType.Schedule, IsTemplate = true, IsEnabled = true,
                TriggerJson = J(new { intervalMinutes = 30, dataSource = "shipments_missing_pod", @params = new Dictionary<string, string> { ["hours"] = "24" }, dedupeByEntity = true,
                                      titleTemplate = "Missing POD · {{entity.waybillNo}} · {{entity.customerName}}" }),
                InputsJson = "[]",
                GraphJson = J(new
                {
                    startStepId = "draft",
                    steps = new object[]
                    {
                        new { id = "draft", type = "ai_analyze", name = "Welly drafts the chase", nextStepId = "task", x = 80, y = 60,
                              config = new { outputKey = "ai",
                                             prompt = "This shipment was delivered but no POD (signature/photo) was captured. Write a short, friendly WhatsApp-style message to the driver asking them to upload the POD for this waybill, mentioning the customer and delivery city. Also rate the risk of a billing dispute as Low/Normal/High based on hoursSinceDelivered and customer.",
                                             fields = new object[]
                                             {
                                                 new { key = "driverMessage", description = "message to send to the driver" },
                                                 new { key = "risk", description = "Low, Normal or High" },
                                                 new { key = "summary", description = "one sentence for the ops controller" }
                                             } } },
                        new { id = "task", type = "task", name = "Ops chases driver / uploads POD", nextStepId = "check", x = 80, y = 200,
                              config = new { title = "Upload POD for {{entity.waybillNo}} ({{entity.customerName}})",
                                             description = "Delivered {{entity.deliveredAt}} ({{entity.hoursSinceDelivered}}h ago) by {{entity.driverName}} on load {{entity.loadNumber}}.\n{{ai.summary}}\n\nSuggested message to driver:\n{{ai.driverMessage}}",
                                             assignTo = new { departmentName = "Logistics" }, priority = "{{ai.risk}}", dueInHours = 24,
                                             escalateTo = new { role = "Manager" },
                                             form = new object[] { new { key = "outcome", label = "Outcome", type = "select", options = new[] { "pod_uploaded", "driver_unreachable", "customer_disputes" }, required = true } } } },
                        new { id = "check", type = "condition", name = "POD uploaded?", x = 80, y = 340,
                              config = new { expression = "steps.task.outcome == \"pod_uploaded\"", trueStepId = "done", falseStepId = "escalate" } },
                        new { id = "escalate", type = "notify", name = "Inform manager + sales", nextStepId = "end_open", x = 320, y = 340,
                              config = new { to = new { role = "Manager" }, title = "POD still missing: {{entity.waybillNo}}", body = "{{entity.customerName}} · outcome: {{steps.task.outcome}} · {{steps.task.comment}}" } },
                        new { id = "done", type = "end", name = "POD received", x = 80, y = 480, config = new { outcome = "pod_received" } },
                        new { id = "end_open", type = "end", name = "Unresolved", x = 320, y = 480, config = new { outcome = "unresolved" } },
                    }
                })
            },

            // ── Level 1 · Manual (HR) ─────────────────────────────────────────────────
            new FlowDefinition
            {
                Name = "New starter onboarding",
                Description = "Level 1 · Manual. HR kicks off onboarding; IT, Accounts and the line manager each get a task with a deadline; HR is notified when everything is done.",
                Category = "HR", Level = 1, TriggerType = FlowTriggerType.Manual, IsTemplate = true, IsEnabled = true,
                TriggerJson = J(new { titleTemplate = "Onboarding: {{inputs.name}} ({{inputs.startDate}})" }),
                InputsJson = J(new object[]
                {
                    new { key = "name", label = "New starter name", type = "text", required = true },
                    new { key = "role", label = "Job title", type = "text", required = true },
                    new { key = "department", label = "Department", type = "department", required = true },
                    new { key = "startDate", label = "Start date", type = "date", required = true },
                    new { key = "manager", label = "Line manager", type = "user", required = true }
                }),
                GraphJson = J(new
                {
                    startStepId = "it",
                    steps = new object[]
                    {
                        new { id = "it", type = "task", name = "IT: accounts & laptop", nextStepId = "fac", x = 80, y = 60,
                              config = new { title = "IT setup for {{inputs.name}} ({{inputs.role}})", description = "Create email, intranet login, laptop. Starts {{inputs.startDate}}. Manager: {{inputs.manager}}.",
                                             assignTo = new { departmentName = "IT Department" }, dueInHours = 72, priority = "High", escalateTo = new { role = "Admin" } } },
                        new { id = "fac", type = "task", name = "Accounts: payroll & access card", nextStepId = "mgr", x = 80, y = 200,
                              config = new { title = "Payroll setup + access card for {{inputs.name}}", description = "Department {{inputs.department}}. Starts {{inputs.startDate}}.",
                                             assignTo = new { departmentName = "Accounts" }, dueInHours = 72, priority = "Normal" } },
                        new { id = "mgr", type = "task", name = "Manager: first-week plan", nextStepId = "hr", x = 80, y = 340,
                              config = new { title = "First-week plan for {{inputs.name}}", description = "Prepare induction schedule and buddy.",
                                             assignTo = new { expression = "{{inputs.manager}}" }, dueInHours = 48, priority = "Normal" } },
                        new { id = "hr", type = "notify", name = "Tell HR", nextStepId = "end", x = 80, y = 480,
                              config = new { to = new { starter = true }, title = "Onboarding ready: {{inputs.name}}", body = "IT, Accounts and {{steps.mgr.completedBy}} have completed their tasks." } },
                        new { id = "end", type = "end", name = "Done", x = 80, y = 600, config = new { outcome = "onboarded" } },
                    }
                })
            },

            // ── Level 1 · Manual (HR) — hire to retire, the exit half ─────────────────
            new FlowDefinition
            {
                Name = "Leaver offboarding",
                Description = "Level 1 · Manual. Hire to retire, on exit. HR records the leaving date; IT removes access and recovers devices, the line manager hands over work, Accounts runs final pay; HR closes the employee record once all three are done.",
                Category = "HR", Level = 1, TriggerType = FlowTriggerType.Manual, IsTemplate = true, IsEnabled = true,
                TriggerJson = J(new { titleTemplate = "Leaver: {{inputs.name}} (last day {{inputs.lastDay}})" }),
                InputsJson = J(new object[]
                {
                    new { key = "name", label = "Employee leaving", type = "text", required = true },
                    new { key = "department", label = "Department", type = "department", required = true },
                    new { key = "lastDay", label = "Last working day", type = "date", required = true },
                    new { key = "manager", label = "Line manager", type = "user", required = true },
                    new { key = "reason", label = "Reason (resignation, contract end…)", type = "text" }
                }),
                GraphJson = J(new
                {
                    startStepId = "handover",
                    steps = new object[]
                    {
                        new { id = "handover", type = "task", name = "Manager: handover plan", nextStepId = "it", x = 80, y = 60,
                              config = new { title = "Handover for {{inputs.name}} (last day {{inputs.lastDay}})", description = "Reassign open work, customers and flows; note who takes over each.",
                                             assignTo = new { expression = "{{inputs.manager}}" }, dueInHours = 72, priority = "High",
                                             form = new object[] { new { key = "takesOver", label = "Who takes over", type = "text", required = true } } } },
                        new { id = "it", type = "task", name = "IT: remove access & recover devices", nextStepId = "pay", x = 80, y = 200,
                              config = new { title = "Offboard {{inputs.name}}: access + devices", description = "Disable email, intranet and Sage logins on {{inputs.lastDay}}. Recover laptop, phone and access card; update the asset register.",
                                             assignTo = new { departmentName = "IT Department" }, dueInHours = 48, priority = "High", escalateTo = new { role = "Admin" },
                                             form = new object[] { new { key = "devicesReturned", label = "All devices returned?", type = "select", required = true, options = new[] { "Yes", "No" } } } } },
                        new { id = "pay", type = "task", name = "Accounts: final pay", nextStepId = "devices", x = 80, y = 340,
                              config = new { title = "Final pay for {{inputs.name}}", description = "Leave pay-out, deductions for unreturned items, UI-19 and IRP5.",
                                             assignTo = new { departmentName = "Accounts" }, dueInHours = 120, priority = "Normal" } },
                        new { id = "devices", type = "condition", name = "Devices back?", x = 80, y = 480,
                              config = new { expression = "steps.it.devicesReturned == \"Yes\"", trueStepId = "close", falseStepId = "chase" } },
                        new { id = "chase", type = "notify", name = "Flag missing devices", nextStepId = "close", x = 320, y = 480,
                              config = new { to = new { starter = true }, title = "Devices not returned: {{inputs.name}}", body = "IT ({{steps.it.completedBy}}) could not recover every device. Comment: {{steps.it.comment}}" } },
                        new { id = "close", type = "task", name = "HR: close the record", nextStepId = "end", x = 80, y = 620,
                              config = new { title = "Close employee record: {{inputs.name}}", description = "File the exit interview and close the record. Work handed to {{steps.handover.takesOver}}.",
                                             assignTo = new { starter = true }, dueInHours = 48, priority = "Normal" } },
                        new { id = "end", type = "end", name = "Offboarded", x = 80, y = 760, config = new { outcome = "offboarded" } },
                    }
                })
            },

            // ── Level 1 · Manual (Stock) — approval matrix: write-offs ────────────────
            new FlowDefinition
            {
                Name = "Stock write-off approval",
                Description = "Level 1 · Manual. The stock controller requests a write-off or adjustment; the Stock manager approves, Accounts signs off above R5 000 and Management above R25 000. Approved adjustments are posted to the stock ledger by Stock.",
                Category = "Stock", Level = 1, TriggerType = FlowTriggerType.Manual, IsTemplate = true, IsEnabled = true,
                TriggerJson = J(new { titleTemplate = "Write-off: {{inputs.item}} × {{inputs.qty}} (R{{inputs.value}})" }),
                InputsJson = J(new object[]
                {
                    new { key = "item", label = "Item code / description", type = "text", required = true },
                    new { key = "warehouse", label = "Warehouse", type = "text", required = true },
                    new { key = "qty", label = "Quantity", type = "number", required = true },
                    new { key = "value", label = "Value at cost (R)", type = "number", required = true },
                    new { key = "reason", label = "Reason", type = "select", required = true, options = new[] { "Damaged", "Expired", "Count variance", "Lost / theft", "Other" } },
                    new { key = "notes", label = "Evidence / notes", type = "textarea" }
                }),
                GraphJson = J(new
                {
                    startStepId = "mgr",
                    steps = new object[]
                    {
                        new { id = "mgr", type = "approval", name = "Stock manager", x = 80, y = 60,
                              config = new { title = "Approve write-off: {{inputs.item}} × {{inputs.qty}} (R{{inputs.value}})", description = "{{inputs.reason}} at {{inputs.warehouse}}. Requested by {{run.startedBy}}.\n{{inputs.notes}}",
                                             assignTo = new { departmentName = "Stock", role = "Manager" }, dueInHours = 24, escalateTo = new { role = "Admin" },
                                             approvedStepId = "fincheck", rejectedStepId = "declined" } },
                        new { id = "fincheck", type = "condition", name = "Over R5 000?", x = 80, y = 200,
                              config = new { expression = "inputs.value > 5000", trueStepId = "fin", falseStepId = "post" } },
                        new { id = "fin", type = "approval", name = "Accounts sign-off", x = 320, y = 200,
                              config = new { title = "Finance sign-off: write-off R{{inputs.value}}", description = "{{inputs.item}} × {{inputs.qty}} — {{inputs.reason}}. Stock manager: {{steps.mgr.completedBy}}.",
                                             assignTo = new { departmentName = "Accounts" }, dueInHours = 48, priority = "High", approvedStepId = "mgmtcheck", rejectedStepId = "declined" } },
                        new { id = "mgmtcheck", type = "condition", name = "Over R25 000?", x = 560, y = 200,
                              config = new { expression = "inputs.value > 25000", trueStepId = "mgmt", falseStepId = "post" } },
                        new { id = "mgmt", type = "approval", name = "Management", x = 800, y = 200,
                              config = new { title = "Management sign-off: write-off R{{inputs.value}}", description = "{{inputs.item}} — {{inputs.reason}}. Finance: {{steps.fin.comment}}",
                                             assignTo = new { role = "Admin" }, dueInHours = 48, priority = "High", approvedStepId = "post", rejectedStepId = "declined" } },
                        new { id = "post", type = "task", name = "Post to stock ledger", nextStepId = "done", x = 80, y = 340,
                              config = new { title = "Post adjustment: {{inputs.item}} −{{inputs.qty}} at {{inputs.warehouse}}", description = "Approved. Post the adjustment in Stock so the ledger and valuation update.",
                                             assignTo = new { starter = true }, dueInHours = 24,
                                             form = new object[] { new { key = "reference", label = "Ledger / adjustment reference", type = "text", required = true } } } },
                        new { id = "done", type = "end", name = "Written off", x = 80, y = 480, config = new { outcome = "written_off" } },
                        new { id = "declined", type = "notify", name = "Tell requester", nextStepId = "end_no", x = 560, y = 340,
                              config = new { to = new { starter = true }, title = "Write-off declined: {{inputs.item}}", body = "{{lastDecision}} — {{steps.mgr.comment}}{{steps.fin.comment}}{{steps.mgmt.comment}}" } },
                        new { id = "end_no", type = "end", name = "Declined", x = 560, y = 480, config = new { outcome = "declined" } },
                    }
                })
            },

            // ── Level 1 · Manual (Sales/Finance) — approval matrix: credit ────────────
            new FlowDefinition
            {
                Name = "Customer credit limit request",
                Description = "Level 1 · Manual. Lead to cash: a rep opens an account or asks for a higher limit; Accounts checks references and the age analysis, Management signs off limits above R100 000, and the rep is told the outcome.",
                Category = "Sales", Level = 1, TriggerType = FlowTriggerType.Manual, IsTemplate = true, IsEnabled = true,
                TriggerJson = J(new { titleTemplate = "Credit limit: {{inputs.customer}} → R{{inputs.limit}}" }),
                InputsJson = J(new object[]
                {
                    new { key = "customer", label = "Customer", type = "text", required = true },
                    new { key = "kind", label = "Request", type = "select", required = true, options = new[] { "New account", "Limit increase" } },
                    new { key = "limit", label = "Requested limit (R)", type = "number", required = true },
                    new { key = "monthly", label = "Expected monthly spend (R)", type = "number" },
                    new { key = "notes", label = "Why / references", type = "textarea" }
                }),
                GraphJson = J(new
                {
                    startStepId = "vet",
                    steps = new object[]
                    {
                        new { id = "vet", type = "approval", name = "Accounts: credit check", x = 80, y = 60,
                              config = new { title = "Credit check: {{inputs.customer}} (R{{inputs.limit}})", description = "{{inputs.kind}} requested by {{run.startedBy}}. Monthly spend ~R{{inputs.monthly}}.\n{{inputs.notes}}",
                                             assignTo = new { departmentName = "Accounts" }, dueInHours = 48, escalateTo = new { role = "Admin" },
                                             form = new object[] { new { key = "terms", label = "Payment terms", type = "select", required = true, options = new[] { "COD", "7 days", "30 days", "60 days" } } },
                                             approvedStepId = "big", rejectedStepId = "no" } },
                        new { id = "big", type = "condition", name = "Over R100 000?", x = 80, y = 200,
                              config = new { expression = "inputs.limit > 100000", trueStepId = "mgmt", falseStepId = "yes" } },
                        new { id = "mgmt", type = "approval", name = "Management", x = 320, y = 200,
                              config = new { title = "Approve credit limit R{{inputs.limit}} for {{inputs.customer}}", description = "Accounts approved on {{steps.vet.terms}} terms: {{steps.vet.comment}}",
                                             assignTo = new { role = "Admin" }, dueInHours = 48, priority = "High", approvedStepId = "yes", rejectedStepId = "no" } },
                        new { id = "yes", type = "notify", name = "Tell the rep (approved)", nextStepId = "done", x = 80, y = 340,
                              config = new { to = new { starter = true }, title = "Credit approved: {{inputs.customer}}", body = "R{{inputs.limit}} on {{steps.vet.terms}} terms. Update the customer in Sage." } },
                        new { id = "done", type = "end", name = "Approved", x = 80, y = 480, config = new { outcome = "approved" } },
                        new { id = "no", type = "notify", name = "Tell the rep (declined)", nextStepId = "end_no", x = 560, y = 340,
                              config = new { to = new { starter = true }, title = "Credit declined: {{inputs.customer}}", body = "{{steps.vet.comment}}{{steps.mgmt.comment}}" } },
                        new { id = "end_no", type = "end", name = "Declined", x = 560, y = 480, config = new { outcome = "declined" } },
                    }
                })
            },

            // ── Level 2 · AI-assisted — issue to resolution ───────────────────────────
            new FlowDefinition
            {
                Name = "Issue to resolution",
                Description = "Level 2 · AI-assisted. Anyone logs an issue once (customer complaint, IT fault, supplier problem). Welly classifies it and picks the owning department; the owner resolves it, and if the fix is repeatable IT turns it into a knowledge article so it does not happen twice.",
                Category = "General", Level = 2, TriggerType = FlowTriggerType.Manual, IsTemplate = true, IsEnabled = true,
                TriggerJson = J(new { titleTemplate = "Issue: {{inputs.summary}}" }),
                InputsJson = J(new object[]
                {
                    new { key = "summary", label = "What is the issue?", type = "text", required = true },
                    new { key = "source", label = "Raised by", type = "select", required = true, options = new[] { "Customer", "Employee", "Supplier", "System" } },
                    new { key = "details", label = "Details", type = "textarea", required = true },
                    new { key = "reference", label = "Order / waybill / invoice (if any)", type = "text" }
                }),
                GraphJson = J(new
                {
                    startStepId = "ai",
                    steps = new object[]
                    {
                        new { id = "ai", type = "ai_analyze", name = "Welly routes it", nextStepId = "fix", x = 80, y = 60,
                              config = new { outputKey = "ai", prompt = "Classify this issue and choose the department that owns it. Departments: Sales, Stock, Logistics, Accounts, HR Department, IT Department, Production, Marketing Department.",
                                             fields = new object[]
                                             {
                                                 new { key = "department", description = "Exactly one department name from the list" },
                                                 new { key = "category", description = "Short category, e.g. late delivery, billing error, IT fault" },
                                                 new { key = "priority", description = "Low, Normal, High or Urgent" },
                                                 new { key = "summary", description = "One sentence for the owner" }
                                             } } },
                        new { id = "fix", type = "task", name = "Owner resolves", nextStepId = "repeat", x = 80, y = 200,
                              config = new { title = "{{ai.category}}: {{inputs.summary}}", description = "{{ai.summary}}\n\nRaised by: {{inputs.source}} ({{run.startedBy}})\nReference: {{inputs.reference}}\n\n{{inputs.details}}",
                                             assignTo = new { departmentName = "{{ai.department}}" }, priority = "{{ai.priority}}", dueInHours = 24, escalateTo = new { role = "Manager" },
                                             form = new object[]
                                             {
                                                 new { key = "fix", label = "What fixed it", type = "textarea", required = true },
                                                 new { key = "repeatable", label = "Could it happen again?", type = "select", required = true, options = new[] { "Yes", "No" } }
                                             } } },
                        new { id = "repeat", type = "condition", name = "Repeatable?", x = 80, y = 340,
                              config = new { expression = "steps.fix.repeatable == \"Yes\"", trueStepId = "kb", falseStepId = "tell" } },
                        new { id = "kb", type = "task", name = "Write the SOP / article", nextStepId = "tell", x = 320, y = 340,
                              config = new { title = "Knowledge article: {{ai.category}}", description = "Turn this fix into an SOP so the next person can solve it: {{steps.fix.fix}}",
                                             assignTo = new { departmentName = "IT Department" }, dueInHours = 120, priority = "Low" } },
                        new { id = "tell", type = "notify", name = "Tell whoever raised it", nextStepId = "end", x = 80, y = 480,
                              config = new { to = new { starter = true }, title = "Resolved: {{inputs.summary}}", body = "{{steps.fix.completedBy}}: {{steps.fix.fix}}" } },
                        new { id = "end", type = "end", name = "Resolved", x = 80, y = 620, config = new { outcome = "resolved" } },
                    }
                })
            },
        };
    }
}
