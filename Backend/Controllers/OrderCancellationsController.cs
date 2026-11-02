using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OrderCancellationsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public OrderCancellationsController(ApplicationDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// An order on a load can't simply be cancelled: its lines would still go out on the truck (or,
        /// once stock is deducted, stay deducted). It has to come off the load first. Returns null when the
        /// rows can be cancelled, otherwise the response explaining what to do.
        /// </summary>
        private async Task<ActionResult?> RefuseIfNotCancellableAsync(List<ImportedInvoice> rows)
        {
            if (rows.Any(r => r.Status == "Delivered"))
                return BadRequest("Cannot cancel a delivered order");

            var onLoad = rows.FirstOrDefault(r => r.LoadId != null);
            if (onLoad == null) return null;

            var load = await _context.Loads.AsNoTracking().Where(l => l.Id == onLoad.LoadId).Select(l => new { l.Id, l.LoadNumber }).FirstOrDefaultAsync();
            if (load != null && await LoadStockGuard.HasLiveDeductionAsync(_context, load.Id))
                return Conflict(LoadStockGuard.Blocked(load.LoadNumber, $"cancel order {onLoad.TransactionNumber}"));
            var text = $"Order {onLoad.TransactionNumber} is on {load?.LoadNumber ?? "a load"}. Take it off the load first, then cancel it.";
            return Conflict(new { error = text, message = text, code = "on-load" });
        }

        /// <summary>The invoice rows a cancellation covers: every line of the order, or just the one row it was raised on.</summary>
        private async Task<List<ImportedInvoice>> CoveredRowsAsync(OrderCancellation c)
        {
            if (c.ItemCount > 1 && !string.IsNullOrEmpty(c.OrderNumber))
                return await _context.ImportedInvoices.Where(i => i.TransactionNumber == c.OrderNumber && i.Status == "Cancelled").ToListAsync();
            if (c.ImportedInvoiceId is int id)
                return await _context.ImportedInvoices.Where(i => i.Id == id && i.Status == "Cancelled").ToListAsync();
            return new List<ImportedInvoice>();
        }

        /// <summary>Undo a cancellation on its rows. Cancelling is refused for rows on a load, so they go back to the open queue.</summary>
        private static void Restore(IEnumerable<ImportedInvoice> rows)
        {
            foreach (var r in rows)
            {
                r.Status = r.LoadId != null ? "Assigned" : "Pending";
                r.UpdatedAt = DateTime.UtcNow;
            }
        }

        // GET: api/OrderCancellations
        [HttpGet]
        public async Task<ActionResult<IEnumerable<OrderCancellation>>> GetCancellations(
            [FromQuery] string? status = null,
            [FromQuery] string? companyCode = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            var query = _context.OrderCancellations
                .Include(c => c.Customer)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.ApprovalStatus == status);

            if (!string.IsNullOrEmpty(companyCode))
                query = query.Where(c => c.CompanyCode == companyCode);

            if (fromDate.HasValue)
                query = query.Where(c => c.CancelledAt >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(c => c.CancelledAt <= toDate.Value);

            return await query.OrderByDescending(c => c.CancelledAt).ToListAsync();
        }

        // GET: api/OrderCancellations/5
        [HttpGet("{id}")]
        public async Task<ActionResult<OrderCancellation>> GetCancellation(int id)
        {
            var cancellation = await _context.OrderCancellations
                .Include(c => c.Customer)
                .Include(c => c.ImportedInvoice)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (cancellation == null)
                return NotFound();

            return cancellation;
        }

        // GET: api/OrderCancellations/stats
        [HttpGet("stats")]
        public async Task<ActionResult<CancellationStats>> GetStats()
        {
            var today = DateTime.UtcNow.Date;
            var cancellations = await _context.OrderCancellations.ToListAsync();

            var stats = new CancellationStats
            {
                TotalCancellations = cancellations.Count,
                PendingApproval = cancellations.Count(c => c.ApprovalStatus == "Pending"),
                ApprovedToday = cancellations.Count(c => c.ApprovalStatus == "Approved" && c.ApprovedAt?.Date == today),
                RejectedToday = cancellations.Count(c => c.ApprovalStatus == "Rejected" && c.ApprovedAt?.Date == today),
                TotalRefundAmount = cancellations.Where(c => c.RefundAmount.HasValue).Sum(c => c.RefundAmount!.Value),
                PendingRefundAmount = cancellations.Where(c => c.RefundAmount.HasValue && !c.RefundProcessed).Sum(c => c.RefundAmount!.Value),
                ByReason = cancellations.GroupBy(c => c.CancellationReason).ToDictionary(g => g.Key, g => g.Count()),
                ByCompany = cancellations.Where(c => !string.IsNullOrEmpty(c.CompanyCode)).GroupBy(c => c.CompanyCode!).ToDictionary(g => g.Key, g => g.Count())
            };

            return stats;
        }

        // POST: api/OrderCancellations
        [HttpPost]
        public async Task<ActionResult<OrderCancellation>> CreateCancellation([FromBody] CreateCancellationRequest request)
        {
            // Every line of the order: an invoice with several products is several rows
            var rows = string.IsNullOrEmpty(request.OrderNumber)
                ? new List<ImportedInvoice>()
                : await _context.ImportedInvoices
                    .Where(i => i.TransactionNumber == request.OrderNumber && i.Status != "Cancelled")
                    .OrderBy(i => i.Id)
                    .ToListAsync();
            var refused = await RefuseIfNotCancellableAsync(rows);
            if (refused != null) return refused;
            var invoice = rows.FirstOrDefault();

            var cancellation = new OrderCancellation
            {
                OrderNumber = request.OrderNumber,
                ImportedInvoiceId = invoice?.Id,
                CustomerNumber = request.CustomerNumber ?? invoice?.CustomerNumber ?? "",
                CustomerName = request.CustomerName ?? invoice?.CustomerName ?? "",
                CustomerId = request.CustomerId ?? invoice?.CustomerId,
                OrderAmount = request.OrderAmount ?? (rows.Count > 0 ? rows.Sum(r => r.SalesAmount) : 0),
                ItemCount = rows.Count > 0 ? rows.Count : (request.ItemCount ?? 1),
                OriginalOrderDate = request.OriginalOrderDate ?? invoice?.TransactionDate ?? DateTime.UtcNow,
                CancellationReason = request.CancellationReason,
                CancellationNotes = request.CancellationNotes,
                CancelledByUserId = request.CancelledByUserId,
                CancelledByUserName = request.CancelledByUserName,
                CompanyCode = request.CompanyCode ?? invoice?.SourceCompany,
                RefundAmount = request.RefundAmount,
                ApprovalStatus = "Pending",
                CancelledAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            _context.OrderCancellations.Add(cancellation);

            foreach (var row in rows)
            {
                row.Status = "Cancelled";
                row.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCancellation), new { id = cancellation.Id }, cancellation);
        }

        // POST: api/OrderCancellations/from-order/{orderId}
        [HttpPost("from-order/{orderId}")]
        public async Task<ActionResult<OrderCancellation>> CancelOrder(int orderId, [FromBody] CancelOrderRequest request)
        {
            var invoice = await _context.ImportedInvoices
                .Include(i => i.Customer)
                .FirstOrDefaultAsync(i => i.Id == orderId);

            if (invoice == null)
                return NotFound("Order not found");

            if (invoice.Status == "Cancelled")
                return BadRequest("Order is already cancelled");

            var refused = await RefuseIfNotCancellableAsync(new List<ImportedInvoice> { invoice });
            if (refused != null) return refused;

            var cancellation = new OrderCancellation
            {
                OrderNumber = invoice.TransactionNumber,
                ImportedInvoiceId = invoice.Id,
                CustomerNumber = invoice.CustomerNumber,
                CustomerName = invoice.CustomerName,
                CustomerId = invoice.CustomerId,
                OrderAmount = invoice.SalesAmount,
                ItemCount = 1, // Could be enhanced to track line items
                OriginalOrderDate = invoice.TransactionDate,
                CancellationReason = request.Reason,
                CancellationNotes = request.Notes,
                CancelledByUserId = request.UserId,
                CancelledByUserName = request.UserName,
                CompanyCode = invoice.SourceCompany,
                RefundAmount = request.RefundAmount ?? invoice.SalesAmount,
                ApprovalStatus = request.AutoApprove ? "Approved" : "Pending",
                CancelledAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            if (request.AutoApprove)
            {
                cancellation.ApprovedByUserId = request.UserId;
                cancellation.ApprovedByUserName = request.UserName;
                cancellation.ApprovedAt = DateTime.UtcNow;
            }

            _context.OrderCancellations.Add(cancellation);

            // Update original invoice status
            invoice.Status = "Cancelled";
            invoice.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCancellation), new { id = cancellation.Id }, cancellation);
        }

        // PUT: api/OrderCancellations/{id}/approve
        [HttpPut("{id}/approve")]
        public async Task<IActionResult> ApproveCancellation(int id, [FromBody] ApprovalRequest request)
        {
            var cancellation = await _context.OrderCancellations.FindAsync(id);
            if (cancellation == null)
                return NotFound();

            cancellation.ApprovalStatus = "Approved";
            cancellation.ApprovedByUserId = request.UserId;
            cancellation.ApprovedByUserName = request.UserName;
            cancellation.ApprovedAt = DateTime.UtcNow;
            cancellation.ApprovalNotes = request.Notes;
            cancellation.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/OrderCancellations/{id}/reject
        [HttpPut("{id}/reject")]
        public async Task<IActionResult> RejectCancellation(int id, [FromBody] ApprovalRequest request)
        {
            var cancellation = await _context.OrderCancellations.FindAsync(id);
            if (cancellation == null)
                return NotFound();

            cancellation.ApprovalStatus = "Rejected";
            cancellation.ApprovedByUserId = request.UserId;
            cancellation.ApprovedByUserName = request.UserName;
            cancellation.ApprovedAt = DateTime.UtcNow;
            cancellation.ApprovalNotes = request.Notes;
            cancellation.UpdatedAt = DateTime.UtcNow;

            // Revert the order's rows to their real status
            Restore(await CoveredRowsAsync(cancellation));

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/OrderCancellations/{id}/process-refund
        [HttpPut("{id}/process-refund")]
        public async Task<IActionResult> ProcessRefund(int id, [FromBody] RefundRequest request)
        {
            var cancellation = await _context.OrderCancellations.FindAsync(id);
            if (cancellation == null)
                return NotFound();

            if (cancellation.ApprovalStatus != "Approved")
                return BadRequest("Cancellation must be approved before processing refund");

            if (cancellation.RefundProcessed)
                return BadRequest("Refund has already been processed");

            cancellation.RefundAmount = request.Amount;
            cancellation.RefundProcessed = true;
            cancellation.RefundProcessedAt = DateTime.UtcNow;
            cancellation.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/OrderCancellations/pending
        [HttpGet("pending")]
        public async Task<ActionResult<IEnumerable<OrderCancellation>>> GetPendingCancellations()
        {
            return await _context.OrderCancellations
                .Where(c => c.ApprovalStatus == "Pending")
                .OrderByDescending(c => c.CancelledAt)
                .Include(c => c.Customer)
                .ToListAsync();
        }

        // GET: api/OrderCancellations/by-customer/{customerId}
        [HttpGet("by-customer/{customerId}")]
        public async Task<ActionResult<IEnumerable<OrderCancellation>>> GetByCustomer(int customerId)
        {
            return await _context.OrderCancellations
                .Where(c => c.CustomerId == customerId)
                .OrderByDescending(c => c.CancelledAt)
                .ToListAsync();
        }

        // DELETE: api/OrderCancellations/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCancellation(int id)
        {
            var cancellation = await _context.OrderCancellations.FindAsync(id);
            if (cancellation == null)
                return NotFound();

            // Only allow deletion of pending cancellations
            if (cancellation.ApprovalStatus != "Pending")
                return BadRequest("Cannot delete processed cancellations");

            // Revert the order's rows to their real status
            Restore(await CoveredRowsAsync(cancellation));

            _context.OrderCancellations.Remove(cancellation);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }

    // Request DTOs
    public class CreateCancellationRequest
    {
        public string OrderNumber { get; set; } = string.Empty;
        public string? CustomerNumber { get; set; }
        public string? CustomerName { get; set; }
        public int? CustomerId { get; set; }
        public decimal? OrderAmount { get; set; }
        public int? ItemCount { get; set; }
        public DateTime? OriginalOrderDate { get; set; }
        public string CancellationReason { get; set; } = string.Empty;
        public string? CancellationNotes { get; set; }
        public int CancelledByUserId { get; set; }
        public string? CancelledByUserName { get; set; }
        public string? CompanyCode { get; set; }
        public decimal? RefundAmount { get; set; }
    }

    public class CancelOrderRequest
    {
        public string Reason { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public int UserId { get; set; }
        public string? UserName { get; set; }
        public decimal? RefundAmount { get; set; }
        public bool AutoApprove { get; set; }
    }

    public class ApprovalRequest
    {
        public int UserId { get; set; }
        public string? UserName { get; set; }
        public string? Notes { get; set; }
    }

    public class RefundRequest
    {
        public decimal Amount { get; set; }
    }
}
