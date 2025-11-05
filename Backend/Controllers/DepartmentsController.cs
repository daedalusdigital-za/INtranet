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
            // Hardcoded departments - TODO: Replace with database query later
            var departments = new List<DepartmentDto>
            {
                new DepartmentDto
                {
                    DepartmentId = 1,
                    Name = "Production",
                    ManagerName = "Production Manager",
                    BoardCount = 3,
                    UserCount = 12
                },
                new DepartmentDto
                {
                    DepartmentId = 2,
                    Name = "Quality Assurance",
                    ManagerName = "QA Manager",
                    BoardCount = 2,
                    UserCount = 8
                },
                new DepartmentDto
                {
                    DepartmentId = 3,
                    Name = "Warehouse",
                    ManagerName = "Warehouse Manager",
                    BoardCount = 2,
                    UserCount = 15
                },
                new DepartmentDto
                {
                    DepartmentId = 4,
                    Name = "Administration",
                    ManagerName = "Admin Manager",
                    BoardCount = 4,
                    UserCount = 10
                }
            };

            return Ok(departments);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<DepartmentDto>> GetDepartment(int id)
        {
            // Hardcoded departments - TODO: Replace with database query later
            var departments = new Dictionary<int, DepartmentDto>
            {
                { 1, new DepartmentDto { DepartmentId = 1, Name = "Production", ManagerName = "Production Manager", BoardCount = 3, UserCount = 12 } },
                { 2, new DepartmentDto { DepartmentId = 2, Name = "Quality Assurance", ManagerName = "QA Manager", BoardCount = 2, UserCount = 8 } },
                { 3, new DepartmentDto { DepartmentId = 3, Name = "Warehouse", ManagerName = "Warehouse Manager", BoardCount = 2, UserCount = 15 } },
                { 4, new DepartmentDto { DepartmentId = 4, Name = "Administration", ManagerName = "Admin Manager", BoardCount = 4, UserCount = 10 } }
            };

            if (!departments.ContainsKey(id))
            {
                return NotFound();
            }

            return Ok(departments[id]);
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
