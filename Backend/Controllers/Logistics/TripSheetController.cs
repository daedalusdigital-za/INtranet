using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Services;
using ClosedXML.Excel;
using System.Text;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class TripSheetController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<TripSheetController> _logger;
        private readonly TripSheetImportService _importService;

        public TripSheetController(
            ApplicationDbContext context, 
            ILogger<TripSheetController> logger,
            TripSheetImportService importService)
        {
            _context = context;
            _logger = logger;
            _importService = importService;
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

            // If driver and vehicle are assigned, update status
            if (load.DriverId.HasValue && load.VehicleId.HasValue && load.Status == "Pending")
            {
                load.Status = "Scheduled";
            }

            load.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Assigned driver {DriverId} and vehicle {VehicleId} to TripSheet {LoadNumber}", 
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

            _logger.LogInformation("Updated TripSheet {LoadNumber} status from {OldStatus} to {NewStatus}", 
                load.LoadNumber, oldStatus, dto.Status);
            return await GetTripSheet(tripSheetId);
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
                    DriverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}" : "Unassigned",
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
                .Take(100)
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
            border-bottom: 3px solid #1976d2;
            margin-bottom: 15px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .logo-text {
            font-size: 27px;
            font-weight: bold;
            color: #1976d2;
        }
        .trip-badge {
            background: #1976d2;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 19px;
            font-weight: bold;
        }
        .header-right {
            text-align: right;
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
            background: #1976d2;
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
            background: #e3f2fd;
        }
        .stop-num {
            background: #1976d2;
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
            border: 2px solid #1976d2;
            border-radius: 3px;
            display: inline-block;
        }
        .totals-row td {
            background: #e3f2fd;
            font-weight: bold;
            border-top: 2px solid #1976d2;
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
            color: #1976d2;
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
            color: #1976d2;
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
    </style>
</head>
<body>");

            // Header
            sb.AppendLine($@"
    <div class='header'>
        <div class='header-left'>
            <span class='logo-text'>🚛 TRIP SHEET</span>
            <span class='trip-badge'>{tripSheet.LoadNumber}</span>
        </div>
        <div class='header-right'>
            <div class='company-name'>ProMed Technologies</div>
            <div style='color: #666; font-size: 9px;'>Logistics Division</div>
        </div>
    </div>");

            // Compact Info Row
            sb.AppendLine($@"
    <div class='info-strip'>
        <div class='info-item'><span class='info-icon'>👤</span> <strong>{tripSheet.DriverName ?? "UNASSIGNED"}</strong> <span class='info-sub'>({tripSheet.DriverPhone ?? "N/A"})</span></div>
        <div class='info-item'><span class='info-icon'>🚛</span> <strong>{tripSheet.VehicleRegistration ?? "N/A"}</strong> <span class='info-sub'>{tripSheet.VehicleType ?? ""}</span></div>
        <div class='info-item'><span class='info-icon'>📅</span> <strong>{tripSheet.PickupDate?.ToString("dd/MM/yyyy") ?? DateTime.Now.ToString("dd/MM/yyyy")}</strong> <span class='info-sub'>{tripSheet.PickupTime ?? "TBD"}</span></div>
        <div class='info-item'><span class='info-icon'>📍</span> <strong>{tripSheet.WarehouseName ?? "N/A"}</strong> <span class='info-sub'>{tripSheet.PickupCity ?? ""}</span></div>
        <div class='info-item'><span class='info-icon'>🚚</span> <strong>{totalStops} Stops</strong> <span class='info-sub'>({uniqueCustomers} customers)</span></div>
        <div class='info-item'><span class='info-icon'>⏱️</span> <strong>{tripSheet.EstimatedDistance:N0}km</strong> <span class='info-sub'>{FormatDuration(totalMinutesWithOffload)} (incl. {offloadHours}h offload)</span></div>
        <div class='info-item' style='background: #fff3e0; border-color: #ff9800;'><span class='info-icon'>🔄</span> <strong>Return:</strong> <span class='info-sub'>{returnDistanceKm:N0}km • {returnTimeFormatted}</span></div>
        <div class='info-item'><span class='info-icon'>💰</span> <strong>R {tripSheet.TotalValue:N2}</strong></div>
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
                <th class='center' style='width: 40px;'>✓</th>
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
            <h4>📊 VEHICLE RECORD</h4>
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
                    <span class='fuel-option'><span class='fuel-checkbox'></span> ¼</span>
                    <span class='fuel-option'><span class='fuel-checkbox'></span> ½</span>
                    <span class='fuel-option'><span class='fuel-checkbox'></span> ¾</span>
                    <span class='fuel-option'><span class='fuel-checkbox'></span> F</span>
                </div>
            </div>
        </div>
        
        <div class='signature-section'>
            <h4>✍️ AUTHORISATION</h4>
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
    }

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
        public string DriverName { get; set; } = string.Empty;
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
}
