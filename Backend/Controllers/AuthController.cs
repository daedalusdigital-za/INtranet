using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

        public AuthController(IAuthService authService, IAuditLogService auditLogService)
        {
            _authService = authService;
            _auditLogService = auditLogService;
        }

        [HttpPost("login")]
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
    }
}
