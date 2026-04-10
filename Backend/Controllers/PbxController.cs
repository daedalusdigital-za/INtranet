using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PbxController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PbxController> _logger;

        public PbxController(ApplicationDbContext context, ILogger<PbxController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/pbx/cdr
        [HttpGet("cdr")]
        public async Task<ActionResult<CdrResponse>> GetCallHistory(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            [FromQuery] string? extension,
            [FromQuery] string? callerNumber,
            [FromQuery] string? calleeNumber,
            [FromQuery] string? direction,
            [FromQuery] string? disposition,
            [FromQuery] int? minDuration,
            [FromQuery] int? maxDuration,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            try
            {
                var query = _context.CallRecords.AsNoTracking().AsQueryable();

                // Date range filter
                if (startDate.HasValue)
                    query = query.Where(c => c.StartTime >= startDate.Value);
                if (endDate.HasValue)
                    query = query.Where(c => c.StartTime <= endDate.Value);

                // Extension filter - matches caller, callee, or premier caller
                if (!string.IsNullOrWhiteSpace(extension))
                {
                    query = query.Where(c =>
                        c.CallerNumber == extension ||
                        c.CalleeNumber == extension ||
                        c.PremierCaller == extension ||
                        c.AnsweredBy == extension ||
                        c.DestChannelExtension == extension);
                }

                // Specific caller/callee filters
                if (!string.IsNullOrWhiteSpace(callerNumber))
                    query = query.Where(c => c.CallerNumber == callerNumber);
                if (!string.IsNullOrWhiteSpace(calleeNumber))
                    query = query.Where(c => c.CalleeNumber == calleeNumber);

                // Direction/call type filter
                if (!string.IsNullOrWhiteSpace(direction))
                    query = query.Where(c => c.CallType.ToLower() == direction.ToLower());

                // Disposition/status filter
                if (!string.IsNullOrWhiteSpace(disposition))
                    query = query.Where(c => c.CallStatus == disposition);

                // Duration filters
                if (minDuration.HasValue)
                    query = query.Where(c => c.TalkTime >= minDuration.Value);
                if (maxDuration.HasValue)
                    query = query.Where(c => c.TalkTime <= maxDuration.Value);

                // Get total count for pagination
                var totalRecords = await query.CountAsync();

                // Order by start time descending (most recent first) and paginate
                var records = await query
                    .OrderByDescending(c => c.StartTime)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                // Look up extension-to-user mappings for caller/callee names
                var extensionUsers = await _context.Extensions
                    .AsNoTracking()
                    .Include(e => e.User)
                    .Include(e => e.Department)
                    .Where(e => e.IsActive)
                    .ToListAsync();

                var extLookup = extensionUsers
                    .GroupBy(e => e.ExtensionNumber)
                    .ToDictionary(
                        g => g.Key,
                        g => g.First()
                    );

                var cdrRecords = records.Select(r => MapToDto(r, extLookup)).ToList();

                return Ok(new CdrResponse
                {
                    Records = cdrRecords,
                    TotalRecords = totalRecords,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)totalRecords / pageSize)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching call history");
                return StatusCode(500, new { error = "Failed to fetch call history" });
            }
        }

        // GET: api/pbx/active-calls
        [HttpGet("active-calls")]
        public ActionResult<ActiveCallsResponse> GetActiveCalls()
        {
            // No live PBX connection - return empty
            return Ok(new ActiveCallsResponse
            {
                Calls = new List<ActiveCallDto>(),
                TotalCalls = 0,
                InboundCalls = 0,
                OutboundCalls = 0,
                InternalCalls = 0,
                Timestamp = DateTime.UtcNow
            });
        }

        // GET: api/pbx/extension-status
        [HttpGet("extension-status")]
        public async Task<ActionResult<IEnumerable<ExtensionStatusDto>>> GetExtensionStatuses()
        {
            try
            {
                var extensions = await _context.Extensions
                    .AsNoTracking()
                    .Include(e => e.User)
                    .Include(e => e.Department)
                    .Where(e => e.IsActive)
                    .OrderBy(e => e.ExtensionNumber)
                    .ToListAsync();

                var result = extensions.Select(e => new ExtensionStatusDto
                {
                    Extension = e.ExtensionNumber,
                    Name = e.User != null ? e.User.FullName : e.Label ?? "Unassigned",
                    Status = "Available", // No live PBX data
                    StatusText = "Available",
                    IpAddress = "",
                    DeviceType = e.PhoneModel ?? "",
                    Registered = true,
                    LastSeen = DateTime.UtcNow,
                    CurrentCallId = "",
                    DepartmentId = e.DepartmentId ?? (e.User?.DepartmentId ?? 0),
                    DepartmentName = e.Department?.Name ?? ""
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching extension statuses");
                return StatusCode(500, new { error = "Failed to fetch extension statuses" });
            }
        }

        // GET: api/pbx/status
        [HttpGet("status")]
        public async Task<ActionResult<PbxStatusDto>> GetPbxStatus()
        {
            try
            {
                var totalExtensions = await _context.Extensions.CountAsync();
                var activeExtensions = await _context.Extensions.CountAsync(e => e.IsActive);
                var totalRecords = await _context.CallRecords.CountAsync();

                var earliest = await _context.CallRecords
                    .OrderBy(c => c.StartTime)
                    .Select(c => c.StartTime)
                    .FirstOrDefaultAsync();

                var latest = await _context.CallRecords
                    .OrderByDescending(c => c.StartTime)
                    .Select(c => c.StartTime)
                    .FirstOrDefaultAsync();

                return Ok(new PbxStatusDto
                {
                    Connected = true,
                    PbxModel = "3CX Phone System",
                    FirmwareVersion = "CDR Import",
                    Uptime = earliest != default ? $"Data from {earliest:yyyy-MM-dd} to {latest:yyyy-MM-dd} ({totalRecords:N0} records)" : "No data",
                    ActiveChannels = 0,
                    MaxChannels = 0,
                    RegisteredExtensions = activeExtensions,
                    TotalExtensions = totalExtensions,
                    LastUpdated = latest != default ? latest : DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching PBX status");
                return StatusCode(500, new { error = "Failed to fetch PBX status" });
            }
        }

        // GET: api/pbx/test-connection
        [HttpGet("test-connection")]
        public async Task<ActionResult> TestConnection()
        {
            try
            {
                var count = await _context.CallRecords.CountAsync();
                return Ok(new
                {
                    success = true,
                    message = $"Connected. {count:N0} call records available."
                });
            }
            catch (Exception ex)
            {
                return Ok(new
                {
                    success = false,
                    message = $"Error: {ex.Message}"
                });
            }
        }

        // GET: api/pbx/stats
        [HttpGet("stats")]
        public async Task<ActionResult> GetCallStats(
            [FromQuery] string? extension,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            try
            {
                var query = _context.CallRecords.AsNoTracking().AsQueryable();

                if (startDate.HasValue)
                    query = query.Where(c => c.StartTime >= startDate.Value);
                if (endDate.HasValue)
                    query = query.Where(c => c.StartTime <= endDate.Value);

                if (!string.IsNullOrWhiteSpace(extension))
                {
                    query = query.Where(c =>
                        c.CallerNumber == extension ||
                        c.CalleeNumber == extension ||
                        c.PremierCaller == extension ||
                        c.AnsweredBy == extension);
                }

                var total = await query.CountAsync();
                var answered = await query.CountAsync(c => c.CallStatus == "ANSWERED");
                var noAnswer = await query.CountAsync(c => c.CallStatus == "NO ANSWER");
                var busy = await query.CountAsync(c => c.CallStatus == "BUSY");
                var failed = await query.CountAsync(c => c.CallStatus == "FAILED");

                var inbound = await query.CountAsync(c => c.CallType == "Inbound");
                var outbound = await query.CountAsync(c => c.CallType == "Outbound");
                var internalCalls = await query.CountAsync(c => c.CallType == "Internal");

                var avgTalkTime = total > 0 ? await query.Where(c => c.TalkTime > 0).AverageAsync(c => (double?)c.TalkTime) ?? 0 : 0;

                return Ok(new
                {
                    totalCalls = total,
                    answered,
                    noAnswer,
                    busy,
                    failed,
                    inbound,
                    outbound,
                    internalCalls,
                    averageTalkTimeSeconds = Math.Round(avgTalkTime, 1),
                    averageTalkTimeFormatted = FormatDuration((int)avgTalkTime),
                    answerRate = total > 0 ? Math.Round((double)answered / total * 100, 1) : 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching call stats");
                return StatusCode(500, new { error = "Failed to fetch call stats" });
            }
        }

        #region Helper Methods

        private CdrRecordDto MapToDto(CallRecord r, Dictionary<string, Extension> extLookup)
        {
            var callerExt = extLookup.GetValueOrDefault(r.CallerNumber);
            var calleeExt = extLookup.GetValueOrDefault(r.CalleeNumber);
            var answeredByExt = !string.IsNullOrEmpty(r.AnsweredBy) ? extLookup.GetValueOrDefault(r.AnsweredBy) : null;

            // Determine the extension and extension name for this record
            string ext = "";
            string extName = "";
            if (r.CallerNumber.Length <= 3 && char.IsDigit(r.CallerNumber[0]))
            {
                ext = r.CallerNumber;
                extName = callerExt?.User != null ? callerExt.User.FullName : r.CallerName ?? "";
            }
            else if (r.CalleeNumber.Length <= 3 && char.IsDigit(r.CalleeNumber[0]))
            {
                ext = r.CalleeNumber;
                extName = calleeExt?.User != null ? calleeExt.User.FullName : "";
            }

            // Caller name - prefer user name from extension lookup
            string callerName = callerExt?.User != null
                ? callerExt.User.FullName
                : r.CallerName ?? r.CallerNumber;

            // Callee name
            string calleeName = "";
            if (answeredByExt?.User != null)
                calleeName = answeredByExt.User.FullName;
            else if (calleeExt?.User != null)
                calleeName = calleeExt.User.FullName;
            else
                calleeName = r.AnsweredBy ?? r.CalleeNumber;

            // Trunk name
            string trunkName = !string.IsNullOrEmpty(r.SourceTrunkName) ? r.SourceTrunkName :
                              !string.IsNullOrEmpty(r.DestinationTrunkName) ? r.DestinationTrunkName : "";

            return new CdrRecordDto
            {
                CallId = r.UniqueId ?? r.Id.ToString(),
                CallerNumber = r.CallerNumber,
                CallerName = callerName,
                CallerDepartment = callerExt?.Department?.Name ?? callerExt?.User?.Department?.Name ?? "",
                CalleeNumber = r.CalleeNumber,
                CalleeName = calleeName,
                CalleeDepartment = calleeExt?.Department?.Name ?? calleeExt?.User?.Department?.Name ?? "",
                Direction = r.CallType?.ToLower() ?? "unknown",
                StartTime = r.StartTime,
                AnswerTime = r.AnswerTime ?? r.StartTime,
                EndTime = r.EndTime ?? r.StartTime,
                Duration = r.CallTime,
                DurationFormatted = FormatDuration(r.CallTime),
                BillableSeconds = r.TalkTime,
                Disposition = r.CallStatus,
                TrunkName = trunkName,
                Extension = ext,
                ExtensionName = extName,
                RecordingUrl = "",
                DidNumber = "",
                QueueName = "",
                Source = r.CallerNumber,
                Destination = r.CalleeNumber,
                CallerIdNum = r.PremierCaller ?? r.CallerNumber,
                CallDate = r.StartTime,
                Status = r.CallStatus
            };
        }

        private static string FormatDuration(int totalSeconds)
        {
            if (totalSeconds <= 0) return "0:00";
            var hours = totalSeconds / 3600;
            var minutes = (totalSeconds % 3600) / 60;
            var seconds = totalSeconds % 60;
            if (hours > 0)
                return $"{hours}:{minutes:D2}:{seconds:D2}";
            return $"{minutes}:{seconds:D2}";
        }

        #endregion

        #region DTOs

        public class CdrResponse
        {
            public List<CdrRecordDto> Records { get; set; } = new();
            public int TotalRecords { get; set; }
            public int Page { get; set; }
            public int PageSize { get; set; }
            public int TotalPages { get; set; }
        }

        public class CdrRecordDto
        {
            public string CallId { get; set; } = "";
            public string CallerNumber { get; set; } = "";
            public string CallerName { get; set; } = "";
            public string? CallerDepartment { get; set; }
            public string CalleeNumber { get; set; } = "";
            public string CalleeName { get; set; } = "";
            public string? CalleeDepartment { get; set; }
            public string Direction { get; set; } = "";
            public DateTime StartTime { get; set; }
            public DateTime AnswerTime { get; set; }
            public DateTime EndTime { get; set; }
            public int Duration { get; set; }
            public string DurationFormatted { get; set; } = "";
            public int BillableSeconds { get; set; }
            public string Disposition { get; set; } = "";
            public string TrunkName { get; set; } = "";
            public string Extension { get; set; } = "";
            public string ExtensionName { get; set; } = "";
            public string RecordingUrl { get; set; } = "";
            public string DidNumber { get; set; } = "";
            public string QueueName { get; set; } = "";
            public string? Source { get; set; }
            public string? Destination { get; set; }
            public string? CallerIdNum { get; set; }
            public DateTime? CallDate { get; set; }
            public string? Status { get; set; }
        }

        public class ActiveCallsResponse
        {
            public List<ActiveCallDto> Calls { get; set; } = new();
            public int TotalCalls { get; set; }
            public int InboundCalls { get; set; }
            public int OutboundCalls { get; set; }
            public int InternalCalls { get; set; }
            public DateTime Timestamp { get; set; }
        }

        public class ActiveCallDto
        {
            public string CallId { get; set; } = "";
            public string CallerNumber { get; set; } = "";
            public string CallerName { get; set; } = "";
            public string CalleeNumber { get; set; } = "";
            public string CalleeName { get; set; } = "";
            public string Direction { get; set; } = "";
            public string Status { get; set; } = "";
            public DateTime StartTime { get; set; }
            public int Duration { get; set; }
            public string DurationFormatted { get; set; } = "";
            public string TrunkName { get; set; } = "";
            public string Extension { get; set; } = "";
            public string ExtensionName { get; set; } = "";
            public bool Answered { get; set; }
            public bool OnHold { get; set; }
            public bool IsRecording { get; set; }
        }

        public class ExtensionStatusDto
        {
            public string Extension { get; set; } = "";
            public string Name { get; set; } = "";
            public string Status { get; set; } = "";
            public string StatusText { get; set; } = "";
            public string IpAddress { get; set; } = "";
            public string DeviceType { get; set; } = "";
            public string? UserAgent { get; set; }
            public string? CallerIdName { get; set; }
            public bool Registered { get; set; }
            public DateTime LastSeen { get; set; }
            public string CurrentCallId { get; set; } = "";
            public int DepartmentId { get; set; }
            public string DepartmentName { get; set; } = "";
        }

        public class PbxStatusDto
        {
            public bool Connected { get; set; }
            public string PbxModel { get; set; } = "";
            public string FirmwareVersion { get; set; } = "";
            public string Uptime { get; set; } = "";
            public int ActiveChannels { get; set; }
            public int MaxChannels { get; set; }
            public int RegisteredExtensions { get; set; }
            public int TotalExtensions { get; set; }
            public DateTime LastUpdated { get; set; }
        }

        #endregion
    }
}
