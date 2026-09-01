using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Hr;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Employee-relations / disciplinary cases: warnings, suspensions, grievances,
    /// investigations and dismissals. Issuing a suspension/dismissal can also update
    /// the employee's status so the directory and dashboard stay in sync.
    /// </summary>
    [ApiController]
    [Route("api/hr-disciplinary")]
    [Authorize]
    public class HrDisciplinaryController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<HrDisciplinaryController> _logger;

        public HrDisciplinaryController(ApplicationDbContext context, ILogger<HrDisciplinaryController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string CurrentUserName() =>
            User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "HR User";

        [HttpGet("types")]
        public ActionResult<object> GetTypes() => Ok(HrDisciplinaryTypes.All);

        // ---- Cases for one employee --------------------------------------------
        [HttpGet("employee/{employeeId:int}")]
        public async Task<ActionResult<object>> GetForEmployee(int employeeId)
        {
            var cases = await _context.HrDisciplinaryCases.AsNoTracking()
                .Where(c => c.EmployeeId == employeeId)
                .OrderByDescending(c => c.IssuedDate)
                .ToListAsync();
            return Ok(cases);
        }

        // ---- All active/open cases (for the dashboard attention centre) --------
        [HttpGet("active")]
        public async Task<ActionResult<object>> GetActive()
        {
            var cases = await _context.HrDisciplinaryCases.AsNoTracking()
                .Where(c => c.Status == "Active" || c.Status == "Open")
                .Join(_context.HrEmployees.AsNoTracking(),
                      c => c.EmployeeId, e => e.Id,
                      (c, e) => new
                      {
                          c.Id, c.EmployeeId,
                          employeeName = e.FirstName + " " + e.LastName,
                          site = e.Site,
                          c.Type, c.Title, c.Status, c.IssuedDate, c.ExpiryDate, c.IssuedByName
                      })
                .OrderByDescending(c => c.IssuedDate)
                .ToListAsync();
            return Ok(cases);
        }

        public class CreateCaseDto
        {
            public int EmployeeId { get; set; }
            public string Type { get; set; } = "Verbal Warning";
            public string Title { get; set; } = string.Empty;
            public string? Description { get; set; }
            public DateTime? IssuedDate { get; set; }
            public DateTime? ExpiryDate { get; set; }
            public string? Outcome { get; set; }
            public bool IsPaidSuspension { get; set; }
            public string? Notes { get; set; }
            /// <summary>When true and Type is Suspension/Dismissal, update employee status.</summary>
            public bool UpdateEmployeeStatus { get; set; } = true;
        }

        // ---- Create a case ------------------------------------------------------
        [HttpPost]
        public async Task<ActionResult<object>> Create([FromBody] CreateCaseDto dto)
        {
            var emp = await _context.HrEmployees.FirstOrDefaultAsync(e => e.Id == dto.EmployeeId);
            if (emp == null) return NotFound(new { error = "Employee not found" });
            if (string.IsNullOrWhiteSpace(dto.Title)) return BadRequest(new { error = "Title is required" });

            var user = CurrentUserName();
            var c = new HrDisciplinaryCase
            {
                EmployeeId = dto.EmployeeId,
                Type = dto.Type,
                Title = dto.Title,
                Description = dto.Description,
                IssuedDate = dto.IssuedDate ?? DateTime.UtcNow,
                ExpiryDate = dto.ExpiryDate,
                Status = "Active",
                Outcome = dto.Outcome,
                IsPaidSuspension = dto.IsPaidSuspension,
                Notes = dto.Notes,
                IssuedByName = user,
                CreatedByName = user,
                CreatedAt = DateTime.UtcNow
            };
            _context.HrDisciplinaryCases.Add(c);

            // Reflect serious actions on the employee's status
            if (dto.UpdateEmployeeStatus)
            {
                if (dto.Type == "Suspension" && emp.Status != "Terminated")
                {
                    emp.Status = "Suspended";
                    emp.UpdatedAt = DateTime.UtcNow;
                    emp.UpdatedByName = user;
                }
                else if (dto.Type == "Dismissal")
                {
                    emp.Status = "Terminated";
                    emp.UpdatedAt = DateTime.UtcNow;
                    emp.UpdatedByName = user;
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Disciplinary case {Type} created for employee {Emp} by {User}",
                dto.Type, dto.EmployeeId, user);
            return Ok(c);
        }

        public class UpdateCaseDto
        {
            public string? Status { get; set; }
            public string? Outcome { get; set; }
            public DateTime? ExpiryDate { get; set; }
            public string? Notes { get; set; }
            /// <summary>When resolving a suspension, optionally reinstate the employee to Active.</summary>
            public bool ReinstateEmployee { get; set; }
        }

        // ---- Update / resolve a case -------------------------------------------
        [HttpPut("{id:int}")]
        public async Task<ActionResult<object>> Update(int id, [FromBody] UpdateCaseDto dto)
        {
            var c = await _context.HrDisciplinaryCases.FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(dto.Status)) c.Status = dto.Status;
            if (dto.Outcome != null) c.Outcome = dto.Outcome;
            if (dto.ExpiryDate.HasValue) c.ExpiryDate = dto.ExpiryDate;
            if (dto.Notes != null) c.Notes = dto.Notes;
            c.UpdatedAt = DateTime.UtcNow;

            if (dto.ReinstateEmployee)
            {
                var emp = await _context.HrEmployees.FirstOrDefaultAsync(e => e.Id == c.EmployeeId);
                if (emp != null && emp.Status == "Suspended")
                {
                    emp.Status = "Active";
                    emp.UpdatedAt = DateTime.UtcNow;
                    emp.UpdatedByName = CurrentUserName();
                }
            }

            await _context.SaveChangesAsync();
            return Ok(c);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var c = await _context.HrDisciplinaryCases.FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return NotFound();
            _context.HrDisciplinaryCases.Remove(c);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Case deleted" });
        }
    }
}
