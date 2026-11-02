using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Cortex;
using ProjectTracker.API.Models.Flows;

namespace ProjectTracker.API.Services.Cortex
{
    /// <summary>
    /// Welly Fix: carries out an accepted suggestion and keeps the receipt.
    ///  • update_step  → edits the step config in FlowDefinitions.GraphJson (dueInHours / escalateTo / assignTo); bumps the version.
    ///  • set_owner    → sets the process owner on the FlowDefinition.
    ///  • curate_step  → cannot be automated (someone has to write the procedure); left as the to-do it already is.
    /// Before applying it snapshots the step's dwell (median / p90 / queue / samples); 14 days later the maintenance
    /// service measures the same step again and writes the "after" next to it, so the change can be judged, not assumed.
    /// Nothing is applied by a schedule - a named person presses the button and is recorded as the one who did.
    /// </summary>
    public class CortexFixService
    {
        public const int MeasureAfterDays = 14;
        private readonly ApplicationDbContext _db;
        private readonly ILogger<CortexFixService> _log;
        public CortexFixService(ApplicationDbContext db, ILogger<CortexFixService> log) { _db = db; _log = log; }

        public record FixResult(bool Ok, string Message, object? Before = null, object? Change = null);
        public record Dwell(DateTime From, DateTime Until, int Samples, double? Median, double? P90, double? Avg, int Queue);
        private static readonly JsonSerializerOptions Camel = new(JsonSerializerDefaults.Web);
        private static JsonNode? ToNode(object? o) => o == null ? null : JsonNode.Parse(JsonSerializer.Serialize(o, Camel));

