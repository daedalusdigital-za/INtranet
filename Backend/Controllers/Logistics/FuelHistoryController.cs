using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using System.Globalization;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FuelHistoryController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FuelHistoryController> _logger;

        public FuelHistoryController(ApplicationDbContext context, ILogger<FuelHistoryController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Get all fuel transactions with optional filtering
        /// </summary>
        [HttpGet("transactions")]
        public async Task<ActionResult<IEnumerable<FuelTransactionDto>>> GetTransactions(
            [FromQuery] int? vehicleId,
            [FromQuery] string? registrationNumber,
            [FromQuery] int? month,
            [FromQuery] int? year,
            [FromQuery] string? depotAssignment,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var query = _context.FuelTransactions
                .Include(f => f.Vehicle)
                    .ThenInclude(v => v!.VehicleType)
                .AsQueryable();

            if (vehicleId.HasValue)
                query = query.Where(f => f.VehicleId == vehicleId.Value);

            if (!string.IsNullOrEmpty(registrationNumber))
                query = query.Where(f => f.RegistrationNumber.Contains(registrationNumber));

            if (month.HasValue)
                query = query.Where(f => f.ReportMonth == month.Value);

            if (year.HasValue)
                query = query.Where(f => f.ReportYear == year.Value);

            if (!string.IsNullOrEmpty(depotAssignment))
                query = query.Where(f => f.DepotAssignment != null && f.DepotAssignment.Contains(depotAssignment));

            var total = await query.CountAsync();

            var transactions = await query
                .OrderByDescending(f => f.TransactionDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(f => new FuelTransactionDto
                {
                    Id = f.Id,
                    VehicleId = f.VehicleId,
                    RegistrationNumber = f.RegistrationNumber,
                    CardNumber = f.CardNumber,
                    DepotName = f.DepotName,
                    AllocationLitres = f.AllocationLitres,
                    LitresUsed = f.LitresUsed,
                    TransactionDate = f.TransactionDate,
                    AmountSpent = f.AmountSpent,
                    DepotAssignment = f.DepotAssignment,
                    ReportMonth = f.ReportMonth,
                    ReportYear = f.ReportYear,
                    Notes = f.Notes,
                    CreatedAt = f.CreatedAt,
                    VehicleMake = f.Vehicle != null ? f.Vehicle.Make : null,
                    VehicleModel = f.Vehicle != null ? f.Vehicle.Model : null,
                    VehicleTypeName = f.Vehicle != null && f.Vehicle.VehicleType != null ? f.Vehicle.VehicleType.Name : null
                })
                .ToListAsync();

            Response.Headers.Append("X-Total-Count", total.ToString());
            return Ok(transactions);
        }

        /// <summary>
        /// Get fuel history for a specific vehicle
        /// </summary>
        [HttpGet("vehicle/{vehicleId}")]
        public async Task<ActionResult<IEnumerable<FuelTransactionDto>>> GetVehicleFuelHistory(int vehicleId)
        {
            var vehicle = await _context.Vehicles.FindAsync(vehicleId);
            if (vehicle == null)
                return NotFound("Vehicle not found");

            var transactions = await _context.FuelTransactions
                .Where(f => f.VehicleId == vehicleId)
                .OrderByDescending(f => f.TransactionDate)
                .Select(f => new FuelTransactionDto
                {
                    Id = f.Id,
                    VehicleId = f.VehicleId,
                    RegistrationNumber = f.RegistrationNumber,
                    CardNumber = f.CardNumber,
                    DepotName = f.DepotName,
                    AllocationLitres = f.AllocationLitres,
                    LitresUsed = f.LitresUsed,
                    TransactionDate = f.TransactionDate,
                    AmountSpent = f.AmountSpent,
                    DepotAssignment = f.DepotAssignment,
                    ReportMonth = f.ReportMonth,
                    ReportYear = f.ReportYear,
                    Notes = f.Notes,
                    CreatedAt = f.CreatedAt
                })
                .ToListAsync();

            return Ok(transactions);
        }

        /// <summary>
        /// Get monthly fuel report summary
        /// </summary>
        [HttpGet("monthly-report")]
        public async Task<ActionResult<FuelMonthlyReportDto>> GetMonthlyReport(
            [FromQuery] int month,
            [FromQuery] int year)
        {
            var transactions = await _context.FuelTransactions
                .Include(f => f.Vehicle)
                    .ThenInclude(v => v!.VehicleType)
                .Where(f => f.ReportMonth == month && f.ReportYear == year)
                .ToListAsync();

            if (!transactions.Any())
                return NotFound($"No fuel data found for {CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(month)} {year}");

            var vehicleSummaries = transactions
                .GroupBy(f => new { f.VehicleId, f.RegistrationNumber })
                .Select(g => new FuelHistorySummaryDto
                {
                    VehicleId = g.Key.VehicleId ?? 0,
                    RegistrationNumber = g.Key.RegistrationNumber,
                    VehicleMake = g.First().Vehicle?.Make,
                    VehicleModel = g.First().Vehicle?.Model,
                    VehicleTypeName = g.First().Vehicle?.VehicleType?.Name,
                    DepotAssignment = g.First().DepotAssignment,
                    TransactionCount = g.Count(),
                    TotalLitresUsed = g.Sum(f => f.LitresUsed),
                    TotalAmountSpent = g.Sum(f => f.AmountSpent),
                    AverageLitresPerFill = g.Average(f => f.LitresUsed),
                    AllocationLitres = g.First().AllocationLitres,
                    AllocationUsagePercent = g.First().AllocationLitres > 0
                        ? Math.Round(g.Sum(f => f.LitresUsed) / (g.First().AllocationLitres * g.Count()) * 100, 1)
                        : 0
                })
                .OrderBy(s => s.DepotAssignment)
                .ThenBy(s => s.RegistrationNumber)
                .ToList();

            var totalLitres = transactions.Sum(f => f.LitresUsed);
            var totalAmount = transactions.Sum(f => f.AmountSpent);

            var report = new FuelMonthlyReportDto
            {
                ReportMonth = month,
                ReportYear = year,
                MonthName = CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(month),
                TotalTransactions = transactions.Count,
                UniqueVehicles = transactions.Select(f => f.RegistrationNumber).Distinct().Count(),
                TotalLitresUsed = totalLitres,
                TotalAmountSpent = totalAmount,
                AverageCostPerLitre = totalLitres > 0 ? Math.Round(totalAmount / totalLitres, 2) : 0,
                VehicleSummaries = vehicleSummaries
            };

            return Ok(report);
        }

        /// <summary>
        /// Get available report periods
        /// </summary>
        [HttpGet("periods")]
        public async Task<ActionResult> GetAvailablePeriods()
        {
            var periods = await _context.FuelTransactions
                .GroupBy(f => new { f.ReportYear, f.ReportMonth })
                .Select(g => new
                {
                    g.Key.ReportYear,
                    g.Key.ReportMonth,
                    MonthName = "",
                    TransactionCount = g.Count(),
                    TotalLitres = g.Sum(f => f.LitresUsed),
                    TotalAmount = g.Sum(f => f.AmountSpent)
                })
                .OrderByDescending(p => p.ReportYear)
                .ThenByDescending(p => p.ReportMonth)
                .ToListAsync();

            // Add month names
            var result = periods.Select(p => new
            {
                p.ReportYear,
                p.ReportMonth,
                MonthName = CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(p.ReportMonth),
                p.TransactionCount,
                p.TotalLitres,
                p.TotalAmount
            });

            return Ok(result);
        }

        /// <summary>
        /// Get fuel summary grouped by depot assignment (vehicle group)
        /// </summary>
        [HttpGet("by-assignment")]
        public async Task<ActionResult> GetByDepotAssignment(
            [FromQuery] int month,
            [FromQuery] int year)
        {
            var groups = await _context.FuelTransactions
                .Where(f => f.ReportMonth == month && f.ReportYear == year)
                .GroupBy(f => f.DepotAssignment ?? "Unassigned")
                .Select(g => new
                {
                    DepotAssignment = g.Key,
                    VehicleCount = g.Select(f => f.RegistrationNumber).Distinct().Count(),
                    TransactionCount = g.Count(),
                    TotalLitres = g.Sum(f => f.LitresUsed),
                    TotalAmount = g.Sum(f => f.AmountSpent),
                    AverageLitresPerVehicle = g.Sum(f => f.LitresUsed) / g.Select(f => f.RegistrationNumber).Distinct().Count()
                })
                .OrderBy(g => g.DepotAssignment)
                .ToListAsync();

            return Ok(groups);
        }

        /// <summary>
        /// Bulk import fuel transactions
        /// </summary>
        [HttpPost("import")]
        public async Task<ActionResult<FuelImportResultDto>> ImportFuelData([FromBody] List<FuelTransactionImportDto> transactions)
        {
            var result = new FuelImportResultDto { TotalRecords = transactions.Count };

            try
            {
                // Get all vehicle registrations for matching
                var vehicles = await _context.Vehicles
                    .ToDictionaryAsync(v => v.RegistrationNumber.ToUpper(), v => v.Id);

                var fuelRecords = new List<FuelTransaction>();
                var unmatchedRegs = new HashSet<string>();

                foreach (var t in transactions)
                {
                    var regUpper = t.RegistrationNumber.ToUpper().Trim();
                    int? vehicleId = vehicles.ContainsKey(regUpper) ? vehicles[regUpper] : null;

                    if (vehicleId == null)
                        unmatchedRegs.Add(regUpper);
                    else
                        result.MatchedVehicles++;

                    fuelRecords.Add(new FuelTransaction
                    {
                        VehicleId = vehicleId,
                        RegistrationNumber = regUpper,
                        CardNumber = t.CardNumber,
                        DepotName = t.DepotName,
                        AllocationLitres = t.AllocationLitres,
                        LitresUsed = t.LitresUsed,
                        TransactionDate = t.TransactionDate,
                        AmountSpent = t.AmountSpent,
                        DepotAssignment = t.DepotAssignment,
                        ReportMonth = t.ReportMonth,
                        ReportYear = t.ReportYear
                    });
                }

                await _context.FuelTransactions.AddRangeAsync(fuelRecords);
                await _context.SaveChangesAsync();

                result.ImportedCount = fuelRecords.Count;
                result.UnmatchedVehicles = unmatchedRegs.Count;
                result.UnmatchedRegistrations = unmatchedRegs.ToList();

                _logger.LogInformation("Imported {Count} fuel transactions for {Month}/{Year}",
                    result.ImportedCount, transactions.FirstOrDefault()?.ReportMonth, transactions.FirstOrDefault()?.ReportYear);

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing fuel data");
                result.Errors.Add(ex.Message);
                return StatusCode(500, result);
            }
        }

        /// <summary>
        /// Delete fuel transactions for a specific period
        /// </summary>
        [HttpDelete("period")]
        public async Task<ActionResult> DeletePeriod([FromQuery] int month, [FromQuery] int year)
        {
            var count = await _context.FuelTransactions
                .Where(f => f.ReportMonth == month && f.ReportYear == year)
                .ExecuteDeleteAsync();

            return Ok(new { deleted = count, month, year });
        }
    }
}
