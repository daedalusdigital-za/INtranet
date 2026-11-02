using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Cortex;

namespace ProjectTracker.API.Services.Cortex
{
    /// <summary>
    /// Rebuilds the derived part of the company graph from live data. Rule one of Cortex: anything that can be read
    /// from code, module data or configuration is, so the map never drifts. Each rebuild upserts nodes and edges by
    /// key, deactivates derived items that have disappeared (never deletes), leaves curated/inferred items alone and
    /// writes every difference to CortexChanges so the graph can be replayed for any past date.
    /// </summary>
    public class CortexGraphBuilder
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<CortexGraphBuilder> _log;
        private static readonly JsonSerializerOptions J = new(JsonSerializerDefaults.Web);

        public CortexGraphBuilder(ApplicationDbContext db, ILogger<CortexGraphBuilder> log) { _db = db; _log = log; }

        public record RebuildResult(int Nodes, int Edges, int Created, int Updated, int Deactivated, int Reactivated, TimeSpan Took);

        // ── Node type configuration ───────────────────────────────────────────────
        public static readonly CortexNodeType[] NodeTypes =
        {
            new() { Key = "company", Label = "Company / group entity", Layer = "core", Icon = "apartment", Color = "#f8fafc", AttachedType = "knowledge", ZoomLevel = 1, SortOrder = 1, DefaultSource = "OperatingCompanies" },
            new() { Key = "welly", Label = "Welly (AI core)", Layer = "core", Icon = "smart_toy", Color = "#e879f9", AttachedType = "agent_registry", ZoomLevel = 1, SortOrder = 2, DefaultSource = "Welly config" },
            new() { Key = "department", Label = "Department", Layer = "organisation", Icon = "groups", Color = "#38bdf8", AttachedType = "knowledge", ZoomLevel = 1, SortOrder = 10, DefaultSource = "Departments" },
            new() { Key = "employee", Label = "Employee", Layer = "organisation", Icon = "person", Color = "#7dd3fc", AttachedType = "responsibilities", ZoomLevel = 4, SortOrder = 11, DefaultSource = "EmpRegistrations + Users" },
            new() { Key = "role", Label = "Role", Layer = "organisation", Icon = "verified_user", Color = "#93c5fd", AttachedType = "authority", ZoomLevel = 2, SortOrder = 12, DefaultSource = "Users.Role" },
            new() { Key = "process", Label = "Process", Layer = "work", Icon = "account_tree", Color = "#a78bfa", AttachedType = "workflow", ZoomLevel = 2, SortOrder = 20, DefaultSource = "FlowDefinitions" },
            new() { Key = "step", Label = "Workflow step", Layer = "work", Icon = "radio_button_checked", Color = "#c4b5fd", ZoomLevel = 3, SortOrder = 21, DefaultSource = "FlowDefinitions.GraphJson" },
            new() { Key = "approval", Label = "Approval", Layer = "work", Icon = "fact_check", Color = "#fbbf24", ZoomLevel = 3, SortOrder = 22, DefaultSource = "FlowDefinitions.GraphJson" },
            new() { Key = "document", Label = "Document / procedure", Layer = "knowledge", Icon = "description", Color = "#fda4af", ZoomLevel = 5, SortOrder = 30, DefaultSource = "KnowledgeBaseDocuments" },
            new() { Key = "decision", Label = "Decision", Layer = "knowledge", Icon = "gavel", Color = "#f9a8d4", ZoomLevel = 5, SortOrder = 31, DefaultSource = "Decision log" },
            new() { Key = "customer", Label = "Customer", Layer = "commercial", Icon = "storefront", Color = "#34d399", AttachedType = "account", ZoomLevel = 5, SortOrder = 40, DefaultSource = "Customers" },
            new() { Key = "supplier", Label = "Supplier", Layer = "commercial", Icon = "local_shipping", Color = "#6ee7b7", AttachedType = "supplier_knowledge", ZoomLevel = 5, SortOrder = 41, DefaultSource = "Books" },
            new() { Key = "tender", Label = "Tender", Layer = "commercial", Icon = "gavel", Color = "#c084fc", ZoomLevel = 5, SortOrder = 42, DefaultSource = "Tenders" },
            new() { Key = "product", Label = "Product / service", Layer = "commercial", Icon = "inventory_2", Color = "#86efac", AttachedType = "pricing", ZoomLevel = 5, SortOrder = 43, DefaultSource = "Commodities" },
            new() { Key = "source", Label = "External source", Layer = "technology", Icon = "input", Color = "#94a3b8", ZoomLevel = 1, SortOrder = 50, DefaultSource = "code:cortex-model" },
            new() { Key = "module", Label = "System / module", Layer = "technology", Icon = "widgets", Color = "#22d3ee", ZoomLevel = 1, SortOrder = 51, DefaultSource = "code:cortex-model" },
            new() { Key = "api", Label = "API", Layer = "technology", Icon = "api", Color = "#67e8f9", ZoomLevel = 4, SortOrder = 52, DefaultSource = "Controllers" },
            new() { Key = "infrastructure", Label = "Infrastructure", Layer = "technology", Icon = "dns", Color = "#a5f3fc", ZoomLevel = 4, SortOrder = 53, DefaultSource = "docker-compose" },
            new() { Key = "agent", Label = "AI agent", Layer = "ai", Icon = "psychology", Color = "#f0abfc", AttachedType = "context_scope", ZoomLevel = 2, SortOrder = 60, DefaultSource = "Welly agent registry" },
            new() { Key = "finding", Label = "Welly finding", Layer = "ai", Icon = "search_insights", Color = "#f472b6", ZoomLevel = 3, SortOrder = 61, DefaultSource = "Welly Analyse" },
            new() { Key = "suggestion", Label = "Welly suggestion", Layer = "ai", Icon = "lightbulb", Color = "#fbcfe8", ZoomLevel = 3, SortOrder = 62, DefaultSource = "Welly Suggest" },
            new() { Key = "ai_workflow", Label = "AI workflow", Layer = "ai", Icon = "bolt", Color = "#e879f9", ZoomLevel = 3, SortOrder = 63, DefaultSource = "Welly Fix" },
            new() { Key = "report", Label = "Report / dashboard", Layer = "data", Icon = "insights", Color = "#f5b942", ZoomLevel = 3, SortOrder = 70, DefaultSource = "Management" },
            new() { Key = "gap", Label = "Gap", Layer = "gaps", Icon = "report_problem", Color = "#f87171", ZoomLevel = 2, SortOrder = 80, DefaultSource = "derived" },
            // attached knowledge nodes
            new() { Key = "knowledge", Label = "Knowledge node", Layer = "knowledge", Icon = "menu_book", Color = "#fde68a", ZoomLevel = 2, SortOrder = 90 },
            new() { Key = "responsibilities", Label = "Responsibilities node", Layer = "knowledge", Icon = "assignment_ind", Color = "#fde68a", ZoomLevel = 4, SortOrder = 91 },
            new() { Key = "workflow", Label = "Workflow node", Layer = "knowledge", Icon = "schema", Color = "#fde68a", ZoomLevel = 3, SortOrder = 92 },
            new() { Key = "context_scope", Label = "Context scope", Layer = "ai", Icon = "shield", Color = "#f0abfc", ZoomLevel = 2, SortOrder = 93 },
            new() { Key = "authority", Label = "Authority limits", Layer = "organisation", Icon = "rule", Color = "#fde68a", ZoomLevel = 3, SortOrder = 94 },
            new() { Key = "type", Label = "Node type", Layer = "config", Icon = "category", Color = "#64748b", ZoomLevel = 5, SortOrder = 99 },
        };