        public async Task<FixResult> ApplyAsync(CortexNode suggestion, int userId, string userName, int? ownerUserId, CancellationToken ct = default)
        {
            if (suggestion.Type != "suggestion") return new(false, "Only a Welly suggestion can be applied.");
            if (suggestion.Status == "applied") return new(false, "Already applied.");
            if (suggestion.Status == "rejected") return new(false, "This suggestion was rejected.");
            var data = string.IsNullOrWhiteSpace(suggestion.DataJson) ? new JsonObject() : JsonNode.Parse(suggestion.DataJson)?.AsObject() ?? new JsonObject();
            var kind = data["kind"]?.GetValue<string>() ?? "";
            var payload = data["payload"]?.AsObject() ?? new JsonObject();
            var flowId = payload["flowId"]?.GetValue<int>() ?? 0;
            var stepId = payload["stepId"]?.GetValue<string>();
            var flow = await _db.FlowDefinitions.FirstOrDefaultAsync(f => f.Id == flowId, ct);
            if (flow == null) return new(false, "The process this suggestion refers to no longer exists.");
            var now = DateTime.UtcNow;

            object? before = null, change = null;
            switch (kind)
            {
                case "update_step":
                {
                    if (string.IsNullOrWhiteSpace(stepId)) return new(false, "Suggestion has no step.");
                    before = await MeasureAsync(flowId, stepId, null, now, ct);
                    var graph = JsonNode.Parse(flow.GraphJson)?.AsObject();
                    var steps = graph?["steps"]?.AsArray();
                    var step = steps?.FirstOrDefault(s => s?["id"]?.GetValue<string>() == stepId)?.AsObject();
                    if (step == null) return new(false, $"Step '{stepId}' is not in the current version of the process.");
                    var cfg = step["config"]?.AsObject(); if (cfg == null) { cfg = new JsonObject(); step["config"] = cfg; }
                    var hours = payload["escalateAfterHours"]?.GetValue<int>() ?? 24;
                    var toDept = payload["assignToDepartment"]?.GetValue<bool>() ?? false;
                    var dept = flow.DepartmentName;
                    var old = new { assignTo = cfg["assignTo"]?.ToJsonString(), escalateTo = cfg["escalateTo"]?.ToJsonString(), dueInHours = cfg["dueInHours"]?.ToJsonString() };
                    if (toDept && !string.IsNullOrWhiteSpace(dept)) cfg["assignTo"] = new JsonObject { ["departmentName"] = dept };
                    var curDue = cfg["dueInHours"]?.GetValue<double?>();
                    if (curDue == null || curDue > hours) cfg["dueInHours"] = hours;
                    if (cfg["escalateTo"] == null)
                        cfg["escalateTo"] = string.IsNullOrWhiteSpace(dept) ? new JsonObject { ["role"] = "Manager" } : new JsonObject { ["departmentName"] = dept, ["role"] = "Manager" };
                    flow.GraphJson = graph!.ToJsonString();
                    flow.Version++; flow.UpdatedAt = now; flow.UpdatedByUserId = userId;
                    change = new { old, @new = new { assignTo = cfg["assignTo"]?.ToJsonString(), escalateTo = cfg["escalateTo"]?.ToJsonString(), dueInHours = cfg["dueInHours"]?.ToJsonString() }, version = flow.Version };
                    break;
                }
                case "set_owner":
                {
                    int? uid = ownerUserId;
                    if (uid == null)
                    {
                        var name = payload["suggestedOwner"]?.GetValue<string>();
                        if (!string.IsNullOrWhiteSpace(name))
                        {
                            var parts = name.Trim().Split(' ', 2);
                            var q = _db.Users.Where(u => u.IsActive && u.Name == parts[0]);
                            if (parts.Length > 1) q = q.Where(u => u.Surname == parts[1]);
                            var ids = await q.Select(u => u.UserId).Take(2).ToListAsync(ct);
                            if (ids.Count == 1) uid = ids[0];
                        }
                    }
                    if (uid == null) return new(false, "Pick the owner: the suggested name did not match exactly one account.");
                    var u = await _db.Users.AsNoTracking().Where(x => x.UserId == uid).Select(x => new { x.UserId, Full = x.Name + " " + x.Surname, x.Email }).FirstOrDefaultAsync(ct);
                    if (u == null) return new(false, "Owner account not found.");
                    var runs = await _db.FlowRuns.CountAsync(r => r.FlowDefinitionId == flowId, ct);
                    before = new { owner = flow.OwnerName, runs };
                    change = new { oldOwner = flow.OwnerName, newOwner = u.Full };
                    flow.OwnerUserId = u.UserId; flow.OwnerName = u.Full; flow.UpdatedAt = now; flow.UpdatedByUserId = userId;
                    // the process node on the map follows immediately rather than waiting for the nightly rebuild
                    var pn = await _db.CortexNodes.FirstOrDefaultAsync(n => n.Key == $"flow:{flowId}", ct);
                    if (pn != null) { pn.OwnerUserId = u.UserId; pn.OwnerLabel = u.Full; pn.UpdatedAt = now; }
                    break;
                }
                case "curate_step":
                    return new(false, "This one needs a person: write the procedure and name a backup on the step. Welly cannot do that for you.");
                default:
                    return new(false, $"Welly Fix does not know how to apply '{kind}'.");
            }

            data["fix"] = new JsonObject
            {
                ["appliedAt"] = now, ["appliedBy"] = userName, ["appliedByUserId"] = userId,
                ["before"] = ToNode(before),
                ["change"] = ToNode(change),
                ["measureAfterAt"] = kind == "update_step" ? now.AddDays(MeasureAfterDays) : null,
                ["after"] = null
            };
            var oldStatus = suggestion.Status;
            suggestion.DataJson = data.ToJsonString();
            suggestion.Status = "applied"; suggestion.Provenance = CortexProvenance.Curated;
            suggestion.UpdatedAt = now; suggestion.UpdatedByUserId = userId;
            if (suggestion.OwnerUserId == null) { suggestion.OwnerUserId = userId; suggestion.OwnerLabel = userName; }
            _db.CortexChanges.Add(new CortexChange { Target = "node", TargetKey = suggestion.Key, Kind = "applied", Field = "Status", OldValue = oldStatus, NewValue = "applied", ChangedBy = "user", UserId = userId, UserName = userName, OccurredAt = now });
            _db.CortexChanges.Add(new CortexChange { Target = "flow", TargetKey = $"flow:{flowId}", Kind = "fixed", Field = kind, NewValue = JsonSerializer.Serialize(change, Camel), ChangedBy = "welly-fix", UserId = userId, UserName = userName, OccurredAt = now });
            // the parent finding is settled too
            var finding = await _db.CortexNodes.FirstOrDefaultAsync(n => n.Key == suggestion.ParentKey, ct);
            if (finding != null && finding.Status == "pending") { finding.Status = "accepted"; finding.Provenance = CortexProvenance.Curated; finding.UpdatedAt = now; finding.UpdatedByUserId = userId; }
            await _db.SaveChangesAsync(ct);
            _log.LogInformation("Welly Fix applied {Kind} on flow {Flow} by {User}", kind, flowId, userName);
            return new(true, kind == "update_step" ? $"Applied. Welly will measure this step again in {MeasureAfterDays} days and show before/after." : "Applied.", before, change);
        }

