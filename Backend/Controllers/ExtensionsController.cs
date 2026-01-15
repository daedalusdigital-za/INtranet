using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ExtensionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ExtensionsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/extensions
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ExtensionDto>>> GetExtensions(
            [FromQuery] bool? unassignedOnly = null,
            [FromQuery] int? departmentId = null,
            [FromQuery] string? search = null)
        {
            var query = _context.Extensions
                .Include(e => e.User)
                .Include(e => e.Department)
                .AsQueryable();

            if (unassignedOnly == true)
            {
                query = query.Where(e => e.UserId == null);
            }

            if (departmentId.HasValue)
            {
                query = query.Where(e => e.DepartmentId == departmentId);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(e =>
                    e.ExtensionNumber.Contains(search) ||
                    (e.Label != null && e.Label.Contains(search)) ||
                    (e.User != null && (e.User.Name.Contains(search) || e.User.Surname.Contains(search))) ||
                    (e.Location != null && e.Location.Contains(search)));
            }

            var extensions = await query
                .OrderBy(e => e.ExtensionNumber)
                .Select(e => new ExtensionDto
                {
                    ExtensionId = e.ExtensionId,
                    ExtensionNumber = e.ExtensionNumber,
                    Label = e.Label,
                    ExtensionType = e.ExtensionType,
                    Description = e.Description,
                    UserId = e.UserId,
                    UserName = e.User != null ? $"{e.User.Name} {e.User.Surname}" : null,
                    DepartmentId = e.DepartmentId,
                    DepartmentName = e.Department != null ? e.Department.Name : null,
                    PbxDeviceId = e.PbxDeviceId,
                    MacAddress = e.MacAddress,
                    PhoneModel = e.PhoneModel,
                    Location = e.Location,
                    IsActive = e.IsActive,
                    IsPrimary = e.IsPrimary,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt
                })
                .ToListAsync();

            return Ok(extensions);
        }

        // GET: api/extensions/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ExtensionDto>> GetExtension(int id)
        {
            var extension = await _context.Extensions
                .Include(e => e.User)
                .Include(e => e.Department)
                .Where(e => e.ExtensionId == id)
                .Select(e => new ExtensionDto
                {
                    ExtensionId = e.ExtensionId,
                    ExtensionNumber = e.ExtensionNumber,
                    Label = e.Label,
                    ExtensionType = e.ExtensionType,
                    Description = e.Description,
                    UserId = e.UserId,
                    UserName = e.User != null ? $"{e.User.Name} {e.User.Surname}" : null,
                    DepartmentId = e.DepartmentId,
                    DepartmentName = e.Department != null ? e.Department.Name : null,
                    PbxDeviceId = e.PbxDeviceId,
                    MacAddress = e.MacAddress,
                    PhoneModel = e.PhoneModel,
                    Location = e.Location,
                    IsActive = e.IsActive,
                    IsPrimary = e.IsPrimary,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt
                })
                .FirstOrDefaultAsync();

            if (extension == null)
            {
                return NotFound(new { message = "Extension not found" });
            }

            return Ok(extension);
        }

        // GET: api/extensions/user/5
        [HttpGet("user/{userId}")]
        public async Task<ActionResult<IEnumerable<ExtensionDto>>> GetUserExtensions(int userId)
        {
            var extensions = await _context.Extensions
                .Include(e => e.Department)
                .Where(e => e.UserId == userId)
                .OrderByDescending(e => e.IsPrimary)
                .ThenBy(e => e.ExtensionNumber)
                .Select(e => new ExtensionDto
                {
                    ExtensionId = e.ExtensionId,
                    ExtensionNumber = e.ExtensionNumber,
                    Label = e.Label,
                    ExtensionType = e.ExtensionType,
                    Description = e.Description,
                    UserId = e.UserId,
                    UserName = null,
                    DepartmentId = e.DepartmentId,
                    DepartmentName = e.Department != null ? e.Department.Name : null,
                    PbxDeviceId = e.PbxDeviceId,
                    MacAddress = e.MacAddress,
                    PhoneModel = e.PhoneModel,
                    Location = e.Location,
                    IsActive = e.IsActive,
                    IsPrimary = e.IsPrimary,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt
                })
                .ToListAsync();

            return Ok(extensions);
        }

        // GET: api/extensions/department/5
        [HttpGet("department/{departmentId}")]
        public async Task<ActionResult<IEnumerable<ExtensionDto>>> GetDepartmentExtensions(int departmentId)
        {
            var extensions = await _context.Extensions
                .Include(e => e.User)
                .Where(e => e.DepartmentId == departmentId)
                .OrderBy(e => e.ExtensionNumber)
                .Select(e => new ExtensionDto
                {
                    ExtensionId = e.ExtensionId,
                    ExtensionNumber = e.ExtensionNumber,
                    Label = e.Label,
                    ExtensionType = e.ExtensionType,
                    Description = e.Description,
                    UserId = e.UserId,
                    UserName = e.User != null ? $"{e.User.Name} {e.User.Surname}" : null,
                    DepartmentId = e.DepartmentId,
                    DepartmentName = null,
                    PbxDeviceId = e.PbxDeviceId,
                    MacAddress = e.MacAddress,
                    PhoneModel = e.PhoneModel,
                    Location = e.Location,
                    IsActive = e.IsActive,
                    IsPrimary = e.IsPrimary,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt
                })
                .ToListAsync();

            return Ok(extensions);
        }

        // POST: api/extensions
        [HttpPost]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<ExtensionDto>> CreateExtension(CreateExtensionDto dto)
        {
            // Check if extension number already exists
            if (await _context.Extensions.AnyAsync(e => e.ExtensionNumber == dto.ExtensionNumber))
            {
                return BadRequest(new { message = "Extension number already exists" });
            }

            // Validate user exists if provided
            if (dto.UserId.HasValue)
            {
                var userExists = await _context.Users.AnyAsync(u => u.UserId == dto.UserId);
                if (!userExists)
                {
                    return BadRequest(new { message = "User not found" });
                }

                // If setting as primary, unset other primary extensions for this user
                if (dto.IsPrimary)
                {
                    var existingPrimary = await _context.Extensions
                        .Where(e => e.UserId == dto.UserId && e.IsPrimary)
                        .ToListAsync();
                    foreach (var ext in existingPrimary)
                    {
                        ext.IsPrimary = false;
                    }
                }
            }

            // Validate department exists if provided
            if (dto.DepartmentId.HasValue)
            {
                var deptExists = await _context.Departments.AnyAsync(d => d.DepartmentId == dto.DepartmentId);
                if (!deptExists)
                {
                    return BadRequest(new { message = "Department not found" });
                }
            }

            var extension = new Extension
            {
                ExtensionNumber = dto.ExtensionNumber,
                Label = dto.Label,
                ExtensionType = dto.ExtensionType,
                Description = dto.Description,
                UserId = dto.UserId,
                DepartmentId = dto.DepartmentId,
                PbxDeviceId = dto.PbxDeviceId,
                MacAddress = dto.MacAddress,
                PhoneModel = dto.PhoneModel,
                Location = dto.Location,
                IsPrimary = dto.IsPrimary,
                CreatedAt = DateTime.UtcNow
            };

            _context.Extensions.Add(extension);
            await _context.SaveChangesAsync();

            // Reload with includes
            await _context.Entry(extension)
                .Reference(e => e.User)
                .LoadAsync();
            await _context.Entry(extension)
                .Reference(e => e.Department)
                .LoadAsync();

            return CreatedAtAction(nameof(GetExtension), new { id = extension.ExtensionId }, new ExtensionDto
            {
                ExtensionId = extension.ExtensionId,
                ExtensionNumber = extension.ExtensionNumber,
                Label = extension.Label,
                ExtensionType = extension.ExtensionType,
                Description = extension.Description,
                UserId = extension.UserId,
                UserName = extension.User != null ? $"{extension.User.Name} {extension.User.Surname}" : null,
                DepartmentId = extension.DepartmentId,
                DepartmentName = extension.Department?.Name,
                PbxDeviceId = extension.PbxDeviceId,
                MacAddress = extension.MacAddress,
                PhoneModel = extension.PhoneModel,
                Location = extension.Location,
                IsActive = extension.IsActive,
                IsPrimary = extension.IsPrimary,
                CreatedAt = extension.CreatedAt,
                UpdatedAt = extension.UpdatedAt
            });
        }

        // PUT: api/extensions/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> UpdateExtension(int id, UpdateExtensionDto dto)
        {
            var extension = await _context.Extensions.FindAsync(id);
            if (extension == null)
            {
                return NotFound(new { message = "Extension not found" });
            }

            // Check if new extension number already exists
            if (!string.IsNullOrEmpty(dto.ExtensionNumber) && dto.ExtensionNumber != extension.ExtensionNumber)
            {
                if (await _context.Extensions.AnyAsync(e => e.ExtensionNumber == dto.ExtensionNumber && e.ExtensionId != id))
                {
                    return BadRequest(new { message = "Extension number already exists" });
                }
                extension.ExtensionNumber = dto.ExtensionNumber;
            }

            // Validate user if changing
            if (dto.UserId.HasValue && dto.UserId != extension.UserId)
            {
                var userExists = await _context.Users.AnyAsync(u => u.UserId == dto.UserId);
                if (!userExists)
                {
                    return BadRequest(new { message = "User not found" });
                }
                extension.UserId = dto.UserId;
            }
            else if (dto.UserId == null && extension.UserId != null)
            {
                // Explicitly setting to null (unassign)
                extension.UserId = null;
                extension.IsPrimary = false;
            }

            // Validate department if changing
            if (dto.DepartmentId.HasValue && dto.DepartmentId != extension.DepartmentId)
            {
                var deptExists = await _context.Departments.AnyAsync(d => d.DepartmentId == dto.DepartmentId);
                if (!deptExists)
                {
                    return BadRequest(new { message = "Department not found" });
                }
                extension.DepartmentId = dto.DepartmentId;
            }
            else if (dto.DepartmentId == null && extension.DepartmentId != null)
            {
                extension.DepartmentId = null;
            }

            // Handle primary flag
            if (dto.IsPrimary.HasValue && dto.IsPrimary.Value && extension.UserId.HasValue)
            {
                // Unset other primary extensions for this user
                var existingPrimary = await _context.Extensions
                    .Where(e => e.UserId == extension.UserId && e.IsPrimary && e.ExtensionId != id)
                    .ToListAsync();
                foreach (var ext in existingPrimary)
                {
                    ext.IsPrimary = false;
                }
                extension.IsPrimary = true;
            }
            else if (dto.IsPrimary.HasValue)
            {
                extension.IsPrimary = dto.IsPrimary.Value;
            }

            // Update other fields
            if (dto.Label != null) extension.Label = dto.Label;
            if (dto.ExtensionType != null) extension.ExtensionType = dto.ExtensionType;
            if (dto.Description != null) extension.Description = dto.Description;
            if (dto.PbxDeviceId != null) extension.PbxDeviceId = dto.PbxDeviceId;
            if (dto.MacAddress != null) extension.MacAddress = dto.MacAddress;
            if (dto.PhoneModel != null) extension.PhoneModel = dto.PhoneModel;
            if (dto.Location != null) extension.Location = dto.Location;
            if (dto.IsActive.HasValue) extension.IsActive = dto.IsActive.Value;

            extension.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/extensions/5/assign
        [HttpPost("{id}/assign")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> AssignExtension(int id, AssignExtensionDto dto)
        {
            var extension = await _context.Extensions.FindAsync(id);
            if (extension == null)
            {
                return NotFound(new { message = "Extension not found" });
            }

            if (dto.UserId.HasValue)
            {
                var userExists = await _context.Users.AnyAsync(u => u.UserId == dto.UserId);
                if (!userExists)
                {
                    return BadRequest(new { message = "User not found" });
                }

                // If setting as primary, unset other primary extensions for this user
                if (dto.IsPrimary)
                {
                    var existingPrimary = await _context.Extensions
                        .Where(e => e.UserId == dto.UserId && e.IsPrimary)
                        .ToListAsync();
                    foreach (var ext in existingPrimary)
                    {
                        ext.IsPrimary = false;
                    }
                }

                extension.UserId = dto.UserId;
                extension.IsPrimary = dto.IsPrimary;
            }
            else
            {
                // Unassign
                extension.UserId = null;
                extension.IsPrimary = false;
            }

            extension.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = dto.UserId.HasValue ? "Extension assigned successfully" : "Extension unassigned successfully" });
        }

        // DELETE: api/extensions/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteExtension(int id)
        {
            var extension = await _context.Extensions.FindAsync(id);
            if (extension == null)
            {
                return NotFound(new { message = "Extension not found" });
            }

            _context.Extensions.Remove(extension);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Extension deleted successfully" });
        }

        // GET: api/extensions/search?q=123
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<ExtensionSummaryDto>>> SearchExtensions([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return Ok(new List<ExtensionSummaryDto>());
            }

            var extensions = await _context.Extensions
                .Include(e => e.User)
                .Where(e => e.IsActive &&
                    (e.ExtensionNumber.Contains(q) ||
                     (e.User != null && (e.User.Name.Contains(q) || e.User.Surname.Contains(q)))))
                .OrderBy(e => e.ExtensionNumber)
                .Take(20)
                .Select(e => new ExtensionSummaryDto
                {
                    ExtensionId = e.ExtensionId,
                    ExtensionNumber = e.ExtensionNumber,
                    Label = e.User != null ? $"{e.User.Name} {e.User.Surname}" : e.Label,
                    ExtensionType = e.ExtensionType,
                    IsPrimary = e.IsPrimary
                })
                .ToListAsync();

            return Ok(extensions);
        }
    }
}
