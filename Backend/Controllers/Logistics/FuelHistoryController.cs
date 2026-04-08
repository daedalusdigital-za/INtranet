using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services.TFN.Clients;
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
        private readonly TfnTransactionsClient _tfnTransactionsClient;

        public FuelHistoryController(
            ApplicationDbContext context, 
            ILogger<FuelHistoryController> logger,
            TfnTransactionsClient tfnTransactionsClient)
        {
            _context = context;
            _logger = logger;
            _tfnTransactionsClient = tfnTransactionsClient;
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
        /// Sync fuel transactions from TFN API into the FuelTransactions table.
        /// Fetches TFN transactions from the day after the latest existing record (or last 14 days)
        /// and converts them to the same format as manually imported data.
        /// </summary>
        [HttpPost("sync-from-tfn")]
        public async Task<ActionResult> SyncFromTfn()
        {
            try
            {
                // Find the latest transaction date we already have
                var latestDate = await _context.FuelTransactions
                    .MaxAsync(f => (DateTime?)f.TransactionDate);

                // Start from the day after latest, or 14 days back if no data
                var fromDate = latestDate?.Date.AddDays(1) ?? DateTime.UtcNow.AddDays(-14);

                // Don't fetch if we're already up to today
                if (fromDate.Date > DateTime.UtcNow.Date)
                {
                    return Ok(new { 
                        message = "Already up to date", 
                        imported = 0, 
                        skippedDuplicates = 0,
                        latestDate = latestDate?.ToString("yyyy-MM-dd") 
                    });
                }

                _logger.LogInformation("Syncing TFN transactions from {FromDate} to FuelTransactions table", fromDate);

                // Try TransactionsWithUtilisedOrders first, fall back to basic Transactions
                var tfnTransactions = await _tfnTransactionsClient.GetTransactionsWithOrdersAsync(fromDate);
                if (tfnTransactions == null)
                {
                    _logger.LogWarning("TransactionsWithOrders failed, trying basic Transactions endpoint");
                    tfnTransactions = await _tfnTransactionsClient.GetTransactionsAsync(fromDate);
                }

                if (tfnTransactions == null || tfnTransactions.Count == 0)
                {
                    return Ok(new { 
                        message = "No new transactions found from TFN", 
                        imported = 0, 
                        skippedDuplicates = 0,
                        periodChecked = $"{fromDate:yyyy-MM-dd} to {DateTime.UtcNow:yyyy-MM-dd}" 
                    });
                }

                // Build lookup of vehicles for matching
                var vehicles = await _context.Vehicles
                    .ToDictionaryAsync(v => v.RegistrationNumber.ToUpper().Replace("-", "").Replace(" ", ""), v => v);

                // Get existing transactions for deduplication (date + reg + amount)
                var existingKeys = await _context.FuelTransactions
                    .Where(f => f.TransactionDate >= fromDate)
                    .Select(f => new { f.RegistrationNumber, f.TransactionDate, f.AmountSpent })
                    .ToListAsync();

                var existingSet = new HashSet<string>(existingKeys.Select(k => 
                    $"{k.RegistrationNumber.ToUpper()}|{k.TransactionDate:yyyy-MM-dd HH:mm}|{k.AmountSpent:F2}"));

                // Determine DepotAssignment from existing data (reg -> most recent assignment)
                var depotAssignments = await _context.FuelTransactions
                    .Where(f => f.DepotAssignment != null)
                    .GroupBy(f => f.RegistrationNumber.ToUpper())
                    .Select(g => new { 
                        Reg = g.Key, 
                        Assignment = g.OrderByDescending(f => f.TransactionDate).First().DepotAssignment 
                    })
                    .ToDictionaryAsync(x => x.Reg, x => x.Assignment);

                var newRecords = new List<FuelTransaction>();
                int skipped = 0;

                foreach (var tfn in tfnTransactions)
                {
                    if (string.IsNullOrEmpty(tfn.VehicleRegistration)) continue;

                    var regNormalized = tfn.VehicleRegistration.ToUpper().Replace("-", "").Replace(" ", "");
                    var regUpper = tfn.VehicleRegistration.ToUpper().Trim();

                    // Dedup check
                    var key = $"{regUpper}|{tfn.TransactionDate:yyyy-MM-dd HH:mm}|{tfn.TotalAmount:F2}";
                    if (existingSet.Contains(key))
                    {
                        skipped++;
                        continue;
                    }
                    existingSet.Add(key);

                    // Match vehicle
                    int? vehicleId = vehicles.ContainsKey(regNormalized) ? vehicles[regNormalized].Id : null;

                    // Get depot assignment from history
                    var assignment = depotAssignments.ContainsKey(regUpper) ? depotAssignments[regUpper] : null;

                    newRecords.Add(new FuelTransaction
                    {
                        VehicleId = vehicleId,
                        RegistrationNumber = regUpper,
                        CardNumber = tfn.VirtualCardNumber,
                        DepotName = tfn.DepotName ?? "TFN",
                        AllocationLitres = tfn.Litres, // TFN doesn't have separate allocation, use litres
                        LitresUsed = tfn.Litres,
                        TransactionDate = tfn.TransactionDate,
                        AmountSpent = tfn.TotalAmount,
                        DepotAssignment = assignment,
                        ReportMonth = tfn.TransactionDate.Month,
                        ReportYear = tfn.TransactionDate.Year,
                        Notes = $"TFN Sync - {tfn.TransactionNumber}"
                    });
                }

                if (newRecords.Count > 0)
                {
                    await _context.FuelTransactions.AddRangeAsync(newRecords);
                    await _context.SaveChangesAsync();
                }

                // Group by month for reporting
                var monthGroups = newRecords
                    .GroupBy(r => new { r.ReportMonth, r.ReportYear })
                    .Select(g => new { 
                        Month = $"{CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(g.Key.ReportMonth)} {g.Key.ReportYear}",
                        Count = g.Count(),
                        Litres = g.Sum(r => r.LitresUsed),
                        Amount = g.Sum(r => r.AmountSpent)
                    })
                    .ToList();

                _logger.LogInformation("TFN Fuel Sync: Imported {Count} new transactions, skipped {Skipped} duplicates",
                    newRecords.Count, skipped);

                return Ok(new
                {
                    message = $"Successfully synced {newRecords.Count} transactions from TFN",
                    imported = newRecords.Count,
                    skippedDuplicates = skipped,
                    totalFromTfn = tfnTransactions.Count,
                    periodChecked = $"{fromDate:yyyy-MM-dd} to {DateTime.UtcNow:yyyy-MM-dd}",
                    monthBreakdown = monthGroups
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing fuel data from TFN");
                return StatusCode(500, new { message = "Failed to sync from TFN", error = ex.Message });
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
