using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.DTOs.Users;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
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
                .AsNoTracking()
                .Include(u => u.Department)
                .Include(u => u.LinkedEmployee)
                .Include(u => u.Extensions)
                .OrderBy(u => u.Surname)
                .ThenBy(u => u.Name)
                .ToListAsync();

            // Get all company assignments
            var allCompanyAssignments = await _context.Set<StaffOperatingCompany>()
                .AsNoTracking()
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
                Birthday = u.Birthday,
                PrimaryExtension = u.Extensions.FirstOrDefault(e => e.IsPrimary && e.IsActive)?.ExtensionNumber 
                    ?? u.Extensions.FirstOrDefault(e => e.IsActive)?.ExtensionNumber,
                ExtensionNumber = u.Extensions.FirstOrDefault(e => e.IsPrimary && e.IsActive)?.ExtensionNumber 
                    ?? u.Extensions.FirstOrDefault(e => e.IsActive)?.ExtensionNumber
            }).ToList();

            return Ok(result);
        }

        // GET: api/users/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<UserDetailDto>> GetUser(int id)
        {
            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.Department)
                .Include(u => u.LinkedEmployee)
                .Include(u => u.Extensions)
                .FirstOrDefaultAsync(u => u.UserId == id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var companyIds = await _context.Set<StaffOperatingCompany>()
                .AsNoTracking()
                .Where(soc => soc.StaffMemberId == id && soc.IsActive)
                .Select(soc => soc.OperatingCompanyId)
                .ToListAsync();

            var extensions = user.Extensions
                .Where(e => e.IsActive)
                .OrderByDescending(e => e.IsPrimary)
                .ThenBy(e => e.ExtensionNumber)
                .Select(e => new ExtensionSummaryDto
                {
                    ExtensionId = e.ExtensionId,
                    ExtensionNumber = e.ExtensionNumber,
                    Label = e.Label,
                    ExtensionType = e.ExtensionType,
                    IsPrimary = e.IsPrimary
                }).ToList();

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
                Birthday = user.Birthday,
                PrimaryExtension = extensions.FirstOrDefault(e => e.IsPrimary)?.ExtensionNumber 
                    ?? extensions.FirstOrDefault()?.ExtensionNumber,
                Extensions = extensions
            });
        }

        // GET: api/users/clockin-employees
        [HttpGet("clockin-employees")]
        public async Task<ActionResult<IEnumerable<ClockInEmployeeDto>>> GetClockInEmployees()
        {
            var employees = await _context.EmpRegistrations
                .AsNoTracking()
                .OrderBy(e => e.Name)
                .ThenBy(e => e.LastName)
                .Select(e => new ClockInEmployeeDto
                {
                    EmpId = e.EmpId,
                    Name = e.Name ?? "",
                    LastName = e.LastName ?? "",
                    Department = e.Department,
                    JobTitle = e.JobTitle,
                    IdNum = e.IdNum,
                    Address = e.Address,
                    MobileNo = e.MobileNo,
                    HasPhoto = e.Photo != null
                })
                .ToListAsync();

            return Ok(employees);
        }

        // GET: api/users/clockin-employees/{empId}
        [HttpGet("clockin-employees/{empId}")]
        public async Task<ActionResult<ClockInEmployeeDto>> GetClockInEmployee(string empId)
        {
            var e = await _context.EmpRegistrations.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EmpId == empId);
            if (e == null) return NotFound(new { message = "Clock-in employee not found" });

            return Ok(new ClockInEmployeeDto
            {
                EmpId = e.EmpId,
                Name = e.Name ?? "",
                LastName = e.LastName ?? "",
                Department = e.Department,
                JobTitle = e.JobTitle,
                IdNum = e.IdNum,
                Address = e.Address,
                MobileNo = e.MobileNo,
                HasPhoto = e.Photo != null
            });
        }

        // GET: api/users/clockin-employees/{empId}/photo
        // Serves the biometric clock-in machine photo for an employee.
        [HttpGet("clockin-employees/{empId}/photo")]
        [AllowAnonymous]
        public async Task<IActionResult> GetClockInEmployeePhoto(string empId)
        {
            var e = await _context.EmpRegistrations.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EmpId == empId);
            if (e?.Photo == null || e.Photo.Length == 0)
                return NotFound();

            // Biometric machines store the face capture as a JPEG blob.
            return File(e.Photo, "image/jpeg");
        }
        [HttpPost("clockin-employees")]
        public async Task<ActionResult<ClockInEmployeeDto>> CreateClockInEmployee([FromBody] ClockInEmployeeRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name) && string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { message = "A name is required" });

            var empId = string.IsNullOrWhiteSpace(request.EmpId)
                ? await GenerateNextEmpIdAsync()
                : request.EmpId.Trim();

            if (await _context.EmpRegistrations.AnyAsync(x => x.EmpId == empId))
                return Conflict(new { message = $"Employee ID '{empId}' already exists" });

            var entity = new EmpRegistration
            {
                EmpId = empId,
                Name = request.Name?.Trim(),
                LastName = request.LastName?.Trim(),
                IdNum = request.IdNum?.Trim(),
                Department = request.Department?.Trim(),
                JobTitle = request.JobTitle?.Trim(),
                Address = request.Address?.Trim(),
                MobileNo = request.MobileNo?.Trim(),
                Date = DateTime.UtcNow
            };

            _context.EmpRegistrations.Add(entity);
            await _context.SaveChangesAsync();

            return Ok(new ClockInEmployeeDto
            {
                EmpId = entity.EmpId,
                Name = entity.Name ?? "",
                LastName = entity.LastName ?? "",
                Department = entity.Department,
                JobTitle = entity.JobTitle,
                IdNum = entity.IdNum,
                Address = entity.Address,
                MobileNo = entity.MobileNo
            });
        }

        // PUT: api/users/clockin-employees/{empId}
        [HttpPut("clockin-employees/{empId}")]
        public async Task<ActionResult<ClockInEmployeeDto>> UpdateClockInEmployee(string empId, [FromBody] ClockInEmployeeRequest request)
        {
            var entity = await _context.EmpRegistrations.FirstOrDefaultAsync(x => x.EmpId == empId);
            if (entity == null) return NotFound(new { message = "Clock-in employee not found" });

            entity.Name = request.Name?.Trim();
            entity.LastName = request.LastName?.Trim();
            entity.IdNum = request.IdNum?.Trim();
            entity.Department = request.Department?.Trim();
            entity.JobTitle = request.JobTitle?.Trim();
            entity.Address = request.Address?.Trim();
            entity.MobileNo = request.MobileNo?.Trim();

            await _context.SaveChangesAsync();

            return Ok(new ClockInEmployeeDto
            {
                EmpId = entity.EmpId,
                Name = entity.Name ?? "",
                LastName = entity.LastName ?? "",
                Department = entity.Department,
                JobTitle = entity.JobTitle,
                IdNum = entity.IdNum,
                Address = entity.Address,
                MobileNo = entity.MobileNo
            });
        }

        // DELETE: api/users/clockin-employees/{empId}
        [HttpDelete("clockin-employees/{empId}")]
        public async Task<IActionResult> DeleteClockInEmployee(string empId)
        {
            var entity = await _context.EmpRegistrations.FirstOrDefaultAsync(x => x.EmpId == empId);
            if (entity == null) return NotFound(new { message = "Clock-in employee not found" });

            var hasAttendance = await _context.AttendanceRecords.AnyAsync(a => a.EmpID == empId);
            if (hasAttendance)
                return BadRequest(new { message = "Cannot delete: this employee has attendance records. Consider keeping them for history." });

            _context.EmpRegistrations.Remove(entity);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Clock-in employee deleted" });
        }

        // Generates the next numeric employee id (max existing numeric + 1)
        private async Task<string> GenerateNextEmpIdAsync()
        {
            var ids = await _context.EmpRegistrations
                .Select(e => e.EmpId)
                .ToListAsync();

            int max = 0;
            foreach (var id in ids)
            {
                if (int.TryParse(id, out var n) && n > max) max = n;
            }
            return (max + 1).ToString();
        }

        // GET: api/users/birthdays
        [HttpGet("birthdays")]
        public async Task<ActionResult<IEnumerable<UserBirthdayDto>>> GetBirthdays([FromQuery] int? month, [FromQuery] int? year)
        {
            var query = _context.Users
                .AsNoTracking()
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

        // GET: api/users/module-permissions
        [HttpGet("module-permissions")]
        public ActionResult<IEnumerable<ModulePermissionDto>> GetModulePermissions()
        {
            var permissions = new List<ModulePermissionDto>
            {
                new ModulePermissionDto { Key = "sales", Name = "Sales", Icon = "point_of_sale", Description = "Access to Sales dashboard and invoice management" },
                new ModulePermissionDto { Key = "logistics", Name = "Logistics", Icon = "local_shipping", Description = "Access to delivery routes, tripsheets, and driver management" },
                new ModulePermissionDto { Key = "tenders", Name = "Tenders", Icon = "gavel", Description = "Access to tender management, compliance vault, and analytics" },
                new ModulePermissionDto { Key = "project_management", Name = "Project Management", Icon = "business", Description = "Access to Departments, project boards, and task management" },
                new ModulePermissionDto { Key = "human_resource", Name = "Human Resource", Icon = "people", Description = "Access to employee management, attendance, and HR functions" },
                new ModulePermissionDto { Key = "stock_management", Name = "Stock Management", Icon = "inventory", Description = "Access to inventory, stock levels, and warehouse management" },
                new ModulePermissionDto { Key = "company_projects", Name = "Company Projects", Icon = "workspaces", Description = "Access to School Delivery and company project dashboards" },
                new ModulePermissionDto { Key = "finance", Name = "Finance", Icon = "account_balance", Description = "Access to requisitions, payments, invoices, and financial reports" },
                new ModulePermissionDto { Key = "management", Name = "Management", Icon = "insights", Description = "Executive oversight across sales, tenders, logistics, finance, and approvals" },
                new ModulePermissionDto { Key = "documents", Name = "Documents", Icon = "folder", Description = "Access to document management and file storage" },
                new ModulePermissionDto { Key = "support_tickets", Name = "Support Tickets", Icon = "support_agent", Description = "Access to support ticket system" },
                new ModulePermissionDto { Key = "messaging", Name = "Messaging", Icon = "mail", Description = "Access to internal messaging system" },
                new ModulePermissionDto { Key = "calendar", Name = "Calendar", Icon = "calendar_month", Description = "Access to meetings, events, and scheduling" },
                new ModulePermissionDto { Key = "ai", Name = "AI Assistant", Icon = "smart_toy", Description = "Access to AI chat assistant" }
            };

            return Ok(permissions);
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
                Permissions = dto.Permissions != null ? string.Join(',', dto.Permissions) : null,
                DepartmentId = dto.DepartmentId.HasValue && dto.DepartmentId.Value > 0 ? dto.DepartmentId : null,
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

            // Link extension to user if provided
            if (dto.ExtensionId.HasValue)
            {
                var extension = await _context.Extensions.FindAsync(dto.ExtensionId.Value);
                if (extension != null)
                {
                    extension.UserId = user.UserId;
                    extension.IsPrimary = true;
                    extension.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
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
                user.Permissions = string.Join(',', dto.Permissions);

            if (dto.DepartmentId.HasValue)
                user.DepartmentId = dto.DepartmentId.Value == 0 ? null : dto.DepartmentId;

            if (dto.LinkedEmpId != null)
            {
                var newLink = string.IsNullOrEmpty(dto.LinkedEmpId) ? null : dto.LinkedEmpId;
                var linkChanged = newLink != user.LinkedEmpId;
                user.LinkedEmpId = newLink;

                // When newly linked, adopt the biometric machine photo if the user
                // doesn't already have a profile picture of their own.
                if (linkChanged && newLink != null && user.ProfilePictureData == null)
                {
                    await CopyClockInPhotoToUserAsync(user, newLink);
                }
            }

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

        // POST: api/users/{id}/use-clockin-photo
        // Copies the linked clock-in employee's biometric photo into the user's profile picture.
        [HttpPost("{id}/use-clockin-photo")]
        public async Task<IActionResult> UseClockInPhoto(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "User not found" });

            if (string.IsNullOrEmpty(user.LinkedEmpId))
                return BadRequest(new { message = "This user is not linked to a clock-in profile." });

            var copied = await CopyClockInPhotoToUserAsync(user, user.LinkedEmpId);
            if (!copied)
                return BadRequest(new { message = "The linked clock-in profile has no photo on the machine." });

            await _context.SaveChangesAsync();

            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync("User Photo From Clock-In", "user", "User", id,
                $"Set profile picture from clock-in profile {user.LinkedEmpId} for {user.Name} {user.Surname}");

            return Ok(new { message = "Profile picture updated from clock-in photo.", photoUrl = $"/api/profile/{id}/photo" });
        }

        // Copies the biometric photo of the given clock-in employee onto the user.
        // Returns true if a photo was found and applied. Does NOT call SaveChanges.
        private async Task<bool> CopyClockInPhotoToUserAsync(User user, string empId)
        {
            var emp = await _context.EmpRegistrations.AsNoTracking()
                .FirstOrDefaultAsync(x => x.EmpId == empId);
            if (emp?.Photo == null || emp.Photo.Length == 0)
                return false;

            user.ProfilePictureData = emp.Photo;
            user.ProfilePictureMimeType = "image/jpeg";
            user.UpdatedAt = DateTime.UtcNow;
            return true;
        }

        // DELETE: api/users/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id, [FromQuery] bool permanent = false)
        {
            var user = await _context.Users
                .Include(u => u.Extensions)
                .FirstOrDefaultAsync(u => u.UserId == id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var displayName = $"{user.Name} {user.Surname}".Trim();
            if (string.IsNullOrWhiteSpace(displayName)) displayName = user.Email;

            // Remove owned child records that would otherwise block deletion.
            if (user.Extensions != null && user.Extensions.Any())
                _context.Extensions.RemoveRange(user.Extensions);

            var companyAssignments = await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == id)
                .ToListAsync();
            if (companyAssignments.Any())
                _context.StaffOperatingCompanies.RemoveRange(companyAssignments);

            var refreshTokens = await _context.RefreshTokens
                .Where(rt => rt.UserId == id)
                .ToListAsync();
            if (refreshTokens.Any())
                _context.RefreshTokens.RemoveRange(refreshTokens);

            await _context.SaveChangesAsync();

            try
            {
                // Attempt a true hard delete first (works for users with no historical references).
                _context.ChangeTracker.Clear();
                var fresh = await _context.Users.FindAsync(id);
                if (fresh != null)
                {
                    _context.Users.Remove(fresh);
                    await _context.SaveChangesAsync();
                }

                _logger.LogInformation("User deleted: {UserId} ({Email})", id, user.Email);

                _auditLogService.SetHttpContext(HttpContext);
                await _auditLogService.LogAsync("User Deleted", "user", "User", id,
                    $"Deleted user: {displayName} ({user.Email})", null, "warning");

                return Ok(new { message = "User deleted successfully", mode = "deleted" });
            }
            catch (DbUpdateException)
            {
                _context.ChangeTracker.Clear();

                if (permanent)
                {
                    // FORCE / PERMANENT DELETE: the user is referenced by historical records.
                    // Generically detach every foreign key that points at the Users table —
                    // nulling nullable columns and deleting rows whose FK is required — then
                    // remove the user row for good. This is wrapped in a transaction so it is
                    // all-or-nothing.
                    try
                    {
                        await ForceDeleteUserAsync(id);

                        _logger.LogWarning("User PERMANENTLY deleted (force): {UserId}", id);
                        _auditLogService.SetHttpContext(HttpContext);
                        await _auditLogService.LogAsync("User Permanently Deleted", "user", "User", id,
                            $"Permanently deleted user {displayName} ({user.Email}) including linked references.",
                            null, "warning");

                        return Ok(new { message = "User permanently deleted (including linked records).", mode = "deleted" });
                    }
                    catch (Exception fex)
                    {
                        _logger.LogError(fex, "Force delete failed for user {UserId}", id);
                        return StatusCode(500, new { message = "Could not permanently delete this user: " + fex.Message, mode = "error" });
                    }
                }

                // The user is referenced by historical records (tasks, tenders, loads, audit logs,
                // invoices, etc.) that must be preserved for referential integrity. A hard delete is
                // not possible, so fall back to a soft delete: deactivate the account and anonymise
                // the email/name so it disappears from active use and the email address is freed.
                var target = await _context.Users.FindAsync(id);
                if (target == null)
                    return NotFound(new { message = "User not found" });

                var stamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
                target.IsActive = false;
                target.Email = $"deleted+{id}.{stamp}@deleted.local";
                target.PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"));
                target.LinkedEmpId = null;
                target.Permissions = null;
                target.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogWarning("User soft-deleted (referenced by historical records): {UserId}", id);

                _auditLogService.SetHttpContext(HttpContext);
                await _auditLogService.LogAsync("User Deleted (Deactivated)", "user", "User", id,
                    $"User {displayName} had linked records and was deactivated & anonymised instead of hard-deleted.",
                    null, "warning");

                return Ok(new
                {
                    message = "User had linked records (tasks, tenders, invoices, etc.) so was deactivated and anonymised instead of permanently deleted. Use \"Permanent delete\" to remove completely.",
                    mode = "deactivated"
                });
            }
        }

        // Generically removes every foreign-key reference to a user across the whole database,
        // then deletes the user row. Nullable FK columns are set to NULL (record kept, un-linked);
        // required FK columns cause the owning row to be deleted. Runs inside a single transaction.
        private async Task ForceDeleteUserAsync(int userId)
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync();

            // Discover all FK columns that reference the Users table.
            var refs = new List<(string Table, string Column, bool Nullable)>();
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT
                        OBJECT_SCHEMA_NAME(fk.parent_object_id) AS SchemaName,
                        OBJECT_NAME(fk.parent_object_id)        AS TableName,
                        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
                        c.is_nullable AS IsNullable
                    FROM sys.foreign_keys fk
                    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
                    WHERE fk.referenced_object_id = OBJECT_ID('dbo.Users');";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var schema = reader.GetString(0);
                    var table = reader.GetString(1);
                    var column = reader.GetString(2);
                    var nullable = reader.GetBoolean(3);
                    refs.Add(($"[{schema}].[{table}]", column, nullable));
                }
            }

            using var tx = await conn.BeginTransactionAsync();
            try
            {
                // Multiple passes so that rows deleted because of a required FK also clear
                // any secondary references before the user row itself is removed.
                foreach (var r in refs)
                {
                    using var cmd = conn.CreateCommand();
                    cmd.Transaction = tx as System.Data.Common.DbTransaction;
                    cmd.CommandText = r.Nullable
                        ? $"UPDATE {r.Table} SET [{r.Column}] = NULL WHERE [{r.Column}] = @id;"
                        : $"DELETE FROM {r.Table} WHERE [{r.Column}] = @id;";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@id";
                    p.Value = userId;
                    cmd.Parameters.Add(p);
                    await cmd.ExecuteNonQueryAsync();
                }

                using (var del = conn.CreateCommand())
                {
                    del.Transaction = tx as System.Data.Common.DbTransaction;
                    del.CommandText = "DELETE FROM [dbo].[Users] WHERE [UserId] = @id;";
                    var p = del.CreateParameter();
                    p.ParameterName = "@id";
                    p.Value = userId;
                    del.Parameters.Add(p);
                    await del.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
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

            // If deactivating user, delete all their messages
            if (!user.IsActive)
            {
                var userMessages = await _context.Messages
                    .Where(m => m.SenderId == id)
                    .Include(m => m.Attachments)
                    .Include(m => m.ReadReceipts)
                    .ToListAsync();

                if (userMessages.Any())
                {
                    // Remove all attachments and read receipts first
                    foreach (var message in userMessages)
                    {
                        _context.MessageAttachments.RemoveRange(message.Attachments);
                        _context.MessageReadReceipts.RemoveRange(message.ReadReceipts);
                    }

                    // Remove the messages
                    _context.Messages.RemoveRange(userMessages);

                    _logger.LogInformation("Deleted {Count} messages from deactivated user {UserId}", userMessages.Count, id);
                }
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} active status toggled to: {IsActive}", id, user.IsActive);

            return Ok(new { message = $"User {(user.IsActive ? "activated" : "deactivated")} successfully", isActive = user.IsActive });
        }

        // GET: api/users/roles
        [HttpGet("roles")]
        public ActionResult<IEnumerable<string>> GetRoles()
        {
            var roles = new[] { "Super Admin", "Admin", "Manager", "Employee", "HR", "IT Support" };
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
        public string? PrimaryExtension { get; set; }
        /// <summary>Alias of PrimaryExtension so edit forms (which read extensionNumber) populate correctly.</summary>
        public string? ExtensionNumber { get; set; }
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
        public string? PrimaryExtension { get; set; }
        public List<ExtensionSummaryDto> Extensions { get; set; } = new();
    }

    public class ExtensionSummaryDto
    {
        public int ExtensionId { get; set; }
        public string ExtensionNumber { get; set; } = string.Empty;
        public string? Label { get; set; }
        public string? ExtensionType { get; set; }
        public bool IsPrimary { get; set; }
    }

    public class CreateUserDto
    {
        public string Name { get; set; } = string.Empty;
        public string Surname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? Role { get; set; }
        public string? Title { get; set; }
        public List<string>? Permissions { get; set; }
        public int? DepartmentId { get; set; }
        public bool? IsActive { get; set; }
        public List<int>? CompanyIds { get; set; }
        public string? LinkedEmpId { get; set; }
        public DateTime? Birthday { get; set; }
        public int? ExtensionId { get; set; } // Link an existing extension during user creation
    }

    public class UpdateUserDto
    {
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
        public string? Title { get; set; }
        public List<string>? Permissions { get; set; }
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
        public string? Address { get; set; }
        public string? MobileNo { get; set; }
        public bool HasPhoto { get; set; }
        public string FullName => $"{Name} {LastName}".Trim();
    }

    public class ClockInEmployeeRequest
    {
        public string? EmpId { get; set; }
        public string? Name { get; set; }
        public string? LastName { get; set; }
        public string? IdNum { get; set; }
        public string? Department { get; set; }
        public string? JobTitle { get; set; }
        public string? Address { get; set; }
        public string? MobileNo { get; set; }
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

    public class ModulePermissionDto
    {
        public string Key { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
    }
}
