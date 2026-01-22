using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Logistics;

[ApiController]
[Route("api/imports")]
[Authorize]
public class SohImportController : ControllerBase
{
    private readonly StockOnHandImportService _importService;
    private readonly ILogger<SohImportController> _logger;

    public SohImportController(
        StockOnHandImportService importService,
        ILogger<SohImportController> logger)
    {
        _importService = importService;
        _logger = logger;
    }

    /// <summary>
    /// Upload and parse a Stock on Hand Excel file
    /// </summary>
    /// <param name="file">The .xlsx file to import</param>
    /// <param name="operatingCompanyId">The operating company this stock belongs to</param>
    /// <param name="operatingCompanyName">The name of the operating company</param>
    /// <param name="asAtDate">The date this snapshot represents (optional, defaults to today)</param>
    /// <param name="strictMode">If true, any validation error will fail the entire import</param>
    [HttpPost("soh")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50MB limit
    public async Task<IActionResult> UploadSoh(
        IFormFile file,
        [FromForm] int operatingCompanyId,
        [FromForm] string? operatingCompanyName = null,
        [FromForm] string? asAtDate = null,
        [FromForm] bool strictMode = false)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { success = false, message = "No file uploaded." });
        }

        if (operatingCompanyId <= 0)
        {
            return BadRequest(new { success = false, message = "Please select an operating company." });
        }

        // Validate file extension
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { success = false, message = "Only .xlsx files are supported." });
        }

        DateTime? parsedDate = null;
        if (!string.IsNullOrEmpty(asAtDate))
        {
            if (DateTime.TryParse(asAtDate, out var date))
            {
                parsedDate = date;
            }
            else
            {
                return BadRequest(new { success = false, message = "Invalid asAtDate format. Use YYYY-MM-DD." });
            }
        }

        try
        {
            using var stream = file.OpenReadStream();
            var result = await _importService.ParseAndValidateAsync(
                stream,
                file.FileName,
                operatingCompanyId,
                operatingCompanyName ?? "Unknown",
                parsedDate,
                strictMode);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading SOH file: {FileName}", file.FileName);
            return StatusCode(500, new { success = false, message = $"Internal error: {ex.Message}" });
        }
    }

    /// <summary>
    /// Get the status of an SOH import
    /// </summary>
    [HttpGet("soh/{importId}")]
    public IActionResult GetImportStatus(Guid importId)
    {
        var status = _importService.GetImportStatus(importId);
        if (status == null)
        {
            return NotFound(new { success = false, message = "Import not found or has expired." });
        }

        return Ok(status);
    }

    /// <summary>
    /// Get paginated lines for preview
    /// </summary>
    [HttpGet("soh/{importId}/lines")]
    public IActionResult GetLines(Guid importId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var lines = _importService.GetLines(importId, page, pageSize);
        if (lines == null)
        {
            return NotFound(new { success = false, message = "Import not found or has expired." });
        }

        return Ok(lines);
    }

    /// <summary>
    /// Commit an SOH import to the database
    /// </summary>
    [HttpPost("soh/{importId}/commit")]
    public async Task<IActionResult> CommitImport(Guid importId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userId = int.TryParse(userIdClaim, out var id) ? id : 0;

        var result = await _importService.CommitImportAsync(importId, userId);
        
        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Cancel/delete an SOH import
    /// </summary>
    [HttpDelete("soh/{importId}")]
    public IActionResult CancelImport(Guid importId)
    {
        var success = _importService.CancelImport(importId);
        
        if (!success)
        {
            return NotFound(new { success = false, message = "Import not found or has expired." });
        }

        return Ok(new { success = true, message = "Import cancelled." });
    }

    /// <summary>
    /// Export issues as CSV
    /// </summary>
    [HttpGet("soh/{importId}/issues/csv")]
    public IActionResult ExportIssuesCsv(Guid importId)
    {
        var csv = _importService.ExportIssuesToCsv(importId);
        
        if (csv == null)
        {
            return NotFound(new { success = false, message = "Import not found or has expired." });
        }

        return File(
            System.Text.Encoding.UTF8.GetBytes(csv),
            "text/csv",
            $"soh-import-issues-{importId}.csv");
    }
}
