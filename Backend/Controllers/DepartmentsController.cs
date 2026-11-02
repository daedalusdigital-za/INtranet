using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.DTOs.Boards;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DepartmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DepartmentsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DepartmentDto>>> GetDepartments([FromQuery] bool includeInactive = false)
        {
            // Read departments from database
            var departments = await _context.Departments
                .Where(d => includeInactive || d.IsActive)
                .OrderBy(d => d.Name)
                .Select(d => new DepartmentDto
                {
                    DepartmentId = d.DepartmentId,
                    Name = d.Name,
                    ManagerName = d.ManagerName ?? "",
                    BoardCount = 0,
                    UserCount = _context.Users.Count(u => u.DepartmentId == d.DepartmentId)
                })
                .ToListAsync();

            return Ok(departments);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<DepartmentDto>> GetDepartment(int id)
        {
            var department = await _context.Departments
                .Where(d => d.DepartmentId == id)
                .Select(d => new DepartmentDto
                {
                    DepartmentId = d.DepartmentId,
                    Name = d.Name,
                    ManagerName = d.ManagerName ?? "",
                    BoardCount = 0,
                    UserCount = _context.Users.Count(u => u.DepartmentId == d.DepartmentId)
                })
                .FirstOrDefaultAsync();

            if (department == null)
            {
                return NotFound();
            }

            return Ok(department);
        }

        [HttpPost]
        [Authorize(Roles = "Super Admin,Admin")]
        public async Task<ActionResult<DepartmentDto>> CreateDepartment([FromBody] Department department)
        {
            department.Name = (department.Name ?? "").Trim();
            if (department.Name.Length == 0) return BadRequest(new { message = "A department needs a name." });
            if (await NameTakenAsync(department.Name, null)) return Conflict(new { message = $"A department called \"{department.Name}\" already exists. Use it, or rename this one so people are not split across two records." });
            department.IsActive = true;
            department.CreatedAt = DateTime.UtcNow;
            _context.Departments.Add(department);
            await _context.SaveChangesAsync();

            var departmentDto = new DepartmentDto
            {
                DepartmentId = department.DepartmentId,
                Name = department.Name,
                ManagerName = department.ManagerName,
                BoardCount = 0,
                UserCount = 0
            };

            return CreatedAtAction(nameof(GetDepartment), new { id = department.DepartmentId }, departmentDto);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Super Admin,Admin,Manager")]
        public async Task<IActionResult> UpdateDepartment(int id, [FromBody] Department department)
        {
            if (id != department.DepartmentId)
            {
                return BadRequest();
            }

            var existingDepartment = await _context.Departments.FindAsync(id);
            if (existingDepartment == null)
            {
                return NotFound();
            }

            var newName = (department.Name ?? "").Trim();
            if (newName.Length == 0) return BadRequest(new { message = "A department needs a name." });
            if (await NameTakenAsync(newName, id)) return Conflict(new { message = $"A department called \"{newName}\" already exists." });

            existingDepartment.Name = newName;
            existingDepartment.ManagerName = department.ManagerName;
            existingDepartment.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Retire a department. Nothing is deleted: the record stays for history; it disappears from pickers and the map.</summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Super Admin,Admin")]
        public async Task<IActionResult> DeleteDepartment(int id)
        {
            var department = await _context.Departments.FindAsync(id);
            if (department == null)
            {
                return NotFound();
            }

            var users = await _context.Users.CountAsync(u => u.DepartmentId == id);
            if (users > 0) return Conflict(new { message = $"{users} user(s) are still in this department. Move them first, or merge the department into another one." });

            department.IsActive = false;
            department.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Case-insensitive, trimmed, among active departments; "X" and "X Department" are treated as the same name.</summary>
        private async Task<bool> NameTakenAsync(string name, int? exceptId)
        {
            static string Key(string s) => System.Text.RegularExpressions.Regex.Replace(s.Trim().ToLowerInvariant(), @"\s+department$", "");
            var k = Key(name);
            var names = await _context.Departments.Where(d => d.IsActive && (exceptId == null || d.DepartmentId != exceptId)).Select(d => d.Name).ToListAsync();
            return names.Any(n => Key(n) == k);
        }
    }
}