        /// <summary>Dwell for one step: tasks created in the window (default last 180 days) that reached completion, plus what is open now.</summary>
        public async Task<Dwell> MeasureAsync(int flowId, string stepId, DateTime? since, DateTime until, CancellationToken ct)
        {
            var from = since ?? until.AddDays(-180);
            var rows = await _db.FlowTasks.AsNoTracking().Where(t => t.Run.FlowDefinitionId == flowId && t.StepId == stepId && t.CreatedAt >= from && t.CreatedAt <= until)
                .Select(t => new { t.CreatedAt, t.CompletedAt, t.Status }).ToListAsync(ct);
            var hours = rows.Where(r => r.CompletedAt != null).Select(r => (r.CompletedAt!.Value - r.CreatedAt).TotalHours).OrderBy(h => h).ToList();
            double? Pct(double p) => hours.Count == 0 ? null : Math.Round(hours[Math.Min(hours.Count - 1, (int)Math.Floor(p * (hours.Count - 1)))], 1);
            return new Dwell(from, until, hours.Count, Pct(0.5), Pct(0.9), hours.Count == 0 ? null : Math.Round(hours.Average(), 1),
                rows.Count(r => r.Status == FlowTaskStatus.Open || r.Status == FlowTaskStatus.Escalated));
        }

        /// <summary>Called by the maintenance service: write the "after" measurement on applied step fixes whose window has passed, and tell the owner.</summary>
        public async Task<int> MeasureAppliedAsync(INotificationBroadcaster? notify, DateTime now, CancellationToken ct)
        {
            var applied = await _db.CortexNodes.Where(n => n.IsActive && n.Type == "suggestion" && n.Status == "applied" && n.DataJson != null && n.DataJson.Contains("\"after\":null")).ToListAsync(ct);
            var done = 0;
            foreach (var n in applied)
            {
                var data = JsonNode.Parse(n.DataJson!)?.AsObject(); var fix = data?["fix"]?.AsObject(); if (data == null || fix == null) continue;
                var at = fix["measureAfterAt"]?.GetValue<DateTime?>(); var appliedAt = fix["appliedAt"]?.GetValue<DateTime?>();
                if (at == null || at > now || appliedAt == null) continue;
                var payload = data["payload"]?.AsObject(); var flowId = payload?["flowId"]?.GetValue<int>() ?? 0; var stepId = payload?["stepId"]?.GetValue<string>();
                if (flowId == 0 || stepId == null) continue;
                var after = await MeasureAsync(flowId, stepId, appliedAt, now, ct);
                fix["after"] = ToNode(after);
                n.DataJson = data.ToJsonString(); n.UpdatedAt = now;
                var bm = fix["before"]?["median"]?.GetValue<double?>(); var am = after.Median;
                var verdict = bm == null || am == null ? "not enough tasks yet to compare" : am < bm ? $"median wait {bm:0.#} h → {am:0.#} h (better)" : am > bm ? $"median wait {bm:0.#} h → {am:0.#} h (worse)" : "no change in median wait";
                _db.CortexChanges.Add(new CortexChange { Target = "node", TargetKey = n.Key, Kind = "measured", Field = "after", OldValue = bm?.ToString("0.#"), NewValue = am?.ToString("0.#"), ChangedBy = "schedule", OccurredAt = now });
                if (n.OwnerUserId != null)
                {
                    var title = $"Welly Fix result: {n.Label}";
                    var body = $"{MeasureAfterDays} days after the change: {verdict}. Open the suggestion in Cortex to see both measurements.";
                    _db.TodoTasks.Add(new TodoTask { Title = title.Length > 500 ? title[..500] : title, Description = body, DueDate = now.AddDays(7).Date, CreatedByUserId = n.OwnerUserId.Value, AssignedToUserId = n.OwnerUserId.Value, Priority = "Normal", Category = "Cortex", Status = "Accepted" });
                    if (notify != null) await notify.NotifyUserAsync(n.OwnerUserId.Value, new NotificationPayload { Type = "todo", Title = title, Body = body, Url = "/flows?tab=cortex&node=" + Uri.EscapeDataString(n.Key) });
                }
                done++;
            }
            if (done > 0) await _db.SaveChangesAsync(ct);
            return done;
        }
    }
}
