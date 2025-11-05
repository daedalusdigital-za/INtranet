using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize] // Disabled temporarily
    public class AttendanceController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<AttendanceHub> _attendanceHub;

        public AttendanceController(ApplicationDbContext context, IHubContext<AttendanceHub> attendanceHub)
        {
            _context = context;
            _attendanceHub = attendanceHub;
        }

        // GET: api/attendance/employees
        [HttpGet("employees")]
        public async Task<ActionResult<IEnumerable<object>>> GetEmployees()
        {
            var today = DateTime.UtcNow.Date;
            var workStartTime = new TimeOnly(7, 30); // 7:30 AM work start time

            // First, get all employees
            var employees = await _context.EmpRegistrations.ToListAsync();
            
            // Then, get today's attendance records in one query
            var todayAttendance = await _context.AttendanceRecords
                .Where(a => a.Date != null && a.Date.Value.Date == today)
                .ToListAsync();
            
            // Create a lookup dictionary for fast access
            var attendanceLookup = todayAttendance
                .GroupBy(a => a.EmpID)
                .ToDictionary(g => g.Key, g => g.First());

            // Map the results
            var result = employees.Select(e =>
            {
                var hasAttendance = attendanceLookup.TryGetValue(e.EmpId, out var attendance);
                var timeIn = hasAttendance ? attendance.TimeIn : null;
                var isLate = hasAttendance && timeIn.HasValue && timeIn.Value > workStartTime;
                
                return new
                {
                    employeeId = e.EmpId,
                    fullName = (e.Name + " " + e.LastName).Trim(),
                    employeeCode = e.EmpId,
                    department = e.Department ?? "",
                    position = e.JobTitle ?? "",
                    email = "", // Not in schema
                    phoneNumber = e.MobileNo ?? "",
                    hireDate = e.Date ?? DateTime.MinValue,
                    shift = "Morning",
                    shiftStartTime = "07:30",
                    shiftEndTime = "16:00",
                    photoBase64 = e.Photo != null ? Convert.ToBase64String(e.Photo) : null,
                    isActive = true,
                    status = hasAttendance ? (attendance.Status ?? "Absent") : "Absent",
                    timeIn = timeIn,
                    timeOut = hasAttendance ? attendance.TimeOut : null,
                    isLate = isLate,
                    lateMinutes = isLate && timeIn.HasValue 
                        ? (int)(timeIn.Value.ToTimeSpan() - workStartTime.ToTimeSpan()).TotalMinutes 
                        : 0
                };
            }).ToList();

            return Ok(result);
        }

        // GET: api/attendance/metrics
        [HttpGet("metrics")]
        public async Task<ActionResult<object>> GetTodayMetrics()
        {
            var today = DateTime.UtcNow.Date;
            
            // Get total employees from EmpRegistrations
            var totalEmployees = await _context.EmpRegistrations.CountAsync();
            
            // Get today's attendance records
            var todayAttendance = await _context.AttendanceRecords
                .Where(a => a.Date != null && a.Date.Value.Date == today)
                .ToListAsync();

            var presentCount = todayAttendance.Count(a => a.Status == "Present");
            var absentCount = totalEmployees - todayAttendance.Count();
            var lateCount = todayAttendance.Count(a => a.TimeIn != null && a.TimeIn.Value > new TimeOnly(7, 30));

            // Department breakdown
            var departmentBreakdown = await _context.EmpRegistrations
                .GroupBy(e => e.Department ?? "Unassigned")
                .Select(g => new
                {
                    departmentName = g.Key,
                    totalEmployees = g.Count(),
                    presentCount = g.Count(e => _context.AttendanceRecords.Any(a => 
                        a.EmpID == e.EmpId && 
                        a.Date != null && 
                        a.Date.Value.Date == today && 
                        a.Status == "Present")),
                    absentCount = g.Count(e => !_context.AttendanceRecords.Any(a => 
                        a.EmpID == e.EmpId && 
                        a.Date != null && 
                        a.Date.Value.Date == today)),
                    lateCount = g.Count(e => _context.AttendanceRecords.Any(a => 
                        a.EmpID == e.EmpId && 
                        a.Date != null && 
                        a.Date.Value.Date == today && 
                        a.TimeIn != null && 
                        a.TimeIn.Value > new TimeOnly(7, 30)))
                })
                .ToListAsync();

            var metrics = new
            {
                totalEmployees = totalEmployees,
                presentCount = presentCount,
                absentCount = absentCount,
                lateCount = lateCount,
                attendanceRate = totalEmployees > 0 ? (double)presentCount / totalEmployees * 100 : 0,
                date = today,
                departmentBreakdown = departmentBreakdown
            };

            return Ok(metrics);
        }

        // GET: api/attendance/weekly
        [HttpGet("weekly")]
        public async Task<ActionResult<object>> GetWeeklyAttendance()
        {
            var today = DateTime.UtcNow.Date;
            var workStartTime = new TimeOnly(7, 30);
            
            // Get Monday of current week
            var mondayOfWeek = GetMondayOfCurrentWeek(today);
            var fridayOfWeek = mondayOfWeek.AddDays(4);
            
            // Get all attendance records for this week (Monday-Friday)
            var weekAttendance = await _context.AttendanceRecords
                .Where(a => a.Date != null && 
                           a.Date.Value.Date >= mondayOfWeek && 
                           a.Date.Value.Date <= fridayOfWeek)
                .ToListAsync();
            
            // Get all employees
            var employees = await _context.EmpRegistrations.ToListAsync();
            
            // Build weekly attendance for each employee
            var weeklyData = employees.Select(emp => new
            {
                employeeId = emp.EmpId,
                weeklyAttendance = new
                {
                    monday = GetDayStatus(emp.EmpId, mondayOfWeek, weekAttendance, workStartTime),
                    tuesday = GetDayStatus(emp.EmpId, mondayOfWeek.AddDays(1), weekAttendance, workStartTime),
                    wednesday = GetDayStatus(emp.EmpId, mondayOfWeek.AddDays(2), weekAttendance, workStartTime),
                    thursday = GetDayStatus(emp.EmpId, mondayOfWeek.AddDays(3), weekAttendance, workStartTime),
                    friday = GetDayStatus(emp.EmpId, mondayOfWeek.AddDays(4), weekAttendance, workStartTime)
                }
            }).ToList();
            
            return Ok(weeklyData);
        }

        private static DateTime GetMondayOfCurrentWeek(DateTime date)
        {
            int diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
            return date.AddDays(-1 * diff).Date;
        }

        private static object GetDayStatus(string employeeId, DateTime checkDate, List<AttendanceRecord> weekAttendance, TimeOnly workStartTime)
        {
            var dayRecord = weekAttendance.FirstOrDefault(a => 
                a.EmpID == employeeId && 
                a.Date.HasValue && 
                a.Date.Value.Date == checkDate.Date);
            
            if (dayRecord?.TimeIn.HasValue == true)
            {
                var status = dayRecord.TimeIn.Value > workStartTime ? "late" : "ontime";
                return new
                {
                    status = status,
                    timeIn = dayRecord.TimeIn.Value.ToString("HH:mm"),
                    timeOut = dayRecord.TimeOut?.ToString("HH:mm")
                };
            }
            
            return new
            {
                status = "absent",
                timeIn = (string?)null,
                timeOut = (string?)null
            };
        }

        // GET: api/attendance/records
        [HttpGet("records")]
        public async Task<ActionResult<IEnumerable<AttendanceDto>>> GetTodayAttendance()
        {
            var today = DateTime.UtcNow.Date;
            
            var records = await _context.Attendances
                .Include(a => a.Employee)
                .Where(a => a.Date == today)
                .Select(a => new AttendanceDto
                {
                    AttendanceId = a.AttendanceId,
                    EmployeeId = a.EmployeeId,
                    EmployeeName = a.Employee!.FullName,
                    EmployeeCode = a.Employee.EmployeeCode,
                    Department = a.Employee.Department,
                    Date = a.Date,
                    TimeIn = a.TimeIn,
                    TimeOut = a.TimeOut,
                    Shift = a.Shift,
                    Status = a.Status,
                    IsLate = a.IsLate,
                    LateMinutes = a.LateMinutes,
                    Remarks = a.Remarks
                })
                .ToListAsync();

            return Ok(records);
        }

        // GET: api/attendance/records/{date}
        [HttpGet("records/{date}")]
        public async Task<ActionResult<IEnumerable<AttendanceDto>>> GetAttendanceByDate(DateTime date)
        {
            var records = await _context.Attendances
                .Include(a => a.Employee)
                .Where(a => a.Date.Date == date.Date)
                .Select(a => new AttendanceDto
                {
                    AttendanceId = a.AttendanceId,
                    EmployeeId = a.EmployeeId,
                    EmployeeName = a.Employee!.FullName,
                    EmployeeCode = a.Employee.EmployeeCode,
                    Department = a.Employee.Department,
                    Date = a.Date,
                    TimeIn = a.TimeIn,
                    TimeOut = a.TimeOut,
                    Shift = a.Shift,
                    Status = a.Status,
                    IsLate = a.IsLate,
                    LateMinutes = a.LateMinutes,
                    Remarks = a.Remarks
                })
                .ToListAsync();

            return Ok(records);
        }

        // POST: api/attendance/checkin
        [HttpPost("checkin")]
        public async Task<ActionResult> CheckIn([FromBody] CheckInRequest request)
        {
            var employee = await _context.Employees.FindAsync(request.EmployeeId);
            if (employee == null)
                return NotFound("Employee not found");

            var today = DateTime.UtcNow.Date;
            var existingAttendance = await _context.Attendances
                .FirstOrDefaultAsync(a => a.EmployeeId == request.EmployeeId && a.Date == today);

            if (existingAttendance != null)
            {
                existingAttendance.TimeIn = request.TimeIn;
                existingAttendance.Status = "Present";
                
                // Calculate if late
                if (employee.ShiftStartTime.HasValue)
                {
                    var scheduledStart = today.Add(employee.ShiftStartTime.Value);
                    if (request.TimeIn > scheduledStart)
                    {
                        existingAttendance.IsLate = true;
                        existingAttendance.LateMinutes = (int)(request.TimeIn - scheduledStart).TotalMinutes;
                    }
                }
                
                existingAttendance.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                var attendance = new Attendance
                {
                    EmployeeId = request.EmployeeId,
                    Date = today,
                    TimeIn = request.TimeIn,
                    Shift = employee.Shift,
                    Status = "Present",
                    CreatedAt = DateTime.UtcNow
                };

                // Calculate if late
                if (employee.ShiftStartTime.HasValue)
                {
                    var scheduledStart = today.Add(employee.ShiftStartTime.Value);
                    if (request.TimeIn > scheduledStart)
                    {
                        attendance.IsLate = true;
                        attendance.LateMinutes = (int)(request.TimeIn - scheduledStart).TotalMinutes;
                    }
                }

                _context.Attendances.Add(attendance);
            }

            await _context.SaveChangesAsync();

            // Notify via SignalR
            await _attendanceHub.Clients.All.SendAsync("EmployeeCheckedIn", new
            {
                employeeId = employee.EmployeeId,
                employeeName = employee.FullName,
                timeIn = request.TimeIn,
                timestamp = DateTime.UtcNow
            });

            return Ok(new { message = "Check-in successful" });
        }

        // POST: api/attendance/checkout
        [HttpPost("checkout")]
        public async Task<ActionResult> CheckOut([FromBody] CheckOutRequest request)
        {
            var employee = await _context.Employees.FindAsync(request.EmployeeId);
            if (employee == null)
                return NotFound("Employee not found");

            var today = DateTime.UtcNow.Date;
            var attendance = await _context.Attendances
                .FirstOrDefaultAsync(a => a.EmployeeId == request.EmployeeId && a.Date == today);

            if (attendance == null)
                return BadRequest("No check-in record found for today");

            attendance.TimeOut = request.TimeOut;
            attendance.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Notify via SignalR
            await _attendanceHub.Clients.All.SendAsync("EmployeeCheckedOut", new
            {
                employeeId = employee.EmployeeId,
                employeeName = employee.FullName,
                timeOut = request.TimeOut,
                timestamp = DateTime.UtcNow
            });

            return Ok(new { message = "Check-out successful" });
        }

        // GET: api/attendance/employee/{id}
        [HttpGet("employee/{id}")]
        public async Task<ActionResult<EmployeeDto>> GetEmployee(int id)
        {
            var today = DateTime.UtcNow.Date;
            
            var employee = await _context.Employees
                .Where(e => e.EmployeeId == id)
                .Select(e => new EmployeeDto
                {
                    EmployeeId = e.EmployeeId,
                    FullName = e.FullName,
                    EmployeeCode = e.EmployeeCode,
                    Department = e.Department,
                    Position = e.Position,
                    Email = e.Email,
                    PhoneNumber = e.PhoneNumber,
                    HireDate = e.HireDate,
                    Shift = e.Shift,
                    ShiftStartTime = e.ShiftStartTime,
                    ShiftEndTime = e.ShiftEndTime,
                    PhotoBase64 = e.Photo != null ? Convert.ToBase64String(e.Photo) : null,
                    IsActive = e.IsActive,
                    Status = e.Attendances
                        .Where(a => a.Date == today)
                        .Select(a => a.Status)
                        .FirstOrDefault() ?? "Absent",
                    TimeIn = e.Attendances
                        .Where(a => a.Date == today)
                        .Select(a => a.TimeIn)
                        .FirstOrDefault(),
                    TimeOut = e.Attendances
                        .Where(a => a.Date == today)
                        .Select(a => a.TimeOut)
                        .FirstOrDefault(),
                    IsLate = e.Attendances
                        .Where(a => a.Date == today)
                        .Select(a => a.IsLate)
                        .FirstOrDefault(),
                    LateMinutes = e.Attendances
                        .Where(a => a.Date == today)
                        .Select(a => a.LateMinutes)
                        .FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            if (employee == null)
                return NotFound();

            return Ok(employee);
        }
    }
}
