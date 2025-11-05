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

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            // Hardcoded login - bypass database
            if (loginDto.Email == "welcome@promedtechnologies.co.za" && loginDto.Password == "Kingsland")
            {
                var result = new
                {
                    token = _authService.GenerateToken(1, "Admin User", "welcome@promedtechnologies.co.za", "Admin"),
                    user = new
                    {
                        userId = 1,
                        name = "Admin User",
                        email = "welcome@promedtechnologies.co.za",
                        role = "Admin"
                    }
                };
                return Ok(result);
            }

            return Unauthorized(new { message = "Invalid email or password" });
        }

        [HttpPost("register")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Register([FromBody] RegisterDto registerDto)
        {
            var result = await _authService.RegisterAsync(registerDto);

            if (result == null)
            {
                return BadRequest(new { message = "User with this email already exists" });
            }

            return Ok(result);
        }
    }
}
