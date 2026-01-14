using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;
using System.Security.Claims;
using System.Text.Json;

namespace ProjectTracker.API.Services
{
    public interface IAuditLogService
    {
        Task LogAsync(string action, string category, string entityType, int? entityId, string description, 
            string? details = null, string severity = "info", bool isSuccess = true, string? errorMessage = null);
        Task LogAsync(CreateAuditLogDto dto);
        Task<AuditLogPagedResult> GetLogsAsync(AuditLogFilterDto filter);
        Task<AuditLogStatsDto> GetStatsAsync();
        Task<List<AuditLogDto>> GetUserActivityAsync(int userId, int count = 50);
        Task<List<AuditLogDto>> GetRecentLogsAsync(int count = 100);
        void SetHttpContext(HttpContext context);
    }

    public class AuditLogService : IAuditLogService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<AuditLogService> _logger;
        private HttpContext? _httpContext;

        public AuditLogService(ApplicationDbContext context, ILogger<AuditLogService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public void SetHttpContext(HttpContext context)
        {
            _httpContext = context;
        }

        private (int? userId, string? userName, string? userEmail, string? userRole) GetCurrentUser()
        {
            if (_httpContext?.User?.Identity?.IsAuthenticated != true)
                return (null, null, null, null);

            var userIdClaim = _httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userName = _httpContext.User.FindFirst(ClaimTypes.Name)?.Value;
            var userEmail = _httpContext.User.FindFirst(ClaimTypes.Email)?.Value;
            var userRole = _httpContext.User.FindFirst(ClaimTypes.Role)?.Value;

            int? userId = int.TryParse(userIdClaim, out var id) ? id : null;

            return (userId, userName, userEmail, userRole);
        }

        private string? GetIpAddress()
        {
            if (_httpContext == null) return null;

            var forwardedFor = _httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrEmpty(forwardedFor))
            {
                return forwardedFor.Split(',')[0].Trim();
            }

            return _httpContext.Connection.RemoteIpAddress?.ToString();
        }

        private string? GetUserAgent()
        {
            return _httpContext?.Request.Headers["User-Agent"].FirstOrDefault();
        }

