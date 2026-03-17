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
        private readonly InvoiceDeliveryPriorityService _priorityService;

        public ImportedInvoicesController(
            ApplicationDbContext context, 
            ILogger<ImportedInvoicesController> logger,
            LoadOptimizationService optimizationService,
            InvoiceDeliveryPriorityService priorityService)
        {
            _context = context;
            _logger = logger;
            _optimizationService = optimizationService;
            _priorityService = priorityService;
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
            [FromQuery] string? priority,
            [FromQuery] string? sortBy,
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

            // Filter by delivery priority
            if (!string.IsNullOrEmpty(priority))
                query = query.Where(i => i.DeliveryPriority == priority);

            var totalCount = await query.CountAsync();

            // Sort by priority (highest first) when requested, otherwise default sort
            IOrderedQueryable<ImportedInvoice> orderedQuery;
            if (sortBy?.ToLower() == "priority")
            {
                // Sort by priority weight descending (Critical first), then by oldest first
                orderedQuery = query
                    .OrderByDescending(i => 
                        i.DeliveryPriority == "Critical" ? 5 :
                        i.DeliveryPriority == "Urgent" ? 4 :
                        i.DeliveryPriority == "High" ? 3 :
                        i.DeliveryPriority == "Normal" ? 2 : 1)
                    .ThenBy(i => i.ImportedAt);
            }
            else
            {
                orderedQuery = query
                    .OrderByDescending(i => i.TransactionDate)
                    .ThenByDescending(i => i.ImportedAt);
            }

            var invoices = await orderedQuery
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
                    SourceCompany = i.SourceCompany,
                    DeliveryPriority = i.DeliveryPriority,
                    DeliveryDeadline = i.DeliveryDeadline,
                    DaysInSystem = (int)Math.Floor((DateTime.UtcNow - i.ImportedAt).TotalDays),
                    DaysUntilDeadline = i.DeliveryDeadline.HasValue ? (int)Math.Floor((i.DeliveryDeadline.Value - DateTime.UtcNow).TotalDays) : 14 - (int)Math.Floor((DateTime.UtcNow - i.ImportedAt).TotalDays),
                    IsOverdue = (DateTime.UtcNow - i.ImportedAt).TotalDays > 14
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
                    SourceCompany = i.SourceCompany,
                    DeliveryPriority = i.DeliveryPriority,
                    DeliveryDeadline = i.DeliveryDeadline,
                    DaysInSystem = (int)Math.Floor((DateTime.UtcNow - i.ImportedAt).TotalDays),
                    DaysUntilDeadline = i.DeliveryDeadline.HasValue ? (int)Math.Floor((i.DeliveryDeadline.Value - DateTime.UtcNow).TotalDays) : 14 - (int)Math.Floor((DateTime.UtcNow - i.ImportedAt).TotalDays),
                    IsOverdue = (DateTime.UtcNow - i.ImportedAt).TotalDays > 14
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
        /// Welly Suggests — AI-powered tripsheet suggestions grouped by warehouse origin.
        /// Analyzes all pending invoices, infers delivery locations from customer names and
        /// account prefixes, batches them by warehouse → province → city/customer,
        /// and splits large groups into practical tripsheet sizes.
        /// </summary>
        [HttpGet("welly-suggest-tripsheets")]
        public async Task<ActionResult> WellySuggestTripsheets()
        {
            try
            {
                const int MaxInvoicesPerTrip = 30;

                // Get ALL pending invoices (not assigned to a load)
                var pendingInvoices = await _context.ImportedInvoices
                    .Include(i => i.Customer)
                    .Where(i => i.LoadId == null && i.Status == "Pending")
                    .OrderBy(i => i.TransactionDate)
                    .AsNoTracking()
                    .ToListAsync();

                if (!pendingInvoices.Any())
                    return Ok(new { warehouses = new List<object>(), totalPending = 0, message = "No pending invoices found." });

                // Get all active warehouses
                var warehouses = await _context.Warehouses
                    .Where(w => w.Status == "Active")
                    .AsNoTracking()
                    .ToListAsync();

                // Map SourceCompany → Warehouse
                var companyWarehouseMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var wh in warehouses)
                {
                    if (wh.Code == "WH-KZN") { companyWarehouseMap.TryAdd("PMT", wh.Id); companyWarehouseMap.TryAdd("SBT", wh.Id); }
                    else if (wh.Code == "WH-GP") companyWarehouseMap.TryAdd("ACM", wh.Id);
                    else if (wh.Code == "WH-CPT") companyWarehouseMap.TryAdd("PHT", wh.Id);
                }

                // Group invoices by warehouse origin
                var warehouseGroups = pendingInvoices
                    .GroupBy(i =>
                    {
                        var company = i.SourceCompany?.ToUpper() ?? "";
                        companyWarehouseMap.TryGetValue(company, out var whId);
                        return whId > 0 ? whId : warehouses.FirstOrDefault()?.Id ?? 0;
                    })
                    .Where(g => g.Key > 0)
                    .ToList();

                var warehouseSuggestions = new List<object>();

                foreach (var whGroup in warehouseGroups)
                {
                    var warehouse = warehouses.FirstOrDefault(w => w.Id == whGroup.Key);
                    if (warehouse == null) continue;

                    // Infer province + city for every invoice using multiple strategies
                    var enriched = whGroup.Select(i =>
                    {
                        var (prov, city) = InferLocation(i);
                        return new { Invoice = i, Province = prov, City = city };
                    }).ToList();

                    // Group by province → city
                    var provCityGroups = enriched
                        .GroupBy(e => new { e.Province, e.City })
                        .ToList();

                    var routeBatches = new List<object>();

                    foreach (var pcGroup in provCityGroups)
                    {
                        var invoicesInGroup = pcGroup.Select(e => e.Invoice).ToList();

                        // If the group is small enough, make it one batch
                        if (invoicesInGroup.Count <= MaxInvoicesPerTrip)
                        {
                            routeBatches.Add(BuildBatchObject(pcGroup.Key.Province, pcGroup.Key.City, invoicesInGroup, null));
                        }
                        else
                        {
                            // Split by individual customer first
                            var customerChunks = invoicesInGroup
                                .GroupBy(inv => new { inv.CustomerNumber, inv.CustomerName })
                                .OrderByDescending(cg => cg.Count())
                                .ToList();

                            var currentBatch = new List<ImportedInvoice>();
                            int batchNum = 1;

                            foreach (var custGroup in customerChunks)
                            {
                                var custInvoices = custGroup.ToList();

                                // If this single customer exceeds the limit, split them into their own trips
                                if (custInvoices.Count > MaxInvoicesPerTrip)
                                {
                                    // Flush any partial batch first
                                    if (currentBatch.Any())
                                    {
                                        routeBatches.Add(BuildBatchObject(pcGroup.Key.Province, pcGroup.Key.City, currentBatch, batchNum));
                                        batchNum++;
                                        currentBatch = new List<ImportedInvoice>();
                                    }
                                    // Split this large customer into MaxInvoicesPerTrip-sized chunks
                                    for (int i = 0; i < custInvoices.Count; i += MaxInvoicesPerTrip)
                                    {
                                        var chunk = custInvoices.Skip(i).Take(MaxInvoicesPerTrip).ToList();
                                        routeBatches.Add(BuildBatchObject(pcGroup.Key.Province, pcGroup.Key.City, chunk, batchNum));
                                        batchNum++;
                                    }
                                }
                                else if (currentBatch.Count + custInvoices.Count > MaxInvoicesPerTrip)
                                {
                                    // Flush current batch, start new one
                                    if (currentBatch.Any())
                                    {
                                        routeBatches.Add(BuildBatchObject(pcGroup.Key.Province, pcGroup.Key.City, currentBatch, batchNum));
                                        batchNum++;
                                    }
                                    currentBatch = new List<ImportedInvoice>(custInvoices);
                                }
                                else
                                {
                                    currentBatch.AddRange(custInvoices);
                                }
                            }

                            // Don't forget the last partial batch
                            if (currentBatch.Any())
                            {
                                routeBatches.Add(BuildBatchObject(pcGroup.Key.Province, pcGroup.Key.City, currentBatch, batchNum));
                            }
                        }
                    }

                    // Sort by urgency
                    routeBatches = routeBatches
                        .OrderByDescending(b => ((dynamic)b).urgencyScore)
                        .ThenByDescending(b => ((dynamic)b).totalValue)
                        .ToList();

                    var sourceCompanies = whGroup
                        .Select(i => i.SourceCompany)
                        .Where(s => !string.IsNullOrEmpty(s))
                        .Distinct()
                        .ToList();

                    warehouseSuggestions.Add(new
                    {
                        warehouseId = warehouse.Id,
                        warehouseName = warehouse.Name,
                        warehouseCode = warehouse.Code,
                        warehouseCity = warehouse.City,
                        warehouseProvince = warehouse.Province,
                        sourceCompanies,
                        totalPendingInvoices = whGroup.Count(),
                        totalValue = Math.Round((double)whGroup.Sum(i => i.SalesAmount - i.SalesReturns), 2),
                        suggestedTripsheets = routeBatches,
                        summary = $"{routeBatches.Count} suggested trip(s) from {warehouse.Name} covering {routeBatches.Sum(b => (int)((dynamic)b).uniqueCustomers)} customers across {routeBatches.Select(b => (string)((dynamic)b).province).Distinct().Count()} province(s)"
                    });
                }

                return Ok(new
                {
                    warehouses = warehouseSuggestions.OrderByDescending(w => ((dynamic)w).totalPendingInvoices),
                    totalPending = pendingInvoices.Count,
                    totalWarehouses = warehouseSuggestions.Count,
                    generatedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating Welly tripsheet suggestions");
                return StatusCode(500, new { error = "Failed to generate tripsheet suggestions", details = ex.Message });
            }
        }

        /// <summary>
        /// Build a suggestion batch object from a list of invoices.
        /// </summary>
        private static object BuildBatchObject(string province, string city, List<ImportedInvoice> invoices, int? batchNum)
        {
            var customerGroups = invoices
                .GroupBy(i => new { i.CustomerNumber, i.CustomerName })
                .ToList();

            var label = batchNum.HasValue ? $"{city} (Batch {batchNum})" : city;

            return new
            {
                province,
                city = label,
                totalInvoices = invoices.Count,
                uniqueCustomers = customerGroups.Count,
                totalValue = Math.Round((double)invoices.Sum(i => i.SalesAmount - i.SalesReturns), 2),
                totalItems = Math.Round((double)invoices.Sum(i => i.Quantity), 0),
                oldestDays = invoices.Max(i => (int)(DateTime.UtcNow - i.ImportedAt).TotalDays),
                highestPriority = GetHighestPriorityFromInvoices(invoices),
                invoiceIds = invoices.Select(i => i.Id).ToList(),
                customers = customerGroups.Select(cg => new
                {
                    customerNumber = cg.Key.CustomerNumber,
                    customerName = cg.Key.CustomerName,
                    invoiceCount = cg.Count(),
                    totalAmount = Math.Round((double)cg.Sum(inv => inv.SalesAmount - inv.SalesReturns), 2),
                    city = cg.First().DeliveryCity ?? cg.First().Customer?.City,
                    address = cg.First().DeliveryAddress ?? cg.First().Customer?.DeliveryAddress,
                    province = cg.First().DeliveryProvince ?? cg.First().Customer?.Province
                }).OrderByDescending(c => c.totalAmount).ToList(),
                recommendedVehicle = invoices.Count > 25 ? "Medium Truck (5 Ton)" :
                    invoices.Count > 12 ? "Light Delivery Vehicle" : "Panel Van / Bakkie",
                urgencyScore = CalculateUrgencyScore(invoices)
            };
        }

        /// <summary>
        /// Infer province and city from invoice data, customer name, and account prefix.
        /// Uses a multi-strategy approach: explicit fields → customer record → name keywords → prefix codes.
        /// </summary>
        private static (string Province, string City) InferLocation(ImportedInvoice invoice)
        {
            // Strategy 1: Use explicit delivery fields if populated
            var prov = invoice.DeliveryProvince;
            var city = invoice.DeliveryCity;
            if (!string.IsNullOrWhiteSpace(prov) && !string.IsNullOrWhiteSpace(city))
                return (prov, city);

            // Strategy 2: Use linked Customer record
            var custProv = invoice.Customer?.Province;
            var custCity = invoice.Customer?.City ?? invoice.Customer?.DeliveryCity;
            if (!string.IsNullOrWhiteSpace(custProv) && !string.IsNullOrWhiteSpace(custCity))
                return (custProv, custCity);

            // Strategy 3: Infer from customer name using known SA city/region keywords
            var name = (invoice.CustomerName ?? "").ToUpperInvariant();
            var inferred = InferFromCustomerName(name);
            if (inferred.Province != null)
                return (inferred.Province, inferred.City ?? "General");

            // Strategy 4: Infer from customer number prefix (XX-...)
            var prefix = (invoice.CustomerNumber ?? "").Length >= 2
                ? invoice.CustomerNumber!.Substring(0, 2).ToUpperInvariant()
                : "";
            var prefixResult = InferFromPrefix(prefix);
            if (prefixResult.Province != null)
                return (prefixResult.Province, prefixResult.City ?? "General");

            // Fallback — use whatever partial data we have
            return (prov ?? custProv ?? "Unclassified", city ?? custCity ?? "General");
        }

        /// <summary>
        /// Match customer name against known South African city/region keywords.
        /// </summary>
        private static (string? Province, string? City) InferFromCustomerName(string upperName)
        {
            // KwaZulu-Natal cities/towns
            if (upperName.Contains("DURBAN") || upperName.Contains("ETHEKWINI") || upperName.Contains("ETSHENI"))
                return ("KwaZulu-Natal", "Durban");
            if (upperName.Contains("PIETERMARITZBURG") || upperName.Contains("PMB") || upperName.Contains("MSUNDUZI"))
                return ("KwaZulu-Natal", "Pietermaritzburg");
            if (upperName.Contains("DUNDEE")) return ("KwaZulu-Natal", "Dundee");
            if (upperName.Contains("LADYSMITH")) return ("KwaZulu-Natal", "Ladysmith");
            if (upperName.Contains("NEWCASTLE")) return ("KwaZulu-Natal", "Newcastle");
            if (upperName.Contains("RICHARDS BAY") || upperName.Contains("RICHARDSBAY"))
                return ("KwaZulu-Natal", "Richards Bay");
            if (upperName.Contains("EMPANGENI")) return ("KwaZulu-Natal", "Empangeni");
            if (upperName.Contains("ESHOWE")) return ("KwaZulu-Natal", "Eshowe");
            if (upperName.Contains("SCOTTBURGH")) return ("KwaZulu-Natal", "Scottburgh");
            if (upperName.Contains("PORT SHEPSTONE") || upperName.Contains("SHELLY BEACH"))
                return ("KwaZulu-Natal", "Port Shepstone");
            if (upperName.Contains("STANGER") || upperName.Contains("KWADUKUZA"))
                return ("KwaZulu-Natal", "Stanger");
            if (upperName.Contains("VRYHEID")) return ("KwaZulu-Natal", "Vryheid");
            if (upperName.Contains("ULUNDI")) return ("KwaZulu-Natal", "Ulundi");
            if (upperName.Contains("IXOPO")) return ("KwaZulu-Natal", "Ixopo");
            if (upperName.Contains("GREYTOWN")) return ("KwaZulu-Natal", "Greytown");
            if (upperName.Contains("WENTWORTH")) return ("KwaZulu-Natal", "Durban South");
            if (upperName.Contains("INKOSI ALBERT LUTHULI") || upperName.Contains("IALCH"))
                return ("KwaZulu-Natal", "Durban");
            if (upperName.Contains("APPLESBOSCH") || upperName.Contains("KRANSKOP"))
                return ("KwaZulu-Natal", "Kranskop");
            if (upperName.Contains("NKANDLA")) return ("KwaZulu-Natal", "Nkandla");
            if (upperName.Contains("HLABISA")) return ("KwaZulu-Natal", "Hlabisa");
            if (upperName.Contains("MADADENI")) return ("KwaZulu-Natal", "Newcastle");

            // Gauteng cities
            if (upperName.Contains("HILLBROW") || upperName.Contains("JOHANNESBURG") || upperName.Contains("JHB"))
                return ("Gauteng", "Johannesburg");
            if (upperName.Contains("PRETORIA") || upperName.Contains("TSHWANE"))
                return ("Gauteng", "Pretoria");
            if (upperName.Contains("SOWETO")) return ("Gauteng", "Soweto");
            if (upperName.Contains("SANDTON")) return ("Gauteng", "Sandton");
            if (upperName.Contains("BARAGWANATH") || upperName.Contains("CHRIS HANI"))
                return ("Gauteng", "Johannesburg South");
            if (upperName.Contains("WATERKLOOF") || upperName.Contains("AFB WATERKLOOF"))
                return ("Gauteng", "Pretoria");
            if (upperName.Contains("KGOSI MAMPURU") || upperName.Contains("MAMPURU"))
                return ("Gauteng", "Pretoria");
            if (upperName.Contains("GERMISTON") || upperName.Contains("EKURHULENI"))
                return ("Gauteng", "Ekurhuleni");
            if (upperName.Contains("BENONI") || upperName.Contains("SPRINGS") || upperName.Contains("KEMPTON"))
                return ("Gauteng", "Ekurhuleni");
            if (upperName.Contains("VEREENIGING") || upperName.Contains("VANDERBIJL"))
                return ("Gauteng", "Vaal Triangle");
            if (upperName.Contains("EDENVALE") || upperName.Contains("BEDFORDVIEW"))
                return ("Gauteng", "Ekurhuleni");
            if (upperName.Contains("CENTURION") || upperName.Contains("MIDRAND"))
                return ("Gauteng", "Centurion/Midrand");

            // Eastern Cape
            if (upperName.Contains("PORT ELIZABETH") || upperName.Contains("GQEBERHA") || upperName.Contains("PE "))
                return ("Eastern Cape", "Gqeberha");
            if (upperName.Contains("EAST LONDON") || upperName.Contains("BUFFALO CITY") || upperName.Contains("BCM"))
                return ("Eastern Cape", "East London");
            if (upperName.Contains("UMTATA") || upperName.Contains("MTHATHA"))
                return ("Eastern Cape", "Mthatha");
            if (upperName.Contains("BHISHO") || upperName.Contains("BISHO"))
                return ("Eastern Cape", "Bhisho");
            if (upperName.Contains("QUEENSTOWN")) return ("Eastern Cape", "Queenstown");
            if (upperName.Contains("GRAHAMSTOWN") || upperName.Contains("MAKHANDA"))
                return ("Eastern Cape", "Makhanda");
            if (upperName.Contains("KING WILLIAM")) return ("Eastern Cape", "King Williams Town");
            if (upperName.Contains("UITENHAGE") || upperName.Contains("KARIEGA"))
                return ("Eastern Cape", "Kariega");
            if (upperName.Contains("CRADOCK")) return ("Eastern Cape", "Cradock");
            if (upperName.Contains("GRAAFF") || upperName.Contains("GRAAFF-REINET"))
                return ("Eastern Cape", "Graaff-Reinet");

            // Western Cape
            if (upperName.Contains("CAPE TOWN") || upperName.Contains("KHAYELITSHA") || upperName.Contains("GROOTE SCHUUR"))
                return ("Western Cape", "Cape Town");
            if (upperName.Contains("TYGERBERG")) return ("Western Cape", "Cape Town North");
            if (upperName.Contains("STELLENBOSCH")) return ("Western Cape", "Stellenbosch");
            if (upperName.Contains("PAARL") || upperName.Contains("WELLINGTON"))
                return ("Western Cape", "Paarl");
            if (upperName.Contains("WORCESTER")) return ("Western Cape", "Worcester");
            if (upperName.Contains("GEORGE")) return ("Western Cape", "George");
            if (upperName.Contains("KNYSNA")) return ("Western Cape", "Knysna");
            if (upperName.Contains("OUDTSHOORN")) return ("Western Cape", "Oudtshoorn");
            if (upperName.Contains("BREDASDORP") || upperName.Contains("OVERBERG"))
                return ("Western Cape", "Bredasdorp");
            if (upperName.Contains("BEAUFORT WEST") || upperName.Contains("BEAUFORT"))
                return ("Western Cape", "Beaufort West");
            if (upperName.Contains("MOSSEL BAY")) return ("Western Cape", "Mossel Bay");

            // Free State
            if (upperName.Contains("BLOEMFONTEIN") || upperName.Contains("MANGAUNG"))
                return ("Free State", "Bloemfontein");
            if (upperName.Contains("WELKOM")) return ("Free State", "Welkom");
            if (upperName.Contains("BETHLEHEM")) return ("Free State", "Bethlehem");
            if (upperName.Contains("KROONSTAD")) return ("Free State", "Kroonstad");
            if (upperName.Contains("SASOLBURG")) return ("Free State", "Sasolburg");
            if (upperName.Contains("PHEKOLONG")) return ("Free State", "Bethlehem");
            if (upperName.Contains("ARTHUR LETELE")) return ("Free State", "Trompsburg");

            // Limpopo
            if (upperName.Contains("POLOKWANE") || upperName.Contains("PIETERSBURG"))
                return ("Limpopo", "Polokwane");
            if (upperName.Contains("LIMPOPO")) return ("Limpopo", "General");
            if (upperName.Contains("MANKWENG")) return ("Limpopo", "Mankweng");
            if (upperName.Contains("THOHOYANDOU") || upperName.Contains("VHEMBE"))
                return ("Limpopo", "Thohoyandou");
            if (upperName.Contains("TZANEEN") || upperName.Contains("LETABA"))
                return ("Limpopo", "Tzaneen");
            if (upperName.Contains("MUSINA") || upperName.Contains("MESSINA"))
                return ("Limpopo", "Musina");
            if (upperName.Contains("MOKOPANE") || upperName.Contains("POTGIETERSRUS"))
                return ("Limpopo", "Mokopane");
            if (upperName.Contains("LPPD") || upperName.Contains("LIMPOPO.*DEPOT"))
                return ("Limpopo", "Polokwane");

            // North West
            if (upperName.Contains("MMABATHO") || upperName.Contains("MAFIKENG") || upperName.Contains("MAHIKENG"))
                return ("North West", "Mahikeng");
            if (upperName.Contains("RUSTENBURG")) return ("North West", "Rustenburg");
            if (upperName.Contains("POTCHEFSTROOM") || upperName.Contains("TLOKWE"))
                return ("North West", "Potchefstroom");
            if (upperName.Contains("KLERKSDORP") || upperName.Contains("KLERDORP") || upperName.Contains("TSHEPONG"))
                return ("North West", "Klerksdorp");
            if (upperName.Contains("BRITS") || upperName.Contains("MADIBENG"))
                return ("North West", "Brits");
            if (upperName.Contains("NORTH WEST")) return ("North West", "General");

            // Mpumalanga
            if (upperName.Contains("NELSPRUIT") || upperName.Contains("MBOMBELA"))
                return ("Mpumalanga", "Nelspruit");
            if (upperName.Contains("WITBANK") || upperName.Contains("EMALAHLENI"))
                return ("Mpumalanga", "Witbank");
            if (upperName.Contains("MIDDELBURG") && !upperName.Contains("CAPE"))
                return ("Mpumalanga", "Middelburg");
            if (upperName.Contains("PIET RETIEF") || upperName.Contains("MKHONDO"))
                return ("Mpumalanga", "Piet Retief");
            if (upperName.Contains("ERMELO")) return ("Mpumalanga", "Ermelo");
            if (upperName.Contains("STANDERTON")) return ("Mpumalanga", "Standerton");
            if (upperName.Contains("MPUMALANGA")) return ("Mpumalanga", "General");

            // Northern Cape
            if (upperName.Contains("KIMBERLEY")) return ("Northern Cape", "Kimberley");
            if (upperName.Contains("UPINGTON")) return ("Northern Cape", "Upington");
            if (upperName.Contains("NORTHERN CAPE") || upperName.Contains("ROBERT MANGALISO"))
                return ("Northern Cape", "Kimberley");
            if (upperName.Contains("DE AAR")) return ("Northern Cape", "De Aar");
            if (upperName.Contains("SPRINGBOK")) return ("Northern Cape", "Springbok");

            // Generic patterns
            if (upperName.Contains("CORRECTIONAL SERVICE")) return (null, null); // will fall through to prefix
            if (upperName.Contains("DEPARTMENT OF HEALTH"))
            {
                // Try to extract province from name
                if (upperName.Contains("KZN") || upperName.Contains("KWAZULU"))
                    return ("KwaZulu-Natal", "General");
                if (upperName.Contains("GAUTENG") || upperName.Contains("GP"))
                    return ("Gauteng", "General");
                if (upperName.Contains("EC") || upperName.Contains("EASTERN CAPE"))
                    return ("Eastern Cape", "General");
                if (upperName.Contains("WC") || upperName.Contains("WESTERN CAPE"))
                    return ("Western Cape", "General");
                if (upperName.Contains("LIMPOPO") || upperName.Contains("LP"))
                    return ("Limpopo", "General");
                if (upperName.Contains("MPUMALANGA") || upperName.Contains("MP"))
                    return ("Mpumalanga", "General");
                if (upperName.Contains("NORTH WEST") || upperName.Contains("NW"))
                    return ("North West", "General");
                if (upperName.Contains("FREE STATE") || upperName.Contains("FS"))
                    return ("Free State", "General");
                if (upperName.Contains("NORTHERN CAPE") || upperName.Contains("NC"))
                    return ("Northern Cape", "General");
            }

            // WC DOHW pattern (Western Cape Dept of Health)
            if (upperName.StartsWith("WC ") || upperName.Contains("WC DOHW"))
                return ("Western Cape", "General");

            // EC HEALTH pattern
            if (upperName.StartsWith("EC ") || upperName.Contains("EC HEALTH"))
                return ("Eastern Cape", "General");

            // FS HEALTH pattern
            if (upperName.StartsWith("FS ") || upperName.Contains("FS HEALTH"))
                return ("Free State", "General");

            // NC HEALTH pattern
            if (upperName.StartsWith("NC ") || upperName.Contains("NC HEALTH"))
                return ("Northern Cape", "General");

            return (null, null);
        }

        /// <summary>
        /// Infer province from the 2-character customer number prefix.
        /// Pattern: 01=KZN, 02=Limpopo, 03=North West, 04=Free State,
        /// 05=Western Cape, 06=Eastern Cape, 07=Northern Cape, 08=Gauteng, 09=Mpumalanga
        /// </summary>
        private static (string? Province, string? City) InferFromPrefix(string prefix)
        {
            return prefix switch
            {
                "01" => ("KwaZulu-Natal", null),
                "02" => ("Limpopo", null),
                "03" => ("North West", null),
                "04" => ("Free State", null),
                "05" => ("Western Cape", null),
                "06" => ("Eastern Cape", null),
                "07" => ("Northern Cape", null),
                "08" => ("Gauteng", null),
                "09" => ("Mpumalanga", null),
                "10" => ("Gauteng", null),  // Misc Gauteng
                "GP" => ("Gauteng", null),
                "KZ" => ("KwaZulu-Natal", null),
                "EC" => ("Eastern Cape", null),
                "WC" => ("Western Cape", null),
                "NC" => ("Northern Cape", null),
                "LP" => ("Limpopo", null),
                "NW" => ("North West", null),
                "FS" => ("Free State", null),
                "MP" => ("Mpumalanga", null),
                "PE" => ("Eastern Cape", "Gqeberha"),
                "BL" => ("Free State", "Bloemfontein"),
                "UM" => ("Eastern Cape", "Mthatha"),
                "MM" => ("North West", "Mahikeng"),
                "KL" => ("North West", "Klerksdorp"),
                "PI" => ("Limpopo", "Polokwane"),
                "PO" => ("North West", "Potchefstroom"),
                "TY" => ("Western Cape", "Cape Town North"),
                "GR" => ("Western Cape", "Cape Town"),
                "KH" => ("Western Cape", "Cape Town"),
                "OU" => ("Western Cape", "Oudtshoorn"),
                "BE" => ("Western Cape", "Beaufort West"),
                "MA" => ("Limpopo", "Mankweng"),
                "DR" => ("Free State", "Trompsburg"),
                "IA" => ("KwaZulu-Natal", "Durban"),
                "AP" => ("KwaZulu-Natal", "Kranskop"),
                "DO" => ("Mpumalanga", null),
                "HQ" => ("Western Cape", "Cape Town"),
                "ME" => ("Gauteng", "Johannesburg"),
                _ => (null, null)
            };
        }

        private static string GetHighestPriorityFromInvoices(List<ImportedInvoice> invoices)
        {
            var maxDays = invoices.Max(i => (DateTime.UtcNow - i.ImportedAt).TotalDays);
            if (maxDays >= 14) return "Critical";
            if (maxDays >= 11) return "Urgent";
            if (maxDays >= 7) return "High";
            if (maxDays >= 4) return "Normal";
            return "Low";
        }

        private static double CalculateUrgencyScore(List<ImportedInvoice> invoices)
        {
            var avgDays = invoices.Average(i => (DateTime.UtcNow - i.ImportedAt).TotalDays);
            var totalValue = (double)invoices.Sum(i => i.SalesAmount - i.SalesReturns);
            return (avgDays * 10) + (totalValue / 10000);
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

            // Auto-escalate load priority based on highest-priority linked invoice
            var invoicePriorities = invoices.Select(i => i.DeliveryPriority).ToList();
            var highestPriority = InvoiceDeliveryPriorityService.GetHighestPriority(invoicePriorities);
            load.Priority = InvoiceDeliveryPriorityService.MapToLoadPriority(highestPriority);

            await _context.SaveChangesAsync();

            _logger.LogInformation("Created trip sheet {LoadNumber} from {Count} invoices (Priority: {Priority})",
                loadNumber, invoices.Count, load.Priority);

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

        /// <summary>
        /// Get delivery priority dashboard - overview of all invoice priorities and aging
        /// </summary>
        [HttpGet("priority-dashboard")]
        public async Task<ActionResult<PriorityDashboardDto>> GetPriorityDashboard()
        {
            try
            {
                var dashboard = await _priorityService.GetPriorityDashboard();
                return Ok(dashboard);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting priority dashboard");
                return BadRequest(new { error = "Failed to get priority dashboard", details = ex.Message });
            }
        }

        /// <summary>
        /// Recalculate delivery priorities for all active invoices based on current age.
        /// Call this periodically (e.g., daily) or on-demand to escalate priorities.
        /// </summary>
        [HttpPost("recalculate-priorities")]
        public async Task<ActionResult<PriorityRecalculationResult>> RecalculatePriorities()
        {
            try
            {
                var result = await _priorityService.RecalculateAllPriorities();
                _logger.LogInformation("Priority recalculation triggered. Processed: {Total}, Escalated: {Escalated}",
                    result.TotalProcessed, result.Escalated);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recalculating priorities");
                return BadRequest(new { error = "Failed to recalculate priorities", details = ex.Message });
            }
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
                SourceSystem = sourceSystem,
                DeliveryPriority = "Low",
                DeliveryDeadline = DateTime.UtcNow.AddDays(14)
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
                    SourceCompany = i.SourceCompany,
                    DeliveryPriority = i.DeliveryPriority,
                    DeliveryDeadline = i.DeliveryDeadline,
                    DaysInSystem = (int)Math.Floor((DateTime.UtcNow - i.ImportedAt).TotalDays),
                    DaysUntilDeadline = i.DeliveryDeadline.HasValue ? (int)Math.Floor((i.DeliveryDeadline.Value - DateTime.UtcNow).TotalDays) : 14 - (int)Math.Floor((DateTime.UtcNow - i.ImportedAt).TotalDays),
                    IsOverdue = (DateTime.UtcNow - i.ImportedAt).TotalDays > 14
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
