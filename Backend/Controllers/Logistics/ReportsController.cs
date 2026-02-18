using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ClosedXML.Excel;

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
                    DeliveredAt = l.ProofOfDelivery!.DeliveredAt,
                    ReceiverName = l.ProofOfDelivery!.RecipientName,
                    HasSignature = !string.IsNullOrEmpty(l.ProofOfDelivery!.SignatureUrl),
                    HasPhoto = !string.IsNullOrEmpty(l.ProofOfDelivery!.PhotoUrls),
                    Notes = l.ProofOfDelivery!.Notes
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

        // GET: api/logistics/reports/daily-dispatch  
        [AllowAnonymous]
        [HttpGet("daily-dispatch")]
        public async Task<IActionResult> GetDailyDispatchReport([FromQuery] DateTime? reportDate)
        {
            try
            {
                var date = reportDate ?? DateTime.Now.Date;
                var monthStart = new DateTime(date.Year, date.Month, 1);

                var vehicles = await _context.Vehicles
                    .Include(v => v.VehicleType)
                    .Include(v => v.CurrentDriver)
                    .Where(v => !string.IsNullOrEmpty(v.Province))
                    .OrderBy(v => v.Province)
                    .ThenBy(v => v.RegistrationNumber)
                    .ToListAsync();

                // Look for loads by ScheduledPickupDate, ScheduledDeliveryDate, ActualDeliveryDate, or ActualPickupDate
                var todayLoads = await _context.Loads
                    .Include(l => l.Stops)
                    .Include(l => l.Customer)
                    .Include(l => l.Vehicle)
                    .Where(l => 
                        (l.ScheduledPickupDate.HasValue && l.ScheduledPickupDate.Value.Date == date.Date) ||
                        (l.ScheduledDeliveryDate.HasValue && l.ScheduledDeliveryDate.Value.Date == date.Date) ||
                        (l.ActualDeliveryDate.HasValue && l.ActualDeliveryDate.Value.Date == date.Date) ||
                        (l.ActualPickupDate.HasValue && l.ActualPickupDate.Value.Date == date.Date))
                    .ToListAsync();

                // Get today's load IDs for invoice lookup
                var todayLoadIds = todayLoads.Select(l => l.Id).ToList();

                // Get invoice values for today's loads from ImportedInvoices
                var todayInvoiceValues = await _context.ImportedInvoices
                    .Where(i => i.LoadId.HasValue && todayLoadIds.Contains(i.LoadId.Value))
                    .GroupBy(i => i.LoadId)
                    .Select(g => new { LoadId = g.Key, TotalValue = g.Sum(i => i.SalesAmount) })
                    .ToListAsync();

                // Get month-to-date loads with their vehicle IDs
                var monthLoadIds = await _context.Loads
                    .Where(l => l.Status == "Delivered" && 
                        ((l.ActualDeliveryDate.HasValue && 
                          l.ActualDeliveryDate.Value >= monthStart &&
                          l.ActualDeliveryDate.Value <= date) ||
                         (l.ScheduledDeliveryDate.HasValue && 
                          l.ScheduledDeliveryDate.Value >= monthStart &&
                          l.ScheduledDeliveryDate.Value <= date)))
                    .Select(l => new { l.Id, l.VehicleId })
                    .ToListAsync();

                var monthLoadIdList = monthLoadIds.Select(l => l.Id).ToList();

                // Get invoice values for month loads
                var monthInvoiceValues = await _context.ImportedInvoices
                    .Where(i => i.LoadId.HasValue && monthLoadIdList.Contains(i.LoadId.Value))
                    .GroupBy(i => i.LoadId)
                    .Select(g => new { LoadId = g.Key, TotalValue = g.Sum(i => i.SalesAmount) })
                    .ToListAsync();

                // Calculate monthly totals per vehicle
                var monthlyTotalsByVehicle = monthLoadIds
                    .GroupBy(l => l.VehicleId)
                    .ToDictionary(
                        g => g.Key ?? 0,
                        g => g.Sum(l => monthInvoiceValues.FirstOrDefault(m => m.LoadId == l.Id)?.TotalValue ?? 0)
                    );

                var maintenance = await _context.VehicleMaintenance
                    .Where(m => m.Status == "In Progress" || m.Status == "Pending")
                    .ToListAsync();

                var report = new List<DailyDispatchVehicleRow>();
                int rowNum = 1;

                foreach (var vehicle in vehicles)
                {
                    var load = todayLoads.FirstOrDefault(l => l.VehicleId == vehicle.Id);
                    var monthValue = monthlyTotalsByVehicle.GetValueOrDefault(vehicle.Id, 0);
                    var repair = maintenance.FirstOrDefault(m => m.VehicleId == vehicle.Id);

                    string comment = "";
                    decimal value = 0;
                    string route = "";
                    int stops = 0;

                    if (repair != null)
                    {
                        comment = repair.Description ?? "REPAIRS";
                    }
                    else if (load != null)
                    {
                        // Get value from ImportedInvoices instead of ChargeAmount
                        value = todayInvoiceValues.FirstOrDefault(v => v.LoadId == load.Id)?.TotalValue ?? 0;
                        stops = load.Stops.Count;
                        
                        var customerName = load.Customer?.Name ?? load.DeliveryLocation ?? "";
                        route = customerName;
                    }
                    else
                    {
                        comment = "NO LOAD";
                    }

                    report.Add(new DailyDispatchVehicleRow
                    {
                        Province = vehicle.Province ?? "",
                        No = rowNum++,
                        VehicleType = vehicle.VehicleType?.Name ?? "",
                        Registration = vehicle.RegistrationNumber ?? "",
                        Driver = vehicle.CurrentDriver?.FirstName ?? "",
                        DispatchDate = date.ToString("dd.MM.yyyy"),
                        Value = value,
                        Route = route,
                        Stops = stops,
                        Comment = comment,
                        MonthlyValue = monthValue,
                        HasLoad = load != null
                    });
                }

                var provinceDaily = report.GroupBy(r => r.Province)
                    .Select(g => new
                    {
                        Province = g.Key,
                        DailyTotal = g.Sum(r => r.Value)
                    })
                    .ToList();

                // Count only vehicles that actually have loads
                var dispatchedCount = report.Count(r => r.HasLoad);

                return Ok(new
                {
                    ReportDate = date,
                    MonthStart = monthStart,
                    Vehicles = report,
                    DailySummary = provinceDaily,
                    GrandTotal = report.Sum(r => r.Value),
                    MonthlyTotal = monthlyTotalsByVehicle.Values.Sum(),
                    DispatchedCount = dispatchedCount,
                    TotalVehicles = report.Count
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR in GetDailyDispatchReport: {ex.Message}");
                Console.WriteLine($"StackTrace: {ex.StackTrace}");
                return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        // Helper class for Daily Dispatch Report
        private class DailyDispatchVehicleRow
        {
            public string Province { get; set; } = "";
            public int No { get; set; }
            public string VehicleType { get; set; } = "";
            public string Registration { get; set; } = "";
            public string Driver { get; set; } = "";
            public string DispatchDate { get; set; } = "";
            public decimal Value { get; set; }
            public string Route { get; set; } = "";
            public int Stops { get; set; }
            public string Comment { get; set; } = "";
            public decimal MonthlyValue { get; set; }
            public bool HasLoad { get; set; }
        }

        // GET: api/logistics/reports/daily-dispatch/export
        [HttpGet("daily-dispatch/export")]
        public async Task<IActionResult> ExportDailyDispatchReport([FromQuery] DateTime? reportDate)
        {
            var date = reportDate ?? DateTime.Now.Date;
            var monthStart = new DateTime(date.Year, date.Month, 1);

            var vehicles = await _context.Vehicles
                .Include(v => v.VehicleType)
                .Include(v => v.CurrentDriver)
                .Where(v => !string.IsNullOrEmpty(v.Province))
                .OrderBy(v => v.Province)
                .ThenBy(v => v.RegistrationNumber)
                .ToListAsync();

            var todayLoads = await _context.Loads
                .Include(l => l.Stops)
                .Include(l => l.Customer)
                .Include(l => l.Vehicle)
                .Where(l => l.ScheduledPickupDate.HasValue && 
                           l.ScheduledPickupDate.Value.Date == date.Date)
                .ToListAsync();

            var monthLoads = await _context.Loads
                .Where(l => l.ScheduledPickupDate.HasValue && 
                           l.ScheduledPickupDate.Value >= monthStart &&
                           l.ScheduledPickupDate.Value <= date &&
                           l.Status == "Delivered")
                .GroupBy(l => l.VehicleId)
                .Select(g => new { VehicleId = g.Key, MonthlyValue = g.Sum(l => l.ChargeAmount ?? 0) })
                .ToListAsync();

            var maintenance = await _context.VehicleMaintenance
                .Where(m => m.Status == "In Progress" || m.Status == "Pending")
                .ToListAsync();

            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Daily Dispatch");

            // Headers
            var headers = new[]
            {
                "PROVINCE", "NO", "VEHICLE", "REGISTRATION", "DRIVER", "DISPATCH DATE",
                "VALUE", "ROUTE/COMMENT", "STOPS", "COMMENT", "DELIVERED", "OVERALL RETURNED",
                "RETURNED AMOUNT", "MONTHLY VALUE"
            };

            for (int i = 0; i < headers.Length; i++)
            {
                var cell = worksheet.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.LightGray;
            }

            int row = 2;
            int rowNum = 1;
            decimal dailyTotal = 0;

            foreach (var vehicle in vehicles)
            {
                var load = todayLoads.FirstOrDefault(l => l.VehicleId == vehicle.Id);
                var monthValue = monthLoads.FirstOrDefault(m => m.VehicleId == vehicle.Id)?.MonthlyValue ?? 0;
                var repair = maintenance.FirstOrDefault(m => m.VehicleId == vehicle.Id);

                string comment = "";
                decimal value = 0;
                string route = "";
                int stops = 0;

                if (repair != null)
                {
                    comment = repair.Description ?? "REPAIRS";
                }
                else if (load != null)
                {
                    value = load.ChargeAmount ?? 0;
                    stops = load.Stops.Count;
                    dailyTotal += value;
                    
                    var customerName = load.Customer?.Name ?? load.DeliveryLocation ?? "";
                    route = customerName;
                }
                else
                {
                    comment = "NO LOAD";
                }

                worksheet.Cell(row, 1).Value = vehicle.Province;
                worksheet.Cell(row, 2).Value = rowNum++;
                worksheet.Cell(row, 3).Value = vehicle.VehicleType?.Name ?? "";
                worksheet.Cell(row, 4).Value = vehicle.RegistrationNumber;
                worksheet.Cell(row, 5).Value = vehicle.CurrentDriver?.FirstName ?? "";
                worksheet.Cell(row, 6).Value = date.ToString("dd.MM.yyyy");
                worksheet.Cell(row, 7).Value = value;
                worksheet.Cell(row, 7).Style.NumberFormat.Format = "R #,##0.00";
                worksheet.Cell(row, 8).Value = route;
                worksheet.Cell(row, 9).Value = stops;
                worksheet.Cell(row, 10).Value = comment;
                worksheet.Cell(row, 14).Value = monthValue;
                worksheet.Cell(row, 14).Style.NumberFormat.Format = "R #,##0.00";

                row++;
            }

            // Add summary section
            row += 2;
            worksheet.Cell(row, 1).Value = "MONTHLY VALUE";
            worksheet.Cell(row, 1).Style.Font.Bold = true;
            row++;
            worksheet.Cell(row, 1).Value = $"{monthStart:dd-MM} - {date:dd-MM} {date:MMM}";
            worksheet.Cell(row, 2).Value = monthLoads.Sum(m => m.MonthlyValue);
            worksheet.Cell(row, 2).Style.NumberFormat.Format = "R #,##0.00";
            worksheet.Cell(row, 2).Style.Font.Bold = true;

            row += 2;
            worksheet.Cell(row, 1).Value = $"DAILY {date:dd.MM.yyyy}";
            worksheet.Cell(row, 1).Style.Font.Bold = true;
            row++;

            var provinceTotals = vehicles.GroupBy(v => v.Province).Select(g => new
            {
                Province = g.Key,
                Total = todayLoads.Where(l => g.Any(v => v.Id == l.VehicleId))
                    .Sum(l => l.ChargeAmount ?? 0)
            }).ToList();

            foreach (var pt in provinceTotals)
            {
                worksheet.Cell(row, 1).Value = pt.Province;
                worksheet.Cell(row, 2).Value = pt.Total;
                worksheet.Cell(row, 2).Style.NumberFormat.Format = "R #,##0.00";
                row++;
            }

            worksheet.Cell(row, 1).Value = "TOTAL";
            worksheet.Cell(row, 1).Style.Font.Bold = true;
            worksheet.Cell(row, 2).Value = dailyTotal;
            worksheet.Cell(row, 2).Style.NumberFormat.Format = "R #,##0.00";
            worksheet.Cell(row, 2).Style.Font.Bold = true;

            worksheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            stream.Position = 0;

            return File(stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"DailyDispatch_{date:yyyyMMdd}.xlsx");
        }
    }
}
