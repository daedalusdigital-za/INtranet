using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Services
{
    public interface IReportCacheService
    {
        /// <summary>Try to get a cached report. Returns null if not found or expired.</summary>
        Task<ReportCacheResult?> GetCachedReportAsync(string reportType, DateTime fromDate, DateTime toDate, string? extraParams = null);

        /// <summary>Store a generated report in the cache.</summary>
        Task StoreCachedReportAsync(string reportType, DateTime fromDate, DateTime toDate, object result, int generationTimeMs, string? generatedBy = null, string? extraParams = null, TimeSpan? customTtl = null);

        /// <summary>Invalidate all cached reports (e.g., after a new data import).</summary>
        Task InvalidateAllAsync();

        /// <summary>Invalidate cached reports for a specific report type.</summary>
        Task InvalidateByTypeAsync(string reportType);

        /// <summary>Invalidate cached reports that overlap a date range (e.g., new invoices imported for those dates).</summary>
        Task InvalidateByDateRangeAsync(DateTime fromDate, DateTime toDate);

        /// <summary>Get cache statistics for the admin panel.</summary>
        Task<ReportCacheStats> GetStatsAsync();

        /// <summary>Clean up expired cache entries.</summary>
        Task CleanupExpiredAsync();

        /// <summary>Get all cached report entries (for admin viewing).</summary>
        Task<List<ReportCacheEntry>> GetAllEntriesAsync();
    }

    public class ReportCacheResult
    {
        public string ResultJson { get; set; } = string.Empty;
        public DateTime GeneratedAt { get; set; }
        public int OriginalGenerationTimeMs { get; set; }
        public int HitCount { get; set; }
        public bool FromCache => true;
    }

    public class ReportCacheStats
    {
        public int TotalEntries { get; set; }
        public int ExpiredEntries { get; set; }
        public long TotalSizeBytes { get; set; }
        public int TotalHits { get; set; }
        public double EstimatedTimeSavedSeconds { get; set; }
        public Dictionary<string, int> EntriesByType { get; set; } = new();
    }

    public class ReportCacheEntry
    {
        public int Id { get; set; }
        public string ReportType { get; set; } = string.Empty;
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public DateTime GeneratedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public int GenerationTimeMs { get; set; }
        public int HitCount { get; set; }
        public DateTime? LastAccessedAt { get; set; }
        public long ResultSizeBytes { get; set; }
        public string? GeneratedBy { get; set; }
        public bool IsExpired => DateTime.UtcNow > ExpiresAt;
    }

    public class ReportCacheService : IReportCacheService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ReportCacheService> _logger;

        // Default TTLs per report type
        private static readonly Dictionary<string, TimeSpan> DefaultTtls = new()
        {
            // Sales reports — data only changes on new imports, so cache for 4 hours
            { "sales-summary", TimeSpan.FromHours(4) },
            { "customer-analysis", TimeSpan.FromHours(4) },
            { "province-breakdown", TimeSpan.FromHours(4) },
            { "product-performance", TimeSpan.FromHours(4) },
            // Operational reports — shorter TTL since loads/dispatches change more often
            { "daily-dispatch", TimeSpan.FromMinutes(15) },
            { "invoice-summary", TimeSpan.FromHours(1) },
            { "delivery-performance", TimeSpan.FromHours(1) },
            { "driver-performance", TimeSpan.FromHours(1) },
        };

        public ReportCacheService(IServiceScopeFactory scopeFactory, ILogger<ReportCacheService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task<ReportCacheResult?> GetCachedReportAsync(string reportType, DateTime fromDate, DateTime toDate, string? extraParams = null)
        {
            var cacheKey = ComputeCacheKey(reportType, fromDate, toDate, extraParams);

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var entry = await db.ReportCaches
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.CacheKey == cacheKey && r.ExpiresAt > DateTime.UtcNow);

            if (entry == null)
            {
                _logger.LogDebug("ReportCache MISS: {ReportType} ({From:yyyy-MM-dd} to {To:yyyy-MM-dd})", reportType, fromDate, toDate);
                return null;
            }

            // Update hit count and last accessed (fire-and-forget, don't block the response)
            _ = Task.Run(async () =>
            {
                try
                {
                    using var updateScope = _scopeFactory.CreateScope();
                    var updateDb = updateScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var toUpdate = await updateDb.ReportCaches.FindAsync(entry.Id);
                    if (toUpdate != null)
                    {
                        toUpdate.HitCount++;
                        toUpdate.LastAccessedAt = DateTime.UtcNow;
                        await updateDb.SaveChangesAsync();
                    }
                }
                catch { /* non-critical */ }
            });

            _logger.LogInformation("ReportCache HIT: {ReportType} ({From:yyyy-MM-dd} to {To:yyyy-MM-dd}) — saved {Ms}ms, hit #{Count}",
                reportType, fromDate, toDate, entry.GenerationTimeMs, entry.HitCount + 1);

            return new ReportCacheResult
            {
                ResultJson = entry.ResultJson,
                GeneratedAt = entry.GeneratedAt,
                OriginalGenerationTimeMs = entry.GenerationTimeMs,
                HitCount = entry.HitCount + 1
            };
        }

        public async Task StoreCachedReportAsync(string reportType, DateTime fromDate, DateTime toDate, object result, int generationTimeMs, string? generatedBy = null, string? extraParams = null, TimeSpan? customTtl = null)
        {
            var cacheKey = ComputeCacheKey(reportType, fromDate, toDate, extraParams);
            var ttl = customTtl ?? GetTtl(reportType, fromDate, toDate);

            var json = JsonSerializer.Serialize(result, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            });

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Upsert — replace if the same key exists
            var existing = await db.ReportCaches.FirstOrDefaultAsync(r => r.CacheKey == cacheKey);
            if (existing != null)
            {
                existing.ResultJson = json;
                existing.GeneratedAt = DateTime.UtcNow;
                existing.ExpiresAt = DateTime.UtcNow.Add(ttl);
                existing.GenerationTimeMs = generationTimeMs;
                existing.ResultSizeBytes = Encoding.UTF8.GetByteCount(json);
                existing.HitCount = 0;
                existing.LastAccessedAt = null;
                existing.GeneratedBy = generatedBy;
            }
            else
            {
                db.ReportCaches.Add(new ReportCache
                {
                    CacheKey = cacheKey,
                    ReportType = reportType,
                    FromDate = fromDate,
                    ToDate = toDate,
                    Parameters = extraParams,
                    ResultJson = json,
                    GeneratedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.Add(ttl),
                    GenerationTimeMs = generationTimeMs,
                    ResultSizeBytes = Encoding.UTF8.GetByteCount(json),
                    GeneratedBy = generatedBy
                });
            }

            await db.SaveChangesAsync();
            _logger.LogInformation("ReportCache STORE: {ReportType} ({From:yyyy-MM-dd} to {To:yyyy-MM-dd}) — {Size}KB, TTL {Ttl}",
                reportType, fromDate, toDate, Encoding.UTF8.GetByteCount(json) / 1024, ttl);
        }

        public async Task InvalidateAllAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var count = await db.ReportCaches.ExecuteDeleteAsync();
            _logger.LogInformation("ReportCache INVALIDATE ALL: {Count} entries cleared", count);
        }

        public async Task InvalidateByTypeAsync(string reportType)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var count = await db.ReportCaches
                .Where(r => r.ReportType == reportType)
                .ExecuteDeleteAsync();
            _logger.LogInformation("ReportCache INVALIDATE TYPE {Type}: {Count} entries cleared", reportType, count);
        }

        public async Task InvalidateByDateRangeAsync(DateTime fromDate, DateTime toDate)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Invalidate any cached report whose date range overlaps with the new data
            var count = await db.ReportCaches
                .Where(r => r.FromDate <= toDate && r.ToDate >= fromDate)
                .ExecuteDeleteAsync();

            _logger.LogInformation("ReportCache INVALIDATE RANGE ({From:yyyy-MM-dd} to {To:yyyy-MM-dd}): {Count} entries cleared",
                fromDate, toDate, count);
        }

        public async Task<ReportCacheStats> GetStatsAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var entries = await db.ReportCaches.AsNoTracking().ToListAsync();
            var now = DateTime.UtcNow;

            return new ReportCacheStats
            {
                TotalEntries = entries.Count,
                ExpiredEntries = entries.Count(e => e.ExpiresAt <= now),
                TotalSizeBytes = entries.Sum(e => e.ResultSizeBytes),
                TotalHits = entries.Sum(e => e.HitCount),
                EstimatedTimeSavedSeconds = entries.Sum(e => e.HitCount * e.GenerationTimeMs) / 1000.0,
                EntriesByType = entries.GroupBy(e => e.ReportType).ToDictionary(g => g.Key, g => g.Count())
            };
        }

        public async Task CleanupExpiredAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var count = await db.ReportCaches
                .Where(r => r.ExpiresAt <= DateTime.UtcNow)
                .ExecuteDeleteAsync();

            if (count > 0)
                _logger.LogInformation("ReportCache CLEANUP: {Count} expired entries removed", count);
        }

        public async Task<List<ReportCacheEntry>> GetAllEntriesAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            return await db.ReportCaches
                .AsNoTracking()
                .OrderByDescending(r => r.GeneratedAt)
                .Select(r => new ReportCacheEntry
                {
                    Id = r.Id,
                    ReportType = r.ReportType,
                    FromDate = r.FromDate,
                    ToDate = r.ToDate,
                    GeneratedAt = r.GeneratedAt,
                    ExpiresAt = r.ExpiresAt,
                    GenerationTimeMs = r.GenerationTimeMs,
                    HitCount = r.HitCount,
                    LastAccessedAt = r.LastAccessedAt,
                    ResultSizeBytes = r.ResultSizeBytes,
                    GeneratedBy = r.GeneratedBy
                })
                .ToListAsync();
        }

        // ─── Private helpers ───

        private static string ComputeCacheKey(string reportType, DateTime fromDate, DateTime toDate, string? extraParams)
        {
            // Normalize dates to date-only (strip time) for consistent cache keys
            var keyString = $"{reportType}|{fromDate:yyyy-MM-dd}|{toDate:yyyy-MM-dd}|{extraParams ?? ""}";
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(keyString));
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private static TimeSpan GetTtl(string reportType, DateTime fromDate, DateTime toDate)
        {
            // Historical reports (end date in the past) — cache for 24 hours since data won't change
            if (toDate.Date < DateTime.UtcNow.Date)
            {
                return TimeSpan.FromHours(24);
            }

            // Reports including today — use default TTL per type
            if (DefaultTtls.TryGetValue(reportType, out var ttl))
            {
                return ttl;
            }

            // Fallback: 1 hour
            return TimeSpan.FromHours(1);
        }
    }
}
