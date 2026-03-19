using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

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

                // Calculate total units for week 1 (first working week)
                var week1Dates = dates.Take(7).ToList();
                var week1Total = schedules.Where(s => week1Dates.Contains(s.ScheduleDate)).Sum(s => s.Quantity);
                var week2Dates = dates.Skip(7).Take(7).ToList();
                var week2Total = schedules.Where(s => week2Dates.Contains(s.ScheduleDate)).Sum(s => s.Quantity);

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
                        week1Total,
                        week2Total,
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

                // Daily totals
                var dailyTotals = dates.Select(d => new
                {
                    date = d,
                    total = schedules.Where(s => s.ScheduleDate == d).Sum(s => s.Quantity)
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
    }
}
