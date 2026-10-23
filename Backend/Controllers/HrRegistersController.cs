using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Hr;

using ProjectTracker.API.Authorization;
namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Manual attendance registers for sites/staff that do not clock in biometrically.
    /// A supervisor submits a daily register (who is in/out/working); HR combines these
    /// with biometric clock-ins for a holistic attendance view.
    /// </summary>
    [ApiController]
    [Route("api/hr-registers")]
    [Authorize]
    [RequireModule("human_resource", AlsoAllowRoles = "HR")]
    public class HrRegistersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<HrRegistersController> _logger;

        public HrRegistersController(ApplicationDbContext context, ILogger<HrRegistersController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string CurrentUserName() =>
            User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "HR User";
        private int? CurrentUserId() =>
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        [HttpGet("statuses")]
        public ActionResult<object> GetStatuses() => Ok(HrRegisterStatuses.All);

        // ---- Roster for a site: the people expected, pre-filled with any saved register --
        // GET: api/hr-registers/roster?site=Security&date=2026-08-04
        [HttpGet("roster")]
        public async Task<ActionResult<object>> GetRoster([FromQuery] string site, [FromQuery] DateTime? date)
        {
            if (string.IsNullOrWhiteSpace(site)) return BadRequest(new { error = "site is required" });
            var day = (date ?? DateTime.UtcNow).Date;

            var employees = await _context.HrEmployees.AsNoTracking()
                .Where(e => e.Site == site && e.Status != "Terminated")
                .OrderBy(e => e.LastName).ThenBy(e => e.FirstName)
                .Select(e => new { e.Id, e.FirstName, e.LastName, e.Department, e.JobTitle, e.EmploymentType })
                .ToListAsync();

            var existing = await _context.HrRegisterEntries.AsNoTracking()
                .Where(r => r.Site == site && r.RegisterDate == day)
                .ToListAsync();

            var byEmp = existing.Where(x => x.EmployeeId != null)
                .GroupBy(x => x.EmployeeId!.Value)
                .ToDictionary(g => g.Key, g => g.First());

            var roster = employees.Select(e =>
            {
                byEmp.TryGetValue(e.Id, out var r);
                return new
                {
                    employeeId = e.Id,
                    name = $"{e.FirstName} {e.LastName}".Trim(),
                    department = e.Department,
                    jobTitle = e.JobTitle,
                    employmentType = e.EmploymentType,
                    status = r?.Status ?? "Present",
                    timeIn = r?.TimeIn,
                    timeOut = r?.TimeOut,
                    notes = r?.Notes,
                    entryId = r?.Id
                };
            }).ToList();

            // Ad-hoc names that were added to the register but aren't in the registry
            var adhoc = existing.Where(x => x.EmployeeId == null)
                .Select(x => new
                {
                    employeeId = (int?)null,
                    name = x.EmployeeName,
                    department = x.Department,
                    jobTitle = (string?)null,
                    employmentType = (string?)null,
                    status = x.Status,
                    timeIn = x.TimeIn,
                    timeOut = x.TimeOut,
                    notes = x.Notes,
                    entryId = (int?)x.Id
                }).ToList();

            return Ok(new
            {
                site,
                date = day,
                submitted = existing.Count > 0,
                submittedBy = existing.OrderByDescending(x => x.SubmittedAt).FirstOrDefault()?.SubmittedByName,
                submittedAt = existing.OrderByDescending(x => x.SubmittedAt).FirstOrDefault()?.SubmittedAt,
                roster,
                adhoc
            });
        }

        public class RegisterLineDto
        {
            public int? EmployeeId { get; set; }
            public string EmployeeName { get; set; } = string.Empty;
            public string? Department { get; set; }
            public string Status { get; set; } = "Present";
            public string? TimeIn { get; set; }
            public string? TimeOut { get; set; }
            public string? Notes { get; set; }
        }

        public class SubmitRegisterDto
        {
            public string Site { get; set; } = string.Empty;
            public DateTime Date { get; set; }
            public List<RegisterLineDto> Lines { get; set; } = new();
        }

        // ---- Submit / update a full day's register for a site (upsert) --------------
        // POST: api/hr-registers/submit
        [HttpPost("submit")]
        public async Task<ActionResult<object>> Submit([FromBody] SubmitRegisterDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Site)) return BadRequest(new { error = "Site is required" });
            var day = dto.Date.Date;
            var user = CurrentUserName();
            var uid = CurrentUserId();
            var now = DateTime.UtcNow;

            // Replace existing entries for this site+day (clean upsert)
            var existing = await _context.HrRegisterEntries
                .Where(r => r.Site == dto.Site && r.RegisterDate == day)
                .ToListAsync();
            if (existing.Count > 0) _context.HrRegisterEntries.RemoveRange(existing);

            foreach (var line in dto.Lines)
            {
                if (string.IsNullOrWhiteSpace(line.EmployeeName)) continue;
                _context.HrRegisterEntries.Add(new HrRegisterEntry
                {
                    RegisterDate = day,
                    Site = dto.Site,
                    Department = line.Department,
                    EmployeeId = line.EmployeeId,
                    EmployeeName = line.EmployeeName.Trim(),
                    Status = string.IsNullOrWhiteSpace(line.Status) ? "Present" : line.Status,
                    TimeIn = line.TimeIn,
                    TimeOut = line.TimeOut,
                    Notes = line.Notes,
                    SubmittedByName = user,
                    SubmittedByUserId = uid,
                    SubmittedAt = now
                });
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Register submitted for {Site} on {Date} by {User}: {Count} lines",
                dto.Site, day, user, dto.Lines.Count);

            return Ok(new { site = dto.Site, date = day, saved = dto.Lines.Count });
        }

        // ---- History: which registers have been submitted ------------------------
        // GET: api/hr-registers/summary?date=2026-08-04
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary([FromQuery] DateTime? date)
        {
            var day = (date ?? DateTime.UtcNow).Date;
            var entries = await _context.HrRegisterEntries.AsNoTracking()
                .Where(r => r.RegisterDate == day)
                .ToListAsync();

            var bySite = entries.GroupBy(e => e.Site).Select(g => new
            {
                site = g.Key,
                total = g.Count(),
                present = g.Count(x => HrRegisterStatuses.PresentLike.Contains(x.Status)),
                absent = g.Count(x => x.Status == "Absent"),
                onLeave = g.Count(x => x.Status == "On Leave"),
                sick = g.Count(x => x.Status == "Sick"),
                submittedBy = g.OrderByDescending(x => x.SubmittedAt).First().SubmittedByName,
                submittedAt = g.OrderByDescending(x => x.SubmittedAt).First().SubmittedAt
            }).OrderBy(x => x.site).ToList();

            return Ok(new
            {
                date = day,
                totalPresent = entries.Count(x => HrRegisterStatuses.PresentLike.Contains(x.Status)),
                totalAbsent = entries.Count(x => x.Status == "Absent"),
                bySite
            });
        }

        // ---- List raw entries for a site+day (for review) ------------------------
        [HttpGet]
        public async Task<ActionResult<object>> List([FromQuery] string? site, [FromQuery] DateTime? date)
        {
            var day = (date ?? DateTime.UtcNow).Date;
            var q = _context.HrRegisterEntries.AsNoTracking().Where(r => r.RegisterDate == day);
            if (!string.IsNullOrWhiteSpace(site)) q = q.Where(r => r.Site == site);
            var list = await q.OrderBy(r => r.Site).ThenBy(r => r.EmployeeName)
                .Select(r => new
                {
                    r.Id, r.Site, r.Department, r.EmployeeId, r.EmployeeName,
                    r.Status, r.TimeIn, r.TimeOut, r.Notes, r.SubmittedByName, r.SubmittedAt
                }).ToListAsync();
            return Ok(list);
        }
    }
}
