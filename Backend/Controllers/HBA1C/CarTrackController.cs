using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.HBA1C;
using ProjectTracker.API.Models.Projects;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.HBA1C;

namespace ProjectTracker.API.Controllers.HBA1C
{
    [Authorize]
    [ApiController]
    [Route("api/hba1c/car-track")]
    public class CarTrackController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CarTrackController> _logger;
        private readonly ICarTrackService _carTrackService;
        private readonly IHBA1CApiService _hba1cApi;

        // HBA1C Sales Rep vehicles — registration → (unitId, driverName)
        private static readonly Dictionary<string, (string UnitId, string DriverName)> TrackedVehicles = new()
        {
            { "LP30YGGP", ("DJ76VFZN", "Lindani Zitha") },
            { "LP30XPGP", ("DJ76WCZN", "Deon") },
            { "LP30XVGP", ("DJ78VWZN", "Ziba Mthethwa") },
            { "BS72YKZN", ("BS72YKZN", "Dylan Govender") }
        };

        public CarTrackController(ApplicationDbContext context, ILogger<CarTrackController> logger, ICarTrackService carTrackService, IHBA1CApiService hba1cApi)
        {
            _context = context;
            _logger = logger;
            _carTrackService = carTrackService;
            _hba1cApi = hba1cApi;
        }

        /// <summary>
        /// Get all car track entries with optional filters
        /// </summary>
        [HttpGet]
        public async Task<ActionResult> GetAll(
            [FromQuery] string? salesRep = null,
            [FromQuery] string? province = null,
            [FromQuery] string? status = null,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? search = null)
        {
            try
            {
                var query = _context.CarTrackEntries.AsQueryable();

                if (!string.IsNullOrWhiteSpace(salesRep))
                    query = query.Where(e => e.SalesRepName == salesRep);

                if (!string.IsNullOrWhiteSpace(province))
                    query = query.Where(e => e.Province == province);

                if (!string.IsNullOrWhiteSpace(status))
                    query = query.Where(e => e.Status == status);

                if (from.HasValue)
                    query = query.Where(e => e.VisitDate >= from.Value);

                if (to.HasValue)
                    query = query.Where(e => e.VisitDate <= to.Value);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.ToLower();
                    query = query.Where(e =>
                        e.SalesRepName.ToLower().Contains(s) ||
                        (e.Location != null && e.Location.ToLower().Contains(s)) ||
                        (e.ClientVisited != null && e.ClientVisited.ToLower().Contains(s)) ||
                        (e.RegistrationNumber != null && e.RegistrationNumber.ToLower().Contains(s)));
                }

                var entries = await query
                    .OrderByDescending(e => e.VisitDate)
                    .ThenByDescending(e => e.TimeArrived)
                    .ToListAsync();

                return Ok(entries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving car track entries");
                return StatusCode(500, new { message = "Failed to retrieve car track entries" });
            }
        }

        /// <summary>
        /// Get live GPS locations for the 4 HBA1C sales rep vehicles from CarTrack API
        /// </summary>
        [HttpGet("live-locations")]
        public async Task<ActionResult> GetLiveLocations()
        {
            try
            {
                _logger.LogInformation("Fetching live locations for HBA1C sales rep vehicles");
                var allVehicles = await _carTrackService.GetAllVehicleLocationsAsync();

                var results = new List<object>();
                foreach (var kv in TrackedVehicles)
                {
                    var reg = kv.Key;
                    var (unitId, driverName) = kv.Value;

                    var vehicle = allVehicles.FirstOrDefault(v =>
                        v.RegistrationNumber != null &&
                        v.RegistrationNumber.Equals(reg, StringComparison.OrdinalIgnoreCase));

                    if (vehicle != null)
                    {
                        results.Add(new
                        {
                            unitId,
                            registration = reg,
                            driverName,
                            carTrackId = vehicle.VehicleId,
                            status = vehicle.Status,
                            speed = vehicle.Speed,
                            heading = vehicle.Heading,
                            lastUpdate = vehicle.LastUpdate,
                            location = vehicle.Location != null ? new
                            {
                                latitude = vehicle.Location.Latitude,
                                longitude = vehicle.Location.Longitude,
                                address = vehicle.Location.Address,
                                updated = vehicle.Location.Updated
                            } : null
                        });
                    }
                    else
                    {
                        results.Add(new
                        {
                            unitId,
                            registration = reg,
                            driverName,
                            carTrackId = (string?)null,
                            status = "not-found",
                            speed = 0.0,
                            heading = 0.0,
                            lastUpdate = (DateTime?)null,
                            location = (object?)null
                        });
                    }
                }

                return Ok(new { vehicles = results, fetchedAt = DateTime.UtcNow });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching live locations for HBA1C vehicles");
                return StatusCode(500, new { message = "Failed to fetch live vehicle locations" });
            }
        }

