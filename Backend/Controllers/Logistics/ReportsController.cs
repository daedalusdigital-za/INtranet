using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class ReportsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ReportsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/logistics/reports/delivery-performance
        [HttpGet("delivery-performance")]
        public async Task<IActionResult> GetDeliveryPerformance([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var start = startDate ?? DateTime.Now.AddMonths(-1);
            var end = endDate ?? DateTime.Now;

            var loads = await _context.Loads
                .Where(l => l.ScheduledPickupDate >= start && l.ScheduledPickupDate <= end)
                .Include(l => l.ProofOfDelivery)
                .ToListAsync();

            var totalLoads = loads.Count;
            var deliveredLoads = loads.Count(l => l.Status == "Delivered");
            var onTimeDeliveries = loads.Count(l => l.Status == "Delivered" && 
                l.ProofOfDelivery != null && 
                l.ProofOfDelivery.DeliveredAt <= l.ScheduledPickupDate?.AddHours(24));
            var lateDeliveries = deliveredLoads - onTimeDeliveries;
            var inTransit = loads.Count(l => l.Status == "InTransit");
            var cancelled = loads.Count(l => l.Status == "Cancelled");

            var onTimePercentage = deliveredLoads > 0 ? (onTimeDeliveries * 100.0 / deliveredLoads) : 0;

            return Ok(new
            {
                Period = new { Start = start, End = end },
                TotalLoads = totalLoads,
                DeliveredLoads = deliveredLoads,
                OnTimeDeliveries = onTimeDeliveries,
                LateDeliveries = lateDeliveries,
                InTransit = inTransit,
                Cancelled = cancelled,
                OnTimePercentage = Math.Round(onTimePercentage, 2),
                DeliveryRate = totalLoads > 0 ? Math.Round(deliveredLoads * 100.0 / totalLoads, 2) : 0
            });
        }

        // GET: api/logistics/reports/pod-report
        [HttpGet("pod-report")]
        public async Task<IActionResult> GetPodReport([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var start = startDate ?? DateTime.Now.AddMonths(-1);
            var end = endDate ?? DateTime.Now;

            var loads = await _context.Loads
                .Where(l => l.ScheduledPickupDate >= start && l.ScheduledPickupDate <= end)
                .Include(l => l.ProofOfDelivery)
                .Include(l => l.Driver)
                .Include(l => l.Customer)
                .ToListAsync();

            var totalDelivered = loads.Count(l => l.Status == "Delivered");
            var withPod = loads.Count(l => l.ProofOfDelivery != null);
            var missingPod = totalDelivered - withPod;
            var withSignature = loads.Count(l => l.ProofOfDelivery != null && !string.IsNullOrEmpty(l.ProofOfDelivery.SignatureUrl));
            var withPhotos = loads.Count(l => l.ProofOfDelivery != null && !string.IsNullOrEmpty(l.ProofOfDelivery.PhotoUrls));

            var podDetails = loads
                .Where(l => l.ProofOfDelivery != null)
                .Select(l => new
                {
                    LoadNumber = l.LoadNumber,
                    CustomerName = l.Customer?.Name ?? "Unknown",
                    DriverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}" : "Unknown",
                    DeliveredAt = l.ProofOfDelivery.DeliveredAt,
                    ReceiverName = l.ProofOfDelivery.RecipientName,
                    HasSignature = !string.IsNullOrEmpty(l.ProofOfDelivery.SignatureUrl),
                    HasPhoto = !string.IsNullOrEmpty(l.ProofOfDelivery.PhotoUrls),
                    Notes = l.ProofOfDelivery.Notes
                })
                .ToList();

            return Ok(new
            {
                Period = new { Start = start, End = end },
                TotalDelivered = totalDelivered,
                WithPod = withPod,
                MissingPod = missingPod,
                WithSignature = withSignature,
                WithPhotos = withPhotos,
                PodCompletionRate = totalDelivered > 0 ? Math.Round(withPod * 100.0 / totalDelivered, 2) : 0,
                Details = podDetails
            });
        }

        // GET: api/logistics/reports/fuel-consumption
        [HttpGet("fuel-consumption")]
        public async Task<IActionResult> GetFuelConsumption([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var start = startDate ?? DateTime.Now.AddMonths(-1);
            var end = endDate ?? DateTime.Now;

            // Get vehicles with TFN integration
            var vehicles = await _context.Vehicles
                .Where(v => !string.IsNullOrEmpty(v.TfnVehicleId))
                .ToListAsync();

            var loads = await _context.Loads
                .Where(l => l.ScheduledPickupDate >= start && 
                           l.ScheduledPickupDate <= end && 
                           l.Status == "Delivered")
                .Include(l => l.Vehicle)
                .ToListAsync();

            var fuelData = vehicles.Select(v =>
            {
                var vehicleLoads = loads.Where(l => l.VehicleId == v.Id).ToList();
                var totalDistance = vehicleLoads.Sum(l => l.EstimatedDistance ?? 0);
                
                // Estimate fuel consumption (average 25L per 100km for trucks)
                var estimatedFuel = totalDistance > 0 ? (totalDistance / 100) * 25 : 0;
                var estimatedCost = estimatedFuel * 22.50m; // R22.50 per liter average

                return new
                {
                    VehicleReg = v.RegistrationNumber,
                    Make = v.Make,
                    Model = v.Model,
                    TotalTrips = vehicleLoads.Count,
                    TotalDistance = Math.Round(totalDistance, 2),
                    EstimatedFuelLiters = Math.Round(estimatedFuel, 2),
                    EstimatedCost = Math.Round(estimatedCost, 2),
                    FuelEfficiency = totalDistance > 0 ? Math.Round(totalDistance / (estimatedFuel > 0 ? estimatedFuel : 1) * 100, 2) : 0
                };
            }).ToList();

            var totalFuel = fuelData.Sum(f => f.EstimatedFuelLiters);
            var totalCost = fuelData.Sum(f => f.EstimatedCost);
            var totalDistance = fuelData.Sum(f => f.TotalDistance);

            return Ok(new
            {
                Period = new { Start = start, End = end },
                TotalVehicles = vehicles.Count,
                TotalDistance = Math.Round(totalDistance, 2),
                TotalFuelLiters = Math.Round(totalFuel, 2),
                TotalCost = Math.Round(totalCost, 2),
                AverageFuelEfficiency = totalFuel > 0 ? Math.Round(totalDistance / totalFuel * 100, 2) : 0,
                VehicleBreakdown = fuelData
            });
        }

        // GET: api/logistics/reports/driver-performance
        [HttpGet("driver-performance")]
        public async Task<IActionResult> GetDriverPerformance([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var start = startDate ?? DateTime.Now.AddMonths(-1);
            var end = endDate ?? DateTime.Now;

            var drivers = await _context.Drivers
                .Where(d => d.Status == "Active")
                .ToListAsync();

            var loads = await _context.Loads
                .Where(l => l.ScheduledPickupDate >= start && l.ScheduledPickupDate <= end)
                .Include(l => l.Driver)
                .Include(l => l.ProofOfDelivery)
                .ToListAsync();

            var driverStats = drivers.Select(d =>
            {
                var driverLoads = loads.Where(l => l.DriverId == d.Id).ToList();
                var totalTrips = driverLoads.Count;
                var completedTrips = driverLoads.Count(l => l.Status == "Delivered");
                var onTimeTrips = driverLoads.Count(l => l.Status == "Delivered" && 
                    l.ProofOfDelivery != null && 
                    l.ProofOfDelivery.DeliveredAt <= l.ScheduledPickupDate?.AddHours(24));
                var totalDistance = driverLoads.Sum(l => l.EstimatedDistance ?? 0);

                return new
                {
                    DriverName = $"{d.FirstName} {d.LastName}",
                    EmployeeNumber = d.EmployeeNumber,
                    LicenseNumber = d.LicenseNumber,
                    LicenseExpiry = d.LicenseExpiryDate,
                    TotalTrips = totalTrips,
                    CompletedTrips = completedTrips,
                    OnTimeTrips = onTimeTrips,
                    LateTrips = completedTrips - onTimeTrips,
                    TotalDistance = Math.Round(totalDistance, 2),
                    OnTimeRate = completedTrips > 0 ? Math.Round((double)(onTimeTrips * 100.0 / completedTrips), 2) : 0,
                    CompletionRate = totalTrips > 0 ? Math.Round((double)(completedTrips * 100.0 / totalTrips), 2) : 0
                };
            })
            .OrderByDescending(d => d.OnTimeRate)
            .ToList();

            return Ok(new
            {
                Period = new { Start = start, End = end },
                TotalDrivers = drivers.Count,
                TotalTrips = loads.Count,
                AverageOnTimeRate = driverStats.Any() ? Math.Round(driverStats.Average(d => d.OnTimeRate), 2) : 0,
                DriverStats = driverStats
            });
        }

        // GET: api/logistics/reports/route-efficiency
        [HttpGet("route-efficiency")]
        public async Task<IActionResult> GetRouteEfficiency([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var start = startDate ?? DateTime.Now.AddMonths(-1);
            var end = endDate ?? DateTime.Now;

            var loads = await _context.Loads
                .Where(l => l.ScheduledPickupDate >= start && 
                           l.ScheduledPickupDate <= end && 
                           l.Status == "Delivered")
                .Include(l => l.Stops)
                .Include(l => l.Warehouse)
                .ToListAsync();

            var routeStats = loads.Select(l =>
            {
                var estimatedDistance = l.EstimatedDistance ?? 0;
                var estimatedTime = l.EstimatedTimeMinutes ?? 0;
                var stopCount = l.Stops?.Count ?? 0;
                
                // Calculate efficiency metrics
                var distancePerStop = stopCount > 0 ? estimatedDistance / stopCount : 0;
                var timePerStop = stopCount > 0 ? estimatedTime / stopCount : 0;

                return new
                {
                    LoadNumber = l.LoadNumber,
                    WarehouseName = l.Warehouse?.Name ?? "Unknown",
                    Origin = l.PickupLocation,
                    Destination = l.DeliveryLocation,
                    TotalStops = stopCount,
                    EstimatedDistance = Math.Round((double)estimatedDistance, 2),
                    EstimatedTimeHours = Math.Round(estimatedTime / 60.0, 2),
                    DistancePerStop = Math.Round((double)distancePerStop, 2),
                    TimePerStopMinutes = Math.Round((double)timePerStop, 2),
                    Status = l.Status
                };
            }).ToList();

            var totalDistance = routeStats.Sum(r => r.EstimatedDistance);
            var totalStops = routeStats.Sum(r => r.TotalStops);
            var avgDistancePerStop = totalStops > 0 ? totalDistance / totalStops : 0;

            return Ok(new
            {
                Period = new { Start = start, End = end },
                TotalRoutes = loads.Count,
                TotalDistance = Math.Round(totalDistance, 2),
                TotalStops = totalStops,
                AverageDistancePerStop = Math.Round(avgDistancePerStop, 2),
                AverageStopsPerRoute = loads.Count > 0 ? Math.Round((double)totalStops / loads.Count, 2) : 0,
                Routes = routeStats
            });
        }
    }
}
