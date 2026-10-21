using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/stock-issues")]
    public class StockIssuesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<StockIssuesController> _logger;

        public StockIssuesController(ApplicationDbContext context, ILogger<StockIssuesController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/logistics/stock-issues?warehouseId=1&status=Open
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetIssues([FromQuery] int? warehouseId, [FromQuery] string? status)
        {
            try
            {
                var query = _context.StockIssues.Include(i => i.Warehouse).AsQueryable();
                if (warehouseId.HasValue) query = query.Where(i => i.WarehouseId == warehouseId.Value);
                if (!string.IsNullOrEmpty(status)) query = query.Where(i => i.Status == status);

                var issues = await query
                    .OrderBy(i => i.Status == "Resolved" || i.Status == "Dismissed")
                    .ThenByDescending(i => i.IssueDate ?? i.CreatedAt)
                    .Select(i => new
                    {
                        i.Id,
                        i.WarehouseId,
                        WarehouseName = i.Warehouse != null ? i.Warehouse.Name : null,
                        i.Company,
                        i.ItemCode,
                        i.ItemDescription,
                        i.IssueType,
                        i.Detail,
                        i.IssueDate,
                        i.Status,
                        i.Resolution,
                        i.ResolvedBy,
                        i.ResolvedAt,
                        i.CreatedBy,
                        i.CreatedAt,
                        i.Source
                    })
                    .ToListAsync();

                return Ok(issues);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving stock issues");
                return StatusCode(500, new { message = "An error occurred while retrieving stock issues" });
            }
        }

        // POST: api/logistics/stock-issues
        [HttpPost]
        public async Task<ActionResult<object>> CreateIssue([FromBody] StockIssueDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.IssueType))
                    return BadRequest(new { message = "IssueType is required" });

                var issue = new StockIssue
                {
                    WarehouseId = dto.WarehouseId,
                    Company = dto.Company,
                    ItemCode = dto.ItemCode,
                    ItemDescription = dto.ItemDescription,
                    IssueType = dto.IssueType,
                    Detail = dto.Detail,
                    IssueDate = dto.IssueDate ?? DateTime.UtcNow,
                    Status = "Open",
                    CreatedBy = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? "Unknown",
                    CreatedAt = DateTime.UtcNow,
                    Source = "Manual"
                };

                _context.StockIssues.Add(issue);
                await _context.SaveChangesAsync();
                return Ok(new { issue.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating stock issue");
                return StatusCode(500, new { message = "An error occurred while creating the stock issue" });
            }
        }

        // PUT: api/logistics/stock-issues/{id}/status
        [HttpPut("{id}/status")]
        public async Task<ActionResult> UpdateStatus(int id, [FromBody] StockIssueStatusDto dto)
        {
            try
            {
                var issue = await _context.StockIssues.FindAsync(id);
                if (issue == null) return NotFound(new { message = "Issue not found" });

                var valid = new[] { "Open", "InProgress", "Resolved", "Dismissed" };
                if (!valid.Contains(dto.Status))
                    return BadRequest(new { message = "Invalid status" });

                issue.Status = dto.Status;
                if (dto.Status == "Resolved" || dto.Status == "Dismissed")
                {
                    issue.Resolution = dto.Resolution;
                    issue.ResolvedBy = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? "Unknown";
                    issue.ResolvedAt = DateTime.UtcNow;
                }
                else
                {
                    issue.Resolution = dto.Resolution ?? issue.Resolution;
                }

                await _context.SaveChangesAsync();
                return Ok(new { issue.Id, issue.Status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating stock issue {Id}", id);
                return StatusCode(500, new { message = "An error occurred while updating the stock issue" });
            }
        }

        // DELETE: api/logistics/stock-issues/{id}
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteIssue(int id)
        {
            var issue = await _context.StockIssues.FindAsync(id);
            if (issue == null) return NotFound(new { message = "Issue not found" });
            _context.StockIssues.Remove(issue);
            await _context.SaveChangesAsync();
            return Ok(new { deleted = id });
        }
    }

    public class StockIssueDto
    {
        public int? WarehouseId { get; set; }
        public string? Company { get; set; }
        public string? ItemCode { get; set; }
        public string? ItemDescription { get; set; }
        public string IssueType { get; set; } = string.Empty;
        public string? Detail { get; set; }
        public DateTime? IssueDate { get; set; }
    }

    public class StockIssueStatusDto
    {
        public string Status { get; set; } = string.Empty;
        public string? Resolution { get; set; }
    }
}
