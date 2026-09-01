using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Hr;
using System.Data.Common;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Consolidated HR "Command Centre" dashboard. Aggregates the data that actually
    /// exists in the system — the employee registry (empregistration), biometric
    /// attendance (attendance) and the leave-request workflow (LeaveRequests) — into a
    /// single payload that answers the three HR questions:
    ///   1. What needs attention today?
    ///   2. What is changing in the workforce?
    ///   3. Which HR processes are delayed or non-compliant?
    /// </summary>
    [ApiController]
    [Route("api/hr-dashboard")]
    [Authorize]
    public class HrDashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private static readonly TimeOnly WorkStart = new(7, 30);

        public HrDashboardController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/hr-dashboard/overview
        [HttpGet("overview")]
        public async Task<ActionResult<object>> GetOverview()
        {
            var today = DateTime.UtcNow.Date;
            var monthStart = new DateTime(today.Year, today.Month, 1);
            var in30Days = today.AddDays(30);

            // ---- Employee registry (from HrEmployees — the single source of truth) --
            var allHrEmployees = await _context.HrEmployees.AsNoTracking().ToListAsync();
            var activeEmployees = allHrEmployees.Where(e => e.Status != "Terminated").ToList();
            var totalEmployees = activeEmployees.Count;
            var terminatedCount = allHrEmployees.Count(e => e.Status == "Terminated");

            var byDepartment = activeEmployees
                .GroupBy(e => string.IsNullOrWhiteSpace(e.Department) ? "Unassigned" : e.Department!)
                .Select(g => new { department = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToList();

            var bySite = activeEmployees
                .GroupBy(e => string.IsNullOrWhiteSpace(e.Site) ? "Unassigned" : e.Site!)
                .Select(g => new { site = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToList();

            var newThisMonth = activeEmployees.Count(e => e.CreatedAt >= monthStart);

            // Record completeness — flag employees missing key HR data.
            bool IsIncomplete(HrEmployee e) =>
                string.IsNullOrWhiteSpace(e.PhoneNumber) ||
                string.IsNullOrWhiteSpace(e.Department) ||
                string.IsNullOrWhiteSpace(e.JobTitle) ||
                string.IsNullOrWhiteSpace(e.IdNumber);

            var incompleteCount = activeEmployees.Count(IsIncomplete);
            var completenessRate = totalEmployees > 0
                ? Math.Round((double)(totalEmployees - incompleteCount) / totalEmployees * 100, 1)
                : 100;

            var missingBreakdown = new
            {
                mobile = activeEmployees.Count(e => string.IsNullOrWhiteSpace(e.PhoneNumber)),
                department = activeEmployees.Count(e => string.IsNullOrWhiteSpace(e.Department)),
                jobTitle = activeEmployees.Count(e => string.IsNullOrWhiteSpace(e.JobTitle)),
                idNumber = activeEmployees.Count(e => string.IsNullOrWhiteSpace(e.IdNumber))
            };

            // ---- Today's attendance ----------------------------------------------
            var todayAttendance = await _context.AttendanceRecords.AsNoTracking()
                .Where(a => a.Date != null && a.Date.Value.Date == today)
                .ToListAsync();

            var clockedInToday = todayAttendance.Select(a => a.EmpID).Distinct().Count();
            var lateToday = todayAttendance.Count(a => a.TimeIn != null && a.TimeIn.Value > WorkStart);
            var notClockedIn = Math.Max(0, totalEmployees - clockedInToday);

            var arrivals = todayAttendance.Where(a => a.TimeIn.HasValue).Select(a => a.TimeIn!.Value).ToList();
            string? earliestArrival = arrivals.Count > 0 ? arrivals.Min().ToString("HH:mm") : null;
            string? averageArrival = null;
            if (arrivals.Count > 0)
            {
                var avgTicks = (long)arrivals.Average(t => t.ToTimeSpan().Ticks);
                averageArrival = TimeOnly.FromTimeSpan(TimeSpan.FromTicks(avgTicks)).ToString("HH:mm");
            }

            var attendanceRate = totalEmployees > 0
                ? Math.Round((double)clockedInToday / totalEmployees * 100, 1)
                : 0;

            // Late arrivals detail (top 10, most late first)
            var lateArrivals = todayAttendance
                .Where(a => a.TimeIn != null && a.TimeIn.Value > WorkStart)
                .OrderByDescending(a => a.TimeIn!.Value)
                .Take(10)
                .Select(a => new
                {
                    empId = a.EmpID,
                    name = ((a.Name ?? "") + " " + (a.LastName ?? "")).Trim(),
                    department = a.Department ?? "",
                    timeIn = a.TimeIn!.Value.ToString("HH:mm"),
                    lateMinutes = (int)(a.TimeIn.Value.ToTimeSpan() - WorkStart.ToTimeSpan()).TotalMinutes
                })
                .ToList();

            // Department attendance breakdown (biometric clock-ins vs Main Office HR employees)
            var mainOfficeEmps = await _context.EmpRegistrations.AsNoTracking().ToListAsync();
            var deptAttendance = mainOfficeEmps
                .GroupBy(e => string.IsNullOrWhiteSpace(e.Department) ? "Unassigned" : e.Department!)
                .Select(g =>
                {
                    var ids = g.Select(e => e.EmpId).ToHashSet();
                    var present = todayAttendance.Where(a => ids.Contains(a.EmpID)).Select(a => a.EmpID).Distinct().Count();
                    return new
                    {
                        department = g.Key,
                        total = g.Count(),
                        present,
                        rate = g.Count() > 0 ? Math.Round((double)present / g.Count() * 100, 0) : 0
                    };
                })
                .OrderByDescending(x => x.total)
                .ToList();

            // ---- Weekly attendance trend (last 7 days) ---------------------------
            var weekStart = today.AddDays(-6);
            var weekRecords = await _context.AttendanceRecords.AsNoTracking()
                .Where(a => a.Date != null && a.Date.Value.Date >= weekStart && a.Date.Value.Date <= today)
                .ToListAsync();
            var trend = Enumerable.Range(0, 7).Select(i =>
            {
                var d = weekStart.AddDays(i);
                var present = weekRecords.Where(a => a.Date!.Value.Date == d).Select(a => a.EmpID).Distinct().Count();
                var late = weekRecords.Count(a => a.Date!.Value.Date == d && a.TimeIn != null && a.TimeIn.Value > WorkStart);
                return new
                {
                    date = d.ToString("yyyy-MM-dd"),
                    label = d.ToString("ddd"),
                    present,
                    late
                };
            }).ToList();

            // ---- Leave (raw SQL — LeaveRequests has no DbSet) --------------------
            var leave = await GetLeaveAggregatesAsync(today, in30Days);

            // ---- Manual attendance registers (non-biometric sites) --------------
            // Many sites/staff don't clock in — supervisors submit manual registers.
            // Combine them with biometric clock-ins for a holistic present count.
            var todayRegister = await _context.HrRegisterEntries.AsNoTracking()
                .Where(r => r.RegisterDate == today)
                .ToListAsync();

            var presentLike = new[] { "Present", "Working Offsite", "Half Day" };
            var manualPresent = todayRegister.Count(r => presentLike.Contains(r.Status));
            var manualAbsent = todayRegister.Count(r => r.Status == "Absent");
            var manualOnLeave = todayRegister.Count(r => r.Status == "On Leave" || r.Status == "Sick");

            var registerBySite = todayRegister
                .GroupBy(r => r.Site)
                .Select(g => new
                {
                    site = g.Key,
                    present = g.Count(x => presentLike.Contains(x.Status)),
                    absent = g.Count(x => x.Status == "Absent"),
                    total = g.Count(),
                    submittedBy = g.OrderByDescending(x => x.SubmittedAt).First().SubmittedByName,
                    submittedAt = g.OrderByDescending(x => x.SubmittedAt).First().SubmittedAt
                })
                .OrderBy(x => x.site)
                .ToList();

            // Sites that have staff but no register submitted today (needs attention)
            var registeredSites = todayRegister.Select(r => r.Site).Distinct().ToHashSet();
            var hrSitesWithStaff = await _context.HrEmployees.AsNoTracking()
                .Where(e => e.Status != "Terminated")
                .Select(e => e.Site).Distinct().ToListAsync();
            var missingRegisterSites = hrSitesWithStaff
                .Where(s => s != "Main Office" && !registeredSites.Contains(s))
                .ToList();

            // Holistic present = biometric clock-ins + manual-register present
            var holisticPresent = clockedInToday + manualPresent;

            // ---- Disciplinary / employee-relations ------------------------------
            var activeCases = await _context.HrDisciplinaryCases.AsNoTracking()
                .Where(c => c.Status == "Active" || c.Status == "Open")
                .ToListAsync();
            var activeWarnings = activeCases.Count(c => c.Type.Contains("Warning"));
            var activeSuspensions = activeCases.Count(c => c.Type == "Suspension");
            var openInvestigations = activeCases.Count(c => c.Type == "Investigation" || c.Type == "Grievance");

            // ---- HR attention centre --------------------------------------------
            // Build a prioritised, actionable list with severity indicators.
            var attention = new List<AttentionItem>();

            if (activeSuspensions > 0)
                attention.Add(new AttentionItem("suspensions", "critical",
                    "gavel", $"{activeSuspensions} employee{(activeSuspensions == 1 ? "" : "s")} currently suspended",
                    "Active suspensions in effect.", activeSuspensions, "directory"));

            if (openInvestigations > 0)
                attention.Add(new AttentionItem("investigations", "due_soon",
                    "policy", $"{openInvestigations} open grievance/investigation{(openInvestigations == 1 ? "" : "s")}",
                    "Employee-relations cases awaiting action.", openInvestigations, "directory"));

            if (missingRegisterSites.Count > 0)
                attention.Add(new AttentionItem("missing_registers", "due_soon",
                    "assignment_late", $"{missingRegisterSites.Count} site{(missingRegisterSites.Count == 1 ? "" : "s")} have not submitted a register today",
                    string.Join(", ", missingRegisterSites), missingRegisterSites.Count, "registers"));

            if (leave.pendingCount > 0)
                attention.Add(new AttentionItem("leave_approval", leave.pendingCount >= 5 ? "critical" : "due_soon",
                    "event_available", $"{leave.pendingCount} leave request{(leave.pendingCount == 1 ? "" : "s")} awaiting approval",
                    "Review and approve or decline pending leave.", leave.pendingCount, "leave"));

            if (leave.stalePendingCount > 0)
                attention.Add(new AttentionItem("leave_overdue", "overdue",
                    "hourglass_bottom", $"{leave.stalePendingCount} leave request{(leave.stalePendingCount == 1 ? "" : "s")} unprocessed 3+ days",
                    "These requests have been waiting too long.", leave.stalePendingCount, "leave"));

            if (notClockedIn > 0)
                attention.Add(new AttentionItem("absent_today", notClockedIn > totalEmployees / 2 ? "critical" : "due_soon",
                    "person_off", $"{notClockedIn} employee{(notClockedIn == 1 ? "" : "s")} not clocked in today",
                    "No biometric clock-in recorded yet today.", notClockedIn, "attendance"));

            if (lateToday > 0)
                attention.Add(new AttentionItem("late_today", "due_soon",
                    "schedule", $"{lateToday} late arrival{(lateToday == 1 ? "" : "s")} today",
                    "Employees clocked in after 07:30.", lateToday, "attendance"));

            if (incompleteCount > 0)
                attention.Add(new AttentionItem("incomplete_records", "due_soon",
                    "assignment_late", $"{incompleteCount} employee record{(incompleteCount == 1 ? "" : "s")} missing information",
                    "ID number, contact, department, job title or photo is missing.", incompleteCount, "records"));

            if (leave.upcomingCount > 0)
                attention.Add(new AttentionItem("upcoming_leave", "info",
                    "flight_takeoff", $"{leave.upcomingCount} employee{(leave.upcomingCount == 1 ? "" : "s")} on leave in next 30 days",
                    "Plan cover for upcoming approved leave.", leave.upcomingCount, "leave"));

            var severityRank = new Dictionary<string, int> { ["overdue"] = 0, ["critical"] = 1, ["due_soon"] = 2, ["info"] = 3 };

            return Ok(new
            {
                generatedAt = DateTime.UtcNow,
                workforce = new
                {
                    totalEmployees,
                    terminatedCount,
                    newThisMonth,
                    onLeaveToday = leave.onLeaveTodayCount,
                    absentToday = notClockedIn,
                    departments = byDepartment.Count,
                    byDepartment,
                    bySite,
                    completenessRate,
                    incompleteCount,
                    missingBreakdown
                },
                attendance = new
                {
                    clockedInToday,
                    notClockedIn,
                    lateToday,
                    attendanceRate,
                    earliestArrival,
                    averageArrival,
                    lateArrivals,
                    byDepartment = deptAttendance,
                    trend,
                    // Holistic view = biometric clock-ins + manual registers
                    holisticPresent,
                    manualPresent,
                    manualAbsent,
                    manualOnLeave
                },
                registers = new
                {
                    submittedSites = registerBySite.Count,
                    totalPresent = manualPresent,
                    totalAbsent = manualAbsent,
                    bySite = registerBySite,
                    missingSites = missingRegisterSites
                },
                discipline = new
                {
                    activeCases = activeCases.Count,
                    activeWarnings,
                    activeSuspensions,
                    openInvestigations,
                    terminated = terminatedCount
                },
                leave = new
                {
                    pending = leave.pendingCount,
                    stalePending = leave.stalePendingCount,
                    onLeaveToday = leave.onLeaveTodayCount,
                    upcoming = leave.upcomingCount,
                    byType = leave.byType,
                    onLeaveNow = leave.onLeaveNow,
                    upcomingList = leave.upcomingList
                },
                attention = attention
                    .OrderBy(a => severityRank.GetValueOrDefault(a.severity, 9))
                    .ToList()
            });
        }

        // GET: api/hr-dashboard/incomplete-records
        // Employees missing key HR data — drill-down for the compliance card.
        [HttpGet("incomplete-records")]
        public async Task<ActionResult<object>> GetIncompleteRecords()
        {
            var employees = await _context.HrEmployees.AsNoTracking()
                .Where(e => e.Status != "Terminated")
                .ToListAsync();

            var result = employees.Select(e =>
            {
                var missing = new List<string>();
                if (string.IsNullOrWhiteSpace(e.PhoneNumber)) missing.Add("Mobile");
                if (string.IsNullOrWhiteSpace(e.Department)) missing.Add("Department");
                if (string.IsNullOrWhiteSpace(e.JobTitle)) missing.Add("Job Title");
                if (string.IsNullOrWhiteSpace(e.IdNumber)) missing.Add("ID Number");
                return new
                {
                    empId = e.Id.ToString(),
                    name = $"{e.FirstName} {e.LastName}".Trim(),
                    department = e.Department ?? "Unassigned",
                    jobTitle = e.JobTitle ?? "",
                    site = e.Site ?? "",
                    missing
                };
            })
            .Where(x => x.missing.Count > 0)
            .OrderByDescending(x => x.missing.Count)
            .ToList();

            return Ok(result);
        }

        // ---- Helpers -------------------------------------------------------------

        private sealed record AttentionItem(
            string type, string severity, string icon, string title,
            string detail, int count, string action);

        private sealed class LeaveAggregates
        {
            public int pendingCount;
            public int stalePendingCount;
            public int onLeaveTodayCount;
            public int upcomingCount;
            public List<object> byType = new();
            public List<object> onLeaveNow = new();
            public List<object> upcomingList = new();
        }

        private async Task<LeaveAggregates> GetLeaveAggregatesAsync(DateTime today, DateTime in30Days)
        {
            var agg = new LeaveAggregates();
            var conn = _context.Database.GetDbConnection();
            var mustClose = conn.State != System.Data.ConnectionState.Open;
            if (mustClose) await conn.OpenAsync();
            try
            {
                // Guard: table may not exist in every environment.
                if (!await TableExistsAsync(conn, "LeaveRequests"))
                    return agg;

                agg.pendingCount = await ScalarIntAsync(conn,
                    "SELECT COUNT(*) FROM LeaveRequests WHERE Status = 'Pending'");

                agg.stalePendingCount = await ScalarIntAsync(conn,
                    "SELECT COUNT(*) FROM LeaveRequests WHERE Status = 'Pending' AND SubmittedAt < DATEADD(day, -3, GETUTCDATE())");

                agg.onLeaveTodayCount = await ScalarIntAsync(conn,
                    "SELECT COUNT(*) FROM LeaveRequests WHERE Status = 'Approved' AND StartDate <= @today AND EndDate >= @today",
                    ("@today", today));

                agg.upcomingCount = await ScalarIntAsync(conn,
                    "SELECT COUNT(*) FROM LeaveRequests WHERE Status = 'Approved' AND StartDate > @today AND StartDate <= @until",
                    ("@today", today), ("@until", in30Days));

                agg.byType = await RowsAsync(conn,
                    "SELECT LeaveType, COUNT(*) AS Cnt FROM LeaveRequests WHERE Status IN ('Pending','Approved') GROUP BY LeaveType ORDER BY Cnt DESC",
                    r => (object)new { type = r.IsDBNull(0) ? "Other" : r.GetString(0), count = r.GetInt32(1) });

                agg.onLeaveNow = await RowsAsync(conn,
                    "SELECT TOP 20 EmployeeName, Department, LeaveType, StartDate, EndDate FROM LeaveRequests WHERE Status = 'Approved' AND StartDate <= @today AND EndDate >= @today ORDER BY EndDate",
                    r => (object)new
                    {
                        name = r.IsDBNull(0) ? "" : r.GetString(0),
                        department = r.IsDBNull(1) ? "" : r.GetString(1),
                        leaveType = r.IsDBNull(2) ? "" : r.GetString(2),
                        startDate = r.IsDBNull(3) ? (DateTime?)null : r.GetDateTime(3),
                        endDate = r.IsDBNull(4) ? (DateTime?)null : r.GetDateTime(4)
                    },
                    ("@today", today));

                agg.upcomingList = await RowsAsync(conn,
                    "SELECT TOP 20 EmployeeName, Department, LeaveType, StartDate, EndDate, DaysRequested FROM LeaveRequests WHERE Status = 'Approved' AND StartDate > @today AND StartDate <= @until ORDER BY StartDate",
                    r => (object)new
                    {
                        name = r.IsDBNull(0) ? "" : r.GetString(0),
                        department = r.IsDBNull(1) ? "" : r.GetString(1),
                        leaveType = r.IsDBNull(2) ? "" : r.GetString(2),
                        startDate = r.IsDBNull(3) ? (DateTime?)null : r.GetDateTime(3),
                        endDate = r.IsDBNull(4) ? (DateTime?)null : r.GetDateTime(4),
                        days = r.IsDBNull(5) ? 0 : r.GetInt32(5)
                    },
                    ("@today", today), ("@until", in30Days));
            }
            catch
            {
                // Leave data is best-effort; never fail the whole dashboard on it.
            }
            finally
            {
                if (mustClose) await conn.CloseAsync();
            }
            return agg;
        }

        private static async Task<bool> TableExistsAsync(DbConnection conn, string table)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT CASE WHEN OBJECT_ID(@t, 'U') IS NULL THEN 0 ELSE 1 END";
            var p = cmd.CreateParameter(); p.ParameterName = "@t"; p.Value = table; cmd.Parameters.Add(p);
            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result) == 1;
        }

        private static async Task<int> ScalarIntAsync(DbConnection conn, string sql, params (string, object)[] ps)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var (name, val) in ps)
            {
                var p = cmd.CreateParameter(); p.ParameterName = name; p.Value = val; cmd.Parameters.Add(p);
            }
            var result = await cmd.ExecuteScalarAsync();
            return result == null || result == DBNull.Value ? 0 : Convert.ToInt32(result);
        }

        private static async Task<List<object>> RowsAsync(DbConnection conn, string sql, Func<DbDataReader, object> map, params (string, object)[] ps)
        {
            var list = new List<object>();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var (name, val) in ps)
            {
                var p = cmd.CreateParameter(); p.ParameterName = name; p.Value = val; cmd.Parameters.Add(p);
            }
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                list.Add(map(reader));
            return list;
        }
    }
}
