using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services.TFN;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/tfn")]
    public class TfnController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly TfnSyncService _syncService;
        private readonly ILogger<TfnController> _logger;

        public TfnController(
            ApplicationDbContext context,
            TfnSyncService syncService,
            ILogger<TfnController> logger)
        {
            _context = context;
            _syncService = syncService;
            _logger = logger;
        }

        // POST: api/logistics/tfn/sync
        [HttpPost("sync")]
        public async Task<ActionResult<TfnSyncResult>> SyncAll()
        {
            try
            {
                _logger.LogInformation("Manual TFN sync triggered by user");
                var result = await _syncService.SyncAllAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during TFN sync");
                return StatusCode(500, new { error = "Failed to sync TFN data", details = ex.Message });
            }
        }

        // POST: api/logistics/tfn/sync/vehicles
        [HttpPost("sync/vehicles")]
        public async Task<ActionResult<SyncResult>> SyncVehicles()
        {
            try
            {
                var result = await _syncService.SyncVehiclesAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing TFN vehicles");
                return StatusCode(500, new { error = "Failed to sync vehicles", details = ex.Message });
            }
        }

        // POST: api/logistics/tfn/sync/transactions
        [HttpPost("sync/transactions")]
        public async Task<ActionResult<SyncResult>> SyncTransactions([FromQuery] DateTime? fromDate = null)
        {
            try
            {
                var result = await _syncService.SyncTransactionsAsync(fromDate);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing TFN transactions");
                return StatusCode(500, new { error = "Failed to sync transactions", details = ex.Message });
            }
        }

        // GET: api/logistics/tfn/transactions
        [HttpGet("transactions")]
        public async Task<ActionResult> GetTransactions(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? vehicleId = null,
            [FromQuery] int? driverId = null)
        {
            try
            {
                var query = _context.TfnTransactions
                    .Include(t => t.Vehicle)
                    .Include(t => t.Driver)
                    .Include(t => t.Depot)
                    .Include(t => t.Order)
                    .AsQueryable();

                if (fromDate.HasValue)
                    query = query.Where(t => t.TransactionDate >= fromDate.Value);

                if (toDate.HasValue)
                    query = query.Where(t => t.TransactionDate <= toDate.Value);

                if (vehicleId.HasValue)
                    query = query.Where(t => t.VehicleId == vehicleId.Value);

                if (driverId.HasValue)
                    query = query.Where(t => t.DriverId == driverId.Value);

                var transactions = await query
                    .OrderByDescending(t => t.TransactionDate)
                    .Take(100)
                    .Select(t => new
                    {
                        t.TfnTransactionId,
                        t.TransactionDate,
                        Vehicle = new { VehicleId = t.Vehicle.Id, t.Vehicle.RegistrationNumber },
                        Driver = new { t.Driver.Id, DriverName = t.Driver.FirstName + " " + t.Driver.LastName },
                        Depot = new { t.Depot.TfnDepotId, t.Depot.Name },
                        t.FuelType,
                        t.Litres,
                        t.PricePerLitre,
                        t.TotalAmount,
                        t.OdometerReading,
                        t.FuelEfficiency,
                        t.IsAnomaly,
                        t.AnomalyReason
                    })
                    .ToListAsync();

                return Ok(transactions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving transactions");
                return StatusCode(500, new { error = "Failed to retrieve transactions", details = ex.Message });
            }
        }

        // GET: api/logistics/tfn/fuel-efficiency
        [HttpGet("fuel-efficiency")]
        public async Task<ActionResult> GetFuelEfficiency([FromQuery] int? vehicleId = null)
        {
            try
            {
                var query = _context.TfnTransactions
                    .Include(t => t.Vehicle)
                    .Where(t => t.FuelEfficiency.HasValue && t.FuelEfficiency > 0)
                    .AsQueryable();

                if (vehicleId.HasValue)
                    query = query.Where(t => t.VehicleId == vehicleId.Value);

                var efficiencyData = await query
                    .GroupBy(t => new { t.VehicleId, t.Vehicle.RegistrationNumber })
                    .Select(g => new
                    {
                        VehicleId = g.Key.VehicleId,
                        RegistrationNumber = g.Key.RegistrationNumber,
                        AverageEfficiency = g.Average(t => t.FuelEfficiency),
                        MinEfficiency = g.Min(t => t.FuelEfficiency),
                        MaxEfficiency = g.Max(t => t.FuelEfficiency),
                        TotalLitres = g.Sum(t => t.Litres),
                        TotalCost = g.Sum(t => t.TotalAmount),
                        TransactionCount = g.Count()
                    })
                    .OrderByDescending(x => x.TotalCost)
                    .ToListAsync();

                return Ok(efficiencyData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating fuel efficiency");
                return StatusCode(500, new { error = "Failed to calculate fuel efficiency", details = ex.Message });
            }
        }

        // GET: api/logistics/tfn/vehicles
        [HttpGet("vehicles")]
        public async Task<ActionResult> GetVehiclesWithTfnData()
        {
            try
            {
                var vehicles = await _context.Vehicles
                    .Where(v => v.TfnVehicleId != null)
                    .Select(v => new
                    {
                        VehicleId = v.Id,
                        v.RegistrationNumber,
                        v.Make,
                        v.Model,
                        v.FuelType,
                        v.TankSize,
                        v.AverageFuelConsumption,
                        v.TfnSubAccountNumber,
                        v.TfnVirtualCardNumber,
                        v.TfnCreditLimit,
                        v.TfnCurrentBalance,
                        v.TfnLastSyncedAt
                    })
                    .ToListAsync();

                return Ok(vehicles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vehicles with TFN data");
                return StatusCode(500, new { error = "Failed to retrieve vehicles", details = ex.Message });
            }
        }

        // GET: api/logistics/tfn/balances
        [HttpGet("balances")]
        public async Task<ActionResult> GetAccountBalances()
        {
            try
            {
                var balances = await _context.TfnAccountBalances
                    .Include(b => b.Vehicle)
                    .Include(b => b.Driver)
                    .Where(b => b.IsActive)
                    .Select(b => new
                    {
                        TfnAccountBalanceId = b.Id,
                        b.SubAccountNumber,
                        Vehicle = b.Vehicle != null ? new { VehicleId = b.Vehicle.Id, b.Vehicle.RegistrationNumber } : null,
                        Driver = b.Driver != null ? new { b.Driver.Id, DriverName = b.Driver.FirstName + " " + b.Driver.LastName } : null,
                        b.CurrentBalance,
                        b.CreditLimit,
                        b.AvailableCredit,
                        b.MonthToDateSpend,
                        b.YearToDateSpend,
                        b.IsSuspended,
                        b.SuspensionReason,
                        LastUpdated = b.UpdatedAt
                    })
                    .ToListAsync();

                return Ok(balances);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving account balances");
                return StatusCode(500, new { error = "Failed to retrieve balances", details = ex.Message });
            }
        }

        // GET: api/logistics/tfn/orders
        [HttpGet("orders")]
        public async Task<ActionResult> GetOrders(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] int? vehicleId = null,
            [FromQuery] int? driverId = null)
        {
            try
            {
                var query = _context.TfnOrders
                    .Include(o => o.Vehicle)
                    .Include(o => o.Driver)
                    .Include(o => o.Load)
                    .AsQueryable();

                if (fromDate.HasValue)
                    query = query.Where(o => o.OrderDate >= fromDate.Value);

                if (vehicleId.HasValue)
                    query = query.Where(o => o.VehicleId == vehicleId.Value);

                if (driverId.HasValue)
                    query = query.Where(o => o.DriverId == driverId.Value);

                var orders = await query
                    .OrderByDescending(o => o.OrderDate)
                    .Take(200)
                    .Select(o => new
                    {
                        o.Id,
                        o.TfnOrderId,
                        o.OrderNumber,
                        o.OrderDate,
                        o.ExpiryDate,
                        VehicleRegistration = o.VehicleRegistration ?? (o.Vehicle != null ? o.Vehicle.RegistrationNumber : null),
                        Vehicle = o.Vehicle != null ? new { VehicleId = o.Vehicle.Id, o.Vehicle.RegistrationNumber } : null,
                        Driver = o.Driver != null ? new { o.Driver.Id, DriverName = o.Driver.FirstName + " " + o.Driver.LastName } : null,
                        Load = o.Load != null ? new { LoadId = o.Load.Id, o.Load.LoadNumber } : null,
                        o.VirtualCardNumber,
                        ProductCode = o.ProductCode ?? o.FuelType,
                        o.AllocatedLitres,
                        o.UsedLitres,
                        o.RemainingLitres,
                        o.AllocatedAmount,
                        o.UsedAmount,
                        o.RemainingAmount,
                        o.Status,
                        o.Notes
                    })
                    .ToListAsync();

                return Ok(orders);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving orders");
                return StatusCode(500, new { error = "Failed to retrieve orders", details = ex.Message });
            }
        }

        // GET: api/logistics/tfn/depots
        [HttpGet("depots")]
        public async Task<ActionResult> GetDepots()
        {
            try
            {
                var depots = await _context.TfnDepots
                    .Where(d => d.IsActive)
                    .Select(d => new
                    {
                        d.TfnDepotId,
                        d.Code,
                        d.Name,
                        d.Address,
                        d.City,
                        d.Province,
                        d.PostalCode,
                        d.Latitude,
                        d.Longitude,
                        d.ContactPerson,
                        d.ContactPhone
                    })
                    .ToListAsync();

                return Ok(depots);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving depots");
                return StatusCode(500, new { error = "Failed to retrieve depots", details = ex.Message });
            }
        }

        // GET: api/logistics/tfn/dashboard-summary
        [HttpGet("dashboard-summary")]
        public async Task<ActionResult> GetDashboardSummary()
        {
            try
            {
                var today = DateTime.Today;
                var thisMonthStart = new DateTime(today.Year, today.Month, 1);
                var lastMonthStart = thisMonthStart.AddMonths(-1);

                // Get current month transactions
                var thisMonthTransactions = await _context.TfnTransactions
                    .Where(t => t.TransactionDate >= thisMonthStart)
                    .ToListAsync();

                // Get last month transactions
                var lastMonthTransactions = await _context.TfnTransactions
                    .Where(t => t.TransactionDate >= lastMonthStart && t.TransactionDate < thisMonthStart)
                    .ToListAsync();

                // Get recent anomalies
                var recentAnomalies = await _context.TfnTransactions
                    .Where(t => t.IsAnomaly && t.TransactionDate >= today.AddDays(-7))
                    .Include(t => t.Vehicle)
                    .Include(t => t.Driver)
                    .Select(t => new
                    {
                        t.TransactionDate,
                        Vehicle = t.Vehicle.RegistrationNumber,
                        Driver = t.Driver.FirstName + " " + t.Driver.LastName,
                        t.AnomalyReason,
                        t.Litres,
                        t.TotalAmount
                    })
                    .OrderByDescending(t => t.TransactionDate)
                    .Take(10)
                    .ToListAsync();

                // Get low balance vehicles
                var lowBalanceVehicles = await _context.TfnAccountBalances
                    .Include(b => b.Vehicle)
                    .Where(b => b.Vehicle != null && b.IsActive && b.AvailableCredit < (b.CreditLimit * 0.2m))
                    .Select(b => new
                    {
                        Vehicle = b.Vehicle!.RegistrationNumber,
                        b.CurrentBalance,
                        b.CreditLimit,
                        b.AvailableCredit,
                        PercentageRemaining = (b.AvailableCredit / b.CreditLimit) * 100
                    })
                    .OrderBy(b => b.PercentageRemaining)
                    .Take(5)
                    .ToListAsync();

                // Top fuel consumers this month
                var topConsumers = thisMonthTransactions
                    .GroupBy(t => new { t.VehicleId, t.Vehicle?.RegistrationNumber })
                    .Select(g => new
                    {
                        Vehicle = g.Key.RegistrationNumber,
                        TotalLitres = g.Sum(t => t.Litres),
                        TotalCost = g.Sum(t => t.TotalAmount),
                        TransactionCount = g.Count()
                    })
                    .OrderByDescending(x => x.TotalCost)
                    .Take(5)
                    .ToList();

                var summary = new
                {
                    ThisMonth = new
                    {
                        TotalLitres = thisMonthTransactions.Sum(t => t.Litres),
                        TotalCost = thisMonthTransactions.Sum(t => t.TotalAmount),
                        TransactionCount = thisMonthTransactions.Count,
                        AverageEfficiency = thisMonthTransactions.Where(t => t.FuelEfficiency.HasValue).Average(t => t.FuelEfficiency)
                    },
                    LastMonth = new
                    {
                        TotalLitres = lastMonthTransactions.Sum(t => t.Litres),
                        TotalCost = lastMonthTransactions.Sum(t => t.TotalAmount),
                        TransactionCount = lastMonthTransactions.Count
                    },
                    RecentAnomalies = recentAnomalies,
                    LowBalanceVehicles = lowBalanceVehicles,
                    TopConsumers = topConsumers
                };

                return Ok(summary);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating dashboard summary");
                return StatusCode(500, new { error = "Failed to generate dashboard summary", details = ex.Message });
            }
        }
    }
}
