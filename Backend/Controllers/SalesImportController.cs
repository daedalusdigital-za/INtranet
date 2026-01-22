using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Services;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers;

[ApiController]
[Route("api/imports")]
[Authorize]
public class SalesImportController : ControllerBase
{
    private readonly SalesReportImportService _importService;
    private readonly ILogger<SalesImportController> _logger;

    public SalesImportController(
        SalesReportImportService importService,
        ILogger<SalesImportController> logger)
    {
        _importService = importService;
        _logger = logger;
    }

    /// <summary>
    /// Upload and parse a sales report file
    /// POST /api/imports/sales-report
    /// </summary>
    [HttpPost("sales-report")]
    [RequestSizeLimit(50_000_000)] // 50MB limit
    public async Task<ActionResult<SalesImportUploadResponse>> UploadSalesReport(
        IFormFile file,
        [FromForm] string sourceCompany,
        [FromForm] bool strictMode = false)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new SalesImportUploadResponse
            {
                Success = false,
                Status = "Failed",
                Message = "No file uploaded."
            });
        }

        // Validate file extension
        var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant();
        if (extension != ".xlsx" && extension != ".xls")
        {
            return BadRequest(new SalesImportUploadResponse
            {
                Success = false,
                Status = "Failed",
                Message = "Invalid file type. Please upload an Excel file (.xlsx or .xls)."
            });
        }

        // Validate source company
        var validCompanies = new[] { "PMT", "ACM", "PHT", "SBT" };
        if (string.IsNullOrEmpty(sourceCompany) || !validCompanies.Contains(sourceCompany.ToUpper()))
        {
            return BadRequest(new SalesImportUploadResponse
            {
                Success = false,
                Status = "Failed",
                Message = $"Invalid source company. Must be one of: {string.Join(", ", validCompanies)}"
            });
        }

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        
        _logger.LogInformation(
            "Sales report upload started: {FileName}, Company: {Company}, User: {UserId}, StrictMode: {StrictMode}",
            file.FileName, sourceCompany, userId, strictMode);

        try
        {
            using var stream = file.OpenReadStream();
            var result = await _importService.ParseAndStoreAsync(
                stream,
                file.FileName,
                sourceCompany.ToUpper(),
                userId,
                strictMode);

            if (result.Status == "Failed")
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process sales report: {FileName}", file.FileName);
            return StatusCode(500, new SalesImportUploadResponse
            {
                Success = false,
                Status = "Failed",
                Message = $"An error occurred while processing the file: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// Get import batch status and summary
    /// GET /api/imports/{importId}
    /// </summary>
    [HttpGet("{importId:guid}")]
    public async Task<ActionResult<ImportBatchStatusResponse>> GetImportStatus(Guid importId)
    {
        var result = await _importService.GetImportStatusAsync(importId);
        
        if (result == null)
        {
            return NotFound(new { message = "Import batch not found." });
        }

        return Ok(result);
    }

    /// <summary>
    /// Get paginated transactions for an import
    /// GET /api/imports/{importId}/transactions
    /// </summary>
    [HttpGet("{importId:guid}/transactions")]
    public async Task<ActionResult<SalesTransactionPagedResponse>> GetTransactions(
        Guid importId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 50;

        var result = await _importService.GetTransactionsAsync(importId, page, pageSize);
        return Ok(result);
    }

    /// <summary>
    /// Commit an import - move staging data to production
    /// POST /api/imports/{importId}/commit
    /// </summary>
    [HttpPost("{importId:guid}/commit")]
    public async Task<ActionResult<SalesImportCommitResponse>> CommitImport(Guid importId)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var result = await _importService.CommitImportAsync(importId, userId);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Cancel an import - delete staging data
    /// DELETE /api/imports/{importId}
    /// </summary>
    [HttpDelete("{importId:guid}")]
    public async Task<ActionResult> CancelImport(Guid importId)
    {
        var success = await _importService.CancelImportAsync(importId);
        
        if (!success)
        {
            return BadRequest(new { message = "Cannot cancel this import. It may not exist or is already committed." });
        }

        return Ok(new { message = "Import cancelled successfully." });
    }

    /// <summary>
    /// Get list of all import batches
    /// GET /api/imports
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ImportBatchStatusResponse>>> GetImportBatches(
        [FromQuery] string? sourceCompany = null)
    {
        var result = await _importService.GetImportBatchesAsync(sourceCompany);
        return Ok(result);
    }
}
