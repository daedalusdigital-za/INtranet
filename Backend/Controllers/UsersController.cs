using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.CRM;
using ProjectTracker.API.DTOs.Users;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<UsersController> _logger;
        private readonly IAuditLogService _auditLogService;

        public UsersController(ApplicationDbContext context, ILogger<UsersController> logger, IAuditLogService auditLogService)
        {
            _context = context;
            _logger = logger;
            _auditLogService = auditLogService;
        }

        // GET: api/users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserListDto>>> GetUsers()
        {
            var users = await _context.Users
                .Include(u => u.Department)
                .Include(u => u.LinkedEmployee)
                .OrderBy(u => u.Surname)
                .ThenBy(u => u.Name)
                .ToListAsync();

            // Get all company assignments
            var allCompanyAssignments = await _context.Set<StaffOperatingCompany>()
                .Where(soc => soc.IsActive)
                .ToListAsync();

            var result = users.Select(u => new UserListDto
            {
                UserId = u.UserId,
                Name = u.Name,
                Surname = u.Surname,
                Email = u.Email,
                Role = u.Role,
                Title = u.Title,
                DepartmentId = u.DepartmentId,
                DepartmentName = u.Department != null ? u.Department.Name : null,
                IsActive = u.IsActive,
                LastLoginAt = u.LastLoginAt,
                CreatedAt = u.CreatedAt,
                Permissions = u.Permissions,
                HasProfilePicture = u.ProfilePictureData != null,
                CompanyIds = allCompanyAssignments
                    .Where(soc => soc.StaffMemberId == u.UserId)
                    .Select(soc => soc.OperatingCompanyId)
                    .ToList(),
                LinkedEmpId = u.LinkedEmpId,
                LinkedEmployeeName = u.LinkedEmployee != null ? $"{u.LinkedEmployee.Name} {u.LinkedEmployee.LastName}" : null,
                Birthday = u.Birthday
            }).ToList();

            return Ok(result);
        }

        // GET: api/users/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<UserDetailDto>> GetUser(int id)
        {
            var user = await _context.Users
                .Include(u => u.Department)
                .Include(u => u.LinkedEmployee)
                .FirstOrDefaultAsync(u => u.UserId == id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var companyIds = await _context.Set<StaffOperatingCompany>()
                .Where(soc => soc.StaffMemberId == id && soc.IsActive)
                .Select(soc => soc.OperatingCompanyId)
                .ToListAsync();

            return Ok(new UserDetailDto
            {
                UserId = user.UserId,
                Name = user.Name,
                Surname = user.Surname,
                Email = user.Email,
                Role = user.Role,
                Title = user.Title,
                Permissions = user.Permissions,
                DepartmentId = user.DepartmentId,
                DepartmentName = user.Department?.Name,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt,
                ProfilePictureUrl = user.ProfilePictureUrl,
                HasProfilePicture = user.ProfilePictureData != null,
                CompanyIds = companyIds,
                LinkedEmpId = user.LinkedEmpId,
                LinkedEmployeeName = user.LinkedEmployee != null ? $"{user.LinkedEmployee.Name} {user.LinkedEmployee.LastName}" : null,
                Birthday = user.Birthday
            });
        }

        // GET: api/users/clockin-employees
        [HttpGet("clockin-employees")]
        public async Task<ActionResult<IEnumerable<ClockInEmployeeDto>>> GetClockInEmployees()
        {
            var employees = await _context.EmpRegistrations
                .OrderBy(e => e.Name)
                .ThenBy(e => e.LastName)
                .Select(e => new ClockInEmployeeDto
                {
                    EmpId = e.EmpId,
                    Name = e.Name ?? "",
                    LastName = e.LastName ?? "",
                    Department = e.Department,
                    JobTitle = e.JobTitle,
                    IdNum = e.IdNum
                })
                .ToListAsync();

            return Ok(employees);
        }

        // GET: api/users/birthdays
        [HttpGet("birthdays")]
        public async Task<ActionResult<IEnumerable<UserBirthdayDto>>> GetBirthdays([FromQuery] int? month, [FromQuery] int? year)
        {
            var query = _context.Users
                .Include(u => u.Department)
                .Where(u => u.IsActive && u.Birthday.HasValue);

            // If month is specified, filter by month (for calendar view)
            if (month.HasValue)
            {
                query = query.Where(u => u.Birthday!.Value.Month == month.Value);
            }

            var users = await query
                .OrderBy(u => u.Birthday!.Value.Month)
                .ThenBy(u => u.Birthday!.Value.Day)
                .Select(u => new UserBirthdayDto
                {
                    UserId = u.UserId,
                    Name = u.Name,
                    Surname = u.Surname,
                    Birthday = u.Birthday!.Value,
                    DepartmentName = u.Department != null ? u.Department.Name : null,
                    ProfilePictureUrl = u.ProfilePictureUrl
                })
                .ToListAsync();

            return Ok(users);
        }

        // POST: api/users
        [HttpPost]
        public async Task<ActionResult<UserDetailDto>> CreateUser([FromBody] CreateUserDto dto)
        {
            // Check if email already exists
            if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            {
                return BadRequest(new { message = "A user with this email already exists" });
            }

            var user = new User
            {
                Name = dto.Name,
                Surname = dto.Surname,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = dto.Role ?? "Employee",
                Title = dto.Title,
                Permissions = dto.Permissions,
                DepartmentId = dto.DepartmentId,
                LinkedEmpId = dto.LinkedEmpId,
                Birthday = dto.Birthday,
                IsActive = dto.IsActive ?? true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Add company assignments
            if (dto.CompanyIds != null && dto.CompanyIds.Any())
            {
                foreach (var companyId in dto.CompanyIds)
                {
                    _context.Set<StaffOperatingCompany>().Add(new StaffOperatingCompany
                    {
                        StaffMemberId = user.UserId,
                        OperatingCompanyId = companyId,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("User created: {Email} by admin", dto.Email);

            // Audit log
            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync("User Created", "user", "User", user.UserId, 
                $"Created user: {user.Name} {user.Surname} ({user.Email}) with role {user.Role}");

            return CreatedAtAction(nameof(GetUser), new { id = user.UserId }, new UserDetailDto
            {
                UserId = user.UserId,
                Name = user.Name,
                Surname = user.Surname,
                Email = user.Email,
                Role = user.Role,
                Title = user.Title,
                Permissions = user.Permissions,
                DepartmentId = user.DepartmentId,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt
            });
        }

        // PUT: api/users/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Check if email is being changed and if new email already exists
            if (!string.IsNullOrEmpty(dto.Email) && dto.Email != user.Email)
            {
                if (await _context.Users.AnyAsync(u => u.Email == dto.Email && u.UserId != id))
                {
                    return BadRequest(new { message = "A user with this email already exists" });
                }
                user.Email = dto.Email;
            }

            if (!string.IsNullOrEmpty(dto.Name))
                user.Name = dto.Name;

            if (!string.IsNullOrEmpty(dto.Surname))
                user.Surname = dto.Surname;

            if (!string.IsNullOrEmpty(dto.Role))
                user.Role = dto.Role;

            if (dto.Title != null)
                user.Title = dto.Title;

            if (dto.Permissions != null)
                user.Permissions = dto.Permissions;

            if (dto.DepartmentId.HasValue)
                user.DepartmentId = dto.DepartmentId.Value == 0 ? null : dto.DepartmentId;

            if (dto.LinkedEmpId != null)
                user.LinkedEmpId = string.IsNullOrEmpty(dto.LinkedEmpId) ? null : dto.LinkedEmpId;

            if (dto.IsActive.HasValue)
                user.IsActive = dto.IsActive.Value;

            if (dto.Birthday.HasValue)
                user.Birthday = dto.Birthday.Value;

            // Update company assignments
            if (dto.CompanyIds != null)
            {
                // Remove existing assignments
                var existingAssignments = await _context.Set<StaffOperatingCompany>()
                    .Where(soc => soc.StaffMemberId == id)
                    .ToListAsync();
                _context.Set<StaffOperatingCompany>().RemoveRange(existingAssignments);

                // Add new assignments
                foreach (var companyId in dto.CompanyIds)
                {
                    _context.Set<StaffOperatingCompany>().Add(new StaffOperatingCompany
                    {
                        StaffMemberId = id,
                        OperatingCompanyId = companyId,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("User updated: {UserId} ({Email})", id, user.Email);

            // Audit log
            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync("User Updated", "user", "User", id, 
                $"Updated user: {user.Name} {user.Surname} ({user.Email})");

            return Ok(new { message = "User updated successfully" });
        }

        // DELETE: api/users/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Soft delete - just mark as inactive
            // user.IsActive = false;
            // await _context.SaveChangesAsync();

            // Hard delete
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            _logger.LogInformation("User deleted: {UserId} ({Email})", id, user.Email);

            // Audit log
            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync("User Deleted", "user", "User", id, 
                $"Deleted user: {user.Name} {user.Surname} ({user.Email})", null, "warning");

            return Ok(new { message = "User deleted successfully" });
        }

        // POST: api/users/{id}/reset-password
        [HttpPost("{id}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDto dto)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Password reset for user: {UserId} ({Email})", id, user.Email);

            // Audit log
            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync("Password Reset", "security", "User", id, 
                $"Password reset for user: {user.Name} {user.Surname} ({user.Email})");

            return Ok(new { message = "Password reset successfully" });
        }

        // POST: api/users/{id}/toggle-active
        [HttpPost("{id}/toggle-active")]
        public async Task<IActionResult> ToggleActive(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            user.IsActive = !user.IsActive;
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} active status toggled to: {IsActive}", id, user.IsActive);

            return Ok(new { message = $"User {(user.IsActive ? "activated" : "deactivated")} successfully", isActive = user.IsActive });
        }

        // GET: api/users/roles
        [HttpGet("roles")]
        public ActionResult<IEnumerable<string>> GetRoles()
        {
            var roles = new[] { "Admin", "Manager", "Employee", "HR", "IT Support" };
            return Ok(roles);
        }

        // GET: api/users/permissions
        [HttpGet("permissions")]
        public ActionResult<IEnumerable<PermissionDto>> GetPermissions()
        {
            var permissions = new[]
            {
                new PermissionDto { Key = "users.view", Name = "View Users", Category = "Users" },
                new PermissionDto { Key = "users.create", Name = "Create Users", Category = "Users" },
                new PermissionDto { Key = "users.edit", Name = "Edit Users", Category = "Users" },
                new PermissionDto { Key = "users.delete", Name = "Delete Users", Category = "Users" },
                new PermissionDto { Key = "users.reset-password", Name = "Reset Passwords", Category = "Users" },
                new PermissionDto { Key = "boards.view", Name = "View Boards", Category = "Boards" },
                new PermissionDto { Key = "boards.create", Name = "Create Boards", Category = "Boards" },
                new PermissionDto { Key = "boards.edit", Name = "Edit Boards", Category = "Boards" },
                new PermissionDto { Key = "boards.delete", Name = "Delete Boards", Category = "Boards" },
                new PermissionDto { Key = "attendance.view", Name = "View Attendance", Category = "Attendance" },
                new PermissionDto { Key = "attendance.manage", Name = "Manage Attendance", Category = "Attendance" },
                new PermissionDto { Key = "reports.view", Name = "View Reports", Category = "Reports" },
                new PermissionDto { Key = "reports.export", Name = "Export Reports", Category = "Reports" },
                new PermissionDto { Key = "documents.view", Name = "View Documents", Category = "Documents" },
                new PermissionDto { Key = "documents.upload", Name = "Upload Documents", Category = "Documents" },
                new PermissionDto { Key = "documents.delete", Name = "Delete Documents", Category = "Documents" },
                new PermissionDto { Key = "messages.send", Name = "Send Messages", Category = "Messages" },
                new PermissionDto { Key = "kb.manage", Name = "Manage Knowledge Base", Category = "Knowledge Base" },
                new PermissionDto { Key = "support.manage", Name = "Manage Support Tickets", Category = "Support" }
            };
            return Ok(permissions);
        }
    }

    // DTOs
    public class UserListDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Surname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Title { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public bool IsActive { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? Permissions { get; set; }
        public bool HasProfilePicture { get; set; }
        public List<int>? CompanyIds { get; set; }
        public string? LinkedEmpId { get; set; }
        public string? LinkedEmployeeName { get; set; }
        public DateTime? Birthday { get; set; }
    }

    public class UserDetailDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Surname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Permissions { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public bool IsActive { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public bool HasProfilePicture { get; set; }
        public List<int>? CompanyIds { get; set; }
        public string? LinkedEmpId { get; set; }
        public string? LinkedEmployeeName { get; set; }
        public DateTime? Birthday { get; set; }
    }

    public class CreateUserDto
    {
        public string Name { get; set; } = string.Empty;
        public string Surname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? Role { get; set; }
        public string? Title { get; set; }
        public string? Permissions { get; set; }
        public int? DepartmentId { get; set; }
        public bool? IsActive { get; set; }
        public List<int>? CompanyIds { get; set; }
        public string? LinkedEmpId { get; set; }
        public DateTime? Birthday { get; set; }
    }

    public class UpdateUserDto
    {
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
        public string? Title { get; set; }
        public string? Permissions { get; set; }
        public int? DepartmentId { get; set; }
        public bool? IsActive { get; set; }
        public List<int>? CompanyIds { get; set; }
        public string? LinkedEmpId { get; set; }
        public DateTime? Birthday { get; set; }
    }

    public class ResetPasswordDto
    {
        public string NewPassword { get; set; } = string.Empty;
    }

    public class PermissionDto
    {
        public string Key { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
    }

    public class ClockInEmployeeDto
    {
        public string EmpId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? Department { get; set; }
        public string? JobTitle { get; set; }
        public string? IdNum { get; set; }
        public string FullName => $"{Name} {LastName}".Trim();
    }

    public class UserBirthdayDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Surname { get; set; }
        public DateTime Birthday { get; set; }
        public string? DepartmentName { get; set; }
        public string? ProfilePictureUrl { get; set; }
    }
}
