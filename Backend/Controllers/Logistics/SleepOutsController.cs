using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class SleepOutsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SleepOutsController> _logger;

        public SleepOutsController(ApplicationDbContext context, ILogger<SleepOutsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Get all sleep outs with optional filtering
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SleepOutDto>>> GetSleepOuts(
            [FromQuery] string? status = null,
            [FromQuery] int? driverId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            var query = _context.SleepOuts
                .Include(s => s.Driver)
                .Include(s => s.Load)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(s => s.Status == status);

            if (driverId.HasValue)
                query = query.Where(s => s.DriverId == driverId.Value);

            if (fromDate.HasValue)
                query = query.Where(s => s.Date >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(s => s.Date <= toDate.Value);

            var sleepOuts = await query
                .OrderByDescending(s => s.Date)
                .ThenByDescending(s => s.CreatedAt)
                .Select(s => new SleepOutDto
                {
                    Id = s.Id,
                    DriverId = s.DriverId,
                    DriverName = s.Driver != null ? $"{s.Driver.FirstName} {s.Driver.LastName}" : null,
                    DriverEmployeeNumber = s.Driver != null ? s.Driver.EmployeeNumber : null,
                    Amount = s.Amount,
                    Date = s.Date,
                    Status = s.Status,
                    Reason = s.Reason,
                    Notes = s.Notes,
                    LoadId = s.LoadId,
                    LoadNumber = s.Load != null ? s.Load.LoadNumber : null,
                    ApprovedByUserId = s.ApprovedByUserId,
                    ApprovedAt = s.ApprovedAt,
                    CreatedAt = s.CreatedAt
                })
                .ToListAsync();

            return Ok(sleepOuts);
        }

        /// <summary>
        /// Get a single sleep out by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<SleepOutDto>> GetSleepOut(int id)
        {
            var sleepOut = await _context.SleepOuts
                .Include(s => s.Driver)
                .Include(s => s.Load)
                .Where(s => s.Id == id)
                .Select(s => new SleepOutDto
                {
                    Id = s.Id,
                    DriverId = s.DriverId,
                    DriverName = s.Driver != null ? $"{s.Driver.FirstName} {s.Driver.LastName}" : null,
                    DriverEmployeeNumber = s.Driver != null ? s.Driver.EmployeeNumber : null,
                    Amount = s.Amount,
                    Date = s.Date,
                    Status = s.Status,
                    Reason = s.Reason,
                    Notes = s.Notes,
                    LoadId = s.LoadId,
                    LoadNumber = s.Load != null ? s.Load.LoadNumber : null,
                    ApprovedByUserId = s.ApprovedByUserId,
                    ApprovedAt = s.ApprovedAt,
                    CreatedAt = s.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            return Ok(sleepOut);
        }

        /// <summary>
        /// Get sleep out statistics/summary
        /// </summary>
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSleepOutSummary()
        {
            var today = DateTime.Today;
            var startOfMonth = new DateTime(today.Year, today.Month, 1);

            var allSleepOuts = await _context.SleepOuts
                .Where(s => s.Date >= startOfMonth)
                .ToListAsync();

            var summary = new
            {
                TotalRequested = allSleepOuts.Count(s => s.Status == "Requested"),
                TotalApproved = allSleepOuts.Count(s => s.Status == "Approved"),
                TotalRejected = allSleepOuts.Count(s => s.Status == "Rejected"),
                TotalPaid = allSleepOuts.Count(s => s.Status == "Paid"),
                TotalAmountApproved = allSleepOuts.Where(s => s.Status == "Approved" || s.Status == "Paid").Sum(s => s.Amount),
                TotalAmountPaid = allSleepOuts.Where(s => s.Status == "Paid").Sum(s => s.Amount),
                MonthlyTotal = allSleepOuts.Sum(s => s.Amount),
                PendingCount = allSleepOuts.Count(s => s.Status == "Requested")
            };

            return Ok(summary);
        }

        /// <summary>
        /// Create a new sleep out request
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<SleepOutDto>> CreateSleepOut([FromBody] CreateSleepOutDto dto)
        {
            // Validate driver exists
            var driver = await _context.Drivers.FindAsync(dto.DriverId);
            if (driver == null)
                return BadRequest(new { error = "Driver not found" });

            // Validate load if provided
            if (dto.LoadId.HasValue)
            {
                var load = await _context.Loads.FindAsync(dto.LoadId.Value);
                if (load == null)
                    return BadRequest(new { error = "Load not found" });
            }

            // Get user ID from claims
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? createdByUserId = int.TryParse(userIdClaim, out var uid) ? uid : null;

            var sleepOut = new SleepOut
            {
                DriverId = dto.DriverId,
                Amount = dto.Amount,
                Date = dto.Date,
                Status = "Requested",
                Reason = dto.Reason,
                Notes = dto.Notes,
                LoadId = dto.LoadId,
                CreatedByUserId = createdByUserId,
                CreatedAt = DateTime.UtcNow
            };

            _context.SleepOuts.Add(sleepOut);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created sleep out request {SleepOutId} for driver {DriverId}", sleepOut.Id, dto.DriverId);

            // Return the created sleep out with driver info
            return await GetSleepOut(sleepOut.Id);
        }

        /// <summary>
        /// Update a sleep out
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<SleepOutDto>> UpdateSleepOut(int id, [FromBody] UpdateSleepOutDto dto)
        {
            var sleepOut = await _context.SleepOuts.FindAsync(id);
            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            // Only allow updates to non-approved/paid sleep outs
            if (sleepOut.Status == "Approved" || sleepOut.Status == "Paid")
                return BadRequest(new { error = "Cannot update an approved or paid sleep out" });

            if (dto.Amount.HasValue)
                sleepOut.Amount = dto.Amount.Value;

            if (dto.Date.HasValue)
                sleepOut.Date = dto.Date.Value;

            if (!string.IsNullOrEmpty(dto.Reason))
                sleepOut.Reason = dto.Reason;

            if (dto.Notes != null)
                sleepOut.Notes = dto.Notes;

            sleepOut.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated sleep out {SleepOutId}", id);

            return await GetSleepOut(id);
        }

        /// <summary>
        /// Approve or reject a sleep out
        /// </summary>
        [HttpPost("{id}/approve")]
        public async Task<ActionResult<SleepOutDto>> ApproveSleepOut(int id, [FromBody] ApproveSleepOutDto dto)
        {
            var sleepOut = await _context.SleepOuts.FindAsync(id);
            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            if (sleepOut.Status != "Requested")
                return BadRequest(new { error = "Only requested sleep outs can be approved/rejected" });

            // Get user ID from claims
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? approvedByUserId = int.TryParse(userIdClaim, out var uid) ? uid : null;

            sleepOut.Status = dto.Approved ? "Approved" : "Rejected";
            sleepOut.ApprovedByUserId = approvedByUserId;
            sleepOut.ApprovedAt = DateTime.UtcNow;
            sleepOut.UpdatedAt = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(dto.Notes))
                sleepOut.Notes = (sleepOut.Notes ?? "") + "\n[Approval Note]: " + dto.Notes;

            await _context.SaveChangesAsync();

            _logger.LogInformation("{Action} sleep out {SleepOutId} by user {UserId}", 
                dto.Approved ? "Approved" : "Rejected", id, approvedByUserId);

            return await GetSleepOut(id);
        }

        /// <summary>
        /// Mark a sleep out as paid
        /// </summary>
        [HttpPost("{id}/mark-paid")]
        public async Task<ActionResult<SleepOutDto>> MarkSleepOutAsPaid(int id)
        {
            var sleepOut = await _context.SleepOuts.FindAsync(id);
            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            if (sleepOut.Status != "Approved")
                return BadRequest(new { error = "Only approved sleep outs can be marked as paid" });

            sleepOut.Status = "Paid";
            sleepOut.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Marked sleep out {SleepOutId} as paid", id);

            return await GetSleepOut(id);
        }

        /// <summary>
        /// Delete a sleep out
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSleepOut(int id)
        {
            var sleepOut = await _context.SleepOuts.FindAsync(id);
            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            // Only allow deletion of requested sleep outs
            if (sleepOut.Status != "Requested")
                return BadRequest(new { error = "Only requested sleep outs can be deleted" });

            _context.SleepOuts.Remove(sleepOut);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted sleep out {SleepOutId}", id);

            return Ok(new { message = "Sleep out deleted successfully" });
        }
    }
}
