using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using System.Text;

namespace ProjectTracker.API.Services
{
    public interface IWellyMemoryService
    {
        /// <summary>Persist a new memory of something Welly did.</summary>
        Task<WellyMemory?> SaveMemoryAsync(
            string memoryType,
            string title,
            string summary,
            string? fullContent = null,
            string? entityName = null,
            string? keywords = null,
            string? metadataJson = null,
            int? userId = null,
            string? userName = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Build a formatted "Welly Memory" context block for a chat query.
        /// Returns null when nothing relevant is found.
        /// </summary>
        Task<string?> GetContextForQueryAsync(string query, int topK = 3, CancellationToken cancellationToken = default);

        /// <summary>Recent memories (optionally for a specific day / type).</summary>
        Task<List<WellyMemory>> GetRecentAsync(int limit = 50, string? memoryType = null, DateTime? day = null, CancellationToken cancellationToken = default);

        Task<WellyMemory?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    }

    public class WellyMemoryService : IWellyMemoryService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<WellyMemoryService> _logger;

        // Common words to ignore when extracting keywords for matching
        private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
        {
            "the","and","for","are","was","were","with","that","this","from","have","has",
            "what","when","where","which","who","how","why","did","does","do","can","could",
            "would","should","about","into","over","under","your","you","our","their","his",
            "her","its","it","a","an","of","to","in","on","at","by","is","be","as","or","we",
            "welly","tell","show","give","please","remember","recall","past","before","previously"
        };

        public WellyMemoryService(IServiceScopeFactory scopeFactory, ILogger<WellyMemoryService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task<WellyMemory?> SaveMemoryAsync(
            string memoryType,
            string title,
            string summary,
            string? fullContent = null,
            string? entityName = null,
            string? keywords = null,
            string? metadataJson = null,
            int? userId = null,
            string? userName = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Auto-derive keywords if not supplied
                if (string.IsNullOrWhiteSpace(keywords))
                    keywords = ExtractKeywords($"{title} {entityName} {summary}");

                // Trim to column limits
                if (summary.Length > 3900) summary = summary[..3900];

                var memory = new WellyMemory
                {
                    MemoryType = memoryType,
                    Title = title.Length > 490 ? title[..490] : title,
                    EntityName = entityName?.Length > 490 ? entityName[..490] : entityName,
                    Summary = summary,
                    FullContent = fullContent,
                    Keywords = keywords?.Length > 990 ? keywords[..990] : keywords,
                    MetadataJson = metadataJson,
                    UserId = userId,
                    UserName = userName,
                    MemoryDate = DateTime.UtcNow.Date,
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                };

                db.WellyMemories.Add(memory);
                await db.SaveChangesAsync(cancellationToken);

                _logger.LogInformation("WellyMemory saved: [{Type}] {Title} (id {Id})", memoryType, title, memory.Id);
                return memory;
            }
            catch (Exception ex)
            {
                // Never let memory-writing break the primary task
                _logger.LogError(ex, "WellyMemory: failed to save memory [{Type}] {Title}", memoryType, title);
                return null;
            }
        }

        public async Task<string?> GetContextForQueryAsync(string query, int topK = 3, CancellationToken cancellationToken = default)
        {
            try
            {
                var terms = ExtractKeywords(query)
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Distinct()
                    .Where(t => t.Length >= 3)
                    .Take(12)
                    .ToList();

                if (terms.Count == 0)
                    return null;

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Pull a recent working set, then score in memory (dataset is small & this keeps SQL simple/portable).
                var candidates = await db.WellyMemories
                    .Where(m => m.IsActive)
                    .OrderByDescending(m => m.CreatedAt)
                    .Take(200)
                    .ToListAsync(cancellationToken);

                if (candidates.Count == 0)
                    return null;

                var scored = candidates
                    .Select(m => new { Memory = m, Score = ScoreMemory(m, terms) })
                    .Where(x => x.Score > 0)
                    .OrderByDescending(x => x.Score)
                    .ThenByDescending(x => x.Memory.CreatedAt)
                    .Take(topK)
                    .ToList();

                if (scored.Count == 0)
                    return null;

                var sb = new StringBuilder();
                sb.AppendLine("## Welly Memory (things I've done before)");
                sb.AppendLine("These are past tasks/analyses I have already performed. Use them to answer if relevant, and mention that you recall doing this previously:");
                sb.AppendLine();

                foreach (var item in scored)
                {
                    var m = item.Memory;
                    sb.AppendLine($"- **{m.Title}** ({m.MemoryDate:dd MMM yyyy}{(string.IsNullOrEmpty(m.UserName) ? "" : $", requested by {m.UserName}")})");
                    if (!string.IsNullOrWhiteSpace(m.Summary))
                        sb.AppendLine($"  {m.Summary.Trim()}");
                }

                _logger.LogInformation("WellyMemory: recalled {Count} memory item(s) for query", scored.Count);
                return sb.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WellyMemory: failed to build recall context");
                return null;
            }
        }

        public async Task<List<WellyMemory>> GetRecentAsync(int limit = 50, string? memoryType = null, DateTime? day = null, CancellationToken cancellationToken = default)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var q = db.WellyMemories.Where(m => m.IsActive);
            if (!string.IsNullOrWhiteSpace(memoryType))
                q = q.Where(m => m.MemoryType == memoryType);
            if (day.HasValue)
            {
                var d = day.Value.Date;
                q = q.Where(m => m.MemoryDate == d);
            }

            return await q
                .OrderByDescending(m => m.CreatedAt)
                .Take(Math.Clamp(limit, 1, 500))
                .ToListAsync(cancellationToken);
        }

        public async Task<WellyMemory?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return await db.WellyMemories.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        }

        private static int ScoreMemory(WellyMemory m, List<string> terms)
        {
            var haystackHigh = ($"{m.Title} {m.EntityName} {m.Keywords}").ToLowerInvariant();
            var haystackLow = ($"{m.Summary}").ToLowerInvariant();

            int score = 0;
            foreach (var term in terms)
            {
                var t = term.ToLowerInvariant();
                if (haystackHigh.Contains(t)) score += 3; // strong match on title/entity/keywords
                else if (haystackLow.Contains(t)) score += 1; // weaker match in summary body
            }

            // Slight recency boost so newer memories win ties
            if (score > 0 && m.CreatedAt > DateTime.UtcNow.AddDays(-7)) score += 1;
            return score;
        }

        private static string ExtractKeywords(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;

            var words = text
                .Split(new[] { ' ', '\t', '\n', '\r', ',', '.', ';', ':', '!', '?', '(', ')', '[', ']', '"', '\'', '/', '\\' },
                    StringSplitOptions.RemoveEmptyEntries)
                .Select(w => w.Trim())
                .Where(w => w.Length >= 3 && !StopWords.Contains(w))
                .Select(w => w.ToLowerInvariant())
                .Distinct()
                .Take(30);

            return string.Join(' ', words);
        }
    }
}
