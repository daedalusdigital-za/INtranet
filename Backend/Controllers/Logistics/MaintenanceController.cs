using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClosedXML.Excel;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/maintenance")]
    public class MaintenanceController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<MaintenanceController> _logger;

        public MaintenanceController(ApplicationDbContext context, ILogger<MaintenanceController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<VehicleMaintenanceDto>>> GetMaintenanceRecords(
            [FromQuery] int? vehicleId,
            [FromQuery] string? status)
        {
            var query = _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                    .ThenInclude(v => v.VehicleType)
                .AsQueryable();

            if (vehicleId.HasValue)
            {
                query = query.Where(m => m.VehicleId == vehicleId.Value);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(m => m.Status == status);
            }

            var records = await query
                .Select(m => new VehicleMaintenanceDto
                {
                    Id = m.Id,
                    VehicleId = m.VehicleId,
                    VehicleRegistration = m.Vehicle.RegistrationNumber,
                    VehicleType = m.Vehicle.VehicleType != null ? m.Vehicle.VehicleType.Name : "Unknown",
                    MaintenanceType = m.MaintenanceType,
                    Description = m.Description,
                    ScheduledDate = m.ScheduledDate,
                    CompletedDate = m.CompletedDate,
                    OdometerReading = m.OdometerReading,
                    Cost = m.Cost,
                    ServiceProvider = m.ServiceProvider,
                    InvoiceReference = m.InvoiceReference,
                    Status = m.Status,
                    Priority = m.Priority,
                    ActionOwner = m.ActionOwner,
                    AssignedTo = m.ActionOwner ?? m.ServiceProvider,
                    Province = m.Province ?? m.Vehicle.Province,
                    Feedback = m.Feedback,
                    EstimatedCost = m.EstimatedCost,
                    DateStood = m.DateStood,
                    TargetDate = m.TargetDate,
                    DaysStanding = m.DateStood != null && m.CompletedDate == null
                        ? (int?)EF.Functions.DateDiffDay(m.DateStood.Value, DateTime.UtcNow)
                        : (m.DateStood != null && m.CompletedDate != null
                            ? (int?)EF.Functions.DateDiffDay(m.DateStood.Value, m.CompletedDate.Value)
                            : null),
                    Notes = m.Notes,
                    ProofOfWorkPath = m.ProofOfWorkPath,
                    ProofOfPaymentPath = m.ProofOfPaymentPath,
                    NextServiceDate = m.NextServiceDate,
                    NextServiceOdometer = m.NextServiceOdometer
                })
                .OrderByDescending(m => m.ScheduledDate)
                .ToListAsync();

            return Ok(records);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<VehicleMaintenanceDto>> GetMaintenanceRecord(int id)
        {
            var record = await _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                    .ThenInclude(v => v.VehicleType)
                .Where(m => m.Id == id)
                .Select(m => new VehicleMaintenanceDto
                {
                    Id = m.Id,
                    VehicleId = m.VehicleId,
                    VehicleRegistration = m.Vehicle.RegistrationNumber,
                    VehicleType = m.Vehicle.VehicleType != null ? m.Vehicle.VehicleType.Name : "Unknown",
                    MaintenanceType = m.MaintenanceType,
                    Description = m.Description,
                    ScheduledDate = m.ScheduledDate,
                    CompletedDate = m.CompletedDate,
                    OdometerReading = m.OdometerReading,
                    Cost = m.Cost,
                    ServiceProvider = m.ServiceProvider,
                    InvoiceReference = m.InvoiceReference,
                    Status = m.Status,
                    Priority = m.Priority,
                    ActionOwner = m.ActionOwner,
                    AssignedTo = m.ActionOwner ?? m.ServiceProvider,
                    Province = m.Province ?? m.Vehicle.Province,
                    Feedback = m.Feedback,
                    EstimatedCost = m.EstimatedCost,
                    DateStood = m.DateStood,
                    TargetDate = m.TargetDate,
                    DaysStanding = m.DateStood != null && m.CompletedDate == null
                        ? (int?)EF.Functions.DateDiffDay(m.DateStood.Value, DateTime.UtcNow)
                        : (m.DateStood != null && m.CompletedDate != null
                            ? (int?)EF.Functions.DateDiffDay(m.DateStood.Value, m.CompletedDate.Value)
                            : null),
                    Notes = m.Notes,
                    ProofOfWorkPath = m.ProofOfWorkPath,
                    ProofOfPaymentPath = m.ProofOfPaymentPath,
                    NextServiceDate = m.NextServiceDate,
                    NextServiceOdometer = m.NextServiceOdometer
                })
                .FirstOrDefaultAsync();

            if (record == null)
                return NotFound();

            return Ok(record);
        }

        [HttpPost]
        public async Task<ActionResult<VehicleMaintenanceDto>> CreateMaintenanceRecord(CreateVehicleMaintenanceDto dto)
        {
            var maintenance = new VehicleMaintenance
            {
                VehicleId = dto.VehicleId,
                MaintenanceType = dto.MaintenanceType,
                Description = dto.Description,
                ScheduledDate = dto.ScheduledDate,
                Cost = dto.Cost,
                ServiceProvider = dto.ServiceProvider,
                Notes = dto.Notes,
                NextServiceDate = dto.NextServiceDate,
                NextServiceOdometer = dto.NextServiceOdometer,
                Priority = dto.Priority,
                ActionOwner = dto.ActionOwner,
                Province = dto.Province,
                Feedback = dto.Feedback,
                EstimatedCost = dto.EstimatedCost,
                DateStood = dto.DateStood,
                TargetDate = dto.TargetDate,
                Status = string.IsNullOrWhiteSpace(dto.Status) ? "Scheduled" : dto.Status
            };

            _context.VehicleMaintenance.Add(maintenance);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMaintenanceRecord), new { id = maintenance.Id }, maintenance);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMaintenanceRecord(int id, UpdateVehicleMaintenanceDto dto)
        {
            var maintenance = await _context.VehicleMaintenance.FindAsync(id);
            if (maintenance == null)
                return NotFound();

            if (dto.Status != null) maintenance.Status = dto.Status;
            if (dto.CompletedDate.HasValue) maintenance.CompletedDate = dto.CompletedDate;
            if (dto.OdometerReading.HasValue) maintenance.OdometerReading = dto.OdometerReading;
            if (dto.Cost.HasValue) maintenance.Cost = dto.Cost;
            if (dto.InvoiceReference != null) maintenance.InvoiceReference = dto.InvoiceReference;
            if (dto.Notes != null) maintenance.Notes = dto.Notes;
            if (dto.ProofOfWorkPath != null) maintenance.ProofOfWorkPath = dto.ProofOfWorkPath;
            if (dto.ProofOfPaymentPath != null) maintenance.ProofOfPaymentPath = dto.ProofOfPaymentPath;
            if (dto.Priority != null) maintenance.Priority = dto.Priority;
            if (dto.ActionOwner != null) maintenance.ActionOwner = dto.ActionOwner;
            if (dto.Province != null) maintenance.Province = dto.Province;
            if (dto.Feedback != null) maintenance.Feedback = dto.Feedback;
            if (dto.EstimatedCost.HasValue) maintenance.EstimatedCost = dto.EstimatedCost;
            if (dto.DateStood.HasValue) maintenance.DateStood = dto.DateStood;
            if (dto.TargetDate.HasValue) maintenance.TargetDate = dto.TargetDate;
            if (dto.MaintenanceType != null) maintenance.MaintenanceType = dto.MaintenanceType;
            if (dto.Description != null) maintenance.Description = dto.Description;
            if (dto.ServiceProvider != null) maintenance.ServiceProvider = dto.ServiceProvider;
            if (dto.ScheduledDate.HasValue) maintenance.ScheduledDate = dto.ScheduledDate.Value;

            maintenance.UpdatedAt = DateTime.UtcNow;

            // Update vehicle's last service date and next service if completed
            if (dto.Status == "Completed" && dto.CompletedDate.HasValue)
            {
                var vehicle = await _context.Vehicles.FindAsync(maintenance.VehicleId);
                if (vehicle != null)
                {
                    vehicle.LastServiceDate = dto.CompletedDate;
                    if (maintenance.NextServiceOdometer.HasValue)
                    {
                        vehicle.NextServiceOdometer = maintenance.NextServiceOdometer;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("upcoming")]
        public async Task<ActionResult<IEnumerable<VehicleMaintenanceDto>>> GetUpcomingMaintenance([FromQuery] int days = 30)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(days);

            var upcoming = await _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                .Where(m => m.Status == "Scheduled" && m.ScheduledDate <= cutoffDate)
                .Select(m => new VehicleMaintenanceDto
                {
                    Id = m.Id,
                    VehicleId = m.VehicleId,
                    VehicleRegistration = m.Vehicle.RegistrationNumber,
                    MaintenanceType = m.MaintenanceType,
                    Description = m.Description,
                    ScheduledDate = m.ScheduledDate,
                    Cost = m.Cost,
                    ServiceProvider = m.ServiceProvider,
                    Status = m.Status
                })
                .OrderBy(m => m.ScheduledDate)
                .ToListAsync();

            return Ok(upcoming);
        }

        [HttpPost("{id}/complete")]
        public async Task<IActionResult> MarkComplete(int id, [FromBody] CompleteMaintenanceDto dto)
        {
            var maintenance = await _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (maintenance == null)
                return NotFound();

            maintenance.Status = "Completed";
            maintenance.CompletedDate = DateTime.UtcNow;
            maintenance.UpdatedAt = DateTime.UtcNow;
            
            if (dto.OdometerReading.HasValue)
                maintenance.OdometerReading = dto.OdometerReading;
            
            if (dto.Cost.HasValue)
                maintenance.Cost = dto.Cost;
            
            if (!string.IsNullOrEmpty(dto.Notes))
                maintenance.Notes = dto.Notes;

            if (!string.IsNullOrEmpty(dto.ProofOfWorkPath))
                maintenance.ProofOfWorkPath = dto.ProofOfWorkPath;

            if (!string.IsNullOrEmpty(dto.ProofOfPaymentPath))
                maintenance.ProofOfPaymentPath = dto.ProofOfPaymentPath;

            // Update vehicle's last service date
            if (maintenance.Vehicle != null)
            {
                maintenance.Vehicle.LastServiceDate = maintenance.CompletedDate;
                if (maintenance.NextServiceOdometer.HasValue)
                {
                    maintenance.Vehicle.NextServiceOdometer = maintenance.NextServiceOdometer;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Maintenance marked as complete" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMaintenanceRecord(int id)
        {
            var maintenance = await _context.VehicleMaintenance.FindAsync(id);
            if (maintenance == null)
                return NotFound();

            // Delete associated files if they exist
            if (!string.IsNullOrEmpty(maintenance.ProofOfWorkPath))
            {
                var workFile = Path.Combine(Directory.GetCurrentDirectory(), maintenance.ProofOfWorkPath.TrimStart('/'));
                if (System.IO.File.Exists(workFile))
                    System.IO.File.Delete(workFile);
            }
            if (!string.IsNullOrEmpty(maintenance.ProofOfPaymentPath))
            {
                var payFile = Path.Combine(Directory.GetCurrentDirectory(), maintenance.ProofOfPaymentPath.TrimStart('/'));
                if (System.IO.File.Exists(payFile))
                    System.IO.File.Delete(payFile);
            }

            // Delete any maintenance attachments
            var attachments = await _context.MaintenanceAttachments
                .Where(a => a.MaintenanceRecordId == id)
                .ToListAsync();

            foreach (var att in attachments)
            {
                var attFile = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "maintenance", att.StoredFileName);
                if (System.IO.File.Exists(attFile))
                    System.IO.File.Delete(attFile);
            }
            _context.MaintenanceAttachments.RemoveRange(attachments);

            _context.VehicleMaintenance.Remove(maintenance);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted maintenance record {Id}", id);
            return NoContent();
        }

        [HttpPost("{id}/upload")]
        public async Task<IActionResult> UploadFiles(int id, [FromForm] IFormFile? proofOfWork, [FromForm] IFormFile? proofOfPayment)
        {
            var maintenance = await _context.VehicleMaintenance.FindAsync(id);
            if (maintenance == null)
                return NotFound();

            var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "maintenance");
            Directory.CreateDirectory(uploadPath);

            if (proofOfWork != null)
            {
                var fileName = $"{id}_work_{DateTime.Now:yyyyMMddHHmmss}{Path.GetExtension(proofOfWork.FileName)}";
                var filePath = Path.Combine(uploadPath, fileName);
                
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await proofOfWork.CopyToAsync(stream);
                }
                
                maintenance.ProofOfWorkPath = $"/uploads/maintenance/{fileName}";
            }

            if (proofOfPayment != null)
            {
                var fileName = $"{id}_payment_{DateTime.Now:yyyyMMddHHmmss}{Path.GetExtension(proofOfPayment.FileName)}";
                var filePath = Path.Combine(uploadPath, fileName);
                
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await proofOfPayment.CopyToAsync(stream);
                }
                
                maintenance.ProofOfPaymentPath = $"/uploads/maintenance/{fileName}";
            }

            maintenance.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new 
            { 
                proofOfWorkPath = maintenance.ProofOfWorkPath,
                proofOfPaymentPath = maintenance.ProofOfPaymentPath
            });
        }

        /// <summary>
        /// Export the fleet-repair list to a formatted Excel workbook with two sheets:
        /// a line-by-line "Repairs List" and a "Fleet Status Dashboard" of pivots
        /// (by priority, province, status and vehicle type). Mirrors the Rocket
        /// Freight tracker layout but generated live from the database.
        /// </summary>
        [HttpGet("export")]
        public async Task<IActionResult> ExportToExcel(
            [FromQuery] string? status,
            [FromQuery] string? province,
            [FromQuery] string? priority,
            [FromQuery] string? vehicleReg,
            [FromQuery] string? assignedTo,
            [FromQuery] string? maintenanceType,
            [FromQuery] bool openOnly = true)
        {
            var query = _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                    .ThenInclude(v => v.VehicleType)
                .AsQueryable();

            if (openOnly)
                query = query.Where(m => m.Status != "Completed" && m.Status != "Cancelled");
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(m => m.Status == status);
            if (!string.IsNullOrWhiteSpace(priority))
                query = query.Where(m => m.Priority == priority);
            if (!string.IsNullOrWhiteSpace(vehicleReg))
                query = query.Where(m => m.Vehicle != null && m.Vehicle.RegistrationNumber == vehicleReg);
            if (!string.IsNullOrWhiteSpace(assignedTo))
                query = query.Where(m => (m.ActionOwner ?? m.ServiceProvider) == assignedTo);
            if (!string.IsNullOrWhiteSpace(maintenanceType))
                query = query.Where(m => m.MaintenanceType == maintenanceType);

            var records = await query.ToListAsync();

            // Province filter applied in-memory (falls back to vehicle province).
            var rows = records
                .Select(m => new
                {
                    Province = string.IsNullOrWhiteSpace(m.Province) ? (m.Vehicle?.Province ?? "Unassigned") : m.Province,
                    Reg = m.Vehicle?.RegistrationNumber ?? "-",
                    MakeModel = m.Vehicle != null ? $"{m.Vehicle.Make} {m.Vehicle.Model}".Trim() : "-",
                    Type = m.Vehicle?.VehicleType?.Name ?? "Unknown",
                    Issue = m.Description ?? "",
                    Feedback = m.Feedback ?? "",
                    EstimatedCost = m.EstimatedCost,
                    ActualCost = m.Cost,
                    Priority = m.Priority ?? "",
                    Status = m.Status,
                    Owner = m.ActionOwner ?? "",
                    Target = m.TargetDate,
                    Stood = m.DateStood,
                    Days = m.DateStood.HasValue
                        ? (int)((m.CompletedDate ?? DateTime.UtcNow).Date - m.DateStood.Value.Date).TotalDays
                        : (int?)null
                })
                .Where(r => string.IsNullOrWhiteSpace(province) ||
                            string.Equals(r.Province, province, StringComparison.OrdinalIgnoreCase))
                .OrderBy(r => r.Province).ThenByDescending(r => r.Priority)
                .ToList();

            using var wb = new XLWorkbook();

            // ---------- Sheet 1: Repairs List ----------
            var ws = wb.Worksheets.Add("Repairs List");
            ws.Cell(1, 1).Value = "ROCKET FREIGHT - VEHICLE REPAIRS LIST";
            ws.Range(1, 1, 1, 13).Merge().Style
                .Font.SetBold().Font.SetFontSize(14)
                .Fill.SetBackgroundColor(XLColor.FromHtml("#1a237e"))
                .Font.SetFontColor(XLColor.White)
                .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            ws.Cell(2, 1).Value = $"Generated: {DateTime.Now:dd MMM yyyy HH:mm}";

            var headers = new[] { "Province", "Registration", "Make & Model", "Type", "Issue",
                "Feedback", "Est. Cost", "Actual Cost", "Priority", "Status", "Action Owner",
                "Target Date", "Days Standing" };
            int hr = 4;
            for (int c = 0; c < headers.Length; c++)
            {
                var cell = ws.Cell(hr, c + 1);
                cell.Value = headers[c];
                cell.Style.Font.SetBold()
                    .Fill.SetBackgroundColor(XLColor.FromHtml("#3949ab"))
                    .Font.SetFontColor(XLColor.White)
                    .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            }

            int r = hr + 1;
            foreach (var row in rows)
            {
                ws.Cell(r, 1).Value = row.Province;
                ws.Cell(r, 2).Value = row.Reg;
                ws.Cell(r, 3).Value = row.MakeModel;
                ws.Cell(r, 4).Value = row.Type;
                ws.Cell(r, 5).Value = row.Issue;
                ws.Cell(r, 6).Value = row.Feedback;
                if (row.EstimatedCost.HasValue) ws.Cell(r, 7).Value = row.EstimatedCost.Value;
                if (row.ActualCost.HasValue) ws.Cell(r, 8).Value = row.ActualCost.Value;
                ws.Cell(r, 7).Style.NumberFormat.Format = "R #,##0.00";
                ws.Cell(r, 8).Style.NumberFormat.Format = "R #,##0.00";

                var pCell = ws.Cell(r, 9);
                pCell.Value = row.Priority;
                pCell.Style.Font.SetBold().Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                pCell.Style.Fill.SetBackgroundColor(row.Priority.ToUpperInvariant() switch
                {
                    "CRITICAL" => XLColor.FromHtml("#c62828"),
                    "HIGH" => XLColor.FromHtml("#ef6c00"),
                    "MEDIUM" => XLColor.FromHtml("#f9a825"),
                    "LOW" => XLColor.FromHtml("#2e7d32"),
                    _ => XLColor.NoColor
                });
                if (!string.IsNullOrEmpty(row.Priority)) pCell.Style.Font.SetFontColor(XLColor.White);

                ws.Cell(r, 10).Value = row.Status;
                ws.Cell(r, 11).Value = row.Owner;
                if (row.Target.HasValue) ws.Cell(r, 12).Value = row.Target.Value.Date;
                ws.Cell(r, 12).Style.DateFormat.Format = "dd MMM yyyy";
                if (row.Days.HasValue)
                {
                    var dCell = ws.Cell(r, 13);
                    dCell.Value = row.Days.Value;
                    dCell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    if (row.Days.Value >= 30) dCell.Style.Font.SetBold().Font.SetFontColor(XLColor.FromHtml("#c62828"));
                }
                r++;
            }

            ws.Range(hr, 1, r - 1, headers.Length).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            ws.Range(hr, 1, r - 1, headers.Length).Style.Border.InsideBorder = XLBorderStyleValues.Hair;
            ws.Column(5).Width = 40; ws.Column(6).Width = 40;
            ws.Columns(1, 4).AdjustToContents();
            ws.Columns(7, 13).AdjustToContents();
            ws.SheetView.FreezeRows(hr);

            // ---------- Sheet 2: Fleet Status Dashboard ----------
            var dash = wb.Worksheets.Add("Fleet Status Dashboard");
            dash.Cell(1, 1).Value = "ROCKET FREIGHT - FLEET STATUS DASHBOARD";
            dash.Range(1, 1, 1, 4).Merge().Style
                .Font.SetBold().Font.SetFontSize(14)
                .Fill.SetBackgroundColor(XLColor.FromHtml("#1a237e"))
                .Font.SetFontColor(XLColor.White)
                .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            dash.Cell(2, 1).Value = $"Last Updated: {DateTime.Now:dd MMM yyyy HH:mm}";

            int total = rows.Count;
            WritePivot(dash, 4, 1, "SUMMARY BY PRIORITY", "Priority",
                new[] { "CRITICAL", "HIGH", "MEDIUM", "LOW" }
                    .Select(p => (p, rows.Count(x => string.Equals(x.Priority, p, StringComparison.OrdinalIgnoreCase)))).ToList(),
                total);
            WritePivot(dash, 4, 6, "SUMMARY BY PROVINCE", "Province",
                rows.GroupBy(x => x.Province).OrderByDescending(g => g.Count())
                    .Select(g => (g.Key, g.Count())).ToList(),
                total);
            int nextRow = 4 + 4 + Math.Max(4, rows.Select(x => x.Province).Distinct().Count()) + 3;
            WritePivot(dash, nextRow, 1, "STATUS BREAKDOWN", "Status",
                rows.GroupBy(x => x.Status).OrderByDescending(g => g.Count())
                    .Select(g => (g.Key, g.Count())).ToList(),
                total);
            WritePivot(dash, nextRow, 6, "VEHICLE TYPE BREAKDOWN", "Type",
                rows.GroupBy(x => x.Type).OrderByDescending(g => g.Count())
                    .Select(g => (g.Key, g.Count())).ToList(),
                total);

            dash.Columns(1, 8).AdjustToContents();

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            var fileName = $"RocketFreight_FleetRepairs_{DateTime.Now:yyyyMMdd_HHmm}.xlsx";
            return File(ms.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        private static void WritePivot(IXLWorksheet ws, int startRow, int startCol,
            string title, string label, List<(string Key, int Count)> data, int total)
        {
            ws.Cell(startRow, startCol).Value = title;
            ws.Range(startRow, startCol, startRow, startCol + 2).Merge().Style
                .Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#3949ab"))
                .Font.SetFontColor(XLColor.White);
            ws.Cell(startRow + 1, startCol).Value = label;
            ws.Cell(startRow + 1, startCol + 1).Value = "Count";
            ws.Cell(startRow + 1, startCol + 2).Value = "% of Fleet";
            ws.Range(startRow + 1, startCol, startRow + 1, startCol + 2).Style.Font.SetBold();

            int rr = startRow + 2;
            foreach (var (key, count) in data)
            {
                ws.Cell(rr, startCol).Value = string.IsNullOrWhiteSpace(key) ? "(none)" : key;
                ws.Cell(rr, startCol + 1).Value = count;
                ws.Cell(rr, startCol + 2).Value = total > 0 ? (double)count / total : 0;
                ws.Cell(rr, startCol + 2).Style.NumberFormat.Format = "0%";
                rr++;
            }
            ws.Cell(rr, startCol).Value = "TOTAL";
            ws.Cell(rr, startCol + 1).Value = data.Sum(d => d.Count);
            ws.Range(rr, startCol, rr, startCol + 2).Style.Font.SetBold()
                .Fill.SetBackgroundColor(XLColor.FromHtml("#e8eaf6"));
            ws.Range(startRow + 1, startCol, rr, startCol + 2).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        }
    }
}
