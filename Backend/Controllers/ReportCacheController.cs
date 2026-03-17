using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers;

/// <summary>
/// Admin endpoints for managing the report cache.
/// View stats, list entries, and clear cached reports.
/// </summary>
[ApiController]
[Route("api/report-cache")]
[Authorize]
public class ReportCacheController : ControllerBase
{
    private readonly IReportCacheService _reportCacheService;
    private readonly ILogger<ReportCacheController> _logger;

    public ReportCacheController(
        IReportCacheService reportCacheService,
        ILogger<ReportCacheController> logger)
    {
        _reportCacheService = reportCacheService;
        _logger = logger;
    }

    /// <summary>
    /// Get cache statistics — total entries, hit rates, memory usage
    /// GET /api/report-cache/stats
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _reportCacheService.GetStatsAsync();
        return Ok(stats);
    }

    /// <summary>
    /// Get all cached report entries (metadata only, not the full JSON)
    /// GET /api/report-cache/entries
    /// </summary>
    [HttpGet("entries")]
    public async Task<IActionResult> GetEntries()
    {
        var entries = await _reportCacheService.GetAllEntriesAsync();
        return Ok(entries);
    }

    /// <summary>
    /// Clear all cached reports
    /// DELETE /api/report-cache
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> ClearAll()
    {
        await _reportCacheService.InvalidateAllAsync();
        _logger.LogInformation("Report cache cleared by admin");
        return Ok(new { message = "All cached reports cleared." });
    }

    /// <summary>
    /// Clear cached reports for a specific report type
    /// DELETE /api/report-cache/{reportType}
    /// </summary>
    [HttpDelete("{reportType}")]
    public async Task<IActionResult> ClearByType(string reportType)
    {
        await _reportCacheService.InvalidateByTypeAsync(reportType);
        _logger.LogInformation("Report cache cleared for type {ReportType}", reportType);
        return Ok(new { message = $"Cached reports cleared for type: {reportType}" });
    }

    /// <summary>
    /// Clean up expired cache entries
    /// POST /api/report-cache/cleanup
    /// </summary>
    [HttpPost("cleanup")]
    public async Task<IActionResult> Cleanup()
    {
        await _reportCacheService.CleanupExpiredAsync();
        _logger.LogInformation("Expired report cache entries cleaned up");
        return Ok(new { message = "Expired cache entries cleaned up." });
    }

    /// <summary>
    /// Invalidate cached reports overlapping a specific date range
    /// POST /api/report-cache/invalidate-range
    /// </summary>
    [HttpPost("invalidate-range")]
    public async Task<IActionResult> InvalidateRange([FromBody] DateRangeRequest request)
    {
        if (request.FromDate == null || request.ToDate == null)
            return BadRequest(new { message = "fromDate and toDate are required." });

        await _reportCacheService.InvalidateByDateRangeAsync(request.FromDate.Value, request.ToDate.Value);
        _logger.LogInformation("Report cache invalidated for range {From} to {To}", request.FromDate, request.ToDate);
        return Ok(new { message = $"Cached reports invalidated for date range {request.FromDate:dd MMM yyyy} to {request.ToDate:dd MMM yyyy}" });
    }

    public class DateRangeRequest
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
    }
}