        /// <summary>
        /// Get trip history for a vehicle on a given date from CarTrack API
        /// </summary>
        [HttpGet("trip-history/{registration}")]
        public async Task<ActionResult> GetTripHistory(string registration, [FromQuery] DateTime? date = null)
        {
            try
            {
                var targetDate = date ?? DateTime.Now;
                _logger.LogInformation("Fetching trip history for {Registration} on {Date}", registration, targetDate.ToString("yyyy-MM-dd"));

                // Look up the driver name from our tracked vehicles
                var driverName = TrackedVehicles.TryGetValue(registration.ToUpper(), out var info) ? info.DriverName : registration;

                var trips = await _carTrackService.GetVehicleTripsAsync(registration, targetDate);

                // Calculate totals
                var totalDistanceKm = Math.Round(trips.Sum(t => t.TripDistance) / 1000.0, 1);
                var totalDurationSeconds = trips.Sum(t => t.TripDurationSeconds);
                var totalIdleSeconds = trips.Sum(t => t.IdleTimeSeconds);
                var maxSpeedOfDay = trips.Any() ? trips.Max(t => t.MaxSpeed) : 0;
                var totalHarshEvents = trips.Sum(t => t.HarshBrakingEvents + t.HarshCorneringEvents + t.HarshAccelerationEvents);

                return Ok(new
                {
                    registration,
                    driverName,
                    date = targetDate.ToString("yyyy-MM-dd"),
                    trips,
                    summary = new
                    {
                        tripCount = trips.Count,
                        totalDistanceKm,
                        totalDurationSeconds,
                        totalDuration = TimeSpan.FromSeconds(totalDurationSeconds).ToString(@"hh\:mm\:ss"),
                        totalIdleSeconds,
                        totalIdleDuration = TimeSpan.FromSeconds(totalIdleSeconds).ToString(@"hh\:mm\:ss"),
                        maxSpeed = maxSpeedOfDay,
                        harshEvents = totalHarshEvents
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trip history for {Registration}", registration);
                return StatusCode(500, new { message = "Failed to fetch trip history" });
            }
        }

        /// <summary>
        /// Get a single car track entry
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult> GetById(int id)
        {
            var entry = await _context.CarTrackEntries.FindAsync(id);
            if (entry == null) return NotFound(new { message = "Entry not found" });
            return Ok(entry);
        }

        /// <summary>
        /// Get summary stats for car tracking
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult> GetStats()
        {
            try
            {
                var entries = await _context.CarTrackEntries.ToListAsync();

                var totalEntries = entries.Count;
                var totalReps = entries.Select(e => e.SalesRepName).Distinct().Count();
                var totalKm = entries
                    .Where(e => e.KilometerStart.HasValue && e.KilometerEnd.HasValue)
                    .Sum(e => (e.KilometerEnd!.Value - e.KilometerStart!.Value));

                var thisMonth = entries.Where(e => e.VisitDate.Month == DateTime.UtcNow.Month && e.VisitDate.Year == DateTime.UtcNow.Year).Count();

                var topReps = entries
                    .GroupBy(e => e.SalesRepName)
                    .Select(g => new { name = g.Key, visits = g.Count() })
                    .OrderByDescending(x => x.visits)
                    .Take(5)
                    .ToList();

                var byProvince = entries
                    .Where(e => !string.IsNullOrEmpty(e.Province))
                    .GroupBy(e => e.Province)
                    .Select(g => new { province = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count)
                    .ToList();

                var byStatus = entries
                    .GroupBy(e => e.Status)
                    .Select(g => new { status = g.Key, count = g.Count() })
                    .ToList();

                return Ok(new
                {
                    totalEntries,
                    totalReps,
                    totalKilometers = Math.Round(totalKm, 1),
                    thisMonthVisits = thisMonth,
                    topReps,
                    byProvince,
                    byStatus
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting car track stats");
                return StatusCode(500, new { message = "Failed to get stats" });
            }
        }

        /// <summary>
        /// Get distinct sales rep names for autocomplete
        /// </summary>
        [HttpGet("sales-reps")]
        public async Task<ActionResult> GetSalesReps()
        {
            var reps = await _context.CarTrackEntries
                .Select(e => e.SalesRepName)
                .Distinct()
                .OrderBy(n => n)
                .ToListAsync();
            return Ok(reps);
        }

        /// <summary>
        /// Get distinct registration numbers for autocomplete
        /// </summary>
        [HttpGet("vehicles")]
        public async Task<ActionResult> GetVehicles()
        {
            var vehicles = await _context.CarTrackEntries
                .Where(e => e.RegistrationNumber != null)
                .Select(e => new { e.RegistrationNumber, e.SalesRepName })
                .Distinct()
                .OrderBy(v => v.RegistrationNumber)
                .ToListAsync();
            return Ok(vehicles);
        }

        /// <summary>
        /// Get sales reps (trainers) and training venues from the HBA1C external API
        /// </summary>
        [HttpGet("reps-and-venues")]
        public async Task<ActionResult> GetRepsAndVenues()
        {
            try
            {
                var trainersTask = _hba1cApi.GetAsync<List<HBA1CTrainer>>("api/Trainer/GetAll");
                var trainingsTask = _hba1cApi.GetAsync<List<HBA1CTrainingSession>>("api/Training/GetAll");

                await Task.WhenAll(trainersTask, trainingsTask);

                var trainers = await trainersTask ?? new List<HBA1CTrainer>();
                var trainings = await trainingsTask ?? new List<HBA1CTrainingSession>();

                // Build reps list from active trainers with their assigned vehicle
                var reps = trainers
                    .Where(t => t.IsActive && !t.IsDeleted)
                    .Select(t => {
                        var fullName = $"{t.FirstName} {t.LastName}".Trim();
                        // Match trainer to their tracked vehicle by first name
                        var vehicle = TrackedVehicles.FirstOrDefault(v =>
                            v.Value.DriverName.Equals(fullName, StringComparison.OrdinalIgnoreCase) ||
                            v.Value.DriverName.Split(' ')[0].Equals(t.FirstName, StringComparison.OrdinalIgnoreCase));
                        return new {
                            id = t.Id,
                            name = fullName,
                            firstName = t.FirstName,
                            lastName = t.LastName,
                            email = t.Email,
                            phone = t.Phone,
                            specialization = t.Specialization,
                            registration = vehicle.Key, // null if no vehicle assigned
                            unitId = vehicle.Key != null ? vehicle.Value.UnitId : (string?)null
                        };
                    })
                    .OrderBy(r => r.name)
                    .ToList();

                // Also include Deon who's in TrackedVehicles but not in trainers
                var trainerNames = reps.Select(r => r.name.ToLower()).ToHashSet();
                foreach (var kv in TrackedVehicles)
                {
                    var driverLower = kv.Value.DriverName.ToLower();
                    if (!trainerNames.Any(tn => tn.Contains(driverLower.Split(' ')[0])))
                    {
                        reps.Add(new {
                            id = 0,
                            name = kv.Value.DriverName,
                            firstName = kv.Value.DriverName.Split(' ')[0],
                            lastName = kv.Value.DriverName.Contains(' ') ? kv.Value.DriverName.Split(' ', 2)[1] : "",
                            email = (string?)null,
                            phone = (string?)null,
                            specialization = "Sales-rep",
                            registration = kv.Key,
                            unitId = (string?)kv.Value.UnitId
                        });
                    }
                }

                // Extract unique venues from training sessions
                var venues = trainings
                    .Where(t => !string.IsNullOrWhiteSpace(t.Venue))
                    .Select(t => t.Venue!.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(v => v)
                    .ToList();

                return Ok(new { reps, venues });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching reps and venues from HBA1C API");
                // Return static fallback data if external API is down
                var fallbackReps = TrackedVehicles.Select(kv => new {
                    id = 0,
                    name = kv.Value.DriverName,
                    firstName = kv.Value.DriverName.Split(' ')[0],
                    lastName = kv.Value.DriverName.Contains(' ') ? kv.Value.DriverName.Split(' ', 2)[1] : "",
                    email = (string?)null,
                    phone = (string?)null,
                    specialization = "Sales-rep",
                    registration = kv.Key,
                    unitId = (string?)kv.Value.UnitId
                }).ToList();
                return Ok(new { reps = fallbackReps, venues = new List<string>() });
            }
        }

        /// <summary>
        /// Sync training sessions into car track visit entries.
        /// Creates visit entries from real training data (venue, trainer, date, province).
        /// </summary>
        [HttpPost("sync-from-training")]
        public async Task<ActionResult> SyncFromTraining()
        {
            try
            {
                var trainersTask = _hba1cApi.GetAsync<List<HBA1CTrainer>>("api/Trainer/GetAll");
                var trainingsTask = _hba1cApi.GetAsync<List<HBA1CTrainingSession>>("api/Training/GetAll");
                await Task.WhenAll(trainersTask, trainingsTask);

                var trainers = (await trainersTask ?? new List<HBA1CTrainer>())
                    .ToDictionary(t => t.Id, t => t);
                var trainings = await trainingsTask ?? new List<HBA1CTrainingSession>();

                // Province mapping
                var provinceNames = new Dictionary<int, string>
                {
                    { 1, "Eastern Cape" }, { 2, "Free State" }, { 3, "Gauteng" },
                    { 4, "KwaZulu-Natal" }, { 5, "Limpopo" }, { 6, "Mpumalanga" },
                    { 7, "North West" }, { 8, "Northern Cape" }, { 9, "Western Cape" }
                };

                // Get existing entries to avoid duplicates (match by rep + venue + date)
                var existing = await _context.CarTrackEntries
                    .Select(e => $"{e.SalesRepName}|{e.Location}|{e.VisitDate:yyyy-MM-dd}")
                    .ToListAsync();
                var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

                var newEntries = new List<CarTrackEntry>();

                foreach (var session in trainings)
                {
                    if (string.IsNullOrWhiteSpace(session.Venue)) continue;
                    if (session.StartDate == null) continue;

                    // Get trainer name
                    var trainerName = "Unknown";
                    if (session.Trainer != null)
                        trainerName = $"{session.Trainer.FirstName} {session.Trainer.LastName}".Trim();
                    else if (trainers.TryGetValue(session.TrainerId, out var t))
                        trainerName = $"{t.FirstName} {t.LastName}".Trim();

                    // Match trainer to vehicle registration
                    var vehicle = TrackedVehicles.FirstOrDefault(v =>
                        v.Value.DriverName.Equals(trainerName, StringComparison.OrdinalIgnoreCase) ||
                        v.Value.DriverName.Split(' ')[0].Equals(
                            trainerName.Split(' ')[0], StringComparison.OrdinalIgnoreCase));

                    var province = provinceNames.TryGetValue(session.ProvinceId, out var pn) ? pn 
                        : session.ProvinceName;

                    var visitDate = session.StartDate.Value.Date;
                    var key = $"{trainerName}|{session.Venue.Trim()}|{visitDate:yyyy-MM-dd}";
                    if (existingSet.Contains(key)) continue;
                    existingSet.Add(key);

                    var timeArrived = session.StartDate.Value.TimeOfDay;
                    // Estimate 2-3h session
                    var timeDeparted = timeArrived.Add(TimeSpan.FromHours(2.5));

                    newEntries.Add(new CarTrackEntry
                    {
                        SalesRepName = trainerName,
                        RegistrationNumber = vehicle.Key,
                        Location = session.Venue.Trim(),
                        Province = province,
                        Purpose = session.TrainingType ?? "NCD Awareness Training",
                        ClientVisited = session.Venue.Trim(),
                        VisitDate = visitDate,
                        TimeArrived = timeArrived,
                        TimeDeparted = timeDeparted,
                        Notes = $"Training: {session.TrainingName} | {session.NumberOfParticipants} participants",
                        Status = "Completed",
                        CreatedAt = DateTime.UtcNow
                    });
                }

                if (newEntries.Any())
                {
                    _context.CarTrackEntries.AddRange(newEntries);
                    await _context.SaveChangesAsync();
                }

                return Ok(new
                {
                    message = $"Synced {newEntries.Count} visit entries from {trainings.Count} training sessions",
                    newEntries = newEntries.Count,
                    totalTrainingSessions = trainings.Count,
                    skippedDuplicates = trainings.Count - newEntries.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing training data to car track entries");
                return StatusCode(500, new { message = "Failed to sync training data" });
            }
        }

        /// <summary>
        /// Create a new car track entry
        /// </summary>
        [HttpPost]
        public async Task<ActionResult> Create([FromBody] CarTrackEntryDto dto)
        {
            try
            {
                var entry = new CarTrackEntry
                {
                    SalesRepName = dto.SalesRepName,
                    RegistrationNumber = dto.RegistrationNumber,
                    Location = dto.Location,
                    Province = dto.Province,
                    Purpose = dto.Purpose,
                    ClientVisited = dto.ClientVisited,
                    VisitDate = dto.VisitDate,
                    TimeArrived = string.IsNullOrEmpty(dto.TimeArrived) ? null : TimeSpan.Parse(dto.TimeArrived),
                    TimeDeparted = string.IsNullOrEmpty(dto.TimeDeparted) ? null : TimeSpan.Parse(dto.TimeDeparted),
                    KilometerStart = dto.KilometerStart,
                    KilometerEnd = dto.KilometerEnd,
                    Notes = dto.Notes,
                    Status = dto.Status ?? "Completed",
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = dto.CreatedByUserId
                };

                _context.CarTrackEntries.Add(entry);
                await _context.SaveChangesAsync();

                return Ok(entry);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating car track entry");
                return StatusCode(500, new { message = "Failed to create entry" });
            }
        }

        /// <summary>
        /// Update an existing car track entry
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] CarTrackEntryDto dto)
        {
            try
            {
                var entry = await _context.CarTrackEntries.FindAsync(id);
                if (entry == null) return NotFound(new { message = "Entry not found" });

                entry.SalesRepName = dto.SalesRepName;
                entry.RegistrationNumber = dto.RegistrationNumber;
                entry.Location = dto.Location;
                entry.Province = dto.Province;
                entry.Purpose = dto.Purpose;
                entry.ClientVisited = dto.ClientVisited;
                entry.VisitDate = dto.VisitDate;
                entry.TimeArrived = string.IsNullOrEmpty(dto.TimeArrived) ? null : TimeSpan.Parse(dto.TimeArrived);
                entry.TimeDeparted = string.IsNullOrEmpty(dto.TimeDeparted) ? null : TimeSpan.Parse(dto.TimeDeparted);
                entry.KilometerStart = dto.KilometerStart;
                entry.KilometerEnd = dto.KilometerEnd;
                entry.Notes = dto.Notes;
                entry.Status = dto.Status ?? entry.Status;
                entry.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(entry);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating car track entry {Id}", id);
                return StatusCode(500, new { message = "Failed to update entry" });
            }
        }

        /// <summary>
        /// Delete a car track entry
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var entry = await _context.CarTrackEntries.FindAsync(id);
                if (entry == null) return NotFound(new { message = "Entry not found" });

                _context.CarTrackEntries.Remove(entry);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Entry deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting car track entry {Id}", id);
                return StatusCode(500, new { message = "Failed to delete entry" });
            }
        }

        /// <summary>
        /// Export car track data to Excel for a date range.
        /// Sheet 1: Visit Log entries from DB. Sheet 2: Live trip history from CarTrack API for each day/vehicle.
        /// </summary>
        [HttpGet("export")]
        public async Task<IActionResult> ExportToExcel(
            [FromQuery] DateTime from,
            [FromQuery] DateTime to,
            [FromQuery] string? salesRep = null,
            [FromQuery] bool includeTrips = true)
        {
            try
            {
                _logger.LogInformation("Exporting car track data from {From} to {To}", from.ToString("yyyy-MM-dd"), to.ToString("yyyy-MM-dd"));

                // ── Query visit log entries ──
                var query = _context.CarTrackEntries.AsQueryable();
                query = query.Where(e => e.VisitDate >= from.Date && e.VisitDate <= to.Date);
                if (!string.IsNullOrWhiteSpace(salesRep))
                    query = query.Where(e => e.SalesRepName == salesRep);

                var entries = await query
                    .OrderBy(e => e.VisitDate)
                    .ThenBy(e => e.SalesRepName)
                    .ToListAsync();

                using var workbook = new XLWorkbook();

                // ════════════════════════════════════════════════════
                // SHEET 1 — Visit Log
                // ════════════════════════════════════════════════════
                var ws1 = workbook.Worksheets.Add("Visit Log");

                // Title row
                ws1.Cell(1, 1).Value = $"Car Track Visit Log — {from:dd MMM yyyy} to {to:dd MMM yyyy}";
                ws1.Cell(1, 1).Style.Font.Bold = true;
                ws1.Cell(1, 1).Style.Font.FontSize = 14;
                ws1.Range(1, 1, 1, 10).Merge();

                // Header row
                var visitHeaders = new[] { "#", "Date", "Sales Rep", "Registration", "Province", "Location / Venue", "Purpose", "Client Visited", "Time Arrived", "Time Departed", "KM Start", "KM End", "KM Travelled", "Status", "Notes" };
                for (int i = 0; i < visitHeaders.Length; i++)
                {
                    var cell = ws1.Cell(3, i + 1);
                    cell.Value = visitHeaders[i];
                    cell.Style.Font.Bold = true;
                    cell.Style.Font.FontColor = XLColor.White;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1565C0");
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }

                int row = 4;
                double totalKm = 0;
                foreach (var e in entries)
                {
                    var km = (e.KilometerStart.HasValue && e.KilometerEnd.HasValue)
                        ? e.KilometerEnd.Value - e.KilometerStart.Value : 0;
                    totalKm += km;

                    ws1.Cell(row, 1).Value = row - 3;
                    ws1.Cell(row, 2).Value = e.VisitDate.ToString("dd MMM yyyy");
                    ws1.Cell(row, 3).Value = e.SalesRepName;
                    ws1.Cell(row, 4).Value = e.RegistrationNumber ?? "";
                    ws1.Cell(row, 5).Value = e.Province ?? "";
                    ws1.Cell(row, 6).Value = e.Location;
                    ws1.Cell(row, 7).Value = e.Purpose ?? "";
                    ws1.Cell(row, 8).Value = e.ClientVisited ?? "";
                    ws1.Cell(row, 9).Value = e.TimeArrived?.ToString(@"hh\:mm") ?? "";
                    ws1.Cell(row, 10).Value = e.TimeDeparted?.ToString(@"hh\:mm") ?? "";
                    ws1.Cell(row, 11).Value = e.KilometerStart ?? 0;
                    ws1.Cell(row, 11).Style.NumberFormat.Format = "#,##0";
                    ws1.Cell(row, 12).Value = e.KilometerEnd ?? 0;
                    ws1.Cell(row, 12).Style.NumberFormat.Format = "#,##0";
                    ws1.Cell(row, 13).Value = km;
                    ws1.Cell(row, 13).Style.NumberFormat.Format = "#,##0.0";
                    ws1.Cell(row, 14).Value = e.Status;
                    ws1.Cell(row, 15).Value = e.Notes ?? "";

                    // Alternate row colour
                    if (row % 2 == 0)
                    {
                        for (int c = 1; c <= visitHeaders.Length; c++)
                            ws1.Cell(row, c).Style.Fill.BackgroundColor = XLColor.FromHtml("#EEF4FB");
                    }
                    row++;
                }

                // Summary row
                row++;
                ws1.Cell(row, 1).Value = "SUMMARY";
                ws1.Cell(row, 1).Style.Font.Bold = true;
                ws1.Cell(row, 1).Style.Font.FontSize = 12;
                row++;
                ws1.Cell(row, 1).Value = "Total Visits";
                ws1.Cell(row, 1).Style.Font.Bold = true;
                ws1.Cell(row, 2).Value = entries.Count;
                row++;
                ws1.Cell(row, 1).Value = "Total KM Travelled";
                ws1.Cell(row, 1).Style.Font.Bold = true;
                ws1.Cell(row, 2).Value = Math.Round(totalKm, 1);
                ws1.Cell(row, 2).Style.NumberFormat.Format = "#,##0.0";
                row++;
                ws1.Cell(row, 1).Value = "Unique Reps";
                ws1.Cell(row, 1).Style.Font.Bold = true;
                ws1.Cell(row, 2).Value = entries.Select(e => e.SalesRepName).Distinct().Count();
                row++;

                // Per-rep breakdown
                row++;
                ws1.Cell(row, 1).Value = "Rep Breakdown";
                ws1.Cell(row, 1).Style.Font.Bold = true;
                ws1.Cell(row, 1).Style.Font.FontSize = 12;
                row++;
                ws1.Cell(row, 1).Value = "Sales Rep";
                ws1.Cell(row, 1).Style.Font.Bold = true;
                ws1.Cell(row, 2).Value = "Visits";
                ws1.Cell(row, 2).Style.Font.Bold = true;
                ws1.Cell(row, 3).Value = "Top Province";
                ws1.Cell(row, 3).Style.Font.Bold = true;
                row++;
                foreach (var g in entries.GroupBy(e => e.SalesRepName).OrderByDescending(g => g.Count()))
                {
                    ws1.Cell(row, 1).Value = g.Key;
                    ws1.Cell(row, 2).Value = g.Count();
                    var topProv = g.Where(e => !string.IsNullOrEmpty(e.Province))
                        .GroupBy(e => e.Province).OrderByDescending(p => p.Count()).FirstOrDefault()?.Key ?? "";
                    ws1.Cell(row, 3).Value = topProv;
                    row++;
                }

                // Per-province breakdown
                row++;
                ws1.Cell(row, 1).Value = "Province Breakdown";
                ws1.Cell(row, 1).Style.Font.Bold = true;
                ws1.Cell(row, 1).Style.Font.FontSize = 12;
                row++;
                ws1.Cell(row, 1).Value = "Province";
                ws1.Cell(row, 1).Style.Font.Bold = true;
                ws1.Cell(row, 2).Value = "Visits";
                ws1.Cell(row, 2).Style.Font.Bold = true;
                row++;
                foreach (var g in entries.Where(e => !string.IsNullOrEmpty(e.Province)).GroupBy(e => e.Province).OrderByDescending(g => g.Count()))
                {
                    ws1.Cell(row, 1).Value = g.Key;
                    ws1.Cell(row, 2).Value = g.Count();
                    row++;
                }

                ws1.Columns().AdjustToContents();

                // ════════════════════════════════════════════════════
                // SHEET 2 — Live Trip History (from CarTrack API)
                // ════════════════════════════════════════════════════
                if (includeTrips)
                {
                    var ws2 = workbook.Worksheets.Add("Trip History");

                    ws2.Cell(1, 1).Value = $"CarTrack GPS Trip History — {from:dd MMM yyyy} to {to:dd MMM yyyy}";
                    ws2.Cell(1, 1).Style.Font.Bold = true;
                    ws2.Cell(1, 1).Style.Font.FontSize = 14;
                    ws2.Range(1, 1, 1, 12).Merge();

                    var tripHeaders = new[] { "#", "Date", "Driver", "Registration", "Start Time", "End Time", "Duration", "Start Location", "End Location", "Distance (km)", "Max Speed (km/h)", "Idle Time", "Harsh Braking", "Harsh Cornering", "Harsh Accel" };
                    for (int i = 0; i < tripHeaders.Length; i++)
                    {
                        var cell = ws2.Cell(3, i + 1);
                        cell.Value = tripHeaders[i];
                        cell.Style.Font.Bold = true;
                        cell.Style.Font.FontColor = XLColor.White;
                        cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#2E7D32");
                        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    }

                    int tRow = 4;
                    int tripNum = 0;
                    double grandTotalKm = 0;
                    int grandTotalTrips = 0;

                    // Iterate each day in the range
                    for (var d = from.Date; d <= to.Date; d = d.AddDays(1))
                    {
                        foreach (var kv in TrackedVehicles)
                        {
                            var reg = kv.Key;
                            var driverName = kv.Value.DriverName;

                            if (!string.IsNullOrWhiteSpace(salesRep) &&
                                !driverName.Equals(salesRep, StringComparison.OrdinalIgnoreCase))
                                continue;

                            List<CarTrackTripData> trips;
                            try
                            {
                                trips = await _carTrackService.GetVehicleTripsAsync(reg, d);
                            }
                            catch
                            {
                                continue;
                            }

                            foreach (var trip in trips)
                            {
                                tripNum++;
                                grandTotalTrips++;
                                var distKm = Math.Round(trip.TripDistance / 1000.0, 1);
                                grandTotalKm += distKm;

                                ws2.Cell(tRow, 1).Value = tripNum;
                                ws2.Cell(tRow, 2).Value = d.ToString("dd MMM yyyy");
                                ws2.Cell(tRow, 3).Value = driverName;
                                ws2.Cell(tRow, 4).Value = reg;
                                // Parse time from timestamp like "2026-03-31 06:36:12+02"
                                ws2.Cell(tRow, 5).Value = trip.StartTimestamp != null && trip.StartTimestamp.Length >= 16
                                    ? trip.StartTimestamp.Substring(11, 5) : "";
                                ws2.Cell(tRow, 6).Value = trip.EndTimestamp != null && trip.EndTimestamp.Length >= 16
                                    ? trip.EndTimestamp.Substring(11, 5) : "";
                                ws2.Cell(tRow, 7).Value = trip.TripDuration ?? "";
                                ws2.Cell(tRow, 8).Value = trip.StartLocation ?? "";
                                ws2.Cell(tRow, 9).Value = trip.EndLocation ?? "";
                                ws2.Cell(tRow, 10).Value = distKm;
                                ws2.Cell(tRow, 10).Style.NumberFormat.Format = "#,##0.0";
                                ws2.Cell(tRow, 11).Value = trip.MaxSpeed;
                                ws2.Cell(tRow, 12).Value = TimeSpan.FromSeconds(trip.IdleTimeSeconds).ToString(@"hh\:mm\:ss");
                                ws2.Cell(tRow, 13).Value = trip.HarshBrakingEvents;
                                ws2.Cell(tRow, 14).Value = trip.HarshCorneringEvents;
                                ws2.Cell(tRow, 15).Value = trip.HarshAccelerationEvents;

                                if (tRow % 2 == 0)
                                {
                                    for (int c = 1; c <= tripHeaders.Length; c++)
                                        ws2.Cell(tRow, c).Style.Fill.BackgroundColor = XLColor.FromHtml("#E8F5E9");
                                }
                                tRow++;
                            }
                        }
                    }

                    // Summary
                    tRow++;
                    ws2.Cell(tRow, 1).Value = "TOTAL";
                    ws2.Cell(tRow, 1).Style.Font.Bold = true;
                    ws2.Cell(tRow, 1).Style.Font.FontSize = 12;
                    ws2.Cell(tRow, 9).Value = "Total Trips:";
                    ws2.Cell(tRow, 9).Style.Font.Bold = true;
                    ws2.Cell(tRow, 10).Value = grandTotalTrips;
                    ws2.Cell(tRow, 10).Style.Font.Bold = true;
                    tRow++;
                    ws2.Cell(tRow, 9).Value = "Total Distance:";
                    ws2.Cell(tRow, 9).Style.Font.Bold = true;
                    ws2.Cell(tRow, 10).Value = Math.Round(grandTotalKm, 1);
                    ws2.Cell(tRow, 10).Style.NumberFormat.Format = "#,##0.0";
                    ws2.Cell(tRow, 10).Style.Font.Bold = true;

                    ws2.Columns().AdjustToContents();
                }

                using var stream = new MemoryStream();
                workbook.SaveAs(stream);
                stream.Position = 0;

                var fileName = $"CarTrack_Report_{from:yyyyMMdd}_to_{to:yyyyMMdd}.xlsx";
                return File(stream.ToArray(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting car track data");
                return StatusCode(500, new { message = "Failed to export car track data" });
            }
        }
    }

    /// <summary>
    /// DTO for creating/updating car track entries
    /// </summary>
    public class CarTrackEntryDto
    {
        public string SalesRepName { get; set; } = string.Empty;
        public string? RegistrationNumber { get; set; }
        public string Location { get; set; } = string.Empty;
        public string? Province { get; set; }
        public string? Purpose { get; set; }
        public string? ClientVisited { get; set; }
        public DateTime VisitDate { get; set; }
        public string? TimeArrived { get; set; }
        public string? TimeDeparted { get; set; }
        public double? KilometerStart { get; set; }
        public double? KilometerEnd { get; set; }
        public string? Notes { get; set; }
        public string? Status { get; set; }
        public int? CreatedByUserId { get; set; }
    }
}
