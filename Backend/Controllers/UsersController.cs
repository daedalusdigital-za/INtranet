using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<UsersController> _logger;

        public UsersController(ApplicationDbContext context, ILogger<UsersController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserListDto>>> GetUsers()
        {
            var users = await _context.Users
                .Include(u => u.Department)
                .OrderBy(u => u.Surname)
                .ThenBy(u => u.Name)
                .Select(u => new UserListDto
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
                    HasProfilePicture = u.ProfilePictureData != null
                })
                .ToListAsync();

            return Ok(users);
        }

        // GET: api/users/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<UserDetailDto>> GetUser(int id)
        {
            var user = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.UserId == id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

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
                HasProfilePicture = user.ProfilePictureData != null
            });
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
                IsActive = dto.IsActive ?? true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _logger.LogInformation("User created: {Email} by admin", dto.Email);

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

            if (dto.IsActive.HasValue)
                user.IsActive = dto.IsActive.Value;

            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("User updated: {UserId} ({Email})", id, user.Email);

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
}
