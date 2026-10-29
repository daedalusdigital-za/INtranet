using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Flows;

namespace ProjectTracker.API.Services.Flows
{
    public interface IFlowEngine
    {
        Task<FlowRun> StartRunAsync(FlowDefinition def, JsonObject context, string triggerSource, int? startedByUserId, string? entityType = null, string? entityKey = null, string? title = null, CancellationToken ct = default);
        Task AdvanceAsync(int runId, CancellationToken ct = default);
        Task<FlowTask> CompleteTaskAsync(int taskId, int userId, string? decision, JsonObject? result, string? comment, CancellationToken ct = default);
        Task CancelRunAsync(int runId, int? userId, string? reason, CancellationToken ct = default);
        Task ReassignTaskAsync(int taskId, int userId, int? toUserId, string? toRole, int? toDepartmentId, CancellationToken ct = default);
        /// <summary>Timers, overdue escalation, schedule triggers. Called by the scheduler.</summary>
        Task TickAsync(CancellationToken ct = default);
        /// <summary>Dispatch a business event to every enabled event-triggered flow.</summary>
        Task DispatchEventAsync(string eventName, JsonObject payload, string? entityType, string? entityKey, CancellationToken ct = default);
        Task<int> RunScheduledNowAsync(int definitionId, CancellationToken ct = default);
    }

    /// <summary>
    /// Executes flow graphs. Everything a step does is written to the run's audit trail; human
    /// steps park the run in <c>waiting</c> until the task/approval is completed, then it resumes.
    /// </summary>
    public class FlowEngine : IFlowEngine
    {
        private readonly ApplicationDbContext _db;
        private readonly IServiceProvider _sp;
        private readonly ILogger<FlowEngine> _logger;
        private const int MaxStepsPerAdvance = 60;

        public FlowEngine(ApplicationDbContext db, IServiceProvider sp, ILogger<FlowEngine> logger)
        {
            _db = db; _sp = sp; _logger = logger;
        }

        // ── Public API ────────────────────────────────────────────────────────────────

        public async Task<FlowRun> StartRunAsync(FlowDefinition def, JsonObject context, string triggerSource, int? startedByUserId, string? entityType = null, string? entityKey = null, string? title = null, CancellationToken ct = default)
        {
            var graph = ParseGraph(def);
            var trigger = ParseTrigger(def);

            var run = new FlowRun
            {
                FlowDefinitionId = def.Id,
                DefinitionVersion = def.Version,
                RunNumber = await NextRunNumberAsync(ct),
                Status = FlowRunStatus.Running,
                TriggerSource = triggerSource,
                EntityType = entityType,
                EntityKey = entityKey,
                StartedByUserId = startedByUserId,
                StartedAt = DateTime.UtcNow,
                CurrentStepId = graph.StartStepId ?? graph.Steps.FirstOrDefault()?.Id
            };

            // Run-level info available to templates
            var starter = startedByUserId.HasValue ? await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == startedByUserId, ct) : null;
            context["run"] = new JsonObject
            {
                ["number"] = run.RunNumber,
                ["flowName"] = def.Name,
                ["startedAt"] = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm"),
                ["startedBy"] = starter?.FullName ?? (triggerSource.StartsWith("schedule") ? "Scheduler" : "System"),
                ["startedByEmail"] = starter?.Email,
                ["startedByUserId"] = startedByUserId,
                ["startedByDepartmentId"] = starter?.DepartmentId
            };
            context["now"] = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm");

            var resolvedTitle = title
                ?? (string.IsNullOrWhiteSpace(trigger.TitleTemplate) ? null : FlowExpressions.Render(trigger.TitleTemplate, context))
                ?? def.Name;
            run.Title = Truncate(resolvedTitle, 300);
            ((JsonObject)context["run"]!)["title"] = run.Title;
            run.ContextJson = context.ToJsonString();

            _db.FlowRuns.Add(run);
            await _db.SaveChangesAsync(ct);
            ((JsonObject)context["run"]!)["url"] = $"/flows?run={run.Id}";
            run.ContextJson = context.ToJsonString();

            Audit(run, null, "run.started", $"Run started ({triggerSource})", startedByUserId, starter?.FullName);
            await _db.SaveChangesAsync(ct);

            await AdvanceInternalAsync(run, ct);
            return run;
        }

        public async Task AdvanceAsync(int runId, CancellationToken ct = default)
        {
            var run = await _db.FlowRuns.Include(r => r.Definition).FirstOrDefaultAsync(r => r.Id == runId, ct);
            if (run == null) return;
            await AdvanceInternalAsync(run, ct);
        }

        public async Task<FlowTask> CompleteTaskAsync(int taskId, int userId, string? decision, JsonObject? result, string? comment, CancellationToken ct = default)
        {
            var task = await _db.FlowTasks.Include(t => t.Run).ThenInclude(r => r.Definition).FirstOrDefaultAsync(t => t.Id == taskId, ct)
                       ?? throw new InvalidOperationException("Task not found");
            if (task.Status != FlowTaskStatus.Open && task.Status != FlowTaskStatus.Escalated)
                throw new InvalidOperationException("Task is already closed");

            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId, ct)
                       ?? throw new InvalidOperationException("User not found");
            if (!await CanActOnTaskAsync(task, user, ct))
                throw new UnauthorizedAccessException("You are not an assignee of this task");

            var isApproval = task.Kind == "approval";
            var normalized = (decision ?? "").Trim().ToLowerInvariant();
            if (isApproval && normalized != "approved" && normalized != "rejected")
                throw new InvalidOperationException("Approval decision must be 'approved' or 'rejected'");

