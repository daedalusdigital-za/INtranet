using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IAuditLogService _auditLogService;
        private readonly ProjectTracker.API.Data.ApplicationDbContext _db;

        public AuthController(IAuthService authService, IAuditLogService auditLogService, ProjectTracker.API.Data.ApplicationDbContext db)
        {
            _authService = authService;
            _auditLogService = auditLogService;
            _db = db;
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            // Trim whitespace from input
            loginDto.Email = loginDto.Email?.Trim() ?? "";
            loginDto.Password = loginDto.Password?.Trim() ?? "";

            // Authenticate against Users table in database
            var result = await _authService.LoginAsync(loginDto);

            if (result == null)
            {
                // Log failed login attempt
                await _auditLogService.LogAsync(
                    "Login Failed", 
                    "security", 
                    "User", 
                    null, 
                    $"Failed login attempt for email: {loginDto.Email}",
                    null,
                    "warning",
                    false,
                    "Invalid credentials"
                );
                return Unauthorized(new { message = "Invalid email or password" });
            }

            // Log successful login
            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync(
                "Login", 
                "security", 
                "User", 
                result.User.UserId, 
                $"User logged in: {result.User.Name} ({result.User.Email})",
                null,
                "info",
                true
            );

            return Ok(result);
        }

        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<IActionResult> Refresh([FromBody] ProjectTracker.API.DTOs.Auth.RefreshRequestDto dto)
        {
            var result = await _authService.RefreshAsync(dto.RefreshToken, dto.ClientId);
            if (result == null)
            {
                return Unauthorized(new { message = "Invalid or expired refresh token" });
            }
            return Ok(result);
        }

        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout([FromBody] ProjectTracker.API.DTOs.Auth.RefreshRequestDto? dto = null)
        {
            if (dto != null && !string.IsNullOrWhiteSpace(dto.RefreshToken))
            {
                await _authService.RevokeRefreshTokenAsync(dto.RefreshToken);
            }

            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync(
                "Logout", 
                "security", 
                "User", 
                null, 
                "User logged out"
            );
            return Ok(new { message = "Logged out successfully" });
        }

        [HttpPost("register")]
        [Authorize(Roles = "Super Admin,Admin")]
        public async Task<IActionResult> Register([FromBody] RegisterDto registerDto)
        {
            var result = await _authService.RegisterAsync(registerDto);

            if (result == null)
            {
                return BadRequest(new { message = "User with this email already exists" });
            }

            // Log user registration
            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync(
                "User Registered", 
                "user", 
                "User", 
                result.UserId, 
                $"New user registered: {result.Name} ({result.Email})"
            );

            return Ok(result);
        }

        // ---------------------------------------------------------------- self-service password reset
        // An admin emails the user a link (POST api/users/{id}/send-reset-link); the link opens the
        // /reset-password page, which calls these two endpoints. Rate-limited per IP.

        public record ResetLinkPasswordDto(string Token, string Password);

        /// <summary>GET api/auth/reset-password?token= → { valid, name } so the page can greet the user or explain an expired link.</summary>
        [HttpGet("reset-password")]
        [AllowAnonymous]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting(ProjectTracker.API.Security.PortalRateLimiting.AuthPolicy)]
        public async Task<IActionResult> CheckResetLink([FromQuery] string? token)
        {
            var user = await FindByResetToken(token);
            return Ok(user == null ? new { valid = false, name = (string?)null } : new { valid = true, name = (string?)user.Name });
        }

        /// <summary>POST api/auth/reset-password { token, password } → sets the password, uses up the link, signs out other sessions.</summary>
        [HttpPost("reset-password")]
        [AllowAnonymous]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting(ProjectTracker.API.Security.PortalRateLimiting.AuthPolicy)]
        public async Task<IActionResult> ResetPasswordWithLink([FromBody] ResetLinkPasswordDto dto)
        {
            // Sign-in trims the password, so store it trimmed too or a stray space would lock them out.
            var password = dto?.Password?.Trim() ?? "";
            if (password.Length < 8)
                return BadRequest(new { message = "Your password must be at least 8 characters." });

            var user = await FindByResetToken(dto?.Token);
            if (user == null)
                return BadRequest(new { message = "This link has expired or has already been used. Ask IT support to send you a new one." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            user.PasswordResetTokenHash = null;
            user.PasswordResetExpiresAt = null;
            user.UpdatedAt = DateTime.UtcNow;

            // Sign out every existing session: whoever had the old password shouldn't stay signed in.
            var sessions = await _db.RefreshTokens.Where(t => t.UserId == user.UserId && !t.IsRevoked).ToListAsync();
            foreach (var s in sessions) s.IsRevoked = true;

            await _db.SaveChangesAsync();

            _auditLogService.SetHttpContext(HttpContext);
            await _auditLogService.LogAsync("Password Reset (self-service)", "security", "User", user.UserId,
                $"{user.Name} {user.Surname} ({user.Email}) set a new password from an emailed reset link");

            return Ok(new { message = "Your password has been changed. You can sign in now.", email = user.Email });
        }

        private async Task<Models.User?> FindByResetToken(string? token)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 128) return null;
            var hash = ProjectTracker.API.Security.PasswordResetTokens.Hash(token);
            return await _db.Users.FirstOrDefaultAsync(u =>
                u.PasswordResetTokenHash == hash && u.PasswordResetExpiresAt > DateTime.UtcNow && u.IsActive);
        }
    }
}
