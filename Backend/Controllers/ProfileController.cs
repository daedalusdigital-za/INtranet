using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;

namespace ProjectTracker.API.Controllers
{
    // SECURITY: write endpoints act only on the caller's own account. Admins may
    // also edit other users' profile details and photos (User Management);
    // passwords of other users are changed only via api/users/{id}/reset-password.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ProfileController> _logger;

        public ProfileController(ApplicationDbContext context, ILogger<ProfileController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/profile/{userId}
        [HttpGet("{userId}")]
        public async Task<ActionResult<UserProfileDto>> GetProfile(int userId)
        {
            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.UserId == userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            return Ok(new UserProfileDto
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
                ProfilePictureUrl = user.ProfilePictureUrl,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                CreatedAt = user.CreatedAt
            });
        }

        // PUT: api/profile/{userId}
        [HttpPut("{userId}")]
        public async Task<IActionResult> UpdateProfile(int userId, [FromBody] UpdateProfileDto dto)
        {
            if (!User.IsSelfOrAdmin(userId))
                return Forbid();

            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Update allowed fields
            if (!string.IsNullOrEmpty(dto.Name))
                user.Name = dto.Name;
            
            if (!string.IsNullOrEmpty(dto.Surname))
                user.Surname = dto.Surname;
            
            if (!string.IsNullOrEmpty(dto.Title))
                user.Title = dto.Title;
            
            if (!string.IsNullOrEmpty(dto.ProfilePictureUrl))
                user.ProfilePictureUrl = dto.ProfilePictureUrl;

            // Department can be changed (0 or null clears it)
            if (dto.DepartmentId.HasValue)
                user.DepartmentId = dto.DepartmentId.Value > 0 ? dto.DepartmentId.Value : null;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Profile updated for user {UserId}", userId);

            return Ok(new { message = "Profile updated successfully" });
        }

        // POST: api/profile/{userId}/change-password
        [HttpPost("{userId}/change-password")]
        public async Task<IActionResult> ChangePassword(int userId, [FromBody] ChangePasswordDto dto)
        {
            // Own password only, even for admins (they use reset-password).
            if (User.GetUserId() != userId)
                return Forbid();

            if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 8)
                return BadRequest(new { message = "New password must be at least 8 characters." });

            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Verify current password
            bool currentPasswordValid = false;
            if (user.PasswordHash.StartsWith("$2"))
            {
                currentPasswordValid = BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash);
            }
            else
            {
                currentPasswordValid = user.PasswordHash == dto.CurrentPassword;
            }

            if (!currentPasswordValid)
            {
                return BadRequest(new { message = "Current password is incorrect" });
            }

            // Hash and set new password
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Password changed for user {UserId}", userId);

            return Ok(new { message = "Password changed successfully" });
        }

        // POST: api/profile/{userId}/upload-photo
        [HttpPost("{userId}/upload-photo")]
        public async Task<IActionResult> UploadPhoto(int userId, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file uploaded" });
            }

            if (!User.IsSelfOrAdmin(userId))
                return Forbid();

            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Validate file type
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType))
            {
                return BadRequest(new { message = "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." });
            }

            // Read file into byte array
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var fileBytes = memoryStream.ToArray();

            // Store in database
            user.ProfilePictureData = fileBytes;
            user.ProfilePictureMimeType = file.ContentType;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Profile photo uploaded for user {UserId}", userId);

            return Ok(new { 
                message = "Photo uploaded successfully",
                photoUrl = $"/api/profile/{userId}/photo"
            });
        }

        // GET: api/profile/{userId}/photo
        [HttpGet("{userId}/photo")]
        public async Task<IActionResult> GetPhoto(int userId)
        {
            var user = await _context.Users.FindAsync(userId);

            if (user == null || user.ProfilePictureData == null)
            {
                return NotFound();
            }

            return File(user.ProfilePictureData, user.ProfilePictureMimeType ?? "image/jpeg");
        }

        // DELETE: api/profile/{userId}/photo
        [HttpDelete("{userId}/photo")]
        public async Task<IActionResult> DeletePhoto(int userId)
        {
            if (!User.IsSelfOrAdmin(userId))
                return Forbid();

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            user.ProfilePictureData = null;
            user.ProfilePictureMimeType = null;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Profile photo removed for user {UserId}", userId);

            return Ok(new { message = "Photo removed successfully" });
        }
    }
}