            task.Status = isApproval ? normalized : FlowTaskStatus.Completed;
            task.CompletedAt = DateTime.UtcNow;
            task.CompletedByUserId = userId;
            task.Comment = Truncate(comment, 2000);
            task.ResultJson = (result ?? new JsonObject()).ToJsonString();

            // Record into run context: steps.<stepId> = { decision, comment, by, at, ...fields }
            var ctx = ParseContext(task.Run);
            var steps = ctx["steps"] as JsonObject ?? new JsonObject();
            var stepResult = new JsonObject
            {
                ["decision"] = isApproval ? normalized : "completed",
                ["comment"] = comment,
                ["completedBy"] = user.FullName,
                ["completedByUserId"] = userId,
                ["completedAt"] = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm"),
                ["taskId"] = task.Id
            };
            if (result != null)
                foreach (var kv in result) stepResult[kv.Key] = kv.Value?.DeepClone();
            steps[task.StepId] = stepResult;
            ctx["steps"] = steps;
            ctx["lastDecision"] = stepResult["decision"]!.DeepClone();
            task.Run.ContextJson = ctx.ToJsonString();

            // Mirror todo
            if (task.TodoTaskId.HasValue)
            {
                var todo = await _db.TodoTasks.FindAsync(new object[] { task.TodoTaskId.Value }, ct);
                if (todo != null && !todo.IsCompleted) { todo.IsCompleted = true; todo.Status = "Completed"; todo.CompletedAt = DateTime.UtcNow; }
            }

            Audit(task.Run, task.StepId, isApproval ? "approval.decided" : "task.completed",
                isApproval ? $"{user.FullName} {normalized} \"{task.Title}\"" : $"{user.FullName} completed \"{task.Title}\"",
                userId, user.FullName, new { decision = normalized, comment, result });
            await _db.SaveChangesAsync(ct);

