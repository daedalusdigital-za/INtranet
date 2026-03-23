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
                await AutoShiftScheduleDates();

                var query = _context.CondomProductionSchedules.AsQueryable();

                if (fromDate.HasValue)
                    query = query.Where(s => s.ScheduleDate >= fromDate.Value.Date);
                if (toDate.HasValue)
                    query = query.Where(s => s.ScheduleDate <= toDate.Value.Date);

                var schedules = await query.OrderBy(s => s.SortOrder).ThenBy(s => s.ScheduleDate).ToListAsync();

                // Get all unique dates
                var dates = schedules.Select(s => s.ScheduleDate).Distinct().OrderBy(d => d).ToList();
                var today = DateTime.Today;

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
                                var isFuture = d.Date > today;
                                return new
                                {
                                    date = d,
                                    quantity = isFuture ? 0 : (entry?.Quantity ?? 0),
                                    note = isFuture ? (string?)null : entry?.QuantityNote
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

                // Calculate totals: past (up to today) vs upcoming (future)
                var pastTotal = schedules.Where(s => s.ScheduleDate.Date <= today).Sum(s => s.Quantity);
                var upcomingTotal = schedules.Where(s => s.ScheduleDate.Date > today).Sum(s => s.Quantity);

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
                        pastTotal,
                        upcomingTotal,
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
                await AutoShiftScheduleDates();

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

                // Daily totals with male/female breakdown (future dates show 0)
                var today = DateTime.Today;
                var dailyTotals = dates.Select(d => new
                {
                    date = d,
                    total = d.Date > today ? 0 : schedules.Where(s => s.ScheduleDate == d).Sum(s => s.Quantity),
                    femaleTotal = d.Date > today ? 0 : schedules.Where(s => s.ScheduleDate == d && s.Type == "Female").Sum(s => s.Quantity),
                    maleTotal = d.Date > today ? 0 : schedules.Where(s => s.ScheduleDate == d && s.Type == "Male").Sum(s => s.Quantity)
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

        /// <summary>
        /// Auto-shifts schedule dates so they always represent:
        /// Previous 5 weekdays (including today) + Next 2 weekdays.
        /// Remaps dates by position, skipping weekends.
        /// </summary>
        private async Task AutoShiftScheduleDates()
        {
            try
            {
                var existingDates = await _context.CondomProductionSchedules
                    .Select(s => s.ScheduleDate.Date)
                    .Distinct()
                    .OrderBy(d => d)
                    .ToListAsync();

                if (existingDates.Count != 7) return;

                // Calculate the 7 target dates: 5 previous weekdays (incl today) + 2 next weekdays
                var today = DateTime.Today;
                // Adjust if weekend
                if (today.DayOfWeek == DayOfWeek.Saturday) today = today.AddDays(-1);
                if (today.DayOfWeek == DayOfWeek.Sunday) today = today.AddDays(-2);

                var targetDates = new DateTime[7];
                targetDates[4] = today; // d5 = today (pivot)

                // Go back 4 weekdays
                var d = today;
                for (int i = 3; i >= 0; i--)
                {
                    d = d.AddDays(-1);
                    while (d.DayOfWeek == DayOfWeek.Saturday || d.DayOfWeek == DayOfWeek.Sunday)
                        d = d.AddDays(-1);
                    targetDates[i] = d;
                }

                // Go forward 2 weekdays
                d = today;
                for (int i = 5; i <= 6; i++)
                {
                    d = d.AddDays(1);
                    while (d.DayOfWeek == DayOfWeek.Saturday || d.DayOfWeek == DayOfWeek.Sunday)
                        d = d.AddDays(1);
                    targetDates[i] = d;
                }

                // Check if dates already match
                if (existingDates.Select(x => x.Date).SequenceEqual(targetDates.Select(t => t.Date)))
                    return;

                _logger.LogInformation("Auto-shifting condom schedule dates to {D1}..{D5}(today)..{D7}",
                    targetDates[0].ToString("yyyy-MM-dd"), targetDates[4].ToString("yyyy-MM-dd"), targetDates[6].ToString("yyyy-MM-dd"));

                // Remap old dates to new dates by position
                for (int i = 0; i < 7; i++)
                {
                    if (existingDates[i].Date != targetDates[i].Date)
                    {
                        await _context.Database.ExecuteSqlRawAsync(
                            "UPDATE CondomProductionSchedules SET ScheduleDate = {0} WHERE CAST(ScheduleDate AS DATE) = {1}",
                            targetDates[i], existingDates[i]);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to auto-shift schedule dates");
            }
        }
    }
}
