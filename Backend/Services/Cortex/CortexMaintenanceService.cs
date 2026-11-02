using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Cortex;

namespace ProjectTracker.API.Services.Cortex
{
    /// <summary>
    /// Keeps Cortex honest without anyone pressing a button:
    ///  • rebuilds the derived graph nightly (02:15 server time) so owners, permissions and metrics track the data;
    ///  • reminds owners when curated knowledge is due for review (14 days before, then weekly once overdue) by
    ///    notification + a to-do on their dashboard;
    ///  • turns every pending Welly finding / inference that has an owner into a to-do with a due date, once.
    /// Every action is written to CortexChanges so it is never repeated and can be audited.
    /// </summary>
    public class CortexMaintenanceService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<CortexMaintenanceService> _log;
        private static readonly TimeSpan Every = TimeSpan.FromHours(1);
        private const int ReminderLeadDays = 14, ReminderRepeatDays = 7, FindingDueDays = 7;

        public CortexMaintenanceService(IServiceScopeFactory scopes, ILogger<CortexMaintenanceService> log) { _scopes = scopes; _log = log; }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            await Task.Delay(TimeSpan.FromMinutes(2), ct); // let migrations and the first graph build settle
            while (!ct.IsCancellationRequested)
            {
                try { await TickAsync(ct); }
                catch (OperationCanceledException) { }
                catch (Exception ex) { _log.LogError(ex, "Cortex maintenance tick failed"); }
                await Task.Delay(Every, ct);
            }
        }

        private async Task TickAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var builder = scope.ServiceProvider.GetRequiredService<CortexGraphBuilder>();
            var notify = scope.ServiceProvider.GetService<INotificationBroadcaster>();
            var now = DateTime.UtcNow;

            // nightly rebuild: the first tick after 02:15 local, once per day
            var local = DateTime.Now;
            if (local.TimeOfDay >= new TimeSpan(2, 15, 0))
            {
                var last = await db.CortexChanges.Where(c => c.Kind == "rebuild").OrderByDescending(c => c.OccurredAt).Select(c => (DateTime?)c.OccurredAt).FirstOrDefaultAsync(ct);
                if (last == null || last.Value.ToLocalTime().Date < local.Date)
                {
                    var r = await builder.RebuildAsync(ct);
                    db.CortexChanges.Add(new CortexChange { Target = "graph", TargetKey = "*", Kind = "rebuild", ChangedBy = "schedule", NewValue = $"{r.Nodes} nodes, {r.Edges} edges, +{r.Created} ~{r.Updated} -{r.Deactivated}", OccurredAt = now });
                    await db.SaveChangesAsync(ct);
                }
            }

            await RemindReviewsAsync(db, notify, now, ct);
            await TaskFindingsAsync(db, notify, now, ct);
            var measured = await scope.ServiceProvider.GetRequiredService<CortexFixService>().MeasureAppliedAsync(notify, now, ct);
            if (measured > 0) _log.LogInformation("Cortex: {N} Welly Fix results measured", measured);
        }

        /// <summary>Curated knowledge due within 14 days or overdue: tell the owner, give them a to-do. Repeat weekly while overdue.</summary>
        private async Task RemindReviewsAsync(ApplicationDbContext db, INotificationBroadcaster? notify, DateTime now, CancellationToken ct)
        {
            var horizon = now.AddDays(ReminderLeadDays);
            var due = await db.CortexNodes.Where(n => n.IsActive && n.Provenance == CortexProvenance.Curated && n.OwnerUserId != null && n.ReviewDueAt != null && n.ReviewDueAt <= horizon
                                                   && !(string.IsNullOrEmpty(n.Summary) && string.IsNullOrEmpty(n.DataJson))) // blank slots have nothing to review yet
                .ToListAsync(ct);
            if (due.Count == 0) return;
            var keys = due.Select(n => n.Key).ToList();
            var lastReminded = await db.CortexChanges.Where(c => c.Kind == "reminded" && keys.Contains(c.TargetKey)).GroupBy(c => c.TargetKey).Select(g => new { g.Key, At = g.Max(c => c.OccurredAt) }).ToDictionaryAsync(x => x.Key, x => x.At, ct);
            var sent = 0;
            foreach (var n in due)
            {
                if (lastReminded.TryGetValue(n.Key, out var at) && at > now.AddDays(-ReminderRepeatDays)) continue;
                var overdue = n.ReviewDueAt < now;
                var title = overdue ? $"Review overdue: {n.Label}" : $"Review due {n.ReviewDueAt:d MMM}: {n.Label}";
                var body = overdue
                    ? $"This knowledge was last confirmed before {n.ReviewDueAt:d MMM yyyy}. Open Cortex, read it, and either update it or confirm it still holds."
                    : $"Please re-read what is written for \"{n.Label}\" and confirm or update it before {n.ReviewDueAt:d MMM yyyy}.";
                db.TodoTasks.Add(new TodoTask { Title = Trunc(title, 500), Description = Trunc(body, 2000), DueDate = (overdue ? now.AddDays(3) : n.ReviewDueAt!.Value).Date,
                    CreatedByUserId = n.OwnerUserId!.Value, AssignedToUserId = n.OwnerUserId.Value, Priority = overdue ? "High" : "Normal", Category = "Cortex", Status = "Accepted" });
                if (notify != null) await notify.NotifyUserAsync(n.OwnerUserId.Value, new NotificationPayload { Type = "todo", Title = title, Body = body, Url = "/flows?tab=cortex&node=" + Uri.EscapeDataString(n.Key) });
                db.CortexChanges.Add(new CortexChange { Target = "node", TargetKey = n.Key, Kind = "reminded", ChangedBy = "schedule", UserId = n.OwnerUserId, NewValue = overdue ? "overdue" : "due_soon", OccurredAt = now });
                sent++;
            }
            if (sent > 0) { await db.SaveChangesAsync(ct); _log.LogInformation("Cortex: {N} review reminders sent", sent); }
        }

        /// <summary>Pending findings and inferences with an owner become a to-do, once. Unowned ones stay as gaps on the map.</summary>
        private async Task TaskFindingsAsync(ApplicationDbContext db, INotificationBroadcaster? notify, DateTime now, CancellationToken ct)
        {
            var pending = await db.CortexNodes.Where(n => n.IsActive && n.Provenance == CortexProvenance.Inferred && n.Status == "pending" && n.OwnerUserId != null && (n.Type == "finding" || n.Type == "inference")).ToListAsync(ct);
            if (pending.Count == 0) return;
            var keys = pending.Select(n => n.Key).ToList();
            var tasked = await db.CortexChanges.Where(c => c.Kind == "tasked" && keys.Contains(c.TargetKey)).Select(c => c.TargetKey).ToHashSetAsync(ct);
            var made = 0;
            foreach (var n in pending.Where(n => !tasked.Contains(n.Key)))
            {
                var fix = n.Type == "finding" ? await db.CortexNodes.Where(s => s.Type == "suggestion" && s.ParentKey == n.Key && s.IsActive).Select(s => s.Label).FirstOrDefaultAsync(ct) : null;
                var title = (n.Type == "finding" ? "Welly found: " : "Welly thinks: ") + n.Label;
                var body = $"{n.Summary}\n\n{(fix != null ? "Proposed fix: " + fix + "\n\n" : "")}Confirm or reject it in Cortex. Nothing changes until you decide.";
                var todo = new TodoTask { Title = Trunc(title, 500), Description = Trunc(body, 2000), DueDate = now.AddDays(FindingDueDays).Date, CreatedByUserId = n.OwnerUserId!.Value, AssignedToUserId = n.OwnerUserId.Value, Priority = "Normal", Category = "Cortex", Status = "Accepted" };
                db.TodoTasks.Add(todo);
                await db.SaveChangesAsync(ct);
                db.CortexChanges.Add(new CortexChange { Target = "node", TargetKey = n.Key, Kind = "tasked", ChangedBy = "schedule", UserId = n.OwnerUserId, NewValue = todo.Id.ToString(), OccurredAt = now });
                if (notify != null) await notify.NotifyUserAsync(n.OwnerUserId.Value, new NotificationPayload { Type = "todo", Title = title, Body = fix ?? n.Summary ?? "", Url = "/flows?tab=cortex&node=" + Uri.EscapeDataString(n.Key) });
                made++;
            }
            if (made > 0) { await db.SaveChangesAsync(ct); _log.LogInformation("Cortex: {N} findings turned into to-dos", made); }
        }

        private static string? Trunc(string? s, int n) => s == null ? null : (s.Length <= n ? s : s[..n]);
    }
}
