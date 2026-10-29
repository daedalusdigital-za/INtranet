using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Flows;
using ProjectTracker.API.Services.Flows;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Flows — automated business processes. Designing flows needs the "flows" module permission;
    /// anyone signed in can see and complete tasks assigned to them and start flows they are allowed to start.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/flows")]
    public class FlowsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IFlowEngine _engine;
        private readonly IFlowDataSources _sources;
        private readonly IFlowEventPublisher _events;
        private readonly ILogger<FlowsController> _logger;

        public FlowsController(ApplicationDbContext db, IFlowEngine engine, IFlowDataSources sources, IFlowEventPublisher events, ILogger<FlowsController> logger)
        {
            _db = db; _engine = engine; _sources = sources; _events = events; _logger = logger;
        }

        private int Uid => User.GetUserId() ?? 0;

        private async Task<bool> IsDesignerAsync()
        {
            if (User.IsAdmin()) return true;
            var u = await _db.Users.AsNoTracking().Where(x => x.UserId == Uid).Select(x => new { x.Permissions }).FirstOrDefaultAsync();
            var perms = (u?.Permissions ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return perms.Contains("all", StringComparer.OrdinalIgnoreCase) || perms.Contains("flows", StringComparer.OrdinalIgnoreCase);
        }

        // ── DTOs ──────────────────────────────────────────────────────────────────────

        public class FlowDefinitionDto
        {
            public int Id { get; set; }
            public string Name { get; set; } = "";
            public string? Description { get; set; }
            public string? Category { get; set; }
            public string? DepartmentName { get; set; }
            public int Level { get; set; }
            public string TriggerType { get; set; } = "manual";
            public JsonElement Trigger { get; set; }
            public JsonElement Graph { get; set; }
            public JsonElement Inputs { get; set; }
            public bool IsEnabled { get; set; }
            public bool IsTemplate { get; set; }
            public int Version { get; set; }
            public string? StartPermissions { get; set; }
            public DateTime? LastScheduledRunAt { get; set; }
            public DateTime CreatedAt { get; set; }
            public string? CreatedBy { get; set; }
            public DateTime? UpdatedAt { get; set; }
            public int RunCount { get; set; }
            public int ActiveRuns { get; set; }
            public bool CanStart { get; set; }
        }

        public class SaveFlowRequest
        {
            public string Name { get; set; } = "";
            public string? Description { get; set; }
            public string? Category { get; set; }
            public string? DepartmentName { get; set; }
            public int Level { get; set; } = 1;
            public string TriggerType { get; set; } = "manual";
            public JsonElement? Trigger { get; set; }
            public JsonElement? Graph { get; set; }
            public JsonElement? Inputs { get; set; }
            public bool IsEnabled { get; set; } = true;
            public string? StartPermissions { get; set; }
        }

        public class StartRunRequest { public JsonElement? Inputs { get; set; } public string? Title { get; set; } public string? Priority { get; set; } }
        public class CompleteTaskRequest { public string? Decision { get; set; } public JsonElement? Result { get; set; } public string? Comment { get; set; } }
        public class ReassignRequest { public int? UserId { get; set; } public string? Role { get; set; } public int? DepartmentId { get; set; } }
        public class CancelRequest { public string? Reason { get; set; } }

        private static JsonElement Parse(string? json, string fallback)
        {
            try { return JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? fallback : json).RootElement.Clone(); }
            catch { return JsonDocument.Parse(fallback).RootElement.Clone(); }
        }

        private async Task<FlowDefinitionDto> ToDtoAsync(FlowDefinition d, bool designer, string role, string? perms, int? deptId)
        {
            var stats = await _db.FlowRuns.Where(r => r.FlowDefinitionId == d.Id)
                .GroupBy(r => 1).Select(g => new { Total = g.Count(), Active = g.Count(r => r.Status == FlowRunStatus.Running || r.Status == FlowRunStatus.Waiting) })
                .FirstOrDefaultAsync();
            return new FlowDefinitionDto
            {
                Id = d.Id, Name = d.Name, Description = d.Description, Category = d.Category, DepartmentName = d.DepartmentName, Level = d.Level,
                TriggerType = d.TriggerType, Trigger = Parse(d.TriggerJson, "{}"), Graph = Parse(d.GraphJson, "{\"steps\":[]}"), Inputs = Parse(d.InputsJson, "[]"),
                IsEnabled = d.IsEnabled, IsTemplate = d.IsTemplate, Version = d.Version, StartPermissions = d.StartPermissions,
                LastScheduledRunAt = d.LastScheduledRunAt, CreatedAt = d.CreatedAt, CreatedBy = d.CreatedByUser == null ? (d.CreatedByUserId == null ? "System" : null) : d.CreatedByUser.Name + " " + d.CreatedByUser.Surname, UpdatedAt = d.UpdatedAt,
                RunCount = stats?.Total ?? 0, ActiveRuns = stats?.Active ?? 0,
                CanStart = d.TriggerType == FlowTriggerType.Manual && d.IsEnabled && !d.IsTemplate && CanStart(d, designer, role, perms, deptId)
            };
        }

        /// <summary>StartPermissions: null/empty = everyone; otherwise comma list of role:X, dept:ID, user:ID, module:key.</summary>
        private static bool CanStart(FlowDefinition d, bool designer, string role, string? perms, int? deptId)
        {
            if (designer) return true;
            if (string.IsNullOrWhiteSpace(d.StartPermissions)) return true;
            var permList = (perms ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var rule in d.StartPermissions.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var parts = rule.Split(':', 2);
                if (parts.Length != 2) continue;
                switch (parts[0].ToLowerInvariant())
                {
                    case "role": if (string.Equals(parts[1], role, StringComparison.OrdinalIgnoreCase)) return true; break;
                    case "dept": if (int.TryParse(parts[1], out var did) && did == deptId) return true; break;
                    case "module": if (permList.Contains(parts[1], StringComparer.OrdinalIgnoreCase)) return true; break;
                }
            }
            return false;
        }

        private async Task<(string role, string? perms, int? deptId)> MeAsync()
        {
            var u = await _db.Users.AsNoTracking().Where(x => x.UserId == Uid).Select(x => new { x.Role, x.Permissions, x.DepartmentId }).FirstOrDefaultAsync();
            return (u?.Role ?? "", u?.Permissions, u?.DepartmentId);
        }

        // ── Catalog / lookups ─────────────────────────────────────────────────────────

        [HttpGet("catalog")]
        public async Task<IActionResult> Catalog()
        {
            var designer = await IsDesignerAsync();
            var users = await _db.Users.AsNoTracking().Where(u => u.IsActive).OrderBy(u => u.Name).ThenBy(u => u.Surname)
                .Select(u => new { id = u.UserId, name = u.Name + " " + u.Surname, email = u.Email, role = u.Role, departmentId = u.DepartmentId }).ToListAsync();
            var departments = await _db.Departments.AsNoTracking().OrderBy(d => d.Name).Select(d => new { id = d.DepartmentId, name = d.Name, manager = d.ManagerName }).ToListAsync();
            var roles = users.Select(u => u.role).Where(r => !string.IsNullOrWhiteSpace(r)).Distinct().OrderBy(r => r).ToList();
            return Ok(new
            {
                isDesigner = designer,
                users, departments, roles,
                events = _events.KnownEvents.Select(e => new { key = e.Key, description = e.Description }),
                dataSources = _sources.Catalog,
                stepTypes = new[]
                {
                    new { type = "condition", name = "Decision", icon = "call_split", description = "Branch on an expression, e.g. inputs.amount > 20000 or ai.priority == \"Urgent\"" },
                    new { type = "ai_analyze", name = "Welly analyses", icon = "psychology", description = "Ask Welly to read the data and return structured fields (category, priority, summary…)" },
                    new { type = "task", name = "Task", icon = "assignment_ind", description = "Assign work to a person, role or department with a deadline and optional form" },
                    new { type = "approval", name = "Approval", icon = "fact_check", description = "Approve / reject gate with separate next steps" },
                    new { type = "notify", name = "Notify", icon = "notifications_active", description = "In-app notification to people, a role or a department" },
                    new { type = "email", name = "Email", icon = "mail", description = "Send an email (templated)" },
                    new { type = "welly_action", name = "System action", icon = "bolt", description = "Run a Welly action (create ticket, log incident, update shipment…)" },
                    new { type = "set", name = "Set value", icon = "data_object", description = "Store a computed value in vars.<key>" },
                    new { type = "wait", name = "Wait", icon = "hourglass_empty", description = "Pause for N minutes/hours then continue" },
                    new { type = "end", name = "End", icon = "flag", description = "Finish the run with an outcome label" },
                },
                actions = new[]
                {
                    "CREATE_TICKET", "CREATE_TODO", "LOG_INCIDENT", "CREATE_ANNOUNCEMENT", "SEND_MESSAGE", "SEND_EMAIL",
                    "UPDATE_SHIPMENT_STATUS", "CREATE_LEAVE_REQUEST", "CREATE_PROJECT_TASK"
                }
            });
        }

        // ── Definitions ───────────────────────────────────────────────────────────────

        [HttpGet("definitions")]
        public async Task<IActionResult> ListDefinitions([FromQuery] bool templates = false)
        {
            var designer = await IsDesignerAsync();
            var (role, perms, deptId) = await MeAsync();
            var defs = await _db.FlowDefinitions.AsNoTracking().Include(d => d.CreatedByUser).Where(d => d.IsTemplate == templates).OrderBy(d => d.Level).ThenBy(d => d.Name).ToListAsync();
            var list = new List<FlowDefinitionDto>();
            foreach (var d in defs)
            {
                var dto = await ToDtoAsync(d, designer, role, perms, deptId);
                if (templates || designer || dto.CanStart) list.Add(dto);
            }
            return Ok(list);
        }

        [HttpGet("definitions/{id:int}")]
        public async Task<IActionResult> GetDefinition(int id)
        {
            var d = await _db.FlowDefinitions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            var (role, perms, deptId) = await MeAsync();
            return Ok(await ToDtoAsync(d, await IsDesignerAsync(), role, perms, deptId));
        }

        [HttpPost("definitions")]
        [RequireModule("flows")]
        public async Task<IActionResult> CreateDefinition([FromBody] SaveFlowRequest req)
        {
            var err = Validate(req); if (err != null) return BadRequest(new { message = err });
            var d = new FlowDefinition { CreatedByUserId = Uid, CreatedAt = DateTime.UtcNow };
            Apply(d, req);
            _db.FlowDefinitions.Add(d);
            await _db.SaveChangesAsync();
            var (role, perms, deptId) = await MeAsync();
            return Ok(await ToDtoAsync(d, true, role, perms, deptId));
        }

        [HttpPut("definitions/{id:int}")]
        [RequireModule("flows")]
        public async Task<IActionResult> UpdateDefinition(int id, [FromBody] SaveFlowRequest req)
        {
            var d = await _db.FlowDefinitions.FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            if (d.IsTemplate && !User.IsAdmin()) return Forbid();
            var err = Validate(req); if (err != null) return BadRequest(new { message = err });
            Apply(d, req);
            d.Version++;
            d.UpdatedAt = DateTime.UtcNow;
            d.UpdatedByUserId = Uid;
            await _db.SaveChangesAsync();
            var (role, perms, deptId) = await MeAsync();
            return Ok(await ToDtoAsync(d, true, role, perms, deptId));
        }

        [HttpPost("definitions/{id:int}/toggle")]
        [RequireModule("flows")]
        public async Task<IActionResult> Toggle(int id)
        {
            var d = await _db.FlowDefinitions.FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            d.IsEnabled = !d.IsEnabled; d.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { d.Id, d.IsEnabled });
        }

        [HttpDelete("definitions/{id:int}")]
        [RequireModule("flows")]
        public async Task<IActionResult> DeleteDefinition(int id)
        {
            var d = await _db.FlowDefinitions.FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            if (d.IsTemplate) return BadRequest(new { message = "Templates cannot be deleted." });
            var active = await _db.FlowRuns.AnyAsync(r => r.FlowDefinitionId == id && (r.Status == FlowRunStatus.Running || r.Status == FlowRunStatus.Waiting));
            if (active) return BadRequest(new { message = "This flow still has active runs. Cancel them first or disable the flow." });
            _db.FlowDefinitions.Remove(d);
            await _db.SaveChangesAsync();
            return Ok(new { deleted = true });
        }

        /// <summary>Clone a template (or any flow) into a new editable, disabled flow.</summary>
        [HttpPost("definitions/{id:int}/clone")]
        [RequireModule("flows")]
        public async Task<IActionResult> Clone(int id)
        {
            var src = await _db.FlowDefinitions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (src == null) return NotFound();
            var d = new FlowDefinition
            {
                Name = src.IsTemplate ? src.Name : src.Name + " (copy)",
                Description = src.Description, Category = src.Category, DepartmentName = src.DepartmentName, Level = src.Level, TriggerType = src.TriggerType,
                TriggerJson = src.TriggerJson, GraphJson = src.GraphJson, InputsJson = src.InputsJson,
                IsEnabled = src.TriggerType == FlowTriggerType.Manual, IsTemplate = false, StartPermissions = src.StartPermissions,
                CreatedByUserId = Uid, CreatedAt = DateTime.UtcNow
            };
            var n = 1; var baseName = d.Name;
            while (await _db.FlowDefinitions.AnyAsync(x => !x.IsTemplate && x.Name == d.Name)) d.Name = $"{baseName} ({++n})";
            _db.FlowDefinitions.Add(d);
            await _db.SaveChangesAsync();
            var (role, perms, deptId) = await MeAsync();
            return Ok(await ToDtoAsync(d, true, role, perms, deptId));
        }

        /// <summary>Validate a graph without saving — returns warnings (unreachable steps, missing targets…).</summary>
        [HttpPost("definitions/validate")]
        public IActionResult ValidateGraph([FromBody] SaveFlowRequest req)
        {
            var err = Validate(req);
            var warnings = GraphWarnings(req.Graph);
            return Ok(new { ok = err == null && warnings.Count == 0, error = err, warnings });
        }

        private static string? Validate(SaveFlowRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name)) return "Name is required.";
            if (req.TriggerType is not (FlowTriggerType.Manual or FlowTriggerType.Event or FlowTriggerType.Schedule)) return "Invalid trigger type.";
            if (req.Level is < 1 or > 3) return "Level must be 1, 2 or 3.";
            if (req.Graph == null || req.Graph.Value.ValueKind != JsonValueKind.Object) return "Graph is required.";
            if (!req.Graph.Value.TryGetProperty("steps", out var steps) || steps.ValueKind != JsonValueKind.Array || steps.GetArrayLength() == 0) return "Flow needs at least one step.";
            var ids = new HashSet<string>();
            foreach (var s in steps.EnumerateArray())
            {
                var id = s.TryGetProperty("id", out var i) ? i.GetString() : null;
                if (string.IsNullOrWhiteSpace(id)) return "Every step needs an id.";
                if (!ids.Add(id!)) return $"Duplicate step id '{id}'.";
                var type = s.TryGetProperty("type", out var t) ? t.GetString() : null;
                if (type is not ("condition" or "ai_analyze" or "task" or "approval" or "notify" or "email" or "welly_action" or "set" or "wait" or "end"))
                    return $"Step '{id}' has unknown type '{type}'.";
            }
            if (req.TriggerType == FlowTriggerType.Event)
            {
                var ev = req.Trigger?.ValueKind == JsonValueKind.Object && req.Trigger.Value.TryGetProperty("event", out var e) ? e.GetString() : null;
                if (string.IsNullOrWhiteSpace(ev)) return "Event-triggered flows need an event name.";
            }
            if (req.TriggerType == FlowTriggerType.Schedule)
            {
                var ds = req.Trigger?.ValueKind == JsonValueKind.Object && req.Trigger.Value.TryGetProperty("dataSource", out var e) ? e.GetString() : null;
                if (string.IsNullOrWhiteSpace(ds)) return "Scheduled flows need a data source.";
            }
            return null;
        }

        private static List<string> GraphWarnings(JsonElement? graph)
        {
            var warnings = new List<string>();
            if (graph == null || !graph.Value.TryGetProperty("steps", out var steps) || steps.ValueKind != JsonValueKind.Array) return warnings;
            var all = steps.EnumerateArray().ToList();
            var ids = all.Select(s => s.GetProperty("id").GetString()!).ToHashSet();
            var referenced = new HashSet<string>();
            string? start = graph.Value.TryGetProperty("startStepId", out var st) ? st.GetString() : all.FirstOrDefault().TryGetProperty("id", out var f) ? f.GetString() : null;
            if (start != null) referenced.Add(start);
            foreach (var s in all)
            {
                var id = s.GetProperty("id").GetString()!;
                void Check(string? target, string label)
                {
                    if (string.IsNullOrEmpty(target)) return;
                    referenced.Add(target);
                    if (!ids.Contains(target)) warnings.Add($"Step '{id}' {label} points to missing step '{target}'.");
                }
                Check(s.TryGetProperty("nextStepId", out var n) ? n.GetString() : null, "next");
                if (s.TryGetProperty("config", out var cfg) && cfg.ValueKind == JsonValueKind.Object)
                    foreach (var key in new[] { "trueStepId", "falseStepId", "approvedStepId", "rejectedStepId" })
                        if (cfg.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String) Check(v.GetString(), key);
                var type = s.GetProperty("type").GetString();
                if (type == "condition" && (!s.TryGetProperty("config", out var c2) || !c2.TryGetProperty("expression", out _))) warnings.Add($"Decision '{id}' has no expression.");
                if ((type == "task" || type == "approval") && (!s.TryGetProperty("config", out var c3) || !c3.TryGetProperty("assignTo", out _))) warnings.Add($"'{id}' has no assignee — it will go to whoever started the run.");
            }
            foreach (var id in ids.Where(i => !referenced.Contains(i))) warnings.Add($"Step '{id}' is unreachable.");
            return warnings;
        }

        private static void Apply(FlowDefinition d, SaveFlowRequest req)
        {
            d.Name = req.Name.Trim();
            d.Description = req.Description;
            d.Category = req.Category;
            d.DepartmentName = string.IsNullOrWhiteSpace(req.DepartmentName) ? null : req.DepartmentName.Trim();
            d.Level = req.Level;
            d.TriggerType = req.TriggerType;
            d.TriggerJson = req.Trigger?.GetRawText() ?? "{}";
            d.GraphJson = req.Graph?.GetRawText() ?? "{\"steps\":[]}";
            d.InputsJson = req.Inputs?.GetRawText() ?? "[]";
            d.IsEnabled = req.IsEnabled;
            d.StartPermissions = req.StartPermissions;
        }

        // ── Runs ──────────────────────────────────────────────────────────────────────

        [HttpPost("definitions/{id:int}/start")]
        public async Task<IActionResult> Start(int id, [FromBody] StartRunRequest? req)
        {
            var d = await _db.FlowDefinitions.FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            if (d.IsTemplate) return BadRequest(new { message = "Clone the template into a flow first." });
            var designer = await IsDesignerAsync();
            var (role, perms, deptId) = await MeAsync();
            if (!CanStart(d, designer, role, perms, deptId)) return Forbid();

            if (d.TriggerType == FlowTriggerType.Schedule)
            {
                // Designers may test a schedule even while it is paused.
                if (!designer) return Forbid();
                var n = await _engine.RunScheduledNowAsync(id);
                return Ok(new { started = n, message = n == 0 ? "Checked — nothing matched the data source right now." : $"Started {n} run(s)." });
            }
            if (!d.IsEnabled) return BadRequest(new { message = "This flow is disabled." });

            var inputs = req?.Inputs is { ValueKind: JsonValueKind.Object } ie ? JsonNode.Parse(ie.GetRawText()) as JsonObject : new JsonObject();
            // Required-input check
            foreach (var def in Parse(d.InputsJson, "[]").EnumerateArray())
            {
                var required = def.TryGetProperty("required", out var r) && r.ValueKind == JsonValueKind.True;
                var key = def.TryGetProperty("key", out var k) ? k.GetString() : null;
                if (required && key != null && (inputs![key] == null || string.IsNullOrWhiteSpace(inputs[key]!.ToString())))
                    return BadRequest(new { message = $"'{(def.TryGetProperty("label", out var l) ? l.GetString() : key)}' is required." });
            }
            var ctx = new JsonObject { ["inputs"] = inputs, ["trigger"] = new JsonObject { ["type"] = "manual" } };
            try
            {
                var run = await _engine.StartRunAsync(d, ctx, "manual", Uid, null, null, string.IsNullOrWhiteSpace(req?.Title) ? null : req!.Title);
                if (!string.IsNullOrWhiteSpace(req?.Priority)) { run.Priority = req!.Priority!; await _db.SaveChangesAsync(); }
                return Ok(await RunDetailAsync(run.Id));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Flow start failed");
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("runs")]
        public async Task<IActionResult> Runs([FromQuery] string? status, [FromQuery] int? definitionId, [FromQuery] string? q, [FromQuery] bool mine = false, [FromQuery] int take = 100)
        {
            var designer = await IsDesignerAsync();
            var query = _db.FlowRuns.AsNoTracking().Include(r => r.Definition).Include(r => r.StartedByUser).Include(r => r.Tasks).AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
            {
                var parts = status.Split(',');
                query = query.Where(r => parts.Contains(r.Status));
            }
            if (definitionId.HasValue) query = query.Where(r => r.FlowDefinitionId == definitionId);
            if (!string.IsNullOrWhiteSpace(q)) query = query.Where(r => r.Title.Contains(q) || r.RunNumber.Contains(q) || (r.EntityKey != null && r.EntityKey.Contains(q)));
            if (mine || !designer)
            {
                var uid = Uid;
                var (role, _, deptId) = await MeAsync();
                query = query.Where(r => r.StartedByUserId == uid || r.Tasks.Any(t => t.AssignedToUserId == uid || t.CompletedByUserId == uid
                    || (t.AssignedToUserId == null && (t.AssignedToDepartmentId == null || t.AssignedToDepartmentId == deptId) && (t.AssignedToRole == null || t.AssignedToRole == role))));
            }
            var runs = await query.OrderByDescending(r => r.StartedAt).Take(Math.Clamp(take, 1, 500)).ToListAsync();
            return Ok(runs.Select(RunSummary));
        }

        private static object RunSummary(FlowRun r) => new
        {
            r.Id, r.RunNumber, r.Title, r.Status, r.Priority, r.Outcome, r.Error,
            flowName = r.Definition?.Name, flowId = r.FlowDefinitionId, level = r.Definition?.Level, category = r.Definition?.Category,
            r.TriggerSource, r.EntityType, r.EntityKey, r.CurrentStepId,
            startedBy = r.StartedByUser == null ? (r.TriggerSource == "schedule" ? "Scheduler" : "System") : r.StartedByUser.Name + " " + r.StartedByUser.Surname,
            r.StartedAt, r.CompletedAt, r.ResumeAt,
            openTasks = r.Tasks.Count(t => t.Status == FlowTaskStatus.Open || t.Status == FlowTaskStatus.Escalated),
            overdueTasks = r.Tasks.Count(t => t.IsOverdue && (t.Status == FlowTaskStatus.Open || t.Status == FlowTaskStatus.Escalated)),
            currentAssignee = r.Tasks.Where(t => t.Status == FlowTaskStatus.Open || t.Status == FlowTaskStatus.Escalated).OrderByDescending(t => t.CreatedAt).Select(t => t.AssigneeLabel).FirstOrDefault(),
            durationMinutes = Math.Round(((r.CompletedAt ?? DateTime.UtcNow) - r.StartedAt).TotalMinutes)
        };

        [HttpGet("runs/{id:int}")]
        public async Task<IActionResult> Run(int id)
        {
            var detail = await RunDetailAsync(id);
            return detail == null ? NotFound() : Ok(detail);
        }

        private async Task<object?> RunDetailAsync(int id)
        {
            var r = await _db.FlowRuns.AsNoTracking().Include(x => x.Definition).Include(x => x.StartedByUser).Include(x => x.Tasks).ThenInclude(t => t.CompletedByUser)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (r == null) return null;
            var events = await _db.FlowAuditEvents.AsNoTracking().Where(e => e.FlowRunId == id).OrderBy(e => e.OccurredAt).ThenBy(e => e.Id).ToListAsync();
            return new
            {
                summary = RunSummary(r),
                context = Parse(r.ContextJson, "{}"),
                graph = Parse(r.Definition.GraphJson, "{\"steps\":[]}"),
                tasks = r.Tasks.OrderBy(t => t.CreatedAt).Select(TaskDto),
                events = events.Select(e => new { e.Id, e.StepId, e.Type, e.Message, e.UserName, e.OccurredAt, data = string.IsNullOrEmpty(e.DataJson) ? (JsonElement?)null : Parse(e.DataJson, "null") })
            };
        }

        [HttpPost("runs/{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] CancelRequest? req)
        {
            var r = await _db.FlowRuns.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (r == null) return NotFound();
            if (!(await IsDesignerAsync()) && r.StartedByUserId != Uid) return Forbid();
            await _engine.CancelRunAsync(id, Uid, req?.Reason);
            return Ok(await RunDetailAsync(id));
        }

        // ── Tasks ─────────────────────────────────────────────────────────────────────

        private static object TaskDto(FlowTask t) => new
        {
            t.Id, t.FlowRunId, t.StepId, t.Kind, t.Title, t.Description, t.Priority, t.Status, t.DueAt, t.IsOverdue, t.EscalationCount, t.EscalatedAt,
            t.AssignedToUserId, t.AssignedToRole, t.AssignedToDepartmentId, t.AssigneeLabel,
            form = string.IsNullOrEmpty(t.FormJson) ? (JsonElement?)null : Parse(t.FormJson, "[]"),
            result = string.IsNullOrEmpty(t.ResultJson) ? (JsonElement?)null : Parse(t.ResultJson, "{}"),
            t.Comment, t.CompletedAt, completedBy = t.CompletedByUser == null ? null : t.CompletedByUser.Name + " " + t.CompletedByUser.Surname, t.CreatedAt,
            runNumber = t.Run?.RunNumber, runTitle = t.Run?.Title, flowName = t.Run?.Definition?.Name, level = t.Run?.Definition?.Level
        };

        [HttpGet("tasks/mine")]
        public async Task<IActionResult> MyTasks([FromQuery] bool includeDone = false)
        {
            var uid = Uid;
            var (role, _, deptId) = await MeAsync();
            var q = _db.FlowTasks.AsNoTracking().Include(t => t.Run).ThenInclude(r => r.Definition).Include(t => t.CompletedByUser)
                .Where(t => t.AssignedToUserId == uid
                         || (t.AssignedToUserId == null && (t.AssignedToDepartmentId == null || t.AssignedToDepartmentId == deptId) && (t.AssignedToRole == null || t.AssignedToRole == role) && (t.AssignedToDepartmentId != null || t.AssignedToRole != null))
                         || t.CompletedByUserId == uid);
            if (!includeDone) q = q.Where(t => t.Status == FlowTaskStatus.Open || t.Status == FlowTaskStatus.Escalated);
            var tasks = await q.OrderBy(t => t.Status == FlowTaskStatus.Open || t.Status == FlowTaskStatus.Escalated ? 0 : 1).ThenBy(t => t.DueAt ?? DateTime.MaxValue).ThenByDescending(t => t.CreatedAt).Take(200).ToListAsync();
            return Ok(tasks.Select(TaskDto));
        }

        [HttpGet("tasks")]
        [RequireModule("flows")]
        public async Task<IActionResult> AllTasks([FromQuery] string? status = "open,escalated")
        {
            var parts = (status ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries);
            var q = _db.FlowTasks.AsNoTracking().Include(t => t.Run).ThenInclude(r => r.Definition).Include(t => t.CompletedByUser).AsQueryable();
            if (parts.Length > 0) q = q.Where(t => parts.Contains(t.Status));
            var tasks = await q.OrderBy(t => t.DueAt ?? DateTime.MaxValue).ThenByDescending(t => t.CreatedAt).Take(300).ToListAsync();
            return Ok(tasks.Select(TaskDto));
        }

        [HttpPost("tasks/{id:int}/complete")]
        public async Task<IActionResult> Complete(int id, [FromBody] CompleteTaskRequest req)
        {
            try
            {
                var result = req.Result is { ValueKind: JsonValueKind.Object } re ? JsonNode.Parse(re.GetRawText()) as JsonObject : null;
                var t = await _engine.CompleteTaskAsync(id, Uid, req.Decision, result, req.Comment);
                return Ok(new { task = TaskDto(t), run = await RunDetailAsync(t.FlowRunId) });
            }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPost("tasks/{id:int}/reassign")]
        public async Task<IActionResult> Reassign(int id, [FromBody] ReassignRequest req)
        {
            var t = await _db.FlowTasks.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (t == null) return NotFound();
            if (!(await IsDesignerAsync()) && t.AssignedToUserId != Uid) return Forbid();
            if (req.UserId == null && string.IsNullOrWhiteSpace(req.Role) && req.DepartmentId == null) return BadRequest(new { message = "Choose a user, role or department." });
            await _engine.ReassignTaskAsync(id, Uid, req.UserId, req.Role, req.DepartmentId);
            return Ok(await RunDetailAsync(t.FlowRunId));
        }

        // ── Dashboard ─────────────────────────────────────────────────────────────────

        [HttpGet("stats")]
        public async Task<IActionResult> Stats()
        {
            var now = DateTime.UtcNow;
            var since = now.AddDays(-30);
            var uid = Uid;
            var (role, _, deptId) = await MeAsync();
            var myOpen = await _db.FlowTasks.CountAsync(t => (t.Status == FlowTaskStatus.Open || t.Status == FlowTaskStatus.Escalated) &&
                (t.AssignedToUserId == uid || (t.AssignedToUserId == null && (t.AssignedToDepartmentId == null || t.AssignedToDepartmentId == deptId) && (t.AssignedToRole == null || t.AssignedToRole == role) && (t.AssignedToDepartmentId != null || t.AssignedToRole != null))));
            var myOverdue = await _db.FlowTasks.CountAsync(t => t.IsOverdue && (t.Status == FlowTaskStatus.Open || t.Status == FlowTaskStatus.Escalated) && t.AssignedToUserId == uid);
            var active = await _db.FlowRuns.CountAsync(r => r.Status == FlowRunStatus.Running || r.Status == FlowRunStatus.Waiting);
            var completed30 = await _db.FlowRuns.CountAsync(r => r.Status == FlowRunStatus.Completed && r.CompletedAt >= since);
            var failed30 = await _db.FlowRuns.CountAsync(r => r.Status == FlowRunStatus.Failed && r.CompletedAt >= since);
            var durations = await _db.FlowRuns.Where(r => r.Status == FlowRunStatus.Completed && r.CompletedAt >= since).Select(r => new { r.StartedAt, r.CompletedAt }).ToListAsync();
            var avgHours = durations.Count == 0 ? 0 : Math.Round(durations.Average(d => (d.CompletedAt!.Value - d.StartedAt).TotalHours), 1);
            var enabled = await _db.FlowDefinitions.CountAsync(d => d.IsEnabled && !d.IsTemplate);
            var byFlow = await _db.FlowRuns.Where(r => r.StartedAt >= since).GroupBy(r => r.Definition.Name)
                .Select(g => new { name = g.Key, runs = g.Count(), active = g.Count(r => r.Status == FlowRunStatus.Running || r.Status == FlowRunStatus.Waiting), failed = g.Count(r => r.Status == FlowRunStatus.Failed) })
                .OrderByDescending(x => x.runs).Take(10).ToListAsync();
            return Ok(new { myOpen, myOverdue, active, completed30, failed30, avgHours, enabled, byFlow });
        }
    }
}
