using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize] // Disabled temporarily
    public class DepartmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DepartmentsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DepartmentDto>>> GetDepartments()
        {
            // Read departments from database
            var departments = await _context.Departments
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
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<DepartmentDto>> CreateDepartment([FromBody] Department department)
        {
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
        [Authorize(Roles = "Admin,Manager")]
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

            existingDepartment.Name = department.Name;
            existingDepartment.ManagerName = department.ManagerName;
            existingDepartment.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteDepartment(int id)
        {
            var department = await _context.Departments.FindAsync(id);
            if (department == null)
            {
                return NotFound();
            }

            _context.Departments.Remove(department);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
