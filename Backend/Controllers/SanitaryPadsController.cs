using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Projects;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SanitaryPadsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SanitaryPadsController> _logger;

        public SanitaryPadsController(ApplicationDbContext context, ILogger<SanitaryPadsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ====================================================================
        // DASHBOARD / SUMMARY
        // ====================================================================

        /// <summary>
        /// Get the full dashboard summary for the sanitary pads project
        /// </summary>
        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
        {
            try
            {
                var stockReceived = await _context.PadsStockReceived.ToListAsync();
                var stockDelivered = await _context.PadsStockDelivered.ToListAsync();
                var warehouseStock = await _context.PadsWarehouseStock.ToListAsync();
                var creditNotes = await _context.PadsCreditNotes.ToListAsync();
                var invoicesProcessed = await _context.PadsInvoicesProcessed.ToListAsync();

                var totalReceived = stockReceived.Sum(s => s.QuantityReceived);
                var totalDelivered = stockDelivered.Sum(s => s.QuantityDelivered);
                var totalValue = stockReceived.Sum(s => s.SubTotal);
                var systemStock = warehouseStock.Where(w => w.StockType == "System" && !w.IsDamaged).Sum(w => w.Quantity);
                var physicalStock = warehouseStock.Where(w => w.StockType == "Physical" && !w.IsDamaged).Sum(w => w.Quantity);
                var damagedStock = warehouseStock.Where(w => w.IsDamaged).Sum(w => w.Quantity);

                // Quarter breakdown
                var quarters = stockReceived
                    .Where(s => s.Quarter.HasValue)
                    .GroupBy(s => s.Quarter!.Value)
                    .Select(g => new
                    {
                        quarter = g.Key,
                        stockIn = g.Sum(x => x.QuantityReceived),
                        stockDeliveredQty = stockDelivered.Where(d => d.Quarter == g.Key).Sum(d => d.QuantityDelivered),
                        value = g.Sum(x => x.SubTotal)
                    })
                    .OrderBy(q => q.quarter)
                    .ToList();

                // Compute balance per quarter
                var quarterSummaries = new List<object>();
                var runningBalance = 0;
                foreach (var q in quarters)
                {
                    runningBalance += q.stockIn - q.stockDeliveredQty;
                    quarterSummaries.Add(new
                    {
                        q.quarter,
                        q.stockIn,
                        stockDelivered = q.stockDeliveredQty,
                        balance = runningBalance,
                        q.value
                    });
                }

                // By vendor
                var byVendor = stockReceived
                    .GroupBy(s => s.VendorName)
                    .Select(g => new
                    {
                        vendor = g.Key,
                        totalQty = g.Sum(x => x.QuantityReceived),
                        totalValue = g.Sum(x => x.SubTotal),
                        grnCount = g.Count()
                    })
                    .OrderByDescending(v => v.totalQty)
                    .ToList();

                // By month
                var byMonth = stockReceived
                    .GroupBy(s => new { s.InvoiceDate.Year, s.InvoiceDate.Month })
                    .Select(g => new
                    {
                        year = g.Key.Year,
                        month = g.Key.Month,
                        monthName = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yyyy"),
                        qty = g.Sum(x => x.QuantityReceived),
                        value = g.Sum(x => x.SubTotal)
                    })
                    .OrderBy(m => m.year).ThenBy(m => m.month)
                    .ToList();

                // Warehouse stock breakdown
                var warehouseBreakdown = warehouseStock
                    .GroupBy(w => new { w.WarehouseName, w.StockType })
                    .Select(g => new
                    {
                        warehouse = g.Key.WarehouseName,
                        stockType = g.Key.StockType,
                        quantity = g.Sum(x => x.Quantity),
                        damaged = g.Where(x => x.IsDamaged).Sum(x => x.Quantity)
                    })
                    .ToList();

                return Ok(new
                {
                    totalReceived,
                    totalDelivered,
                    currentBalance = totalReceived - totalDelivered,
                    totalValue,
                    systemStock,
                    physicalStock,
                    damagedStock,
                    stockDifference = systemStock - physicalStock,
                    grnCount = stockReceived.Count,
                    quarters = quarterSummaries,
                    byVendor,
                    byMonth,
                    warehouseBreakdown,
                    creditNotes = creditNotes.Select(c => new
                    {
                        c.Id,
                        c.CreditNoteNumber,
                        c.CreditDate,
                        c.Description,
                        c.Amount
                    }),
                    invoicesProcessed = invoicesProcessed.Select(i => new
                    {
                        i.Id,
                        i.InvoiceReference,
                        i.InvoiceDate,
                        i.Description,
                        i.Amount
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pads dashboard");
                return StatusCode(500, new { error = "Failed to load dashboard" });
            }
        }

        // ====================================================================
        // STOCK RECEIVED (GRV/GRN)
        // ====================================================================

        [HttpGet("stock-received")]
        public async Task<IActionResult> GetStockReceived(
            [FromQuery] int? quarter,
            [FromQuery] string? vendor,
            [FromQuery] string? sortBy,
            [FromQuery] string? sortDir)
        {
            try
            {
                var query = _context.PadsStockReceived.AsQueryable();

                if (quarter.HasValue)
                    query = query.Where(s => s.Quarter == quarter.Value);
                if (!string.IsNullOrEmpty(vendor))
                    query = query.Where(s => s.VendorName.Contains(vendor));

                query = (sortBy?.ToLower()) switch
                {
                    "date" => sortDir == "desc" ? query.OrderByDescending(s => s.InvoiceDate) : query.OrderBy(s => s.InvoiceDate),
                    "qty" => sortDir == "desc" ? query.OrderByDescending(s => s.QuantityReceived) : query.OrderBy(s => s.QuantityReceived),
                    "vendor" => sortDir == "desc" ? query.OrderByDescending(s => s.VendorName) : query.OrderBy(s => s.VendorName),
                    "value" => sortDir == "desc" ? query.OrderByDescending(s => s.SubTotal) : query.OrderBy(s => s.SubTotal),
                    _ => query.OrderBy(s => s.InvoiceDate)
                };

                var items = await query.Select(s => new
                {
                    s.Id,
                    s.VendorName,
                    s.GrnNumber,
                    s.ItemCode,
                    s.ItemDescription,
                    s.Reference,
                    s.InvoiceNumber,
                    s.Location,
                    s.InvoiceDate,
                    s.UOM,
                    s.QuantityReceived,
                    s.UnitCost,
                    s.SubTotal,
                    s.Quarter,
                    s.Notes
                }).ToListAsync();

                return Ok(new { items, totalCount = items.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching stock received");
                return StatusCode(500, new { error = "Failed to load stock received" });
            }
        }

        [HttpPost("stock-received")]
        public async Task<IActionResult> AddStockReceived([FromBody] PadsStockReceivedRequest request)
        {
            try
            {
                var record = new PadsStockReceived
                {
                    VendorName = request.VendorName,
                    GrnNumber = request.GrnNumber,
                    ItemCode = request.ItemCode ?? "PAD02WC",
                    ItemDescription = request.ItemDescription ?? "SANITARY PADS",
                    Reference = request.Reference,
                    InvoiceNumber = request.InvoiceNumber,
                    Location = request.Location,
                    InvoiceDate = request.InvoiceDate,
                    UOM = request.UOM ?? "BOX",
                    QuantityReceived = request.QuantityReceived,
                    UnitCost = request.UnitCost,
                    SubTotal = request.QuantityReceived * request.UnitCost,
                    Quarter = request.Quarter,
                    Notes = request.Notes
                };

                _context.PadsStockReceived.Add(record);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Stock received recorded", id = record.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding stock received");
                return StatusCode(500, new { error = "Failed to add stock received" });
            }
        }

        [HttpPut("stock-received/{id}")]
        public async Task<IActionResult> UpdateStockReceived(int id, [FromBody] PadsStockReceivedRequest request)
        {
            try
            {
                var record = await _context.PadsStockReceived.FindAsync(id);
                if (record == null) return NotFound();

                record.VendorName = request.VendorName;
                record.GrnNumber = request.GrnNumber;
                record.ItemCode = request.ItemCode ?? record.ItemCode;
                record.ItemDescription = request.ItemDescription ?? record.ItemDescription;
                record.Reference = request.Reference;
                record.InvoiceNumber = request.InvoiceNumber;
                record.Location = request.Location;
                record.InvoiceDate = request.InvoiceDate;
                record.UOM = request.UOM ?? record.UOM;
                record.QuantityReceived = request.QuantityReceived;
                record.UnitCost = request.UnitCost;
                record.SubTotal = request.QuantityReceived * request.UnitCost;
                record.Quarter = request.Quarter;
                record.Notes = request.Notes;
                record.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return Ok(new { message = "Updated" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating stock received");
                return StatusCode(500, new { error = "Failed to update" });
            }
        }

        [HttpDelete("stock-received/{id}")]
        public async Task<IActionResult> DeleteStockReceived(int id)
        {
            try
            {
                var record = await _context.PadsStockReceived.FindAsync(id);
                if (record == null) return NotFound();

                _context.PadsStockReceived.Remove(record);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Deleted" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting stock received");
                return StatusCode(500, new { error = "Failed to delete" });
            }
        }

        // ====================================================================
        // STOCK DELIVERED
        // ====================================================================

        [HttpGet("stock-delivered")]
        public async Task<IActionResult> GetStockDelivered([FromQuery] int? quarter)
        {
            try
            {
                var query = _context.PadsStockDelivered.AsQueryable();
                if (quarter.HasValue)
                    query = query.Where(s => s.Quarter == quarter.Value);

                var items = await query.OrderBy(s => s.DeliveryDate).Select(s => new
                {
                    s.Id,
                    s.DeliveryReference,
                    s.InvoiceNumber,
                    s.QuantityDelivered,
                    s.UOM,
                    s.Quarter,
                    s.DeliveryDate,
                    s.Notes
                }).ToListAsync();

                return Ok(new { items, totalCount = items.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching stock delivered");
                return StatusCode(500, new { error = "Failed to load" });
            }
        }

        [HttpPost("stock-delivered")]
        public async Task<IActionResult> AddStockDelivered([FromBody] PadsStockDeliveredRequest request)
        {
            try
            {
                var record = new PadsStockDelivered
                {
                    DeliveryReference = request.DeliveryReference,
                    InvoiceNumber = request.InvoiceNumber,
                    QuantityDelivered = request.QuantityDelivered,
                    UOM = request.UOM ?? "BOX",
                    Quarter = request.Quarter,
                    DeliveryDate = request.DeliveryDate,
                    Notes = request.Notes
                };

                _context.PadsStockDelivered.Add(record);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Stock delivery recorded", id = record.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding stock delivered");
                return StatusCode(500, new { error = "Failed to add" });
            }
        }

        [HttpDelete("stock-delivered/{id}")]
        public async Task<IActionResult> DeleteStockDelivered(int id)
        {
            try
            {
                var record = await _context.PadsStockDelivered.FindAsync(id);
                if (record == null) return NotFound();
                _context.PadsStockDelivered.Remove(record);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Deleted" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting stock delivered");
                return StatusCode(500, new { error = "Failed to delete" });
            }
        }

        // ====================================================================
        // WAREHOUSE STOCK
        // ====================================================================

        [HttpGet("warehouse-stock")]
        public async Task<IActionResult> GetWarehouseStock()
        {
            try
            {
                var items = await _context.PadsWarehouseStock
                    .OrderByDescending(w => w.SnapshotDate)
                    .Select(w => new
                    {
                        w.Id,
                        w.WarehouseName,
                        w.StockType,
                        w.Quantity,
                        w.UOM,
                        w.IsDamaged,
                        w.Notes,
                        w.SnapshotDate
                    }).ToListAsync();

                return Ok(items);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching warehouse stock");
                return StatusCode(500, new { error = "Failed to load" });
            }
        }

        [HttpPost("warehouse-stock")]
        public async Task<IActionResult> UpdateWarehouseStock([FromBody] PadsWarehouseStockRequest request)
        {
            try
            {
                var record = new PadsWarehouseStock
                {
                    WarehouseName = request.WarehouseName,
                    StockType = request.StockType ?? "Physical",
                    Quantity = request.Quantity,
                    UOM = request.UOM ?? "BOX",
                    IsDamaged = request.IsDamaged,
                    Notes = request.Notes,
                    SnapshotDate = request.SnapshotDate ?? DateTime.UtcNow
                };

                _context.PadsWarehouseStock.Add(record);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Warehouse stock recorded", id = record.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating warehouse stock");
                return StatusCode(500, new { error = "Failed to update" });
            }
        }

        // ====================================================================
        // CREDIT NOTES
        // ====================================================================

        [HttpGet("credit-notes")]
        public async Task<IActionResult> GetCreditNotes()
        {
            try
            {
                var items = await _context.PadsCreditNotes
                    .OrderByDescending(c => c.CreditDate)
                    .ToListAsync();
                return Ok(items);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching credit notes");
                return StatusCode(500, new { error = "Failed to load" });
            }
        }

        [HttpPost("credit-notes")]
        public async Task<IActionResult> AddCreditNote([FromBody] PadsCreditNoteRequest request)
        {
            try
            {
                var record = new PadsCreditNote
                {
                    CreditNoteNumber = request.CreditNoteNumber,
                    CreditDate = request.CreditDate,
                    Description = request.Description,
                    Amount = request.Amount
                };

                _context.PadsCreditNotes.Add(record);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Credit note added", id = record.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding credit note");
                return StatusCode(500, new { error = "Failed to add" });
            }
        }

        // ====================================================================
        // INVOICES PROCESSED
        // ====================================================================

        [HttpGet("invoices-processed")]
        public async Task<IActionResult> GetInvoicesProcessed()
        {
            try
            {
                var items = await _context.PadsInvoicesProcessed
                    .OrderByDescending(i => i.InvoiceDate)
                    .ToListAsync();
                return Ok(items);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching invoices processed");
                return StatusCode(500, new { error = "Failed to load" });
            }
        }

        [HttpPost("invoices-processed")]
        public async Task<IActionResult> AddInvoiceProcessed([FromBody] PadsInvoiceProcessedRequest request)
        {
            try
            {
                var record = new PadsInvoiceProcessed
                {
                    InvoiceReference = request.InvoiceReference,
                    InvoiceDate = request.InvoiceDate,
                    Description = request.Description,
                    Amount = request.Amount
                };

                _context.PadsInvoicesProcessed.Add(record);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Invoice record added", id = record.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding invoice record");
                return StatusCode(500, new { error = "Failed to add" });
            }
        }
    }

    // ========================================================================
    // REQUEST DTOs
    // ========================================================================

    public class PadsStockReceivedRequest
    {
        public string VendorName { get; set; } = string.Empty;
        public string GrnNumber { get; set; } = string.Empty;
        public string? ItemCode { get; set; }
        public string? ItemDescription { get; set; }
        public string? Reference { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Location { get; set; }
        public DateTime InvoiceDate { get; set; }
        public string? UOM { get; set; }
        public int QuantityReceived { get; set; }
        public decimal UnitCost { get; set; }
        public int? Quarter { get; set; }
        public string? Notes { get; set; }
    }

    public class PadsStockDeliveredRequest
    {
        public string? DeliveryReference { get; set; }
        public string? InvoiceNumber { get; set; }
        public int QuantityDelivered { get; set; }
        public string? UOM { get; set; }
        public int Quarter { get; set; }
        public DateTime DeliveryDate { get; set; }
        public string? Notes { get; set; }
    }

    public class PadsWarehouseStockRequest
    {
        public string WarehouseName { get; set; } = string.Empty;
        public string? StockType { get; set; }
        public int Quantity { get; set; }
        public string? UOM { get; set; }
        public bool IsDamaged { get; set; }
        public string? Notes { get; set; }
        public DateTime? SnapshotDate { get; set; }
    }

    public class PadsCreditNoteRequest
    {
        public string CreditNoteNumber { get; set; } = string.Empty;
        public DateTime CreditDate { get; set; }
        public string? Description { get; set; }
        public decimal? Amount { get; set; }
    }

    public class PadsInvoiceProcessedRequest
    {
        public string InvoiceReference { get; set; } = string.Empty;
        public DateTime InvoiceDate { get; set; }
        public string? Description { get; set; }
        public decimal? Amount { get; set; }
    }
}
