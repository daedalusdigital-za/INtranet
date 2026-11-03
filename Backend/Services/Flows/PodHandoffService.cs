using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Flows;

namespace ProjectTracker.API.Services.Flows
{
    /// <summary>
    /// Finance ← Logistics hand-off: debtors wait for proof of delivery. The moment a POD lands in Logistics (uploaded
    /// against a load, scanned and linked to invoice numbers, or linked later) this tells Finance:
    ///  1. every open Flows task that is waiting on a POD gets the invoice numbers written into its run context
    ///     (<c>pods[]</c>), an audit line, and its assignees get a notification with the numbers;
    ///  2. a task whose run is pinned to one of those invoices (EntityType "invoice" / context <c>invoiceNumbers</c>) is
    ///     completed automatically and the run advances - nobody re-keys what the scanner already knows;
    ///  3. the <c>pod.received</c> flow event is published so a designer can trigger a flow on it.
    /// A "POD wait" step is any human step that says so (<c>config.awaits = "pod"</c>) or, by convention, a step that
    /// escalates to Logistics and mentions POD in its name/title - which is how the debtors' flows are written.
    /// Fire-and-forget: runs on its own scope and never slows down or fails the upload.
    /// </summary>
    public interface IPodHandoff
    {
        /// <param name="source">"load" (POD on a tripsheet) or "scan" (POD document linked to invoices)</param>
        void PodReceived(string source, IEnumerable<string> invoiceNumbers, string? customer, string? loadNumber, string? podNumber, int? byUserId);
    }

    public class PodHandoffService : IPodHandoff
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<PodHandoffService> _log;
        public PodHandoffService(IServiceScopeFactory scopes, ILogger<PodHandoffService> log) { _scopes = scopes; _log = log; }

