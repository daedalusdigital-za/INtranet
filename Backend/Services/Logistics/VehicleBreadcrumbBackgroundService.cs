using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Records GPS breadcrumbs for every vehicle that is on an active load by polling CarTrack's live
    /// fleet status. CarTrack's API plan has no historical-positions endpoint, so this is the only way
    /// to reconstruct the route a vehicle actually drove and compare it with the planned trip sheet.
    ///
    /// A point is stored only when CarTrack reports a new fix (event timestamp changed), so a parked
    /// vehicle does not generate duplicate rows. Points are tagged with the load the vehicle is
    /// assigned to at the time of capture.
    ///
    /// Config:
    ///   VehicleBreadcrumbs:Enabled          (bool, default true)
    ///   VehicleBreadcrumbs:IntervalSeconds  (int, default 90, min 30)
    ///   VehicleBreadcrumbs:RetentionDays    (int, default 120)
    /// </summary>
    public class VehicleBreadcrumbBackgroundService : BackgroundService
    {
        private static readonly string[] LiveStatuses = { "Assigned", "In Transit", "InTransit", "Dispatched" };

        private readonly IServiceProvider _sp;
        private readonly ILogger<VehicleBreadcrumbBackgroundService> _logger;
        private readonly IConfiguration _cfg;
        private DateTime _lastPurge = DateTime.MinValue;

        public VehicleBreadcrumbBackgroundService(IServiceProvider sp, ILogger<VehicleBreadcrumbBackgroundService> logger, IConfiguration cfg)
        {
            _sp = sp; _logger = logger; _cfg = cfg;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_cfg.GetValue("VehicleBreadcrumbs:Enabled", true))
            {
                _logger.LogInformation("Vehicle breadcrumb logging disabled.");
                return;
            }
            var seconds = Math.Max(30, _cfg.GetValue("VehicleBreadcrumbs:IntervalSeconds", 90));
            _logger.LogInformation("Vehicle breadcrumb logger starting (every {Seconds}s)", seconds);

            try { await Task.Delay(TimeSpan.FromSeconds(50), stoppingToken); } catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try { await TickAsync(stoppingToken); }
                catch (OperationCanceledException) { break; }
                catch (Exception ex) { _logger.LogError(ex, "Breadcrumb tick failed"); }

                try { await Task.Delay(TimeSpan.FromSeconds(seconds), stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }

        private async Task TickAsync(CancellationToken ct)
        {
            using var scope = _sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var cartrack = scope.ServiceProvider.GetRequiredService<ICarTrackService>();

            // Vehicles with a live load whose pickup day has arrived (SAST). A trip sheet for tomorrow that is
            // already "Assigned" must NOT claim today's movements — that made yesterday's driving show up
            // against today's trip sheet. A vehicle on several eligible loads is tagged with the most recent one.
            var today = DateTime.UtcNow.AddHours(2).Date;
            var liveLoads = await db.Loads.AsNoTracking()
                .Where(l => l.VehicleId != null && LiveStatuses.Contains(l.Status))
                .Select(l => new { l.Id, VehicleId = l.VehicleId!.Value, l.ScheduledPickupDate, l.ScheduledDeliveryDate, l.CreatedAt })
                .ToListAsync(ct);
            liveLoads = liveLoads
                .Where(l => (l.ScheduledPickupDate ?? l.ScheduledDeliveryDate ?? l.CreatedAt.AddHours(2)).Date <= today)
                .ToList();
            if (liveLoads.Count == 0) return;

            var loadByVehicle = liveLoads
                .GroupBy(l => l.VehicleId)
                .ToDictionary(g => g.Key, g => g
                    .OrderByDescending(l => (l.ScheduledPickupDate ?? l.ScheduledDeliveryDate ?? l.CreatedAt.AddHours(2)).Date)
                    .ThenByDescending(l => l.Id)
                    .First().Id);

            var vehicleIds = loadByVehicle.Keys.ToList();
            var vehicles = await db.Vehicles.AsNoTracking()
                .Where(v => vehicleIds.Contains(v.Id) && v.CarTrackId != null)
                .Select(v => new { v.Id, v.CarTrackId, v.RegistrationNumber })
                .ToListAsync(ct);
            if (vehicles.Count == 0) return;

            var live = await cartrack.GetAllVehicleLocationsAsync();
            if (live.Count == 0) return;
            var liveById = live.Where(l => !string.IsNullOrEmpty(l.VehicleId)).ToDictionary(l => l.VehicleId, l => l);
            var liveByReg = live.Where(l => !string.IsNullOrEmpty(l.RegistrationNumber))
                .GroupBy(l => l.RegistrationNumber!.ToUpperInvariant()).ToDictionary(g => g.Key, g => g.First());

            // Last stored fix per vehicle so we only insert new ones
            var lastFix = await db.VehiclePositionLogs
                .Where(p => vehicleIds.Contains(p.VehicleId))
                .GroupBy(p => p.VehicleId)
                .Select(g => new { VehicleId = g.Key, Last = g.Max(p => p.RecordedAt) })
                .ToDictionaryAsync(x => x.VehicleId, x => x.Last, ct);

            var added = 0;
            foreach (var v in vehicles)
            {
                if (!liveById.TryGetValue(v.CarTrackId!, out var fix) &&
                    !(v.RegistrationNumber != null && liveByReg.TryGetValue(v.RegistrationNumber.ToUpperInvariant(), out fix)))
                    continue;
                if (fix.Location == null || (fix.Location.Latitude == 0 && fix.Location.Longitude == 0)) continue;

                var at = ToUtc(fix.Location.Updated != default ? fix.Location.Updated : fix.LastUpdate ?? DateTime.UtcNow);
                if (lastFix.TryGetValue(v.Id, out var last) && at <= last) continue;

                db.VehiclePositionLogs.Add(new VehiclePositionLog
                {
                    VehicleId = v.Id,
                    LoadId = loadByVehicle[v.Id],
                    RecordedAt = at,
                    Latitude = fix.Location.Latitude,
                    Longitude = fix.Location.Longitude,
                    Speed = (int)Math.Round(fix.Speed),
                    Bearing = (int)Math.Round(fix.Heading),
                    Ignition = fix.Status is "Moving" or "Idling" ? true : fix.Status == "Stopped" ? false : null,
                    Address = fix.Location.Address?.Length > 300 ? fix.Location.Address[..300] : fix.Location.Address,
                    CreatedAt = DateTime.UtcNow
                });
                added++;
            }
            if (added > 0)
            {
                try { await db.SaveChangesAsync(ct); }
                catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("IX_VehiclePositionLogs_VehicleId_RecordedAt") == true)
                {
                    // raced with another instance — harmless
                }
                _logger.LogDebug("Breadcrumbs: {Added} points for {Vehicles} vehicles on live loads", added, vehicles.Count);
            }

            // Daily purge of old points not attached to a load
            if ((DateTime.UtcNow - _lastPurge).TotalHours >= 24)
            {
                var keepDays = Math.Max(14, _cfg.GetValue("VehicleBreadcrumbs:RetentionDays", 120));
                var cutoff = DateTime.UtcNow.AddDays(-keepDays);
                await db.VehiclePositionLogs.Where(p => p.LoadId == null && p.RecordedAt < cutoff).ExecuteDeleteAsync(ct);
                _lastPurge = DateTime.UtcNow;
            }
        }

        private static DateTime ToUtc(DateTime dt) => dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            // CarTrack timestamps carry +02; DateTime.Parse without a zone makes them Local, but if a parser
            // produced Unspecified treat it as SAST.
            _ => DateTime.SpecifyKind(dt.AddHours(-2), DateTimeKind.Utc)
        };
    }
}
