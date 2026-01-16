using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SeedController : ControllerBase
    {
        private readonly IDatabaseSeederService _seederService;
        private readonly ILogger<SeedController> _logger;

        public SeedController(IDatabaseSeederService seederService, ILogger<SeedController> logger)
        {
            _seederService = seederService;
            _logger = logger;
        }

        /// <summary>
        /// Seed employees, extensions, and company affiliations
        /// </summary>
        [HttpPost("employees")]
        [Authorize(Roles = "Super Admin,Admin")]
        public async Task<IActionResult> SeedEmployees()
        {
            try
            {
                _logger.LogInformation("Starting employee seed via API");
                await _seederService.SeedEmployeesAsync();
                return Ok(new { 
                    success = true, 
                    message = "Employees seeded successfully. Default password: Welcome123!" 
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding employees");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// Seed employees without authentication (for initial setup only)
        /// WARNING: Disable this in production!
        /// </summary>
        [HttpPost("employees/init")]
        [AllowAnonymous]
        public async Task<IActionResult> SeedEmployeesInit([FromQuery] string key)
        {
            // Simple security key - change in production
            if (key != "InitialSetup2026!")
            {
                return Unauthorized(new { message = "Invalid setup key" });
            }

            try
            {
                _logger.LogInformation("Starting initial employee seed via API (anonymous)");
                await _seederService.SeedEmployeesAsync();
                return Ok(new { 
                    success = true, 
                    message = "Employees seeded successfully. Default password: Welcome123!" 
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding employees");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }
}