        public void PodReceived(string source, IEnumerable<string> invoiceNumbers, string? customer, string? loadNumber, string? podNumber, int? byUserId)
        {
            var invoices = invoiceNumbers.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    await HandleAsync(scope.ServiceProvider, source, invoices, customer, loadNumber, podNumber, byUserId);
                }
                catch (Exception ex) { _log.LogError(ex, "POD hand-off failed ({Source} {Load} {Pod})", source, loadNumber, podNumber); }
            });
        }

        private async Task HandleAsync(IServiceProvider sp, string source, List<string> invoices, string? customer, string? loadNumber, string? podNumber, int? byUserId)
        {
            var db = sp.GetRequiredService<ApplicationDbContext>();
            var engine = sp.GetRequiredService<IFlowEngine>();
            var notify = sp.GetService<INotificationBroadcaster>();
            var events = sp.GetService<IFlowEventPublisher>();
            var now = DateTime.UtcNow;
            var by = byUserId.HasValue ? await db.Users.AsNoTracking().Where(u => u.UserId == byUserId).Select(u => u.Name + " " + u.Surname).FirstOrDefaultAsync() : null;
            var what = (podNumber != null ? podNumber + " " : "") + (loadNumber != null ? $"on {loadNumber} " : "") + (invoices.Count > 0 ? $"for {string.Join(", ", invoices.Take(6))}{(invoices.Count > 6 ? $" +{invoices.Count - 6}" : "")}" : "");
            var payload = new JsonObject
            {
                ["source"] = source, ["loadNumber"] = loadNumber, ["podNumber"] = podNumber, ["customer"] = customer,
                ["invoiceNumbers"] = new JsonArray(invoices.Select(i => (JsonNode)i).ToArray()), ["receivedAt"] = now, ["receivedBy"] = by
            };

            // 1. open Flows tasks waiting on a POD
            var open = await db.FlowTasks.Include(t => t.Run).ThenInclude(r => r.Definition)
                .Where(t => t.Status == FlowTaskStatus.Open || t.Status == FlowTaskStatus.Escalated).ToListAsync();
            int told = 0, closed = 0;
            foreach (var task in open)
            {
                var graph = FlowEngine.ParseGraph(task.Run);
                var step = graph.Steps.FirstOrDefault(s => s.Id == task.StepId);
                if (step == null || !WaitsForPod(step, task)) continue;

                var ctx = FlowEngine.ParseContext(task.Run);
                var pods = ctx["pods"] as JsonArray ?? new JsonArray();
                pods.Add(payload.DeepClone());
                ctx["pods"] = pods;
                ctx["lastPod"] = payload.DeepClone();
                task.Run.ContextJson = ctx.ToJsonString();
                db.FlowAuditEvents.Add(new FlowAuditEvent { FlowRunId = task.Run.Id, StepId = task.StepId, Type = "pod.received", Message = Trunc($"POD received {what}".Trim(), 1000), UserId = byUserId, UserName = by, DataJson = payload.ToJsonString(), OccurredAt = now });

                var pinned = PinnedInvoices(task.Run, ctx);
                var covers = pinned.Count > 0 && pinned.All(p => invoices.Contains(p, StringComparer.OrdinalIgnoreCase));
                if (covers && task.Kind == "task")
                {
                    // the run is about exactly these invoices: close the wait and move on
                    task.Status = FlowTaskStatus.Completed; task.CompletedAt = now; task.CompletedByUserId = byUserId;
                    task.Comment = Trunc($"Closed automatically: POD received {what}".Trim(), 2000);
                    task.ResultJson = new JsonObject { ["received"] = invoices.Count, ["auto"] = true, ["pod"] = payload.DeepClone() }.ToJsonString();
                    var steps = ctx["steps"] as JsonObject ?? new JsonObject();
                    steps[task.StepId] = new JsonObject { ["decision"] = "completed", ["completedBy"] = by ?? "Logistics (POD)", ["completedByUserId"] = byUserId, ["completedAt"] = now.ToString("yyyy-MM-dd HH:mm"), ["taskId"] = task.Id, ["received"] = invoices.Count, ["auto"] = true };
                    ctx["steps"] = steps; ctx["lastDecision"] = "completed";
                    task.Run.ContextJson = ctx.ToJsonString();
                    if (task.TodoTaskId.HasValue)
                    {
                        var todo = await db.TodoTasks.FindAsync(task.TodoTaskId.Value);
                        if (todo != null && !todo.IsCompleted) { todo.IsCompleted = true; todo.Status = "Completed"; todo.CompletedAt = now; }
                    }
                    db.FlowAuditEvents.Add(new FlowAuditEvent { FlowRunId = task.Run.Id, StepId = task.StepId, Type = "task.completed", Message = Trunc($"\"{task.Title}\" closed by Logistics: POD received {what}".Trim(), 1000), UserId = byUserId, UserName = by, OccurredAt = now });
                    task.Run.CurrentStepId = step.NextStepId; task.Run.Status = FlowRunStatus.Running;
                    await db.SaveChangesAsync();
                    try { await engine.AdvanceAsync(task.Run.Id); } catch (Exception ex) { _log.LogWarning(ex, "Run {Run} could not advance after POD", task.Run.RunNumber); }
                    closed++;
                    await Tell(db, notify, task, $"POD in: \"{task.Title}\" closed", $"{task.Run.RunNumber} · {what}".Trim());
                }
                else
                {
                    await db.SaveChangesAsync();
                    told++;
                    await Tell(db, notify, task, $"POD received {(podNumber ?? loadNumber ?? "")}".Trim(), $"{task.Run.RunNumber} · {(invoices.Count > 0 ? string.Join(", ", invoices.Take(4)) + (invoices.Count > 4 ? "…" : "") : "no invoice numbers")}{(customer != null ? " · " + customer : "")} · tick it off on your task");
                }
            }

            // 2. anyone may trigger a flow on it
            events?.Publish("pod.received", payload, "pod", podNumber ?? loadNumber);
            if (told + closed > 0) _log.LogInformation("POD hand-off {What}: {Told} Finance tasks told, {Closed} closed", what, told, closed);
        }

        /// <summary>A step is a POD wait if it says so, or by convention: it is about PODs and either escalates to or is assigned to Logistics.</summary>
        public static bool WaitsForPod(FlowStep step, FlowTask task)
        {
            if (step.Type != "task" && step.Type != "approval") return false;
            var awaits = FlowExpressions.GetString(step.Config, "awaits");
            if (string.Equals(awaits, "pod", StringComparison.OrdinalIgnoreCase)) return true;
            static bool Logistics(JsonElement? e) => e is JsonElement x && x.ValueKind == JsonValueKind.Object && x.TryGetProperty("departmentName", out var d) && (d.GetString() ?? "").Contains("logistic", StringComparison.OrdinalIgnoreCase);
            var involvesLogistics = Logistics(FlowExpressions.GetElement(step.Config, "escalateTo")) || Logistics(FlowExpressions.GetElement(step.Config, "assignTo"));
            var text = $"{step.Name} {task.Title}";
            return involvesLogistics && text.Contains("pod", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>Invoices this run is specifically about, if any: entity key or context invoiceNumbers / invoices.</summary>
        private static List<string> PinnedInvoices(FlowRun run, JsonObject ctx)
        {
            var list = new List<string>();
            if (string.Equals(run.EntityType, "invoice", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(run.EntityKey)) list.Add(run.EntityKey);
            foreach (var key in new[] { "invoiceNumbers", "invoices", "missingPodInvoices", "invoiceNo", "invoiceNumber" })
            {
                var node = ctx[key] ?? (ctx["inputs"] as JsonObject)?[key] ?? (ctx["entity"] as JsonObject)?[key] ?? (ctx["input"] as JsonObject)?[key];
                if (node is JsonArray arr) list.AddRange(arr.Select(x => x?.ToString()).Where(x => !string.IsNullOrWhiteSpace(x))!);
                else if (node is JsonValue v && v.TryGetValue<string>(out var s)) list.AddRange(s.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
            }
            return list.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        private static async Task Tell(ApplicationDbContext db, INotificationBroadcaster? notify, FlowTask task, string title, string body)
        {
            if (notify == null) return;
            List<int> ids;
            if (task.AssignedToUserId.HasValue) ids = new List<int> { task.AssignedToUserId.Value };
            else
            {
                var q = db.Users.Where(u => u.IsActive);
                if (task.AssignedToDepartmentId.HasValue) q = q.Where(u => u.DepartmentId == task.AssignedToDepartmentId);
                if (!string.IsNullOrWhiteSpace(task.AssignedToRole)) q = q.Where(u => u.Role == task.AssignedToRole);
                ids = task.AssignedToDepartmentId.HasValue || !string.IsNullOrWhiteSpace(task.AssignedToRole) ? await q.Select(u => u.UserId).Take(50).ToListAsync() : new List<int>();
            }
            if (ids.Count == 0) return;
            try { await notify.NotifyUsersAsync(ids, new NotificationPayload { Type = "flow", Title = title, Body = body, Url = $"/flows?task={task.Id}" }); }
            catch { /* best effort */ }
        }

        private static string Trunc(string s, int n) => s.Length <= n ? s : s[..n];
    }
}
