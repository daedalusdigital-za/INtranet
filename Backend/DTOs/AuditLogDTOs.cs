namespace ProjectTracker.API.DTOs
{
    public class AuditLogDto
    {
        public int Id { get; set; }
        public string Action { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public int? EntityId { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? Details { get; set; }
        public int? UserId { get; set; }
        public string? UserName { get; set; }
        public string? UserEmail { get; set; }
        public string? UserRole { get; set; }
        public string? IpAddress { get; set; }
        public string Severity { get; set; } = "info";
        public bool IsSuccess { get; set; } = true;
        public string? ErrorMessage { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class CreateAuditLogDto
    {
        public string Action { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public int? EntityId { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? Details { get; set; }
        public string Severity { get; set; } = "info";
        public bool IsSuccess { get; set; } = true;
        public string? ErrorMessage { get; set; }
    }

    public class AuditLogFilterDto
    {
        public string? Category { get; set; }
        public string? Action { get; set; }
        public string? EntityType { get; set; }
        public int? UserId { get; set; }
        public string? Severity { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? SearchTerm { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    public class AuditLogPagedResult
    {
        public List<AuditLogDto> Logs { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    public class AuditLogStatsDto
    {
        public int TotalLogs { get; set; }
        public int TodayLogs { get; set; }
        public int SecurityEvents { get; set; }
        public int ErrorCount { get; set; }
        public Dictionary<string, int> CategoryBreakdown { get; set; } = new();
        public Dictionary<string, int> ActionBreakdown { get; set; } = new();
        public List<ActiveUserDto> MostActiveUsers { get; set; } = new();
    }

    public class ActiveUserDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public int ActionCount { get; set; }
    }
}
