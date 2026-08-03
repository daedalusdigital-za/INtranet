using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Dedicated endpoint for biometric clocking devices.
    /// Authentication uses a static API key header (X-Device-Key) instead of JWT,
    /// so the clocking machine never needs to perform a login flow.
    ///
    /// Base URL the device should call:  http://192.168.10.151:5143/api/device
    /// Header the device must send:      X-Device-Key: <value from ClockingDevice:ApiKey in appsettings>
    /// </summary>
    [ApiController]
    [Route("api/device")]
    [AllowAnonymous] // JWT skipped — device key validated inside each action
    public class ClockingDeviceController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<AttendanceHub> _hub;
        private readonly IConfiguration _config;
        private readonly ILogger<ClockingDeviceController> _log;

        public ClockingDeviceController(
            ApplicationDbContext context,
            IHubContext<AttendanceHub> hub,
            IConfiguration config,
            ILogger<ClockingDeviceController> log)
        {
            _context = context;
            _hub = hub;
            _config = config;
            _log = log;
        }

        // ─── Auth helper ────────────────────────────────────────────────────────
        private bool DeviceAuthorized()
        {
            var expected = _config["ClockingDevice:ApiKey"];
            if (string.IsNullOrEmpty(expected)) return false; // key not configured → deny
            Request.Headers.TryGetValue("X-Device-Key", out var provided);
            return provided == expected;
        }

        // ────────────────────────────────────────────────────────────────────────
        // GET api/device/ping
        // Clocking machine can use this to verify connectivity on startup.
        // ────────────────────────────────────────────────────────────────────────
        [HttpGet("ping")]
        public IActionResult Ping()
        {
            if (!DeviceAuthorized()) return Unauthorized(new { error = "Invalid device key" });
            return Ok(new { status = "online", serverTime = DateTime.Now, utcTime = DateTime.UtcNow });
        }

        // ────────────────────────────────────────────────────────────────────────
        // POST api/device/employee
        // Register or update an employee from the biometric device.
        // Body matches the empregistration table exactly.
        // ────────────────────────────────────────────────────────────────────────
        [HttpPost("employee")]
        public async Task<IActionResult> UpsertEmployee([FromBody] DeviceEmployeeDto dto)
        {
            if (!DeviceAuthorized()) return Unauthorized(new { error = "Invalid device key" });
            if (string.IsNullOrWhiteSpace(dto.EmpId))
                return BadRequest(new { error = "EmpId is required" });

            try
            {
                var existing = await _context.EmpRegistrations.FindAsync(dto.EmpId);
                if (existing == null)
                {
                    _context.EmpRegistrations.Add(new EmpRegistration
                    {
                        EmpId = dto.EmpId,
                        Name = dto.Name,
                        LastName = dto.LastName,
                        IdNum = dto.IdNum,
                        Department = dto.Department,
                        JobTitle = dto.JobTitle,
                        Address = dto.Address,
                        MobileNo = dto.MobileNo,
                        Date = dto.Date,
                        Photo = dto.PhotoBytes
                    });
                    _log.LogInformation("Clocking device: registered new employee {EmpId}", dto.EmpId);
                }
                else
                {
                    existing.Name = dto.Name ?? existing.Name;
                    existing.LastName = dto.LastName ?? existing.LastName;
                    existing.IdNum = dto.IdNum ?? existing.IdNum;
                    existing.Department = dto.Department ?? existing.Department;
                    existing.JobTitle = dto.JobTitle ?? existing.JobTitle;
                    existing.Address = dto.Address ?? existing.Address;
                    existing.MobileNo = dto.MobileNo ?? existing.MobileNo;
                    if (dto.PhotoBytes != null) existing.Photo = dto.PhotoBytes;
                    _log.LogInformation("Clocking device: updated employee {EmpId}", dto.EmpId);
                }

                await _context.SaveChangesAsync();
                return Ok(new { success = true, empId = dto.EmpId });
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error upserting employee {EmpId} from clocking device", dto.EmpId);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // ────────────────────────────────────────────────────────────────────────
        // POST api/device/clock-in
        // Called when an employee clocks IN on the biometric device.
        // ────────────────────────────────────────────────────────────────────────
        [HttpPost("clock-in")]
        public async Task<IActionResult> ClockIn([FromBody] DeviceClockDto dto)
        {
            if (!DeviceAuthorized()) return Unauthorized(new { error = "Invalid device key" });
            if (string.IsNullOrWhiteSpace(dto.EmpId))
                return BadRequest(new { error = "EmpId is required" });

            try
            {
                var emp = await _context.EmpRegistrations.FindAsync(dto.EmpId);
                if (emp == null)
                    return NotFound(new { error = $"Employee {dto.EmpId} not found. Register first via POST /api/device/employee" });

                var eventDate = dto.Timestamp.Date;
                var timeOfDay = TimeOnly.FromDateTime(dto.Timestamp);

                // Check for existing record for this employee on this date
                var existing = await _context.AttendanceRecords
                    .FirstOrDefaultAsync(a => a.EmpID == dto.EmpId &&
                                              a.Date != null &&
                                              a.Date.Value.Date == eventDate);

                if (existing == null)
                {
                    // New attendance row for today
                    var record = new AttendanceRecord
                    {
                        EmpID = dto.EmpId,
                        Name = emp.Name,
                        LastName = emp.LastName,
                        IdNum = emp.IdNum,
                        Department = emp.Department,
                        JobTitle = emp.JobTitle,
                        Date = eventDate,
                        Day = eventDate.DayOfWeek.ToString(),
                        TimeIn = timeOfDay,
                        Status = "Present"
                    };
                    _context.AttendanceRecords.Add(record);
                    _log.LogInformation("Clocking device: CLOCK IN - {EmpId} at {Time}", dto.EmpId, dto.Timestamp);
                }
                else if (existing.TimeIn == null)
                {
                    // Record exists (from previous partial push) but no time-in yet
                    existing.TimeIn = timeOfDay;
                    existing.Status = "Present";
                    _log.LogInformation("Clocking device: CLOCK IN (update) - {EmpId} at {Time}", dto.EmpId, dto.Timestamp);
                }
                else
                {
                    // Already clocked in — return success without overwriting
                    return Ok(new { success = true, message = "Already clocked in", timeIn = existing.TimeIn });
                }

                await _context.SaveChangesAsync();

                // Push real-time update to intranet dashboard via SignalR
                await _hub.Clients.All.SendAsync("EmployeeCheckedIn", new
                {
                    employeeId = dto.EmpId,
                    employeeName = $"{emp.Name} {emp.LastName}".Trim(),
                    department = emp.Department,
                    timeIn = timeOfDay.ToString("HH:mm"),
                    timestamp = dto.Timestamp
                });

                return Ok(new { success = true, empId = dto.EmpId, timeIn = timeOfDay.ToString("HH:mm") });
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error processing clock-in for {EmpId}", dto.EmpId);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // ────────────────────────────────────────────────────────────────────────
        // POST api/device/clock-out
        // Called when an employee clocks OUT on the biometric device.
        // ────────────────────────────────────────────────────────────────────────
        [HttpPost("clock-out")]
        public async Task<IActionResult> ClockOut([FromBody] DeviceClockDto dto)
        {
            if (!DeviceAuthorized()) return Unauthorized(new { error = "Invalid device key" });
            if (string.IsNullOrWhiteSpace(dto.EmpId))
                return BadRequest(new { error = "EmpId is required" });

            try
            {
                var eventDate = dto.Timestamp.Date;
                var timeOfDay = TimeOnly.FromDateTime(dto.Timestamp);

                var record = await _context.AttendanceRecords
                    .FirstOrDefaultAsync(a => a.EmpID == dto.EmpId &&
                                              a.Date != null &&
                                              a.Date.Value.Date == eventDate);

                if (record == null)
                {
                    // Device clocked out without a clock-in (edge case — create the row)
                    var emp = await _context.EmpRegistrations.FindAsync(dto.EmpId);
                    record = new AttendanceRecord
                    {
                        EmpID = dto.EmpId,
                        Name = emp?.Name,
                        LastName = emp?.LastName,
                        Department = emp?.Department,
                        Date = eventDate,
                        Day = eventDate.DayOfWeek.ToString(),
                        TimeOut = timeOfDay,
                        Status = "Present"
                    };
                    _context.AttendanceRecords.Add(record);
                }
                else
                {
                    record.TimeOut = timeOfDay;
                }

                await _context.SaveChangesAsync();

                var emp2 = await _context.EmpRegistrations.FindAsync(dto.EmpId);
                await _hub.Clients.All.SendAsync("EmployeeCheckedOut", new
                {
                    employeeId = dto.EmpId,
                    employeeName = $"{emp2?.Name} {emp2?.LastName}".Trim(),
                    department = emp2?.Department,
                    timeOut = timeOfDay.ToString("HH:mm"),
                    timestamp = dto.Timestamp
                });

                _log.LogInformation("Clocking device: CLOCK OUT - {EmpId} at {Time}", dto.EmpId, dto.Timestamp);
                return Ok(new { success = true, empId = dto.EmpId, timeOut = timeOfDay.ToString("HH:mm") });
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error processing clock-out for {EmpId}", dto.EmpId);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // ────────────────────────────────────────────────────────────────────────
        // POST api/device/attendance/bulk
        // Bulk-push multiple attendance records at once (e.g. offline sync catch-up).
        // ────────────────────────────────────────────────────────────────────────
        [HttpPost("attendance/bulk")]
        public async Task<IActionResult> BulkAttendance([FromBody] List<DeviceBulkRecord> records)
        {
            if (!DeviceAuthorized()) return Unauthorized(new { error = "Invalid device key" });
            if (records == null || records.Count == 0)
                return BadRequest(new { error = "No records provided" });

            int inserted = 0, updated = 0, skipped = 0;
            var errors = new List<string>();

            foreach (var r in records)
            {
                try
                {
                    var eventDate = r.Date.Date;
                    var existing = await _context.AttendanceRecords
                        .FirstOrDefaultAsync(a => a.EmpID == r.EmpId && a.Date != null && a.Date.Value.Date == eventDate);

                    if (existing == null)
                    {
                        var emp = await _context.EmpRegistrations.FindAsync(r.EmpId);
                        _context.AttendanceRecords.Add(new AttendanceRecord
                        {
                            EmpID = r.EmpId,
                            Name = emp?.Name ?? r.Name,
                            LastName = emp?.LastName ?? r.LastName,
                            Department = emp?.Department ?? r.Department,
                            Date = eventDate,
                            Day = eventDate.DayOfWeek.ToString(),
                            TimeIn = r.TimeIn.HasValue ? TimeOnly.FromTimeSpan(r.TimeIn.Value) : null,
                            TimeOut = r.TimeOut.HasValue ? TimeOnly.FromTimeSpan(r.TimeOut.Value) : null,
                            Status = r.Status ?? "Present",
                            Shift = r.Shift
                        });
                        inserted++;
                    }
                    else
                    {
                        if (r.TimeIn.HasValue && existing.TimeIn == null)
                            existing.TimeIn = TimeOnly.FromTimeSpan(r.TimeIn.Value);
                        if (r.TimeOut.HasValue)
                            existing.TimeOut = TimeOnly.FromTimeSpan(r.TimeOut.Value);
                        if (!string.IsNullOrEmpty(r.Status))
                            existing.Status = r.Status;
                        updated++;
                    }
                }
                catch (Exception ex)
                {
                    errors.Add($"{r.EmpId} on {r.Date:yyyy-MM-dd}: {ex.Message}");
                    skipped++;
                }
            }

            await _context.SaveChangesAsync();
            await _hub.Clients.All.SendAsync("RefreshAttendanceDashboard");
            _log.LogInformation("Clocking device bulk push: {Inserted} inserted, {Updated} updated, {Skipped} skipped", inserted, updated, skipped);

            return Ok(new { success = true, inserted, updated, skipped, errors });
        }

        // ────────────────────────────────────────────────────────────────────────
        // GET api/device/employees
        // Device can pull the full employee list on startup (for offline ID lookup).
        // ────────────────────────────────────────────────────────────────────────
        [HttpGet("employees")]
        public async Task<IActionResult> GetEmployees()
        {
            if (!DeviceAuthorized()) return Unauthorized(new { error = "Invalid device key" });

            var employees = await _context.EmpRegistrations
                .Select(e => new
                {
                    e.EmpId,
                    e.Name,
                    e.LastName,
                    e.Department,
                    e.JobTitle,
                    e.MobileNo,
                    e.IdNum,
                    HasPhoto = e.Photo != null
                })
                .ToListAsync();

            return Ok(employees);
        }
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────────

    public class DeviceEmployeeDto
    {
        public string EmpId { get; set; } = "";
        public string? Name { get; set; }
        public string? LastName { get; set; }
        public string? IdNum { get; set; }
        public string? Department { get; set; }
        public string? JobTitle { get; set; }
        public string? Address { get; set; }
        public string? MobileNo { get; set; }
        public DateTime? Date { get; set; }
        // Accept photo as base64 string from device; converted to bytes for storage
        public string? PhotoBase64 { get; set; }
        public byte[]? PhotoBytes =>
            string.IsNullOrEmpty(PhotoBase64) ? null : Convert.FromBase64String(PhotoBase64);
    }

    public class DeviceClockDto
    {
        public string EmpId { get; set; } = "";
        /// <summary>Local datetime from the device (e.g. 2026-07-29T08:07:00)</summary>
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string? DeviceId { get; set; } // optional device serial/name for audit
    }

    public class DeviceBulkRecord
    {
        public string EmpId { get; set; } = "";
        public string? Name { get; set; }
        public string? LastName { get; set; }
        public string? Department { get; set; }
        public DateTime Date { get; set; }
        public TimeSpan? TimeIn { get; set; }
        public TimeSpan? TimeOut { get; set; }
        public string? Status { get; set; }
        public string? Shift { get; set; }
    }
}
