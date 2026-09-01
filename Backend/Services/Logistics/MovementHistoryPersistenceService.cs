using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Persists CarTrack trips for each vehicle into VehicleMovementHistory so we
    /// build a permanent, back-datable movement history. Upserts are idempotent on
    /// the CarTrack trip id, so repeated runs never create duplicates.
    /// </summary>
    public interface IMovementHistoryPersistenceService
    {
        Task<int> PersistDayAsync(DateTime day, CancellationToken ct = default);
        Task<int> PersistVehicleDayAsync(int? vehicleId, string registration, DateTime day, IEnumerable<CarTrackTripData> trips, CancellationToken ct = default);
        Task<int> BackfillRangeAsync(DateTime from, DateTime to, MovementBackfillStatus? status = null, CancellationToken ct = default);
    }

    public class MovementHistoryPersistenceService : IMovementHistoryPersistenceService
    {
        private readonly ApplicationDbContext _context;
        private readonly ICarTrackService _carTrackService;
        private readonly ILogger<MovementHistoryPersistenceService> _logger;

        public MovementHistoryPersistenceService(
            ApplicationDbContext context,
            ICarTrackService carTrackService,
            ILogger<MovementHistoryPersistenceService> logger)
        {
            _context = context;
            _carTrackService = carTrackService;
            _logger = logger;
        }

        /// <summary>
        /// Fetch and persist CarTrack trips for all CarTrack-linked vehicles on the given day.
        /// Returns the number of new movement rows created.
        /// </summary>
        public async Task<int> PersistDayAsync(DateTime day, CancellationToken ct = default)
        {
            var targetDay = day.Date;
            var created = 0;
            var updated = 0;

            // Only vehicles linked to CarTrack have trip data
            var vehicles = await _context.Vehicles
                .Where(v => v.CarTrackId != null || v.CarTrackName != null)
                .Select(v => new { v.Id, v.RegistrationNumber })
                .ToListAsync(ct);

            if (vehicles.Count == 0)
            {
                _logger.LogDebug("No CarTrack-linked vehicles to persist movement history for.");
                return 0;
            }

            // Track upserts by CartrackTripId across the whole run. We look existing
            // rows up GLOBALLY (not just for this day) because CarTrack can return the
            // same trip id under an adjacent date (overnight/boundary trips). A global
            // unique index on CartrackTripId means a cross-day duplicate would otherwise
            // throw on SaveChanges and silently roll back the entire day.
            var existing = new Dictionary<long, VehicleMovementHistory>();

            foreach (var vehicle in vehicles)
            {
                ct.ThrowIfCancellationRequested();

                if (string.IsNullOrWhiteSpace(vehicle.RegistrationNumber))
                    continue;

                List<CarTrackTripData> trips;
                try
                {
                    trips = await _carTrackService.GetVehicleTripsAsync(vehicle.RegistrationNumber, targetDay);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CarTrack trip fetch failed for {Reg} on {Day}",
                        vehicle.RegistrationNumber, targetDay.ToString("yyyy-MM-dd"));
                    continue;
                }

                if (trips.Count == 0) continue;

                // Pull any already-saved rows for these trip ids (global) so we update
                // instead of inserting a duplicate.
                var ids = trips.Select(t => t.TripId).Distinct().ToList();
                var dbExisting = await _context.VehicleMovementHistory
                    .Where(m => ids.Contains(m.CartrackTripId))
                    .ToListAsync(ct);
                foreach (var e in dbExisting)
                    existing[e.CartrackTripId] = e;

                foreach (var t in trips)
                {
                    if (existing.TryGetValue(t.TripId, out var row))
                    {
                        // Refresh mutable fields (a trip in progress may extend during the day)
                        row.EndTimestamp = t.EndTimestamp;
                        row.EndLocation = t.EndLocation;
                        row.EndGeofence = t.EndGeofence;
                        row.EndLatitude = t.EndLatitude;
                        row.EndLongitude = t.EndLongitude;
                        row.TripDuration = t.TripDuration;
                        row.TripDurationSeconds = t.TripDurationSeconds;
                        row.TripDistance = t.TripDistance;
                        row.MaxSpeed = t.MaxSpeed;
                        row.HarshBrakingEvents = t.HarshBrakingEvents;
                        row.HarshCorneringEvents = t.HarshCorneringEvents;
                        row.HarshAccelerationEvents = t.HarshAccelerationEvents;
                        row.IdleTimeSeconds = t.IdleTimeSeconds;
                        row.UpdatedAt = DateTime.UtcNow;
                        updated++;
                    }
                    else
                    {
                        var newRow = new VehicleMovementHistory
                        {
                            VehicleId = vehicle.Id,
                            RegistrationNumber = vehicle.RegistrationNumber,
                            MovementDate = targetDay,
                            CartrackTripId = t.TripId,
                            StartTimestamp = t.StartTimestamp,
                            EndTimestamp = t.EndTimestamp,
                            TripDuration = t.TripDuration,
                            TripDurationSeconds = t.TripDurationSeconds,
                            StartLocation = t.StartLocation,
                            EndLocation = t.EndLocation,
                            StartGeofence = t.StartGeofence,
                            EndGeofence = t.EndGeofence,
                            StartLatitude = t.StartLatitude,
                            StartLongitude = t.StartLongitude,
                            EndLatitude = t.EndLatitude,
                            EndLongitude = t.EndLongitude,
                            TripDistance = t.TripDistance,
                            MaxSpeed = t.MaxSpeed,
                            HarshBrakingEvents = t.HarshBrakingEvents,
                            HarshCorneringEvents = t.HarshCorneringEvents,
                            HarshAccelerationEvents = t.HarshAccelerationEvents,
                            IdleTimeSeconds = t.IdleTimeSeconds,
                            CreatedAt = DateTime.UtcNow
                        };
                        _context.VehicleMovementHistory.Add(newRow);
                        existing[t.TripId] = newRow; // guard against dup ids within the same run
                        created++;
                    }
                }
            }

            if (created > 0 || updated > 0)
            {
                try
                {
                    await _context.SaveChangesAsync(ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "SaveChanges failed for {Day}; movement rows for that day were not persisted",
                        targetDay.ToString("yyyy-MM-dd"));
                    return 0;
                }
            }

            _logger.LogInformation("Movement history persisted for {Day}: {Created} new, {Updated} updated across {Vehicles} vehicles",
                targetDay.ToString("yyyy-MM-dd"), created, updated, vehicles.Count);

            return created;
        }

        /// <summary>
        /// Persist already-fetched trips for a single vehicle/day. Fast, non-blocking
        /// for the request path (does not re-hit CarTrack). Returns new rows created.
        /// </summary>
        public async Task<int> PersistVehicleDayAsync(int? vehicleId, string registration, DateTime day, IEnumerable<CarTrackTripData> trips, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(registration) || trips == null)
                return 0;

            var targetDay = day.Date;
            var tripList = trips.ToList();
            if (tripList.Count == 0) return 0;

            var tripIds = tripList.Select(t => t.TripId).ToList();
            var existing = await _context.VehicleMovementHistory
                .Where(m => tripIds.Contains(m.CartrackTripId))
                .ToDictionaryAsync(m => m.CartrackTripId, m => m, ct);

            var created = 0;
            foreach (var t in tripList)
            {
                if (existing.TryGetValue(t.TripId, out var row))
                {
                    row.EndTimestamp = t.EndTimestamp;
                    row.EndLocation = t.EndLocation;
                    row.EndGeofence = t.EndGeofence;
                    row.EndLatitude = t.EndLatitude;
                    row.EndLongitude = t.EndLongitude;
                    row.TripDuration = t.TripDuration;
                    row.TripDurationSeconds = t.TripDurationSeconds;
                    row.TripDistance = t.TripDistance;
                    row.MaxSpeed = t.MaxSpeed;
                    row.HarshBrakingEvents = t.HarshBrakingEvents;
                    row.HarshCorneringEvents = t.HarshCorneringEvents;
                    row.HarshAccelerationEvents = t.HarshAccelerationEvents;
                    row.IdleTimeSeconds = t.IdleTimeSeconds;
                    row.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _context.VehicleMovementHistory.Add(new VehicleMovementHistory
                    {
                        VehicleId = vehicleId,
                        RegistrationNumber = registration,
                        MovementDate = targetDay,
                        CartrackTripId = t.TripId,
                        StartTimestamp = t.StartTimestamp,
                        EndTimestamp = t.EndTimestamp,
                        TripDuration = t.TripDuration,
                        TripDurationSeconds = t.TripDurationSeconds,
                        StartLocation = t.StartLocation,
                        EndLocation = t.EndLocation,
                        StartGeofence = t.StartGeofence,
                        EndGeofence = t.EndGeofence,
                        StartLatitude = t.StartLatitude,
                        StartLongitude = t.StartLongitude,
                        EndLatitude = t.EndLatitude,
                        EndLongitude = t.EndLongitude,
                        TripDistance = t.TripDistance,
                        MaxSpeed = t.MaxSpeed,
                        HarshBrakingEvents = t.HarshBrakingEvents,
                        HarshCorneringEvents = t.HarshCorneringEvents,
                        HarshAccelerationEvents = t.HarshAccelerationEvents,
                        IdleTimeSeconds = t.IdleTimeSeconds,
                        CreatedAt = DateTime.UtcNow
                    });
                    created++;
                }
            }

            if (created > 0 || existing.Count > 0)
                await _context.SaveChangesAsync(ct);

            return created;
        }

        /// <summary>
        /// Walk a date range (inclusive) and persist each day's trips for every
        /// CarTrack-linked vehicle. RESUMABLE: days that already have saved movement
        /// rows are skipped, so a restart continues where it left off instead of
        /// re-doing work. Runs NEWEST-first so the most relevant recent legs fill in
        /// first. Idempotent. Optional status object is updated as it progresses.
        /// Returns total new rows created.
        /// </summary>
        public async Task<int> BackfillRangeAsync(DateTime from, DateTime to, MovementBackfillStatus? status = null, CancellationToken ct = default)
        {
            var start = from.Date;
            var end = to.Date;
            if (end < start) (start, end) = (end, start);

            // Which days already have saved movement data? Skip them on resume.
            // (Keep the two most-recent days refreshable — they may still be filling in.)
            var populatedDays = (await _context.VehicleMovementHistory
                    .Where(m => m.MovementDate >= start && m.MovementDate <= end)
                    .Select(m => m.MovementDate)
                    .Distinct()
                    .ToListAsync(ct))
                .Select(d => d.Date)
                .ToHashSet();

            var refreshableFloor = DateTime.UtcNow.Date.AddDays(-1); // today & yesterday always refreshed

            var totalCreated = 0;
            var skipped = 0;

            // Newest first: iterate end -> start.
            for (var day = end; day >= start; day = day.AddDays(-1))
            {
                ct.ThrowIfCancellationRequested();

                if (populatedDays.Contains(day) && day < refreshableFloor)
                {
                    skipped++;
                    status?.ReportDay(day, 0);
                    continue;
                }

                var created = 0;
                try
                {
                    created = await PersistDayAsync(day, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Backfill failed for {Day}", day.ToString("yyyy-MM-dd"));
                }
                totalCreated += created;
                status?.ReportDay(day, created);
            }

            _logger.LogInformation("Movement backfill {From}..{To} complete: {Created} new rows, {Skipped} days already had data",
                start.ToString("yyyy-MM-dd"), end.ToString("yyyy-MM-dd"), totalCreated, skipped);

            return totalCreated;
        }
    }
}
