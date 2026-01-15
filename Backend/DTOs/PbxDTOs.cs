namespace ProjectTracker.API.DTOs
{
    /// <summary>
    /// Configuration settings for PBX integration
    /// </summary>
    public class PbxSettings
    {
        public string BaseUrl { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string CdrApiUsername { get; set; } = string.Empty;
        public string CdrApiPassword { get; set; } = string.Empty;
        public int SessionTimeoutMinutes { get; set; } = 25;
        public int PollIntervalSeconds { get; set; } = 5;
        public bool AllowSelfSignedCertificate { get; set; } = true;
        public string PbxModel { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response containing list of active calls
    /// </summary>
    public class ActiveCallsResponse
    {
        public DateTime LastUpdatedUtc { get; set; } = DateTime.UtcNow;
        public List<ActiveCallDto> Calls { get; set; } = new();
        public int TotalActiveCalls { get; set; }
        public int TotalRinging { get; set; }
        public int TotalTalking { get; set; }
        public int TotalOnHold { get; set; }
        public bool IsAvailable { get; set; } = true;
        public string? ErrorMessage { get; set; }
    }

    /// <summary>
    /// Represents a single active call
    /// </summary>
    public class ActiveCallDto
    {
        public string CallId { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // Ringing, Talking, Held, Unknown
        public string Direction { get; set; } = string.Empty; // Inbound, Outbound, Internal
        public DateTime StartedUtc { get; set; }
        public int DurationSeconds { get; set; }
        public string Extension { get; set; } = string.Empty;
        public string? ExtensionDisplayName { get; set; }
        public string? DepartmentName { get; set; }
        public string RemoteNumber { get; set; } = string.Empty;
        public string? RemoteName { get; set; }
        public string? Trunk { get; set; }
        public string? QueueName { get; set; }
        public bool IsRecording { get; set; }
        public string? Channel { get; set; }
        public string? LinkedChannel { get; set; }
    }

    /// <summary>
    /// Call detail for expanded view
    /// </summary>
    public class CallDetailDto : ActiveCallDto
    {
        public string? CallerIdNumber { get; set; }
        public string? CallerIdName { get; set; }
        public string? CalleeNumber { get; set; }
        public List<string> LinkedChannels { get; set; } = new();
        public string? BridgeId { get; set; }
        public string? Context { get; set; }
    }

    /// <summary>
    /// CDR (Call Detail Record) for call history
    /// </summary>
    public class CdrRecordDto
    {
        public string CallId { get; set; } = string.Empty;
        public DateTime? StartTime { get; set; }
        public DateTime? AnswerTime { get; set; }
        public DateTime? EndTime { get; set; }
        public int Duration { get; set; }
        public int BillableSeconds { get; set; }
        public string Caller { get; set; } = string.Empty;
        public string Callee { get; set; } = string.Empty;
        public string? CallerName { get; set; }
        public string? CalleeName { get; set; }
        public string? CallerDepartment { get; set; }
        public string? CalleeDepartment { get; set; }
        public string Direction { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // Answered, No Answer, Busy, Failed
        public string? TrunkName { get; set; }
        public string? RecordingUrl { get; set; }
    }

    /// <summary>
    /// CDR query parameters
    /// </summary>
    public class CdrQueryDto
    {
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public string? Extension { get; set; }
        public string? Direction { get; set; }
        public string? Status { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    /// <summary>
    /// CDR response with pagination
    /// </summary>
    public class CdrResponse
    {
        public List<CdrRecordDto> Records { get; set; } = new();
        public int TotalRecords { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
        public string? ErrorMessage { get; set; }
    }

    /// <summary>
    /// Extension status information
    /// </summary>
    public class ExtensionStatusDto
    {
        public string Extension { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string Status { get; set; } = string.Empty; // Available, Busy, Ringing, DND, Unavailable, Unknown
        public string? Department { get; set; }
        public bool IsRegistered { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public DateTime? LastActivity { get; set; }
    }

    /// <summary>
    /// PBX system status
    /// </summary>
    public class PbxStatusDto
    {
        public bool IsConnected { get; set; }
        public DateTime? LastSuccessfulPoll { get; set; }
        public int ActiveCalls { get; set; }
        public int RegisteredExtensions { get; set; }
        public int TotalExtensions { get; set; }
        public int RecentCallsCount { get; set; }
        public string? PbxModel { get; set; }
        public string? SystemVersion { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
