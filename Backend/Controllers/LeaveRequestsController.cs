using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/leave-requests")]
    [Authorize]
    public class LeaveRequestsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LeaveRequestsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // POST api/leave-requests — submit a leave request
        [HttpPost]
        public async Task<IActionResult> Submit([FromBody] SubmitLeaveRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.LeaveType) || dto.StartDate == default || dto.EndDate == default)
                return BadRequest(new { message = "LeaveType, StartDate and EndDate are required" });

            var days = (int)(dto.EndDate.Date - dto.StartDate.Date).TotalDays + 1;
            if (days < 1) return BadRequest(new { message = "End date must be on or after start date" });

            // Try to get name from JWT claims
            var userName = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? dto.EmployeeName ?? "Unknown";
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email") ?? dto.EmployeeEmail;
            int? userId = null;
            if (int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out int uid))
                userId = uid;

            // Enrich from DB user if we have an id
            string? department = dto.Department;
            if (userId.HasValue)
            {
                var dbUser = await _context.Users.AsNoTracking().Include(u => u.Department)
                    .FirstOrDefaultAsync(u => u.UserId == userId.Value);
                if (dbUser != null)
                {
                    userName = $"{dbUser.Name} {dbUser.Surname}".Trim();
                    userEmail = dbUser.Email;
                    department = dbUser.Department?.Name ?? department;
                }
            }

            await _context.Database.ExecuteSqlRawAsync(@"
                INSERT INTO LeaveRequests (UserId, EmployeeName, EmployeeEmail, Department, LeaveType,
                    StartDate, EndDate, DaysRequested, Reason, ContactNumber, Status, SubmittedAt)
                VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, 'Pending', GETUTCDATE())",
                userId as object ?? DBNull.Value,
                userName, userEmail as object ?? DBNull.Value, department as object ?? DBNull.Value,
                dto.LeaveType, dto.StartDate.Date, dto.EndDate.Date, days,
                dto.Reason as object ?? DBNull.Value, dto.ContactNumber as object ?? DBNull.Value);

            return Ok(new { message = "Leave request submitted successfully" });
        }

        // GET api/leave-requests — HR: get all requests (with optional status filter)
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? status = null)
        {
            var sql = @"
                SELECT LeaveRequestId, UserId, EmployeeName, EmployeeEmail, Department,
                    LeaveType, StartDate, EndDate, DaysRequested, Reason, ContactNumber,
                    Status, ReviewedBy, ReviewedAt, ReviewNotes, SubmittedAt, UpdatedAt
                FROM LeaveRequests";

            if (!string.IsNullOrWhiteSpace(status) && status != "all")
                sql += " WHERE Status = @p0 ORDER BY SubmittedAt DESC";
            else
                sql += " ORDER BY SubmittedAt DESC";

            var results = new List<object>();
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;
                if (!string.IsNullOrWhiteSpace(status) && status != "all")
                {
                    var p = cmd.CreateParameter(); p.ParameterName = "@p0"; p.Value = status;
                    cmd.Parameters.Add(p);
                }
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    results.Add(new
                    {
                        leaveRequestId = reader.GetInt32(0),
                        userId = reader.IsDBNull(1) ? (int?)null : reader.GetInt32(1),
                        employeeName = reader.IsDBNull(2) ? "" : reader.GetString(2),
                        employeeEmail = reader.IsDBNull(3) ? null : reader.GetString(3),
                        department = reader.IsDBNull(4) ? null : reader.GetString(4),
                        leaveType = reader.IsDBNull(5) ? "" : reader.GetString(5),
                        startDate = reader.IsDBNull(6) ? (DateTime?)null : reader.GetDateTime(6),
                        endDate = reader.IsDBNull(7) ? (DateTime?)null : reader.GetDateTime(7),
                        daysRequested = reader.IsDBNull(8) ? 0 : reader.GetInt32(8),
                        reason = reader.IsDBNull(9) ? null : reader.GetString(9),
                        contactNumber = reader.IsDBNull(10) ? null : reader.GetString(10),
                        status = reader.IsDBNull(11) ? "Pending" : reader.GetString(11),
                        reviewedBy = reader.IsDBNull(12) ? null : reader.GetString(12),
                        reviewedAt = reader.IsDBNull(13) ? (DateTime?)null : reader.GetDateTime(13),
                        reviewNotes = reader.IsDBNull(14) ? null : reader.GetString(14),
                        submittedAt = reader.IsDBNull(15) ? (DateTime?)null : reader.GetDateTime(15),
                        updatedAt = reader.IsDBNull(16) ? (DateTime?)null : reader.GetDateTime(16),
                    });
                }
            }
            finally { await conn.CloseAsync(); }

            return Ok(results);
        }

        // GET api/leave-requests/my — employee: get own requests
        [HttpGet("my")]
        public async Task<IActionResult> GetMy()
        {
            int? userId = null;
            if (int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out int uid))
                userId = uid;

            if (!userId.HasValue) return Ok(new List<object>());

            var results = new List<object>();
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"SELECT LeaveRequestId, LeaveType, StartDate, EndDate, DaysRequested, Reason, Status, ReviewNotes, SubmittedAt
                    FROM LeaveRequests WHERE UserId = @p0 ORDER BY SubmittedAt DESC";
                var p = cmd.CreateParameter(); p.ParameterName = "@p0"; p.Value = userId.Value;
                cmd.Parameters.Add(p);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    results.Add(new
                    {
                        leaveRequestId = reader.GetInt32(0),
                        leaveType = reader.GetString(1),
                        startDate = reader.GetDateTime(2),
                        endDate = reader.GetDateTime(3),
                        daysRequested = reader.GetInt32(4),
                        reason = reader.IsDBNull(5) ? null : reader.GetString(5),
                        status = reader.GetString(6),
                        reviewNotes = reader.IsDBNull(7) ? null : reader.GetString(7),
                        submittedAt = reader.GetDateTime(8)
                    });
                }
            }
            finally { await conn.CloseAsync(); }

            return Ok(results);
        }

        // PUT api/leave-requests/{id}/review — HR approves/rejects
        [HttpPut("{id}/review")]
        public async Task<IActionResult> Review(int id, [FromBody] ReviewLeaveRequestDto dto)
        {
            if (dto.Status != "Approved" && dto.Status != "Rejected")
                return BadRequest(new { message = "Status must be Approved or Rejected" });

            var reviewerName = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? "HR";

            var affected = await _context.Database.ExecuteSqlRawAsync(@"
                UPDATE LeaveRequests SET Status=@p0, ReviewedBy=@p1, ReviewedAt=GETUTCDATE(), ReviewNotes=@p2, UpdatedAt=GETUTCDATE()
                WHERE LeaveRequestId=@p3",
                dto.Status, reviewerName, dto.Notes as object ?? DBNull.Value, id);

            if (affected == 0) return NotFound();
            return Ok(new { message = $"Request {dto.Status.ToLower()}" });
        }

        // GET api/leave-requests/counts — badge counts for HR
        [HttpGet("counts")]
        public async Task<IActionResult> GetCounts()
        {
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            int pending = 0, approved = 0, rejected = 0;
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT Status, COUNT(*) FROM LeaveRequests GROUP BY Status";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var s = reader.GetString(0); var c = reader.GetInt32(1);
                    if (s == "Pending") pending = c;
                    else if (s == "Approved") approved = c;
                    else if (s == "Rejected") rejected = c;
                }
            }
            finally { await conn.CloseAsync(); }

            return Ok(new { pending, approved, rejected, total = pending + approved + rejected });
        }
    }

    public class SubmitLeaveRequestDto
    {
        public string LeaveType { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Reason { get; set; }
        public string? ContactNumber { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeEmail { get; set; }
        public string? Department { get; set; }
    }

    public class ReviewLeaveRequestDto
    {
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }
}
