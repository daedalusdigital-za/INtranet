using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Services.Flows
{
    /// <summary>
    /// HR → Finance hand-off: anything that changes someone's pay reaches payroll before the cut-off, without an email.
    /// Triggers: approved leave (unpaid / sick beyond entitlement / any type - payroll decides), a new starter, a status
    /// change to Serving Notice / Terminated / Suspended, a contract end date set. Each one:
    ///  • creates ONE to-do for the payroll person (SystemSettings Payroll.UserId → Finance manager → first finance holder)
    ///    due on the payroll cut-off (SystemSettings Payroll.CutoffDay, default 20; a weekend cut-off moves back to Friday;
    ///    past this month's cut-off → next month's), Category "Payroll", with everything payroll needs in the body;
    ///  • notifies that person; • publishes the <c>hr.payroll_input</c> flow event so a designer can trigger a flow on it.
    /// Items that land within 2 days of the cut-off are flagged High so they are not missed in the run.
    /// Fire-and-forget: never slows down or fails the HR screen.
    /// </summary>
    public interface IPayrollHandoff
    {
        void LeaveApproved(int leaveRequestId, string employeeName, string? department, string leaveType, DateTime start, DateTime end, int days, string? notes, int? byUserId);
        void NewStarter(int hrEmployeeId, string name, string? site, string? department, string? jobTitle, string? employmentType, DateTime? hireDate, string? employeeNumber, int? byUserId);
        void StatusChanged(int hrEmployeeId, string name, string? site, string? department, string oldStatus, string newStatus, DateTime? contractEnd, string? notes, int? byUserId);
        Task<(DateTime cutoff, int day)> NextCutoffAsync(ApplicationDbContext db, DateTime fromUtc, CancellationToken ct = default);
    }

    public class PayrollHandoffService : IPayrollHandoff
    {
        public const string CutoffDayKey = "Payroll.CutoffDay", UserIdKey = "Payroll.UserId";
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<PayrollHandoffService> _log;
        public PayrollHandoffService(IServiceScopeFactory scopes, ILogger<PayrollHandoffService> log) { _scopes = scopes; _log = log; }

        public void LeaveApproved(int id, string employeeName, string? department, string leaveType, DateTime start, DateTime end, int days, string? notes, int? byUserId)
            => Fire("leave", $"Leave · {employeeName} · {leaveType} {start:d MMM}–{end:d MMM} ({days} d)",
                $"{employeeName}{(department != null ? " (" + department + ")" : "")} has approved {leaveType.ToLowerInvariant()} leave from {start:ddd d MMM yyyy} to {end:ddd d MMM yyyy}: {days} day(s).{(notes != null ? "\nHR note: " + notes : "")}\n\nCheck entitlement / unpaid days and reflect it in this month's run.",
                new JsonObject { ["kind"] = "leave", ["leaveRequestId"] = id, ["employee"] = employeeName, ["department"] = department, ["leaveType"] = leaveType, ["start"] = start, ["end"] = end, ["days"] = days }, byUserId, "leave:" + id);

        public void NewStarter(int id, string name, string? site, string? department, string? jobTitle, string? employmentType, DateTime? hireDate, string? employeeNumber, int? byUserId)
            => Fire("starter", $"New starter · {name}{(hireDate != null ? $" · starts {hireDate:d MMM}" : "")}",
                $"{name} joins {site ?? "the company"}{(department != null ? ", " + department : "")}{(jobTitle != null ? " as " + jobTitle : "")} ({employmentType ?? "Permanent"}){(hireDate != null ? $" on {hireDate:ddd d MMM yyyy}" : "")}.{(string.IsNullOrWhiteSpace(employeeNumber) ? "\nNo payroll number yet - allocate one." : $"\nPayroll number: {employeeNumber}.")}\n\nLoad on payroll: tax number, bank details, salary per the offer letter (HR file).",
                new JsonObject { ["kind"] = "starter", ["hrEmployeeId"] = id, ["employee"] = name, ["site"] = site, ["department"] = department, ["jobTitle"] = jobTitle, ["employmentType"] = employmentType, ["hireDate"] = hireDate, ["employeeNumber"] = employeeNumber }, byUserId, "starter:" + id);

        public void StatusChanged(int id, string name, string? site, string? department, string oldStatus, string newStatus, DateTime? contractEnd, string? notes, int? byUserId)
        {
            var action = newStatus switch
            {
                "Terminated" => "Final pay: pro-rata salary, leave pay-out, deductions; issue UI-19 and IRP5.",
                "Serving Notice" => $"Notice period running{(contractEnd != null ? $", last day {contractEnd:ddd d MMM yyyy}" : "")}. Prepare final pay calculation.",
                "Suspended" => "Confirm with HR whether pay continues during suspension.",
                "On Leave" => "Extended leave - confirm paid / unpaid.",
                _ => "Confirm payroll impact with HR."
            };
            Fire("status", $"{newStatus} · {name}{(contractEnd != null && newStatus is "Terminated" or "Serving Notice" ? $" · last day {contractEnd:d MMM}" : "")}",
                $"{name}{(site != null ? " (" + site + (department != null ? ", " + department : "") + ")" : "")}: status changed {oldStatus} → {newStatus}.{(notes != null ? "\nHR note: " + notes : "")}\n\n{action}",
                new JsonObject { ["kind"] = "status", ["hrEmployeeId"] = id, ["employee"] = name, ["site"] = site, ["department"] = department, ["oldStatus"] = oldStatus, ["newStatus"] = newStatus, ["contractEnd"] = contractEnd }, byUserId, $"status:{id}:{newStatus}");
        }

        private void Fire(string kind, string title, string body, JsonObject payload, int? byUserId, string dedupeKey)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var sp = scope.ServiceProvider;
                    var db = sp.GetRequiredService<ApplicationDbContext>();
                    var now = DateTime.UtcNow;
                    var (cutoff, day) = await NextCutoffAsync(db, now);
                    var payrollUser = await PayrollUserAsync(db);
                    var by = byUserId.HasValue ? await db.Users.AsNoTracking().Where(u => u.UserId == byUserId).Select(u => u.Name + " " + u.Surname).FirstOrDefaultAsync() : null;
                    var urgent = (cutoff - now).TotalDays <= 2;
                    payload["cutoff"] = cutoff; payload["cutoffDay"] = day; payload["raisedBy"] = by; payload["raisedAt"] = now;

                    if (payrollUser != null)
                    {
                        // one to-do per event, even if HR saves twice
                        var marker = $"[payroll:{dedupeKey}]";
                        var exists = await db.TodoTasks.AnyAsync(t => t.Category == "Payroll" && t.Description != null && t.Description.Contains(marker) && !t.IsCompleted);
                        if (!exists)
                        {
                            var todo = new TodoTask
                            {
                                Title = Trunc("Payroll input: " + title, 500),
                                Description = Trunc($"{body}\n\nPayroll cut-off: {cutoff:ddd d MMM yyyy} (day {day}).{(by != null ? $"\nRaised by {by} from HR." : "")}\n{marker}", 2000),
                                DueDate = cutoff.Date, CreatedByUserId = byUserId ?? payrollUser.Value, AssignedToUserId = payrollUser.Value,
                                Priority = urgent ? "High" : "Normal", Category = "Payroll", Status = "Accepted"
                            };
                            db.TodoTasks.Add(todo);
                            await db.SaveChangesAsync();
                            payload["todoId"] = todo.Id;
                            var notify = sp.GetService<INotificationBroadcaster>();
                            if (notify != null) await notify.NotifyUserAsync(payrollUser.Value, new NotificationPayload { Type = "todo", Title = "Payroll input: " + title, Body = $"Due by the {cutoff:d MMM} cut-off.{(urgent ? " Cut-off is close." : "")}", Url = "/dashboard?todo=" + todo.Id });
                        }
                    }
                    else _log.LogWarning("Payroll hand-off: no payroll user (set SystemSettings {Key} or a Finance manager); {Title} not assigned", UserIdKey, title);

                    sp.GetService<IFlowEventPublisher>()?.Publish("hr.payroll_input", payload, "hr", dedupeKey);
                    _log.LogInformation("Payroll hand-off {Kind}: {Title} → user {User}, cut-off {Cutoff:d}", kind, title, payrollUser, cutoff);
                }
                catch (Exception ex) { _log.LogError(ex, "Payroll hand-off failed: {Title}", title); }
            });
        }

        /// <summary>Next payroll cut-off on/after now: day N of the month (setting, default 20), pulled back to Friday if it lands on a weekend.</summary>
        public async Task<(DateTime cutoff, int day)> NextCutoffAsync(ApplicationDbContext db, DateTime fromUtc, CancellationToken ct = default)
        {
            var raw = await db.SystemSettings.AsNoTracking().Where(s => s.Key == CutoffDayKey).Select(s => s.Value).FirstOrDefaultAsync(ct);
            var day = int.TryParse(raw, out var d) && d is >= 1 and <= 28 ? d : 20;
            var local = fromUtc.ToLocalTime().Date;
            var c = Adjust(new DateTime(local.Year, local.Month, day));
            if (c < local) c = Adjust(new DateTime(local.Year, local.Month, 1).AddMonths(1).AddDays(day - 1));
            return (c, day);
            static DateTime Adjust(DateTime x) => x.DayOfWeek switch { DayOfWeek.Saturday => x.AddDays(-1), DayOfWeek.Sunday => x.AddDays(-2), _ => x };
        }

        /// <summary>Who runs payroll: explicit setting → manager of the Finance department → first active user with the finance module.</summary>
        private static async Task<int?> PayrollUserAsync(ApplicationDbContext db)
        {
            var raw = await db.SystemSettings.AsNoTracking().Where(s => s.Key == UserIdKey).Select(s => s.Value).FirstOrDefaultAsync();
            if (int.TryParse(raw, out var uid) && await db.Users.AnyAsync(u => u.UserId == uid && u.IsActive)) return uid;
            var mgr = await db.Departments.AsNoTracking().Where(d => d.IsActive && d.Name.ToLower().StartsWith("finance") && d.ManagerName != null).Select(d => d.ManagerName!).FirstOrDefaultAsync();
            if (!string.IsNullOrWhiteSpace(mgr))
            {
                var parts = mgr.Trim().Split(' ', 2);
                var q = db.Users.Where(u => u.IsActive && u.Name == parts[0]);
                if (parts.Length > 1) q = q.Where(u => u.Surname == parts[1]);
                var ids = await q.Select(u => u.UserId).Take(2).ToListAsync();
                if (ids.Count == 1) return ids[0];
            }
            return await db.Users.Where(u => u.IsActive && u.Role != "Admin" && u.Permissions != null && (u.Permissions.Contains("finance") || u.Permissions.Contains("books"))).OrderBy(u => u.UserId).Select(u => (int?)u.UserId).FirstOrDefaultAsync();
        }

        private static string Trunc(string s, int n) => s.Length <= n ? s : s[..n];
    }
}
