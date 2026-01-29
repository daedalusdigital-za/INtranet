using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services;
using System.Security.Claims;
using System.Globalization;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class ImportedInvoicesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ImportedInvoicesController> _logger;
        private readonly LoadOptimizationService _optimizationService;

        public ImportedInvoicesController(
            ApplicationDbContext context, 
            ILogger<ImportedInvoicesController> logger,
            LoadOptimizationService optimizationService)
        {
            _context = context;
            _logger = logger;
            _optimizationService = optimizationService;
        }

        /// <summary>
        /// Get all imported invoices with optional filtering
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ImportedInvoiceDto>>> GetImportedInvoices(
            [FromQuery] string? status,
            [FromQuery] string? customerNumber,
            [FromQuery] string? search,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] bool? unassigned,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var query = _context.ImportedInvoices
                .AsNoTracking() // Read-only query optimization
                .Include(i => i.Load)
                .Include(i => i.Customer)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(i => i.Status == status);

            if (!string.IsNullOrEmpty(customerNumber))
                query = query.Where(i => i.CustomerNumber == customerNumber);

            if (fromDate.HasValue)
                query = query.Where(i => i.TransactionDate >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(i => i.TransactionDate <= toDate.Value);

            if (unassigned == true)
                query = query.Where(i => i.LoadId == null);

            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(i =>
                    i.TransactionNumber.ToLower().Contains(searchLower) ||
                    i.CustomerName.ToLower().Contains(searchLower) ||
                    i.ProductCode.ToLower().Contains(searchLower) ||
                    i.ProductDescription.ToLower().Contains(searchLower));
            }

            var totalCount = await query.CountAsync();

            var invoices = await query
                .OrderByDescending(i => i.TransactionDate)
                .ThenByDescending(i => i.ImportedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new ImportedInvoiceDto
                {
                    Id = i.Id,
                    CustomerNumber = i.CustomerNumber,
                    CustomerName = i.CustomerName,
                    CustomerId = i.CustomerId,
                    ProductCode = i.ProductCode,
                    ProductDescription = i.ProductDescription,
                    Year = i.Year,
                    Period = i.Period,
                    TransactionType = i.TransactionType,
                    TransactionDate = i.TransactionDate,
                    TransactionNumber = i.TransactionNumber,
                    Category = i.Category,
                    Location = i.Location,
                    Quantity = i.Quantity,
                    SalesAmount = i.SalesAmount,
                    SalesReturns = i.SalesReturns,
                    CostOfSales = i.CostOfSales,
                    MarginPercent = i.MarginPercent,
                    NetSales = i.SalesAmount - i.SalesReturns,
                    GrossProfit = (i.SalesAmount - i.SalesReturns) - i.CostOfSales,
                    Status = i.Status,
                    LoadId = i.LoadId,
                    LoadNumber = i.Load != null ? i.Load.LoadNumber : null,
                    DeliveryAddress = i.DeliveryAddress,
                    DeliveryCity = i.DeliveryCity,
                    DeliveryProvince = i.DeliveryProvince,
                    DeliveryPostalCode = i.DeliveryPostalCode,
                    ContactPerson = i.ContactPerson,
                    ContactPhone = i.ContactPhone,
                    ContactEmail = i.ContactEmail,
                    ScheduledDeliveryDate = i.ScheduledDeliveryDate,
                    DeliveryNotes = i.DeliveryNotes,
                    ImportedAt = i.ImportedAt,
                    ImportBatchId = i.ImportBatchId,
                    SourceSystem = i.SourceSystem,
                    SourceCompany = i.SourceCompany
                })
                .ToListAsync();

            Response.Headers.Append("X-Total-Count", totalCount.ToString());
            Response.Headers.Append("X-Page", page.ToString());
            Response.Headers.Append("X-Page-Size", pageSize.ToString());

            return Ok(invoices);
        }

        /// <summary>
        /// Get a single imported invoice by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<ImportedInvoiceDto>> GetImportedInvoice(int id)
        {
            var invoice = await _context.ImportedInvoices
                .Include(i => i.Load)
                .Include(i => i.Customer)
                .Where(i => i.Id == id)
                .Select(i => new ImportedInvoiceDto
                {
                    Id = i.Id,
                    CustomerNumber = i.CustomerNumber,
                    CustomerName = i.CustomerName,
                    CustomerId = i.CustomerId,
                    ProductCode = i.ProductCode,
                    ProductDescription = i.ProductDescription,
                    Year = i.Year,
                    Period = i.Period,
                    TransactionType = i.TransactionType,
                    TransactionDate = i.TransactionDate,
                    TransactionNumber = i.TransactionNumber,
                    Category = i.Category,
                    Location = i.Location,
                    Quantity = i.Quantity,
                    SalesAmount = i.SalesAmount,
                    SalesReturns = i.SalesReturns,
                    CostOfSales = i.CostOfSales,
                    MarginPercent = i.MarginPercent,
                    NetSales = i.SalesAmount - i.SalesReturns,
                    GrossProfit = (i.SalesAmount - i.SalesReturns) - i.CostOfSales,
                    Status = i.Status,
                    LoadId = i.LoadId,
                    LoadNumber = i.Load != null ? i.Load.LoadNumber : null,
                    DeliveryAddress = i.DeliveryAddress,
                    DeliveryCity = i.DeliveryCity,
                    DeliveryProvince = i.DeliveryProvince,
                    DeliveryPostalCode = i.DeliveryPostalCode,
                    ContactPerson = i.ContactPerson,
                    ContactPhone = i.ContactPhone,
                    ContactEmail = i.ContactEmail,
                    ScheduledDeliveryDate = i.ScheduledDeliveryDate,
                    DeliveryNotes = i.DeliveryNotes,
                    ImportedAt = i.ImportedAt,
                    ImportBatchId = i.ImportBatchId,
                    SourceSystem = i.SourceSystem,
                    SourceCompany = i.SourceCompany
                })
                .FirstOrDefaultAsync();

            if (invoice == null)
                return NotFound(new { error = "Imported invoice not found" });

            return Ok(invoice);
        }

        /// <summary>
        /// Import a single invoice from ERP
        /// </summary>
        [HttpPost("import")]
        public async Task<ActionResult<ImportedInvoiceDto>> ImportSingleInvoice([FromBody] ImportInvoiceDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var batchId = Guid.NewGuid().ToString("N")[..12].ToUpper();

                var invoice = MapToImportedInvoice(dto, batchId, userId);

                // Try to match with existing customer
                await TryMatchCustomer(invoice);

                _context.ImportedInvoices.Add(invoice);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Imported invoice {TransactionNumber} for customer {CustomerName}",
                    invoice.TransactionNumber, invoice.CustomerName);

                return CreatedAtAction(nameof(GetImportedInvoice), new { id = invoice.Id },
                    await GetImportedInvoiceDto(invoice.Id));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing invoice");
                return BadRequest(new { error = "Failed to import invoice", details = ex.Message });
            }
        }

        /// <summary>
        /// Bulk import multiple invoices from ERP
        /// </summary>
        [HttpPost("import/bulk")]
        public async Task<ActionResult<ImportResultDto>> BulkImportInvoices([FromBody] BulkImportInvoicesDto dto)
        {
            var userId = GetCurrentUserId();
            var batchId = Guid.NewGuid().ToString("N")[..12].ToUpper();
            var result = new ImportResultDto
            {
                BatchId = batchId,
                TotalRecords = dto.Invoices.Count
            };

            var importBatch = new ImportBatch
            {
                BatchId = batchId,
                FileName = dto.FileName,
                SourceSystem = dto.SourceSystem,
                TotalRecords = dto.Invoices.Count,
                ImportedByUserId = userId,
                Status = "InProgress"
            };

            _context.ImportBatches.Add(importBatch);

            foreach (var invoiceDto in dto.Invoices)
            {
                try
                {
                    // Check for duplicates
                    var exists = await _context.ImportedInvoices
                        .AnyAsync(i => i.TransactionNumber == invoiceDto.TransactionNumber);

                    if (exists)
                    {
                        result.Errors.Add($"Invoice {invoiceDto.TransactionNumber} already exists - skipped");
                        result.FailedRecords++;
                        continue;
                    }

                    var invoice = MapToImportedInvoice(invoiceDto, batchId, userId, dto.SourceSystem);
                    await TryMatchCustomer(invoice);

                    _context.ImportedInvoices.Add(invoice);
                    result.SuccessfulRecords++;
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"Failed to import invoice {invoiceDto.TransactionNumber}: {ex.Message}");
                    result.FailedRecords++;
                }
            }

            await _context.SaveChangesAsync();

            // Update batch status
            importBatch.SuccessfulRecords = result.SuccessfulRecords;
            importBatch.FailedRecords = result.FailedRecords;
            importBatch.Status = result.FailedRecords == 0 ? "Completed" :
                                 result.SuccessfulRecords == 0 ? "Failed" : "PartialFailure";
            await _context.SaveChangesAsync();

            result.Success = result.SuccessfulRecords > 0;

            _logger.LogInformation("Bulk import completed. Batch: {BatchId}, Success: {Success}, Failed: {Failed}",
                batchId, result.SuccessfulRecords, result.FailedRecords);

            return Ok(result);
        }

        /// <summary>
        /// Update delivery information for an imported invoice
        /// </summary>
        [HttpPut("{id}/delivery")]
        public async Task<ActionResult<ImportedInvoiceDto>> UpdateDeliveryInfo(int id, [FromBody] UpdateImportedInvoiceDeliveryDto dto)
        {
            var invoice = await _context.ImportedInvoices.FindAsync(id);
            if (invoice == null)
                return NotFound(new { error = "Imported invoice not found" });

            invoice.DeliveryAddress = dto.DeliveryAddress ?? invoice.DeliveryAddress;
            invoice.DeliveryCity = dto.DeliveryCity ?? invoice.DeliveryCity;
            invoice.DeliveryProvince = dto.DeliveryProvince ?? invoice.DeliveryProvince;
            invoice.DeliveryPostalCode = dto.DeliveryPostalCode ?? invoice.DeliveryPostalCode;
            invoice.ContactPerson = dto.ContactPerson ?? invoice.ContactPerson;
            invoice.ContactPhone = dto.ContactPhone ?? invoice.ContactPhone;
            invoice.ContactEmail = dto.ContactEmail ?? invoice.ContactEmail;
            invoice.ScheduledDeliveryDate = dto.ScheduledDeliveryDate ?? invoice.ScheduledDeliveryDate;
            invoice.DeliveryNotes = dto.DeliveryNotes ?? invoice.DeliveryNotes;
            invoice.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(await GetImportedInvoiceDto(id));
        }

        /// <summary>
        /// Get AI-suggested optimized loads based on pending invoices
        /// </summary>
        [HttpGet("suggested-loads")]
        public async Task<ActionResult<IEnumerable<SuggestedLoadDto>>> GetSuggestedLoads([FromQuery] int maxLoads = 10)
        {
            try
            {
                var suggestedLoads = await _optimizationService.GenerateSuggestedLoads(maxLoads);
                
                _logger.LogInformation("Generated {Count} suggested loads from pending invoices", suggestedLoads.Count);
                
                return Ok(suggestedLoads);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating suggested loads");
                return BadRequest(new { error = "Failed to generate suggested loads", details = ex.Message });
            }
        }

        /// <summary>
        /// Create a trip sheet/load from selected imported invoices
        /// </summary>
        [HttpPost("create-tripsheet")]
        public async Task<ActionResult<object>> CreateTripSheetFromInvoices([FromBody] CreateTripSheetFromInvoicesDto dto)
        {
            if (dto.InvoiceIds == null || !dto.InvoiceIds.Any())
                return BadRequest(new { error = "No invoices selected" });

            var invoices = await _context.ImportedInvoices
                .Where(i => dto.InvoiceIds.Contains(i.Id) && i.LoadId == null)
                .ToListAsync();

            if (!invoices.Any())
                return BadRequest(new { error = "No unassigned invoices found with the provided IDs" });

            // Generate load number
            var lastLoad = await _context.Loads
                .OrderByDescending(l => l.Id)
                .FirstOrDefaultAsync();
            var nextNumber = (lastLoad?.Id ?? 0) + 1;
            var loadNumber = $"RF-{nextNumber:D6}";

            // Create the load
            var load = new Load
            {
                LoadNumber = loadNumber,
                Status = "Available",
                Priority = "Normal",
                VehicleId = dto.VehicleId,
                DriverId = dto.DriverId,
                WarehouseId = dto.WarehouseId,
                ScheduledPickupDate = dto.ScheduledPickupDate ?? DateTime.UtcNow.Date,
                SpecialInstructions = dto.SpecialInstructions,
                Notes = dto.Notes,
                CreatedByUserId = GetCurrentUserId(),
                CreatedAt = DateTime.UtcNow
            };

            _context.Loads.Add(load);
            await _context.SaveChangesAsync();

            // Group invoices by customer for stops
            var customerGroups = invoices.GroupBy(i => new { i.CustomerNumber, i.CustomerName });
            int stopSequence = 1;

            foreach (var group in customerGroups)
            {
                var firstInvoice = group.First();

                // Create a stop for this customer
                var stop = new LoadStop
                {
                    LoadId = load.Id,
                    StopSequence = stopSequence++,
                    StopType = "Delivery",
                    CompanyName = group.Key.CustomerName,
                    Address = firstInvoice.DeliveryAddress ?? "Address to be confirmed",
                    City = firstInvoice.DeliveryCity,
                    Province = firstInvoice.DeliveryProvince,
                    PostalCode = firstInvoice.DeliveryPostalCode,
                    ContactPerson = firstInvoice.ContactPerson,
                    ContactPhone = firstInvoice.ContactPhone,
                    ContactEmail = firstInvoice.ContactEmail,
                    Notes = string.Join("; ", group.Select(i => $"{i.TransactionNumber}: {i.ProductDescription}")),
                    ScheduledArrival = firstInvoice.ScheduledDeliveryDate,
                    CustomerId = firstInvoice.CustomerId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.LoadStops.Add(stop);

                // Update invoices with load assignment AND create LoadItems
                foreach (var invoice in group)
                {
                    invoice.LoadId = load.Id;
                    invoice.Status = "Assigned";
                    invoice.UpdatedAt = DateTime.UtcNow;

                    // Create LoadItem for each invoice line
                    var loadItem = new LoadItem
                    {
                        LoadId = load.Id,
                        Quantity = invoice.Quantity,
                        UnitOfMeasure = "Unit",
                        Description = $"{invoice.ProductCode}: {invoice.ProductDescription}",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.LoadItems.Add(loadItem);
                }
            }

            // Calculate totals
            load.ChargeAmount = invoices.Sum(i => i.SalesAmount - i.SalesReturns);

            await _context.SaveChangesAsync();

            _logger.LogInformation("Created trip sheet {LoadNumber} from {Count} invoices",
                loadNumber, invoices.Count);

            return Ok(new
            {
                success = true,
                loadId = load.Id,
                loadNumber = load.LoadNumber,
                invoiceCount = invoices.Count,
                totalAmount = load.ChargeAmount,
                stops = stopSequence - 1
            });
        }

        /// <summary>
        /// Get import batches history
        /// </summary>
        [HttpGet("batches")]
        public async Task<ActionResult<IEnumerable<ImportBatchDto>>> GetImportBatches(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var batches = await _context.ImportBatches
                .Include(b => b.ImportedByUser)
                .OrderByDescending(b => b.ImportedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(b => new ImportBatchDto
                {
                    Id = b.Id,
                    BatchId = b.BatchId,
                    FileName = b.FileName,
                    SourceSystem = b.SourceSystem,
                    TotalRecords = b.TotalRecords,
                    SuccessfulRecords = b.SuccessfulRecords,
                    FailedRecords = b.FailedRecords,
                    ImportedAt = b.ImportedAt,
                    ImportedByUserName = b.ImportedByUser != null ? $"{b.ImportedByUser.Name} {b.ImportedByUser.Surname}" : null,
                    Status = b.Status,
                    Notes = b.Notes
                })
                .ToListAsync();

            return Ok(batches);
        }

        /// <summary>
        /// Get invoices by batch ID
        /// </summary>
        [HttpGet("batches/{batchId}/invoices")]
        public async Task<ActionResult<IEnumerable<ImportedInvoiceDto>>> GetInvoicesByBatch(string batchId)
        {
            var invoices = await _context.ImportedInvoices
                .Include(i => i.Load)
                .Where(i => i.ImportBatchId == batchId)
                .OrderBy(i => i.CustomerName)
                .ThenBy(i => i.TransactionNumber)
                .Select(i => new ImportedInvoiceDto
                {
                    Id = i.Id,
                    CustomerNumber = i.CustomerNumber,
                    CustomerName = i.CustomerName,
                    ProductCode = i.ProductCode,
                    ProductDescription = i.ProductDescription,
                    TransactionDate = i.TransactionDate,
                    TransactionNumber = i.TransactionNumber,
                    Quantity = i.Quantity,
                    SalesAmount = i.SalesAmount,
                    NetSales = i.SalesAmount - i.SalesReturns,
                    Status = i.Status,
                    LoadId = i.LoadId,
                    LoadNumber = i.Load != null ? i.Load.LoadNumber : null,
                    ImportedAt = i.ImportedAt
                })
                .ToListAsync();

            return Ok(invoices);
        }

        /// <summary>
        /// Delete an imported invoice
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteImportedInvoice(int id)
        {
            var invoice = await _context.ImportedInvoices.FindAsync(id);
            if (invoice == null)
                return NotFound(new { error = "Imported invoice not found" });

            if (invoice.LoadId != null)
                return BadRequest(new { error = "Cannot delete an invoice that is assigned to a load" });

            _context.ImportedInvoices.Remove(invoice);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Invoice deleted successfully" });
        }

        /// <summary>
        /// Unassign invoice from load
        /// </summary>
        [HttpPost("{id}/unassign")]
        public async Task<ActionResult<ImportedInvoiceDto>> UnassignFromLoad(int id)
        {
            var invoice = await _context.ImportedInvoices.FindAsync(id);
            if (invoice == null)
                return NotFound(new { error = "Imported invoice not found" });

            invoice.LoadId = null;
            invoice.Status = "Pending";
            invoice.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(await GetImportedInvoiceDto(id));
        }

        /// <summary>
        /// Get summary statistics for imported invoices
        /// </summary>
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            var query = _context.ImportedInvoices.AsQueryable();

            if (fromDate.HasValue)
                query = query.Where(i => i.TransactionDate >= fromDate.Value);
            if (toDate.HasValue)
                query = query.Where(i => i.TransactionDate <= toDate.Value);

            var summary = await query
                .GroupBy(i => 1)
                .Select(g => new
                {
                    TotalInvoices = g.Count(),
                    PendingInvoices = g.Count(i => i.Status == "Pending"),
                    AssignedInvoices = g.Count(i => i.Status == "Assigned"),
                    DeliveredInvoices = g.Count(i => i.Status == "Delivered"),
                    TotalSalesAmount = g.Sum(i => i.SalesAmount),
                    TotalNetSales = g.Sum(i => i.SalesAmount - i.SalesReturns),
                    TotalCost = g.Sum(i => i.CostOfSales),
                    TotalGrossProfit = g.Sum(i => (i.SalesAmount - i.SalesReturns) - i.CostOfSales),
                    UniqueCustomers = g.Select(i => i.CustomerNumber).Distinct().Count()
                })
                .FirstOrDefaultAsync();

            return Ok(summary ?? new
            {
                TotalInvoices = 0,
                PendingInvoices = 0,
                AssignedInvoices = 0,
                DeliveredInvoices = 0,
                TotalSalesAmount = 0m,
                TotalNetSales = 0m,
                TotalCost = 0m,
                TotalGrossProfit = 0m,
                UniqueCustomers = 0
            });
        }

        #region Helper Methods

        private ImportedInvoice MapToImportedInvoice(ImportInvoiceDto dto, string batchId, int? userId, string? sourceSystem = null)
        {
            DateTime transactionDate;
            if (!DateTime.TryParse(dto.Date, out transactionDate))
            {
                // Try different date formats
                if (!DateTime.TryParseExact(dto.Date, new[] { "yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy" },
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out transactionDate))
                {
                    transactionDate = DateTime.UtcNow;
                }
            }

            return new ImportedInvoice
            {
                CustomerNumber = dto.Customer.CustomerNumber,
                CustomerName = dto.Customer.CustomerName,
                ProductCode = dto.Product.ProductCode,
                ProductDescription = dto.Product.ProductDescription,
                Year = dto.Year,
                Period = dto.Prd,
                TransactionType = dto.Type,
                TransactionDate = transactionDate,
                TransactionNumber = dto.TransactionNumber,
                Category = dto.Category,
                Location = dto.Location,
                Quantity = dto.Quantity,
                SalesAmount = dto.SalesAmount,
                SalesReturns = dto.SalesReturns,
                CostOfSales = dto.CostOfSales,
                MarginPercent = dto.Percent,
                Status = "Pending",
                ImportedAt = DateTime.UtcNow,
                ImportedByUserId = userId,
                ImportBatchId = batchId,
                SourceSystem = sourceSystem
            };
        }

        private async Task TryMatchCustomer(ImportedInvoice invoice)
        {
            // Try to match with existing logistics customer by customer number or name
            var customer = await _context.LogisticsCustomers
                .FirstOrDefaultAsync(c =>
                    c.CustomerCode == invoice.CustomerNumber ||
                    c.Name.ToLower() == invoice.CustomerName.ToLower());

            if (customer != null)
            {
                invoice.CustomerId = customer.Id;
                invoice.DeliveryAddress = invoice.DeliveryAddress ?? customer.DeliveryAddress ?? customer.Address;
                invoice.DeliveryCity = invoice.DeliveryCity ?? customer.DeliveryCity ?? customer.City;
                invoice.DeliveryProvince = invoice.DeliveryProvince ?? customer.DeliveryProvince ?? customer.Province;
                invoice.DeliveryPostalCode = invoice.DeliveryPostalCode ?? customer.DeliveryPostalCode ?? customer.PostalCode;
                invoice.ContactPerson = invoice.ContactPerson ?? customer.ContactPerson;
                invoice.ContactPhone = invoice.ContactPhone ?? customer.PhoneNumber;
                invoice.ContactEmail = invoice.ContactEmail ?? customer.Email;
            }
        }

        private async Task<ImportedInvoiceDto?> GetImportedInvoiceDto(int id)
        {
            return await _context.ImportedInvoices
                .Include(i => i.Load)
                .Where(i => i.Id == id)
                .Select(i => new ImportedInvoiceDto
                {
                    Id = i.Id,
                    CustomerNumber = i.CustomerNumber,
                    CustomerName = i.CustomerName,
                    CustomerId = i.CustomerId,
                    ProductCode = i.ProductCode,
                    ProductDescription = i.ProductDescription,
                    Year = i.Year,
                    Period = i.Period,
                    TransactionType = i.TransactionType,
                    TransactionDate = i.TransactionDate,
                    TransactionNumber = i.TransactionNumber,
                    Category = i.Category,
                    Location = i.Location,
                    Quantity = i.Quantity,
                    SalesAmount = i.SalesAmount,
                    SalesReturns = i.SalesReturns,
                    CostOfSales = i.CostOfSales,
                    MarginPercent = i.MarginPercent,
                    NetSales = i.SalesAmount - i.SalesReturns,
                    GrossProfit = (i.SalesAmount - i.SalesReturns) - i.CostOfSales,
                    Status = i.Status,
                    LoadId = i.LoadId,
                    LoadNumber = i.Load != null ? i.Load.LoadNumber : null,
                    DeliveryAddress = i.DeliveryAddress,
                    DeliveryCity = i.DeliveryCity,
                    DeliveryProvince = i.DeliveryProvince,
                    DeliveryPostalCode = i.DeliveryPostalCode,
                    ContactPerson = i.ContactPerson,
                    ContactPhone = i.ContactPhone,
                    ContactEmail = i.ContactEmail,
                    ScheduledDeliveryDate = i.ScheduledDeliveryDate,
                    DeliveryNotes = i.DeliveryNotes,
                    ImportedAt = i.ImportedAt,
                    ImportBatchId = i.ImportBatchId,
                    SourceSystem = i.SourceSystem,
                    SourceCompany = i.SourceCompany
                })
                .FirstOrDefaultAsync();
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : null;
        }

        #endregion
    }
}
