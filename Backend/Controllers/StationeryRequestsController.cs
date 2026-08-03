using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ProjectTracker.API.Data;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/stationery-requests")]
    [Authorize]
    public class StationeryRequestsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _config;

        public StationeryRequestsController(ApplicationDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // POST api/stationery-requests  (multipart/form-data — quotes optional)
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Submit([FromForm] SubmitStationeryDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Items))
                return BadRequest(new { message = "Items are required" });

            var userName = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? dto.RequestedBy ?? "Unknown";
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email") ?? dto.RequestedByEmail;
            int? userId = null;
            if (int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out int uid))
                userId = uid;

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

            // Read up to 3 quote files
            byte[]? q1Data = null; string? q1Name = null;
            byte[]? q2Data = null; string? q2Name = null;
            byte[]? q3Data = null; string? q3Name = null;
            var files = Request.Form.Files;
            for (int fi = 0; fi < Math.Min(files.Count, 3); fi++)
            {
                var f = files[fi];
                using var ms = new MemoryStream();
                await f.CopyToAsync(ms);
                var bytes = ms.ToArray();
                if (fi == 0) { q1Data = bytes; q1Name = f.FileName; }
                else if (fi == 1) { q2Data = bytes; q2Name = f.FileName; }
                else { q3Data = bytes; q3Name = f.FileName; }
            }
            bool hasQuotes = q1Data != null;

            // Save quote files to disk (quotes folder on host, mounted at /app/quotes)
            var quotesDir = _config["QuotesPath"] ?? "/app/quotes";
            Directory.CreateDirectory(quotesDir);
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            var safeUser = string.Concat(userName.Split(Path.GetInvalidFileNameChars())).Replace(" ", "_");
            if (q1Data != null && q1Name != null)
            {
                var ext1 = Path.GetExtension(q1Name);
                await System.IO.File.WriteAllBytesAsync(Path.Combine(quotesDir, $"{timestamp}_{safeUser}_Q1{ext1}"), q1Data);
            }
            if (q2Data != null && q2Name != null)
            {
                var ext2 = Path.GetExtension(q2Name);
                await System.IO.File.WriteAllBytesAsync(Path.Combine(quotesDir, $"{timestamp}_{safeUser}_Q2{ext2}"), q2Data);
            }
            if (q3Data != null && q3Name != null)
            {
                var ext3 = Path.GetExtension(q3Name);
                await System.IO.File.WriteAllBytesAsync(Path.Combine(quotesDir, $"{timestamp}_{safeUser}_Q3{ext3}"), q3Data);
            }

            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"INSERT INTO StationeryRequests
                    (UserId, RequestedBy, RequestedByEmail, Department, Items, Quantity, Purpose, Priority, Status,
                     HasQuotes, Quote1FileName, Quote1Data, Quote2FileName, Quote2Data, Quote3FileName, Quote3Data, SubmittedAt)
                    VALUES (@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,'Pending',@p8,@p9,@p10,@p11,@p12,@p13,@p14,GETUTCDATE())";
                void AddParam(string name, object? val) { var p = cmd.CreateParameter(); p.ParameterName = name; p.Value = val ?? DBNull.Value; cmd.Parameters.Add(p); }
                AddParam("@p0", userId as object);
                AddParam("@p1", userName);
                AddParam("@p2", userEmail as object);
                AddParam("@p3", department as object);
                AddParam("@p4", dto.Items);
                AddParam("@p5", dto.Quantity as object);
                AddParam("@p6", dto.Purpose as object);
                AddParam("@p7", dto.Priority ?? "Normal");
                AddParam("@p8", hasQuotes);
                AddParam("@p9", q1Name as object);
                AddParam("@p10", q1Data as object);
                AddParam("@p11", q2Name as object);
                AddParam("@p12", q2Data as object);
                AddParam("@p13", q3Name as object);
                AddParam("@p14", q3Data as object);
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await conn.CloseAsync(); }

            return Ok(new { message = "Stationery request submitted successfully" });
        }

        // GET api/stationery-requests/{id}/quote/{n}  — download a quote file (n = 1,2,3)
        [HttpGet("{id}/quote/{n}")]
        public async Task<IActionResult> DownloadQuote(int id, int n)
        {
            if (n < 1 || n > 3) return BadRequest();
            var col = $"Quote{n}";
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $"SELECT [{col}FileName],[{col}Data] FROM StationeryRequests WHERE StationeryRequestId=@p0";
                var p = cmd.CreateParameter(); p.ParameterName = "@p0"; p.Value = id; cmd.Parameters.Add(p);
                using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync() || reader.IsDBNull(1)) return NotFound();
                var fileName = reader.IsDBNull(0) ? $"quote{n}.pdf" : reader.GetString(0);
                var data = (byte[])reader[1];
                var mime = fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ? "application/pdf"
                         : fileName.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ? "image/png"
                         : fileName.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".jpeg") ? "image/jpeg"
                         : "application/octet-stream";
                return File(data, mime, fileName);
            }
            finally { await conn.CloseAsync(); }
        }

        // GET api/stationery-requests
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? status = null)
        {
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            var results = new List<object>();
            try
            {
                using var cmd = conn.CreateCommand();
                var sql = @"SELECT StationeryRequestId, UserId, RequestedBy, RequestedByEmail, Department,
                    Items, Quantity, Purpose, Priority, Status, ReviewedBy, ReviewedAt, ReviewNotes,
                    SubmittedAt, UpdatedAt, HasQuotes FROM StationeryRequests";
                if (!string.IsNullOrWhiteSpace(status) && status != "all")
                    sql += " WHERE Status = @p0 ORDER BY SubmittedAt DESC";
                else
                    sql += " ORDER BY SubmittedAt DESC";
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
                        stationeryRequestId = reader.GetInt32(0),
                        userId = reader.IsDBNull(1) ? (int?)null : reader.GetInt32(1),
                        requestedBy = reader.GetString(2),
                        requestedByEmail = reader.IsDBNull(3) ? null : reader.GetString(3),
                        department = reader.IsDBNull(4) ? null : reader.GetString(4),
                        items = reader.GetString(5),
                        quantity = reader.IsDBNull(6) ? null : reader.GetString(6),
                        purpose = reader.IsDBNull(7) ? null : reader.GetString(7),
                        priority = reader.GetString(8),
                        status = reader.GetString(9),
                        reviewedBy = reader.IsDBNull(10) ? null : reader.GetString(10),
                        reviewedAt = reader.IsDBNull(11) ? (DateTime?)null : reader.GetDateTime(11),
                        reviewNotes = reader.IsDBNull(12) ? null : reader.GetString(12),
                        submittedAt = reader.GetDateTime(13),
                        updatedAt = reader.IsDBNull(14) ? (DateTime?)null : reader.GetDateTime(14),
                        hasQuotes = !reader.IsDBNull(15) && reader.GetBoolean(15),
                    });
                }
            }
            finally { await conn.CloseAsync(); }
            return Ok(results);
        }

        // GET api/stationery-requests/my
        [HttpGet("my")]
        public async Task<IActionResult> GetMy()
        {
            int? userId = null;
            if (int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out int uid))
                userId = uid;
            if (!userId.HasValue) return Ok(new List<object>());

            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            var results = new List<object>();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"SELECT StationeryRequestId, Items, Quantity, Purpose, Priority, Status, ReviewNotes, SubmittedAt
                    FROM StationeryRequests WHERE UserId = @p0 ORDER BY SubmittedAt DESC";
                var p = cmd.CreateParameter(); p.ParameterName = "@p0"; p.Value = userId.Value;
                cmd.Parameters.Add(p);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    results.Add(new
                    {
                        stationeryRequestId = reader.GetInt32(0),
                        items = reader.GetString(1),
                        quantity = reader.IsDBNull(2) ? null : reader.GetString(2),
                        purpose = reader.IsDBNull(3) ? null : reader.GetString(3),
                        priority = reader.GetString(4),
                        status = reader.GetString(5),
                        reviewNotes = reader.IsDBNull(6) ? null : reader.GetString(6),
                        submittedAt = reader.GetDateTime(7)
                    });
                }
            }
            finally { await conn.CloseAsync(); }
            return Ok(results);
        }

        // PUT api/stationery-requests/{id}/review
        [HttpPut("{id}/review")]
        public async Task<IActionResult> Review(int id, [FromBody] ReviewStationeryDto dto)
        {
            if (dto.Status != "Approved" && dto.Status != "Declined")
                return BadRequest(new { message = "Status must be Approved or Declined" });

            var reviewerName = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? "Finance";
            var affected = await _context.Database.ExecuteSqlRawAsync(@"
                UPDATE StationeryRequests SET Status=@p0, ReviewedBy=@p1, ReviewedAt=GETUTCDATE(), ReviewNotes=@p2, UpdatedAt=GETUTCDATE()
                WHERE StationeryRequestId=@p3",
                dto.Status, reviewerName, dto.Notes as object ?? DBNull.Value, id);

            if (affected == 0) return NotFound();
            return Ok(new { message = $"Request {dto.Status.ToLower()}" });
        }

        // GET api/stationery-requests/counts
        [HttpGet("counts")]
        public async Task<IActionResult> GetCounts()
        {
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            int pending = 0, approved = 0, declined = 0;
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT Status, COUNT(*) FROM StationeryRequests GROUP BY Status";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var s = reader.GetString(0); var c = reader.GetInt32(1);
                    if (s == "Pending") pending = c;
                    else if (s == "Approved") approved = c;
                    else if (s == "Declined") declined = c;
                }
            }
            finally { await conn.CloseAsync(); }
            return Ok(new { pending, approved, declined, total = pending + approved + declined });
        }
    }

    public class SubmitStationeryDto
    {
        public string Items { get; set; } = string.Empty;
        public string? Quantity { get; set; }
        public string? Purpose { get; set; }
        public string? Priority { get; set; }
        public string? RequestedBy { get; set; }
        public string? RequestedByEmail { get; set; }
        public string? Department { get; set; }
    }

    public class ReviewStationeryDto
    {
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }
}
