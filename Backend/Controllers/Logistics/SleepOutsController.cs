using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Models.Finance;
using ProjectTracker.API.Constants;
using System.Security.Claims;
using iText.Html2pdf;
using iText.Kernel.Pdf;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class SleepOutsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SleepOutsController> _logger;

        public SleepOutsController(ApplicationDbContext context, ILogger<SleepOutsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Get all sleep outs with optional filtering
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SleepOutDto>>> GetSleepOuts(
            [FromQuery] string? status = null,
            [FromQuery] int? driverId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            var query = _context.SleepOuts
                .Include(s => s.Driver)
                .Include(s => s.Load)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(s => s.Status == status);

            if (driverId.HasValue)
                query = query.Where(s => s.DriverId == driverId.Value);

            if (fromDate.HasValue)
                query = query.Where(s => s.Date >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(s => s.Date <= toDate.Value);

            var sleepOuts = await query
                .OrderByDescending(s => s.Date)
                .ThenByDescending(s => s.CreatedAt)
                .Select(s => new SleepOutDto
                {
                    Id = s.Id,
                    DriverId = s.DriverId,
                    DriverName = s.Driver != null ? $"{s.Driver.FirstName} {s.Driver.LastName}" : null,
                    DriverEmployeeNumber = s.Driver != null ? s.Driver.EmployeeNumber : null,
                    Amount = s.Amount,
                    Date = s.Date,
                    Status = s.Status,
                    Reason = s.Reason,
                    Notes = s.Notes,
                    LoadId = s.LoadId,
                    LoadNumber = s.Load != null ? s.Load.LoadNumber : null,
                    TripSheetId = s.TripSheetId,
                    TripNumber = s.TripNumber,
                    VehicleReg = s.VehicleReg,
                    ApprovedByUserId = s.ApprovedByUserId,
                    ApprovedByUserName = s.ApprovedByUserId != null ? _context.Users.Where(u => u.UserId == s.ApprovedByUserId).Select(u => u.Name + " " + u.Surname).FirstOrDefault() : null,
                    ApprovedAt = s.ApprovedAt,
                    CreatedByUserId = s.CreatedByUserId,
                    CreatedByUserName = s.CreatedByUserId != null ? _context.Users.Where(u => u.UserId == s.CreatedByUserId).Select(u => u.Name + " " + u.Surname).FirstOrDefault() : null,
                    CreatedAt = s.CreatedAt
                })
                .ToListAsync();

            return Ok(sleepOuts);
        }

        /// <summary>
        /// Get a single sleep out by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<SleepOutDto>> GetSleepOut(int id)
        {
            var sleepOut = await _context.SleepOuts
                .Include(s => s.Driver)
                .Include(s => s.Load)
                .Where(s => s.Id == id)
                .Select(s => new SleepOutDto
                {
                    Id = s.Id,
                    DriverId = s.DriverId,
                    DriverName = s.Driver != null ? $"{s.Driver.FirstName} {s.Driver.LastName}" : null,
                    DriverEmployeeNumber = s.Driver != null ? s.Driver.EmployeeNumber : null,
                    Amount = s.Amount,
                    Date = s.Date,
                    Status = s.Status,
                    Reason = s.Reason,
                    Notes = s.Notes,
                    LoadId = s.LoadId,
                    LoadNumber = s.Load != null ? s.Load.LoadNumber : null,
                    TripSheetId = s.TripSheetId,
                    TripNumber = s.TripNumber,
                    VehicleReg = s.VehicleReg,
                    ApprovedByUserId = s.ApprovedByUserId,
                    ApprovedByUserName = s.ApprovedByUserId != null ? _context.Users.Where(u => u.UserId == s.ApprovedByUserId).Select(u => u.Name + " " + u.Surname).FirstOrDefault() : null,
                    ApprovedAt = s.ApprovedAt,
                    CreatedByUserId = s.CreatedByUserId,
                    CreatedByUserName = s.CreatedByUserId != null ? _context.Users.Where(u => u.UserId == s.CreatedByUserId).Select(u => u.Name + " " + u.Surname).FirstOrDefault() : null,
                    CreatedAt = s.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            return Ok(sleepOut);
        }

        /// <summary>
        /// Get sleep out statistics/summary
        /// </summary>
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSleepOutSummary()
        {
            var today = DateTime.Today;
            var startOfMonth = new DateTime(today.Year, today.Month, 1);

            var allSleepOuts = await _context.SleepOuts
                .Where(s => s.Date >= startOfMonth)
                .ToListAsync();

            var summary = new
            {
                TotalRequested = allSleepOuts.Count(s => s.Status == "Requested"),
                TotalApproved = allSleepOuts.Count(s => s.Status == "Approved"),
                TotalRejected = allSleepOuts.Count(s => s.Status == "Rejected"),
                TotalPaid = allSleepOuts.Count(s => s.Status == "Paid"),
                TotalAmountApproved = allSleepOuts.Where(s => s.Status == "Approved" || s.Status == "Paid").Sum(s => s.Amount),
                TotalAmountPaid = allSleepOuts.Where(s => s.Status == "Paid").Sum(s => s.Amount),
                MonthlyTotal = allSleepOuts.Sum(s => s.Amount),
                PendingCount = allSleepOuts.Count(s => s.Status == "Requested")
            };

            return Ok(summary);
        }

        /// <summary>
        /// Create a new sleep out request
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<SleepOutDto>> CreateSleepOut([FromBody] CreateSleepOutDto dto)
        {
            // Validate driver exists
            var driver = await _context.Drivers.FindAsync(dto.DriverId);
            if (driver == null)
                return BadRequest(new { error = "Driver not found" });

            // Validate load if provided
            if (dto.LoadId.HasValue)
            {
                var load = await _context.Loads.FindAsync(dto.LoadId.Value);
                if (load == null)
                    return BadRequest(new { error = "Load not found" });
            }

            // Get user ID from claims
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? createdByUserId = int.TryParse(userIdClaim, out var uid) ? uid : null;

            var sleepOut = new SleepOut
            {
                DriverId = dto.DriverId,
                Amount = dto.Amount,
                Date = dto.Date,
                Status = "Requested",
                Reason = dto.Reason,
                Notes = dto.Notes,
                LoadId = dto.LoadId,
                TripSheetId = dto.TripSheetId,
                TripNumber = dto.TripNumber,
                VehicleReg = dto.VehicleReg,
                CreatedByUserId = createdByUserId,
                CreatedAt = DateTime.UtcNow
            };

            _context.SleepOuts.Add(sleepOut);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created sleep out request {SleepOutId} for driver {DriverId}", sleepOut.Id, dto.DriverId);

            // Return the created sleep out with driver info
            return await GetSleepOut(sleepOut.Id);
        }

        /// <summary>
        /// Update a sleep out
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<SleepOutDto>> UpdateSleepOut(int id, [FromBody] UpdateSleepOutDto dto)
        {
            var sleepOut = await _context.SleepOuts.FindAsync(id);
            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            // Only allow updates to non-approved/paid sleep outs
            if (sleepOut.Status == "Approved" || sleepOut.Status == "Paid")
                return BadRequest(new { error = "Cannot update an approved or paid sleep out" });

            if (dto.Amount.HasValue)
                sleepOut.Amount = dto.Amount.Value;

            if (dto.Date.HasValue)
                sleepOut.Date = dto.Date.Value;

            if (!string.IsNullOrEmpty(dto.Reason))
                sleepOut.Reason = dto.Reason;

            if (dto.Notes != null)
                sleepOut.Notes = dto.Notes;

            if (dto.TripSheetId.HasValue)
                sleepOut.TripSheetId = dto.TripSheetId;

            if (!string.IsNullOrEmpty(dto.TripNumber))
                sleepOut.TripNumber = dto.TripNumber;

            if (!string.IsNullOrEmpty(dto.VehicleReg))
                sleepOut.VehicleReg = dto.VehicleReg;

            sleepOut.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated sleep out {SleepOutId}", id);

            return await GetSleepOut(id);
        }

        /// <summary>
        /// Approve or reject a sleep out
        /// </summary>
        [HttpPost("{id}/approve")]
        public async Task<ActionResult<SleepOutDto>> ApproveSleepOut(int id, [FromBody] ApproveSleepOutDto dto)
        {
            var sleepOut = await _context.SleepOuts.FindAsync(id);
            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            if (sleepOut.Status != "Requested")
                return BadRequest(new { error = "Only requested sleep outs can be approved/rejected" });

            // Get user ID from claims
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? approvedByUserId = int.TryParse(userIdClaim, out var uid) ? uid : null;

            sleepOut.Status = dto.Approved ? "Approved" : "Rejected";
            sleepOut.ApprovedByUserId = approvedByUserId;
            sleepOut.ApprovedAt = DateTime.UtcNow;
            sleepOut.UpdatedAt = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(dto.Notes))
                sleepOut.Notes = (sleepOut.Notes ?? "") + "\n[Approval Note]: " + dto.Notes;

            await _context.SaveChangesAsync();

            // If approved, create a finance payment request under Rocket Freight
            if (dto.Approved)
            {
                try
                {
                    var driver = await _context.Drivers.FindAsync(sleepOut.DriverId);
                    var driverName = driver != null ? $"{driver.FirstName} {driver.LastName}" : "Unknown Driver";

                    // Generate unique payment number
                    var paymentCount = await _context.Payments.CountAsync() + 1;
                    var paymentNumber = $"SO-{sleepOut.Id:D5}";

                    var payment = new Payment
                    {
                        PaymentNumber = paymentNumber,
                        PaymentType = "Expense",
                        Payee = CompanyAssets.COMPANY_NAME,
                        Description = $"Sleep Out Allowance - {driverName} - Trip: {sleepOut.TripNumber ?? "N/A"} - {sleepOut.Date:dd MMM yyyy}",
                        Amount = sleepOut.Amount,
                        Currency = "ZAR",
                        Status = "Pending",
                        PaymentMethod = "EFT",
                        PaymentReference = $"SO-{sleepOut.Id:D5}",
                        PaymentDate = sleepOut.Date,
                        Notes = $"Auto-generated from Sleep Out approval (SO-{sleepOut.Id:D5}). Driver: {driverName}. Reason: {sleepOut.Reason ?? "N/A"}",
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Payments.Add(payment);
                    await _context.SaveChangesAsync();

                    _logger.LogInformation("Created finance payment {PaymentNumber} for approved sleep out {SleepOutId}", paymentNumber, id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create finance payment for sleep out {SleepOutId}. Sleep out was still approved.", id);
                }
            }

            _logger.LogInformation("{Action} sleep out {SleepOutId} by user {UserId}", 
                dto.Approved ? "Approved" : "Rejected", id, approvedByUserId);

            return await GetSleepOut(id);
        }

        /// <summary>
        /// Mark a sleep out as paid
        /// </summary>
        [HttpPost("{id}/mark-paid")]
        public async Task<ActionResult<SleepOutDto>> MarkSleepOutAsPaid(int id)
        {
            var sleepOut = await _context.SleepOuts.FindAsync(id);
            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            if (sleepOut.Status != "Approved")
                return BadRequest(new { error = "Only approved sleep outs can be marked as paid" });

            sleepOut.Status = "Paid";
            sleepOut.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Marked sleep out {SleepOutId} as paid", id);

            return await GetSleepOut(id);
        }

        /// <summary>
        /// Delete a sleep out
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSleepOut(int id)
        {
            var sleepOut = await _context.SleepOuts.FindAsync(id);
            if (sleepOut == null)
                return NotFound(new { error = "Sleep out not found" });

            // Only allow deletion of requested sleep outs
            if (sleepOut.Status != "Requested")
                return BadRequest(new { error = "Only requested sleep outs can be deleted" });

            _context.SleepOuts.Remove(sleepOut);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted sleep out {SleepOutId}", id);

            return Ok(new { message = "Sleep out deleted successfully" });
        }

        /// <summary>
        /// Generate and download a PDF for a sleep out
        /// </summary>
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> DownloadSleepOutPdf(int id)
        {
            try
            {
                var sleepOut = await _context.SleepOuts
                    .Include(s => s.Driver)
                    .Include(s => s.Load)
                    .FirstOrDefaultAsync(s => s.Id == id);

                if (sleepOut == null)
                    return NotFound(new { error = "Sleep out not found" });

                // Resolve user names
                string? createdByName = null;
                if (sleepOut.CreatedByUserId.HasValue)
                {
                    var creator = await _context.Users.FindAsync(sleepOut.CreatedByUserId.Value);
                    createdByName = creator != null ? $"{creator.Name} {creator.Surname}" : "Unknown";
                }

                string? approvedByName = null;
                if (sleepOut.ApprovedByUserId.HasValue)
                {
                    var approver = await _context.Users.FindAsync(sleepOut.ApprovedByUserId.Value);
                    approvedByName = approver != null ? $"{approver.Name} {approver.Surname}" : "Unknown";
                }

                var driverName = sleepOut.Driver != null ? $"{sleepOut.Driver.FirstName} {sleepOut.Driver.LastName}" : "N/A";
                var empNumber = sleepOut.Driver?.EmployeeNumber ?? "N/A";
                var html = GenerateSleepOutHtml(sleepOut, driverName, empNumber, createdByName, approvedByName);

                using var memoryStream = new MemoryStream();
                var writerProperties = new WriterProperties();
                using var pdfWriter = new PdfWriter(memoryStream, writerProperties);
                using var pdfDocument = new iText.Kernel.Pdf.PdfDocument(pdfWriter);
                pdfDocument.SetDefaultPageSize(iText.Kernel.Geom.PageSize.A4);

                var converterProperties = new ConverterProperties();
                HtmlConverter.ConvertToPdf(html, pdfDocument, converterProperties);

                var pdfBytes = memoryStream.ToArray();
                var fileName = $"SleepOut_{sleepOut.Id}_{driverName.Replace(" ", "_")}_{sleepOut.Date:yyyyMMdd}.pdf";

                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for sleep out {Id}", id);
                return StatusCode(500, new { error = "Failed to generate PDF" });
            }
        }

        private string GenerateSleepOutHtml(SleepOut sleepOut, string driverName, string empNumber, string? createdByName, string? approvedByName)
        {
            var statusColor = sleepOut.Status switch
            {
                "Approved" => "#4caf50",
                "Rejected" => "#f44336",
                "Paid" => "#2196f3",
                _ => "#ff9800"
            };

            var approvalSection = "";
            if (sleepOut.Status == "Approved" || sleepOut.Status == "Rejected" || sleepOut.Status == "Paid")
            {
                approvalSection = $@"
                <div class='section'>
                    <div class='section-title'>Approval Information</div>
                    <table class='info-table'>
                        <tr><td class='label'>Decision:</td><td><span style='color:{statusColor}; font-weight:bold;'>{sleepOut.Status}</span></td></tr>
                        <tr><td class='label'>Approved/Rejected By:</td><td>{approvedByName ?? "N/A"}</td></tr>
                        <tr><td class='label'>Date:</td><td>{(sleepOut.ApprovedAt.HasValue ? sleepOut.ApprovedAt.Value.ToString("dd MMM yyyy HH:mm") : "N/A")}</td></tr>
                    </table>
                </div>";
            }

            return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'/>
    <style>
        @page {{ size: portrait; margin: 15mm; }}
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #333; font-size: 11pt; }}
        .header {{ display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #033142; padding-bottom: 12px; margin-bottom: 20px; }}
        .header-logo {{ height: 60px; }}
        .header-right {{ text-align: right; }}
        .company-name {{ font-size: 18pt; font-weight: bold; color: #033142; }}
        .company-sub {{ font-size: 9pt; color: #666; }}
        .doc-title {{ text-align: center; font-size: 16pt; font-weight: bold; color: #033142; margin: 15px 0; text-transform: uppercase; letter-spacing: 1px; }}
        .doc-ref {{ text-align: center; font-size: 9pt; color: #888; margin-bottom: 20px; }}
        .section {{ margin-bottom: 15px; }}
        .section-title {{ font-size: 11pt; font-weight: bold; color: #033142; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }}
        .info-table {{ width: 100%; border-collapse: collapse; }}
        .info-table td {{ padding: 5px 10px; vertical-align: top; }}
        .info-table .label {{ font-weight: bold; color: #555; width: 180px; }}
        .status-badge {{ display: inline-block; padding: 4px 14px; border-radius: 12px; color: white; font-weight: bold; font-size: 10pt; }}
        .amount-box {{ background: #f0f7ff; border: 2px solid #033142; border-radius: 8px; padding: 15px; text-align: center; margin: 15px 0; }}
        .amount-value {{ font-size: 22pt; font-weight: bold; color: #033142; }}
        .amount-label {{ font-size: 9pt; color: #666; text-transform: uppercase; }}
        .notes-box {{ background: #fafafa; border: 1px solid #eee; border-radius: 4px; padding: 10px; min-height: 40px; font-style: italic; color: #666; }}
        .footer {{ margin-top: 30px; border-top: 2px solid #033142; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8pt; color: #999; }}
        .signature-section {{ margin-top: 40px; display: flex; justify-content: space-between; }}
        .signature-block {{ width: 45%; }}
        .signature-line {{ border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 9pt; color: #666; }}
    </style>
</head>
<body>
    <div class='header'>
        <img src='data:image/png;base64,{CompanyAssets.LOGO_BASE64}' class='header-logo' alt='Rocket Freight Logo' />
        <div class='header-right'>
            <div class='company-name'>{CompanyAssets.COMPANY_NAME}</div>
            <div class='company-sub'>Logistics Division</div>
            <div class='company-sub'>Sleep Out Allowance</div>
        </div>
    </div>

    <div class='doc-title'>Driver Sleep Out Allowance</div>
    <div class='doc-ref'>Reference: SO-{sleepOut.Id:D5} | Generated: {DateTime.Now:dd MMM yyyy HH:mm}</div>

    <div class='section'>
        <div class='section-title'>Driver Information</div>
        <table class='info-table'>
            <tr><td class='label'>Driver Name:</td><td><strong>{driverName}</strong></td></tr>
            <tr><td class='label'>Employee Number:</td><td>{empNumber}</td></tr>
        </table>
    </div>

    <div class='section'>
        <div class='section-title'>Trip Details</div>
        <table class='info-table'>
            <tr><td class='label'>Trip Number:</td><td>{sleepOut.TripNumber ?? "N/A"}</td></tr>
            <tr><td class='label'>Vehicle Registration:</td><td>{sleepOut.VehicleReg ?? "N/A"}</td></tr>
            <tr><td class='label'>Date:</td><td>{sleepOut.Date:dd MMM yyyy}</td></tr>
            <tr><td class='label'>Status:</td><td><span class='status-badge' style='background:{statusColor};'>{sleepOut.Status}</span></td></tr>
        </table>
    </div>

    <div class='amount-box'>
        <div class='amount-label'>Sleep Out Allowance Amount</div>
        <div class='amount-value'>R {sleepOut.Amount:N2}</div>
    </div>

    <div class='section'>
        <div class='section-title'>Reason</div>
        <div class='notes-box'>{(string.IsNullOrEmpty(sleepOut.Reason) ? "No reason provided" : sleepOut.Reason)}</div>
    </div>

    {(string.IsNullOrEmpty(sleepOut.Notes) ? "" : $@"
    <div class='section'>
        <div class='section-title'>Additional Notes</div>
        <div class='notes-box'>{sleepOut.Notes}</div>
    </div>")}

    <div class='section'>
        <div class='section-title'>Request Information</div>
        <table class='info-table'>
            <tr><td class='label'>Requested By:</td><td><strong>{createdByName ?? "N/A"}</strong></td></tr>
            <tr><td class='label'>Request Date:</td><td>{sleepOut.CreatedAt:dd MMM yyyy HH:mm}</td></tr>
        </table>
    </div>

    {approvalSection}

    <div class='signature-section'>
        <div class='signature-block'>
            <div class='signature-line'>Driver Signature</div>
        </div>
        <div class='signature-block'>
            <div class='signature-line'>Manager Signature</div>
        </div>
    </div>

    <div class='footer'>
        <span>{CompanyAssets.COMPANY_NAME} &bull; Sleep Out Allowance &bull; SO-{sleepOut.Id:D5}</span>
        <span>Printed: {DateTime.Now:dd MMM yyyy HH:mm}</span>
    </div>
</body>
</html>";
        }
    }
}

