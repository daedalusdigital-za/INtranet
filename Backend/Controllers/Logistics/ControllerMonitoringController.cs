using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services;
using System.Collections.Concurrent;
using System.Text.Json;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Endpoints for the logistics / security "Controller" - a live monitoring console
    /// for watching all vehicles, especially during curfew hours (default 18:00-06:00)
    /// when vehicles are supposed to be parked off. Any movement during curfew is
    /// flagged red. Also serves archived movement history and geofence management.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/logistics/controller")]
    public class ControllerMonitoringController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ICarTrackService _carTrackService;
        private readonly ILogger<ControllerMonitoringController> _logger;
        private readonly IAuditLogService _auditLogService;
        private static readonly ConcurrentDictionary<string, GeofenceTrackState> _geofenceTrack = new();

        // Default curfew window (local SAST). Vehicles should be parked between these hours.
        private const int DefaultCurfewStartHour = 18; // 6pm
        private const int DefaultCurfewEndHour = 5;     // 5am

        // Speed (km/h) at or above which a vehicle is flagged as speeding.
        private const double SpeedingThreshold = 90;

        public ControllerMonitoringController(
            ApplicationDbContext context,
            ICarTrackService carTrackService,
            ILogger<ControllerMonitoringController> logger,
            IAuditLogService auditLogService)
        {
            _context = context;
            _carTrackService = carTrackService;
            _logger = logger;
            _auditLogService = auditLogService;
        }

        /// <summary>
        /// Live snapshot of the whole fleet for the controller console. Classifies each
        /// vehicle and, when currently inside curfew hours, flags any moving vehicle as
        /// an alert. Also detects vehicles that have left their parking geofence.
        /// </summary>
        [HttpGet("night-watch")]
        public async Task<IActionResult> GetNightWatch(
            [FromQuery] int curfewStart = DefaultCurfewStartHour,
            [FromQuery] int curfewEnd = DefaultCurfewEndHour)
        {
            try
            {
                // SAST = UTC+2
                var nowSast = DateTime.UtcNow.AddHours(2);
                var inCurfew = IsWithinCurfew(nowSast.Hour, curfewStart, curfewEnd);

                var fleet = await _carTrackService.GetFleetStatusAsync();

                // Match to local vehicles for registration/driver
                var localVehicles = await _context.Vehicles
                    .Include(v => v.CurrentDriver)
                    .Where(v => v.CarTrackId != null)
                    .ToListAsync();

                var parkingZones = await _context.Geofences
                    .Where(g => g.IsActive && (g.Type == "Parking" || g.Type == "Depot"))
                    .ToListAsync();

                var vehicles = new List<object>();
                int movingCount = 0, parkedCount = 0, idlingCount = 0, offlineCount = 0, alertCount = 0, breachCount = 0;

                foreach (var v in fleet.Vehicles)
                {
                    var local = localVehicles.FirstOrDefault(lv => lv.CarTrackId == v.VehicleId);
                    var reg = v.RegistrationNumber ?? local?.RegistrationNumber ?? v.VehicleName ?? v.VehicleId;
                    var driver = v.CurrentDriverName
                        ?? (local?.CurrentDriver != null ? $"{local.CurrentDriver.FirstName} {local.CurrentDriver.LastName}".Trim() : null);

                    var lat = v.Location?.Latitude ?? 0;
                    var lng = v.Location?.Longitude ?? 0;
                    var isMoving = v.Status == "moving" || v.Speed > 3;

                    // Geofence breach: outside every parking/depot zone
                    bool outsideParking = false;
                    string? nearestZone = null;
                    double nearestDist = double.MaxValue;
                    if (parkingZones.Count > 0 && lat != 0 && lng != 0)
                    {
                        outsideParking = true;
                        foreach (var z in parkingZones)
                        {
                            var d = HaversineMeters(lat, lng, (double)z.Latitude, (double)z.Longitude);
                            if (d < nearestDist) { nearestDist = d; nearestZone = z.Name; }
                            if (d <= z.RadiusMeters) { outsideParking = false; break; }
                        }
                    }

                    // Status classification for the console
                    string status;
                    bool alert = false;
                    if (v.Status == "offline")
                    {
                        status = "offline"; offlineCount++;
                    }
                    else if (isMoving)
                    {
                        status = "moving"; movingCount++;
                        if (inCurfew) { alert = true; alertCount++; } // moving during curfew = red alert
                    }
                    else if (v.Status == "idling")
                    {
                        status = "idling"; idlingCount++;
                    }
                    else
                    {
                        status = "parked"; parkedCount++;
                    }

                    if (inCurfew && outsideParking && parkingZones.Count > 0)
                    {
                        breachCount++;
                        alert = alert || true;
                    }

                    // ── Incident recording is handled 24/7 by IncidentMonitoringService ──
                    // (this endpoint only renders the live snapshot; recording here would
                    //  duplicate rows and would only ever fire while a screen is open).

                    // Track and log warehouse geofence exits for vehicles that were inside before 18:00.
                    await TrackWarehouseGeofenceAsync(
                        reg,
                        driver,
                        status,
                        isMoving,
                        lat,
                        lng,
                        nearestZone,
                        outsideParking,
                        parkingZones.Count > 0,
                        nowSast,
                        inCurfew,
                        nearestDist == double.MaxValue ? (double?)null : nearestDist,
                        v.Location?.Address);

                    vehicles.Add(new
                    {
                        vehicleId = v.VehicleId,
                        localVehicleId = local?.Id,
                        registration = reg,
                        driver,
                        latitude = lat,
                        longitude = lng,
                        address = v.Location?.Address,
                        speed = Math.Round(v.Speed, 1),
                        heading = v.Heading,
                        status,
                        isMoving,
                        alert,
                        outsideParking = parkingZones.Count > 0 && outsideParking,
                        nearestZone,
                        nearestZoneMeters = nearestDist == double.MaxValue ? (double?)null : Math.Round(nearestDist),
                        lastUpdate = v.LastUpdate
                    });
                }

                // Persist any incidents queued during this snapshot.
                try { await _context.SaveChangesAsync(); }
                catch (Exception saveEx) { _logger.LogWarning(saveEx, "Failed to persist logistics incidents"); }

                return Ok(new
                {
                    serverTimeUtc = DateTime.UtcNow,
                    serverTimeSast = nowSast,
                    inCurfew,
                    curfewStart,
                    curfewEnd,
                    summary = new
                    {
                        total = fleet.Vehicles.Count,
                        moving = movingCount,
                        parked = parkedCount,
                        idling = idlingCount,
                        offline = offlineCount,
                        alerts = alertCount,
                        geofenceBreaches = breachCount
                    },
                    vehicles = vehicles.OrderByDescending(x => ((dynamic)x).alert).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error building night-watch snapshot");
                return StatusCode(500, new { message = "Failed to load night-watch data", error = ex.Message });
            }
        }

        private async Task TrackWarehouseGeofenceAsync(
            string registration,
            string? driver,
            string status,
            bool isMoving,
            double lat,
            double lng,
            string? nearestZone,
            bool outsideParking,
            bool hasParkingZones,
            DateTime nowSast,
            bool inCurfew,
            double? distanceMeters = null,
            string? address = null)
        {
            if (!hasParkingZones || lat == 0 || lng == 0) return;

            // After 06:00, close any active overnight tracking session and stop.
            if (!inCurfew)
            {
                if (_geofenceTrack.TryGetValue(registration, out var existing) && existing.BreachActive)
                {
                    existing.BreachActive = false;
                    existing.LastMovementLoggedAtUtc = null;
                    await _auditLogService.LogAsync(
                        "Warehouse Geofence Tracking Ended",
                        "logistics",
                        "Vehicle",
                        null,
                        $"Tracking window ended at 06:00 for {registration} before vehicle returned to geofence.",
                        JsonSerializer.Serialize(new
                        {
                            registration,
                            driver,
                            status,
                            lastLatitude = lat,
                            lastLongitude = lng,
                            nearestZone,
                            endedAtSast = nowSast
                        }),
                        "warning");
                }
                return;
            }

            var state = _geofenceTrack.GetOrAdd(registration, _ => new GeofenceTrackState());

            // Arm only while still before curfew start and vehicle is inside a parking/depot zone.
            if (nowSast.Hour < DefaultCurfewStartHour && !outsideParking)
            {
                state.ArmedBeforeCurfew = true;
                state.HomeZoneName = nearestZone;
                state.BreachActive = false;
                state.LastMovementLoggedAtUtc = null;
                return;
            }

            // During curfew, only track vehicles that were armed before 18:00.
            if (!state.ArmedBeforeCurfew) return;

            if (outsideParking)
            {
                if (!state.BreachActive)
                {
                    state.BreachActive = true;
                    state.ExitAtSast = nowSast;
                    state.LastMovementLoggedAtUtc = null;

                    // Note: the GeofenceExit incident row is recorded by IncidentMonitoringService
                    // (24/7). Here we only write the live audit-log trail for the console.

                    await _auditLogService.LogAsync(
                        "Warehouse Geofence Exit",
                        "logistics",
                        "Vehicle",
                        null,
                        $"{registration} left warehouse geofence during curfew.",
                        JsonSerializer.Serialize(new
                        {
                            registration,
                            driver,
                            status,
                            isMoving,
                            latitude = lat,
                            longitude = lng,
                            homeZone = state.HomeZoneName,
                            nearestZone,
                            exitAtSast = nowSast
                        }),
                        "warning");
                }

                // Log movement updates every 5 minutes while outside.
                if (!state.LastMovementLoggedAtUtc.HasValue ||
                    DateTime.UtcNow.Subtract(state.LastMovementLoggedAtUtc.Value).TotalMinutes >= 5)
                {
                    state.LastMovementLoggedAtUtc = DateTime.UtcNow;
                    await _auditLogService.LogAsync(
                        "Warehouse Geofence Movement",
                        "logistics",
                        "Vehicle",
                        null,
                        $"Movement tracked for {registration} outside warehouse geofence.",
                        JsonSerializer.Serialize(new
                        {
                            registration,
                            driver,
                            status,
                            isMoving,
                            latitude = lat,
                            longitude = lng,
                            nearestZone,
                            trackedAtSast = nowSast
                        }));
                }
            }
            else if (state.BreachActive)
            {
                state.BreachActive = false;
                state.LastMovementLoggedAtUtc = null;
                state.ArmedBeforeCurfew = false; // one overnight cycle complete

                await _auditLogService.LogAsync(
                    "Warehouse Geofence Return",
                    "logistics",
                    "Vehicle",
                    null,
                    $"{registration} returned inside warehouse geofence.",
                    JsonSerializer.Serialize(new
                    {
                        registration,
                        driver,
                        status,
                        latitude = lat,
                        longitude = lng,
                        zone = nearestZone,
                        returnedAtSast = nowSast,
                        exitedAtSast = state.ExitAtSast
                    }));
            }
        }

        private sealed class GeofenceTrackState
        {
            public bool ArmedBeforeCurfew { get; set; }
            public bool BreachActive { get; set; }
            public string? HomeZoneName { get; set; }
            public DateTime? ExitAtSast { get; set; }
            public DateTime? LastMovementLoggedAtUtc { get; set; }
        }

        /// <summary>
        /// Archived movement history for a given date. Returns every trip that occurred
        /// during the curfew window on that date (i.e. from 18:00 on the selected date
        /// to 06:00 the next morning), so the controller can review overnight activity.
        /// </summary>
        [HttpGet("movement-history")]
        public async Task<IActionResult> GetMovementHistory(
            [FromQuery] DateTime? date = null,
            [FromQuery] int curfewStart = DefaultCurfewStartHour,
            [FromQuery] int curfewEnd = DefaultCurfewEndHour,
            [FromQuery] string? registration = null,
            [FromQuery] bool curfewOnly = true)
        {
            try
            {
                var day = (date ?? DateTime.UtcNow.AddHours(2)).Date;

                // Curfew window in local time: from curfewStart on 'day' to curfewEnd next day
                var windowStart = day.AddHours(curfewStart);
                var windowEnd = day.AddDays(1).AddHours(curfewEnd);

                // If not curfew-only, get the whole day
                var fromDt = curfewOnly ? windowStart : day;
                var toDt = curfewOnly ? windowEnd : day.AddDays(1).AddSeconds(-1);

                var trips = await _carTrackService.GetAllTripsAsync(fromDt, toDt);

                if (!string.IsNullOrEmpty(registration))
                {
                    trips = trips.Where(t => t.Registration != null &&
                        t.Registration.Contains(registration, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                var events = trips.Select(t => new
                {
                    tripId = t.TripId,
                    registration = t.Registration,
                    start = t.StartTimestamp,
                    end = t.EndTimestamp,
                    duration = t.TripDuration,
                    distanceKm = Math.Round(t.TripDistance / 1000.0, 2),
                    maxSpeed = Math.Round(t.MaxSpeed, 0),
                    startLocation = t.StartLocation,
                    endLocation = t.EndLocation,
                    startLat = t.StartLatitude,
                    startLng = t.StartLongitude,
                    endLat = t.EndLatitude,
                    endLng = t.EndLongitude,
                    startGeofence = t.StartGeofence,
                    endGeofence = t.EndGeofence,
                    harshEvents = t.HarshBrakingEvents + t.HarshCorneringEvents + t.HarshAccelerationEvents
                }).ToList();

                var byVehicle = events
                    .GroupBy(e => e.registration)
                    .Select(g => new
                    {
                        registration = g.Key,
                        trips = g.Count(),
                        totalKm = Math.Round(g.Sum(x => x.distanceKm), 2),
                        firstMove = g.Min(x => x.start),
                        lastMove = g.Max(x => x.end)
                    })
                    .OrderByDescending(x => x.totalKm)
                    .ToList();

                return Ok(new
                {
                    date = day,
                    window = new { from = fromDt, to = toDt, curfewOnly },
                    totalTrips = events.Count,
                    vehiclesMoved = byVehicle.Count,
                    byVehicle,
                    events
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading movement history");
                return StatusCode(500, new { message = "Failed to load movement history", error = ex.Message });
            }
        }

        // ---------------- Geofence management ----------------

        [HttpGet("geofences")]
        public async Task<IActionResult> GetGeofences()
        {
            var zones = await _context.Geofences
                .OrderBy(g => g.Type).ThenBy(g => g.Name)
                .ToListAsync();
            return Ok(zones);
        }

        [HttpPost("geofences")]
        public async Task<IActionResult> CreateGeofence([FromBody] Geofence zone)
        {
            zone.Id = 0;
            zone.CreatedAt = DateTime.UtcNow;
            zone.CreatedBy = User?.Identity?.Name;
            _context.Geofences.Add(zone);
            await _context.SaveChangesAsync();
            return Ok(zone);
        }

        [HttpPut("geofences/{id}")]
        public async Task<IActionResult> UpdateGeofence(int id, [FromBody] Geofence update)
        {
            var zone = await _context.Geofences.FindAsync(id);
            if (zone == null) return NotFound();

            zone.Name = update.Name;
            zone.Type = update.Type;
            zone.Latitude = update.Latitude;
            zone.Longitude = update.Longitude;
            zone.RadiusMeters = update.RadiusMeters;
            zone.Region = update.Region;
            zone.Color = update.Color;
            zone.IsActive = update.IsActive;
            zone.Notes = update.Notes;
            zone.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(zone);
        }

        [HttpDelete("geofences/{id}")]
        public async Task<IActionResult> DeleteGeofence(int id)
        {
            var zone = await _context.Geofences.FindAsync(id);
            if (zone == null) return NotFound();
            _context.Geofences.Remove(zone);
            await _context.SaveChangesAsync();
            return Ok(new { deleted = id });
        }

        // ---------------- helpers ----------------

        private static bool IsWithinCurfew(int hour, int start, int end)
        {
            // Handles windows that wrap past midnight (e.g. 18 -> 6)
            if (start == end) return true;
            if (start < end) return hour >= start && hour < end;
            return hour >= start || hour < end;
        }

        /// <summary>
        /// Test endpoint to check if Vision API (cameras) is accessible with current CarTrack credentials.
        /// Queries the first available vehicle and attempts to access its cameras.
        /// </summary>
        [HttpGet("test-vision-api")]
        public async Task<IActionResult> TestVisionApi()
        {
            try
            {
                var fleet = await _carTrackService.GetFleetStatusAsync();
                if (fleet == null || fleet.Vehicles == null || fleet.Vehicles.Count == 0)
                {
                    return Ok(new
                    {
                        status = "No vehicles found",
                        message = "Cannot test Vision API without vehicles in the fleet",
                        credentialsConfigured = true,
                        visionApiEnabled = (bool?)null
                    });
                }

                // Try to get livestream for the first vehicle
                var firstVehicle = fleet.Vehicles.FirstOrDefault();
                if (firstVehicle == null || string.IsNullOrEmpty(firstVehicle.RegistrationNumber))
                {
                    return Ok(new { status = "error", message = "First vehicle has no registration" });
                }

                var reg = firstVehicle.RegistrationNumber;
                _logger.LogInformation("Testing Vision API for vehicle {Registration}", reg);
                
                // Request all 8 camera types to see which are available
                var livestream = await _carTrackService.GetVehicleLivestreamAsync(reg, new[] { 1, 2, 3, 4, 5, 6, 7, 8 });

                if (livestream == null)
                {
                    return Ok(new
                    {
                        status = "error",
                        message = "Vision API request failed or no response",
                        testVehicle = reg,
                        visionApiEnabled = false
                    });
                }

                if (!string.IsNullOrEmpty(livestream.Error))
                {
                    return Ok(new
                    {
                        status = "vision_not_enabled",
                        message = livestream.Error,
                        errorCode = livestream.ErrorCode,
                        testVehicle = reg,
                        visionApiEnabled = false,
                        credential = "ACCE00008"
                    });
                }

                return Ok(new
                {
                    status = "success",
                    message = "Vision API is accessible!",
                    testVehicle = reg,
                    camerasFound = livestream.Streams?.Count ?? 0,
                    cameras = livestream.Streams?.Select(s => new
                    {
                        id = s.CameraId,
                        name = s.CameraName,
                        hasStreamUrl = !string.IsNullOrEmpty(s.StreamUrl),
                        hasThumbnail = !string.IsNullOrEmpty(s.ThumbnailUrl)
                    }).ToList(),
                    visionApiEnabled = true,
                    credential = "ACCE00008"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error testing Vision API");
                return StatusCode(500, new
                {
                    status = "error",
                    message = ex.Message,
                    visionApiEnabled = false
                });
            }
        }

        /// <summary>
        /// List all vehicles that could potentially have cameras (all CarTrack vehicles).
        /// Actual camera capability is verified when requesting a livestream.
        /// </summary>
        [HttpGet("cameras/vehicles")]
        public async Task<IActionResult> GetCameraVehicles()
        {
            try
            {
                var vehicles = await _carTrackService.GetVisionEnabledVehiclesAsync();
                return Ok(vehicles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listing camera-capable vehicles");
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Request a livestream from a vehicle's cameras.
        /// Body: { cameras: [1,2,3,4,5,6,7,8] } — camera IDs (1=Front, 2=Rear, 3=Driver, 4=Cabin, 5=Left, 6=Right, 7=Cargo, 8=Aux)
        /// </summary>
        [HttpPost("cameras/livestream/{registration}")]
        public async Task<IActionResult> GetLivestream(string registration, [FromBody] LivestreamRequestBody? body)
        {
            try
            {
                var cameras = body?.Cameras ?? new[] { 1, 2, 3, 4, 5, 6, 7, 8 };
                var result = await _carTrackService.GetVehicleLivestreamAsync(registration, cameras);
                if (result == null)
                {
                    return NotFound(new { message = "No livestream available for this vehicle" });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching livestream for {Registration}", registration);
                return StatusCode(500, new { message = ex.Message });
            }
        }

        public class LivestreamRequestBody
        {
            public int[]? Cameras { get; set; }
        }

        /// <summary>
        /// Returns active load routes for display on the live map.
        /// Each route contains ordered waypoints (pickup → stops → delivery) with lat/lng.
        /// </summary>
        [HttpGet("active-load-routes")]
        public async Task<IActionResult> GetActiveLoadRoutes()
        {
            try
            {
                var loads = await _context.Loads
                    .Include(l => l.Customer)
                    .Include(l => l.Vehicle)
                    .Include(l => l.Driver)
                    .Include(l => l.Warehouse)
                    .Include(l => l.Stops)
                    .Where(l => l.Status == "In Transit" || l.Status == "Assigned" || l.Status == "Active")
                    .OrderByDescending(l => l.ScheduledPickupDate ?? l.CreatedAt)
                    .ToListAsync();

                var routes = loads.Select(l =>
                {
                    var waypoints = new List<object>();

                    // Pickup
                    if (l.PickupLatitude.HasValue && l.PickupLongitude.HasValue)
                    {
                        waypoints.Add(new
                        {
                            lat = (double)l.PickupLatitude.Value,
                            lng = (double)l.PickupLongitude.Value,
                            label = l.PickupLocation ?? "Pickup",
                            type = "pickup",
                            sequence = 0
                        });
                    }
                    else if (l.Warehouse != null && l.Warehouse.Latitude.HasValue && l.Warehouse.Longitude.HasValue)
                    {
                        waypoints.Add(new
                        {
                            lat = (double)l.Warehouse.Latitude.Value,
                            lng = (double)l.Warehouse.Longitude.Value,
                            label = l.Warehouse.Name,
                            type = "warehouse",
                            sequence = 0
                        });
                    }

                    // Stops (ordered)
                    if (l.Stops != null)
                    {
                        foreach (var s in l.Stops.OrderBy(s => s.StopSequence))
                        {
                            if (s.Latitude.HasValue && s.Longitude.HasValue)
                            {
                                waypoints.Add(new
                                {
                                    lat = (double)s.Latitude.Value,
                                    lng = (double)s.Longitude.Value,
                                    label = s.CompanyName ?? s.LocationName ?? s.Address,
                                    type = s.StopType?.ToLower() ?? "stop",
                                    sequence = s.StopSequence
                                });
                            }
                        }
                    }

                    // Delivery
                    if (l.DeliveryLatitude.HasValue && l.DeliveryLongitude.HasValue)
                    {
                        waypoints.Add(new
                        {
                            lat = (double)l.DeliveryLatitude.Value,
                            lng = (double)l.DeliveryLongitude.Value,
                            label = l.DeliveryLocation ?? "Delivery",
                            type = "delivery",
                            sequence = 9999
                        });
                    }

                    return new
                    {
                        loadId = l.Id,
                        loadNumber = l.LoadNumber,
                        status = l.Status,
                        customerName = l.Customer?.Name,
                        vehicleReg = l.Vehicle?.RegistrationNumber,
                        driverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}" : null,
                        scheduledPickup = l.ScheduledPickupDate,
                        scheduledDelivery = l.ScheduledDeliveryDate,
                        waypoints
                    };
                })
                .Where(r => ((List<object>)r.waypoints).Count >= 2)
                .ToList();

                return Ok(routes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error building active load routes");
                return StatusCode(500, new { message = ex.Message });
            }
        }

        private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371000; // metres
            double dLat = (lat2 - lat1) * Math.PI / 180;
            double dLon = (lon2 - lon1) * Math.PI / 180;
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                       Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        }
    }
}
