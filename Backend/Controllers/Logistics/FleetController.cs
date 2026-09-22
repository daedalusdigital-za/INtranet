using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services;
using ClosedXML.Excel;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FleetController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ICarTrackService _carTrackService;
        private readonly ProjectTracker.API.Services.Logistics.IMovementHistoryPersistenceService _movementHistory;
        private readonly ProjectTracker.API.Services.Logistics.IFuelAnalysisService _fuelAnalysis;
        private readonly ProjectTracker.API.Services.Logistics.MovementBackfillStatus _backfillStatus;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<FleetController> _logger;

        public FleetController(
            ApplicationDbContext context, 
            ICarTrackService carTrackService,
            ProjectTracker.API.Services.Logistics.IMovementHistoryPersistenceService movementHistory,
            ProjectTracker.API.Services.Logistics.IFuelAnalysisService fuelAnalysis,
            ProjectTracker.API.Services.Logistics.MovementBackfillStatus backfillStatus,
            IServiceScopeFactory scopeFactory,
            ILogger<FleetController> logger)
        {
            _context = context;
            _carTrackService = carTrackService;
            _movementHistory = movementHistory;
            _fuelAnalysis = fuelAnalysis;
            _backfillStatus = backfillStatus;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        // Vehicle Endpoints
        [HttpGet("vehicles")]
        public async Task<ActionResult<IEnumerable<VehicleDto>>> GetVehicles()
        {
            var vehicles = await _context.Vehicles
                .Include(v => v.VehicleType)
                .Include(v => v.CurrentDriver)
                .Select(v => new VehicleDto
                {
                    Id = v.Id,
                    RegistrationNumber = v.RegistrationNumber,
                    VinNumber = v.VinNumber,
                    Make = v.Make,
                    Model = v.Model,
                    Year = v.Year,
                    Color = v.Color,
                    VehicleTypeId = v.VehicleTypeId,
                    VehicleTypeName = v.VehicleType.Name,
                    CurrentDriverId = v.CurrentDriverId,
                    CurrentDriverName = v.CurrentDriver != null ? $"{v.CurrentDriver.FirstName} {v.CurrentDriver.LastName}" : null,
                    Province = v.Province,
                    CarTrackId = v.CarTrackId,
                    CarTrackName = v.CarTrackName,
                    // TFN Integration fields
                    TfnVehicleId = v.TfnVehicleId,
                    TfnSubAccountNumber = v.TfnSubAccountNumber,
                    TfnVirtualCardNumber = v.TfnVirtualCardNumber,
                    TfnCreditLimit = v.TfnCreditLimit,
                    TfnCurrentBalance = v.TfnCurrentBalance,
                    TfnLastSyncedAt = v.TfnLastSyncedAt,
                    TankSize = v.TankSize ?? v.FuelCapacity,
                    FuelType = v.FuelType,
                    AverageFuelConsumption = v.AverageFuelConsumption,
                    // Last known location from database
                    Latitude = (double?)v.LastKnownLatitude,
                    Longitude = (double?)v.LastKnownLongitude,
                    LastLocation = v.LastKnownAddress ?? (v.CarTrackId != null || v.TfnVehicleId != null ? "Location pending..." : "Not tracked"),
                    LastUpdate = v.LastLocationUpdate,
                    LiveStatus = v.LastKnownStatus ?? "offline",
                    Status = v.Status,
                    FuelCapacity = v.FuelCapacity,
                    CurrentOdometer = v.CurrentOdometer,
                    LastServiceDate = v.LastServiceDate,
                    NextServiceOdometer = v.NextServiceOdometer,
                    CreatedAt = v.CreatedAt
                })
                // Sort: linked to both first, then linked to either, then unlinked
                .OrderByDescending(v => v.TfnVehicleId != null && v.CarTrackId != null)
                .ThenByDescending(v => v.TfnVehicleId != null || v.CarTrackId != null)
                .ThenBy(v => v.RegistrationNumber)
                .ToListAsync();

            return Ok(vehicles);
        }

        // Get vehicles with live CarTrack tracking data merged with TFN data
        [HttpGet("vehicles/live")]
        public async Task<ActionResult<IEnumerable<VehicleDto>>> GetVehiclesLive()
        {
            try
            {
                // Get all vehicles from database
                var vehicles = await _context.Vehicles
                    .Include(v => v.VehicleType)
                    .Include(v => v.CurrentDriver)
                    .ToListAsync();

                // Get live locations from CarTrack
                var liveLocations = await _carTrackService.GetAllVehicleLocationsAsync();
                var locationLookup = liveLocations.ToDictionary(
                    l => l.RegistrationNumber?.ToUpperInvariant().Replace(" ", "").Replace("-", "") ?? "",
                    l => l,
                    StringComparer.OrdinalIgnoreCase
                );

                // Also create lookup by CarTrackId
                var locationByIdLookup = liveLocations.ToDictionary(
                    l => l.VehicleId ?? "",
                    l => l,
                    StringComparer.OrdinalIgnoreCase
                );

                var vehiclesToUpdate = new List<Vehicle>();
                
                var result = vehicles.Select(v => {
                    // Try to find live data by CarTrackId first, then by registration
                    VehicleLocationDto? liveData = null;
                    if (!string.IsNullOrEmpty(v.CarTrackId) && locationByIdLookup.TryGetValue(v.CarTrackId, out var byId))
                    {
                        liveData = byId;
                    }
                    else
                    {
                        var regNormalized = v.RegistrationNumber?.ToUpperInvariant().Replace(" ", "").Replace("-", "") ?? "";
                        if (locationLookup.TryGetValue(regNormalized, out var byReg))
                        {
                            liveData = byReg;
                        }
                    }

                    // Determine location - use live data if available, otherwise use saved last known location
                    double? latitude = liveData?.Location?.Latitude ?? (double?)v.LastKnownLatitude;
                    double? longitude = liveData?.Location?.Longitude ?? (double?)v.LastKnownLongitude;
                    string lastLocation = liveData?.Location?.Address 
                        ?? v.LastKnownAddress 
                        ?? (v.CarTrackId != null || v.TfnVehicleId != null ? "Location pending..." : "Not tracked");
                    string liveStatus = liveData?.Status ?? v.LastKnownStatus ?? "offline";
                    DateTime? lastUpdate = liveData?.LastUpdate ?? v.LastLocationUpdate;

                    // Update saved location if we have live data with valid coordinates
                    if (liveData?.Location?.Latitude != null && liveData?.Location?.Longitude != null)
                    {
                        bool needsUpdate = v.LastKnownLatitude != (decimal?)liveData.Location.Latitude ||
                                          v.LastKnownLongitude != (decimal?)liveData.Location.Longitude ||
                                          v.LastKnownAddress != liveData.Location.Address ||
                                          v.LastKnownStatus != liveData.Status;
                        
                        if (needsUpdate)
                        {
                            v.LastKnownLatitude = (decimal?)liveData.Location.Latitude;
                            v.LastKnownLongitude = (decimal?)liveData.Location.Longitude;
                            v.LastKnownAddress = liveData.Location.Address;
                            v.LastKnownStatus = liveData.Status;
                            v.LastLocationUpdate = liveData.LastUpdate ?? DateTime.UtcNow;
                            vehiclesToUpdate.Add(v);
                        }
                    }

                    return new VehicleDto
                    {
                        Id = v.Id,
                        RegistrationNumber = v.RegistrationNumber!,
                        VinNumber = v.VinNumber,
                        Make = v.Make!,
                        Model = v.Model!,
                        Year = v.Year,
                        Color = v.Color,
                        VehicleTypeId = v.VehicleTypeId,
                        VehicleTypeName = v.VehicleType?.Name ?? "Unknown",
                        CurrentDriverId = v.CurrentDriverId,
                        CurrentDriverName = liveData?.CurrentDriverName ?? (v.CurrentDriver != null ? $"{v.CurrentDriver.FirstName} {v.CurrentDriver.LastName}" : null),
                        Province = v.Province,
                        CarTrackId = v.CarTrackId,
                        CarTrackName = v.CarTrackName,
                        // TFN Integration fields
                        TfnVehicleId = v.TfnVehicleId,
                        TfnSubAccountNumber = v.TfnSubAccountNumber,
                        TfnVirtualCardNumber = v.TfnVirtualCardNumber,
                        TfnCreditLimit = v.TfnCreditLimit,
                        TfnCurrentBalance = v.TfnCurrentBalance,
                        TfnLastSyncedAt = v.TfnLastSyncedAt,
                        TankSize = v.TankSize ?? v.FuelCapacity,
                        FuelType = v.FuelType,
                        AverageFuelConsumption = v.AverageFuelConsumption,
                        // Live tracking data - use live if available, fallback to saved
                        Latitude = latitude,
                        Longitude = longitude,
                        LastLocation = lastLocation,
                        Speed = liveData?.Speed ?? 0,
                        Heading = liveData?.Heading,
                        LastUpdate = lastUpdate,
                        LiveStatus = liveStatus,
                        Status = v.Status,
                        FuelCapacity = v.FuelCapacity,
                        CurrentOdometer = v.CurrentOdometer,
                        LastServiceDate = v.LastServiceDate,
                        NextServiceOdometer = v.NextServiceOdometer,
                        CreatedAt = v.CreatedAt
                    };
                })
                // Sort: linked to both first, then linked to either, then unlinked
                .OrderByDescending(v => v.TfnVehicleId != null && v.CarTrackId != null)
                .ThenByDescending(v => v.TfnVehicleId != null || v.CarTrackId != null)
                .ThenBy(v => v.RegistrationNumber)
                .ToList();

                // Save updated locations to database (async, don't wait)
                if (vehiclesToUpdate.Any())
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _context.SaveChangesAsync();
                            _logger.LogInformation($"Saved {vehiclesToUpdate.Count} vehicle locations to database");
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error saving vehicle locations");
                        }
                    });
                }

                _logger.LogInformation($"Returning {result.Count} vehicles with live data. {result.Count(v => v.Speed > 0)} moving.");
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching live vehicle data");
                // Fall back to database-only data
                return await GetVehicles();
            }
        }

        // Sync CarTrack vehicles - link by registration number
        [HttpPost("sync/cartrack")]
        public async Task<ActionResult> SyncCarTrackVehicles()
        {
            try
            {
                _logger.LogInformation("Starting CarTrack vehicle sync");
                
                // Get all vehicles from CarTrack
                var carTrackVehicles = await _carTrackService.GetRawVehicleDataAsync();
                
                if (carTrackVehicles.Count == 0)
                {
                    return Ok(new { message = "No vehicles found in CarTrack", linked = 0 });
                }
                
                // Get all local vehicles
                var localVehicles = await _context.Vehicles.ToListAsync();
                
                int linked = 0;
                int updated = 0;
                
                // Build lookup of unlinked local vehicles for suffix matching
                var unlinkedLocals = localVehicles
                    .Where(v => string.IsNullOrEmpty(v.CarTrackId) && !string.IsNullOrEmpty(v.RegistrationNumber))
                    .ToList();
                
                // Known CarTrack device suffixes (LV=Livestream, FMP=FMPro tracker, BU=Backup, SC=SecondCam, MV=MultiView, TAG=Tag)
                var deviceSuffixes = new[] { "LV", "FMP", "BU", "SC", "MV", "TAG", "LVHA4", "NEW" };
                
                foreach (var ctVehicle in carTrackVehicles)
                {
                    if (string.IsNullOrEmpty(ctVehicle.Registration))
                        continue;
                    
                    // Normalize registration for matching
                    var regNormalized = ctVehicle.Registration.ToUpperInvariant().Replace(" ", "").Replace("-", "");
                    
                    // Skip entries with device suffixes - prefer the base registration entry
                    bool hasSuffix = deviceSuffixes.Any(s => regNormalized.EndsWith(s, StringComparison.OrdinalIgnoreCase));
                    
                    // Find matching local vehicle by exact registration first
                    var localVehicle = localVehicles.FirstOrDefault(v => 
                        v.RegistrationNumber?.ToUpperInvariant().Replace(" ", "").Replace("-", "") == regNormalized);
                    
                    // If no exact match and this entry has a suffix, try matching the base registration
                    if (localVehicle == null && hasSuffix)
                    {
                        // Strip known suffixes to get base registration
                        var baseReg = regNormalized;
                        foreach (var suffix in deviceSuffixes.OrderByDescending(s => s.Length))
                        {
                            if (baseReg.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                            {
                                baseReg = baseReg[..^suffix.Length];
                                break;
                            }
                        }
                        localVehicle = unlinkedLocals.FirstOrDefault(v => 
                            v.RegistrationNumber?.ToUpperInvariant().Replace(" ", "").Replace("-", "") == baseReg);
                    }
                    
                    // If still no match, check if CarTrack reg starts with any unlinked local reg (catches unknown suffixes)
                    if (localVehicle == null && !hasSuffix)
                    {
                        localVehicle = unlinkedLocals.FirstOrDefault(v => {
                            var localReg = v.RegistrationNumber?.ToUpperInvariant().Replace(" ", "").Replace("-", "") ?? "";
                            return localReg.Length >= 6 && regNormalized.StartsWith(localReg) && regNormalized.Length > localReg.Length;
                        });
                    }
                    
                    if (localVehicle != null)
                    {
                        if (string.IsNullOrEmpty(localVehicle.CarTrackId))
                        {
                            localVehicle.CarTrackId = ctVehicle.VehicleId;
                            localVehicle.CarTrackName = ctVehicle.Registration;
                            linked++;
                            unlinkedLocals.Remove(localVehicle); // Remove from unlinked pool
                            _logger.LogInformation($"Linked vehicle {localVehicle.RegistrationNumber} to CarTrack ID {ctVehicle.VehicleId} (CarTrack reg: {ctVehicle.Registration})");
                        }
                        else if (localVehicle.CarTrackId != ctVehicle.VehicleId && !hasSuffix)
                        {
                            // Only update with base registration entries (not suffix duplicates)
                            localVehicle.CarTrackId = ctVehicle.VehicleId;
                            localVehicle.CarTrackName = ctVehicle.Registration;
                            updated++;
                        }
                    }
                }
                
                if (linked > 0 || updated > 0)
                {
                    await _context.SaveChangesAsync();
                }
                
                _logger.LogInformation($"CarTrack sync completed: {linked} newly linked, {updated} updated out of {carTrackVehicles.Count} CarTrack vehicles");
                
                return Ok(new { 
                    message = $"CarTrack sync completed",
                    carTrackVehicles = carTrackVehicles.Count,
                    linked,
                    updated,
                    totalLocalVehicles = localVehicles.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing CarTrack vehicles");
                return StatusCode(500, new { error = "Failed to sync CarTrack vehicles", message = ex.Message });
            }
        }

        // Vision API - Get livestream URLs for a vehicle
        [HttpPost("vision/livestream/{registration}")]
        public async Task<ActionResult<LivestreamResponseDto>> GetVehicleLivestream(string registration, [FromBody] LivestreamRequestDto request)
        {
            try
            {
                _logger.LogInformation("Requesting livestream for vehicle {Registration}", registration);

                var cameras = request.Cameras ?? new int[] { 1, 2 }; // Default to front and rear cameras
                var result = await _carTrackService.GetVehicleLivestreamAsync(registration, cameras);

                if (result == null)
                {
                    return NotFound(new { error = "Unable to get livestream", message = "Vehicle may not have Vision enabled or service unavailable" });
                }

                // Check if there was an error from CarTrack
                if (!string.IsNullOrEmpty(result.ErrorCode))
                {
                    if (result.ErrorCode == "VISION_NOT_ENABLED")
                    {
                        return StatusCode(403, new { 
                            error = "Vision API not enabled", 
                            message = result.Error ?? "Your CarTrack account does not have Vision API enabled. Please contact your CarTrack sales representative to enable this feature.",
                            code = result.ErrorCode
                        });
                    }
                    return BadRequest(new { error = result.ErrorCode, message = result.Error });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting livestream for vehicle {Registration}", registration);
                return StatusCode(500, new { error = "Failed to get livestream", message = ex.Message });
            }
        }

        // Vision API - Get all Vision-enabled vehicles
        [HttpGet("vision/vehicles")]
        public async Task<ActionResult<List<VisionVehicleDto>>> GetVisionEnabledVehicles()
        {
            try
            {
                var vehicles = await _carTrackService.GetVisionEnabledVehiclesAsync();
                return Ok(vehicles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Vision-enabled vehicles");
                return StatusCode(500, new { error = "Failed to get Vision vehicles", message = ex.Message });
            }
        }

        // POST: api/Fleet/movement-history/backfill?from=2026-01-01&to=2026-08-18
        // Kicks off a historical backfill in the background. Poll the status endpoint.
        [HttpPost("movement-history/backfill")]
        public IActionResult StartMovementBackfill([FromQuery] string? from, [FromQuery] string? to)
        {
            var start = DateTime.TryParse(from, out var f) ? f.Date : new DateTime(DateTime.UtcNow.Year, 1, 1);
            var end = DateTime.TryParse(to, out var t) ? t.Date : DateTime.UtcNow.Date;
            if (end > DateTime.UtcNow.Date) end = DateTime.UtcNow.Date;

            if (!_backfillStatus.TryStart(start, end))
                return Conflict(new { error = "A backfill is already running.", status = _backfillStatus.Snapshot() });

            // Fire-and-forget on its own DI scope so the request can return immediately.
            _ = Task.Run(async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<ProjectTracker.API.Services.Logistics.IMovementHistoryPersistenceService>();
                try
                {
                    await svc.BackfillRangeAsync(start, end, _backfillStatus);
                    _backfillStatus.Finish();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Movement backfill failed");
                    _backfillStatus.Finish(ex.Message);
                }
            });

            return Accepted(new { message = "Backfill started", status = _backfillStatus.Snapshot() });
        }

        // GET: api/Fleet/movement-history/backfill/status
        [HttpGet("movement-history/backfill/status")]
        public IActionResult GetMovementBackfillStatus() => Ok(_backfillStatus.Snapshot());

        // GET: api/Fleet/fuel-analysis?days=30
        // Fleet-wide fuel-theft / vehicle-anomaly scan.
        [HttpGet("fuel-analysis")]
        public async Task<IActionResult> GetFleetFuelAnalysis([FromQuery] int days = 30)
        {
            try
            {
                var results = await _fuelAnalysis.AnalyzeFleetAsync(days, HttpContext.RequestAborted);
                return Ok(new
                {
                    days,
                    generatedAtUtc = DateTime.UtcNow,
                    highRisk = results.Count(r => r.RiskLevel == "high"),
                    watch = results.Count(r => r.RiskLevel == "watch"),
                    vehicles = results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running fleet fuel analysis");
                return StatusCode(500, new { error = "Failed to run fuel analysis", message = ex.Message });
            }
        }

        // GET: api/Fleet/vehicles/{registration}/fuel-analysis?days=30
        [HttpGet("vehicles/{registration}/fuel-analysis")]
        public async Task<IActionResult> GetVehicleFuelAnalysis(string registration, [FromQuery] int days = 30)
        {
            try
            {
                var norm = (registration ?? "").Replace("-", "").Replace(" ", "").ToUpperInvariant();
                var vehicle = await _context.Vehicles
                    .Select(v => new { v.Id, v.RegistrationNumber })
                    .ToListAsync();
                var match = vehicle.FirstOrDefault(v =>
                    (v.RegistrationNumber ?? "").Replace("-", "").Replace(" ", "").ToUpperInvariant() == norm);
                if (match == null)
                    return NotFound(new { error = "Vehicle not found", registration });

                var result = await _fuelAnalysis.AnalyzeVehicleAsync(match.Id, days, HttpContext.RequestAborted);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running fuel analysis for {Reg}", registration);
                return StatusCode(500, new { error = "Failed to run fuel analysis", message = ex.Message });
            }
        }

        // GET: api/Fleet/fuel-analysis/export?days=30
        // Export flagged fuel vehicles (high/watch risk) to Excel
        [HttpGet("fuel-analysis/export")]
        public async Task<IActionResult> ExportFuelAnalysisToExcel([FromQuery] int days = 30)
        {
            try
            {
                using var wb = new XLWorkbook();
                var ws = wb.Worksheets.Add("Flagged Fuel Health");

                // Title
                ws.Cell(1, 1).Value = "ROCKET FREIGHT - FLAGGED FUEL HEALTH REPORT";
                ws.Range(1, 1, 1, 7).Merge().Style
                    .Font.SetBold().Font.SetFontSize(14)
                    .Fill.SetBackgroundColor(XLColor.FromHtml("#ef4444"))
                    .Font.SetFontColor(XLColor.White)
                    .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);

                ws.Cell(2, 1).Value = $"Generated: {DateTime.Now:dd MMM yyyy HH:mm} | Analysis period: {days} days";
                ws.Range(2, 1, 2, 7).Merge().Style.Font.SetItalic().Font.SetFontSize(11);

                // Headers
                int headerRow = 4;
                var headers = new[] { "Registration", "Make/Model", "Risk Level", "Risk Score", "Total Fills", "Total Litres", "Key Findings" };
                for (int c = 0; c < headers.Length; c++)
                {
                    var cell = ws.Cell(headerRow, c + 1);
                    cell.Value = headers[c];
                    cell.Style.Font.SetBold()
                        .Fill.SetBackgroundColor(XLColor.FromHtml("#1e293b"))
                        .Font.SetFontColor(XLColor.White)
                        .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                }

                // Get flagged vehicles
                var results = await _fuelAnalysis.AnalyzeFleetAsync(days, HttpContext.RequestAborted);
                var flagged = results.Where(r => r.RiskLevel == "high" || r.RiskLevel == "watch").ToList();

                int row = headerRow + 1;
                foreach (var vehicle in flagged)
                {
                    ws.Cell(row, 1).Value = vehicle.Registration ?? "—";
                    ws.Cell(row, 2).Value = $"{vehicle.Make ?? "N/A"} {vehicle.Model ?? ""}".Trim();
                    ws.Cell(row, 3).Value = vehicle.RiskLevel ?? "Unknown";
                    ws.Cell(row, 4).Value = vehicle.RiskScore;
                    ws.Cell(row, 5).Value = vehicle.FillCount;
                    ws.Cell(row, 6).Value = vehicle.TotalLitres;
                    ws.Cell(row, 7).Value = string.Join("; ", vehicle.Findings.Take(3).Select(f => f.Message));

                    // Risk color
                    if (vehicle.RiskLevel == "high")
                        ws.Cell(row, 3).Style.Fill.SetBackgroundColor(XLColor.FromHtml("#fee2e2")).Font.SetBold();
                    else if (vehicle.RiskLevel == "watch")
                        ws.Cell(row, 3).Style.Fill.SetBackgroundColor(XLColor.FromHtml("#fef3c7")).Font.SetBold();

                    // Format numbers
                    ws.Cell(row, 4).Style.NumberFormat.Format = "0";
                    ws.Cell(row, 6).Style.NumberFormat.Format = "#,##0.00";

                    row++;
                }

                // Auto-fit columns
                for (int c = 1; c <= 7; c++)
                    ws.Column(c).AdjustToContents();

                using var ms = new MemoryStream();
                wb.SaveAs(ms);
                ms.Position = 0;

                return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"FlaggedFuelHealth_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting fuel analysis");
                return StatusCode(500, new { error = "Failed to export fuel analysis", message = ex.Message });
            }
        }

        // GET: api/Fleet/vehicles/{registration}/trip-history?date=2026-04-07&refresh=false
        [HttpGet("vehicles/{registration}/trip-history")]
        public async Task<ActionResult<List<CarTrackTripData>>> GetVehicleTripHistory(string registration, [FromQuery] string? date, [FromQuery] bool refresh = false)
        {
            try
            {
                var targetDate = DateTime.Today;
                if (!string.IsNullOrEmpty(date) && DateTime.TryParse(date, out var parsed))
                {
                    targetDate = parsed;
                }

                _logger.LogInformation("Fetching trip history for {Registration} on {Date} (refresh={Refresh})", registration, targetDate.ToString("yyyy-MM-dd"), refresh);

                var isToday = targetDate.Date == DateTime.UtcNow.Date;
                var dataSource = "database";
                List<CarTrackTripData> trips;

                // Resolve vehicle id once for persistence linkage
                var vehicleId = await _context.Vehicles
                    .Where(v => v.RegistrationNumber == registration)
                    .Select(v => (int?)v.Id)
                    .FirstOrDefaultAsync();

                // 1) Serve from OUR database first — instant, no CarTrack dependency.
                var saved = await _context.VehicleMovementHistory
                    .Where(m => m.RegistrationNumber == registration && m.MovementDate == targetDate.Date)
                    .OrderBy(m => m.StartTimestamp)
                    .ToListAsync();

                // 2) Only hit CarTrack when we have nothing saved, or the caller explicitly
                //    asked to refresh today's live data. This keeps the dialog fast and
                //    resilient when CarTrack is slow/unavailable.
                var needLive = saved.Count == 0 || (isToday && refresh);

                if (needLive)
                {
                    try
                    {
                        var live = await _carTrackService.GetVehicleTripsAsync(registration, targetDate);
                        if (live.Count > 0)
                        {
                            try { await _movementHistory.PersistVehicleDayAsync(vehicleId, registration, targetDate.Date, live); }
                            catch (Exception pex) { _logger.LogWarning(pex, "Failed to persist movement history for {Reg} on {Date}", registration, targetDate.ToString("yyyy-MM-dd")); }

                            dataSource = saved.Count == 0 ? "cartrack-live" : "cartrack-refresh";
                            trips = live;
                        }
                        else
                        {
                            trips = saved.Select(MapToTripData).ToList();
                        }
                    }
                    catch (Exception cex)
                    {
                        // CarTrack failed — fall back to whatever we have saved.
                        _logger.LogWarning(cex, "CarTrack live fetch failed for {Reg}; serving saved data", registration);
                        trips = saved.Select(MapToTripData).ToList();
                    }
                }
                else
                {
                    trips = saved.Select(MapToTripData).ToList();
                }

                // Calculate summary
                var totalDistance = trips.Sum(t => t.TripDistance);
                var totalDuration = trips.Sum(t => t.TripDurationSeconds);
                var maxSpeed = trips.Any() ? trips.Max(t => t.MaxSpeed) : 0;
                var totalHarshBraking = trips.Sum(t => t.HarshBrakingEvents);
                var totalHarshCornering = trips.Sum(t => t.HarshCorneringEvents);
                var totalHarshAcceleration = trips.Sum(t => t.HarshAccelerationEvents);
                var totalIdleTime = trips.Sum(t => t.IdleTimeSeconds);

                // Include any TFN fuel fills for this vehicle on the same day so the
                // movement timeline shows refuelling events alongside trips.
                var dayStart = targetDate.Date;
                var dayEnd = dayStart.AddDays(1);
                var normalizedReg = registration.Replace("-", "").Replace(" ", "").ToUpper();

                var dayFuel = await _context.FuelTransactions
                    .Where(f => f.TransactionDate >= dayStart.AddDays(-1) && f.TransactionDate < dayEnd.AddDays(1))
                    .Select(f => new
                    {
                        f.RegistrationNumber,
                        f.TransactionDate,
                        f.LitresUsed,
                        f.AmountSpent,
                        f.DepotName,
                        f.DepotAssignment,
                        f.CardNumber,
                        f.Notes
                    })
                    .ToListAsync();

                var fuelEvents = dayFuel
                    .Where(f => (f.RegistrationNumber ?? "").Replace("-", "").Replace(" ", "").ToUpper() == normalizedReg
                                && f.TransactionDate.Date == targetDate.Date)
                    .OrderBy(f => f.TransactionDate)
                    .Select(f => new
                    {
                        timestamp = f.TransactionDate,
                        litres = f.LitresUsed,
                        amount = f.AmountSpent,
                        depotName = f.DepotName,
                        depotAssignment = f.DepotAssignment,
                        cardNumber = f.CardNumber,
                        notes = f.Notes
                    })
                    .ToList();

                // Live status (today only): CarTrack's trip endpoint only returns COMPLETED
                // trips, so a vehicle currently on a trip shows nothing here. Pull its live
                // position/speed/ignition (same source as Fleet Live) so the UI can show an
                // "in progress" indicator and drop a live marker even before the trip closes.
                object? liveStatus = null;
                if (isToday)
                {
                    try
                    {
                        var allLive = await _carTrackService.GetAllVehicleLocationsAsync();
                        var lv = allLive.FirstOrDefault(v =>
                            (v.RegistrationNumber ?? "").Replace("-", "").Replace(" ", "").ToUpper() == normalizedReg);
                        if (lv != null)
                        {
                            var moving = lv.Speed > 0 ||
                                string.Equals(lv.Status, "moving", StringComparison.OrdinalIgnoreCase);
                            liveStatus = new
                            {
                                isMoving = moving,
                                speed = Math.Round(lv.Speed, 1),
                                heading = lv.Heading,
                                status = lv.Status,
                                latitude = lv.Location?.Latitude ?? 0,
                                longitude = lv.Location?.Longitude ?? 0,
                                address = lv.Location?.Address,
                                driverName = lv.CurrentDriverName,
                                lastUpdate = lv.LastUpdate,
                                // True when the vehicle is active now but no completed trip
                                // has landed in our data yet — the "moving but no history" case.
                                inProgressNoTrips = moving && trips.Count == 0
                            };
                        }
                    }
                    catch (Exception lex)
                    {
                        _logger.LogWarning(lex, "Live status fetch failed for {Reg}", registration);
                    }
                }

                return Ok(new
                {
                    registration,
                    date = targetDate.ToString("yyyy-MM-dd"),
                    source = dataSource,
                    tripCount = trips.Count,
                    totalDistanceKm = Math.Round(totalDistance / 1000.0, 2),
                    totalDurationMinutes = Math.Round(totalDuration / 60.0, 1),
                    maxSpeed = Math.Round(maxSpeed, 1),
                    totalHarshBraking,
                    totalHarshCornering,
                    totalHarshAcceleration,
                    totalIdleMinutes = Math.Round(totalIdleTime / 60.0, 1),
                    fuelEventCount = fuelEvents.Count,
                    totalFuelLitres = Math.Round(fuelEvents.Sum(f => (double)f.litres), 2),
                    totalFuelAmount = Math.Round(fuelEvents.Sum(f => (double)f.amount), 2),
                    fuelEvents,
                    liveStatus,
                    trips
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trip history for {Registration}", registration);
                return StatusCode(500, new { error = "Failed to fetch trip history", message = ex.Message });
            }
        }

        // GET: api/Fleet/vehicles/{registration}/km-summary?from=2026-08-01&to=2026-08-26
        // Daily distance breakdown for a date range (defaults to current month-to-date),
        // plus totals and a worked-out daily average. Served from our persisted movement
        // history (fast, no CarTrack dependency).
        [HttpGet("vehicles/{registration}/km-summary")]
        public async Task<ActionResult> GetVehicleKmSummary(string registration, [FromQuery] string? from, [FromQuery] string? to)
        {
            try
            {
                var today = DateTime.Today;
                var start = new DateTime(today.Year, today.Month, 1);
                var end = today;

                if (!string.IsNullOrEmpty(from) && DateTime.TryParse(from, out var pf)) start = pf.Date;
                if (!string.IsNullOrEmpty(to) && DateTime.TryParse(to, out var pt)) end = pt.Date;
                if (end < start) (start, end) = (end, start);

                var rows = await _context.VehicleMovementHistory
                    .Where(m => m.RegistrationNumber == registration
                                && m.MovementDate >= start && m.MovementDate <= end)
                    .GroupBy(m => m.MovementDate)
                    .Select(g => new
                    {
                        date = g.Key,
                        distanceMeters = g.Sum(x => x.TripDistance),
                        trips = g.Count(),
                        maxSpeed = g.Max(x => x.MaxSpeed)
                    })
                    .ToListAsync();

                var byDate = rows.ToDictionary(r => r.date.Date);

                // Emit every calendar day in the range so the export shows all days,
                // including zero-movement days.
                var days = new List<object>();
                double totalKm = 0;
                int daysWithMovement = 0;
                for (var d = start; d <= end; d = d.AddDays(1))
                {
                    double km = 0; int trips = 0; double maxSpd = 0;
                    if (byDate.TryGetValue(d.Date, out var r))
                    {
                        km = Math.Round(r.distanceMeters / 1000.0, 1);
                        trips = r.trips;
                        maxSpd = Math.Round(r.maxSpeed, 1);
                        if (km > 0) daysWithMovement++;
                    }
                    totalKm += km;
                    days.Add(new
                    {
                        date = d.ToString("yyyy-MM-dd"),
                        dayOfWeek = d.ToString("ddd"),
                        km,
                        trips,
                        maxSpeed = maxSpd
                    });
                }

                var calendarDays = (end - start).Days + 1;
                totalKm = Math.Round(totalKm, 1);

                return Ok(new
                {
                    registration,
                    from = start.ToString("yyyy-MM-dd"),
                    to = end.ToString("yyyy-MM-dd"),
                    totalKm,
                    calendarDays,
                    daysWithMovement,
                    // Average across every calendar day in the range (month-so-far basis).
                    avgKmPerCalendarDay = calendarDays > 0 ? Math.Round(totalKm / calendarDays, 1) : 0,
                    // Average across only the days the vehicle actually moved.
                    avgKmPerActiveDay = daysWithMovement > 0 ? Math.Round(totalKm / daysWithMovement, 1) : 0,
                    days
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error building km summary for {Registration}", registration);
                return StatusCode(500, new { error = "Failed to build km summary", message = ex.Message });
            }
        }

        // Map a persisted movement row back to the CarTrackTripData shape the UI expects.
        private static CarTrackTripData MapToTripData(Models.Logistics.VehicleMovementHistory m) => new()
        {
            TripId = m.CartrackTripId,
            Registration = m.RegistrationNumber,
            StartTimestamp = m.StartTimestamp,
            EndTimestamp = m.EndTimestamp,
            TripDuration = m.TripDuration,
            TripDurationSeconds = m.TripDurationSeconds,
            StartLocation = m.StartLocation,
            EndLocation = m.EndLocation,
            StartGeofence = m.StartGeofence,
            EndGeofence = m.EndGeofence,
            StartLatitude = m.StartLatitude,
            StartLongitude = m.StartLongitude,
            EndLatitude = m.EndLatitude,
            EndLongitude = m.EndLongitude,
            TripDistance = m.TripDistance,
            MaxSpeed = m.MaxSpeed,
            HarshBrakingEvents = m.HarshBrakingEvents,
            HarshCorneringEvents = m.HarshCorneringEvents,
            HarshAccelerationEvents = m.HarshAccelerationEvents,
            IdleTimeSeconds = m.IdleTimeSeconds
        };

        [HttpGet("vehicles/{id}")]
        public async Task<ActionResult<VehicleDto>> GetVehicle(int id)
        {
            var vehicle = await _context.Vehicles
                .Include(v => v.VehicleType)
                .Include(v => v.CurrentDriver)
                .Where(v => v.Id == id)
                .Select(v => new VehicleDto
                {
                    Id = v.Id,
                    RegistrationNumber = v.RegistrationNumber,
                    VinNumber = v.VinNumber,
                    Make = v.Make,
                    Model = v.Model,
                    Year = v.Year,
                    Color = v.Color,
                    VehicleTypeId = v.VehicleTypeId,
                    VehicleTypeName = v.VehicleType.Name,
                    CurrentDriverId = v.CurrentDriverId,
                    CurrentDriverName = v.CurrentDriver != null ? $"{v.CurrentDriver.FirstName} {v.CurrentDriver.LastName}" : null,
                    CarTrackId = v.CarTrackId,
                    CarTrackName = v.CarTrackName,
                    Status = v.Status,
                    FuelCapacity = v.FuelCapacity,
                    CurrentOdometer = v.CurrentOdometer,
                    LastServiceDate = v.LastServiceDate,
                    NextServiceOdometer = v.NextServiceOdometer,
                    CreatedAt = v.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (vehicle == null)
                return NotFound();

            return Ok(vehicle);
        }

        [HttpPost("vehicles")]
        public async Task<ActionResult<VehicleDto>> CreateVehicle(CreateVehicleDto dto)
        {
            var vehicle = new Vehicle
            {
                RegistrationNumber = dto.RegistrationNumber,
                VinNumber = dto.VinNumber,
                Make = dto.Make,
                Model = dto.Model,
                Year = dto.Year,
                Color = dto.Color,
                VehicleTypeId = dto.VehicleTypeId,
                CurrentDriverId = dto.CurrentDriverId,
                CarTrackId = dto.CarTrackId,
                CarTrackName = dto.CarTrackName,
                FuelCapacity = dto.FuelCapacity,
                CurrentOdometer = dto.CurrentOdometer,
                Status = "Available"
            };

            _context.Vehicles.Add(vehicle);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetVehicle), new { id = vehicle.Id }, vehicle);
        }

        [HttpPut("vehicles/{id}")]
        public async Task<IActionResult> UpdateVehicle(int id, UpdateVehicleDto dto)
        {
            var vehicle = await _context.Vehicles.FindAsync(id);
            if (vehicle == null)
                return NotFound();

            if (dto.RegistrationNumber != null) vehicle.RegistrationNumber = dto.RegistrationNumber;
            if (dto.VinNumber != null) vehicle.VinNumber = dto.VinNumber;
            if (dto.Make != null) vehicle.Make = dto.Make;
            if (dto.Model != null) vehicle.Model = dto.Model;
            if (dto.Year.HasValue) vehicle.Year = dto.Year;
            if (dto.Color != null) vehicle.Color = dto.Color;
            if (dto.VehicleTypeId.HasValue) vehicle.VehicleTypeId = dto.VehicleTypeId.Value;
            if (dto.CurrentDriverId.HasValue) vehicle.CurrentDriverId = dto.CurrentDriverId;
            if (dto.CarTrackId != null) vehicle.CarTrackId = dto.CarTrackId;
            if (dto.CarTrackName != null) vehicle.CarTrackName = dto.CarTrackName;
            if (dto.Status != null) vehicle.Status = dto.Status;
            if (dto.FuelCapacity.HasValue) vehicle.FuelCapacity = dto.FuelCapacity;
            if (dto.CurrentOdometer.HasValue) vehicle.CurrentOdometer = dto.CurrentOdometer;
            if (dto.LastServiceDate.HasValue) vehicle.LastServiceDate = dto.LastServiceDate;
            if (dto.NextServiceOdometer.HasValue) vehicle.NextServiceOdometer = dto.NextServiceOdometer;

            vehicle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("vehicles/{id}/province")]
        public async Task<IActionResult> UpdateVehicleProvince(int id, [FromBody] UpdateProvinceDto dto)
        {
            var vehicle = await _context.Vehicles.FindAsync(id);
            if (vehicle == null)
                return NotFound();

            vehicle.Province = dto.Province;
            vehicle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { success = true, province = vehicle.Province });
        }

        /// <summary>
        /// Manually link a fleet vehicle to a CarTrack vehicle by ID
        /// </summary>
        [HttpPost("vehicles/{id}/link-cartrack")]
        public async Task<IActionResult> LinkCarTrack(int id, [FromBody] LinkExternalVehicleDto dto)
        {
            var vehicle = await _context.Vehicles.FindAsync(id);
            if (vehicle == null)
                return NotFound();

            // Look up CarTrack vehicle name/registration from the API
            string carTrackName = dto.ExternalId;
            try
            {
                var carTrackVehicles = await _carTrackService.GetRawVehicleDataAsync();
                var matched = carTrackVehicles.FirstOrDefault(ct => ct.VehicleId == dto.ExternalId);
                if (matched != null)
                {
                    carTrackName = matched.Registration ?? dto.ExternalId;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not look up CarTrack vehicle name for {CarTrackId}, using ID as name", dto.ExternalId);
            }

            vehicle.CarTrackId = dto.ExternalId;
            vehicle.CarTrackName = carTrackName;
            vehicle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Vehicle {VehicleId} ({Reg}) linked to CarTrack ID {CarTrackId} ({CarTrackName})",
                id, vehicle.RegistrationNumber, dto.ExternalId, carTrackName);

            return Ok(new { success = true, carTrackId = vehicle.CarTrackId, carTrackName = vehicle.CarTrackName });
        }

        /// <summary>
        /// Unlink a fleet vehicle from CarTrack
        /// </summary>
        [HttpPost("vehicles/{id}/unlink-cartrack")]
        public async Task<IActionResult> UnlinkCarTrack(int id)
        {
            var vehicle = await _context.Vehicles.FindAsync(id);
            if (vehicle == null)
                return NotFound();

            _logger.LogInformation("Vehicle {VehicleId} ({Reg}) unlinked from CarTrack ID {CarTrackId}",
                id, vehicle.RegistrationNumber, vehicle.CarTrackId);

            vehicle.CarTrackId = null;
            vehicle.CarTrackName = null;
            vehicle.LastKnownLatitude = null;
            vehicle.LastKnownLongitude = null;
            vehicle.LastKnownAddress = null;
            vehicle.LastKnownStatus = null;
            vehicle.LastLocationUpdate = null;
            vehicle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpDelete("vehicles/{id}")]
        public async Task<IActionResult> DeleteVehicle(int id)
        {
            var vehicle = await _context.Vehicles.FindAsync(id);
            if (vehicle == null)
                return NotFound();

            _context.Vehicles.Remove(vehicle);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Driver Endpoints
        [HttpGet("drivers")]
        public async Task<ActionResult<IEnumerable<DriverDto>>> GetDrivers()
        {
            var drivers = await _context.Drivers
                .Select(d => new DriverDto
                {
                    Id = d.Id,
                    FirstName = d.FirstName,
                    LastName = d.LastName,
                    LicenseNumber = d.LicenseNumber,
                    LicenseType = d.LicenseType,
                    LicenseExpiryDate = d.LicenseExpiryDate,
                    EmployeeNumber = d.EmployeeNumber,
                    PhoneNumber = d.PhoneNumber,
                    Email = d.Email,
                    Status = d.Status,
                    DateOfBirth = d.DateOfBirth,
                    HireDate = d.HireDate
                })
                .ToListAsync();

            return Ok(drivers);
        }

        [HttpGet("drivers/{id}")]
        public async Task<ActionResult<DriverDto>> GetDriver(int id)
        {
            var driver = await _context.Drivers
                .Where(d => d.Id == id)
                .Select(d => new DriverDto
                {
                    Id = d.Id,
                    FirstName = d.FirstName,
                    LastName = d.LastName,
                    LicenseNumber = d.LicenseNumber,
                    LicenseType = d.LicenseType,
                    LicenseExpiryDate = d.LicenseExpiryDate,
                    EmployeeNumber = d.EmployeeNumber,
                    PhoneNumber = d.PhoneNumber,
                    Email = d.Email,
                    Status = d.Status,
                    DateOfBirth = d.DateOfBirth,
                    HireDate = d.HireDate
                })
                .FirstOrDefaultAsync();

            if (driver == null)
                return NotFound();

            return Ok(driver);
        }

        [HttpPost("drivers")]
        public async Task<ActionResult<DriverDto>> CreateDriver(CreateDriverDto dto)
        {
            var driver = new Driver
            {
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                LicenseNumber = dto.LicenseNumber,
                LicenseType = dto.LicenseType,
                LicenseExpiryDate = dto.LicenseExpiryDate,
                EmployeeNumber = dto.EmployeeNumber,
                PhoneNumber = dto.PhoneNumber,
                Email = dto.Email,
                DateOfBirth = dto.DateOfBirth,
                HireDate = dto.HireDate,
                Status = "Active"
            };

            _context.Drivers.Add(driver);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDriver), new { id = driver.Id }, driver);
        }

        [HttpPut("drivers/{id}")]
        public async Task<IActionResult> UpdateDriver(int id, UpdateDriverDto dto)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null)
                return NotFound();

            if (dto.FirstName != null) driver.FirstName = dto.FirstName;
            if (dto.LastName != null) driver.LastName = dto.LastName;
            if (dto.LicenseNumber != null) driver.LicenseNumber = dto.LicenseNumber;
            if (dto.LicenseType != null) driver.LicenseType = dto.LicenseType;
            if (dto.LicenseExpiryDate.HasValue) driver.LicenseExpiryDate = dto.LicenseExpiryDate;
            if (dto.EmployeeNumber != null) driver.EmployeeNumber = dto.EmployeeNumber;
            if (dto.PhoneNumber != null) driver.PhoneNumber = dto.PhoneNumber;
            if (dto.Email != null) driver.Email = dto.Email;
            if (dto.Status != null) driver.Status = dto.Status;
            if (dto.DateOfBirth.HasValue) driver.DateOfBirth = dto.DateOfBirth;
            if (dto.HireDate.HasValue) driver.HireDate = dto.HireDate;

            driver.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("drivers/{id}")]
        public async Task<IActionResult> DeleteDriver(int id)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null)
                return NotFound();

            _context.Drivers.Remove(driver);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Vehicle Type Endpoints
        [HttpGet("vehicle-types")]
        public async Task<ActionResult<IEnumerable<VehicleTypeDto>>> GetVehicleTypes()
        {
            await EnsureDefaultVehicleTypesAsync();

            var types = await _context.VehicleTypes
                .Select(vt => new VehicleTypeDto
                {
                    Id = vt.Id,
                    Name = vt.Name,
                    Description = vt.Description,
                    MaxLoadWeight = vt.MaxLoadWeight,
                    MaxLoadVolume = vt.MaxLoadVolume,
                    FuelType = vt.FuelType
                })
                .ToListAsync();

            return Ok(types);
        }

        /// <summary>
        /// Make sure the standard set of vehicle types exists so the fleet UI
        /// always has selectable options with valid FK ids. Adds any missing
        /// entries (including "Truck (Hours)" and "Trailer") without touching
        /// existing rows.
        /// </summary>
        private async Task EnsureDefaultVehicleTypesAsync()
        {
            var defaults = new (string Name, string Description, string FuelType)[]
            {
                ("Truck", "Standard delivery truck (km-based)", "Diesel"),
                ("Van", "Panel/delivery van", "Diesel"),
                ("Car", "Passenger/pool car", "Petrol"),
                ("Motorcycle", "Motorcycle / scooter", "Petrol"),
                ("Truck-Horse", "Truck-horse / tractor unit (pulls a trailer)", "Diesel"),
                ("Trailer", "Towed trailer unit", "None")
            };

            var existing = await _context.VehicleTypes
                .Select(vt => vt.Name)
                .ToListAsync();
            var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

            var toAdd = defaults
                .Where(d => !existingSet.Contains(d.Name))
                .Select(d => new VehicleType
                {
                    Name = d.Name,
                    Description = d.Description,
                    FuelType = d.FuelType
                })
                .ToList();

            if (toAdd.Count > 0)
            {
                _context.VehicleTypes.AddRange(toAdd);
                await _context.SaveChangesAsync();
            }

            // Remove a previously mis-seeded "Truck (Hours)" type if it exists and
            // isn't referenced by any vehicle.
            var stale = await _context.VehicleTypes
                .FirstOrDefaultAsync(vt => vt.Name == "Truck (Hours)");
            if (stale != null)
            {
                var inUse = await _context.Vehicles.AnyAsync(v => v.VehicleTypeId == stale.Id);
                if (!inUse)
                {
                    _context.VehicleTypes.Remove(stale);
                    await _context.SaveChangesAsync();
                }
            }
        }

        [HttpPost("vehicle-types")]
        public async Task<ActionResult<VehicleTypeDto>> CreateVehicleType(CreateVehicleTypeDto dto)
        {
            var vehicleType = new VehicleType
            {
                Name = dto.Name,
                Description = dto.Description,
                MaxLoadWeight = dto.MaxLoadWeight,
                MaxLoadVolume = dto.MaxLoadVolume,
                FuelType = dto.FuelType
            };

            _context.VehicleTypes.Add(vehicleType);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetVehicleTypes), new { id = vehicleType.Id }, vehicleType);
        }

        // CarTrack Sync Endpoints
        /// <summary>
        /// Sync vehicles from CarTrack - creates new records or updates existing ones
        /// </summary>
        [HttpPost("sync-from-cartrack")]
        public async Task<ActionResult<SyncResultDto>> SyncFromCarTrack()
        {
            try
            {
                _logger.LogInformation("Starting CarTrack sync...");
                
                var carTrackVehicles = await _carTrackService.GetRawVehicleDataAsync();
                
                if (carTrackVehicles.Count == 0)
                {
                    return Ok(new SyncResultDto 
                    { 
                        Success = false, 
                        Message = "No vehicles returned from CarTrack. Check API connection.",
                        VehiclesCreated = 0,
                        VehiclesUpdated = 0,
                        DriversCreated = 0,
                        DriversUpdated = 0
                    });
                }

                _logger.LogInformation($"Retrieved {carTrackVehicles.Count} vehicles from CarTrack");

                // Get default vehicle type or create one
                var defaultVehicleType = await _context.VehicleTypes.FirstOrDefaultAsync(vt => vt.Name == "Truck");
                if (defaultVehicleType == null)
                {
                    defaultVehicleType = new VehicleType 
                    { 
                        Name = "Truck", 
                        Description = "Default truck type from CarTrack sync",
                        FuelType = "Diesel"
                    };
                    _context.VehicleTypes.Add(defaultVehicleType);
                    await _context.SaveChangesAsync();
                }

                int vehiclesCreated = 0;
                int vehiclesUpdated = 0;
                int driversCreated = 0;
                int driversUpdated = 0;
                var syncedVehicles = new List<string>();
                var syncedDrivers = new List<string>();

                foreach (var ctVehicle in carTrackVehicles)
                {
                    if (string.IsNullOrEmpty(ctVehicle.VehicleId))
                        continue;

                    // Check if vehicle exists by CarTrackId
                    var existingVehicle = await _context.Vehicles
                        .FirstOrDefaultAsync(v => v.CarTrackId == ctVehicle.VehicleId);

                    // Also check by registration if no CarTrackId match
                    if (existingVehicle == null && !string.IsNullOrEmpty(ctVehicle.Registration))
                    {
                        existingVehicle = await _context.Vehicles
                            .FirstOrDefaultAsync(v => v.RegistrationNumber == ctVehicle.Registration);
                    }

                    // Handle driver sync if driver info is available
                    Driver? driver = null;
                    if (!string.IsNullOrEmpty(ctVehicle.DriverFirstName) || !string.IsNullOrEmpty(ctVehicle.DriverLastName))
                    {
                        var firstName = ctVehicle.DriverFirstName ?? "Unknown";
                        var lastName = ctVehicle.DriverLastName ?? "Driver";

                        // Try to find existing driver by name
                        driver = await _context.Drivers
                            .FirstOrDefaultAsync(d => d.FirstName == firstName && d.LastName == lastName);

                        if (driver == null)
                        {
                            // Create new driver
                            driver = new Driver
                            {
                                FirstName = firstName,
                                LastName = lastName,
                                LicenseNumber = $"CT-{ctVehicle.VehicleId}", // Placeholder license
                                LicenseType = "Code 14", // Default for trucks
                                Status = "Active",
                                HireDate = DateTime.UtcNow
                            };
                            _context.Drivers.Add(driver);
                            await _context.SaveChangesAsync();
                            driversCreated++;
                            syncedDrivers.Add($"{firstName} {lastName} (NEW)");
                        }
                        else
                        {
                            driversUpdated++;
                            syncedDrivers.Add($"{firstName} {lastName} (EXISTS)");
                        }
                    }

                    if (existingVehicle != null)
                    {
                        // Update existing vehicle
                        existingVehicle.CarTrackId = ctVehicle.VehicleId;
                        existingVehicle.CarTrackName = ctVehicle.Registration ?? existingVehicle.CarTrackName;
                        if (!string.IsNullOrEmpty(ctVehicle.ChassisNumber))
                            existingVehicle.VinNumber = ctVehicle.ChassisNumber;
                        if (driver != null)
                            existingVehicle.CurrentDriverId = driver.Id;
                        existingVehicle.UpdatedAt = DateTime.UtcNow;
                        
                        vehiclesUpdated++;
                        syncedVehicles.Add($"{existingVehicle.RegistrationNumber} (UPDATED)");
                    }
                    else
                    {
                        // Create new vehicle
                        var registration = ctVehicle.Registration ?? $"CT-{ctVehicle.VehicleId}";
                        var newVehicle = new Vehicle
                        {
                            RegistrationNumber = registration,
                            VinNumber = ctVehicle.ChassisNumber,
                            Make = "Unknown", // CarTrack doesn't provide make
                            Model = "Unknown", // CarTrack doesn't provide model
                            VehicleTypeId = defaultVehicleType.Id,
                            CarTrackId = ctVehicle.VehicleId,
                            CarTrackName = registration,
                            Status = ctVehicle.Status == "offline" ? "Inactive" : "Available",
                            CurrentDriverId = driver?.Id
                        };
                        _context.Vehicles.Add(newVehicle);
                        
                        vehiclesCreated++;
                        syncedVehicles.Add($"{registration} (NEW)");
                    }
                }

                await _context.SaveChangesAsync();

                var result = new SyncResultDto
                {
                    Success = true,
                    Message = $"CarTrack sync completed successfully",
                    VehiclesCreated = vehiclesCreated,
                    VehiclesUpdated = vehiclesUpdated,
                    DriversCreated = driversCreated,
                    DriversUpdated = driversUpdated,
                    SyncedVehicles = syncedVehicles,
                    SyncedDrivers = syncedDrivers.Distinct().ToList(),
                    TotalCarTrackVehicles = carTrackVehicles.Count,
                    SyncTimestamp = DateTime.UtcNow
                };

                _logger.LogInformation($"CarTrack sync completed: {vehiclesCreated} created, {vehiclesUpdated} updated, {driversCreated} drivers created");

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during CarTrack sync");
                return StatusCode(500, new SyncResultDto 
                { 
                    Success = false, 
                    Message = $"Sync failed: {ex.Message}",
                    VehiclesCreated = 0,
                    VehiclesUpdated = 0,
                    DriversCreated = 0,
                    DriversUpdated = 0
                });
            }
        }

        /// <summary>
        /// Preview what would be synced from CarTrack without making changes
        /// </summary>
        [HttpGet("cartrack-preview")]
        public async Task<ActionResult<CarTrackPreviewDto>> PreviewCarTrackSync()
        {
            try
            {
                var carTrackVehicles = await _carTrackService.GetRawVehicleDataAsync();
                var existingVehicles = await _context.Vehicles.ToListAsync();
                var existingDrivers = await _context.Drivers.ToListAsync();

                var newVehicles = new List<CarTrackVehiclePreview>();
                var existingMatches = new List<CarTrackVehiclePreview>();
                var newDrivers = new List<string>();

                foreach (var ctVehicle in carTrackVehicles)
                {
                    if (string.IsNullOrEmpty(ctVehicle.VehicleId))
                        continue;

                    var preview = new CarTrackVehiclePreview
                    {
                        CarTrackId = ctVehicle.VehicleId,
                        Registration = ctVehicle.Registration ?? $"CT-{ctVehicle.VehicleId}",
                        ChassisNumber = ctVehicle.ChassisNumber,
                        DriverName = !string.IsNullOrEmpty(ctVehicle.DriverFirstName) 
                            ? $"{ctVehicle.DriverFirstName} {ctVehicle.DriverLastName}".Trim() 
                            : null,
                        Status = ctVehicle.Status
                    };

                    // Check if exists
                    var exists = existingVehicles.Any(v => 
                        v.CarTrackId == ctVehicle.VehicleId || 
                        v.RegistrationNumber == ctVehicle.Registration);

                    if (exists)
                    {
                        preview.Action = "Update";
                        existingMatches.Add(preview);
                    }
                    else
                    {
                        preview.Action = "Create";
                        newVehicles.Add(preview);
                    }

                    // Check driver
                    if (!string.IsNullOrEmpty(ctVehicle.DriverFirstName))
                    {
                        var driverExists = existingDrivers.Any(d => 
                            d.FirstName == ctVehicle.DriverFirstName && 
                            d.LastName == (ctVehicle.DriverLastName ?? "Driver"));
                        
                        if (!driverExists)
                        {
                            var driverName = $"{ctVehicle.DriverFirstName} {ctVehicle.DriverLastName}".Trim();
                            if (!newDrivers.Contains(driverName))
                                newDrivers.Add(driverName);
                        }
                    }
                }

                return Ok(new CarTrackPreviewDto
                {
                    TotalCarTrackVehicles = carTrackVehicles.Count,
                    NewVehicles = newVehicles,
                    ExistingVehicles = existingMatches,
                    NewDrivers = newDrivers,
                    ExistingVehiclesInDb = existingVehicles.Count,
                    ExistingDriversInDb = existingDrivers.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error previewing CarTrack sync");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    // DTOs for sync operations
    public class SyncResultDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public int VehiclesCreated { get; set; }
        public int VehiclesUpdated { get; set; }
        public int DriversCreated { get; set; }
        public int DriversUpdated { get; set; }
        public List<string> SyncedVehicles { get; set; } = new();
        public List<string> SyncedDrivers { get; set; } = new();
        public int TotalCarTrackVehicles { get; set; }
        public DateTime SyncTimestamp { get; set; }
    }

    public class CarTrackPreviewDto
    {
        public int TotalCarTrackVehicles { get; set; }
        public List<CarTrackVehiclePreview> NewVehicles { get; set; } = new();
        public List<CarTrackVehiclePreview> ExistingVehicles { get; set; } = new();
        public List<string> NewDrivers { get; set; } = new();
        public int ExistingVehiclesInDb { get; set; }
        public int ExistingDriversInDb { get; set; }
    }

    public class CarTrackVehiclePreview
    {
        public string CarTrackId { get; set; } = string.Empty;
        public string Registration { get; set; } = string.Empty;
        public string? ChassisNumber { get; set; }
        public string? DriverName { get; set; }
        public string? Status { get; set; }
        public string Action { get; set; } = string.Empty; // "Create" or "Update"
    }
}