        // ── What the code is: sources, modules and the hand-offs between them ─────
        // Keys match Frontend/src/app/components/flows/cortex-model.ts, which holds the map positions and blurbs.
        private static readonly (string Key, string Label, string? Perm, string? Route)[] Modules =
        {
            ("tenders", "Tenders", "tenders", "/tenders"), ("sales", "Sales", "sales", "/sales"), ("logistics", "Logistics", "logistics", "/logistics"),
            ("stock", "Stock", "stock_management", "/stock-management"), ("finance", "Finance", "finance", "/finance"), ("books", "Books", "finance", "/books"),
            ("hr", "HR", "human_resource", "/people"), ("projects", "Projects", "company_projects", "/company-projects"), ("assets", "Asset register", null, "/asset-register"),
            ("paperless", "Paperless", null, null), ("tickets", "Support tickets", "support_tickets", "/support-ticket"), ("flows", "Flows", "flows", "/flows"),
            ("welly", "Welly", "ai", null), ("mgmt", "Management", "management", "/management"),
        };
        private static readonly (string Key, string Label)[] Sources =
        {
            ("src-sage", "Sage files"), ("src-portal", "RF client portal"), ("src-mail", "Sales mailbox"), ("src-cartrack", "CarTrack"),
            ("src-fuel", "TFN & Puma"), ("src-clock", "Clocking devices"), ("src-apis", "Project APIs"),
        };
        private static readonly (string From, string To, string Label, string How, string Ref)[] Handoffs =
        {
            ("src-sage", "sales", "Sales report import → imported invoices + sales history", CortexHandoff.NeedsSomeone, "SalesImportController.cs:148"),
            ("src-sage", "stock", "SOH import → stock-take adjustments", CortexHandoff.NeedsSomeone, "StockOnHandImportService.cs:569"),
            ("src-portal", "logistics", "Client booking → shipments (BOOKED)", CortexHandoff.Automatic, "PortalController.cs:252"),
            ("src-mail", "sales", "Order emails cached for search (no records created)", CortexHandoff.ReadOnly, "SalesMailboxMonitorService.cs:11"),
            ("src-cartrack", "logistics", "Live positions + incident monitor", CortexHandoff.Automatic, "IncidentMonitoringService.cs:9"),
            ("src-fuel", "logistics", "Fuel transactions & garage orders", CortexHandoff.Automatic, "TfnSyncService.cs:47"),
            ("src-clock", "hr", "Clock-ins → attendance", CortexHandoff.Automatic, "ClockingDeviceController.cs:120"),
            ("src-apis", "projects", "HbA1c and school-delivery data", CortexHandoff.Automatic, "HBA1CApiService.cs:39"),
            ("sales", "logistics", "Invoices → trip sheet (RF- load); invoices Assigned", CortexHandoff.NeedsSomeone, "ImportedInvoicesController.cs:1149"),
            ("logistics", "stock", "Approve dispatch → ledger deducts every linked line", CortexHandoff.NeedsSomeone, "StockMovementsController.cs:237"),
            ("logistics", "sales", "POD → load + invoices Delivered", CortexHandoff.Automatic, "LoadsController.cs:1416"),
            ("sales", "finance", "Imported invoices → debtors (net of collections)", CortexHandoff.ReadOnly, "FinanceOverviewController.cs:275"),
            ("logistics", "finance", "Requisition → Finance requested / paid", CortexHandoff.NeedsSomeone, "FinanceOverviewController.cs:192"),
            ("books", "finance", "Supplier invoice → creditors / payment request", CortexHandoff.NeedsSomeone, "BooksController.cs:600"),
            ("books", "assets", "Invoice matched to the asset it bought", CortexHandoff.Automatic, "AssetInvoiceMatchingService.cs:412"),
            ("logistics", "projects", "Trip sheet marks condom delivery requests Delivered", CortexHandoff.Automatic, "TripSheetController.cs:382"),
            ("logistics", "hr", "Drivers imported into HR employee files", CortexHandoff.NeedsSomeone, "HrEmployeesController.cs:305"),
            ("logistics", "flows", "Shipment events start flows", CortexHandoff.Automatic, "FlowEvents.cs:29"),
            ("welly", "logistics", "Creates trip sheets on request", CortexHandoff.Automatic, "AIActionService.cs:838"),
            ("welly", "tickets", "Raises support tickets", CortexHandoff.Automatic, "AIActionService.cs:224"),
            ("flows", "hr", "Tasks → people's to-do lists", CortexHandoff.Automatic, "FlowEngine.cs:590"),
            ("tenders", "sales", "Award → nothing downstream; tender pricing is a fixed file", CortexHandoff.NotBuilt, "TendersController.cs:317"),
            ("finance", "logistics", "Debtors do not wait for a POD", CortexHandoff.NotBuilt, "FinanceOverviewController.cs:275"),
            ("hr", "finance", "Approved leave → attendance / payroll", CortexHandoff.NotBuilt, "LeaveRequestsController.cs:25"),
        };
        private static readonly (string Key, string Label, string Purpose, string[] Reads, string[] Actions)[] Agents =
        {
            ("analyse", "Welly Analyse", "Spots slow hand-offs, missing connections, stale procedures and unusual patterns.", new[] { "process", "step", "department", "module", "document", "report" }, new[] { "raise_finding" }),
            ("suggest", "Welly Suggest", "Proposes a change: automate a hand-off, add an approver, update a procedure, fill a gap.", new[] { "finding", "process", "department", "module" }, new[] { "attach_suggestion" }),
            ("fix", "Welly Fix", "Carries out an approved change or builds the AI workflow that does it. Nothing runs without a named human owner.", new[] { "suggestion", "process", "module" }, new[] { "create_flow", "update_handoff" }),
            ("assistant", "Welly Assistant", "Answers questions and acts on request: trip sheets, tickets, to-dos, meetings, customer and employee edits.", new[] { "module", "customer", "employee", "process", "document" }, new[] { "CREATE_TICKET", "CREATE_TODO", "CREATE_TRIPSHEET", "SEND_MESSAGE" }),
        };

