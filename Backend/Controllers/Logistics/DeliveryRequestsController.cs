using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Projects;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/delivery-requests")]
    public class DeliveryRequestsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<DeliveryRequestsController> _logger;

        public DeliveryRequestsController(ApplicationDbContext context, ILogger<DeliveryRequestsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Get all incoming delivery requests from all departments (Pending, Approved, In Transit)
        /// Excludes Delivered and Cancelled requests (they've been handled)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? department)
        {
            try
            {
                var query = _context.CondomDeliveryRequests.AsQueryable();

                if (!string.IsNullOrWhiteSpace(status) && status != "all")
                    query = query.Where(r => r.Status == status);
                else
                    // Default: show active requests only
                    query = query.Where(r => r.Status != "Delivered" && r.Status != "Cancelled");

                if (!string.IsNullOrWhiteSpace(department) && department != "all")
                    query = query.Where(r => r.Department == department);

                var requests = await query
                    .OrderByDescending(r => r.Priority == "Urgent")
                    .ThenByDescending(r => r.CreatedAt)
                    .ToListAsync();

                return Ok(requests.Select(r => new
                {
                    r.Id,
                    r.ReferenceNumber,
                    r.Department,
                    r.Scent,
                    r.Type,
                    r.BatchCode,
                    r.InvoiceNumber,
                    r.Quantity,
                    r.UOM,
                    r.DeliveryAddress,
                    r.Notes,
                    r.Status,
                    r.Priority,
                    r.RequestedDate,
                    r.RequestedBy,
                    r.ApprovedDate,
                    r.DeliveredDate,
                    r.HandledBy,
                    r.CreatedAt
                }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching delivery requests");
                return StatusCode(500, new { error = "Failed to load delivery requests" });
            }
        }

        /// <summary>
        /// Get summary counts for the incoming requests card
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            try
            {
                var pending = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "Pending");
                var approved = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "Approved");
                var inTransit = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "In Transit");
                var delivered = await _context.CondomDeliveryRequests.CountAsync(r => r.Status == "Delivered");
                var total = pending + approved + inTransit;

                return Ok(new { total, pending, approved, inTransit, delivered });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching delivery request summary");
                return StatusCode(500, new { error = "Failed to load summary" });
            }
        }

        /// <summary>
        /// Update a delivery request status (Approve, In Transit, Delivered, Cancel)
        /// </summary>
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateDeliveryStatusRequest dto)
        {
            try
            {
                var request = await _context.CondomDeliveryRequests.FindAsync(id);
                if (request == null)
                    return NotFound(new { error = "Delivery request not found" });

                var validStatuses = new[] { "Pending", "Approved", "In Transit", "Delivered", "Cancelled" };
                if (!validStatuses.Contains(dto.Status))
                    return BadRequest(new { error = $"Invalid status. Must be one of: {string.Join(", ", validStatuses)}" });

                var oldStatus = request.Status;
                request.Status = dto.Status;
                request.HandledBy = dto.HandledBy;

                if (dto.Status == "Approved")
                    request.ApprovedDate = DateTime.UtcNow;
                else if (dto.Status == "Delivered")
                    request.DeliveredDate = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Delivery request {Ref} status changed from {Old} to {New} by {Handler}",
                    request.ReferenceNumber, oldStatus, dto.Status, dto.HandledBy);

                return Ok(new { success = true, message = $"{request.ReferenceNumber} updated to {dto.Status}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating delivery request status");
                return StatusCode(500, new { error = "Failed to update status" });
            }
        }

        /// <summary>
        /// Mark delivery requests as fulfilled when their invoice is linked to a tripsheet
        /// Called from the tripsheet creation flow
        /// </summary>
        [HttpPost("fulfill-by-invoice")]
        public async Task<IActionResult> FulfillByInvoice([FromBody] FulfillByInvoiceRequest dto)
        {
            try
            {
                // Find any pending/approved delivery requests matching this invoice
                var matchingRequests = await _context.CondomDeliveryRequests
                    .Where(r => r.InvoiceNumber == dto.InvoiceNumber
                        && (r.Status == "Pending" || r.Status == "Approved" || r.Status == "In Transit"))
                    .ToListAsync();

                if (!matchingRequests.Any())
                    return Ok(new { success = true, fulfilled = 0, message = "No matching requests found" });

                foreach (var request in matchingRequests)
                {
                    request.Status = "Delivered";
                    request.DeliveredDate = DateTime.UtcNow;
                    request.HandledBy = dto.HandledBy ?? "System (Tripsheet Link)";
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation("Auto-fulfilled {Count} delivery requests for invoice {Invoice}",
                    matchingRequests.Count, dto.InvoiceNumber);

                return Ok(new
                {
                    success = true,
                    fulfilled = matchingRequests.Count,
                    message = $"{matchingRequests.Count} request(s) fulfilled"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fulfilling delivery requests by invoice");
                return StatusCode(500, new { error = "Failed to fulfill requests" });
            }
        }
    }

    public class UpdateDeliveryStatusRequest
    {
        public string Status { get; set; } = string.Empty;
        public string? HandledBy { get; set; }
    }

    public class FulfillByInvoiceRequest
    {
        public string InvoiceNumber { get; set; } = string.Empty;
        public string? HandledBy { get; set; }
    }
}
