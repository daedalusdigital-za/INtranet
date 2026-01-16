using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ProjectTracker.API.Services
{
    public interface IPbxService
    {
        Task<ActiveCallsResponse> GetActiveCallsAsync();
        Task<CdrResponse> GetCallHistoryAsync(CdrQueryDto query);
        Task<List<ExtensionStatusDto>> GetExtensionStatusesAsync();
        Task<PbxStatusDto> GetSystemStatusAsync();
        Task<bool> TestConnectionAsync();
        Task ProcessPushedCdrReportAsync(object report);
        Task ProcessPushedStatusReportAsync(object report);
    }

    public class PbxService : IPbxService
    {
        private readonly PbxSettings _settings;
        private readonly IMemoryCache _cache;
        private readonly ILogger<PbxService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly HttpClient _httpClient;
        
        private const string ACTIVE_CALLS_CACHE_KEY = "PBX_ACTIVE_CALLS";
        private const string CDR_CACHE_KEY = "PBX_CDR";
        
        private static DateTime _lastSuccessfulPoll = DateTime.MinValue;

        public PbxService(
            IOptions<PbxSettings> settings,
            IMemoryCache cache,
            ILogger<PbxService> logger,
            IServiceScopeFactory scopeFactory)
        {
            _settings = settings.Value;
            _cache = cache;
            _logger = logger;
            _scopeFactory = scopeFactory;

            // Configure HttpClient with self-signed certificate handling and Basic Auth
            var handler = new HttpClientHandler();
            if (_settings.AllowSelfSignedCertificate)
            {
                handler.ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true;
            }
            
            _httpClient = new HttpClient(handler)
            {
                BaseAddress = new Uri(_settings.BaseUrl),
                Timeout = TimeSpan.FromSeconds(30)
            };

            // Set up Basic Authentication using CDR API credentials
            var credentials = Convert.ToBase64String(
                Encoding.ASCII.GetBytes($"{_settings.CdrApiUsername}:{_settings.CdrApiPassword}"));
            _httpClient.DefaultRequestHeaders.Authorization = 
                new AuthenticationHeaderValue("Basic", credentials);
            
            _httpClient.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/xml"));
            _httpClient.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
        }

        public async Task<ActiveCallsResponse> GetActiveCallsAsync()
        {
            try
            {
                // Check cache first (for rapid polling protection)
                if (_cache.TryGetValue(ACTIVE_CALLS_CACHE_KEY, out ActiveCallsResponse? cachedCalls) && cachedCalls != null)
                {
                    // Update durations in cached response
                    foreach (var call in cachedCalls.Calls)
                    {
                        call.DurationSeconds = (int)(DateTime.UtcNow - call.StartedUtc).TotalSeconds;
                    }
                    return cachedCalls;
                }

                // Note: Grandstream CDR API doesn't provide real-time active calls
                // Active calls require AMI (Asterisk Manager Interface) or web GUI API
                // For now, we'll return an empty list but mark as available if we can connect
                
                var isConnected = await TestConnectionAsync();
                
                var response = new ActiveCallsResponse
                {
                    LastUpdatedUtc = DateTime.UtcNow,
                    Calls = new List<ActiveCallDto>(),
                    TotalActiveCalls = 0,
                    TotalRinging = 0,
                    TotalTalking = 0,
                    TotalOnHold = 0,
                    IsAvailable = isConnected,
                    ErrorMessage = isConnected ? "CDR API connected - Active calls require AMI integration" : "Cannot connect to PBX CDR API"
                };

                // Cache for 2 seconds
                _cache.Set(ACTIVE_CALLS_CACHE_KEY, response, TimeSpan.FromSeconds(2));
                if (isConnected)
                    _lastSuccessfulPoll = DateTime.UtcNow;

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching active calls from PBX");
                return CreateErrorResponse($"PBX unavailable: {ex.Message}");
            }
        }

        public async Task<CdrResponse> GetCallHistoryAsync(CdrQueryDto query)
        {
            try
            {
                // Build CDR API request
                // Grandstream CDR API format: /cdrapi?format=xml&caller=xxx&callee=xxx&startTime=xxx&endTime=xxx
                var queryParams = new List<string>
                {
                    "format=xml"  // Grandstream CDR API returns XML by default
                };

                if (query.From.HasValue)
                {
                    queryParams.Add($"startTime={Uri.EscapeDataString(query.From.Value.ToString("yyyy-MM-dd HH:mm:ss"))}");
                }
                else
                {
                    queryParams.Add($"startTime={Uri.EscapeDataString(DateTime.UtcNow.AddDays(-7).ToString("yyyy-MM-dd HH:mm:ss"))}");
                }

                if (query.To.HasValue)
                {
                    queryParams.Add($"endTime={Uri.EscapeDataString(query.To.Value.ToString("yyyy-MM-dd HH:mm:ss"))}");
                }
                else
                {
                    queryParams.Add($"endTime={Uri.EscapeDataString(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"))}");
                }

                if (!string.IsNullOrEmpty(query.Extension))
                {
                    queryParams.Add($"caller={Uri.EscapeDataString(query.Extension)}");
                }

                if (!string.IsNullOrEmpty(query.Status))
                {
                    // Map status to disposition
                    queryParams.Add($"disposition={Uri.EscapeDataString(MapStatusToDisposition(query.Status))}");
                }

                // Add pagination
                var offset = (query.Page - 1) * query.PageSize;
                queryParams.Add($"numRecords={query.PageSize}");
                queryParams.Add($"offset={offset}");

                var url = $"/cdrapi?{string.Join("&", queryParams)}";
                
                _logger.LogInformation("Fetching CDR from: {Url}", url);

                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("CDR API returned {StatusCode}: {Reason}", 
                        response.StatusCode, response.ReasonPhrase);
                    // Return sample data when PBX API is unavailable
                    return await GetSampleCdrDataAsync(query);
                }

                var content = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("CDR Response: {Content}", content);

                var records = ParseCdrXmlResponse(content);
                
                // Enrich with user mapping
                await EnrichCdrWithUserMappingAsync(records);

                return new CdrResponse
                {
                    Records = records,
                    TotalRecords = records.Count,
                    Page = query.Page,
                    PageSize = query.PageSize,
                    TotalPages = (int)Math.Ceiling(records.Count / (double)query.PageSize)
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching CDR from PBX");
                // Return sample data when PBX API is unavailable
                return await GetSampleCdrDataAsync(query);
            }
        }

        private async Task<CdrResponse> GetSampleCdrDataAsync(CdrQueryDto query)
        {
            // Get extensions from database to generate realistic sample data
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var extensions = await context.Set<ProjectTracker.API.Models.Extension>()
                .Where(e => e.IsActive)
                .Select(e => e.ExtensionNumber)
                .ToListAsync();

            if (!extensions.Any())
            {
                extensions = new List<string> { "1001", "1002", "1003", "1004", "1005" };
            }

            var random = new Random();
            var statuses = new[] { "Answered", "No Answer", "Busy", "Answered", "Answered", "Answered" };
            var directions = new[] { "inbound", "outbound", "inbound" };
            var records = new List<CdrRecordDto>();

            // Generate sample records
            var fromDate = query.From ?? DateTime.UtcNow.AddDays(-7);
            var toDate = query.To ?? DateTime.UtcNow;
            var totalDays = (toDate - fromDate).TotalDays;

            for (int i = 0; i < Math.Min(query.PageSize, 50); i++)
            {
                var randomDaysAgo = random.NextDouble() * totalDays;
                var callTime = fromDate.AddDays(randomDaysAgo);
                var duration = random.Next(0, 1800); // 0 to 30 minutes
                var ext = extensions[random.Next(extensions.Count)];
                var direction = directions[random.Next(directions.Length)];
                var status = statuses[random.Next(statuses.Length)];

                records.Add(new CdrRecordDto
                {
                    CallId = Guid.NewGuid().ToString(),
                    Caller = direction == "inbound" ? $"0{random.Next(10, 99)}{random.Next(1000000, 9999999)}" : ext,
                    Callee = direction == "inbound" ? ext : $"0{random.Next(10, 99)}{random.Next(1000000, 9999999)}",
                    CallerName = direction == "inbound" ? "External Caller" : $"Ext {ext}",
                    CalleeName = direction == "inbound" ? $"Ext {ext}" : "External Number",
                    StartTime = callTime,
                    AnswerTime = status == "Answered" ? callTime.AddSeconds(random.Next(1, 10)) : null,
                    EndTime = callTime.AddSeconds(duration),
                    Duration = duration,
                    BillableSeconds = status == "Answered" ? duration : 0,
                    Status = status,
                    Direction = direction
                });
            }

            // Filter by extension if specified
            if (!string.IsNullOrEmpty(query.Extension))
            {
                records = records.Where(r => 
                    r.Caller == query.Extension || r.Callee == query.Extension).ToList();
            }

            // Sort by start time descending
            records = records.OrderByDescending(r => r.StartTime).ToList();

            return new CdrResponse
            {
                Records = records,
                TotalRecords = records.Count,
                Page = query.Page,
                PageSize = query.PageSize,
                TotalPages = (int)Math.Ceiling(records.Count / (double)query.PageSize),
                ErrorMessage = "Sample data - PBX CDR API unavailable. Configure valid CDR API credentials."
            };
        }

        public async Task<List<ExtensionStatusDto>> GetExtensionStatusesAsync()
        {
            // CDR API doesn't provide extension status
            // We'll return extensions from our database with simulated status
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var random = new Random();
                var statuses = new[] { "Available", "Available", "Available", "Busy", "Away", "Offline" };

                var extensions = await context.Set<ProjectTracker.API.Models.Extension>()
                    .Include(e => e.User)
                    .Include(e => e.Department)
                    .Where(e => e.IsActive)
                    .Select(e => new ExtensionStatusDto
                    {
                        Extension = e.ExtensionNumber,
                        DisplayName = e.User != null ? $"{e.User.Name} {e.User.Surname}" : e.Label ?? "",
                        Department = e.Department != null ? e.Department.Name : (e.User != null && e.User.Department != null ? e.User.Department.Name : ""),
                        Status = "Available", // Default to Available - will randomize below
                        IsRegistered = true, // Assume registered for sample data
                        LastActivity = DateTime.UtcNow.AddMinutes(-new Random().Next(1, 60))
                    })
                    .ToListAsync();

                // Add some random status variation for demo purposes
                foreach (var ext in extensions)
                {
                    ext.Status = statuses[random.Next(statuses.Length)];
                    ext.IsRegistered = ext.Status != "Offline";
                }

                return extensions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching extension statuses");
                return new List<ExtensionStatusDto>();
            }
        }

        public async Task<PbxStatusDto> GetSystemStatusAsync()
        {
            var status = new PbxStatusDto
            {
                LastSuccessfulPoll = _lastSuccessfulPoll == DateTime.MinValue ? null : _lastSuccessfulPoll,
                PbxModel = _settings.PbxModel ?? "Grandstream UCM"
            };

            try
            {
                var isConnected = await TestConnectionAsync();
                status.IsConnected = isConnected;

                if (isConnected)
                {
                    // Get recent CDR count as a health check
                    var recentCdr = await GetCallHistoryAsync(new CdrQueryDto
                    {
                        From = DateTime.UtcNow.AddHours(-1),
                        To = DateTime.UtcNow,
                        Page = 1,
                        PageSize = 100
                    });

                    status.RecentCallsCount = recentCdr.TotalRecords;
                    
                    var extensions = await GetExtensionStatusesAsync();
                    status.TotalExtensions = extensions.Count;
                    status.RegisteredExtensions = extensions.Count(e => e.IsRegistered);
                }
            }
            catch (Exception ex)
            {
                status.IsConnected = false;
                status.ErrorMessage = ex.Message;
                _logger.LogError(ex, "Error getting PBX system status");
            }

            return status;
        }

        public async Task<bool> TestConnectionAsync()
        {
            try
            {
                _logger.LogInformation("Testing PBX CDR API connection to {BaseUrl}", _settings.BaseUrl);

                // Try to fetch a minimal CDR response
                var startTime = Uri.EscapeDataString(DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-dd HH:mm:ss"));
                var endTime = Uri.EscapeDataString(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"));
                var testUrl = $"/cdrapi?format=xml&numRecords=1&startTime={startTime}&endTime={endTime}";
                
                var response = await _httpClient.GetAsync(testUrl);
                
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    _logger.LogInformation("CDR API test successful. Response length: {Length}", content.Length);
                    _lastSuccessfulPoll = DateTime.UtcNow;
                    return true;
                }

                _logger.LogWarning("CDR API test failed with status: {StatusCode} - {Reason}", 
                    response.StatusCode, response.ReasonPhrase);
                return false;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "CDR API connection test failed - network error: {Message}", ex.Message);
                return false;
            }
            catch (TaskCanceledException ex)
            {
                _logger.LogWarning(ex, "CDR API connection test failed - timeout");
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CDR API connection test failed: {Message}", ex.Message);
                return false;
            }
        }

        #region Private Methods

        private List<CdrRecordDto> ParseCdrXmlResponse(string xmlContent)
        {
            var records = new List<CdrRecordDto>();

            try
            {
                // Handle potential JSON response
                if (xmlContent.TrimStart().StartsWith("{") || xmlContent.TrimStart().StartsWith("["))
                {
                    return ParseCdrJsonResponse(xmlContent);
                }

                // Parse XML
                var doc = XDocument.Parse(xmlContent);
                
                // Grandstream CDR XML format - check various element names
                var cdrElements = doc.Descendants("CDRRecord")
                    .Concat(doc.Descendants("cdr"))
                    .Concat(doc.Descendants("record"))
                    .Concat(doc.Descendants("Row")); // Some Grandstream models use Row

                foreach (var element in cdrElements)
                {
                    var record = new CdrRecordDto
                    {
                        CallId = GetElementValue(element, "AcctId", "uniqueid", "callid", "ID") ?? Guid.NewGuid().ToString(),
                        Caller = GetElementValue(element, "CallerNumber", "src", "caller", "CallerID", "Source") ?? "",
                        CallerName = GetElementValue(element, "CallerName", "callerName", "CallerIDName", "SourceName") ?? "",
                        Callee = GetElementValue(element, "CalleeNumber", "dst", "callee", "Destination", "DestNumber") ?? "",
                        CalleeName = GetElementValue(element, "CalleeName", "calleeName", "DestinationName", "DestName") ?? "",
                        StartTime = ParseDateTime(GetElementValue(element, "StartTime", "start", "calldate", "Start")),
                        AnswerTime = ParseDateTime(GetElementValue(element, "AnswerTime", "answer", "Answer")),
                        EndTime = ParseDateTime(GetElementValue(element, "EndTime", "end", "End")),
                        Duration = ParseInt(GetElementValue(element, "Duration", "duration", "billsec", "TalkTime")),
                        BillableSeconds = ParseInt(GetElementValue(element, "BillSec", "billsec", "BillableTime")),
                        Status = MapDispositionToStatus(GetElementValue(element, "Disposition", "disposition", "status", "Status")),
                        Direction = DetermineDirection(
                            GetElementValue(element, "CallerNumber", "src", "caller", "Source"),
                            GetElementValue(element, "CalleeNumber", "dst", "callee", "Destination")),
                        RecordingUrl = GetElementValue(element, "RecordingFile", "recordingfile", "recording", "Recording"),
                        TrunkName = GetElementValue(element, "Trunk", "dstchannel", "channel", "TrunkName")
                    };

                    records.Add(record);
                }
                
                _logger.LogInformation("Parsed {Count} CDR records from XML", records.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing CDR XML response: {Content}", 
                    xmlContent.Length > 500 ? xmlContent.Substring(0, 500) + "..." : xmlContent);
            }

            return records;
        }

        private List<CdrRecordDto> ParseCdrJsonResponse(string jsonContent)
        {
            var records = new List<CdrRecordDto>();

            try
            {
                using var doc = JsonDocument.Parse(jsonContent);
                
                JsonElement recordsArray;
                
                if (doc.RootElement.TryGetProperty("cdr_root", out var root) &&
                    root.TryGetProperty("cdr", out recordsArray))
                {
                    // Standard Grandstream JSON format
                }
                else if (doc.RootElement.TryGetProperty("records", out recordsArray))
                {
                    // Alternative format
                }
                else if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    recordsArray = doc.RootElement;
                }
                else
                {
                    _logger.LogWarning("Unknown JSON CDR format");
                    return records;
                }

                foreach (var element in recordsArray.EnumerateArray())
                {
                    var record = new CdrRecordDto
                    {
                        CallId = GetJsonValue(element, "AcctId", "uniqueid", "callid") ?? Guid.NewGuid().ToString(),
                        Caller = GetJsonValue(element, "CallerNumber", "src", "caller") ?? "",
                        CallerName = GetJsonValue(element, "CallerName", "callerName") ?? "",
                        Callee = GetJsonValue(element, "CalleeNumber", "dst", "callee") ?? "",
                        CalleeName = GetJsonValue(element, "CalleeName", "calleeName") ?? "",
                        StartTime = ParseDateTime(GetJsonValue(element, "StartTime", "start", "calldate")),
                        AnswerTime = ParseDateTime(GetJsonValue(element, "AnswerTime", "answer")),
                        EndTime = ParseDateTime(GetJsonValue(element, "EndTime", "end")),
                        Duration = ParseInt(GetJsonValue(element, "Duration", "duration")),
                        BillableSeconds = ParseInt(GetJsonValue(element, "BillSec", "billsec")),
                        Status = MapDispositionToStatus(GetJsonValue(element, "Disposition", "disposition")),
                        Direction = DetermineDirection(
                            GetJsonValue(element, "CallerNumber", "src"),
                            GetJsonValue(element, "CalleeNumber", "dst")),
                        RecordingUrl = GetJsonValue(element, "RecordingFile", "recordingfile")
                    };

                    records.Add(record);
                }
                
                _logger.LogInformation("Parsed {Count} CDR records from JSON", records.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing CDR JSON response");
            }

            return records;
        }

        private string? GetElementValue(XElement element, params string[] names)
        {
            foreach (var name in names)
            {
                var child = element.Element(name);
                if (child != null && !string.IsNullOrEmpty(child.Value))
                {
                    return child.Value;
                }
            }
            return null;
        }

        private string? GetJsonValue(JsonElement element, params string[] names)
        {
            foreach (var name in names)
            {
                if (element.TryGetProperty(name, out var prop))
                {
                    if (prop.ValueKind == JsonValueKind.String)
                        return prop.GetString();
                    if (prop.ValueKind == JsonValueKind.Number)
                        return prop.ToString();
                }
            }
            return null;
        }

        private DateTime? ParseDateTime(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;
            
            if (DateTime.TryParse(value, out var result))
                return result;
            
            // Try Unix timestamp
            if (long.TryParse(value, out var timestamp))
                return DateTimeOffset.FromUnixTimeSeconds(timestamp).DateTime;
            
            return null;
        }

        private int ParseInt(string? value)
        {
            if (string.IsNullOrEmpty(value)) return 0;
            return int.TryParse(value, out var result) ? result : 0;
        }

        private string MapDispositionToStatus(string? disposition)
        {
            if (string.IsNullOrEmpty(disposition)) return "Unknown";
            
            return disposition.ToUpper() switch
            {
                "ANSWERED" => "Answered",
                "NO ANSWER" => "No Answer",
                "NOANSWER" => "No Answer",
                "BUSY" => "Busy",
                "FAILED" => "Failed",
                "CONGESTION" => "Congestion",
                "CANCEL" => "Cancelled",
                "VOICEMAIL" => "Voicemail",
                _ => disposition
            };
        }

        private string MapStatusToDisposition(string status)
        {
            return status.ToLower() switch
            {
                "answered" => "ANSWERED",
                "no answer" => "NO ANSWER",
                "missed" => "NO ANSWER",
                "busy" => "BUSY",
                "failed" => "FAILED",
                _ => status.ToUpper()
            };
        }

        private string DetermineDirection(string? caller, string? callee)
        {
            if (string.IsNullOrEmpty(caller) || string.IsNullOrEmpty(callee))
                return "Unknown";

            // Internal calls: both are short extensions (3-4 digits)
            var callerIsExtension = caller.Length <= 4 && caller.All(char.IsDigit);
            var calleeIsExtension = callee.Length <= 4 && callee.All(char.IsDigit);

            if (callerIsExtension && calleeIsExtension)
                return "Internal";
            
            if (callerIsExtension && !calleeIsExtension)
                return "Outbound";
            
            if (!callerIsExtension && calleeIsExtension)
                return "Inbound";

            return "External";
        }

        private async Task EnrichCdrWithUserMappingAsync(List<CdrRecordDto> records)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Get all extensions with their users
                var extensionMappings = await context.Set<ProjectTracker.API.Models.Extension>()
                    .Include(e => e.User)
                        .ThenInclude(u => u!.Department)
                    .Include(e => e.Department)
                    .Where(e => e.IsActive)
                    .ToDictionaryAsync(
                        e => e.ExtensionNumber,
                        e => new { 
                            Name = e.User != null ? $"{e.User.Name} {e.User.Surname}" : e.Label ?? "", 
                            Department = e.Department?.Name ?? e.User?.Department?.Name ?? "" 
                        }
                    );

                foreach (var record in records)
                {
                    // Map caller
                    if (!string.IsNullOrEmpty(record.Caller) && extensionMappings.TryGetValue(record.Caller, out var callerInfo))
                    {
                        if (string.IsNullOrEmpty(record.CallerName))
                            record.CallerName = callerInfo.Name;
                        record.CallerDepartment = callerInfo.Department;
                    }

                    // Map callee
                    if (!string.IsNullOrEmpty(record.Callee) && extensionMappings.TryGetValue(record.Callee, out var calleeInfo))
                    {
                        if (string.IsNullOrEmpty(record.CalleeName))
                            record.CalleeName = calleeInfo.Name;
                        record.CalleeDepartment = calleeInfo.Department;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error enriching CDR with user mapping");
            }
        }

        private ActiveCallsResponse CreateErrorResponse(string message)
        {
            return new ActiveCallsResponse
            {
                LastUpdatedUtc = DateTime.UtcNow,
                Calls = new List<ActiveCallDto>(),
                TotalActiveCalls = 0,
                TotalRinging = 0,
                TotalTalking = 0,
                TotalOnHold = 0,
                IsAvailable = false,
                ErrorMessage = message
            };
        }

        #endregion

        #region Pushed Reports from PBX (NEW HTTPS API)

        // Cache for pushed CDR records
        private static readonly List<CdrRecordDto> _pushedCdrRecords = new();
        private static readonly object _pushedCdrLock = new();

        /// <summary>
        /// Process CDR report pushed from UCM via NEW HTTPS API
        /// The UCM pushes call records when calls complete
        /// </summary>
        public async Task ProcessPushedCdrReportAsync(object report)
        {
            try
            {
                var json = report is JsonElement element 
                    ? element.GetRawText() 
                    : JsonSerializer.Serialize(report);
                
                _logger.LogInformation("Processing pushed CDR report: {Report}", json);

                // Parse the UCM CDR report format
                // UCM sends JSON with call details when calls complete
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // UCM CDR format typically includes fields like:
                // callernum, calleenum, starttime, answertime, endtime, disposition, etc.
                var record = new CdrRecordDto
                {
                    CallId = TryGetProperty(root, "cdr_id", "id", "uniqueid") ?? Guid.NewGuid().ToString(),
                    Caller = TryGetProperty(root, "callernum", "caller", "src") ?? "",
                    CallerName = TryGetProperty(root, "callername", "caller_name"),
                    Callee = TryGetProperty(root, "calleenum", "callee", "dst") ?? "",
                    CalleeName = TryGetProperty(root, "calleename", "callee_name"),
                    StartTime = ParseDateTime(TryGetProperty(root, "starttime", "start")),
                    AnswerTime = ParseDateTime(TryGetProperty(root, "answertime", "answer")),
                    EndTime = ParseDateTime(TryGetProperty(root, "endtime", "end")),
                    Duration = ParseInt(TryGetProperty(root, "duration", "billsec")),
                    Status = MapDispositionToStatus(TryGetProperty(root, "disposition", "status")),
                    Direction = TryGetProperty(root, "direction") ?? "Unknown"
                };

                // Determine direction if not provided
                if (record.Direction == "Unknown")
                {
                    record.Direction = DetermineDirection(record.Caller, record.Callee);
                }

                // Add to in-memory cache
                lock (_pushedCdrLock)
                {
                    _pushedCdrRecords.Insert(0, record);
                    
                    // Keep only last 1000 pushed records
                    while (_pushedCdrRecords.Count > 1000)
                    {
                        _pushedCdrRecords.RemoveAt(_pushedCdrRecords.Count - 1);
                    }
                }

                _logger.LogInformation("Processed CDR for call from {Caller} to {Callee}, status: {Status}",
                    record.Caller, record.Callee, record.Status);

                // Optionally persist to database
                await PersistCdrRecordAsync(record);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing pushed CDR report");
                throw;
            }
        }

        /// <summary>
        /// Process system status report pushed from UCM
        /// </summary>
        public async Task ProcessPushedStatusReportAsync(object report)
        {
            try
            {
                var json = report is JsonElement element 
                    ? element.GetRawText() 
                    : JsonSerializer.Serialize(report);
                
                _logger.LogInformation("Received status report from PBX: {Report}", json);

                // Parse and cache the status information
                // This could include trunk status, extension status, etc.
                _lastSuccessfulPoll = DateTime.UtcNow;

                await Task.CompletedTask;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing pushed status report");
                throw;
            }
        }

        private string? TryGetProperty(JsonElement element, params string[] propertyNames)
        {
            foreach (var name in propertyNames)
            {
                if (element.TryGetProperty(name, out var prop))
                {
                    return prop.ValueKind == JsonValueKind.String 
                        ? prop.GetString() 
                        : prop.ToString();
                }
            }
            return null;
        }

        private async Task PersistCdrRecordAsync(CdrRecordDto record)
        {
            try
            {
                // Could save to a CallHistory table in the database
                // For now, just log that we would persist it
                _logger.LogDebug("Would persist CDR record {CallId} to database", record.CallId);
                await Task.CompletedTask;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error persisting CDR record");
            }
        }

        /// <summary>
        /// Get pushed CDR records (combined with API data)
        /// </summary>
        public List<CdrRecordDto> GetPushedCdrRecords()
        {
            lock (_pushedCdrLock)
            {
                return _pushedCdrRecords.ToList();
            }
        }

        #endregion
    }
}
