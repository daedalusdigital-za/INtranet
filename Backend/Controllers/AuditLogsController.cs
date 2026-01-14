using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AuditLogsController : ControllerBase
    {
        private readonly IAuditLogService _auditLogService;
        private readonly ILogger<AuditLogsController> _logger;

        public AuditLogsController(IAuditLogService auditLogService, ILogger<AuditLogsController> logger)
        {
            _auditLogService = auditLogService;
            _logger = logger;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<AuditLogPagedResult>> GetLogs([FromQuery] AuditLogFilterDto filter)
        {
            try
            {
                _auditLogService.SetHttpContext(HttpContext);
                var result = await _auditLogService.GetLogsAsync(filter);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching audit logs");
                return StatusCode(500, new { message = "Error fetching audit logs" });
            }
        }

        [HttpGet("recent")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<List<AuditLogDto>>> GetRecentLogs([FromQuery] int count = 100)
        {
            try
            {
                var logs = await _auditLogService.GetRecentLogsAsync(count);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching recent audit logs");
                return StatusCode(500, new { message = "Error fetching audit logs" });
            }
        }

        [HttpGet("stats")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<AuditLogStatsDto>> GetStats()
        {
            try
            {
                var stats = await _auditLogService.GetStatsAsync();
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching audit log stats");
                return StatusCode(500, new { message = "Error fetching stats" });
            }
        }

        [HttpGet("user/{userId}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<List<AuditLogDto>>> GetUserActivity(int userId, [FromQuery] int count = 50)
        {
            try
            {
                var logs = await _auditLogService.GetUserActivityAsync(userId, count);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user activity for user {UserId}", userId);
                return StatusCode(500, new { message = "Error fetching user activity" });
            }
        }

        [HttpPost]
        public async Task<ActionResult> CreateLog([FromBody] CreateAuditLogDto dto)
        {
            try
            {
                _auditLogService.SetHttpContext(HttpContext);
                await _auditLogService.LogAsync(dto);
                return Ok(new { message = "Log created successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating audit log");
                return StatusCode(500, new { message = "Error creating log" });
            }
        }

        [HttpGet("categories")]
        public ActionResult<List<string>> GetCategories()
        {
            var categories = new List<string>
            {
                "security",
                "user",
                "announcement",
                "settings",
                "system",
                "document",
                "crm",
                "attendance",
                "meeting"
            };
            return Ok(categories);
        }

        [HttpGet("export")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> ExportLogs([FromQuery] AuditLogFilterDto filter)
        {
            try
            {
                filter.PageSize = 10000; // Get all for export
                var result = await _auditLogService.GetLogsAsync(filter);
                
                // Return as JSON for now, could add CSV export later
                return Ok(result.Logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting audit logs");
                return StatusCode(500, new { message = "Error exporting logs" });
            }
        }
    }
}
