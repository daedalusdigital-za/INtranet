using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Always-on background monitor that polls the whole fleet every minute — 24/7,
    /// independently of whether anyone has the Controller / Open Map screen open — and
    /// records incidents (speeding, curfew movement, warehouse geofence exit) into the
    /// daily Reports log for ALL vehicles across the WHOLE day.
    ///
    /// This is the single source of truth for incident recording. The live
    /// ControllerMonitoringController only renders the current snapshot; it no longer
    /// writes incidents (which prevents duplicates and guarantees round-the-clock cover).
    /// </summary>
    public class IncidentMonitoringService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<IncidentMonitoringService> _logger;

        // Poll cadence for the fleet.
        private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(60);

        // Curfew window (local SAST). Vehicles should be parked between these hours.
        private const int CurfewStartHour = 18; // 18:00
        private const int CurfewEndHour = 5;     // 05:00

        // Speed (km/h) at or above which a vehicle is flagged as speeding.
        private const double SpeedingThreshold = 90;

        // Per-vehicle dedup / tracking state (survives across ticks).
        private static readonly ConcurrentDictionary<string, VehicleState> _state = new();

        public IncidentMonitoringService(
            IServiceScopeFactory scopeFactory,
            ILogger<IncidentMonitoringService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("IncidentMonitoringService started — polling fleet every {Seconds}s (24/7).", PollInterval.TotalSeconds);

            // Small initial delay so the app finishes starting up.
            try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
            catch (TaskCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PollOnceAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "IncidentMonitoringService poll failed");
                }

                try { await Task.Delay(PollInterval, stoppingToken); }
                catch (TaskCanceledException) { break; }
            }

            _logger.LogInformation("IncidentMonitoringService stopping.");
        }

        private async Task PollOnceAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var carTrack = scope.ServiceProvider.GetRequiredService<ICarTrackService>();

            // SAST = UTC+2
            var nowSast = DateTime.UtcNow.AddHours(2);
            var inCurfew = IsWithinCurfew(nowSast.Hour);

            var fleet = await carTrack.GetFleetStatusAsync();
            if (fleet?.Vehicles == null || fleet.Vehicles.Count == 0)
                return;

            var localVehicles = await db.Vehicles
                .Include(v => v.CurrentDriver)
                .Where(v => v.CarTrackId != null)
                .ToListAsync(ct);

            var parkingZones = await db.Geofences
                .Where(g => g.IsActive && (g.Type == "Parking" || g.Type == "Depot"))
                .ToListAsync(ct);

            int newIncidents = 0;

            foreach (var v in fleet.Vehicles)
            {
                var local = localVehicles.FirstOrDefault(lv => lv.CarTrackId == v.VehicleId);
                var reg = v.RegistrationNumber ?? local?.RegistrationNumber ?? v.VehicleName ?? v.VehicleId;
                var driver = v.CurrentDriverName
                    ?? (local?.CurrentDriver != null ? $"{local.CurrentDriver.FirstName} {local.CurrentDriver.LastName}".Trim() : null);

                var lat = v.Location?.Latitude ?? 0;
                var lng = v.Location?.Longitude ?? 0;
                var address = v.Location?.Address;
                var isMoving = v.Status == "moving" || v.Speed > 3;

                var state = _state.GetOrAdd(reg, _ => new VehicleState());

                // ── Speeding: ALL DAY, ALL CARS ──
                if (RecordSpeeding(db, state, reg, driver, v.Speed, lat, lng, address, inCurfew, nowSast))
                    newIncidents++;

                // ── Curfew movement: only during curfew hours ──
                if (inCurfew && isMoving && RecordCurfewMovement(db, state, reg, driver, v.Speed, lat, lng, address, nowSast))
                    newIncidents++;

                // ── Warehouse geofence exit: only during curfew hours ──
                if (parkingZones.Count > 0 && lat != 0 && lng != 0)
                {
                    if (TrackGeofence(db, state, reg, driver, lat, lng, parkingZones, inCurfew, nowSast, address))
                        newIncidents++;
                }
            }

            if (newIncidents > 0)
            {
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("IncidentMonitoringService recorded {Count} new incident(s).", newIncidents);
            }
        }

        // ── Speeding (rising edge, re-arms below threshold-10, throttled 1 per 10 min) ──
        private static bool RecordSpeeding(
            ApplicationDbContext db, VehicleState state, string reg, string? driver,
            double speed, double lat, double lng, string? address, bool inCurfew, DateTime nowSast)
        {
            if (speed >= SpeedingThreshold)
            {
                var throttled = state.LastSpeedingLogUtc.HasValue &&
                                DateTime.UtcNow.Subtract(state.LastSpeedingLogUtc.Value).TotalMinutes < 10;
                if (state.SpeedingArmed && !throttled)
                {
                    state.SpeedingArmed = false;
                    state.LastSpeedingLogUtc = DateTime.UtcNow;
                    db.LogisticsIncidents.Add(new LogisticsIncident
                    {
                        Type = "Speeding",
                        Severity = speed >= 120 ? "High" : "Medium",
                        Registration = reg,
                        Driver = driver,
                        Latitude = lat != 0 ? (decimal)lat : null,
                        Longitude = lng != 0 ? (decimal)lng : null,
                        Address = address,
                        Speed = Math.Round(speed, 1),
                        DuringCurfew = inCurfew,
                        Details = $"{reg} recorded {Math.Round(speed)} km/h (limit {SpeedingThreshold}).",
                        // Speeding is a whole-day event: attribute it to the actual calendar day.
                        IncidentDate = nowSast.Date,
                        OccurredAtSast = nowSast
                    });
                    return true;
                }
            }
            else if (speed < SpeedingThreshold - 10)
            {
                state.SpeedingArmed = true; // re-arm once clearly slowed
            }
            return false;
        }

        // ── Curfew movement (once per vehicle per overnight shift) ──
        private static bool RecordCurfewMovement(
            ApplicationDbContext db, VehicleState state, string reg, string? driver,
            double speed, double lat, double lng, string? address, DateTime nowSast)
        {
            var shift = CurfewShiftDate(nowSast).ToString("yyyy-MM-dd");
            if (state.CurfewMovementLoggedShift == shift) return false;

            state.CurfewMovementLoggedShift = shift;
            db.LogisticsIncidents.Add(new LogisticsIncident
            {
                Type = "CurfewMovement",
                Severity = "High",
                Registration = reg,
                Driver = driver,
                Latitude = lat != 0 ? (decimal)lat : null,
                Longitude = lng != 0 ? (decimal)lng : null,
                Address = address,
                Speed = Math.Round(speed, 1),
                DuringCurfew = true,
                Details = $"{reg} was moving during curfew hours.",
                IncidentDate = CurfewShiftDate(nowSast),
                OccurredAtSast = nowSast
            });
            return true;
        }

        // ── Warehouse geofence exit during curfew ──
        private static bool TrackGeofence(
            ApplicationDbContext db, VehicleState state, string reg, string? driver,
            double lat, double lng, List<Geofence> parkingZones, bool inCurfew, DateTime nowSast, string? address)
        {
            // Find nearest parking/depot zone and whether the vehicle is outside all of them.
            bool outsideParking = true;
            string? nearestZone = null;
            double nearestDist = double.MaxValue;
            foreach (var z in parkingZones)
            {
                var d = HaversineMeters(lat, lng, (double)z.Latitude, (double)z.Longitude);
                if (d < nearestDist) { nearestDist = d; nearestZone = z.Name; }
                if (d <= z.RadiusMeters) { outsideParking = false; }
            }

            if (!inCurfew)
            {
                // Outside curfew, reset the overnight arm state.
                state.GeofenceArmed = false;
                state.GeofenceBreachActive = false;
                return false;
            }

            // Arm while still before curfew start and parked inside a zone.
            if (nowSast.Hour < CurfewStartHour && !outsideParking)
            {
                state.GeofenceArmed = true;
                state.HomeZoneName = nearestZone;
                state.GeofenceBreachActive = false;
                return false;
            }

            if (!state.GeofenceArmed) return false;

            if (outsideParking)
            {
                if (!state.GeofenceBreachActive)
                {
                    state.GeofenceBreachActive = true;
                    db.LogisticsIncidents.Add(new LogisticsIncident
                    {
                        Type = "GeofenceExit",
                        Severity = "High",
                        Registration = reg,
                        Driver = driver,
                        Latitude = (decimal)lat,
                        Longitude = (decimal)lng,
                        Address = address,
                        Zone = state.HomeZoneName ?? nearestZone,
                        DistanceMeters = nearestDist == double.MaxValue ? null : Math.Round(nearestDist),
                        DuringCurfew = true,
                        Details = $"{reg} left {(state.HomeZoneName ?? "its warehouse geofence")} during curfew.",
                        IncidentDate = CurfewShiftDate(nowSast),
                        OccurredAtSast = nowSast
                    });
                    return true;
                }
            }
            else if (state.GeofenceBreachActive)
            {
                state.GeofenceBreachActive = false;
                state.GeofenceArmed = false; // one overnight cycle complete
            }
            return false;
        }

        // ── Helpers ──
        private static bool IsWithinCurfew(int hour)
        {
            // Curfew wraps midnight: 18:00 → 05:00.
            return hour >= CurfewStartHour || hour < CurfewEndHour;
        }

        /// <summary>The SAST date an overnight-shift incident belongs to. Early-morning
        /// incidents (before curfew end) are attributed to the previous day so a single
        /// overnight shift stays on one report.</summary>
        private static DateTime CurfewShiftDate(DateTime nowSast)
        {
            return nowSast.Hour < CurfewEndHour
                ? nowSast.Date.AddDays(-1)
                : nowSast.Date;
        }

        private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371000; // metres
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLon = (lon2 - lon1) * Math.PI / 180;
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        }

        private sealed class VehicleState
        {
            // Speeding
            public bool SpeedingArmed { get; set; } = true;
            public DateTime? LastSpeedingLogUtc { get; set; }
            // Curfew movement
            public string? CurfewMovementLoggedShift { get; set; }
            // Geofence
            public bool GeofenceArmed { get; set; }
            public bool GeofenceBreachActive { get; set; }
            public string? HomeZoneName { get; set; }
        }
    }
}