        public async Task LogAsync(string action, string category, string entityType, int? entityId, string description,
            string? details = null, string severity = "info", bool isSuccess = true, string? errorMessage = null)
        {
            try
            {
                var (userId, userName, userEmail, userRole) = GetCurrentUser();

                var log = new AuditLog
                {
                    Action = action,
                    Category = category,
                    EntityType = entityType,
                    EntityId = entityId,
                    Description = description,
                    Details = details,
                    UserId = userId,
                    UserName = userName,
                    UserEmail = userEmail,
                    UserRole = userRole,
                    IpAddress = GetIpAddress(),
                    UserAgent = GetUserAgent(),
                    Severity = severity,
                    IsSuccess = isSuccess,
                    ErrorMessage = errorMessage,
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(log);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create audit log for action: {Action}", action);
            }
        }

        public async Task LogAsync(CreateAuditLogDto dto)
        {
            await LogAsync(dto.Action, dto.Category, dto.EntityType, dto.EntityId, dto.Description,
                dto.Details, dto.Severity, dto.IsSuccess, dto.ErrorMessage);
        }

        public async Task<AuditLogPagedResult> GetLogsAsync(AuditLogFilterDto filter)
        {
            var query = _context.AuditLogs.AsQueryable();

            // Apply filters
            if (!string.IsNullOrEmpty(filter.Category) && filter.Category != "all")
                query = query.Where(l => l.Category == filter.Category);

            if (!string.IsNullOrEmpty(filter.Action))
                query = query.Where(l => l.Action.Contains(filter.Action));

            if (!string.IsNullOrEmpty(filter.EntityType))
                query = query.Where(l => l.EntityType == filter.EntityType);

            if (filter.UserId.HasValue)
                query = query.Where(l => l.UserId == filter.UserId);

            if (!string.IsNullOrEmpty(filter.Severity) && filter.Severity != "all")
                query = query.Where(l => l.Severity == filter.Severity);

            if (filter.StartDate.HasValue)
                query = query.Where(l => l.CreatedAt >= filter.StartDate.Value);

            if (filter.EndDate.HasValue)
                query = query.Where(l => l.CreatedAt <= filter.EndDate.Value);

            if (!string.IsNullOrEmpty(filter.SearchTerm))
            {
                var term = filter.SearchTerm.ToLower();
                query = query.Where(l => 
                    l.Description.ToLower().Contains(term) ||
                    l.Action.ToLower().Contains(term) ||
                    (l.UserName != null && l.UserName.ToLower().Contains(term)) ||
                    (l.UserEmail != null && l.UserEmail.ToLower().Contains(term)));
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalCount / filter.PageSize);

            var logs = await query
                .OrderByDescending(l => l.CreatedAt)
                .Skip((filter.Page - 1) * filter.PageSize)
                .Take(filter.PageSize)
                .Select(l => new AuditLogDto
                {
                    Id = l.LogId,
                    Action = l.Action,
                    Category = l.Category,
                    EntityType = l.EntityType,
                    EntityId = l.EntityId,
                    Description = l.Description,
                    Details = l.Details,
                    UserId = l.UserId,
                    UserName = l.UserName,
                    UserEmail = l.UserEmail,
                    UserRole = l.UserRole,
                    IpAddress = l.IpAddress,
                    Severity = l.Severity,
                    IsSuccess = l.IsSuccess,
                    ErrorMessage = l.ErrorMessage,
                    Timestamp = l.CreatedAt
                })
                .ToListAsync();

            return new AuditLogPagedResult
            {
                Logs = logs,
                TotalCount = totalCount,
                Page = filter.Page,
                PageSize = filter.PageSize,
                TotalPages = totalPages
            };
        }

        public async Task<AuditLogStatsDto> GetStatsAsync()
        {
            var today = DateTime.UtcNow.Date;
            var logs = await _context.AuditLogs.ToListAsync();

            var stats = new AuditLogStatsDto
            {
                TotalLogs = logs.Count,
                TodayLogs = logs.Count(l => l.CreatedAt.Date == today),
                SecurityEvents = logs.Count(l => l.Category == "security"),
                ErrorCount = logs.Count(l => !l.IsSuccess || l.Severity == "error" || l.Severity == "critical"),
                CategoryBreakdown = logs.GroupBy(l => l.Category)
                    .ToDictionary(g => g.Key, g => g.Count()),
                ActionBreakdown = logs.GroupBy(l => l.Action)
                    .OrderByDescending(g => g.Count())
                    .Take(10)
                    .ToDictionary(g => g.Key, g => g.Count()),
                MostActiveUsers = logs.Where(l => l.UserId.HasValue && l.UserName != null)
                    .GroupBy(l => new { l.UserId, l.UserName })
                    .OrderByDescending(g => g.Count())
                    .Take(5)
                    .Select(g => new ActiveUserDto
                    {
                        UserId = g.Key.UserId!.Value,
                        UserName = g.Key.UserName!,
                        ActionCount = g.Count()
                    })
                    .ToList()
            };

            return stats;
        }

        public async Task<List<AuditLogDto>> GetUserActivityAsync(int userId, int count = 50)
        {
            return await _context.AuditLogs
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.CreatedAt)
                .Take(count)
                .Select(l => new AuditLogDto
                {
                    Id = l.LogId,
                    Action = l.Action,
                    Category = l.Category,
                    EntityType = l.EntityType,
                    EntityId = l.EntityId,
                    Description = l.Description,
                    UserId = l.UserId,
                    UserName = l.UserName,
                    Severity = l.Severity,
                    IsSuccess = l.IsSuccess,
                    Timestamp = l.CreatedAt
                })
                .ToListAsync();
        }

        public async Task<List<AuditLogDto>> GetRecentLogsAsync(int count = 100)
        {
            return await _context.AuditLogs
                .OrderByDescending(l => l.CreatedAt)
                .Take(count)
                .Select(l => new AuditLogDto
                {
                    Id = l.LogId,
                    Action = l.Action,
                    Category = l.Category,
                    EntityType = l.EntityType,
                    EntityId = l.EntityId,
                    Description = l.Description,
                    UserId = l.UserId,
                    UserName = l.UserName,
                    UserEmail = l.UserEmail,
                    UserRole = l.UserRole,
                    IpAddress = l.IpAddress,
                    Severity = l.Severity,
                    IsSuccess = l.IsSuccess,
                    ErrorMessage = l.ErrorMessage,
                    Timestamp = l.CreatedAt
                })
                .ToListAsync();
        }
    }
}