        // ── Rebuild ────────────────────────────────────────────────────────────────
        public async Task<RebuildResult> RebuildAsync(CancellationToken ct = default)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var now = DateTime.UtcNow;

            // node types are configuration: upsert
            var existingTypes = await _db.CortexNodeTypes.ToDictionaryAsync(t => t.Key, ct);
            foreach (var t in NodeTypes)
            {
                if (existingTypes.TryGetValue(t.Key, out var e))
                { e.Label = t.Label; e.Layer = t.Layer; e.Icon = t.Icon; e.Color = t.Color; e.AttachedType = t.AttachedType; e.ZoomLevel = t.ZoomLevel; e.SortOrder = t.SortOrder; e.DefaultSource = t.DefaultSource; }
                else _db.CortexNodeTypes.Add(new CortexNodeType { Key = t.Key, Label = t.Label, Layer = t.Layer, Icon = t.Icon, Color = t.Color, AttachedType = t.AttachedType, ZoomLevel = t.ZoomLevel, SortOrder = t.SortOrder, DefaultSource = t.DefaultSource });
            }

            var nodes = new List<CortexNode>();
            var edges = new List<CortexEdge>();
            void N(string key, string type, string label, string? parent = null, string? summary = null, string? source = null, string? sourceId = null,
                   string? route = null, string? perm = null, object? data = null, int? ownerUserId = null, string? ownerLabel = null, string? shortLabel = null)
                => nodes.Add(new CortexNode { Key = key, Type = type, Label = Trunc(label, 200), Short = shortLabel, ParentKey = parent, Summary = Trunc(summary, 1000), Source = source, SourceId = sourceId,
                    Route = route, Permission = perm, DataJson = data == null ? null : JsonSerializer.Serialize(data, J), OwnerUserId = ownerUserId, OwnerLabel = ownerLabel, Provenance = CortexProvenance.Derived });
            void E(string from, string to, string rel, string? label = null, string? handoff = null, string? codeRef = null, string? source = null, int? weight = null, object? data = null)
                => edges.Add(new CortexEdge { FromKey = from, ToKey = to, Relation = rel, Label = Trunc(label, 200), Handoff = handoff, CodeRef = codeRef, Source = source, Weight = weight,
                    DataJson = data == null ? null : JsonSerializer.Serialize(data, J), Provenance = CortexProvenance.Derived });