            // Resume the run from the step after the task
            if (task.Run.Status == FlowRunStatus.Waiting || task.Run.Status == FlowRunStatus.Running)
            {
                var graph = ParseGraph(task.Run.Definition);
                var step = graph.Steps.FirstOrDefault(s => s.Id == task.StepId);
                string? next = null;
                if (step != null)
                {
                    if (isApproval)
                        next = normalized == "approved"
                            ? FlowExpressions.GetString(step.Config, "approvedStepId") ?? step.NextStepId
                            : FlowExpressions.GetString(step.Config, "rejectedStepId") ?? step.NextStepId;
                    else
                        next = step.NextStepId;
                }
                task.Run.CurrentStepId = next;
                task.Run.Status = FlowRunStatus.Running;
                await _db.SaveChangesAsync(ct);
                await AdvanceInternalAsync(task.Run, ct);
            }
            return task;
        }

        public async Task ReassignTaskAsync(int taskId, int userId, int? toUserId, string? toRole, int? toDepartmentId, CancellationToken ct = default)
        {
            var task = await _db.FlowTasks.Include(t => t.Run).FirstOrDefaultAsync(t => t.Id == taskId, ct)
                       ?? throw new InvalidOperationException("Task not found");
            var by = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId, ct);
            task.AssignedToUserId = toUserId; task.AssignedToRole = toRole; task.AssignedToDepartmentId = toDepartmentId;
            task.AssigneeLabel = await AssigneeLabelAsync(toUserId, toRole, toDepartmentId, ct);
            Audit(task.Run, task.StepId, "task.reassigned", $"{by?.FullName ?? "System"} reassigned \"{task.Title}\" to {task.AssigneeLabel}", userId, by?.FullName);
            await _db.SaveChangesAsync(ct);
            await NotifyAssigneesAsync(task, $"Task reassigned to you: {task.Title}", task.Run, ct);
        }

        public async Task CancelRunAsync(int runId, int? userId, string? reason, CancellationToken ct = default)
        {
            var run = await _db.FlowRuns.Include(r => r.Tasks).FirstOrDefaultAsync(r => r.Id == runId, ct);
            if (run == null || run.Status is FlowRunStatus.Completed or FlowRunStatus.Cancelled) return;
            var by = userId.HasValue ? await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId, ct) : null;
            run.Status = FlowRunStatus.Cancelled;
            run.CompletedAt = DateTime.UtcNow;
            run.Outcome = "cancelled";
            foreach (var t in run.Tasks.Where(t => t.Status is FlowTaskStatus.Open or FlowTaskStatus.Escalated))
                t.Status = FlowTaskStatus.Cancelled;
            Audit(run, run.CurrentStepId, "run.cancelled", $"Cancelled by {by?.FullName ?? "system"}{(string.IsNullOrWhiteSpace(reason) ? "" : $": {reason}")}", userId, by?.FullName);
            await _db.SaveChangesAsync(ct);
        }

        public async Task TickAsync(CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;

            // 1. Resume timers
            var due = await _db.FlowRuns.Include(r => r.Definition)
                .Where(r => r.Status == FlowRunStatus.Waiting && r.ResumeAt != null && r.ResumeAt <= now)
                .Take(50).ToListAsync(ct);
            foreach (var run in due)
            {
                run.ResumeAt = null;
                run.Status = FlowRunStatus.Running;
                var graph = ParseGraph(run.Definition);
                var step = graph.Steps.FirstOrDefault(s => s.Id == run.CurrentStepId);
                run.CurrentStepId = step?.NextStepId;
                Audit(run, step?.Id, "step.completed", "Wait finished");
                await _db.SaveChangesAsync(ct);
                await AdvanceInternalAsync(run, ct);
            }

            // 2. Overdue tasks → mark + escalate once
            var overdue = await _db.FlowTasks.Include(t => t.Run).ThenInclude(r => r.Definition)
                .Where(t => (t.Status == FlowTaskStatus.Open) && t.DueAt != null && t.DueAt <= now && !t.IsOverdue)
                .Take(100).ToListAsync(ct);
            foreach (var task in overdue)
            {
                task.IsOverdue = true;
                var graph = ParseGraph(task.Run.Definition);
                var step = graph.Steps.FirstOrDefault(s => s.Id == task.StepId);
                var escalateTo = step == null ? null : FlowExpressions.GetElement(step.Config, "escalateTo");
                var ctx = ParseContext(task.Run);
                if (escalateTo != null)
                {
                    var (uid, role, deptId) = await ResolveAssigneeAsync(escalateTo.Value, ctx, ct);
                    task.Status = FlowTaskStatus.Escalated;
                    task.EscalationCount++;
                    task.EscalatedAt = now;
                    var prev = task.AssigneeLabel;
                    task.AssignedToUserId = uid; task.AssignedToRole = role; task.AssignedToDepartmentId = deptId;
                    task.AssigneeLabel = await AssigneeLabelAsync(uid, role, deptId, ct);
                    task.Priority = "Urgent";
                    Audit(task.Run, task.StepId, "task.escalated", $"\"{task.Title}\" overdue — escalated from {prev} to {task.AssigneeLabel}");
                    await _db.SaveChangesAsync(ct);
                    await NotifyAssigneesAsync(task, $"⚠️ Escalated: {task.Title} (overdue)", task.Run, ct);
                }
                else
                {
                    Audit(task.Run, task.StepId, "task.overdue", $"\"{task.Title}\" is overdue");
                    await _db.SaveChangesAsync(ct);
                    await NotifyAssigneesAsync(task, $"⏰ Overdue: {task.Title}", task.Run, ct);
                }
            }

            // 3. Schedules
            var scheduled = await _db.FlowDefinitions
                .Where(d => d.IsEnabled && !d.IsTemplate && d.TriggerType == FlowTriggerType.Schedule)
                .ToListAsync(ct);
            foreach (var def in scheduled)
            {
                var trig = ParseTrigger(def);
                var interval = TimeSpan.FromMinutes(Math.Max(1, trig.IntervalMinutes ?? 30));
                if (def.LastScheduledRunAt.HasValue && def.LastScheduledRunAt.Value + interval > now) continue;
                def.LastScheduledRunAt = now;
                await _db.SaveChangesAsync(ct);
                try { await RunScheduleAsync(def, trig, ct); }
                catch (Exception ex) { _logger.LogError(ex, "Flow schedule {Flow} failed", def.Name); }
            }
        }

        public async Task<int> RunScheduledNowAsync(int definitionId, CancellationToken ct = default)
        {
            var def = await _db.FlowDefinitions.FirstOrDefaultAsync(d => d.Id == definitionId, ct)
                      ?? throw new InvalidOperationException("Flow not found");
            def.LastScheduledRunAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return await RunScheduleAsync(def, ParseTrigger(def), ct);
        }

        public async Task DispatchEventAsync(string eventName, JsonObject payload, string? entityType, string? entityKey, CancellationToken ct = default)
        {
            var defs = await _db.FlowDefinitions
                .Where(d => d.IsEnabled && !d.IsTemplate && d.TriggerType == FlowTriggerType.Event)
                .ToListAsync(ct);
            foreach (var def in defs)
            {
                var trig = ParseTrigger(def);
                if (!string.Equals(trig.Event, eventName, StringComparison.OrdinalIgnoreCase)) continue;

                var ctx = new JsonObject { ["event"] = payload.DeepClone(), ["entity"] = payload.DeepClone(), ["trigger"] = new JsonObject { ["type"] = "event", ["name"] = eventName } };
                if (!string.IsNullOrWhiteSpace(trig.Filter) && !FlowExpressions.Evaluate(trig.Filter, ctx, out _)) continue;
                if (trig.DedupeByEntity && entityKey != null && await HasOpenRunAsync(def.Id, entityType, entityKey, ct)) continue;

                try { await StartRunAsync(def, ctx, $"event:{eventName}", null, entityType, entityKey, null, ct); }
                catch (Exception ex) { _logger.LogError(ex, "Flow {Flow} failed to start from event {Event}", def.Name, eventName); }
            }
        }

        // ── Scheduling / data sources ─────────────────────────────────────────────────

        private async Task<int> RunScheduleAsync(FlowDefinition def, FlowTriggerConfig trig, CancellationToken ct)
        {
            var source = _sp.GetRequiredService<IFlowDataSources>();
            var sourceParams = trig.Params?.ToDictionary(kv => kv.Key, kv => kv.Value is JsonElement je ? (je.ValueKind == JsonValueKind.String ? je.GetString() ?? "" : je.GetRawText()) : kv.Value?.ToString() ?? "");
            var items = await source.QueryAsync(trig.DataSource ?? "none", sourceParams, ct);
            var started = 0;
            foreach (var item in items)
            {
                if (trig.DedupeByEntity && item.EntityKey != null && await HasOpenRunAsync(def.Id, item.EntityType, item.EntityKey, ct)) continue;
                var ctx = new JsonObject
                {
                    ["entity"] = item.Data,
                    ["trigger"] = new JsonObject { ["type"] = "schedule", ["dataSource"] = trig.DataSource }
                };
                try { await StartRunAsync(def, ctx, "schedule", null, item.EntityType, item.EntityKey, null, ct); started++; }
                catch (Exception ex) { _logger.LogError(ex, "Flow {Flow} failed to start from schedule", def.Name); }
            }
            return started;
        }

        private Task<bool> HasOpenRunAsync(int defId, string? entityType, string entityKey, CancellationToken ct) =>
            _db.FlowRuns.AnyAsync(r => r.FlowDefinitionId == defId && r.EntityType == entityType && r.EntityKey == entityKey
                                      && (r.Status == FlowRunStatus.Running || r.Status == FlowRunStatus.Waiting), ct);

        // ── Execution loop ────────────────────────────────────────────────────────────

        private async Task AdvanceInternalAsync(FlowRun run, CancellationToken ct)
        {
            if (run.Definition == null) await _db.Entry(run).Reference(r => r.Definition).LoadAsync(ct);
            var graph = ParseGraph(run.Definition);
            var ctx = ParseContext(run);
            var guard = 0;

            while (run.Status == FlowRunStatus.Running && guard++ < MaxStepsPerAdvance)
            {
                if (string.IsNullOrEmpty(run.CurrentStepId))
                {
                    await FinishAsync(run, ctx, "completed", ct);
                    return;
                }
                var step = graph.Steps.FirstOrDefault(s => s.Id == run.CurrentStepId);
                if (step == null)
                {
                    await FailAsync(run, $"Step '{run.CurrentStepId}' not found in flow definition", ct);
                    return;
                }

                Audit(run, step.Id, "step.started", $"{Label(step)}");
                StepOutcome outcome;
                try
                {
                    outcome = await ExecuteStepAsync(run, step, ctx, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Flow run {Run} step {Step} failed", run.RunNumber, step.Id);
                    await FailAsync(run, $"{Label(step)}: {ex.Message}", ct);
                    return;
                }

                run.ContextJson = ctx.ToJsonString();
                switch (outcome.Kind)
                {
                    case StepOutcomeKind.Next:
                        Audit(run, step.Id, "step.completed", outcome.Message ?? $"{Label(step)} done", data: outcome.Data);
                        run.CurrentStepId = outcome.NextStepId;
                        break;
                    case StepOutcomeKind.Wait:
                        Audit(run, step.Id, "step.waiting", outcome.Message ?? $"Waiting at {Label(step)}", data: outcome.Data);
                        run.Status = FlowRunStatus.Waiting;
                        run.ResumeAt = outcome.ResumeAt;
                        break;
                    case StepOutcomeKind.End:
                        await _db.SaveChangesAsync(ct);
                        await FinishAsync(run, ctx, outcome.Outcome ?? "completed", ct);
                        return;
                }
                await _db.SaveChangesAsync(ct);
            }

            if (guard >= MaxStepsPerAdvance && run.Status == FlowRunStatus.Running)
                await FailAsync(run, "Step limit exceeded (possible loop in flow definition)", ct);
        }

        private async Task FinishAsync(FlowRun run, JsonObject ctx, string outcome, CancellationToken ct)
        {
            run.Status = FlowRunStatus.Completed;
            run.CompletedAt = DateTime.UtcNow;
            run.Outcome = Truncate(outcome, 100);
            run.CurrentStepId = null;
            run.ContextJson = ctx.ToJsonString();
            Audit(run, null, "run.completed", $"Run completed — {outcome}");
            await _db.SaveChangesAsync(ct);
        }

        private async Task FailAsync(FlowRun run, string error, CancellationToken ct)
        {
            run.Status = FlowRunStatus.Failed;
            run.CompletedAt = DateTime.UtcNow;
            run.Error = Truncate(error, 2000);
            run.Outcome = "failed";
            Audit(run, run.CurrentStepId, "run.failed", error);
            await _db.SaveChangesAsync(ct);
            // Let whoever started it (or admins) know
            try
            {
                var notifier = _sp.GetRequiredService<INotificationBroadcaster>();
                var targets = run.StartedByUserId.HasValue
                    ? new List<int> { run.StartedByUserId.Value }
                    : await _db.Users.Where(u => u.IsActive && (u.Role == "Admin" || u.Role == "Super Admin")).Select(u => u.UserId).Take(5).ToListAsync(ct);
                await notifier.NotifyUsersAsync(targets, new NotificationPayload { Type = "flow", Title = $"Flow failed: {run.Title}", Body = error, Url = $"/flows?run={run.Id}" });
            }
            catch { /* best effort */ }
        }

        // ── Step executors ────────────────────────────────────────────────────────────

        private enum StepOutcomeKind { Next, Wait, End }
        private sealed record StepOutcome(StepOutcomeKind Kind, string? NextStepId = null, DateTime? ResumeAt = null, string? Outcome = null, string? Message = null, object? Data = null);

        private async Task<StepOutcome> ExecuteStepAsync(FlowRun run, FlowStep step, JsonObject ctx, CancellationToken ct)
        {
            var cfg = step.Config;
            switch (step.Type)
            {
                case "condition":
                    {
                        var expr = FlowExpressions.GetString(cfg, "expression") ?? "true";
                        var ok = FlowExpressions.Evaluate(expr, ctx, out var err);
                        if (err != null) throw new InvalidOperationException($"Condition error: {err}");
                        var next = ok ? FlowExpressions.GetString(cfg, "trueStepId") : FlowExpressions.GetString(cfg, "falseStepId");
                        return new StepOutcome(StepOutcomeKind.Next, next ?? step.NextStepId, Message: $"{Label(step)} → {(ok ? "yes" : "no")}", Data: new { expression = expr, result = ok });
                    }

                case "set":
                    {
                        var key = FlowExpressions.GetString(cfg, "key") ?? "value";
                        var value = FlowExpressions.Render(FlowExpressions.GetString(cfg, "value"), ctx);
                        var vars = ctx["vars"] as JsonObject ?? new JsonObject();
                        vars[key] = value;
                        ctx["vars"] = vars;
                        return new StepOutcome(StepOutcomeKind.Next, step.NextStepId, Message: $"Set {key} = {Truncate(value, 80)}");
                    }

                case "wait":
                    {
                        var minutes = FlowExpressions.GetNumber(cfg, "minutes") ?? (FlowExpressions.GetNumber(cfg, "hours") ?? 0) * 60;
                        if (minutes <= 0) return new StepOutcome(StepOutcomeKind.Next, step.NextStepId);
                        var until = DateTime.UtcNow.AddMinutes(minutes);
                        return new StepOutcome(StepOutcomeKind.Wait, ResumeAt: until, Message: $"Waiting until {until:yyyy-MM-dd HH:mm} UTC");
                    }

                case "end":
                    return new StepOutcome(StepOutcomeKind.End, Outcome: FlowExpressions.Render(FlowExpressions.GetString(cfg, "outcome"), ctx) is { Length: > 0 } o ? o : "completed");

                case "notify":
                    {
                        var notifier = _sp.GetRequiredService<INotificationBroadcaster>();
                        var toEl = FlowExpressions.GetElement(cfg, "to");
                        var userIds = toEl == null ? new List<int>() : await ResolveUserIdsAsync(toEl.Value, ctx, ct);
                        var title = FlowExpressions.Render(FlowExpressions.GetString(cfg, "title") ?? run.Title, ctx);
                        var body = FlowExpressions.Render(FlowExpressions.GetString(cfg, "body"), ctx);
                        var url = FlowExpressions.Render(FlowExpressions.GetString(cfg, "url"), ctx);
                        if (userIds.Count > 0)
                            await notifier.NotifyUsersAsync(userIds, new NotificationPayload { Type = "flow", Title = title, Body = body, Url = string.IsNullOrWhiteSpace(url) ? $"/flows?run={run.Id}" : url });
                        return new StepOutcome(StepOutcomeKind.Next, step.NextStepId, Message: $"Notified {userIds.Count} user(s): {Truncate(title, 80)}", Data: new { userIds, title });
                    }

                case "email":
                    {
                        var email = _sp.GetRequiredService<IEmailService>();
                        var toRaw = FlowExpressions.Render(FlowExpressions.GetString(cfg, "to"), ctx);
                        var to = toRaw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).Where(s => s.Contains('@')).ToList();
                        // "to" may also be an assignee object
                        var toEl = FlowExpressions.GetElement(cfg, "to");
                        if (toEl is { ValueKind: JsonValueKind.Object })
                        {
                            var ids = await ResolveUserIdsAsync(toEl.Value, ctx, ct);
                            to.AddRange(await _db.Users.Where(u => ids.Contains(u.UserId)).Select(u => u.Email).ToListAsync(ct));
                        }
                        var subject = FlowExpressions.Render(FlowExpressions.GetString(cfg, "subject") ?? run.Title, ctx);
                        var body = FlowExpressions.Render(FlowExpressions.GetString(cfg, "body"), ctx);
                        to = to.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                        var sent = false;
                        foreach (var addr in to)
                            sent |= await email.SendEmailAsync(addr, subject, body.Replace("\n", "<br>"), true);
                        return new StepOutcome(StepOutcomeKind.Next, step.NextStepId, Message: sent ? $"Email sent to {string.Join(", ", to)}" : $"Email not sent ({(to.Count == 0 ? "no recipients" : "mail error")})", Data: new { to, subject, sent });
                    }

                case "task":
                case "approval":
                    {
                        var task = await CreateHumanTaskAsync(run, step, ctx, ct);
                        return new StepOutcome(StepOutcomeKind.Wait, Message: $"{(step.Type == "approval" ? "Approval" : "Task")} \"{task.Title}\" assigned to {task.AssigneeLabel}", Data: new { taskId = task.Id, task.AssigneeLabel, task.DueAt });
                    }

                case "ai_analyze":
                    {
                        var llm = _sp.GetRequiredService<ILocalLlmService>();
                        var outputKey = FlowExpressions.GetString(cfg, "outputKey") ?? "ai";
                        var prompt = FlowExpressions.Render(FlowExpressions.GetString(cfg, "prompt"), ctx);
                        var fields = new List<(string key, string desc)>();
                        if (FlowExpressions.GetElement(cfg, "fields") is { ValueKind: JsonValueKind.Array } arr)
                            foreach (var f in arr.EnumerateArray())
                                fields.Add((f.TryGetProperty("key", out var k) ? k.GetString() ?? "value" : "value", f.TryGetProperty("description", out var d) ? d.GetString() ?? "" : ""));
                        if (fields.Count == 0) fields.Add(("summary", "A 1-2 sentence summary"));

                        var dataForAi = new JsonObject();
                        foreach (var key in new[] { "entity", "event", "inputs", "vars", "steps" })
                            if (ctx[key] != null) dataForAi[key] = ctx[key]!.DeepClone();

                        var system = "You are Welly, an operations analyst for ProMed Technologies / Rocket Freight. " +
                                     "Analyse the JSON data and instructions and reply with ONLY a JSON object (no prose, no markdown fences) with exactly these keys:\n" +
                                     string.Join("\n", fields.Select(f => $"- \"{f.key}\": {f.desc}")) +
                                     "\nUse plain strings/numbers/booleans. If something is unknown use null. Priorities must be one of Low, Normal, High, Urgent.";
                        var user = $"INSTRUCTIONS:\n{prompt}\n\nDATA:\n{dataForAi.ToJsonString(new JsonSerializerOptions { WriteIndented = true })}";

                        JsonObject parsed;
                        if (!await llm.IsAvailableAsync())
                        {
                            parsed = new JsonObject { ["error"] = "AI unavailable" };
                            foreach (var f in fields) parsed[f.key] = null;
                        }
                        else
                        {
                            var raw = await llm.AnalyzeDocumentAsync(system, user, ct);
                            parsed = ExtractJsonObject(raw) ?? new JsonObject { ["raw"] = raw };
                        }
                        ctx[outputKey] = parsed;
                        Audit(run, step.Id, "ai.analyzed", $"Welly analysed: {Truncate(FlowExpressions.NodeToString(parsed["summary"] ?? parsed[fields[0].key]), 200)}", data: parsed);
                        return new StepOutcome(StepOutcomeKind.Next, step.NextStepId, Message: $"AI analysis stored in {outputKey}");
                    }

                case "welly_action":
                    {
                        var actions = _sp.GetRequiredService<IAIActionService>();
                        var action = (FlowExpressions.GetString(cfg, "action") ?? "").ToUpperInvariant();
                        var payloadEl = FlowExpressions.GetElement(cfg, "payload");
                        var payloadJson = payloadEl == null ? "{}" : FlowExpressions.Render(payloadEl.Value.GetRawText(), ctx);
                        var actor = await SystemActorAsync(run, ct);
                        var results = await actions.ProcessActionsAsync($"[ACTION:{action}] {payloadJson} [/ACTION]", actor);
                        var r = results.FirstOrDefault();
                        var outKey = FlowExpressions.GetString(cfg, "outputKey") ?? "action";
                        var stepsObj = ctx["steps"] as JsonObject ?? new JsonObject();
                        stepsObj[step.Id] = new JsonObject { ["action"] = action, ["success"] = r?.Success ?? false, ["message"] = r?.Message, ["entityId"] = r?.EntityId };
                        ctx["steps"] = stepsObj;
                        ctx[outKey] = stepsObj[step.Id]!.DeepClone();
                        Audit(run, step.Id, "action.executed", $"{action}: {(r?.Success == true ? "OK" : "FAILED")} — {Truncate(r?.Message, 200)}", data: new { action, payload = payloadJson, r?.Success, r?.Message, r?.EntityId });
                        if (r?.Success != true && FlowExpressions.GetBool(cfg, "failOnError"))
                            throw new InvalidOperationException($"{action} failed: {r?.Message}");
                        return new StepOutcome(StepOutcomeKind.Next, step.NextStepId, Message: $"{action} {(r?.Success == true ? "succeeded" : "failed")}");
                    }

                default:
                    throw new InvalidOperationException($"Unknown step type '{step.Type}'");
            }
        }

        private async Task<FlowTask> CreateHumanTaskAsync(FlowRun run, FlowStep step, JsonObject ctx, CancellationToken ct)
        {
            var cfg = step.Config;
            var assignEl = FlowExpressions.GetElement(cfg, "assignTo");
            var (uid, role, deptId) = assignEl == null ? (run.StartedByUserId, null, null) : await ResolveAssigneeAsync(assignEl.Value, ctx, ct);
            if (uid == null && role == null && deptId == null) uid = run.StartedByUserId;

            var priority = FlowExpressions.Render(FlowExpressions.GetString(cfg, "priority"), ctx);
            if (string.IsNullOrWhiteSpace(priority) || priority is not ("Low" or "Normal" or "High" or "Urgent")) priority = run.Priority;
            var dueHours = FlowExpressions.GetNumber(cfg, "dueInHours");
            var dueStr = FlowExpressions.Render(FlowExpressions.GetString(cfg, "dueInHoursExpr"), ctx);
            if (double.TryParse(dueStr, out var dh)) dueHours = dh;

            var task = new FlowTask
            {
                FlowRunId = run.Id,
                StepId = step.Id,
                Kind = step.Type,
                Title = Truncate(FlowExpressions.Render(FlowExpressions.GetString(cfg, "title") ?? step.Name ?? run.Title, ctx), 300),
                Description = FlowExpressions.Render(FlowExpressions.GetString(cfg, "description"), ctx),
                AssignedToUserId = uid, AssignedToRole = role, AssignedToDepartmentId = deptId,
                AssigneeLabel = await AssigneeLabelAsync(uid, role, deptId, ct),
                Priority = priority,
                DueAt = dueHours.HasValue && dueHours > 0 ? DateTime.UtcNow.AddHours(dueHours.Value) : null,
                FormJson = FlowExpressions.GetElement(cfg, "form")?.GetRawText()
            };
            _db.FlowTasks.Add(task);
            await _db.SaveChangesAsync(ct);

            // Mirror on the person's dashboard todo list when assigned to a single person
            if (uid.HasValue && FlowExpressions.GetBool(cfg, "mirrorTodo", true))
            {
                var creator = run.StartedByUserId ?? uid.Value;
                var todo = new TodoTask
                {
                    Title = Truncate($"[{run.RunNumber}] {task.Title}", 500),
                    Description = Truncate(task.Description, 2000),
                    DueDate = (task.DueAt ?? DateTime.UtcNow.AddDays(1)).Date,
                    CreatedByUserId = creator,
                    AssignedToUserId = uid.Value,
                    Priority = priority,
                    Category = "Flow",
                    Status = "Accepted"
                };
                _db.TodoTasks.Add(todo);
                await _db.SaveChangesAsync(ct);
                task.TodoTaskId = todo.Id;
            }

            Audit(run, step.Id, "task.created", $"{(task.Kind == "approval" ? "Approval" : "Task")} \"{task.Title}\" → {task.AssigneeLabel}{(task.DueAt.HasValue ? $", due {task.DueAt:dd MMM HH:mm}" : "")}", data: new { taskId = task.Id });
            run.Status = FlowRunStatus.Waiting;
            await _db.SaveChangesAsync(ct);
            await NotifyAssigneesAsync(task, $"{(task.Kind == "approval" ? "Approval needed" : "New task")}: {task.Title}", run, ct);
            return task;
        }

        // ── Assignment helpers ────────────────────────────────────────────────────────

        /// <summary>assignTo: { userId } | { role } | { departmentId } | { departmentName } | { email } | { expression:"{{...}}" (user id or email) } | { starter:true }</summary>
        private async Task<(int? userId, string? role, int? deptId)> ResolveAssigneeAsync(JsonElement el, JsonObject ctx, CancellationToken ct)
        {
            if (el.ValueKind == JsonValueKind.String)
            {
                var s = FlowExpressions.Render(el.GetString(), ctx);
                return await ResolveAssigneeStringAsync(s, ctx, ct);
            }
            if (el.ValueKind != JsonValueKind.Object) return (null, null, null);

            if (el.TryGetProperty("starter", out var st) && st.ValueKind == JsonValueKind.True)
                return (FlowExpressions.Resolve(ctx, "run.startedByUserId") is JsonValue v && v.TryGetValue<int>(out var sid) ? sid : null, null, null);
            if (el.TryGetProperty("userId", out var u) && u.ValueKind == JsonValueKind.Number) return (u.GetInt32(), null, null);
            if (el.TryGetProperty("departmentId", out var d) && d.ValueKind == JsonValueKind.Number) return (null, null, d.GetInt32());
            if (el.TryGetProperty("role", out var r) && r.ValueKind == JsonValueKind.String) return (null, r.GetString(), null);
            if (el.TryGetProperty("departmentName", out var dn) && dn.ValueKind == JsonValueKind.String)
            {
                var name = FlowExpressions.Render(dn.GetString(), ctx);
                var dept = await _db.Departments.FirstOrDefaultAsync(x => x.Name.ToLower() == name.ToLower(), ct);
                return (null, null, dept?.DepartmentId);
            }
            if (el.TryGetProperty("email", out var e) && e.ValueKind == JsonValueKind.String)
            {
                var email = FlowExpressions.Render(e.GetString(), ctx).ToLower();
                var user = await _db.Users.FirstOrDefaultAsync(x => x.Email.ToLower() == email && x.IsActive, ct);
                return (user?.UserId, null, null);
            }
            if (el.TryGetProperty("expression", out var ex) && ex.ValueKind == JsonValueKind.String)
                return await ResolveAssigneeStringAsync(FlowExpressions.Render(ex.GetString(), ctx), ctx, ct);
            if (el.TryGetProperty("starterManager", out var sm) && sm.ValueKind == JsonValueKind.True)
            {
                // Department manager of the starter: Department.ManagerName matched to a user
                var deptId = FlowExpressions.Resolve(ctx, "run.startedByDepartmentId") is JsonValue dv && dv.TryGetValue<int>(out var did) ? did : (int?)null;
                if (deptId != null)
                {
                    var dept = await _db.Departments.FindAsync(new object[] { deptId.Value }, ct);
                    if (!string.IsNullOrWhiteSpace(dept?.ManagerName))
                    {
                        var mgr = await _db.Users.FirstOrDefaultAsync(x => x.IsActive && (x.Name + " " + x.Surname).ToLower() == dept.ManagerName.ToLower(), ct);
                        if (mgr != null) return (mgr.UserId, null, null);
                    }
                    return (null, "Manager", deptId);
                }
                return (null, "Manager", null);
            }
            return (null, null, null);
        }

        private async Task<(int? userId, string? role, int? deptId)> ResolveAssigneeStringAsync(string s, JsonObject ctx, CancellationToken ct)
        {
            s = (s ?? "").Trim();
            if (s.Length == 0) return (null, null, null);
            if (int.TryParse(s, out var id)) return (id, null, null);
            if (s.Contains('@'))
            {
                var user = await _db.Users.FirstOrDefaultAsync(x => x.Email.ToLower() == s.ToLower() && x.IsActive, ct);
                return (user?.UserId, null, null);
            }
            if (s.StartsWith("role:", StringComparison.OrdinalIgnoreCase)) return (null, s.Substring(5).Trim(), null);
            if (s.StartsWith("dept:", StringComparison.OrdinalIgnoreCase))
            {
                var name = s.Substring(5).Trim();
                var dept = await _db.Departments.FirstOrDefaultAsync(x => x.Name.ToLower() == name.ToLower(), ct);
                return (null, null, dept?.DepartmentId);
            }
            var byName = await _db.Users.FirstOrDefaultAsync(x => x.IsActive && (x.Name + " " + x.Surname).ToLower() == s.ToLower(), ct);
            if (byName != null) return (byName.UserId, null, null);
            var byDept = await _db.Departments.FirstOrDefaultAsync(x => x.Name.ToLower() == s.ToLower(), ct);
            return byDept != null ? (null, null, byDept.DepartmentId) : (null, s, null);
        }

        private async Task<List<int>> ResolveUserIdsAsync(JsonElement el, JsonObject ctx, CancellationToken ct)
        {
            var (uid, role, deptId) = await ResolveAssigneeAsync(el, ctx, ct);
            return await UserIdsForAsync(uid, role, deptId, ct);
        }

        private async Task<List<int>> UserIdsForAsync(int? uid, string? role, int? deptId, CancellationToken ct)
        {
            if (uid.HasValue) return new List<int> { uid.Value };
            var q = _db.Users.Where(u => u.IsActive);
            if (deptId.HasValue) q = q.Where(u => u.DepartmentId == deptId);
            if (!string.IsNullOrWhiteSpace(role)) q = q.Where(u => u.Role == role);
            if (!deptId.HasValue && string.IsNullOrWhiteSpace(role)) return new List<int>();
            return await q.Select(u => u.UserId).Take(50).ToListAsync(ct);
        }

        private async Task<string> AssigneeLabelAsync(int? uid, string? role, int? deptId, CancellationToken ct)
        {
            if (uid.HasValue)
            {
                var u = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == uid, ct);
                return u?.FullName ?? $"User #{uid}";
            }
            string? dept = null;
            if (deptId.HasValue) dept = (await _db.Departments.FindAsync(new object[] { deptId.Value }, ct))?.Name ?? $"Dept #{deptId}";
            if (dept != null && role != null) return $"{role}s in {dept}";
            if (dept != null) return dept;
            if (role != null) return $"Any {role}";
            return "Unassigned";
        }

        private async Task<bool> CanActOnTaskAsync(FlowTask task, User user, CancellationToken ct)
        {
            if (user.Role is "Admin" or "Super Admin") return true;
            if (task.AssignedToUserId.HasValue) return task.AssignedToUserId == user.UserId;
            if (task.AssignedToDepartmentId.HasValue && user.DepartmentId != task.AssignedToDepartmentId) return false;
            if (!string.IsNullOrWhiteSpace(task.AssignedToRole) && !string.Equals(user.Role, task.AssignedToRole, StringComparison.OrdinalIgnoreCase)) return false;
            await Task.CompletedTask;
            return task.AssignedToDepartmentId.HasValue || !string.IsNullOrWhiteSpace(task.AssignedToRole);
        }

        private async Task NotifyAssigneesAsync(FlowTask task, string title, FlowRun run, CancellationToken ct)
        {
            try
            {
                var ids = await UserIdsForAsync(task.AssignedToUserId, task.AssignedToRole, task.AssignedToDepartmentId, ct);
                if (ids.Count == 0) return;
                var notifier = _sp.GetRequiredService<INotificationBroadcaster>();
                await notifier.NotifyUsersAsync(ids, new NotificationPayload
                {
                    Type = "flow",
                    Title = title,
                    Body = $"{run.RunNumber} · {run.Title}{(task.DueAt.HasValue ? $" · due {task.DueAt:dd MMM HH:mm}" : "")}",
                    Url = $"/flows?task={task.Id}"
                });
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Flow notify failed"); }
        }

        private async Task<ChatUserContext> SystemActorAsync(FlowRun run, CancellationToken ct)
        {
            var u = run.StartedByUserId.HasValue ? await _db.Users.Include(x => x.Department).AsNoTracking().FirstOrDefaultAsync(x => x.UserId == run.StartedByUserId, ct) : null;
            u ??= await _db.Users.Include(x => x.Department).AsNoTracking().Where(x => x.IsActive && (x.Role == "Super Admin" || x.Role == "Admin")).OrderBy(x => x.UserId).FirstOrDefaultAsync(ct);
            return new ChatUserContext
            {
                UserId = u?.UserId ?? 0,
                Name = u?.Name ?? "Flow",
                Surname = u?.Surname ?? "Engine",
                Email = u?.Email ?? "flows@system",
                Role = u?.Role ?? "Manager",
                Department = u?.Department?.Name ?? "",
                DepartmentId = u?.DepartmentId
            };
        }

        // ── Misc helpers ──────────────────────────────────────────────────────────────

        public static FlowGraph ParseGraph(FlowDefinition def)
        {
            try { return JsonSerializer.Deserialize<FlowGraph>(def.GraphJson, FlowExpressions.JsonOpts) ?? new FlowGraph(); }
            catch { return new FlowGraph(); }
        }

        public static FlowTriggerConfig ParseTrigger(FlowDefinition def)
        {
            try { return JsonSerializer.Deserialize<FlowTriggerConfig>(def.TriggerJson, FlowExpressions.JsonOpts) ?? new FlowTriggerConfig(); }
            catch { return new FlowTriggerConfig(); }
        }

        public static JsonObject ParseContext(FlowRun run)
        {
            try { return JsonNode.Parse(run.ContextJson) as JsonObject ?? new JsonObject(); }
            catch { return new JsonObject(); }
        }

        private static JsonObject? ExtractJsonObject(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var start = raw.IndexOf('{'); var end = raw.LastIndexOf('}');
            if (start < 0 || end <= start) return null;
            try { return JsonNode.Parse(raw.Substring(start, end - start + 1)) as JsonObject; }
            catch { return null; }
        }

        private void Audit(FlowRun run, string? stepId, string type, string message, int? userId = null, string? userName = null, object? data = null)
        {
            _db.FlowAuditEvents.Add(new FlowAuditEvent
            {
                FlowRunId = run.Id,
                Run = run,
                StepId = stepId,
                Type = type,
                Message = Truncate(message, 1000),
                UserId = userId,
                UserName = userName,
                DataJson = data == null ? null : JsonSerializer.Serialize(data, FlowExpressions.JsonOpts),
                OccurredAt = DateTime.UtcNow
            });
        }

        private async Task<string> NextRunNumberAsync(CancellationToken ct)
        {
            var seq = await _db.Set<Models.Logistics.Shipments.NumberSequence>().FindAsync(new object[] { "FL" }, ct);
            if (seq == null)
            {
                seq = new Models.Logistics.Shipments.NumberSequence { Key = "FL", NextValue = 1 };
                _db.Add(seq);
            }
            var n = seq.NextValue++;
            await _db.SaveChangesAsync(ct);
            return $"FL-{n:000000}";
        }

        private static string Label(FlowStep s) => string.IsNullOrWhiteSpace(s.Name) ? $"{s.Type} ({s.Id})" : s.Name!;
        private static string Truncate(string? s, int max) => string.IsNullOrEmpty(s) ? (s ?? "") : (s.Length <= max ? s : s.Substring(0, max - 1) + "…");
    }
}
