using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Services;
using ClosedXML.Excel;
using System.Text;
using iText.Html2pdf;
using iText.Kernel.Pdf;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class TripSheetController : ControllerBase
    {
        // Company logo as base64 for embedding in tripsheet HTML
        private const string COMPANY_LOGO_BASE64 = "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";

        private readonly ApplicationDbContext _context;
        private readonly ILogger<TripSheetController> _logger;
        private readonly TripSheetImportService _importService;
        private readonly IEmailService _emailService;
        private readonly string _nasBasePath;

        public TripSheetController(
            ApplicationDbContext context, 
            ILogger<TripSheetController> logger,
            TripSheetImportService importService,
            IEmailService emailService,
            IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _importService = importService;
            _emailService = emailService;
            _nasBasePath = configuration.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        }

        /// <summary>
        /// Get trip sheet data for preview
        /// </summary>
        [HttpGet("{loadId}")]
        public async Task<ActionResult<TripSheetDto>> GetTripSheet(int loadId)
        {
            var load = await _context.Loads
                .Include(l => l.Customer)
                .Include(l => l.Vehicle)
                .Include(l => l.Driver)
                .Include(l => l.Warehouse)
                .Include(l => l.VehicleType)
                .Include(l => l.Stops.OrderBy(s => s.StopSequence))
                    .ThenInclude(s => s.Commodities)
                        .ThenInclude(sc => sc.Commodity)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                        .ThenInclude(sc => sc.Contract)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Customer)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Warehouse)
                .Where(l => l.Id == loadId)
                .FirstOrDefaultAsync();

            if (load == null)
                return NotFound(new { error = "Load not found" });

            // Get the user who created this tripsheet
            string? createdByUserName = null;
            if (load.CreatedByUserId.HasValue)
            {
                var createdByUser = await _context.Users
                    .Where(u => u.UserId == load.CreatedByUserId.Value)
                    .Select(u => new { u.Name, u.Surname })
                    .FirstOrDefaultAsync();
                if (createdByUser != null)
                {
                    createdByUserName = $"{createdByUser.Name} {createdByUser.Surname}".Trim();
                }
            }

            // Get imported invoices linked to this load
            var importedInvoices = await _context.ImportedInvoices
                .Where(i => i.LoadId == loadId)
                .OrderBy(i => i.CustomerName)
                .ThenBy(i => i.TransactionNumber)
                .ToListAsync();

            // Calculate total value from imported invoices first, then fallback to stops
            decimal totalValue = 0;
            var lineItems = new List<TripSheetLineItemDto>();
            int lineNo = 1;

            // If we have imported invoices, use those as the primary data source
            if (importedInvoices.Any())
            {
                foreach (var invoice in importedInvoices)
                {
                    totalValue += invoice.NetSales;
                    lineItems.Add(new TripSheetLineItemDto
                    {
                        InvNo = invoice.TransactionNumber,
                        No = lineNo.ToString(),
                        CustomerName = invoice.CustomerName,
                        ProductDescription = invoice.ProductDescription,
                        ProductBrand = invoice.ProductCode,
                        Qty = (int)invoice.Quantity,
                        TimeDispatched = invoice.ScheduledDeliveryDate?.ToString("HH:mm"),
                        OrderNo = invoice.CustomerNumber,
                        Start = null,
                        End = null,
                        KM = 0,
                        Value = invoice.NetSales,
                        Address = invoice.DeliveryAddress,
                        City = invoice.DeliveryCity,
                        ContactPerson = invoice.ContactPerson,
                        ContactPhone = invoice.ContactPhone
                    });
                    lineNo++;
                }
            }
            else
            {
                // Fallback to stops/commodities if no imported invoices
                foreach (var stop in load.Stops.OrderBy(s => s.StopSequence))
                {
                    foreach (var commodity in stop.Commodities)
                    {
                        var itemValue = commodity.TotalPrice ?? (commodity.Quantity * (commodity.UnitPrice ?? 0));
                        totalValue += itemValue;
                        lineItems.Add(new TripSheetLineItemDto
                        {
                            InvNo = stop.InvoiceNumber ?? $"INV{load.Id:D6}",
                            No = lineNo.ToString(),
                            CustomerName = stop.Customer?.Name ?? stop.CompanyName ?? "Unknown",
                            ProductDescription = commodity.Commodity?.Name ?? commodity.Comment ?? "Product",
                            ProductBrand = commodity.Commodity?.Code,
                            Qty = (int)commodity.Quantity,
                            TimeDispatched = stop.ScheduledArrival?.ToString("HH:mm"),
                            OrderNo = stop.OrderNumber,
                            Start = null,
                            End = null,
                            KM = 0,
                            Value = itemValue,
                            Address = stop.Address,
                            City = stop.City,
                            ContactPerson = stop.ContactPerson,
                            ContactPhone = stop.ContactPhone
                        });
                        lineNo++;
                    }
                }
            }

            // Calculate VAT (15% South African VAT)
            decimal vatAmount = totalValue * TripSheetDto.VatRate;
            decimal totalWithVat = totalValue + vatAmount;

            // Build trip sheet DTO with new structure
            var tripSheet = new TripSheetDto
            {
                LoadId = load.Id,
                LoadNumber = load.LoadNumber,
                Status = load.Status,
                Priority = load.Priority,
                TotalValue = totalValue,
                VatAmount = vatAmount,
                TotalWithVat = totalWithVat,

                // Trip Header / Meta Fields
                DriverName = load.Driver != null ? $"{load.Driver.FirstName} {load.Driver.LastName}".ToUpper() : "UNASSIGNED",
                TripDate = load.ScheduledPickupDate ?? load.ActualPickupDate ?? DateTime.Today,
                VehicleRegNumber = load.Vehicle?.RegistrationNumber ?? "UNASSIGNED",
                VehicleType = load.VehicleType?.Name ?? (load.Vehicle != null ? $"{load.Vehicle.Make} {load.Vehicle.Model}" : null),

                // Legacy properties for PDF generation
                PickupDate = load.ScheduledPickupDate ?? load.ActualPickupDate,
                VehicleRegistration = load.Vehicle?.RegistrationNumber ?? "UNASSIGNED",
                DeliveryLocation = load.Stops.FirstOrDefault(s => s.StopType != "Pickup")?.City ?? "Multiple Stops",

                // Additional Header Info
                WarehouseName = load.Warehouse?.Name,
                WarehouseCode = load.Warehouse?.Code,
                WarehouseEmail = load.Warehouse?.Email,
                WarehouseManagerName = load.Warehouse?.ManagerName,
                PickupLocation = load.PickupLocation ?? load.Warehouse?.Address,
                PickupCity = load.Warehouse?.City,
                PickupTime = load.ScheduledPickupTime?.ToString("HH:mm"),
                DriverPhone = load.Driver?.PhoneNumber,
                DriverLicenseNumber = load.Driver?.LicenseNumber,

                // Route Info
                EstimatedDistance = load.EstimatedDistance ?? load.ActualDistance,
                EstimatedTimeMinutes = load.EstimatedTimeMinutes ?? load.ActualTimeMinutes,
                SpecialInstructions = load.SpecialInstructions,
                Notes = load.Notes,

                // Line Items
                LineItems = lineItems,

                // Stops for PDF backward compat
                Stops = load.Stops.OrderBy(s => s.StopSequence).Select(s => new TripSheetStopDto
                {
                    StopSequence = s.StopSequence,
                    StopType = s.StopType,
                    CustomerName = s.Customer?.Name,
                    CompanyName = s.CompanyName,
                    Address = s.Address,
                    City = s.City,
                    Province = s.Province,
                    PostalCode = s.PostalCode,
                    ContactPerson = s.ContactPerson,
                    ContactPhone = s.ContactPhone,
                    ContactEmail = s.ContactEmail,
                    ScheduledArrival = s.ScheduledArrival,
                    Notes = s.Notes,
                    OrderNumber = s.OrderNumber,
                    InvoiceNumber = s.InvoiceNumber,
                    Commodities = s.Commodities.Select(c => new TripSheetCommodityDto
                    {
                        CommodityName = c.Commodity?.Name ?? c.Comment ?? "Product",
                        CommodityCode = c.Commodity?.Code,
                        Description = c.Comment,
                        ContractNumber = c.Contract?.ContractNumber,
                        Quantity = c.Quantity,
                        UnitOfMeasure = c.UnitOfMeasure,
                        UnitPrice = c.UnitPrice,
                        TotalPrice = c.TotalPrice ?? (c.Quantity * (c.UnitPrice ?? 0)),
                        Weight = c.Weight,
                        Volume = c.Volume,
                        Notes = c.Comment
                    }).ToList()
                }).ToList(),

                // Created By (User Stamp)
                CreatedByUserId = load.CreatedByUserId,
                CreatedByUserName = createdByUserName,

                // Timestamps
                CreatedAt = load.CreatedAt,
                GeneratedAt = DateTime.UtcNow
            };

            return Ok(tripSheet);
        }

        /// <summary>
        /// Create a new TripSheet from selected invoices
        /// </summary>
        [HttpPost("create-from-invoices")]
        public async Task<ActionResult<TripSheetDto>> CreateFromInvoices([FromBody] CreateTripSheetFromInvoicesDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Validate invoices exist and are pending
                var invoices = await _context.ImportedInvoices
                    .Where(i => dto.InvoiceIds.Contains(i.Id) && i.Status == "Pending")
                    .ToListAsync();

                if (invoices.Count == 0)
                    return BadRequest(new { error = "No valid pending invoices found" });

                if (invoices.Count != dto.InvoiceIds.Count)
                    return BadRequest(new { error = "Some invoices are already assigned or not found" });

                // Generate TripSheet number (RF-XXXXXX)
                var lastLoad = await _context.Loads.OrderByDescending(l => l.Id).FirstOrDefaultAsync();
                int nextNumber = 1;
                if (lastLoad != null && !string.IsNullOrEmpty(lastLoad.LoadNumber))
                {
                    var currentNumber = lastLoad.LoadNumber;
                    if ((currentNumber.StartsWith("RF-") || currentNumber.StartsWith("LD-")) && currentNumber.Length == 9)
                    {
                        if (int.TryParse(currentNumber.Substring(3), out int num))
                            nextNumber = num + 1;
                    }
                    else
                    {
                        nextNumber = lastLoad.Id + 1;
                    }
                }
                var tripSheetNumber = $"RF-{nextNumber:D6}";

                // Get warehouse if specified
                var warehouse = dto.WarehouseId.HasValue 
                    ? await _context.Warehouses.FindAsync(dto.WarehouseId.Value) 
                    : null;

                // Create the Load (TripSheet)
                var load = new Models.Logistics.Load
                {
                    LoadNumber = tripSheetNumber,
                    Status = "Pending",
                    Priority = "Normal",
                    WarehouseId = dto.WarehouseId,
                    DriverId = dto.DriverId,
                    VehicleId = dto.VehicleId,
                    PickupLocation = warehouse?.Address ?? "",
                    ScheduledPickupDate = dto.ScheduledPickupDate ?? DateTime.Today,
                    ScheduledPickupTime = null,
                    Notes = dto.Notes ?? dto.SpecialInstructions,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Loads.Add(load);
                await _context.SaveChangesAsync();

                // Link invoices to this tripsheet and create stops
                decimal totalValue = 0;
                var customerGroups = invoices.GroupBy(i => i.CustomerName).ToList();
                int stopSequence = 1;

                foreach (var customerGroup in customerGroups)
                {
                    var firstInvoice = customerGroup.First();
                    
                    // Create a stop for each customer
                    var stop = new Models.Logistics.LoadStop
                    {
                        LoadId = load.Id,
                        StopSequence = stopSequence++,
                        StopType = "Delivery",
                        CompanyName = customerGroup.Key,
                        Address = firstInvoice.DeliveryAddress ?? "",
                        City = firstInvoice.DeliveryCity ?? "",
                        Province = firstInvoice.DeliveryProvince ?? "",
                        PostalCode = firstInvoice.DeliveryPostalCode ?? "",
                        ContactPerson = firstInvoice.ContactPerson,
                        ContactPhone = firstInvoice.ContactPhone,
                        ContactEmail = firstInvoice.ContactEmail,
                        Status = "Pending"
                    };

                    _context.LoadStops.Add(stop);
                    await _context.SaveChangesAsync();

                    // Add commodities for each invoice line
                    foreach (var invoice in customerGroup)
                    {
                        var stopCommodity = new Models.Logistics.StopCommodity
                        {
                            LoadStopId = stop.Id,
                            Quantity = invoice.Quantity,
                            UnitPrice = invoice.SalesAmount / (invoice.Quantity != 0 ? invoice.Quantity : 1),
                            TotalPrice = invoice.NetSales,
                            InvoiceNumber = invoice.TransactionNumber,
                            Comment = invoice.ProductDescription
                        };
                        _context.StopCommodities.Add(stopCommodity);

                        totalValue += invoice.NetSales;

                        // Update invoice status and link to load
                        invoice.LoadId = load.Id;
                        invoice.Status = "Assigned";
                        invoice.UpdatedAt = DateTime.UtcNow;
                    }
                }

                await _context.SaveChangesAsync();

                // Auto-fulfill any delivery requests matching these invoices
                try
                {
                    var invoiceNumbers = invoices.Select(i => i.TransactionNumber).Where(n => !string.IsNullOrEmpty(n)).ToList();
                    if (invoiceNumbers.Any())
                    {
                        var matchingRequests = await _context.CondomDeliveryRequests
                            .Where(r => invoiceNumbers.Contains(r.InvoiceNumber!)
                                && (r.Status == "Pending" || r.Status == "Approved" || r.Status == "In Transit"))
                            .ToListAsync();

                        foreach (var req in matchingRequests)
                        {
                            req.Status = "Delivered";
                            req.DeliveredDate = DateTime.UtcNow;
                            req.HandledBy = $"Tripsheet {tripSheetNumber}";
                        }

                        if (matchingRequests.Any())
                        {
                            await _context.SaveChangesAsync();
                            _logger.LogInformation("Auto-fulfilled {Count} delivery requests via tripsheet {TripSheet}",
                                matchingRequests.Count, tripSheetNumber);
                        }
                    }
                }
                catch (Exception fulfillEx)
                {
                    _logger.LogWarning(fulfillEx, "Failed to auto-fulfill delivery requests (non-critical)");
                }

                await transaction.CommitAsync();

                _logger.LogInformation("Created TripSheet {TripSheetNumber} from {InvoiceCount} invoices with total value {TotalValue}", 
                    tripSheetNumber, invoices.Count, totalValue);

                // Return the created tripsheet
                return await GetTripSheet(load.Id);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Failed to create tripsheet from invoices");
                return StatusCode(500, new { error = "Failed to create tripsheet", details = ex.Message });
            }
        }

        /// <summary>
        /// Assign driver and vehicle to a TripSheet
        /// </summary>
        [HttpPut("{tripSheetId}/assign")]
        public async Task<ActionResult<TripSheetDto>> AssignDriverVehicle(int tripSheetId, [FromBody] AssignTripSheetDto dto)
        {
            var load = await _context.Loads.FindAsync(tripSheetId);
            if (load == null)
                return NotFound(new { error = "TripSheet not found" });

            if (dto.DriverId.HasValue)
            {
                var driver = await _context.Drivers.FindAsync(dto.DriverId.Value);
                if (driver == null)
                    return BadRequest(new { error = "Driver not found" });
                load.DriverId = dto.DriverId;
            }

            if (dto.VehicleId.HasValue)
            {
                var vehicle = await _context.Vehicles.FindAsync(dto.VehicleId.Value);
                if (vehicle == null)
                    return BadRequest(new { error = "Vehicle not found" });
                load.VehicleId = dto.VehicleId;
            }

            if (dto.ScheduledDate.HasValue)
                load.ScheduledPickupDate = dto.ScheduledDate;

            if (dto.ScheduledTime.HasValue)
                load.ScheduledPickupTime = dto.ScheduledTime;

            // Reschedule support: pickup date/time
            if (dto.ScheduledPickupDate.HasValue)
                load.ScheduledPickupDate = dto.ScheduledPickupDate;
            if (dto.ScheduledPickupTime.HasValue)
                load.ScheduledPickupTime = dto.ScheduledPickupTime;

            // Reschedule support: delivery date/time
            if (dto.ScheduledDeliveryDate.HasValue)
                load.ScheduledDeliveryDate = dto.ScheduledDeliveryDate;
            if (dto.ScheduledDeliveryTime.HasValue)
                load.ScheduledDeliveryTime = dto.ScheduledDeliveryTime;

            // Reschedule reason in notes
            if (!string.IsNullOrEmpty(dto.Notes))
            {
                var rescheduleNote = $"[Rescheduled {DateTime.Now:dd MMM yyyy HH:mm}] {dto.Notes}";
                load.Notes = string.IsNullOrEmpty(load.Notes) 
                    ? rescheduleNote 
                    : $"{load.Notes}\n{rescheduleNote}";
            }

            // If driver and vehicle are assigned, update status
            if (load.DriverId.HasValue && load.VehicleId.HasValue && load.Status == "Pending")
            {
                load.Status = "Scheduled";
            }

            load.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Assigned/Rescheduled driver {DriverId} and vehicle {VehicleId} to TripSheet {LoadNumber}", 
                dto.DriverId, dto.VehicleId, load.LoadNumber);

            return await GetTripSheet(tripSheetId);
        }

        /// <summary>
        /// Delete a TripSheet
        /// </summary>
        [HttpDelete("{tripSheetId}")]
        public async Task<IActionResult> DeleteTripSheet(int tripSheetId)
        {
            var load = await _context.Loads
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                .FirstOrDefaultAsync(l => l.Id == tripSheetId);
                
            if (load == null)
                return NotFound(new { error = "TripSheet not found" });

            // Reset any linked invoices back to Pending status
            var linkedInvoices = await _context.ImportedInvoices
                .Where(i => i.LoadId == tripSheetId)
                .ToListAsync();
                
            foreach (var invoice in linkedInvoices)
            {
                invoice.Status = "Pending";
                invoice.LoadId = null;
            }

            // Remove all stops and their commodities
            foreach (var stop in load.Stops.ToList())
            {
                _context.StopCommodities.RemoveRange(stop.Commodities);
                _context.LoadStops.Remove(stop);
            }

            // Remove the load
            _context.Loads.Remove(load);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted TripSheet {LoadNumber}", load.LoadNumber);
            return Ok(new { message = "TripSheet deleted successfully" });
        }

        /// <summary>
        /// Generate/Activate a TripSheet (change status from Pending/Scheduled to Active)
        /// </summary>
        [HttpPost("{tripSheetId}/activate")]
        public async Task<ActionResult<TripSheetDto>> ActivateTripSheet(int tripSheetId)
        {
            var load = await _context.Loads
                .Include(l => l.Driver)
                .Include(l => l.Vehicle)
                .FirstOrDefaultAsync(l => l.Id == tripSheetId);
                
            if (load == null)
                return NotFound(new { error = "TripSheet not found" });

            if (load.Status == "Active" || load.Status == "In Transit" || load.Status == "Completed")
                return BadRequest(new { error = $"TripSheet is already {load.Status}" });

            // Validate that driver and vehicle are assigned
            if (!load.DriverId.HasValue)
                return BadRequest(new { error = "Cannot activate: No driver assigned" });
            if (!load.VehicleId.HasValue)
                return BadRequest(new { error = "Cannot activate: No vehicle assigned" });

            load.Status = "Active";
            load.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Activated TripSheet {LoadNumber} - Status changed to Active", load.LoadNumber);
            return await GetTripSheet(tripSheetId);
        }

        /// <summary>
        /// Update TripSheet status
        /// </summary>
        [HttpPut("{tripSheetId}/status")]
        public async Task<ActionResult<TripSheetDto>> UpdateTripSheetStatus(int tripSheetId, [FromBody] UpdateStatusDto dto)
        {
            var load = await _context.Loads.FindAsync(tripSheetId);
            if (load == null)
                return NotFound(new { error = "TripSheet not found" });

            var validStatuses = new[] { "Pending", "Scheduled", "Active", "In Transit", "Completed", "Cancelled" };
            if (!validStatuses.Contains(dto.Status))
                return BadRequest(new { error = $"Invalid status. Must be one of: {string.Join(", ", validStatuses)}" });

            var oldStatus = load.Status;
            load.Status = dto.Status;
            load.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // When tripsheet is completed, save PDF to NAS
            if (dto.Status == "Completed")
            {
                try
                {
                    await SaveCompletedTripsheetToNas(tripSheetId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to save completed tripsheet {LoadNumber} to NAS", load.LoadNumber);
                }
            }

            _logger.LogInformation("Updated TripSheet {LoadNumber} status from {OldStatus} to {NewStatus}", 
                load.LoadNumber, oldStatus, dto.Status);
            return await GetTripSheet(tripSheetId);
        }

        /// <summary>
        /// Save completed tripsheet PDF to NAS
        /// </summary>
        private async Task SaveCompletedTripsheetToNas(int tripSheetId)
        {
            var tripSheet = await GetTripSheet(tripSheetId);
            if (tripSheet.Result is OkObjectResult okResult && okResult.Value is TripSheetDto ts)
            {
                // Create directory for completed tripsheets
                var completedPath = Path.Combine(_nasBasePath, "Logistics", "CompletedTripsheets");
                Directory.CreateDirectory(completedPath);

                // Generate PDF filename
                var fileName = $"{ts.LoadNumber}_{DateTime.Now:yyyyMMdd}.pdf";
                var filePath = Path.Combine(completedPath, fileName);

                // Generate PDF (simplified - use existing PDF generation)
                var htmlContent = GenerateTripSheetHtml(ts);
                using var pdfStream = new MemoryStream();
                HtmlConverter.ConvertToPdf(htmlContent, pdfStream);
                
                await System.IO.File.WriteAllBytesAsync(filePath, pdfStream.ToArray());
                _logger.LogInformation("Saved completed tripsheet {LoadNumber} to NAS: {FilePath}", ts.LoadNumber, filePath);
            }
        }

        /// <summary>
        /// Get pending invoices available for tripsheet creation
        /// </summary>
        [HttpGet("pending-invoices")]
        public async Task<ActionResult<IEnumerable<object>>> GetPendingInvoices(
            [FromQuery] string? customerName,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int limit = 5000)
        {
            var query = _context.ImportedInvoices
                .Where(i => i.Status == "Pending" && i.LoadId == null)
                .AsQueryable();

            if (!string.IsNullOrEmpty(customerName))
            {
                query = query.Where(i => i.CustomerName.Contains(customerName));
            }
            if (fromDate.HasValue)
            {
                query = query.Where(i => i.TransactionDate >= fromDate.Value);
            }
            if (toDate.HasValue)
            {
                query = query.Where(i => i.TransactionDate <= toDate.Value);
            }

            // Get total count for header
            var totalCount = await query.CountAsync();
            Response.Headers.Append("X-Total-Count", totalCount.ToString());

            var invoices = await query
                .OrderBy(i => i.CustomerName)
                .ThenByDescending(i => i.TransactionDate)
                .Select(i => new
                {
                    i.Id,
                    i.TransactionNumber,
                    i.CustomerNumber,
                    i.CustomerName,
                    i.ProductCode,
                    i.ProductDescription,
                    i.Quantity,
                    i.SalesAmount,
                    i.NetSales,
                    i.TransactionDate,
                    i.DeliveryAddress,
                    i.DeliveryCity,
                    i.ContactPerson,
                    i.ContactPhone
                })
                .Take(limit)
                .ToListAsync();

            return Ok(invoices);
        }

        /// <summary>
        /// Generate and download trip sheet PDF
        /// </summary>
        [HttpGet("{loadId}/pdf")]
        public async Task<IActionResult> DownloadTripSheetPdf(int loadId)
        {
            var tripSheetResult = await GetTripSheet(loadId);
            if (tripSheetResult.Result is NotFoundObjectResult)
                return NotFound(new { error = "Load not found" });

            var tripSheet = (tripSheetResult.Result as OkObjectResult)?.Value as TripSheetDto;
            if (tripSheet == null)
                return BadRequest(new { error = "Failed to generate trip sheet data" });

            // Generate HTML for PDF
            var html = GenerateTripSheetHtml(tripSheet);

            // Return HTML that can be converted to PDF on client side
            // Or use a server-side PDF library
            return Content(html, "text/html");
        }

        /// <summary>
        /// Email trip sheet PDF to warehouse manager
        /// </summary>
        [HttpPost("{loadId}/email")]
        public async Task<IActionResult> EmailTripSheet(int loadId, [FromBody] EmailTripSheetDto dto)
        {
            try
            {
                _logger.LogInformation("Emailing tripsheet {LoadId} to {Email}", loadId, dto.RecipientEmail);

                // Get tripsheet data
                var tripSheetResult = await GetTripSheet(loadId);
                if (tripSheetResult.Result is NotFoundObjectResult)
                    return NotFound(new { error = "Load not found" });

                var tripSheet = (tripSheetResult.Result as OkObjectResult)?.Value as TripSheetDto;
                if (tripSheet == null)
                    return BadRequest(new { error = "Failed to generate trip sheet data" });

                // Generate HTML for PDF
                var html = GenerateTripSheetHtml(tripSheet);

                // Convert HTML to PDF using iText7
                byte[] pdfBytes;
                string attachmentFileName;
                string attachmentContentType;
                
                try
                {
                    using var memoryStream = new MemoryStream();
                    var writerProperties = new WriterProperties();
                    using var pdfWriter = new PdfWriter(memoryStream, writerProperties);
                    using var pdfDocument = new PdfDocument(pdfWriter);
                    
                    // Set landscape A4
                    pdfDocument.SetDefaultPageSize(iText.Kernel.Geom.PageSize.A4.Rotate());
                    
                    // Convert HTML to PDF
                    var converterProperties = new ConverterProperties();
                    HtmlConverter.ConvertToPdf(html, pdfDocument, converterProperties);
                    
                    pdfBytes = memoryStream.ToArray();
                    attachmentFileName = $"TripSheet_{tripSheet.LoadNumber}_{DateTime.Now:yyyyMMdd}.pdf";
                    attachmentContentType = "application/pdf";
                    
                    _logger.LogInformation("PDF generated successfully, size: {Size} bytes", pdfBytes.Length);
                }
                catch (Exception pdfEx)
                {
                    _logger.LogWarning(pdfEx, "Failed to generate PDF, falling back to HTML attachment");
                    // Fallback: Send HTML as attachment if PDF generation fails
                    pdfBytes = System.Text.Encoding.UTF8.GetBytes(html);
                    attachmentFileName = $"TripSheet_{tripSheet.LoadNumber}_{DateTime.Now:yyyyMMdd}.html";
                    attachmentContentType = "text/html";
                }

                // Get warehouse details
                var load = await _context.Loads
                    .Include(l => l.Warehouse)
                    .Include(l => l.Driver)
                    .FirstOrDefaultAsync(l => l.Id == loadId);

                var warehouseName = load?.Warehouse?.Name ?? "Warehouse";
                var warehouseManagerName = load?.Warehouse?.ManagerName ?? "Warehouse Manager";
                var driverName = load?.Driver != null 
                    ? $"{load.Driver.FirstName} {load.Driver.LastName}" 
                    : "Not assigned";
                var scheduledDate = load?.ScheduledPickupDate?.ToString("dd MMM yyyy") ?? "Not scheduled";

                // Build email body
                var emailBody = $@"
                <html>
                <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                    <h2 style='color: #033142;'>TripSheet {tripSheet.LoadNumber}</h2>
                    
                    <p>Dear {warehouseManagerName},</p>
                    
                    <p>Please find attached the tripsheet for your review and preparation.</p>
                    
                    <table style='border-collapse: collapse; margin: 20px 0;'>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>TripSheet Number:</td>
                            <td style='padding: 8px 16px;'>{tripSheet.LoadNumber}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Warehouse:</td>
                            <td style='padding: 8px 16px;'>{warehouseName}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Driver:</td>
                            <td style='padding: 8px 16px;'>{driverName}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Scheduled Date:</td>
                            <td style='padding: 8px 16px;'>{scheduledDate}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Total Stops:</td>
                            <td style='padding: 8px 16px;'>{tripSheet.LineItems.Count}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Total Value:</td>
                            <td style='padding: 8px 16px;'>R {tripSheet.TotalWithVat:N2}</td>
                        </tr>
                    </table>
                    
                    <p>Please confirm stock availability and ensure the items are ready for dispatch.</p>
                    
                    <p style='margin-top: 30px;'>
                        Best regards,<br/>
                        <strong>Rocket Freight Logistics Team</strong>
                    </p>
                    
                    <hr style='margin-top: 30px; border: none; border-top: 1px solid #ddd;'/>
                    <p style='font-size: 12px; color: #666;'>
                        This is an automated message from the Rocket Freight Logistics System.
                    </p>
                </body>
                </html>";

                // Create attachment
                var attachments = new List<EmailAttachment>
                {
                    new EmailAttachment
                    {
                        FileName = attachmentFileName,
                        Content = pdfBytes,
                        ContentType = attachmentContentType
                    }
                };

                // Get recipient emails
                var recipients = new List<string>();
                if (!string.IsNullOrWhiteSpace(dto.RecipientEmail))
                    recipients.Add(dto.RecipientEmail);
                
                // Add warehouse email if available and different from primary recipient
                if (!string.IsNullOrWhiteSpace(load?.Warehouse?.Email) && 
                    !recipients.Contains(load.Warehouse.Email, StringComparer.OrdinalIgnoreCase))
                {
                    recipients.Add(load.Warehouse.Email);
                }

                if (recipients.Count == 0)
                    return BadRequest(new { error = "No recipient email addresses provided" });

                // CC list
                var ccList = dto.CcEmails?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList();

                // Send email
                var subject = $"TripSheet {tripSheet.LoadNumber} - {warehouseName} - {scheduledDate}";
                var success = await _emailService.SendEmailAsync(
                    recipients, 
                    subject, 
                    emailBody, 
                    isHtml: true, 
                    attachments: attachments,
                    cc: ccList
                );

                if (success)
                {
                    _logger.LogInformation("Tripsheet {LoadNumber} emailed successfully to {Recipients}", 
                        tripSheet.LoadNumber, string.Join(", ", recipients));
                    
                    return Ok(new { 
                        message = "TripSheet emailed successfully", 
                        recipients = recipients,
                        loadNumber = tripSheet.LoadNumber
                    });
                }
                else
                {
                    return StatusCode(500, new { error = "Failed to send email. Please check email configuration." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error emailing tripsheet {LoadId}", loadId);
                return StatusCode(500, new { error = $"Failed to email tripsheet: {ex.Message}" });
            }
        }

        /// <summary>
        /// Email tripsheet to warehouse manager
        /// </summary>
        [HttpPost("{loadId}/email-warehouse-manager")]
        public async Task<IActionResult> EmailToWarehouseManager(int loadId)
        {
            try
            {
                _logger.LogInformation("Emailing tripsheet {LoadId} to warehouse manager", loadId);

                // Get load with warehouse info
                var load = await _context.Loads
                    .Include(l => l.Warehouse)
                    .Include(l => l.Driver)
                    .Include(l => l.Vehicle)
                    .FirstOrDefaultAsync(l => l.Id == loadId);

                if (load == null)
                    return NotFound(new { error = "Load not found" });

                if (load.Warehouse == null)
                    return BadRequest(new { error = "No warehouse assigned to this load" });

                if (string.IsNullOrWhiteSpace(load.Warehouse.Email))
                    return BadRequest(new { error = $"No email configured for warehouse: {load.Warehouse.Name}" });

                // Get tripsheet data
                var tripSheetResult = await GetTripSheet(loadId);
                if (tripSheetResult.Result is NotFoundObjectResult)
                    return NotFound(new { error = "Load not found" });

                var tripSheet = (tripSheetResult.Result as OkObjectResult)?.Value as TripSheetDto;
                if (tripSheet == null)
                    return BadRequest(new { error = "Failed to generate trip sheet data" });

                // Generate HTML for PDF
                var html = GenerateTripSheetHtml(tripSheet);

                // Convert HTML to PDF
                byte[] pdfBytes;
                string attachmentFileName;
                string attachmentContentType;
                
                try
                {
                    using var memoryStream = new MemoryStream();
                    var writerProperties = new WriterProperties();
                    using var pdfWriter = new PdfWriter(memoryStream, writerProperties);
                    using var pdfDocument = new PdfDocument(pdfWriter);
                    
                    pdfDocument.SetDefaultPageSize(iText.Kernel.Geom.PageSize.A4.Rotate());
                    
                    var converterProperties = new ConverterProperties();
                    HtmlConverter.ConvertToPdf(html, pdfDocument, converterProperties);
                    
                    pdfBytes = memoryStream.ToArray();
                    attachmentFileName = $"TripSheet_{tripSheet.LoadNumber}_{DateTime.Now:yyyyMMdd}.pdf";
                    attachmentContentType = "application/pdf";
                }
                catch (Exception pdfEx)
                {
                    _logger.LogWarning(pdfEx, "Failed to generate PDF, falling back to HTML attachment");
                    pdfBytes = System.Text.Encoding.UTF8.GetBytes(html);
                    attachmentFileName = $"TripSheet_{tripSheet.LoadNumber}_{DateTime.Now:yyyyMMdd}.html";
                    attachmentContentType = "text/html";
                }

                var warehouseName = load.Warehouse.Name;
                var warehouseManagerName = load.Warehouse.ManagerName ?? "Warehouse Manager";
                var driverName = load.Driver != null 
                    ? $"{load.Driver.FirstName} {load.Driver.LastName}" 
                    : "Not assigned";
                var vehicleReg = load.Vehicle?.RegistrationNumber ?? "Not assigned";
                var scheduledDate = load.ScheduledPickupDate?.ToString("dd MMM yyyy HH:mm") ?? "Not scheduled";

                // Build email body
                var emailBody = $@"
                <html>
                <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                    <h2 style='color: #033142;'>TripSheet {tripSheet.LoadNumber}</h2>
                    
                    <p>Dear {warehouseManagerName},</p>
                    
                    <p>Please find attached the tripsheet for your review and preparation.</p>
                    
                    <table style='border-collapse: collapse; margin: 20px 0; width: 100%; max-width: 600px;'>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold; width: 180px;'>TripSheet Number:</td>
                            <td style='padding: 8px 16px; border-bottom: 1px solid #e0e0e0;'>{tripSheet.LoadNumber}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Warehouse:</td>
                            <td style='padding: 8px 16px; border-bottom: 1px solid #e0e0e0;'>{warehouseName}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Driver:</td>
                            <td style='padding: 8px 16px; border-bottom: 1px solid #e0e0e0;'>{driverName}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Vehicle:</td>
                            <td style='padding: 8px 16px; border-bottom: 1px solid #e0e0e0;'>{vehicleReg}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Scheduled Pickup:</td>
                            <td style='padding: 8px 16px; border-bottom: 1px solid #e0e0e0;'>{scheduledDate}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Total Stops:</td>
                            <td style='padding: 8px 16px; border-bottom: 1px solid #e0e0e0;'>{tripSheet.LineItems.Count}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px 16px; background: #f5f5f5; font-weight: bold;'>Total Value:</td>
                            <td style='padding: 8px 16px;'><strong>R {tripSheet.TotalWithVat:N2}</strong></td>
                        </tr>
                    </table>
                    
                    <div style='background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 20px 0;'>
                        <p style='margin: 0;'><strong>Action Required:</strong> Please confirm stock availability and ensure all items are ready for dispatch at the scheduled time.</p>
                    </div>
                    
                    <p style='margin-top: 30px;'>
                        Best regards,<br/>
                        <strong>Rocket Freight Logistics Team</strong>
                    </p>
                    
                    <hr style='margin-top: 30px; border: none; border-top: 1px solid #ddd;'/>
                    <p style='font-size: 12px; color: #666;'>
                        This is an automated message from the Rocket Freight Logistics System.<br/>
                        For any queries, please contact the logistics department.
                    </p>
                </body>
                </html>";

                // Create attachment
                var attachments = new List<EmailAttachment>
                {
                    new EmailAttachment
                    {
                        FileName = attachmentFileName,
                        Content = pdfBytes,
                        ContentType = attachmentContentType
                    }
                };

                // Send email to warehouse manager
                var subject = $"TripSheet {tripSheet.LoadNumber} - Stock Preparation Required - {scheduledDate}";
                var success = await _emailService.SendEmailAsync(
                    load.Warehouse.Email, 
                    subject, 
                    emailBody, 
                    isHtml: true, 
                    attachments: attachments
                );

                if (success)
                {
                    _logger.LogInformation("Tripsheet {LoadNumber} emailed to warehouse manager at {Email}", 
                        tripSheet.LoadNumber, load.Warehouse.Email);
                    
                    return Ok(new { 
                        message = "TripSheet emailed to warehouse manager successfully", 
                        recipient = load.Warehouse.Email,
                        warehouseName = warehouseName,
                        managerName = warehouseManagerName,
                        loadNumber = tripSheet.LoadNumber
                    });
                }
                else
                {
                    return StatusCode(500, new { error = "Failed to send email. Please check email configuration." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error emailing tripsheet {LoadId} to warehouse manager", loadId);
                return StatusCode(500, new { error = $"Failed to email tripsheet: {ex.Message}" });
            }
        }

        /// <summary>
        /// Get all trip sheets (for listing)
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TripSheetSummaryDto>>> GetTripSheets(
            [FromQuery] string? status,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int? driverId,
            [FromQuery] string? search)
        {
            var query = _context.Loads
                .AsNoTracking() // Read-only query optimization
                .Include(l => l.Driver)
                .Include(l => l.Vehicle)
                .Include(l => l.Warehouse)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(l => l.Status == status);
            }
            if (fromDate.HasValue)
            {
                query = query.Where(l => l.ScheduledPickupDate >= fromDate.Value);
            }
            if (toDate.HasValue)
            {
                query = query.Where(l => l.ScheduledPickupDate <= toDate.Value);
            }
            if (driverId.HasValue)
            {
                query = query.Where(l => l.DriverId == driverId);
            }
            if (!string.IsNullOrEmpty(search))
            {
                search = search.ToLower();
                query = query.Where(l =>
                    l.LoadNumber.ToLower().Contains(search) ||
                    (l.Driver != null && (l.Driver.FirstName + " " + l.Driver.LastName).ToLower().Contains(search)) ||
                    (l.Vehicle != null && l.Vehicle.RegistrationNumber.ToLower().Contains(search)));
            }

            var tripSheets = await query
                .OrderByDescending(l => l.ScheduledPickupDate ?? l.CreatedAt)
                .Select(l => new TripSheetSummaryDto
                {
                    LoadId = l.Id,
                    TripNumber = $"TS-{l.LoadNumber.Replace("RF-", "")}",
                    LoadNumber = l.LoadNumber,
                    DriverId = l.DriverId,
                    DriverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}" : "Unassigned",
                    VehicleId = l.VehicleId,
                    VehicleReg = l.Vehicle != null ? l.Vehicle.RegistrationNumber : "Unassigned",
                    Origin = l.Warehouse != null ? l.Warehouse.City : l.PickupLocation,
                    Destination = l.DeliveryLocation,
                    TotalStops = l.Stops.Count,
                    TotalDistance = l.EstimatedDistance ?? l.ActualDistance ?? 0,
                    EstimatedTime = FormatDuration(l.EstimatedTimeMinutes ?? l.ActualTimeMinutes ?? 0),
                    Date = l.ScheduledPickupDate ?? l.CreatedAt,
                    Status = l.Status,
                    TotalValue = l.Stops.SelectMany(s => s.Commodities).Sum(c => c.TotalPrice ?? 0),
                    VatAmount = l.Stops.SelectMany(s => s.Commodities).Sum(c => c.TotalPrice ?? 0) * TripSheetDto.VatRate,
                    TotalWithVat = l.Stops.SelectMany(s => s.Commodities).Sum(c => c.TotalPrice ?? 0) * (1 + TripSheetDto.VatRate)
                })
                .Take(10000)
                .ToListAsync();

            return Ok(tripSheets);
        }

        private static string FormatDuration(int minutes)
        {
            if (minutes <= 0) return "N/A";
            var hours = minutes / 60;
            var mins = minutes % 60;
            if (hours == 0) return $"{mins}m";
            if (mins == 0) return $"{hours}h";
            return $"{hours}h {mins}m";
        }

        private string GenerateTripSheetHtml(TripSheetDto tripSheet)
        {
            var sb = new StringBuilder();
            var totalStops = tripSheet.Stops.Where(s => s.StopType != "Pickup").Count();
            var deliveryStops = tripSheet.Stops.Where(s => s.StopType != "Pickup").ToList();
            
            // Calculate unique customers for offload time (1 hour per unique customer)
            var uniqueCustomers = deliveryStops
                .Select(s => (s.CustomerName ?? s.CompanyName ?? "").ToLower().Trim())
                .Where(n => !string.IsNullOrEmpty(n))
                .Distinct()
                .Count();
            var offloadHours = uniqueCustomers; // 1 hour per unique customer
            
            // Calculate total time including offload
            var driveMinutes = tripSheet.EstimatedTimeMinutes ?? 0;
            var totalMinutesWithOffload = driveMinutes + (offloadHours * 60);
            
            // Calculate return trip distance
            // Estimate return as ~35% of total route distance (since drivers typically don't go in a straight line back)
            // For a proper calculation, we'd need the last stop coordinates and warehouse coordinates
            var totalDistanceKm = tripSheet.EstimatedDistance ?? 0m;
            var returnDistanceKm = totalStops > 0 && totalDistanceKm > 0
                ? Math.Round(totalDistanceKm * 0.35m) // ~35% of total outbound distance as return estimate
                : 0m;
            var returnTimeMinutes = returnDistanceKm > 0 ? (int)(returnDistanceKm / 55m * 60m) : 0;
            var returnTimeFormatted = FormatDuration(returnTimeMinutes);
            
            sb.AppendLine(@"<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Trip Sheet - " + tripSheet.LoadNumber + @"</title>
    <style>
        @page { size: landscape; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            font-size: 13px; 
            line-height: 1.3;
            padding: 15px;
            background: white;
        }
        
        /* Header Section */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 10px;
            border-bottom: 3px solid #033142;
            margin-bottom: 15px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .header-logo {
            height: 50px;
            width: auto;
        }
        .logo-text {
            font-size: 27px;
            font-weight: bold;
            color: #033142;
        }
        .trip-badge {
            background: #033142;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 19px;
            font-weight: bold;
        }
        .header-right {
            text-align: right;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }
        .company-name {
            font-size: 17px;
            font-weight: bold;
            color: #333;
        }
        
        /* Info Strip - Single Row Compact */
        .info-strip {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
            padding: 8px 12px;
            background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
            border-radius: 6px;
            border: 1px solid #ddd;
            font-size: 12px;
        }
        .info-item {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            background: white;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
        }
        .info-icon {
            font-size: 13px;
        }
        .info-item strong {
            color: #333;
        }
        .info-sub {
            color: #666;
            font-size: 11px;
        }
        
        /* Main Table */
        .main-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 12px;
        }
        .main-table th {
            background: #033142;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 12px;
            white-space: nowrap;
        }
        .main-table th.center { text-align: center; }
        .main-table th.right { text-align: right; }
        .main-table td {
            padding: 6px;
            border-bottom: 1px solid #e0e0e0;
            vertical-align: middle;
        }
        .main-table td.center { text-align: center; }
        .main-table td.right { text-align: right; }
        .main-table tr:nth-child(even) {
            background: #f9f9f9;
        }
        .main-table tr:hover {
            background: #e0ecf0;
        }
        .stop-num {
            background: #033142;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 13px;
        }
        .customer-name {
            font-weight: 600;
            color: #333;
        }
        .address-text {
            color: #666;
            font-size: 11px;
            max-width: 180px;
        }
        .product-cell {
            font-size: 11px;
            line-height: 1.3;
            color: #333;
        }
        .checkbox-cell {
            width: 20px;
            height: 20px;
            border: 2px solid #033142;
            border-radius: 3px;
            display: inline-block;
        }
        .totals-row td {
            background: #e0ecf0;
            font-weight: bold;
            border-top: 2px solid #033142;
        }
        
        /* Bottom Section */
        .bottom-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 15px;
        }
        
        /* KM & Fuel Section */
        .km-fuel-section {
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 12px;
        }
        .km-fuel-section h4 {
            font-size: 14px;
            color: #033142;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e0e0e0;
        }
        .km-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 10px;
        }
        .km-field label {
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 3px;
        }
        .km-field .input-box {
            border: 1px solid #ccc;
            border-radius: 4px;
            height: 24px;
            background: white;
        }
        .fuel-section {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .fuel-section label {
            font-size: 12px;
            color: #666;
        }
        .fuel-options {
            display: flex;
            gap: 8px;
        }
        .fuel-option {
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 13px;
        }
        .fuel-checkbox {
            width: 14px;
            height: 14px;
            border: 1px solid #999;
            border-radius: 2px;
        }
        
        /* Signature Section */
        .signature-section {
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 12px;
        }
        .signature-section h4 {
            font-size: 14px;
            color: #033142;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e0e0e0;
        }
        .signature-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        .signature-box {
            text-align: center;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            height: 30px;
            margin-bottom: 4px;
        }
        .signature-label {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
        }
        
        /* Footer */
        .footer {
            margin-top: 10px;
            text-align: center;
            font-size: 11px;
            color: #999;
            padding-top: 8px;
            border-top: 1px solid #eee;
        }
        
        @media print {
            body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .main-table tr { break-inside: avoid; }
        }
        
        @page {
            margin: 10mm;
            size: A4;
        }
    </style>
</head>
<body>");

            // Header
            sb.AppendLine($@"
    <div class='header'>
        <div class='header-left'>
            <img src='data:image/png;base64,{COMPANY_LOGO_BASE64}' class='header-logo' alt='Company Logo' />
            <span class='logo-text'>&#x1F69B; TRIP SHEET</span>
            <span class='trip-badge'>{tripSheet.LoadNumber}</span>
        </div>
        <div class='header-right'>
            <div class='company-name'>Rocket Freight</div>
            <div style='color: #666; font-size: 9px;'>Logistics Division</div>
        </div>
    </div>");

            // Compact Info Row
            sb.AppendLine($@"
    <div class='info-strip'>
        <div class='info-item'><span class='info-icon'>&#x1F464;</span> <strong>{tripSheet.DriverName ?? "UNASSIGNED"}</strong> <span class='info-sub'>({tripSheet.DriverPhone ?? "N/A"})</span></div>
        <div class='info-item'><span class='info-icon'>&#x1F69B;</span> <strong>{tripSheet.VehicleRegistration ?? "N/A"}</strong> <span class='info-sub'>{tripSheet.VehicleType ?? ""}</span></div>
        <div class='info-item'><span class='info-icon'>&#x1F4C5;</span> <strong>{tripSheet.PickupDate?.ToString("dd/MM/yyyy") ?? DateTime.Now.ToString("dd/MM/yyyy")}</strong> <span class='info-sub'>{tripSheet.PickupTime ?? "TBD"}</span></div>
        <div class='info-item'><span class='info-icon'>&#x1F4CD;</span> <strong>{tripSheet.WarehouseName ?? "N/A"}</strong> <span class='info-sub'>{tripSheet.PickupCity ?? ""}</span></div>
        <div class='info-item'><span class='info-icon'>&#x1F69A;</span> <strong>{totalStops} Stops</strong> <span class='info-sub'>({uniqueCustomers} customers)</span></div>
        <div class='info-item'><span class='info-icon'>&#x23F1;</span> <strong>{tripSheet.EstimatedDistance:N0}km</strong> <span class='info-sub'>{FormatDuration(totalMinutesWithOffload)} (incl. {offloadHours}h offload)</span></div>
        <div class='info-item' style='background: #fff3e0; border-color: #ff9800;'><span class='info-icon'>&#x1F504;</span> <strong>Return:</strong> <span class='info-sub'>{returnDistanceKm:N0}km &bull; {returnTimeFormatted}</span></div>
        <div class='info-item'><span class='info-icon'>&#x1F4B0;</span> <strong>R {tripSheet.TotalValue:N2}</strong></div>
    </div>");

            // Main Delivery Table
            sb.AppendLine(@"
    <table class='main-table'>
        <thead>
            <tr>
                <th class='center' style='width: 35px;'>NO</th>
                <th style='width: 90px;'>INV NO</th>
                <th style='width: 180px;'>CUSTOMER NAME</th>
                <th>DELIVERY ADDRESS</th>
                <th style='width: 180px;'>PRODUCT</th>
                <th class='center' style='width: 50px;'>QTY</th>
                <th class='right' style='width: 80px;'>VALUE</th>
                <th class='center' style='width: 40px;'>&#x2713;</th>
            </tr>
        </thead>
        <tbody>");

            int stopNum = 1;
            decimal totalValue = 0;
            int totalQty = 0;

            foreach (var stop in deliveryStops)
            {
                var stopValue = stop.Commodities?.Sum(c => c.TotalPrice ?? 0m) ?? 0m;
                var stopQty = (int)(stop.Commodities?.Sum(c => c.Quantity) ?? 1m);
                totalValue += stopValue;
                totalQty += stopQty;

                // Build product list with quantities
                var productLines = new List<string>();
                if (stop.Commodities != null && stop.Commodities.Any())
                {
                    foreach (var c in stop.Commodities)
                    {
                        var name = c.CommodityName ?? "Product";
                        if (name.Length > 20) name = name.Substring(0, 17) + "...";
                        productLines.Add($"{name} x{(int)c.Quantity}");
                    }
                }
                var productDisplay = productLines.Any() ? string.Join("<br/>", productLines) : "N/A";

                sb.AppendLine($@"
            <tr>
                <td class='center'><span class='stop-num'>{stopNum}</span></td>
                <td>{stop.InvoiceNumber ?? stop.OrderNumber ?? "N/A"}</td>
                <td class='customer-name'>{stop.CustomerName ?? stop.CompanyName ?? "Customer"}</td>
                <td class='address-text'>{stop.Address ?? "Address TBC"}</td>
                <td class='product-cell'>{productDisplay}</td>
                <td class='center'><strong>{stopQty}</strong></td>
                <td class='right'>R {stopValue:N2}</td>
                <td class='center'><span class='checkbox-cell'></span></td>
            </tr>");
                stopNum++;
            }

            // Totals Row
            sb.AppendLine($@"
            <tr class='totals-row'>
                <td colspan='5' style='text-align: right;'>TOTALS:</td>
                <td class='center'>{totalQty}</td>
                <td class='right'>R {totalValue:N2}</td>
                <td></td>
            </tr>
        </tbody>
    </table>");

            // Bottom Section - KM/Fuel and Signatures
            sb.AppendLine(@"
    <div class='bottom-section'>
        <div class='km-fuel-section'>
            <h4>&#x1F4CB; VEHICLE RECORD</h4>
            <div class='km-grid'>
                <div class='km-field'>
                    <label>Opening KM:</label>
                    <div class='input-box'></div>
                </div>
                <div class='km-field'>
                    <label>Closing KM:</label>
                    <div class='input-box'></div>
                </div>
            </div>
            <div class='fuel-section'>
                <label>Fuel Level:</label>
                <div class='fuel-options'>
                    <span class='fuel-option'><span class='fuel-checkbox'></span> E</span>
                    <span class='fuel-option'><span class='fuel-checkbox'></span> &frac14;</span>
                    <span class='fuel-option'><span class='fuel-checkbox'></span> &frac12;</span>
                    <span class='fuel-option'><span class='fuel-checkbox'></span> &frac34;</span>
                    <span class='fuel-option'><span class='fuel-checkbox'></span> F</span>
                </div>
            </div>
        </div>
        
        <div class='signature-section'>
            <h4>&#x270F;&#xFE0F; AUTHORISATION</h4>
            <div class='signature-grid'>
                <div class='signature-box'>
                    <div class='signature-line'></div>
                    <div class='signature-label'>Driver Signature</div>
                </div>
                <div class='signature-box'>
                    <div class='signature-line'></div>
                    <div class='signature-label'>Dispatch Signature</div>
                </div>
            </div>
        </div>
    </div>");

            // Footer
            sb.AppendLine($@"
    <div class='footer'>
        Generated: {DateTime.Now:dd MMM yyyy HH:mm} | Trip Sheet: {tripSheet.LoadNumber} | Status: {tripSheet.Status} | Created by: {tripSheet.CreatedByUserName ?? "System"}
    </div>
</body>
</html>");

            return sb.ToString();
        }

        private static string GetStatusBadgeClass(string status)
        {
            return status?.ToLower() switch
            {
                "delivered" or "completed" => "success",
                "in transit" or "intransit" or "in-transit" => "info",
                "pending" or "scheduled" => "warning",
                _ => "primary"
            };
        }

        /// <summary>
        /// Preview an Excel file for tripsheet import with smart matching
        /// Returns parsed rows with matching status, suggestions, and validation
        /// </summary>
        [HttpPost("preview-import")]
        public async Task<ActionResult<TripSheetImportPreviewResponse>> PreviewImport(
            IFormFile file, 
            [FromQuery] string? sheetName = null)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file provided" });
            }

            // Check file size (10MB max)
            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { message = "File size exceeds maximum limit of 10MB" });
            }

            var extension = Path.GetExtension(file.FileName).ToLower();
            if (extension != ".xlsx")
            {
                return BadRequest(new { message = "Invalid file type. Please upload an Excel file (.xlsx)" });
            }

            try
            {
                using var stream = file.OpenReadStream();
                var result = await _importService.ParseAndPreviewAsync(stream, file.FileName, sheetName);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error previewing tripsheet import");
                return BadRequest(new { message = $"Failed to parse Excel file: {ex.Message}" });
            }
        }

        /// <summary>
        /// Commit the import after user review/confirmation
        /// </summary>
        [HttpPost("import/commit")]
        public async Task<ActionResult<TripSheetImportCommitResponse>> CommitImport(
            [FromBody] TripSheetImportCommitRequest request)
        {
            if (string.IsNullOrEmpty(request.BatchId))
            {
                return BadRequest(new { message = "Batch ID is required" });
            }

            if (request.Confirmations == null || !request.Confirmations.Any())
            {
                return BadRequest(new { message = "No rows to import" });
            }

            try
            {
                var result = await _importService.CommitImportAsync(request);
                
                if (!result.Success)
                {
                    return BadRequest(result);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error committing tripsheet import");
                return BadRequest(new { message = $"Failed to commit import: {ex.Message}" });
            }
        }

        /// <summary>
        /// Quick import - parse and import in one step (for simple cases without review)
        /// </summary>
        [HttpPost("import")]
        public async Task<ActionResult<object>> ImportTripsheet(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file provided" });
            }

            var extension = Path.GetExtension(file.FileName).ToLower();
            if (extension != ".xlsx")
            {
                return BadRequest(new { message = "Invalid file type. Please upload an Excel file (.xlsx)" });
            }

            try
            {
                // Parse the file
                using var stream = file.OpenReadStream();
                var preview = await _importService.ParseAndPreviewAsync(stream, file.FileName);

                if (preview.TotalRowsExtracted == 0)
                {
                    return BadRequest(new { message = "No valid data found in the Excel file" });
                }

                // Convert preview rows to confirmations (auto-accept all)
                var confirmations = preview.Rows
                    .Where(r => r.Status != ImportRowStatus.Error)
                    .Select(r => new TripSheetImportConfirmation
                    {
                        RowIndex = r.RowIndex,
                        CustomerName = r.Data.CustomerName,
                        CustomerNumber = r.Data.CustomerNumber,
                        DeliveryAddress = r.Data.DeliveryAddress,
                        City = r.Data.City,
                        Province = r.Data.Province,
                        InvoiceNumber = r.Data.InvoiceNumber,
                        ProductDescription = r.Data.ProductDescription,
                        Quantity = r.Data.Quantity,
                        SalesAmount = r.Data.SalesAmount,
                        ContactPerson = r.Data.ContactPerson,
                        ContactPhone = r.Data.ContactPhone,
                        ConfirmedCustomerId = r.MatchedCustomerId,
                        ConfirmedInvoiceId = r.MatchedInvoiceId
                    })
                    .ToList();

                var quickImportRequest = new TripSheetImportCommitRequest
                {
                    BatchId = preview.BatchId,
                    Confirmations = confirmations,
                    ScheduledDate = DateTime.Today
                };

                var result = await _importService.CommitImportAsync(quickImportRequest);

                return Ok(new
                {
                    success = result.Success,
                    tripSheetNumber = result.TripSheetNumber,
                    loadId = result.LoadId,
                    stopsImported = result.ImportedCount,
                    errors = result.ErrorCount,
                    message = result.Success 
                        ? $"Successfully imported {result.ImportedCount} stops as tripsheet {result.TripSheetNumber}"
                        : "Import failed with errors",
                    preview = new
                    {
                        totalRows = preview.TotalRowsExtracted,
                        matched = preview.MatchedCount,
                        partialMatch = preview.PartialMatchCount,
                        unmatched = preview.UnmatchedCount,
                        errorRows = preview.ErrorCount
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing tripsheet from Excel");
                return BadRequest(new { message = $"Failed to import tripsheet: {ex.Message}" });
            }
        }

        #region Welly AI Tripsheet Wizard

        /// <summary>
        /// Welly analyzes an uploaded Excel file — parses rows, matches customers/invoices,
        /// geocodes addresses, suggests warehouse, driver, vehicle. Returns full analysis.
        /// </summary>
        [HttpPost("welly-analyze-excel")]
        public async Task<IActionResult> WellyAnalyzeExcel(IFormFile file, [FromQuery] string? sheetName = null)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file provided" });
            if (file.Length > 10 * 1024 * 1024)
                return BadRequest(new { message = "File size exceeds 10MB limit" });
            if (Path.GetExtension(file.FileName).ToLower() != ".xlsx")
                return BadRequest(new { message = "Please upload an Excel file (.xlsx)" });

            try
            {
                using var stream = file.OpenReadStream();
                var preview = await _importService.ParseAndPreviewAsync(stream, file.FileName, sheetName);

                // Get warehouses for suggestion
                var warehouses = await _context.Warehouses
                    .Where(w => w.Status == "Active")
                    .Select(w => new { w.Id, w.Name, w.Code, w.City, w.Province, w.Address, w.ManagerName })
                    .ToListAsync();

                // Get available drivers
                var drivers = await _context.Drivers
                    .Where(d => d.Status == "Active")
                    .Select(d => new {
                        d.Id,
                        Name = d.FirstName + " " + d.LastName,
                        d.EmployeeNumber,
                        d.LicenseType,
                        d.PhoneNumber,
                        ActiveLoads = _context.Loads.Count(l => l.DriverId == d.Id &&
                            (l.Status == "Active" || l.Status == "In Transit" || l.Status == "Assigned"))
                    })
                    .ToListAsync();

                // Get available vehicles
                var vehicles = await _context.Vehicles
                    .Include(v => v.VehicleType)
                    .Where(v => v.Status == "Available" || v.Status == "In Use")
                    .Select(v => new {
                        v.Id,
                        v.RegistrationNumber,
                        Type = v.VehicleType != null ? v.VehicleType.Name : "Unknown",
                        v.Make,
                        v.Model,
                        v.Status,
                        v.Province,
                        ActiveLoads = _context.Loads.Count(l => l.VehicleId == v.Id &&
                            (l.Status == "Active" || l.Status == "In Transit" || l.Status == "Assigned"))
                    })
                    .ToListAsync();

                // Try to detect warehouse from delivery cities (majority city → nearest warehouse)
                int? suggestedWarehouseId = null;
                var cityCounts = preview.Rows
                    .Where(r => !string.IsNullOrEmpty(r.Data?.City))
                    .GroupBy(r => r.Data!.City!.Trim().ToUpper())
                    .OrderByDescending(g => g.Count())
                    .ToList();

                if (cityCounts.Any())
                {
                    var topCity = cityCounts.First().Key;
                    // Try to find warehouse in same province/city
                    var matchedWh = warehouses.FirstOrDefault(w =>
                        (w.City ?? "").Equals(topCity, StringComparison.OrdinalIgnoreCase) ||
                        (w.Province ?? "").ToUpper().Contains(topCity));
                    if (matchedWh != null)
                        suggestedWarehouseId = matchedWh.Id;
                    else if (warehouses.Any())
                        suggestedWarehouseId = warehouses.First().Id; // default to first
                }
                else if (warehouses.Any())
                {
                    suggestedWarehouseId = warehouses.First().Id;
                }

                // Suggest driver (least busy free driver)
                var suggestedDriver = drivers
                    .OrderBy(d => d.ActiveLoads)
                    .ThenBy(d => d.Name)
                    .FirstOrDefault();

                // Suggest vehicle (free vehicle)
                var suggestedVehicle = vehicles
                    .OrderBy(v => v.ActiveLoads)
                    .ThenBy(v => v.RegistrationNumber)
                    .FirstOrDefault();

                // Build address issues list
                var addressIssues = preview.Rows
                    .Where(r => r.Status != ImportRowStatus.Error)
                    .Where(r => string.IsNullOrWhiteSpace(r.Data?.DeliveryAddress) && string.IsNullOrWhiteSpace(r.Data?.City))
                    .Select(r => new {
                        rowIndex = r.RowIndex,
                        customerName = r.Data?.CustomerName,
                        invoiceNumber = r.Data?.InvoiceNumber
                    })
                    .ToList();

                // Load Welly learning notes if any
                var learningNotes = await LoadWellyLearningNotes();

                return Ok(new
                {
                    batchId = preview.BatchId,
                    fileName = preview.FileName,
                    sheetName = preview.SheetName,
                    totalRows = preview.TotalRowsExtracted,
                    matched = preview.MatchedCount,
                    partialMatch = preview.PartialMatchCount,
                    unmatched = preview.UnmatchedCount,
                    errors = preview.ErrorCount,
                    rows = preview.Rows.Select(r => new
                    {
                        rowIndex = r.RowIndex,
                        status = r.Status.ToString(),
                        confidence = r.ConfidenceScore,
                        matchedCustomerId = r.MatchedCustomerId,
                        matchedInvoiceId = r.MatchedInvoiceId,
                        suggestedCustomers = r.SuggestedCustomers,
                        suggestedInvoices = r.SuggestedInvoices,
                        validationErrors = r.ValidationErrors,
                        warnings = r.Warnings,
                        data = r.Data
                    }),
                    warehouses,
                    suggestedWarehouseId,
                    drivers = drivers.Select(d => new {
                        d.Id, d.Name, d.EmployeeNumber, d.LicenseType, d.PhoneNumber, d.ActiveLoads
                    }),
                    suggestedDriverId = suggestedDriver?.Id,
                    vehicles = vehicles.Select(v => new {
                        v.Id, v.RegistrationNumber, v.Type, v.Make, v.Model, v.Status, v.Province, v.ActiveLoads
                    }),
                    suggestedVehicleId = suggestedVehicle?.Id,
                    addressIssues,
                    learningNotes
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Welly Excel analysis failed");
                return BadRequest(new { message = $"Analysis failed: {ex.Message}" });
            }
        }

        /// <summary>
        /// Welly creates a tripsheet from the analyzed Excel data after user confirms/corrects
        /// </summary>
        [HttpPost("welly-create-tripsheet")]
        public async Task<IActionResult> WellyCreateTripsheet([FromBody] WellyCreateTripsheetRequest request)
        {
            try
            {
                var commitRequest = new TripSheetImportCommitRequest
                {
                    BatchId = request.BatchId,
                    WarehouseId = request.WarehouseId,
                    DriverId = request.DriverId,
                    VehicleId = request.VehicleId,
                    ScheduledDate = request.ScheduledDate ?? DateTime.Today,
                    Notes = $"[Created via Welly AI Tripsheet Wizard]\n{request.Notes ?? ""}".Trim(),
                    Confirmations = request.Rows.Select(r => new TripSheetImportConfirmation
                    {
                        RowIndex = r.RowIndex,
                        CustomerName = r.CustomerName,
                        CustomerNumber = r.CustomerNumber,
                        DeliveryAddress = r.DeliveryAddress,
                        City = r.City,
                        Province = r.Province,
                        InvoiceNumber = r.InvoiceNumber,
                        ProductDescription = r.ProductDescription,
                        Quantity = r.Quantity,
                        SalesAmount = r.SalesAmount,
                        ContactPerson = r.ContactPerson,
                        ContactPhone = r.ContactPhone,
                        ConfirmedCustomerId = r.ConfirmedCustomerId,
                        ConfirmedInvoiceId = r.ConfirmedInvoiceId,
                        CreateNewCustomer = r.CreateNewCustomer
                    }).ToList()
                };

                // Get user ID from claims
                int? userId = null;
                var userIdClaim = User.FindFirst("UserId")?.Value ?? User.FindFirst("sub")?.Value;
                if (int.TryParse(userIdClaim, out int uid)) userId = uid;

                var result = await _importService.CommitImportAsync(commitRequest, userId);

                if (!result.Success)
                    return BadRequest(new { message = "Failed to create tripsheet", errors = result.Errors });

                return Ok(new
                {
                    success = true,
                    tripSheetNumber = result.TripSheetNumber,
                    loadId = result.LoadId,
                    totalStops = result.TotalStops,
                    importedCount = result.ImportedCount,
                    totalValue = result.TotalValue,
                    message = $"Welly created tripsheet {result.TripSheetNumber} with {result.TotalStops} stops"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Welly tripsheet creation failed");
                return StatusCode(500, new { message = $"Failed to create tripsheet: {ex.Message}" });
            }
        }

        /// <summary>
        /// Store Welly's learning notes — user corrections that help improve future suggestions
        /// </summary>
        [HttpPost("welly-feedback")]
        public async Task<IActionResult> WellyFeedback([FromBody] WellyFeedbackRequest request)
        {
            try
            {
                var feedbackPath = Path.Combine(_nasBasePath, "welly-learning", "tripsheet-feedback.json");
                var dir = Path.GetDirectoryName(feedbackPath)!;
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                // Load existing feedback
                var existingFeedback = new List<WellyFeedbackEntry>();
                if (System.IO.File.Exists(feedbackPath))
                {
                    var json = await System.IO.File.ReadAllTextAsync(feedbackPath);
                    existingFeedback = System.Text.Json.JsonSerializer.Deserialize<List<WellyFeedbackEntry>>(json) ?? new();
                }

                // Add new feedback entries
                foreach (var correction in request.Corrections)
                {
                    existingFeedback.Add(new WellyFeedbackEntry
                    {
                        Timestamp = DateTime.UtcNow,
                        Type = correction.Type,
                        Original = correction.Original,
                        Corrected = correction.Corrected,
                        Context = correction.Context,
                        TripSheetNumber = request.TripSheetNumber
                    });
                }

                // Keep only last 500 entries
                if (existingFeedback.Count > 500)
                    existingFeedback = existingFeedback.Skip(existingFeedback.Count - 500).ToList();

                await System.IO.File.WriteAllTextAsync(feedbackPath,
                    System.Text.Json.JsonSerializer.Serialize(existingFeedback, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));

                _logger.LogInformation("Welly learning: stored {Count} corrections for tripsheet {TripSheet}",
                    request.Corrections.Count, request.TripSheetNumber);

                return Ok(new { message = $"Welly noted {request.Corrections.Count} corrections for future improvement" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to store Welly feedback");
                return Ok(new { message = "Feedback noted (storage unavailable)" });
            }
        }

        private async Task<List<WellyFeedbackEntry>> LoadWellyLearningNotes()
        {
            try
            {
                var feedbackPath = Path.Combine(_nasBasePath, "welly-learning", "tripsheet-feedback.json");
                if (!System.IO.File.Exists(feedbackPath)) return new();
                var json = await System.IO.File.ReadAllTextAsync(feedbackPath);
                return System.Text.Json.JsonSerializer.Deserialize<List<WellyFeedbackEntry>>(json) ?? new();
            }
            catch { return new(); }
        }

        #endregion
    }

    #region Welly Tripsheet DTOs

    public class WellyCreateTripsheetRequest
    {
        public string BatchId { get; set; } = string.Empty;
        public int? WarehouseId { get; set; }
        public int? DriverId { get; set; }
        public int? VehicleId { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public string? Notes { get; set; }
        public bool OptimizeRoute { get; set; } = true;
        public List<WellyTripsheetRow> Rows { get; set; } = new();
    }

    public class WellyTripsheetRow
    {
        public int RowIndex { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerNumber { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? ProductDescription { get; set; }
        public decimal? Quantity { get; set; }
        public decimal? SalesAmount { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public int? ConfirmedCustomerId { get; set; }
        public int? ConfirmedInvoiceId { get; set; }
        public bool CreateNewCustomer { get; set; }
    }

    public class WellyFeedbackRequest
    {
        public string? TripSheetNumber { get; set; }
        public List<WellyCorrection> Corrections { get; set; } = new();
    }

    public class WellyCorrection
    {
        public string Type { get; set; } = string.Empty; // "address", "customer", "warehouse", "driver", "vehicle", "route"
        public string Original { get; set; } = string.Empty;
        public string Corrected { get; set; } = string.Empty;
        public string? Context { get; set; }
    }

    public class WellyFeedbackEntry
    {
        public DateTime Timestamp { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Original { get; set; } = string.Empty;
        public string Corrected { get; set; } = string.Empty;
        public string? Context { get; set; }
        public string? TripSheetNumber { get; set; }
    }

    #endregion

    // DTOs for Trip Sheet
    public class TripSheetDto
    {
        public int LoadId { get; set; }
        public string LoadNumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = "Normal";
        public decimal TotalValue { get; set; }  // Subtotal excluding VAT
        public decimal VatAmount { get; set; }   // VAT at 15%
        public decimal TotalWithVat { get; set; } // Total including VAT
        public const decimal VatRate = 0.15m;    // South African VAT rate (15%)

        // Trip Header / Meta Fields
        public string? DriverName { get; set; }
        public DateTime? TripDate { get; set; }
        public string? VehicleRegNumber { get; set; }
        public string? VehicleType { get; set; }
        
        // Legacy properties for PDF generation compatibility
        public DateTime? PickupDate { get; set; }
        public string? VehicleRegistration { get; set; }
        public string? DeliveryLocation { get; set; }
        
        // Additional Header Info
        public string? WarehouseName { get; set; }
        public string? WarehouseCode { get; set; }
        public string? WarehouseEmail { get; set; }
        public string? WarehouseManagerName { get; set; }
        public string? PickupLocation { get; set; }
        public string? PickupCity { get; set; }
        public string? PickupTime { get; set; }
        public string? DriverPhone { get; set; }
        public string? DriverLicenseNumber { get; set; }
        
        // Route Info
        public decimal? EstimatedDistance { get; set; }
        public int? EstimatedTimeMinutes { get; set; }
        public string? SpecialInstructions { get; set; }
        public string? Notes { get; set; }

        // Line Items / Stops
        public List<TripSheetLineItemDto> LineItems { get; set; } = new();
        public List<TripSheetStopDto> Stops { get; set; } = new(); // For PDF backward compat

        // Created By (User Stamp)
        public int? CreatedByUserId { get; set; }
        public string? CreatedByUserName { get; set; }

        // Timestamps
        public DateTime CreatedAt { get; set; }
        public DateTime GeneratedAt { get; set; }
    }

    // New Line Item DTO matching your exact requirements
    public class TripSheetLineItemDto
    {
        public string InvNo { get; set; } = string.Empty;           // Invoice Number (e.g., IN160373)
        public string No { get; set; } = string.Empty;               // Sequence / Line Number / Stop No
        public string CustomerName { get; set; } = string.Empty;     // e.g., PHOLOSONG HOSPITAL
        public string ProductDescription { get; set; } = string.Empty; // e.g., BROWN BAG RECTANGULAR SMALL
        public string? ProductBrand { get; set; }                    // Can be blank
        public int Qty { get; set; }                                 // e.g., 10
        public string? TimeDispatched { get; set; }                  // e.g., 08:15
        public string? OrderNo { get; set; }                         // Order reference number
        public string? Start { get; set; }                           // Trip start time
        public string? End { get; set; }                             // Trip end time
        public decimal KM { get; set; }                              // Distance or odometer reading
        public decimal Value { get; set; }                           // Value of the invoice/line
        
        // Additional address info for display
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
    }

    // Keep old DTO for backwards compatibility but mark deprecated
    public class TripSheetStopDto
    {
        public int StopSequence { get; set; }
        public string StopType { get; set; } = string.Empty;
        public string? CustomerName { get; set; }
        public string? CompanyName { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public DateTime? ScheduledArrival { get; set; }
        public string? Notes { get; set; }
        public string? OrderNumber { get; set; }
        public string? InvoiceNumber { get; set; }
        public List<TripSheetCommodityDto> Commodities { get; set; } = new();
    }

    public class TripSheetCommodityDto
    {
        public string CommodityName { get; set; } = string.Empty;
        public string? CommodityCode { get; set; }
        public string? Description { get; set; }
        public string? ContractNumber { get; set; }
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? TotalPrice { get; set; }
        public decimal? Weight { get; set; }
        public decimal? Volume { get; set; }
        public string? Notes { get; set; }
    }

    public class TripSheetSummaryDto
    {
        public int LoadId { get; set; }
        public string TripNumber { get; set; } = string.Empty;
        public string LoadNumber { get; set; } = string.Empty;
        public int? DriverId { get; set; }           // Driver ID for assignment dialog
        public string DriverName { get; set; } = string.Empty;
        public int? VehicleId { get; set; }          // Vehicle ID for assignment dialog
        public string VehicleReg { get; set; } = string.Empty;
        public string? Origin { get; set; }
        public string? Destination { get; set; }
        public int TotalStops { get; set; }
        public decimal TotalDistance { get; set; }
        public string EstimatedTime { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal TotalValue { get; set; }      // Subtotal excluding VAT
        public decimal VatAmount { get; set; }       // VAT at 15%
        public decimal TotalWithVat { get; set; }    // Total including VAT
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }

    public class EmailTripSheetDto
    {
        public string RecipientEmail { get; set; } = string.Empty;
        public List<string>? CcEmails { get; set; }
        public string? CustomMessage { get; set; }
    }
}