            // Core: group entities and Welly
            var companies = await _db.OperatingCompanies.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.Name).ToListAsync(ct);
            N("group", "company", "Promed Group", null, "The operating companies and Rocket Freight, run on one intranet.", "OperatingCompanies");
            N("group:knowledge", "knowledge", "Group knowledge", "group", null, "curated");
            foreach (var c in companies)
            {
                N($"company:{c.Code}", "company", c.Name, "group", c.Description, "OperatingCompanies", c.OperatingCompanyId.ToString(), shortLabel: c.Code, data: new { c.Code, c.PrimaryColor });
                E($"company:{c.Code}", "group", "belongs_to", "Operating company", source: "OperatingCompanies");
                N($"company:{c.Code}:knowledge", "knowledge", $"{c.Name} knowledge", $"company:{c.Code}", null, "curated");
            }
            N("welly", "welly", "Welly", "group", "The AI core. Every other node is context Welly can read within its permissions, or something Welly can help improve.", "Welly config", perm: "ai");
            foreach (var a in Agents)
            {
                N($"agent:{a.Key}", "agent", a.Label, "welly", a.Purpose, "Welly agent registry", data: new { reads = a.Reads, actions = a.Actions });
                E($"agent:{a.Key}", "welly", "belongs_to", "Welly agent", source: "Welly agent registry");
                N($"agent:{a.Key}:scope", "context_scope", $"{a.Label} · context scope", $"agent:{a.Key}", $"May read: {string.Join(", ", a.Reads)}. May do: {string.Join(", ", a.Actions)}.", "Welly agent registry", data: new { reads = a.Reads, actions = a.Actions });
                foreach (var t in a.Reads) E($"agent:{a.Key}", $"type:{t}", "can_access", $"Reads every {t}", source: "Welly agent registry");
            }
            foreach (var t in NodeTypes.Where(t => t.Layer != "gaps" && t.Layer != "config")) N($"type:{t.Key}", "type", t.Label, null, null, "config");

            // Technology: sources and modules (positions/blurbs live in cortex-model.ts)
            foreach (var s in Sources) N(s.Key, "source", s.Label, "group", null, "code:cortex-model.ts");
            foreach (var m in Modules) N(m.Key, "module", m.Label, "group", null, "code:cortex-model.ts", route: m.Route, perm: m.Perm, data: new { perm = m.Perm });
            foreach (var h in Handoffs) E(h.From, h.To, "handoff", h.Label, h.How, h.Ref, "code");
            foreach (var k in new[] { "sales", "tenders", "logistics", "stock", "finance", "paperless", "hr" }) E(k, "mgmt", "handoff", "Rolled up on the Management dashboard", CortexHandoff.ReadOnly, "ManagementController.cs:184", "code");

            // Organisation: departments, roles, people
            var depts = await _db.Departments.AsNoTracking().OrderBy(d => d.Name).ToListAsync(ct);
            var users = await _db.Users.AsNoTracking().Where(u => u.IsActive).Select(u => new { u.UserId, Name = u.Name + " " + u.Surname, u.Email, u.Role, u.Title, u.DepartmentId, u.Permissions, u.LinkedEmpId }).ToListAsync(ct);
            var emps = await _db.EmpRegistrations.AsNoTracking().Select(e => new { e.EmpId, Name = ((e.Name ?? "") + " " + (e.LastName ?? "")).Trim(), e.Department, e.JobTitle }).ToListAsync(ct);
            var flows = await _db.FlowDefinitions.AsNoTracking().Where(f => !f.IsTemplate).ToListAsync(ct);
            var runStats = await _db.FlowRuns.AsNoTracking().GroupBy(r => r.FlowDefinitionId)
                .Select(g => new { Id = g.Key, Total = g.Count(), Active = g.Count(r => r.Status == Models.Flows.FlowRunStatus.Running || r.Status == Models.Flows.FlowRunStatus.Waiting), Last = (DateTime?)g.Max(r => r.StartedAt) }).ToDictionaryAsync(x => x.Id, ct);

            string DeptKey(int id) => $"dept:{id}";
            var deptByName = depts.ToDictionary(d => Norm(d.Name), d => d);
            Models.Department? FindDept(string? name)
            {
                var n = Norm(name); if (n.Length == 0 || n == "other") return null;
                if (deptByName.TryGetValue(n, out var d)) return d;
                return depts.FirstOrDefault(x => Norm(x.Name).StartsWith(n) || n.StartsWith(Norm(x.Name)));
            }
            foreach (var d in depts)
            {
                var head = users.FirstOrDefault(u => d.ManagerName != null && Norm(u.Name) == Norm(d.ManagerName));
                N(DeptKey(d.DepartmentId), "department", d.Name, "group", d.ManagerName != null ? $"Head: {d.ManagerName}" : null, "Departments", d.DepartmentId.ToString(),
                  ownerUserId: head?.UserId, ownerLabel: d.ManagerName, shortLabel: d.Name.Replace(" Department", ""));
                E(DeptKey(d.DepartmentId), "group", "belongs_to", "Department of the group", source: "Departments");
                N($"{DeptKey(d.DepartmentId)}:knowledge", "knowledge", $"{d.Name} knowledge", DeptKey(d.DepartmentId), null, "curated", ownerUserId: head?.UserId, ownerLabel: d.ManagerName);
            }
            foreach (var r in users.Select(u => u.Role).Where(r => !string.IsNullOrWhiteSpace(r)).Distinct())
            {
                N($"role:{Slug(r)}", "role", r, "group", null, "Users.Role", data: new { people = users.Count(u => u.Role == r) });
                N($"role:{Slug(r)}:authority", "authority", $"{r} · authority limits", $"role:{Slug(r)}", null, "curated");
            }

            // people: register first (they may never log in), then users not on the register
            var userByName = users.GroupBy(u => NameKey(u.Name)).ToDictionary(g => g.Key, g => g.First());
            var userByEmp = users.Where(u => u.LinkedEmpId != null).GroupBy(u => u.LinkedEmpId!).ToDictionary(g => g.Key, g => g.First());
            var placedUsers = new HashSet<int>();
            var personKeyByUser = new Dictionary<int, string>();
            var personKeyByEmp = new Dictionary<string, string>();
            foreach (var e in emps.Where(e => e.Name.Length > 0))
            {
                var u = userByEmp.TryGetValue(e.EmpId, out var ux) ? ux : (userByName.TryGetValue(NameKey(e.Name), out var uy) ? uy : null);
                if (u != null) placedUsers.Add(u.UserId);
                var d = FindDept(e.Department) ?? (u?.DepartmentId != null ? depts.FirstOrDefault(x => x.DepartmentId == u.DepartmentId) : null);
                var key = $"emp:{e.EmpId}";
                personKeyByEmp[e.EmpId] = key; if (u != null) personKeyByUser[u.UserId] = key;
                N(key, "employee", e.Name, d != null ? DeptKey(d.DepartmentId) : "group", e.JobTitle, "EmpRegistrations", e.EmpId, ownerUserId: u?.UserId, ownerLabel: e.Name,
                  data: new { title = e.JobTitle, userId = u?.UserId, email = u?.Email, role = u?.Role, modules = u != null ? ModulesOf(u.Permissions, u.Role) : Array.Empty<string>() });
                if (d != null) E(key, DeptKey(d.DepartmentId), "belongs_to", "On the employee register", source: "EmpRegistrations");
                if (u?.Role != null) E(key, $"role:{Slug(u.Role)}", "has_role", u.Role, source: "Users.Role");
                N($"{key}:responsibilities", "responsibilities", $"{e.Name} · responsibilities", key, null, "curated", ownerUserId: u?.UserId, ownerLabel: e.Name);
                if (u != null) foreach (var m in ModulesOf(u.Permissions, u.Role)) if (Modules.Any(x => x.Perm == m)) foreach (var mod in Modules.Where(x => x.Perm == m)) E(key, mod.Key, "uses", "Has module permission", source: "Users.Permissions");
            }
            foreach (var u in users.Where(u => !placedUsers.Contains(u.UserId)))
            {
                var key = $"user:{u.UserId}"; personKeyByUser[u.UserId] = key;
                var parent = u.DepartmentId != null ? DeptKey(u.DepartmentId.Value) : "group";
                N(key, "employee", u.Name, parent, u.Title ?? u.Role, "Users", u.UserId.ToString(), ownerUserId: u.UserId, ownerLabel: u.Name,
                  data: new { title = u.Title, userId = u.UserId, email = u.Email, role = u.Role, modules = ModulesOf(u.Permissions, u.Role), notOnRegister = true });
                if (u.DepartmentId != null) E(key, parent, "belongs_to", "Intranet account", source: "Users");
                if (u.Role != null) E(key, $"role:{Slug(u.Role)}", "has_role", u.Role, source: "Users.Role");
                N($"{key}:responsibilities", "responsibilities", $"{u.Name} · responsibilities", key, null, "curated", ownerUserId: u.UserId, ownerLabel: u.Name);
                foreach (var m in ModulesOf(u.Permissions, u.Role)) foreach (var mod in Modules.Where(x => x.Perm == m)) E(key, mod.Key, "uses", "Has module permission", source: "Users.Permissions");
            }
            // department → module: how many people work there
            foreach (var d in depts)
            {
                var people = users.Where(u => u.DepartmentId == d.DepartmentId).ToList();
                foreach (var mod in Modules.Where(m => m.Perm != null))
                {
                    var c = people.Count(u => ModulesOf(u.Permissions, u.Role).Contains(mod.Perm!) && !IsAdmin(u.Role));
                    if (c > 0) E(DeptKey(d.DepartmentId), mod.Key, "uses", $"{c} {(c == 1 ? "person works" : "people work")} here", source: "Users.Permissions", weight: c);
                }
            }

            // Work: processes and their steps, from Flows
            foreach (var f in flows)
            {
                var key = $"flow:{f.Id}";
                var dept = FindDept(f.DepartmentName);
                runStats.TryGetValue(f.Id, out var rs);
                var ownerKey = f.OwnerEmployeeId != null && personKeyByEmp.TryGetValue(f.OwnerEmployeeId, out var pk) ? pk : (f.OwnerUserId != null && personKeyByUser.TryGetValue(f.OwnerUserId.Value, out var uk) ? uk : null);
                N(key, "process", f.Name, dept != null ? DeptKey(dept.DepartmentId) : "flows", f.Description, "FlowDefinitions", f.Id.ToString(), route: $"/flows?flow={f.Id}", perm: "flows",
                  ownerUserId: f.OwnerUserId, ownerLabel: f.OwnerName,
                  data: new { f.Category, f.TriggerType, f.IsEnabled, f.Level, runs = rs?.Total ?? 0, activeRuns = rs?.Active ?? 0, lastRun = rs?.Last, human = f.DepartmentName != null, hasBlueprint = f.BlueprintJson != null });
                if (dept != null) E(key, DeptKey(dept.DepartmentId), "belongs_to", "Department process", source: "FlowDefinitions");
                if (ownerKey != null) E(ownerKey, key, "responsible_for", "Process owner", source: "FlowDefinitions");
                E(key, "flows", "uses", "Runs in Flows", source: "FlowDefinitions");
                N($"{key}:workflow", "workflow", $"{f.Name} · workflow", key, f.Description, "FlowDefinitions", f.Id.ToString(), data: new { f.TriggerType, trigger = f.TriggerJson, blueprint = f.BlueprintJson != null });

                // steps
                var steps = ParseSteps(f.GraphJson);
                string? prev = null;
                foreach (var s in steps)
                {
                    var sk = $"{key}:step:{s.Id}";
                    var type = s.Type == "approval" ? "approval" : "step";
                    N(sk, type, s.Name ?? s.Type, key, null, "FlowDefinitions.GraphJson", s.Id, data: new { s.Type, assign = s.Assign, system = s.System });
                    if (s.Assign?.DepartmentId is int did) E(sk, DeptKey(did), "assigned_to", "Step assigned to department", source: "FlowDefinitions.GraphJson");
                    else if (s.Assign?.DepartmentName != null && FindDept(s.Assign.DepartmentName) is { } ad) E(sk, DeptKey(ad.DepartmentId), "assigned_to", "Step assigned to department", source: "FlowDefinitions.GraphJson");
                    if (s.Assign?.UserId is int uid && personKeyByUser.TryGetValue(uid, out var upk)) E(sk, upk, "assigned_to", "Step assigned to person", source: "FlowDefinitions.GraphJson");
                    if (s.Assign?.Role != null) E(sk, $"role:{Slug(s.Assign.Role)}", "assigned_to", "Step assigned to role", source: "FlowDefinitions.GraphJson");
                    if (prev != null) E(prev, sk, "handoff", "Next step", StepHandoff(s.Type), $"FlowEngine.cs", "FlowDefinitions.GraphJson");
                    prev = sk;
                }
            }

            // Knowledge: documents in the knowledge base
            var docs = await _db.KnowledgeBaseDocuments.AsNoTracking().Where(d => d.IsActive).Select(d => new { d.Id, d.Title, d.Category, d.UpdatedAt, d.FileType }).ToListAsync(ct);
            foreach (var d in docs)
            {
                N($"doc:{d.Id}", "document", string.IsNullOrWhiteSpace(d.Title) ? $"Document {d.Id}" : d.Title, "welly", d.Category, "KnowledgeBaseDocuments", d.Id.ToString(), perm: "ai", data: new { d.Category, d.UpdatedAt, d.FileType });
                E("agent:assistant", $"doc:{d.Id}", "can_access", "In the knowledge base", source: "KnowledgeBaseDocuments");
            }

            // Data: management dashboards
            foreach (var (k, l) in new[] { ("sales", "Sales dashboard"), ("logistics", "Logistics dashboard"), ("stock", "Stock dashboard"), ("finance", "Finance overview"), ("hr", "People dashboard") })
            {
                N($"report:{k}", "report", l, "mgmt", null, "ManagementController", route: "/management", perm: "management");
                E(k, $"report:{k}", "produces", "Feeds the dashboard", source: "ManagementController.cs");
            }

            // Gaps derived from the graph itself
            foreach (var h in Handoffs.Where(h => h.How == CortexHandoff.NotBuilt))
                N($"gap:handoff:{h.From}>{h.To}", "gap", $"Not built: {h.From} → {h.To}", h.To, h.Label, "derived", data: new { kind = "not_built", from = h.From, to = h.To, codeRef = h.Ref, cost = "unknown", priority = 2 });
            foreach (var f in flows.Where(f => f.IsEnabled && (!runStats.TryGetValue(f.Id, out var rs) || rs.Total == 0)))
                N($"gap:noevents:flow:{f.Id}", "gap", $"No runs yet: {f.Name}", $"flow:{f.Id}", "A process with no runs does not count towards coverage until the owner confirms it or work passes through it.", "derived", ownerUserId: f.OwnerUserId, ownerLabel: f.OwnerName, data: new { kind = "no_events", priority = 1 });
            foreach (var d in depts.Where(d => !flows.Any(f => Norm(f.DepartmentName) == Norm(d.Name)) && users.Any(u => u.DepartmentId == d.DepartmentId)))
                N($"gap:uncaptured:dept:{d.DepartmentId}", "gap", $"Work not captured yet: {d.Name}", DeptKey(d.DepartmentId), $"{d.Name} has people but no process on the map. Shown at team level, never against a person.", "derived", ownerLabel: d.ManagerName, data: new { kind = "uncaptured", people = users.Count(u => u.DepartmentId == d.DepartmentId), priority = 3 });
            foreach (var m in Modules.Where(m => m.Perm != null))
                if (!users.Any(u => !IsAdmin(u.Role) && ModulesOf(u.Permissions, u.Role).Contains(m.Perm!)))
                    N($"gap:noowner:module:{m.Key}", "gap", $"No one works in {m.Label}", m.Key, "No non-admin user holds this module's permission, so it has no day-to-day owner.", "derived", data: new { kind = "no_owner", priority = 1 });

            var result = await UpsertAsync(nodes, edges, now, ct);
            sw.Stop();
            _log.LogInformation("Cortex rebuilt: {Nodes} nodes, {Edges} edges (+{Created} / ~{Updated} / -{Deactivated}) in {Ms} ms", result.Nodes, result.Edges, result.Created, result.Updated, result.Deactivated, sw.ElapsedMilliseconds);
            return result with { Took = sw.Elapsed };
        }

        // ── Upsert with change log ────────────────────────────────────────────────
        private async Task<RebuildResult> UpsertAsync(List<CortexNode> nodes, List<CortexEdge> edges, DateTime now, CancellationToken ct)
        {
            int created = 0, updated = 0, deactivated = 0, reactivated = 0;
            var changes = new List<CortexChange>();
            void Log(string target, string key, string kind, string? field = null, string? oldV = null, string? newV = null)
                => changes.Add(new CortexChange { Target = target, TargetKey = key, Kind = kind, Field = field, OldValue = oldV, NewValue = newV, ChangedBy = "rebuild", OccurredAt = now });

            // nodes
            var wanted = nodes.GroupBy(n => n.Key).Select(g => g.First()).ToDictionary(n => n.Key);
            var existing = await _db.CortexNodes.Where(n => n.Provenance == CortexProvenance.Derived || wanted.Keys.Contains(n.Key)).ToDictionaryAsync(n => n.Key, ct);
            foreach (var n in wanted.Values)
            {
                if (!existing.TryGetValue(n.Key, out var e))
                {
                    // attached knowledge nodes start as curated shells (empty until someone fills them in)
                    if (n.Source == "curated") { n.Provenance = CortexProvenance.Curated; n.Source = null; }
                    n.LastSeenAt = now; n.CreatedAt = now;
                    _db.CortexNodes.Add(n); created++; Log("node", n.Key, "created", newV: n.Label);
                    continue;
                }
                e.LastSeenAt = now;
                if (!e.IsActive) { e.IsActive = true; reactivated++; Log("node", e.Key, "reactivated"); }
                if (e.Provenance != CortexProvenance.Derived) continue; // never overwrite what a person wrote
                var dirty = false;
                dirty |= Set(e, "Label", e.Label, n.Label, v => e.Label = v, Log);
                dirty |= Set(e, "Summary", e.Summary, n.Summary, v => e.Summary = v, Log);
                dirty |= Set(e, "ParentKey", e.ParentKey, n.ParentKey, v => e.ParentKey = v, Log);
                dirty |= Set(e, "Type", e.Type, n.Type, v => e.Type = v, Log);
                dirty |= Set(e, "Route", e.Route, n.Route, v => e.Route = v, Log);
                dirty |= Set(e, "Permission", e.Permission, n.Permission, v => e.Permission = v, Log);
                dirty |= Set(e, "OwnerLabel", e.OwnerLabel, n.OwnerLabel, v => e.OwnerLabel = v, Log);
                dirty |= Set(e, "DataJson", e.DataJson, n.DataJson, v => e.DataJson = v, Log, logValues: false);
                if (e.OwnerUserId != n.OwnerUserId) { e.OwnerUserId = n.OwnerUserId; dirty = true; }
                if (e.Short != n.Short) { e.Short = n.Short; dirty = true; }
                if (e.Source != n.Source && n.Source != "curated") { e.Source = n.Source; e.SourceId = n.SourceId; dirty = true; }
                if (dirty) { e.UpdatedAt = now; updated++; }
            }
            foreach (var e in existing.Values.Where(x => x.IsActive && x.Provenance == CortexProvenance.Derived && !wanted.ContainsKey(x.Key)))
            { e.IsActive = false; e.UpdatedAt = now; deactivated++; Log("node", e.Key, "deactivated"); }

            // edges
            var wantedE = edges.GroupBy(x => (x.FromKey, x.ToKey, x.Relation)).Select(g => g.First()).ToDictionary(x => (x.FromKey, x.ToKey, x.Relation));
            var existingE = (await _db.CortexEdges.ToListAsync(ct)).ToDictionary(x => (x.FromKey, x.ToKey, x.Relation));
            foreach (var x in wantedE.Values)
            {
                var ek = $"{x.FromKey}>{x.ToKey}:{x.Relation}";
                if (!existingE.TryGetValue((x.FromKey, x.ToKey, x.Relation), out var e))
                { x.LastSeenAt = now; x.CreatedAt = now; _db.CortexEdges.Add(x); created++; Log("edge", ek, "created", newV: x.Label); continue; }
                e.LastSeenAt = now;
                if (!e.IsActive) { e.IsActive = true; reactivated++; Log("edge", ek, "reactivated"); }
                if (e.Provenance != CortexProvenance.Derived) continue;
                var dirty = false;
                if (e.Label != x.Label) { Log("edge", ek, "updated", "Label", e.Label, x.Label); e.Label = x.Label; dirty = true; }
                if (!e.HandoffCurated && e.Handoff != x.Handoff) { Log("edge", ek, "updated", "Handoff", e.Handoff, x.Handoff); e.Handoff = x.Handoff; dirty = true; }
                if (e.CodeRef != x.CodeRef) { e.CodeRef = x.CodeRef; dirty = true; }
                if (e.Weight != x.Weight) { e.Weight = x.Weight; dirty = true; }
                if (e.DataJson != x.DataJson) { e.DataJson = x.DataJson; dirty = true; }
                if (e.Source != x.Source) { e.Source = x.Source; dirty = true; }
                if (dirty) { e.UpdatedAt = now; updated++; }
            }
            foreach (var e in existingE.Values.Where(x => x.IsActive && x.Provenance == CortexProvenance.Derived && !wantedE.ContainsKey((x.FromKey, x.ToKey, x.Relation))))
            { e.IsActive = false; e.UpdatedAt = now; deactivated++; Log("edge", $"{e.FromKey}>{e.ToKey}:{e.Relation}", "deactivated"); }

            if (changes.Count > 0) _db.CortexChanges.AddRange(changes);
            await _db.SaveChangesAsync(ct);
            var nodeCount = await _db.CortexNodes.CountAsync(n => n.IsActive, ct);
            var edgeCount = await _db.CortexEdges.CountAsync(n => n.IsActive, ct);
            return new RebuildResult(nodeCount, edgeCount, created, updated, deactivated, reactivated, TimeSpan.Zero);
        }

        private static bool Set(CortexNode e, string field, string? oldV, string? newV, Action<string?> apply, Action<string, string, string, string?, string?, string?> log, bool logValues = true)
        {
            if (oldV == newV) return false;
            apply(newV);
            log("node", e.Key, "updated", field, logValues ? oldV : null, logValues ? newV : null);
            return true;
        }

        // ── Helpers ───────────────────────────────────────────────────────────────
        private record StepAssign(int? DepartmentId, string? DepartmentName, int? UserId, string? Role);
        private record StepInfo(string Id, string Type, string? Name, StepAssign? Assign, string? System);

        private static List<StepInfo> ParseSteps(string? graphJson)
        {
            var list = new List<StepInfo>();
            if (string.IsNullOrWhiteSpace(graphJson)) return list;
            try
            {
                using var doc = JsonDocument.Parse(graphJson);
                if (!doc.RootElement.TryGetProperty("steps", out var steps) || steps.ValueKind != JsonValueKind.Array) return list;
                foreach (var s in steps.EnumerateArray())
                {
                    var id = s.TryGetProperty("id", out var i) ? i.GetString() ?? "" : "";
                    var type = s.TryGetProperty("type", out var t) ? t.GetString() ?? "" : "";
                    var name = s.TryGetProperty("name", out var n) ? n.GetString() : null;
                    StepAssign? assign = null; string? system = null;
                    if (s.TryGetProperty("config", out var cfg) && cfg.ValueKind == JsonValueKind.Object)
                    {
                        if (cfg.TryGetProperty("assignTo", out var a) && a.ValueKind == JsonValueKind.Object)
                            assign = new StepAssign(
                                a.TryGetProperty("departmentId", out var di) && di.ValueKind == JsonValueKind.Number ? di.GetInt32() : null,
                                a.TryGetProperty("departmentName", out var dn) ? dn.GetString() : null,
                                a.TryGetProperty("userId", out var ui) && ui.ValueKind == JsonValueKind.Number ? ui.GetInt32() : null,
                                a.TryGetProperty("role", out var r) ? r.GetString() : null);
                        if (cfg.TryGetProperty("action", out var act)) system = act.GetString();
                    }
                    if (id.Length > 0) list.Add(new StepInfo(id, type, name, assign, system));
                }
            }
            catch { /* malformed graph: no steps */ }
            return list;
        }

        /// <summary>Automatic when the engine moves on by itself; someone must act for tasks and approvals.</summary>
        private static string StepHandoff(string type) => type is "task" or "approval" ? CortexHandoff.NeedsSomeone : CortexHandoff.Automatic;

        public static bool IsAdmin(string? role) => role is "Admin" or "Super Admin";
        public static string[] ModulesOf(string? perms, string? role)
        {
            if (IsAdmin(role)) return new[] { "all" };
            if (string.IsNullOrWhiteSpace(perms)) return Array.Empty<string>();
            IEnumerable<string> raw;
            try { raw = JsonSerializer.Deserialize<string[]>(perms) ?? Array.Empty<string>(); } catch { raw = perms.Split(','); }
            return raw.Select(p => p.Trim().ToLowerInvariant().Split('.')[0]).Where(p => p.Length > 0).Distinct().ToArray();
        }
        private static string Norm(string? s) => (s ?? "").Trim().ToLowerInvariant();
        private static string NameKey(string s) { var w = Norm(s).Split(' ', StringSplitOptions.RemoveEmptyEntries); return w.Length > 1 ? $"{w[0]} {w[^1]}" : (w.Length == 1 ? w[0] : ""); }
        private static string Slug(string s) => System.Text.RegularExpressions.Regex.Replace(Norm(s), "[^a-z0-9]+", "-").Trim('-');
        private static string? Trunc(string? s, int n) => s == null ? null : (s.Length <= n ? s : s[..n]);
    }
}
