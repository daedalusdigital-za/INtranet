using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models.Projects;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CondomProjectController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CondomProjectController> _logger;

        public CondomProjectController(ApplicationDbContext context, ILogger<CondomProjectController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Get the full production schedule grouped by scent and type
        /// </summary>
        [HttpGet("production-schedule")]
        public async Task<IActionResult> GetProductionSchedule([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            try
            {
                var query = _context.CondomProductionSchedules.AsQueryable();

                if (fromDate.HasValue)
                    query = query.Where(s => s.ScheduleDate >= fromDate.Value.Date);
                if (toDate.HasValue)
                    query = query.Where(s => s.ScheduleDate <= toDate.Value.Date);

                var schedules = await query.OrderBy(s => s.SortOrder).ThenBy(s => s.ScheduleDate).ToListAsync();

                // Get all unique dates
                var dates = schedules.Select(s => s.ScheduleDate).Distinct().OrderBy(d => d).ToList();

                // Group by scent group → type → batch
                var groups = schedules
                    .GroupBy(s => new { s.ScentGroup, s.Scent, s.Type })
                    .Select(g => new
                    {
                        scent = g.Key.Scent,
                        type = g.Key.Type,
                        scentGroup = g.Key.ScentGroup,
                        batches = g.GroupBy(x => x.BatchCode).Select(bg => new
                        {
                            batchCode = bg.Key,
                            uom = bg.First().UOM,
                            dailyQuantities = dates.Select(d =>
                            {
                                var entry = bg.FirstOrDefault(x => x.ScheduleDate == d);
                                return new
                                {
                                    date = d,
                                    quantity = entry?.Quantity ?? 0,
                                    note = entry?.QuantityNote
                                };
                            }).ToList()
                        }).ToList()
                    })
                    .ToList();

                // Summary stats
                var totalBatches = schedules.Select(s => s.BatchCode).Distinct().Count();
                var totalFemale = schedules.Where(s => s.Type == "Female").Select(s => s.BatchCode).Distinct().Count();
                var totalMale = schedules.Where(s => s.Type == "Male").Select(s => s.BatchCode).Distinct().Count();
                var scents = schedules.Select(s => s.Scent).Distinct().Count();

                // Calculate totals
                var totalAll = schedules.Sum(s => s.Quantity);

                return Ok(new
                {
                    dates = dates,
                    groups = groups,
                    summary = new
                    {
                        totalBatches,
                        femaleBatches = totalFemale,
                        maleBatches = totalMale,
                        scentVariants = scents,
                        totalUnits = totalAll,
                        scheduleDays = dates.Count
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching production schedule");
                return StatusCode(500, new { error = "Failed to load production schedule" });
            }
        }

        /// <summary>
        /// Get summary/dashboard data
        /// </summary>
        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
        {
            try
            {
                var schedules = await _context.CondomProductionSchedules.ToListAsync();
                
                if (!schedules.Any())
                    return Ok(new { hasData = false });

                var dates = schedules.Select(s => s.ScheduleDate).Distinct().OrderBy(d => d).ToList();
                var batches = schedules.Select(s => s.BatchCode).Distinct().ToList();

                // Per-scent breakdown
                var scentBreakdown = schedules
                    .GroupBy(s => s.Scent)
                    .Select(g => new
                    {
                        scent = g.Key,
                        batchCount = g.Select(x => x.BatchCode).Distinct().Count(),
                        totalUnits = g.Sum(x => x.Quantity),
                        types = g.Select(x => x.Type).Distinct().ToList()
                    })
                    .OrderByDescending(s => s.totalUnits)
                    .ToList();

                // Per-type breakdown
                var typeBreakdown = schedules
                    .GroupBy(s => s.Type)
                    .Select(g => new
                    {
                        type = g.Key,
                        batchCount = g.Select(x => x.BatchCode).Distinct().Count(),
                        totalUnits = g.Sum(x => x.Quantity),
                        uom = g.First().UOM
                    })
                    .ToList();

                // Daily totals with male/female breakdown
                var dailyTotals = dates.Select(d => new
                {
                    date = d,
                    total = schedules.Where(s => s.ScheduleDate == d).Sum(s => s.Quantity),
                    femaleTotal = schedules.Where(s => s.ScheduleDate == d && s.Type == "Female").Sum(s => s.Quantity),
                    maleTotal = schedules.Where(s => s.ScheduleDate == d && s.Type == "Male").Sum(s => s.Quantity)
                }).ToList();

                return Ok(new
                {
                    hasData = true,
                    summary = new
                    {
                        totalBatches = batches.Count,
                        totalScents = scentBreakdown.Count,
                        dateRange = new { from = dates.First(), to = dates.Last() },
                        scheduleDays = dates.Count,
                        grandTotal = schedules.Sum(s => s.Quantity)
                    },
                    scentBreakdown,
                    typeBreakdown,
                    dailyTotals
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching condom project dashboard");
                return StatusCode(500, new { error = "Failed to load dashboard" });
            }
        }

        /// <summary>
        /// Create a new condom stock entry
        /// </summary>
        [HttpPost("stock")]
        public async Task<IActionResult> CreateStock([FromBody] CreateCondomStockDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                // Validate scent
                var validScents = new[] { "Vanilla", "Strawberry", "Banana", "Grape", "Plain" };
                if (!validScents.Contains(dto.Scent, StringComparer.OrdinalIgnoreCase))
                    return BadRequest(new { error = $"Invalid scent. Must be one of: {string.Join(", ", validScents)}" });

                // Validate type
                var validTypes = new[] { "Female", "Male" };
                if (!validTypes.Contains(dto.Type, StringComparer.OrdinalIgnoreCase))
                    return BadRequest(new { error = "Invalid type. Must be Female or Male" });

                // Determine ScentGroup based on scent
                var scentGroupMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Vanilla", "Flavoured" },
                    { "Strawberry", "Flavoured" },
                    { "Banana", "Flavoured" },
                    { "Grape", "Flavoured" },
                    { "Plain", "Plain" }
                };

                // Determine SortOrder based on scent + type
                var sortOrderMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Vanilla-Female", 1 },
                    { "Vanilla-Male", 2 },
                    { "Strawberry-Female", 3 },
                    { "Strawberry-Male", 4 },
                    { "Banana-Female", 5 },
                    { "Banana-Male", 6 },
                    { "Grape-Female", 7 },
                    { "Grape-Male", 8 },
                    { "Plain-Female", 9 },
                    { "Plain-Male", 10 }
                };

                var sortKey = $"{dto.Scent}-{dto.Type}";
                var sortOrder = sortOrderMap.GetValueOrDefault(sortKey, 99);
                var scentGroup = scentGroupMap.GetValueOrDefault(dto.Scent, "Other");

                var entry = new CondomProductionSchedule
                {
                    Scent = dto.Scent,
                    Type = dto.Type,
                    BatchCode = dto.BatchCode,
                    UOM = string.IsNullOrWhiteSpace(dto.UOM) ? "CASES" : dto.UOM.ToUpper(),
                    ScheduleDate = dto.ScheduleDate.Date,
                    Quantity = dto.Quantity,
                    QuantityNote = dto.QuantityNote,
                    ScentGroup = scentGroup,
                    SortOrder = sortOrder,
                    CreatedAt = DateTime.UtcNow
                };

                _context.CondomProductionSchedules.Add(entry);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created condom stock entry: {BatchCode} - {Scent} {Type} - {Quantity} on {Date}",
                    entry.BatchCode, entry.Scent, entry.Type, entry.Quantity, entry.ScheduleDate.ToString("yyyy-MM-dd"));

                return Ok(new
                {
                    success = true,
                    id = entry.Id,
                    message = $"Stock entry created: {entry.BatchCode} - {entry.Quantity} {entry.UOM}"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating condom stock entry");
                return StatusCode(500, new { error = "Failed to create stock entry" });
            }
        }

        // ════════════════════════════════════════════════
        // DELIVERY REQUESTS
        // ════════════════════════════════════════════════

        /// <summary>
        /// Get all delivery requests with optional status filter
        /// </summary>
        [HttpGet("delivery-requests")]
        public async Task<IActionResult> GetDeliveryRequests([FromQuery] string? status)
        {
            try
            {
                var query = _context.CondomDeliveryRequests.AsQueryable();

                if (!string.IsNullOrWhiteSpace(status) && status != "all")
                    query = query.Where(r => r.Status == status);

                var requests = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();

                var summary = new
                {
                    total = await _context.CondomDeliveryRequests.CountAsync(),
                    pending = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "Pending"),
                    approved = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "Approved"),
                    inTransit = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "In Transit"),
                    delivered = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "Delivered"),
                    cancelled = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "Cancelled")
                };

                return Ok(new { requests, summary });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching delivery requests");
                return StatusCode(500, new { error = "Failed to load delivery requests" });
            }
        }

        /// <summary>
        /// Create a new delivery request
        /// </summary>
        [HttpPost("delivery-requests")]
        public async Task<IActionResult> CreateDeliveryRequest([FromBody] CreateCondomDeliveryRequestDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                // Generate reference number: DR-YYYYMMDD-NNN
                var today = DateTime.UtcNow.ToString("yyyyMMdd");
                var todayCount = await _context.CondomDeliveryRequests
                    .CountAsync(r => r.ReferenceNumber.StartsWith($"DR-{today}"));
                var refNumber = $"DR-{today}-{(todayCount + 1):D3}";

                var request = new Models.Projects.CondomDeliveryRequest
                {
                    ReferenceNumber = refNumber,
                    Department = dto.Department ?? "Condoms",
                    Description = dto.Description ?? $"{dto.Scent} {dto.Type} - {dto.BatchCode}",
                    Scent = dto.Scent,
                    Type = dto.Type,
                    BatchCode = dto.BatchCode,
                    InvoiceNumber = dto.InvoiceNumber,
                    Quantity = dto.Quantity,
                    UOM = string.IsNullOrWhiteSpace(dto.UOM) ? "CASES" : dto.UOM.ToUpper(),
                    DeliveryAddress = dto.DeliveryAddress,
                    Notes = dto.Notes,
                    Priority = dto.Priority ?? "Normal",
                    Status = "Pending",
                    RequestedDate = DateTime.UtcNow,
                    RequestedBy = dto.RequestedBy,
                    CreatedAt = DateTime.UtcNow
                };

                _context.CondomDeliveryRequests.Add(request);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created delivery request {Ref} for {BatchCode} - {Qty} {UOM}",
                    refNumber, request.BatchCode, request.Quantity, request.UOM);

                return Ok(new
                {
                    success = true,
                    id = request.Id,
                    referenceNumber = refNumber,
                    message = $"Delivery request {refNumber} created successfully"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating delivery request");
                return StatusCode(500, new { error = "Failed to create delivery request" });
            }
        }

        /// <summary>
        /// Update delivery request status
        /// </summary>
        [HttpPut("delivery-requests/{id}/status")]
        public async Task<IActionResult> UpdateDeliveryRequestStatus(int id, [FromBody] Logistics.UpdateDeliveryStatusRequest dto)
        {
            try
            {
                var request = await _context.CondomDeliveryRequests.FindAsync(id);
                if (request == null)
                    return NotFound(new { error = "Delivery request not found" });

                var validStatuses = new[] { "Pending", "Approved", "In Transit", "Delivered", "Cancelled" };
                if (!validStatuses.Contains(dto.Status))
                    return BadRequest(new { error = $"Invalid status. Must be one of: {string.Join(", ", validStatuses)}" });

                request.Status = dto.Status;
                request.HandledBy = dto.HandledBy;

                if (dto.Status == "Approved")
                    request.ApprovedDate = DateTime.UtcNow;
                else if (dto.Status == "Delivered")
                    request.DeliveredDate = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Updated delivery request {Ref} status to {Status}",
                    request.ReferenceNumber, dto.Status);

                return Ok(new { success = true, message = $"Request {request.ReferenceNumber} updated to {dto.Status}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating delivery request status");
                return StatusCode(500, new { error = "Failed to update delivery request" });
            }
        }

        /// <summary>
        /// Delete a delivery request (only if Pending)
        /// </summary>
        [HttpDelete("delivery-requests/{id}")]
        public async Task<IActionResult> DeleteDeliveryRequest(int id)
        {
            try
            {
                var request = await _context.CondomDeliveryRequests.FindAsync(id);
                if (request == null)
                    return NotFound(new { error = "Delivery request not found" });

                if (request.Status != "Pending")
                    return BadRequest(new { error = "Only pending requests can be deleted" });

                _context.CondomDeliveryRequests.Remove(request);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Request {request.ReferenceNumber} deleted" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting delivery request");
                return StatusCode(500, new { error = "Failed to delete delivery request" });
            }
        }

    }
}
