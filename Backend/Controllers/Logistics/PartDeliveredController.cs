using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/part-delivered")]
    public class PartDeliveredController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PartDeliveredController> _logger;

        public PartDeliveredController(ApplicationDbContext context, ILogger<PartDeliveredController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Get all part-delivered records (invoices with partial deliveries)
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PartDeliveredDto>>> GetPartDeliveredRecords()
        {
            try
            {
                // Query imported invoices that have delivery tracking
                var invoices = await _context.ImportedInvoices
                    .AsNoTracking()
                    .Include(i => i.Load)
                    .Where(i => i.Quantity > 0) // Only items with quantities
                    .Select(i => new
                    {
                        i.Id,
                        i.TransactionNumber,
                        i.CustomerName,
                        i.ProductDescription,
                        i.ProductCode,
                        i.Quantity,
                        i.DeliveredQuantity,
                        i.LastDeliveryDate,
                        i.SalesAmount,
                        i.LoadId,
                        LoadNumber = i.Load != null ? i.Load.LoadNumber : null
                    })
                    .Take(500)
                    .ToListAsync();

                // Transform to DTOs (compute status in memory)
                var records = invoices.Select(i => new PartDeliveredDto
                {
                    Id = i.Id,
                    InvoiceNumber = i.TransactionNumber ?? $"INV-{i.Id}",
                    Customer = i.CustomerName ?? "Unknown",
                    Product = i.ProductDescription ?? i.ProductCode ?? "Unknown Product",
                    OrderedQty = (int)i.Quantity,
                    DeliveredQty = (int)(i.DeliveredQuantity ?? 0),
                    RemainingQty = (int)(i.Quantity - (i.DeliveredQuantity ?? 0)),
                    Status = GetDeliveryStatus(i.Quantity, i.DeliveredQuantity ?? 0),
                    LastDeliveryDate = i.LastDeliveryDate,
                    UnitPrice = i.Quantity > 0 ? i.SalesAmount / i.Quantity : 0,
                    LoadId = i.LoadId,
                    LoadNumber = i.LoadNumber
                })
                .OrderByDescending(r => r.LastDeliveryDate ?? DateTime.MinValue)
                .ThenBy(r => r.Status == "pending" ? 0 : r.Status == "partial" ? 1 : 2)
                .ToList();

                return Ok(records);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching part-delivered records");
                return StatusCode(500, new { message = "Error fetching part-delivered records", error = ex.Message });
            }
        }

        /// <summary>
        /// Record a partial delivery for an invoice
        /// </summary>
        [HttpPost("{invoiceId}/deliver")]
        public async Task<ActionResult> RecordPartialDelivery(int invoiceId, [FromBody] RecordDeliveryDto dto)
        {
            try
            {
                var invoice = await _context.ImportedInvoices.FindAsync(invoiceId);
                if (invoice == null)
                    return NotFound(new { message = "Invoice not found" });

                var currentDelivered = invoice.DeliveredQuantity ?? 0;
                var newDelivered = currentDelivered + dto.Quantity;
                var remaining = invoice.Quantity - newDelivered;

                if (newDelivered > invoice.Quantity)
                    return BadRequest(new { message = "Delivered quantity cannot exceed ordered quantity" });

                invoice.DeliveredQuantity = newDelivered;
                invoice.LastDeliveryDate = DateTime.UtcNow;
                
                // Update status based on delivery
                if (remaining <= 0)
                    invoice.Status = "Delivered";
                else if (newDelivered > 0)
                    invoice.Status = "InProgress";

                // Create delivery history record
                var historyRecord = new Models.Logistics.PartDeliveryHistory
                {
                    ImportedInvoiceId = invoiceId,
                    QuantityDelivered = dto.Quantity,
                    Notes = dto.Notes,
                    Reference = dto.Notes,
                    LoadId = invoice.LoadId,
                    DeliveredAt = DateTime.UtcNow,
                    RecordedByUserName = User.Identity?.Name ?? "System"
                };

                _context.PartDeliveryHistories.Add(historyRecord);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Delivery recorded successfully",
                    deliveredQty = newDelivered,
                    remainingQty = remaining,
                    status = GetDeliveryStatus(invoice.Quantity, newDelivered)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recording partial delivery for invoice {InvoiceId}", invoiceId);
                return StatusCode(500, new { message = "Error recording delivery", error = ex.Message });
            }
        }

        /// <summary>
        /// Get delivery history for an invoice
        /// </summary>
        [HttpGet("{invoiceId}/history")]
        public async Task<ActionResult<IEnumerable<DeliveryHistoryDto>>> GetDeliveryHistory(int invoiceId)
        {
            try
            {
                var history = await _context.PartDeliveryHistories
                    .AsNoTracking()
                    .Include(h => h.Driver)
                    .Include(h => h.Vehicle)
                    .Include(h => h.Load)
                    .Where(h => h.ImportedInvoiceId == invoiceId)
                    .OrderByDescending(h => h.DeliveredAt)
                    .Select(h => new DeliveryHistoryDto
                    {
                        Id = h.Id,
                        Quantity = (int)h.QuantityDelivered,
                        Date = h.DeliveredAt,
                        Reference = h.Reference ?? h.Notes ?? "",
                        User = h.RecordedByUserName ?? "Unknown",
                        Driver = h.Driver != null ? $"{h.Driver.FirstName} {h.Driver.LastName}" : null,
                        Vehicle = h.Vehicle != null ? h.Vehicle.RegistrationNumber : null,
                        LoadNumber = h.Load != null ? h.Load.LoadNumber : null,
                        Notes = h.Notes
                    })
                    .ToListAsync();

                return Ok(history);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching delivery history for invoice {InvoiceId}", invoiceId);
                return StatusCode(500, new { message = "Error fetching delivery history", error = ex.Message });
            }
        }

        /// <summary>
        /// Get summary statistics for part-delivered items
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult> GetPartDeliveredStats()
        {
            try
            {
                var invoices = await _context.ImportedInvoices
                    .AsNoTracking()
                    .Where(i => i.Quantity > 0)
                    .Select(i => new
                    {
                        Quantity = i.Quantity,
                        DeliveredQuantity = i.DeliveredQuantity ?? 0,
                        SalesAmount = i.SalesAmount
                    })
                    .ToListAsync();

                var stats = new
                {
                    Pending = invoices.Count(i => i.DeliveredQuantity == 0),
                    Partial = invoices.Count(i => i.DeliveredQuantity > 0 && i.DeliveredQuantity < i.Quantity),
                    Complete = invoices.Count(i => i.DeliveredQuantity >= i.Quantity),
                    OutstandingValue = invoices
                        .Where(i => i.DeliveredQuantity < i.Quantity)
                        .Sum(i => (i.Quantity - i.DeliveredQuantity) * (i.SalesAmount / (i.Quantity > 0 ? i.Quantity : 1)))
                };

                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching part-delivered stats");
                return StatusCode(500, new { message = "Error fetching stats", error = ex.Message });
            }
        }

        private static string GetDeliveryStatus(decimal ordered, decimal delivered)
        {
            if (delivered <= 0) return "pending";
            if (delivered >= ordered) return "complete";
            return "partial";
        }
    }

    public class PartDeliveredDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public string Customer { get; set; } = string.Empty;
        public string Product { get; set; } = string.Empty;
        public int OrderedQty { get; set; }
        public int DeliveredQty { get; set; }
        public int RemainingQty { get; set; }
        public string Status { get; set; } = "pending";
        public DateTime? LastDeliveryDate { get; set; }
        public decimal UnitPrice { get; set; }
        public int? LoadId { get; set; }
        public string? LoadNumber { get; set; }
    }

    public class RecordDeliveryDto
    {
        public decimal Quantity { get; set; }
        public string? Notes { get; set; }
    }

    public class DeliveryHistoryDto
    {
        public int Id { get; set; }
        public int Quantity { get; set; }
        public DateTime Date { get; set; }
        public string Reference { get; set; } = string.Empty;
        public string User { get; set; } = string.Empty;
        public string? Driver { get; set; }
        public string? Vehicle { get; set; }
        public string? LoadNumber { get; set; }
        public string? Notes { get; set; }
    }
}
