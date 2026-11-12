using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TrackingController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ICarTrackService _carTrackService;
        private readonly ILogger<TrackingController> _logger;

        public TrackingController(
            ApplicationDbContext context,
            ICarTrackService carTrackService,
            ILogger<TrackingController> logger)
        {
            _context = context;
            _carTrackService = carTrackService;
            _logger = logger;
        }

        [Authorize]
        [HttpGet("test-cartrack")]
        public async Task<ActionResult> TestCarTrackConnection()
        {
            try
            {
                var status = await _carTrackService.GetFleetStatusAsync();
                return Ok(new { 
                    success = true, 
                    message = "CarTrack connection successful",
                    totalVehicles = status.TotalVehicles,
                    moving = status.VehiclesMoving,
                    stopped = status.VehiclesStopped,
                    idling = status.VehiclesIdling,
                    offline = status.VehiclesOffline
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CarTrack test failed");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("fleet-status")]
        public async Task<ActionResult<FleetStatusDto>> GetFleetStatus()
        {
            try
            {
                var status = await _carTrackService.GetFleetStatusAsync();

                // Match with local vehicles
                var vehicles = await _context.Vehicles
                    .Include(v => v.CurrentDriver)
                    .Where(v => v.CarTrackId != null)
                    .ToListAsync();

                foreach (var vehicleLocation in status.Vehicles)
                {
                    var localVehicle = vehicles.FirstOrDefault(v => v.CarTrackId == vehicleLocation.VehicleId);
                    if (localVehicle != null)
                    {
                        vehicleLocation.LocalVehicleId = localVehicle.Id;
                        vehicleLocation.RegistrationNumber = localVehicle.RegistrationNumber;
                    }
                }

                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting fleet status");
                return StatusCode(500, "Error retrieving fleet status");
            }
        }

        [HttpGet("vehicle/{vehicleId}/location")]
        public async Task<ActionResult<VehicleLocationDto>> GetVehicleLocation(int vehicleId)
        {
            try
            {
                var vehicle = await _context.Vehicles.FindAsync(vehicleId);
                if (vehicle == null)
                    return NotFound("Vehicle not found");

                if (string.IsNullOrEmpty(vehicle.CarTrackId))
                    return BadRequest("Vehicle does not have CarTrack integration configured");

                var location = await _carTrackService.GetVehicleLocationAsync(vehicle.CarTrackId);
                if (location == null)
                    return NotFound("Vehicle location not available from CarTrack");

                location.LocalVehicleId = vehicle.Id;
                location.RegistrationNumber = vehicle.RegistrationNumber;

                return Ok(location);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting location for vehicle {vehicleId}");
                return StatusCode(500, "Error retrieving vehicle location");
            }
        }

        [HttpGet("load/{loadId}/track")]
        public async Task<ActionResult<TripTrackingDto>> TrackLoad(int loadId)
        {
            try
            {
                var load = await _context.Loads
                    .Include(l => l.Vehicle)
                    .Include(l => l.Driver)
                    .Include(l => l.Stops.OrderBy(s => s.StopSequence))
                    .FirstOrDefaultAsync(l => l.Id == loadId);

                if (load == null)
                    return NotFound("Load not found");

                if (load.VehicleId == null)
                    return BadRequest("Load does not have a vehicle assigned");

                if (string.IsNullOrEmpty(load.Vehicle?.CarTrackId))
                    return BadRequest("Assigned vehicle does not have CarTrack integration");

                // Get current location from CarTrack
                var location = await _carTrackService.GetVehicleLocationAsync(load.Vehicle.CarTrackId);
                if (location == null)
                    return NotFound("Vehicle location not available");

                // Find next stop
                var nextStop = load.Stops
                    .Where(s => s.Status == "Pending")
                    .OrderBy(s => s.StopSequence)
                    .FirstOrDefault();

                var tracking = new TripTrackingDto
                {
                    LoadId = load.Id,
                    LoadNumber = load.LoadNumber,
                    VehicleId = load.VehicleId.Value,
                    VehicleRegistration = load.Vehicle.RegistrationNumber,
                    DriverName = load.Driver != null ? $"{load.Driver.FirstName} {load.Driver.LastName}" : null,
                    CurrentLocation = location,
                    Stops = load.Stops.Select(s => new LoadStopDto
                    {
                        Id = s.Id,
                        StopSequence = s.StopSequence,
                        StopType = s.StopType,
                        LocationName = s.LocationName,
                        Address = s.Address,
                        City = s.City,
                        PostalCode = s.PostalCode,
                        Latitude = s.Latitude,
                        Longitude = s.Longitude,
                        ContactPerson = s.ContactPerson,
                        ContactPhone = s.ContactPhone,
                        ScheduledArrival = s.ScheduledArrival,
                        ActualArrival = s.ActualArrival,
                        ActualDeparture = s.ActualDeparture,
                        Status = s.Status,
                        Notes = s.Notes
                    }).ToList(),
                    NextStop = nextStop != null ? new LoadStopDto
                    {
                        Id = nextStop.Id,
                        StopSequence = nextStop.StopSequence,
                        StopType = nextStop.StopType,
                        LocationName = nextStop.LocationName,
                        Address = nextStop.Address,
                        City = nextStop.City,
                        Latitude = nextStop.Latitude,
                        Longitude = nextStop.Longitude,
                        Status = nextStop.Status
                    } : null,
                    TripStatus = load.Status
                };

                // Calculate distance to next stop if available
                if (nextStop?.Latitude != null && nextStop.Longitude != null &&
                    location?.Location != null)
                {
                    tracking.DistanceToNextStop = CalculateDistance(
                        location.Location.Latitude,
                        location.Location.Longitude,
                        (double)nextStop.Latitude.Value,
                        (double)nextStop.Longitude.Value
                    );

                    // Estimate ETA based on current speed (if moving)
                    if (location.Speed > 0)
                    {
                        var hours = tracking.DistanceToNextStop / location.Speed;
                        tracking.EtaToNextStop = TimeSpan.FromHours(hours ?? 0);
                    }
                }

                return Ok(tracking);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error tracking load {loadId}");
                return StatusCode(500, "Error tracking load");
            }
        }

        [HttpGet("active-loads")]
        public async Task<ActionResult<IEnumerable<LoadDto>>> GetActiveLoads()
        {
            var activeLoads = await _context.Loads
                .Include(l => l.Customer)
                .Include(l => l.Vehicle)
                .Include(l => l.Driver)
                .Include(l => l.Warehouse)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Customer)
                .Where(l => l.Status == "In Transit" || l.Status == "Assigned")
                .OrderByDescending(l => l.ScheduledPickupDate ?? l.ScheduledDeliveryDate ?? l.CreatedAt)
                .Select(l => new LoadDto
                {
                    Id = l.Id,
                    LoadNumber = l.LoadNumber,
                    CustomerId = l.CustomerId,
                    CustomerName = l.Customer != null ? l.Customer.Name : 
                                   (l.Stops != null && l.Stops.Any()) ? 
                                   l.Stops.OrderBy(s => s.StopSequence).First().CompanyName : 
                                   "No Customer",
                    WarehouseId = l.WarehouseId,
                    WarehouseName = l.Warehouse != null ? l.Warehouse.Name : null,
                    VehicleId = l.VehicleId,
                    VehicleRegistration = l.Vehicle != null ? l.Vehicle.RegistrationNumber : null,
                    DriverId = l.DriverId,
                    DriverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}" : null,
                    Status = l.Status,
                    PickupLocation = l.PickupLocation,
                    DeliveryLocation = l.DeliveryLocation,
                    ScheduledPickupDate = l.ScheduledPickupDate,
                    ScheduledDeliveryDate = l.ScheduledDeliveryDate,
                    CreatedAt = l.CreatedAt
                })
                .ToListAsync();

            return Ok(activeLoads);
        }

        // ═══ GET: the route a load's vehicle ACTUALLY drove, to compare against the planned trip sheet ═══
        // Sources: (1) our own GPS breadcrumbs (VehiclePositionLogs, captured every ~90s while the load is live),
        // (2) CarTrack trip segments (VehicleMovementHistory) — every ignition-on→off leg with start/end points,
        // which tells us where the vehicle actually stopped. Each planned stop is checked for a visit.
        [HttpGet("load/{loadId}/actual-route")]
        public async Task<ActionResult<object>> GetActualRoute(int loadId, [FromQuery] double visitRadiusKm = 0.6)
        {
            var load = await _context.Loads.AsNoTracking()
                .Include(l => l.Vehicle)
                .Include(l => l.Warehouse)
                .Include(l => l.Stops.OrderBy(s => s.StopSequence))
                .FirstOrDefaultAsync(l => l.Id == loadId);
            if (load == null) return NotFound(new { message = "Load not found" });
            if (load.VehicleId == null) return Ok(new { loadId, hasData = false, message = "No vehicle assigned to this load" });

            // Window (SAST days): from the scheduled pickup day (falling back to creation day), to the later of
            // delivery / today. Driving before the pickup day is other work, not this load, so it is excluded
            // even if the breadcrumb logger tagged those fixes with this load while it sat in "Assigned".
            var sast = TimeSpan.FromHours(2);
            var todayLocal = DateTime.UtcNow.Add(sast).Date;
            var createdLocal = load.CreatedAt.Add(sast).Date;
            var pickupLocal = load.ScheduledPickupDate?.Date ?? createdLocal;
            var startLocal = pickupLocal;
            var endCandidate = (load.ActualDeliveryDate ?? load.ScheduledDeliveryDate ?? load.ScheduledPickupDate)?.Date ?? todayLocal;
            var endLocal = (endCandidate > todayLocal ? todayLocal : endCandidate);
            if (endLocal < startLocal) endLocal = startLocal;
            endLocal = endLocal.AddDays(1);
            var fromUtc = startLocal - sast;
            var toUtc = endLocal - sast;

            var crumbs = await _context.VehiclePositionLogs.AsNoTracking()
                .Where(p => p.VehicleId == load.VehicleId && p.RecordedAt >= fromUtc && p.RecordedAt < toUtc)
                .OrderBy(p => p.RecordedAt)
                .Select(p => new { t = p.RecordedAt, lat = p.Latitude, lng = p.Longitude, speed = p.Speed, address = p.Address })
                .ToListAsync();

            var reg = load.Vehicle?.RegistrationNumber ?? "";
            var segStart = startLocal;
            var days = Enumerable.Range(0, Math.Max(0, (int)(endLocal - segStart).TotalDays)).Select(i => segStart.AddDays(i)).ToList();
            var segments = await _context.VehicleMovementHistory.AsNoTracking()
                .Where(m => (m.VehicleId == load.VehicleId || m.RegistrationNumber == reg) && days.Contains(m.MovementDate))
                .OrderBy(m => m.StartTimestamp)
                .Select(m => new
                {
                    m.CartrackTripId,
                    start = m.StartTimestamp, end = m.EndTimestamp,
                    startLat = m.StartLatitude, startLng = m.StartLongitude, startLocation = m.StartLocation,
                    endLat = m.EndLatitude, endLng = m.EndLongitude, endLocation = m.EndLocation,
                    distanceKm = Math.Round(m.TripDistance / 1000.0, 1),
                    durationSec = m.TripDurationSeconds, maxSpeed = m.MaxSpeed,
                    harsh = m.HarshBrakingEvents + m.HarshCorneringEvents + m.HarshAccelerationEvents,
                    idleSec = m.IdleTimeSeconds
                })
                .ToListAsync();
            segments = segments.Where(s => !(s.startLat == 0 && s.startLng == 0)).ToList();

            // Every point we know the vehicle was at, in time order
            var actualPoints = new List<(DateTime t, double lat, double lng, string src)>();
            foreach (var c in crumbs) actualPoints.Add((c.t, c.lat, c.lng, "gps"));
            foreach (var s in segments)
            {
                if (TryParseCt(s.start, out var st)) actualPoints.Add((st, s.startLat, s.startLng, "trip-start"));
                if (TryParseCt(s.end, out var en) && !(s.endLat == 0 && s.endLng == 0)) actualPoints.Add((en, s.endLat, s.endLng, "trip-end"));
            }
            actualPoints = actualPoints.OrderBy(p => p.t).ToList();

            // Planned stops: were they visited?  (closest actual point within the radius)
            var stops = load.Stops.Where(s => s.StopType != "Pickup").OrderBy(s => s.StopSequence).ToList();
            var stopResults = new List<object>();
            var visitedCount = 0;
            var visitOrder = new List<(int seq, DateTime at)>();
            foreach (var s in stops)
            {
                if (s.Latitude == null || s.Longitude == null)
                {
                    stopResults.Add(new { s.Id, s.StopSequence, name = s.CompanyName ?? s.LocationName, s.Address, s.City, s.Latitude, s.Longitude, visited = (bool?)null, reason = "Stop has no coordinates" });
                    continue;
                }
                var lat = (double)s.Latitude.Value; var lng = (double)s.Longitude.Value;
                (DateTime t, double km, string src)? best = null;
                foreach (var p in actualPoints)
                {
                    var km = CalculateDistance(lat, lng, p.lat, p.lng);
                    if (best == null || km < best.Value.km) best = (p.t, km, p.src);
                }
                // Dwell: how long the vehicle stayed within the radius around the closest pass
                int? dwellMin = null;
                if (best != null && best.Value.km <= visitRadiusKm)
                {
                    var near = actualPoints.Where(p => CalculateDistance(lat, lng, p.lat, p.lng) <= visitRadiusKm).Select(p => p.t).ToList();
                    if (near.Count > 1) dwellMin = (int)Math.Round((near.Max() - near.Min()).TotalMinutes);
                    visitOrder.Add((s.StopSequence, near.Min()));
                    visitedCount++;
                }
                stopResults.Add(new
                {
                    s.Id, s.StopSequence, name = s.CompanyName ?? s.LocationName, s.Address, s.City, s.Latitude, s.Longitude, s.Status, s.ActualArrival,
                    visited = best != null && best.Value.km <= visitRadiusKm,
                    closestKm = best == null ? (double?)null : Math.Round(best.Value.km, 2),
                    closestAt = best?.t,
                    dwellMinutes = dwellMin,
                    reason = best == null ? "No tracking data yet" : best.Value.km <= visitRadiusKm ? null : $"Closest pass was {best.Value.km:0.0} km away"
                });
            }

            // Sequence check — did they visit in the planned order?
            var actualSeq = visitOrder.OrderBy(v => v.at).Select(v => v.seq).ToList();
            var plannedSeq = stops.Select(s => s.StopSequence).Where(seq => actualSeq.Contains(seq)).ToList();
            var outOfOrder = !actualSeq.SequenceEqual(plannedSeq);

            // Unplanned stops: trip-segment end points (vehicle switched off) that aren't near any planned stop or a depot.
            // Depot = the warehouse pin, plus wherever the vehicle began its day (warehouse pins are approximate).
            var depots = new List<(double lat, double lng)>();
            if (load.Warehouse?.Latitude != null && load.Warehouse?.Longitude != null) depots.Add(((double)load.Warehouse.Latitude.Value, (double)load.Warehouse.Longitude.Value));
            var firstSeg = segments.FirstOrDefault();
            if (firstSeg != null) depots.Add((firstSeg.startLat, firstSeg.startLng));
            var depotRadius = Math.Max(visitRadiusKm, 1.0);
            var unplanned = segments
                .Where(s => !(s.endLat == 0 && s.endLng == 0))
                .Where(s => s.distanceKm > 0.2 || s.durationSec > 120) // ignore 30-second ignition blips at the same spot
                .Where(s => !stops.Any(st => st.Latitude != null && CalculateDistance((double)st.Latitude!.Value, (double)st.Longitude!.Value, s.endLat, s.endLng) <= visitRadiusKm))
                .Where(s => !depots.Any(d => CalculateDistance(d.lat, d.lng, s.endLat, s.endLng) <= depotRadius))
                .Select(s => new { at = s.end, lat = s.endLat, lng = s.endLng, location = s.endLocation })
                .ToList();

            var actualKm = segments.Sum(s => s.distanceKm);
            var plannedKm = load.EstimatedDistance;

            return Ok(new
            {
                loadId, load.LoadNumber, vehicleId = load.VehicleId, registration = reg,
                hasData = actualPoints.Count > 0,
                window = new { fromUtc, toUtc },
                breadcrumbs = crumbs,
                segments,
                stops = stopResults,
                summary = new
                {
                    plannedStops = stops.Count,
                    visitedStops = visitedCount,
                    outOfOrder,
                    actualSequence = actualSeq,
                    unplannedStops = unplanned,
                    actualDistanceKm = Math.Round(actualKm, 1),
                    plannedDistanceKm = plannedKm,
                    distanceVarianceKm = plannedKm == null ? (double?)null : Math.Round(actualKm - (double)plannedKm.Value, 1),
                    harshEvents = segments.Sum(s => s.harsh),
                    maxSpeed = segments.Count == 0 ? 0 : segments.Max(s => s.maxSpeed),
                    idleMinutes = (int)Math.Round(segments.Sum(s => s.idleSec) / 60.0),
                    breadcrumbCount = crumbs.Count,
                    segmentCount = segments.Count,
                    visitRadiusKm
                }
            });
        }

        /// <summary>CarTrack timestamps look like "2026-11-02 05:21:19+02".</summary>
        private static bool TryParseCt(string? s, out DateTime utc)
        {
            utc = default;
            if (string.IsNullOrWhiteSpace(s)) return false;
            if (DateTimeOffset.TryParse(s, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out var dto))
            { utc = dto.UtcDateTime; return true; }
            return false;
        }

        // Haversine formula to calculate distance between two GPS coordinates
        private double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371; // Earth's radius in kilometers

            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);

            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            var distance = R * c;

            return distance;
        }

        private double ToRadians(double degrees)
        {
            return degrees * Math.PI / 180;
        }
    }
}
