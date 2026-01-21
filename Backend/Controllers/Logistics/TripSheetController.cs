using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
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

        public TripSheetController(ApplicationDbContext context, ILogger<TripSheetController> logger)
        {
            _context = context;
            _logger = logger;
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

            // Calculate total value
            decimal totalValue = 0;
            foreach (var stop in load.Stops)
            {
                foreach (var commodity in stop.Commodities)
                {
                    totalValue += commodity.TotalPrice ?? (commodity.Quantity * (commodity.UnitPrice ?? 0));
                }
            }

            // Build trip sheet DTO
            var tripSheet = new TripSheetDto
            {
                LoadId = load.Id,
                LoadNumber = load.LoadNumber,
                Status = load.Status,
                Priority = load.Priority,
                TotalValue = totalValue,

                // Pickup Info
                PickupLocation = load.PickupLocation ?? load.Warehouse?.Address,
                PickupCity = load.Warehouse?.City,
                PickupDate = load.ScheduledPickupDate ?? load.ActualPickupDate,
                PickupTime = load.ScheduledPickupTime?.ToString("HH:mm"),
                WarehouseName = load.Warehouse?.Name,
                WarehouseCode = load.Warehouse?.Code,

                // Delivery Info
                DeliveryLocation = load.DeliveryLocation,
                DeliveryDate = load.ScheduledDeliveryDate ?? load.ActualDeliveryDate,
                DeliveryTime = load.ScheduledDeliveryTime?.ToString("HH:mm"),

                // Driver & Vehicle
                DriverName = load.Driver != null ? $"{load.Driver.FirstName} {load.Driver.LastName}" : "Unassigned",
                DriverPhone = load.Driver?.PhoneNumber,
                DriverLicenseNumber = load.Driver?.LicenseNumber,
                VehicleRegistration = load.Vehicle?.RegistrationNumber ?? "Unassigned",
                VehicleType = load.VehicleType?.Name ?? (load.Vehicle != null ? $"{load.Vehicle.Make} {load.Vehicle.Model}" : null),

                // Route Info
                EstimatedDistance = load.EstimatedDistance ?? load.ActualDistance,
                EstimatedTimeMinutes = load.EstimatedTimeMinutes ?? load.ActualTimeMinutes,
                SpecialInstructions = load.SpecialInstructions,
                Notes = load.Notes,

                // Customer Info
                CustomerName = load.Customer?.Name,
                CustomerPhone = load.Customer?.PhoneNumber,

                // Stops
                Stops = load.Stops
                    .OrderBy(s => s.StopSequence)
                    .Select(s => new TripSheetStopDto
                    {
                        StopSequence = s.StopSequence,
                        StopType = s.StopType,
                        CustomerName = s.Customer?.Name ?? s.CompanyName,
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
                            CommodityName = c.Commodity?.Name ?? "Unknown",
                            CommodityCode = c.Commodity?.Code,
                            Description = c.Commodity?.Description ?? c.Comment,
                            ContractNumber = c.Contract?.ContractNumber,
                            Quantity = c.Quantity,
                            UnitOfMeasure = c.UnitOfMeasure ?? c.Commodity?.UnitOfMeasure,
                            UnitPrice = c.UnitPrice,
                            TotalPrice = c.TotalPrice ?? (c.Quantity * (c.UnitPrice ?? 0)),
                            Weight = c.Weight,
                            Volume = c.Volume,
                            Notes = c.Comment
                        }).ToList()
                    }).ToList(),

                // Timestamps
                CreatedAt = load.CreatedAt,
                GeneratedAt = DateTime.UtcNow
            };

            return Ok(tripSheet);
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
                    TripNumber = $"TS-{l.LoadNumber.Replace("LD-", "")}",
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
                    TotalValue = l.Stops.SelectMany(s => s.Commodities).Sum(c => c.TotalPrice ?? 0)
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
            
            sb.AppendLine(@"<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Trip Sheet - " + tripSheet.LoadNumber + @"</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            font-size: 11px; 
            line-height: 1.4;
            padding: 20px;
            background: white;
        }
        .header { 
            text-align: center; 
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #1976d2;
        }
        .header h1 { 
            font-size: 24px; 
            color: #1976d2;
            margin-bottom: 10px;
        }
        .badges {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 10px;
        }
        .badge {
            padding: 6px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 12px;
        }
        .badge-primary { background: #1976d2; color: white; }
        .badge-success { background: #4caf50; color: white; }
        .badge-warning { background: #ff9800; color: white; }
        .badge-info { background: #00bcd4; color: white; }
        
        .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .info-block h3 {
            font-size: 13px;
            color: #1976d2;
            margin-bottom: 8px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 4px;
        }
        .info-row {
            display: flex;
            margin-bottom: 4px;
        }
        .info-label {
            font-weight: 600;
            width: 120px;
            color: #666;
        }
        .info-value {
            flex: 1;
            color: #333;
        }
        
        .stops-section {
            margin-top: 20px;
        }
        .stops-section h2 {
            font-size: 16px;
            color: #1976d2;
            margin-bottom: 15px;
            padding-bottom: 5px;
            border-bottom: 2px solid #1976d2;
        }
        
        .stop-card {
            margin-bottom: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }
        .stop-header {
            background: #1976d2;
            color: white;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .stop-header .stop-number {
            font-weight: 600;
            font-size: 14px;
        }
        .stop-header .stop-type {
            background: rgba(255,255,255,0.2);
            padding: 2px 10px;
            border-radius: 10px;
            font-size: 10px;
        }
        .stop-details {
            padding: 12px 15px;
            background: #fafafa;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        
        .commodities-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        .commodities-table th {
            background: #e3f2fd;
            padding: 8px;
            text-align: left;
            font-weight: 600;
            color: #1565c0;
        }
        .commodities-table td {
            padding: 8px;
            border-bottom: 1px solid #eee;
        }
        .commodities-table tr:last-child td {
            border-bottom: none;
        }
        .stop-notes {
            background: #fff3e0;
            padding: 8px 15px;
            font-style: italic;
            font-size: 10px;
            color: #e65100;
        }
        
        .manual-section {
            margin-top: 30px;
            padding: 15px;
            border: 2px dashed #ccc;
            border-radius: 8px;
        }
        .manual-section h3 {
            font-size: 14px;
            color: #666;
            margin-bottom: 15px;
        }
        .manual-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        .manual-field {
            display: flex;
            flex-direction: column;
        }
        .manual-field label {
            font-weight: 600;
            margin-bottom: 5px;
            color: #666;
        }
        .manual-field .input-line {
            border-bottom: 1px solid #999;
            height: 25px;
        }
        .fuel-checkboxes {
            display: flex;
            gap: 15px;
            margin-top: 5px;
        }
        .fuel-checkboxes label {
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: normal;
        }
        .checkbox {
            width: 14px;
            height: 14px;
            border: 1px solid #999;
            display: inline-block;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 10px;
            color: #999;
        }
        
        .signature-section {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        .signature-block {
            text-align: center;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            height: 40px;
            margin-bottom: 5px;
        }
        .signature-label {
            font-size: 10px;
            color: #666;
        }
        
        @media print {
            body { padding: 0; }
            .stop-card { break-inside: avoid; }
        }
    </style>
</head>
<body>");

            // Header
            sb.AppendLine($@"
    <div class='header'>
        <h1>🚛 TRIP SHEET</h1>
        <div class='badges'>
            <span class='badge badge-primary'>{tripSheet.LoadNumber}</span>
            <span class='badge badge-{GetStatusBadgeClass(tripSheet.Status)}'>{tripSheet.Status}</span>
            <span class='badge badge-success'>R {tripSheet.TotalValue:N2}</span>
        </div>
    </div>");

            // Info Section
            sb.AppendLine($@"
    <div class='info-section'>
        <div class='info-block'>
            <h3>📍 Pickup Information</h3>
            <div class='info-row'><span class='info-label'>Location:</span><span class='info-value'>{tripSheet.WarehouseName ?? tripSheet.PickupLocation}</span></div>
            <div class='info-row'><span class='info-label'>Address:</span><span class='info-value'>{tripSheet.PickupLocation}</span></div>
            <div class='info-row'><span class='info-label'>Date:</span><span class='info-value'>{tripSheet.PickupDate?.ToString("dd MMM yyyy") ?? "TBD"}</span></div>
            <div class='info-row'><span class='info-label'>Time:</span><span class='info-value'>{tripSheet.PickupTime ?? "TBD"}</span></div>
        </div>
        <div class='info-block'>
            <h3>🏁 Delivery Information</h3>
            <div class='info-row'><span class='info-label'>Destination:</span><span class='info-value'>{tripSheet.DeliveryLocation ?? "Multiple Stops"}</span></div>
            <div class='info-row'><span class='info-label'>Est. Distance:</span><span class='info-value'>{tripSheet.EstimatedDistance:N0} km</span></div>
            <div class='info-row'><span class='info-label'>Est. Duration:</span><span class='info-value'>{FormatDuration(tripSheet.EstimatedTimeMinutes ?? 0)}</span></div>
            <div class='info-row'><span class='info-label'>Priority:</span><span class='info-value'>{tripSheet.Priority}</span></div>
        </div>
        <div class='info-block'>
            <h3>👤 Driver Details</h3>
            <div class='info-row'><span class='info-label'>Name:</span><span class='info-value'>{tripSheet.DriverName}</span></div>
            <div class='info-row'><span class='info-label'>Phone:</span><span class='info-value'>{tripSheet.DriverPhone ?? "N/A"}</span></div>
            <div class='info-row'><span class='info-label'>License:</span><span class='info-value'>{tripSheet.DriverLicenseNumber ?? "N/A"}</span></div>
        </div>
        <div class='info-block'>
            <h3>🚛 Vehicle Details</h3>
            <div class='info-row'><span class='info-label'>Registration:</span><span class='info-value'>{tripSheet.VehicleRegistration}</span></div>
            <div class='info-row'><span class='info-label'>Type:</span><span class='info-value'>{tripSheet.VehicleType ?? "N/A"}</span></div>
        </div>
    </div>");

            // Special Instructions
            if (!string.IsNullOrEmpty(tripSheet.SpecialInstructions) || !string.IsNullOrEmpty(tripSheet.Notes))
            {
                sb.AppendLine($@"
    <div style='background: #fff3e0; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px;'>
        <strong style='color: #e65100;'>⚠️ Special Instructions:</strong>
        <p style='margin-top: 5px;'>{tripSheet.SpecialInstructions ?? tripSheet.Notes}</p>
    </div>");
            }

            // Stops Section
            sb.AppendLine(@"
    <div class='stops-section'>
        <h2>📦 Delivery Stops</h2>");

            // Skip pickup stop, show delivery stops
            var deliveryStops = tripSheet.Stops.Where(s => s.StopType != "Pickup").ToList();
            int stopNum = 1;

            foreach (var stop in deliveryStops)
            {
                sb.AppendLine($@"
        <div class='stop-card'>
            <div class='stop-header'>
                <span class='stop-number'>Stop {stopNum}: {stop.CustomerName ?? stop.CompanyName ?? "Customer"}</span>
                <span class='stop-type'>{stop.StopType}</span>
            </div>
            <div class='stop-details'>
                <div>
                    <div class='info-row'><span class='info-label'>Address:</span><span class='info-value'>{stop.Address}</span></div>
                    <div class='info-row'><span class='info-label'>City:</span><span class='info-value'>{stop.City ?? "N/A"}</span></div>
                </div>
                <div>
                    <div class='info-row'><span class='info-label'>Contact:</span><span class='info-value'>{stop.ContactPerson ?? "N/A"}</span></div>
                    <div class='info-row'><span class='info-label'>Phone:</span><span class='info-value'>{stop.ContactPhone ?? "N/A"}</span></div>
                    {(stop.OrderNumber != null ? $"<div class='info-row'><span class='info-label'>Order #:</span><span class='info-value'>{stop.OrderNumber}</span></div>" : "")}
                    {(stop.InvoiceNumber != null ? $"<div class='info-row'><span class='info-label'>Invoice #:</span><span class='info-value'>{stop.InvoiceNumber}</span></div>" : "")}
                </div>
            </div>");

                if (stop.Commodities.Any())
                {
                    sb.AppendLine(@"
            <table class='commodities-table'>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Contract</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th style='text-align: right;'>Value</th>
                    </tr>
                </thead>
                <tbody>");

                    foreach (var commodity in stop.Commodities)
                    {
                        sb.AppendLine($@"
                    <tr>
                        <td>{commodity.CommodityName}</td>
                        <td>{commodity.ContractNumber ?? "N/A"}</td>
                        <td>{commodity.Quantity}</td>
                        <td>{commodity.UnitOfMeasure ?? "Unit"}</td>
                        <td style='text-align: right;'>R {commodity.TotalPrice:N2}</td>
                    </tr>");
                    }

                    sb.AppendLine(@"
                </tbody>
            </table>");
                }

                if (!string.IsNullOrEmpty(stop.Notes))
                {
                    sb.AppendLine($@"
            <div class='stop-notes'>
                <strong>Note:</strong> {stop.Notes}
            </div>");
                }

                sb.AppendLine("        </div>");
                stopNum++;
            }

            sb.AppendLine("    </div>");

            // Manual Entry Section
            sb.AppendLine(@"
    <div class='manual-section'>
        <h3>📝 Driver Record (Manual Entry)</h3>
        <div class='manual-grid'>
            <div class='manual-field'>
                <label>Opening Mileage (km)</label>
                <div class='input-line'></div>
            </div>
            <div class='manual-field'>
                <label>Closing Mileage (km)</label>
                <div class='input-line'></div>
            </div>
            <div class='manual-field'>
                <label>Fuel Level at Start</label>
                <div class='fuel-checkboxes'>
                    <label><span class='checkbox'></span> E</label>
                    <label><span class='checkbox'></span> ¼</label>
                    <label><span class='checkbox'></span> ½</label>
                    <label><span class='checkbox'></span> ¾</label>
                    <label><span class='checkbox'></span> F</label>
                </div>
            </div>
        </div>
    </div>");

            // Signature Section
            sb.AppendLine(@"
    <div class='signature-section'>
        <div class='signature-block'>
            <div class='signature-line'></div>
            <div class='signature-label'>Driver Signature & Date</div>
        </div>
        <div class='signature-block'>
            <div class='signature-line'></div>
            <div class='signature-label'>Dispatch Signature & Date</div>
        </div>
    </div>");

            // Footer
            sb.AppendLine($@"
    <div class='footer'>
        <p>Generated: {tripSheet.GeneratedAt:dd MMM yyyy HH:mm} | Trip Sheet ID: {tripSheet.LoadNumber}</p>
        <p>This document is an official delivery manifest. Please retain for your records.</p>
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
    }

    // DTOs for Trip Sheet
    public class TripSheetDto
    {
        public int LoadId { get; set; }
        public string LoadNumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = "Normal";
        public decimal TotalValue { get; set; }

        // Pickup
        public string? PickupLocation { get; set; }
        public string? PickupCity { get; set; }
        public DateTime? PickupDate { get; set; }
        public string? PickupTime { get; set; }
        public string? WarehouseName { get; set; }
        public string? WarehouseCode { get; set; }

        // Delivery
        public string? DeliveryLocation { get; set; }
        public DateTime? DeliveryDate { get; set; }
        public string? DeliveryTime { get; set; }

        // Driver
        public string? DriverName { get; set; }
        public string? DriverPhone { get; set; }
        public string? DriverLicenseNumber { get; set; }

        // Vehicle
        public string? VehicleRegistration { get; set; }
        public string? VehicleType { get; set; }

        // Customer
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }

        // Route
        public decimal? EstimatedDistance { get; set; }
        public int? EstimatedTimeMinutes { get; set; }
        public string? SpecialInstructions { get; set; }
        public string? Notes { get; set; }

        // Stops
        public List<TripSheetStopDto> Stops { get; set; } = new();

        // Timestamps
        public DateTime CreatedAt { get; set; }
        public DateTime GeneratedAt { get; set; }
    }

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
        public decimal TotalValue { get; set; }
    }
}
