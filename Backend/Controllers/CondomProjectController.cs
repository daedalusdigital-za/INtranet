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

        // ==================== SAMPLES ====================

        /// <summary>
        /// Get all condom samples
        /// </summary>
        [HttpGet("samples")]
        public async Task<IActionResult> GetSamples()
        {
            try
            {
                var samples = await _context.CondomSamples
                    .OrderByDescending(s => s.DateSent)
                    .ToListAsync();

                return Ok(samples);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching condom samples");
                return StatusCode(500, new { error = "Failed to load samples" });
            }
        }

        /// <summary>
        /// Create a new condom sample entry
        /// </summary>
        [HttpPost("samples")]
        public async Task<IActionResult> CreateSample([FromBody] CreateCondomSampleDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var sample = new CondomSample
                {
                    Scent = dto.Scent,
                    Type = dto.Type,
                    BatchCode = dto.BatchCode,
                    Quantity = dto.Quantity,
                    DateSent = dto.DateSent.Date,
                    Status = string.IsNullOrWhiteSpace(dto.Status) ? "Pending" : dto.Status,
                    Recipient = dto.Recipient,
                    Notes = dto.Notes,
                    CreatedAt = DateTime.UtcNow
                };

                _context.CondomSamples.Add(sample);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created condom sample: {BatchCode} - {Scent} {Type} - {Status}",
                    sample.BatchCode, sample.Scent, sample.Type, sample.Status);

                return Ok(new { success = true, id = sample.Id, message = $"Sample created: {sample.BatchCode} - {sample.Scent} {sample.Type}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating condom sample");
                return StatusCode(500, new { error = "Failed to create sample" });
            }
        }

        /// <summary>
        /// Update sample status
        /// </summary>
        [HttpPut("samples/{id}/status")]
        public async Task<IActionResult> UpdateSampleStatus(int id, [FromBody] UpdateStatusDto dto)
        {
            try
            {
                var sample = await _context.CondomSamples.FindAsync(id);
                if (sample == null) return NotFound(new { error = "Sample not found" });

                sample.Status = dto.Status;
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Sample status updated to {dto.Status}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating sample status");
                return StatusCode(500, new { error = "Failed to update sample status" });
            }
        }

        /// <summary>
        /// Delete a sample
        /// </summary>
        [HttpDelete("samples/{id}")]
        public async Task<IActionResult> DeleteSample(int id)
        {
            try
            {
                var sample = await _context.CondomSamples.FindAsync(id);
                if (sample == null) return NotFound(new { error = "Sample not found" });

                _context.CondomSamples.Remove(sample);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Sample deleted" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting sample");
                return StatusCode(500, new { error = "Failed to delete sample" });
            }
        }

        // ==================== ARTWORK ====================

        /// <summary>
        /// Get all condom artwork entries
        /// </summary>
        [HttpGet("artwork")]
        public async Task<IActionResult> GetArtwork()
        {
            try
            {
                var artwork = await _context.CondomArtworks
                    .OrderByDescending(a => a.UpdatedAt)
                    .ToListAsync();

                return Ok(artwork);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching condom artwork");
                return StatusCode(500, new { error = "Failed to load artwork" });
            }
        }

        /// <summary>
        /// Create a new condom artwork entry
        /// </summary>
        [HttpPost("artwork")]
        public async Task<IActionResult> CreateArtwork([FromBody] CreateCondomArtworkDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var artwork = new CondomArtwork
                {
                    Scent = dto.Scent,
                    Type = dto.Type,
                    Title = dto.Title,
                    Status = string.IsNullOrWhiteSpace(dto.Status) ? "Draft" : dto.Status,
                    Version = dto.Version,
                    Designer = dto.Designer,
                    Notes = dto.Notes,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.CondomArtworks.Add(artwork);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created condom artwork: {Title} - {Scent} {Type} - {Status}",
                    artwork.Title, artwork.Scent, artwork.Type, artwork.Status);

                return Ok(new { success = true, id = artwork.Id, message = $"Artwork created: {artwork.Title}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating condom artwork");
                return StatusCode(500, new { error = "Failed to create artwork" });
            }
        }

        /// <summary>
        /// Update artwork status
        /// </summary>
        [HttpPut("artwork/{id}/status")]
        public async Task<IActionResult> UpdateArtworkStatus(int id, [FromBody] UpdateStatusDto dto)
        {
            try
            {
                var artwork = await _context.CondomArtworks.FindAsync(id);
                if (artwork == null) return NotFound(new { error = "Artwork not found" });

                artwork.Status = dto.Status;
                artwork.UpdatedAt = DateTime.UtcNow;
                if (dto.Status == "Approved")
                    artwork.ApprovalDate = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Artwork status updated to {dto.Status}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating artwork status");
                return StatusCode(500, new { error = "Failed to update artwork status" });
            }
        }

        /// <summary>
        /// Delete artwork
        /// </summary>
        [HttpDelete("artwork/{id}")]
        public async Task<IActionResult> DeleteArtwork(int id)
        {
            try
            {
                var artwork = await _context.CondomArtworks.FindAsync(id);
                if (artwork == null) return NotFound(new { error = "Artwork not found" });

                _context.CondomArtworks.Remove(artwork);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Artwork deleted" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting artwork");
                return StatusCode(500, new { error = "Failed to delete artwork" });
            }
        }
    }
}
