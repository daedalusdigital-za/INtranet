using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PbxController : ControllerBase
    {
        private readonly IPbxService _pbxService;
        private readonly ILogger<PbxController> _logger;
        private readonly IAuditLogService _auditLogService;

        public PbxController(
            IPbxService pbxService,
            ILogger<PbxController> logger,
            IAuditLogService auditLogService)
        {
            _pbxService = pbxService;
            _logger = logger;
            _auditLogService = auditLogService;
        }

        /// <summary>
        /// Get all currently active calls
        /// </summary>
        /// <returns>List of active calls with KPI summary</returns>
        [HttpGet("active-calls")]
        [Authorize(Roles = "Super Admin,Admin,Manager,IT Support")]
        public async Task<ActionResult<ActiveCallsResponse>> GetActiveCalls()
        {
            try
            {
                var userId = GetCurrentUserId();
                var userRole = GetCurrentUserRole();

                _logger.LogInformation("User {UserId} ({Role}) requested active calls", userId, userRole);

                var response = await _pbxService.GetActiveCallsAsync();

                // For non-admin users, filter to only show their department or own extension
                if (userRole != "Super Admin" && userRole != "Admin" && userRole != "IT Support")
                {
                    // Could filter here based on user's department
                    // For now, managers see all
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting active calls");
                return StatusCode(500, new { message = "Failed to retrieve active calls", error = ex.Message });
            }
        }

        /// <summary>
        /// Get a specific active call by ID
        /// </summary>
        [HttpGet("active-calls/{callId}")]
        [Authorize(Roles = "Super Admin,Admin,Manager,IT Support")]
        public async Task<ActionResult<ActiveCallDto>> GetActiveCall(string callId)
        {
            try
            {
                var response = await _pbxService.GetActiveCallsAsync();
                var call = response.Calls.FirstOrDefault(c => c.CallId == callId);

                if (call == null)
                {
                    return NotFound(new { message = "Call not found or has ended" });
                }

                return Ok(call);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting call {CallId}", callId);
                return StatusCode(500, new { message = "Failed to retrieve call details" });
            }
        }

        /// <summary>
        /// Get call history (CDR)
        /// </summary>
        [HttpGet("cdr")]
        [Authorize(Roles = "Super Admin,Admin,Manager,IT Support")]
        public async Task<ActionResult<CdrResponse>> GetCallHistory([FromQuery] CdrQueryDto query)
        {
            try
            {
                var userId = GetCurrentUserId();
                _logger.LogInformation("User {UserId} requested CDR history", userId);

                // Default date range if not specified
                query.From ??= DateTime.UtcNow.AddDays(-7);
                query.To ??= DateTime.UtcNow;

                // Limit range to prevent excessive queries
                if ((query.To.Value - query.From.Value).TotalDays > 31)
                {
                    return BadRequest(new { message = "Date range cannot exceed 31 days" });
                }

                var response = await _pbxService.GetCallHistoryAsync(query);
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting CDR");
                return StatusCode(500, new { message = "Failed to retrieve call history" });
            }
        }

        /// <summary>
        /// Get extension statuses (who is registered/online)
        /// </summary>
        [HttpGet("extension-status")]
        [Authorize(Roles = "Super Admin,Admin,Manager,IT Support")]
        public async Task<ActionResult<List<ExtensionStatusDto>>> GetExtensionStatuses()
        {
            try
            {
                var statuses = await _pbxService.GetExtensionStatusesAsync();
                return Ok(statuses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting extension statuses");
                return StatusCode(500, new { message = "Failed to retrieve extension statuses" });
            }
        }

        /// <summary>
        /// Get PBX system status
        /// </summary>
        [HttpGet("status")]
        [Authorize(Roles = "Super Admin,Admin,IT Support")]
        public async Task<ActionResult<PbxStatusDto>> GetSystemStatus()
        {
            try
            {
                var status = await _pbxService.GetSystemStatusAsync();
                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting PBX status");
                return StatusCode(500, new { message = "Failed to retrieve PBX status" });
            }
        }

        /// <summary>
        /// Test PBX connection
        /// </summary>
        [HttpGet("test-connection")]
        [Authorize(Roles = "Super Admin,Admin,IT Support")]
        public async Task<ActionResult<object>> TestConnection()
        {
            try
            {
                var isConnected = await _pbxService.TestConnectionAsync();
                
                _auditLogService.SetHttpContext(HttpContext);
                await _auditLogService.LogAsync(
                    isConnected ? "PBX Connection Test Success" : "PBX Connection Test Failed",
                    "pbx",
                    "PBX",
                    null,
                    $"Connection test result: {(isConnected ? "Success" : "Failed")}"
                );

                return Ok(new { 
                    connected = isConnected, 
                    message = isConnected ? "Successfully connected to PBX" : "Failed to connect to PBX",
                    testedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error testing PBX connection");
                return Ok(new { 
                    connected = false, 
                    message = $"Connection test failed: {ex.Message}",
                    testedAt = DateTime.UtcNow
                });
            }
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst("userId")?.Value 
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        private string GetCurrentUserRole()
        {
            return User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value 
                ?? User.FindFirst("role")?.Value 
                ?? "";
        }
    }
}
