using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class InvoicesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<InvoicesController> _logger;

        public InvoicesController(ApplicationDbContext context, ILogger<InvoicesController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<InvoiceDto>>> GetInvoices([FromQuery] string? status)
        {
            var query = _context.Invoices
                .Include(i => i.Customer)
                .Include(i => i.Load)
                .Include(i => i.LineItems)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(i => i.Status == status);
            }

            var invoices = await query
                .Select(i => new InvoiceDto
                {
                    Id = i.Id,
                    InvoiceNumber = i.InvoiceNumber,
                    CustomerId = i.CustomerId,
                    CustomerName = i.Customer.Name,
                    LoadId = i.LoadId,
                    LoadNumber = i.Load != null ? i.Load.LoadNumber : null,
                    InvoiceDate = i.InvoiceDate,
                    DueDate = i.DueDate,
                    SubTotal = i.SubTotal,
                    VatAmount = i.VatAmount,
                    Total = i.Total,
                    AmountPaid = i.AmountPaid,
                    Status = i.Status,
                    PaymentMethod = i.PaymentMethod,
                    PaymentDate = i.PaymentDate,
                    PaymentReference = i.PaymentReference,
                    Notes = i.Notes,
                    LineItems = i.LineItems.Select(li => new InvoiceLineItemDto
                    {
                        Id = li.Id,
                        Description = li.Description,
                        Quantity = li.Quantity,
                        UnitPrice = li.UnitPrice,
                        Total = li.Total,
                        VatRate = li.VatRate
                    }).ToList()
                })
                .OrderByDescending(i => i.InvoiceDate)
                .ToListAsync();

            return Ok(invoices);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<InvoiceDto>> GetInvoice(int id)
        {
            var invoice = await _context.Invoices
                .Include(i => i.Customer)
                .Include(i => i.Load)
                .Include(i => i.LineItems)
                .Where(i => i.Id == id)
                .Select(i => new InvoiceDto
                {
                    Id = i.Id,
                    InvoiceNumber = i.InvoiceNumber,
                    CustomerId = i.CustomerId,
                    CustomerName = i.Customer.Name,
                    LoadId = i.LoadId,
                    LoadNumber = i.Load != null ? i.Load.LoadNumber : null,
                    InvoiceDate = i.InvoiceDate,
                    DueDate = i.DueDate,
                    SubTotal = i.SubTotal,
                    VatAmount = i.VatAmount,
                    Total = i.Total,
                    AmountPaid = i.AmountPaid,
                    Status = i.Status,
                    PaymentMethod = i.PaymentMethod,
                    PaymentDate = i.PaymentDate,
                    PaymentReference = i.PaymentReference,
                    Notes = i.Notes,
                    LineItems = i.LineItems.Select(li => new InvoiceLineItemDto
                    {
                        Id = li.Id,
                        Description = li.Description,
                        Quantity = li.Quantity,
                        UnitPrice = li.UnitPrice,
                        Total = li.Total,
                        VatRate = li.VatRate
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (invoice == null)
                return NotFound();

            return Ok(invoice);
        }

        [HttpPost]
        public async Task<ActionResult<InvoiceDto>> CreateInvoice(CreateInvoiceDto dto)
        {
            // Generate invoice number
            var lastInvoice = await _context.Invoices.OrderByDescending(i => i.Id).FirstOrDefaultAsync();
            var invoiceNumber = $"INV{DateTime.Now:yyyyMMdd}{(lastInvoice?.Id ?? 0) + 1:D4}";

            var invoiceDate = dto.InvoiceDate ?? DateTime.UtcNow;
            var dueDate = invoiceDate.AddDays(dto.DueDays);

            // Calculate totals
            decimal subTotal = 0;
            decimal vatAmount = 0;

            var invoice = new Invoice
            {
                InvoiceNumber = invoiceNumber,
                CustomerId = dto.CustomerId,
                LoadId = dto.LoadId,
                InvoiceDate = invoiceDate,
                DueDate = dueDate,
                Notes = dto.Notes,
                Status = "Unpaid"
            };

            _context.Invoices.Add(invoice);
            await _context.SaveChangesAsync();

            // Add line items
            foreach (var lineDto in dto.LineItems)
            {
                var lineTotal = lineDto.Quantity * lineDto.UnitPrice;
                var lineVat = lineDto.VatRate.HasValue ? (lineTotal * lineDto.VatRate.Value / 100) : 0;

                var lineItem = new InvoiceLineItem
                {
                    InvoiceId = invoice.Id,
                    Description = lineDto.Description,
                    Quantity = lineDto.Quantity,
                    UnitPrice = lineDto.UnitPrice,
                    Total = lineTotal,
                    VatRate = lineDto.VatRate ?? dto.VatRate
                };

                _context.InvoiceLineItems.Add(lineItem);

                subTotal += lineTotal;
                vatAmount += lineVat;
            }

            invoice.SubTotal = subTotal;
            invoice.VatAmount = vatAmount;
            invoice.Total = subTotal + vatAmount;

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetInvoice), new { id = invoice.Id }, invoice);
        }

        [HttpPost("{id}/payment")]
        public async Task<IActionResult> RecordPayment(int id, RecordPaymentDto dto)
        {
            var invoice = await _context.Invoices.FindAsync(id);
            if (invoice == null)
                return NotFound();

            invoice.AmountPaid += dto.Amount;
            invoice.PaymentMethod = dto.PaymentMethod;
            invoice.PaymentDate = dto.PaymentDate ?? DateTime.UtcNow;
            invoice.PaymentReference = dto.PaymentReference;

            // Update status
            if (invoice.AmountPaid >= invoice.Total)
            {
                invoice.Status = "Paid";
            }
            else if (invoice.AmountPaid > 0)
            {
                invoice.Status = "Partially Paid";
            }

            invoice.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
