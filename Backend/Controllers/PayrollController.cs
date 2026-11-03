using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Services.Flows;

namespace ProjectTracker.API.Controllers
{
    /// <summary>Payroll hand-off settings: cut-off day of month and who receives payroll inputs. Finance/HR/admin.</summary>
    [Authorize]
    [ApiController]
    [Route("api/payroll")]
    public class PayrollController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IPayrollHandoff _payroll;
        public PayrollController(ApplicationDbContext db, IPayrollHandoff payroll) { _db = db; _payroll = payroll; }

        [HttpGet("settings")]
        public async Task<IActionResult> Get()
        {
            var rows = await _db.SystemSettings.AsNoTracking().Where(s => s.Key == PayrollHandoffService.CutoffDayKey || s.Key == PayrollHandoffService.UserIdKey).ToDictionaryAsync(s => s.Key, s => s.Value);
            var (cutoff, day) = await _payroll.NextCutoffAsync(_db, DateTime.UtcNow);
            int? uid = rows.TryGetValue(PayrollHandoffService.UserIdKey, out var u) && int.TryParse(u, out var i) ? i : null;
            var user = uid == null ? null : await _db.Users.AsNoTracking().Where(x => x.UserId == uid).Select(x => new { x.UserId, name = x.Name + " " + x.Surname }).FirstOrDefaultAsync();
            var open = await _db.TodoTasks.CountAsync(t => t.Category == "Payroll" && !t.IsCompleted);
            return Ok(new { cutoffDay = day, nextCutoff = cutoff, payrollUserId = uid, payrollUser = user?.name, openInputs = open });
        }

        public class PayrollSettingsDto { public int? CutoffDay { get; set; } public int? PayrollUserId { get; set; } }

        [HttpPut("settings")]
        [RequireModule("finance", AlsoAllowRoles = "Admin,HR")]
        public async Task<IActionResult> Put([FromBody] PayrollSettingsDto dto)
        {
            if (dto.CutoffDay is int d && (d < 1 || d > 28)) return BadRequest(new { message = "Cut-off day must be between 1 and 28." });
            if (dto.PayrollUserId is int pu && !await _db.Users.AnyAsync(u => u.UserId == pu && u.IsActive)) return BadRequest(new { message = "That user is not active." });
            var me = User.GetUserId();
            var who = await _db.Users.AsNoTracking().Where(u => u.UserId == me).Select(u => u.Name + " " + u.Surname).FirstOrDefaultAsync();
            async Task Set(string key, string? value, string desc)
            {
                var s = await _db.SystemSettings.FirstOrDefaultAsync(x => x.Key == key);
                if (value == null) { if (s != null) _db.SystemSettings.Remove(s); return; }
                if (s == null) { s = new SystemSetting { Key = key, Description = desc }; _db.SystemSettings.Add(s); }
                s.Value = value; s.UpdatedAt = DateTime.UtcNow; s.UpdatedBy = who;
            }
            if (dto.CutoffDay != null) await Set(PayrollHandoffService.CutoffDayKey, dto.CutoffDay.ToString(), "Payroll cut-off day of month (weekend → previous Friday)");
            await Set(PayrollHandoffService.UserIdKey, dto.PayrollUserId?.ToString(), "User who receives payroll input to-dos");
            await _db.SaveChangesAsync();
            return await Get();
        }

        /// <summary>Open payroll inputs for this cycle.</summary>
        [HttpGet("inputs")]
        [RequireModule("finance", AlsoAllowRoles = "Admin,HR")]
        public async Task<IActionResult> Inputs([FromQuery] bool includeDone = false)
        {
            var q = _db.TodoTasks.AsNoTracking().Where(t => t.Category == "Payroll");
            if (!includeDone) q = q.Where(t => !t.IsCompleted);
            var rows = await q.OrderBy(t => t.DueDate).ThenByDescending(t => t.CreatedAt).Take(200)
                .Select(t => new { t.Id, t.Title, t.Description, t.DueDate, t.Priority, t.IsCompleted, t.CompletedAt, t.CreatedAt, assignedTo = t.AssignedToUser.Name + " " + t.AssignedToUser.Surname }).ToListAsync();
            return Ok(rows);
        }
    }
}
