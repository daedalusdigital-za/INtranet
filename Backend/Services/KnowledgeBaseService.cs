using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Services
{
    public interface IKnowledgeBaseService
    {
        Task<int> IngestDocumentAsync(string filePath, KnowledgeBaseUploadDto? metadata = null);
        Task<int> IngestFolderAsync(string folderPath);
        Task<List<KnowledgeBaseSearchResult>> SearchAsync(string query, int topK = 5, string? category = null);
        Task<string> GetContextForQueryAsync(string query, int topK = 3);
        Task<bool> DeleteDocumentAsync(int documentId);
        Task<List<KnowledgeBaseDocument>> GetAllDocumentsAsync();
        Task<KnowledgeBaseDocument?> GetDocumentAsync(int id);
    }

    public class KnowledgeBaseService : IKnowledgeBaseService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<KnowledgeBaseService> _logger;
        private readonly IConfiguration _configuration;

        // Common English stop words to filter out
        private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
        {
            "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
            "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
            "to", "was", "were", "will", "with", "the", "this", "but", "they",
            "have", "had", "what", "when", "where", "who", "which", "why", "how",
            "all", "each", "every", "both", "few", "more", "most", "other", "some",
            "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
            "very", "can", "just", "should", "now", "also", "into", "over", "after",
            "before", "between", "under", "again", "further", "then", "once", "here",
            "there", "any", "been", "being", "do", "does", "did", "doing", "would",
            "could", "might", "must", "shall", "may", "our", "your", "their", "his",
            "her", "him", "she", "you", "we", "them", "us", "i", "me", "my", "myself"
        };

        // Chunk size configuration
        private const int ChunkSize = 500; // characters per chunk
        private const int ChunkOverlap = 100; // overlap between chunks

        public KnowledgeBaseService(
            IServiceScopeFactory scopeFactory,
            ILogger<KnowledgeBaseService> logger,
            IConfiguration configuration)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<int> IngestDocumentAsync(string filePath, KnowledgeBaseUploadDto? metadata = null)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var ingestionLog = new KnowledgeBaseIngestionLog
            {
                FileName = Path.GetFileName(filePath),
                Status = "Processing"
            };

            try
            {
                if (!File.Exists(filePath))
                {
                    throw new FileNotFoundException($"File not found: {filePath}");
                }

                var fileInfo = new FileInfo(filePath);
                var fileHash = await ComputeFileHashAsync(filePath);
                var fileExtension = fileInfo.Extension.ToLowerInvariant();

                // Check if document already exists with same hash (no changes)
                var existingDoc = await context.KnowledgeBaseDocuments
                    .FirstOrDefaultAsync(d => d.FilePath == filePath && d.FileHash == fileHash);

                if (existingDoc != null)
                {
                    _logger.LogInformation("Document {FileName} already indexed with same content", fileInfo.Name);
                    return existingDoc.Id;
                }

                // Check if document exists but has changed
                var changedDoc = await context.KnowledgeBaseDocuments
                    .FirstOrDefaultAsync(d => d.FilePath == filePath);

                if (changedDoc != null)
                {
                    // Remove old chunks
                    var oldChunks = await context.KnowledgeBaseChunks
                        .Where(c => c.DocumentId == changedDoc.Id)
                        .ToListAsync();
                    context.KnowledgeBaseChunks.RemoveRange(oldChunks);
                    context.KnowledgeBaseDocuments.Remove(changedDoc);
                    await context.SaveChangesAsync();
                    _logger.LogInformation("Removed old version of document {FileName}", fileInfo.Name);
                }

                // Extract text from document
                var text = await ExtractTextAsync(filePath, fileExtension);
                if (string.IsNullOrWhiteSpace(text))
                {
                    throw new InvalidOperationException("No text could be extracted from the document");
                }

                // Create document record
                var document = new KnowledgeBaseDocument
                {
                    FileName = fileInfo.Name,
                    FilePath = filePath,
                    FileType = fileExtension.TrimStart('.'),
                    FileSize = fileInfo.Length,
                    FileHash = fileHash,
                    Title = metadata?.Title ?? Path.GetFileNameWithoutExtension(filePath),
                    Description = metadata?.Description ?? "",
                    Category = metadata?.Category ?? DetectCategory(text),
                    Tags = metadata?.Tags ?? "",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                context.KnowledgeBaseDocuments.Add(document);
                await context.SaveChangesAsync();

                // Chunk the document
                var chunks = ChunkText(text);
                var chunkIndex = 0;

                foreach (var chunk in chunks)
                {
                    var keywords = ExtractKeywords(chunk.Content);
                    var embedding = CreateSimpleEmbedding(chunk.Content);

                    var dbChunk = new KnowledgeBaseChunk
                    {
                        DocumentId = document.Id,
                        ChunkIndex = chunkIndex++,
                        Content = chunk.Content,
                        ContentLength = chunk.Content.Length,
                        StartPosition = chunk.StartPosition,
                        EndPosition = chunk.EndPosition,
                        Keywords = string.Join(",", keywords.Take(20)),
                        EmbeddingJson = JsonSerializer.Serialize(embedding)
                    };

                    context.KnowledgeBaseChunks.Add(dbChunk);
                }

                document.ChunkCount = chunkIndex;
                document.LastIndexedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();

                stopwatch.Stop();

                ingestionLog.Status = "Completed";
                ingestionLog.ChunksCreated = chunkIndex;
                ingestionLog.CompletedAt = DateTime.UtcNow;
                ingestionLog.ProcessingTimeMs = stopwatch.ElapsedMilliseconds;
                context.KnowledgeBaseIngestionLogs.Add(ingestionLog);
                await context.SaveChangesAsync();

                _logger.LogInformation(
                    "Successfully indexed {FileName}: {ChunkCount} chunks in {Time}ms",
                    fileInfo.Name, chunkIndex, stopwatch.ElapsedMilliseconds);

                return document.Id;
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                ingestionLog.Status = "Failed";
                ingestionLog.ErrorMessage = ex.Message;
                ingestionLog.CompletedAt = DateTime.UtcNow;
                ingestionLog.ProcessingTimeMs = stopwatch.ElapsedMilliseconds;
                
                context.KnowledgeBaseIngestionLogs.Add(ingestionLog);
                await context.SaveChangesAsync();

                _logger.LogError(ex, "Failed to ingest document: {FilePath}", filePath);
                throw;
            }
        }

        public async Task<int> IngestFolderAsync(string folderPath)
        {
            if (!Directory.Exists(folderPath))
            {
                throw new DirectoryNotFoundException($"Folder not found: {folderPath}");
            }

            var supportedExtensions = new[] { ".pdf", ".txt", ".md", ".docx", ".doc" };
            var files = Directory.GetFiles(folderPath, "*.*", SearchOption.AllDirectories)
                .Where(f => supportedExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                .ToList();

            _logger.LogInformation("Found {Count} documents to ingest in {Folder}", files.Count, folderPath);

            var successCount = 0;
            foreach (var file in files)
            {
                try
                {
                    await IngestDocumentAsync(file);
                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to ingest {File}", file);
                }
            }

            return successCount;
        }

        public async Task<List<KnowledgeBaseSearchResult>> SearchAsync(string query, int topK = 5, string? category = null)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Extract keywords from query
            var queryKeywords = ExtractKeywords(query);
            var queryEmbedding = CreateSimpleEmbedding(query);

            // Get all chunks (with optional category filter)
            var chunksQuery = context.KnowledgeBaseChunks
                .Include(c => c.Document)
                .Where(c => c.Document != null && c.Document.IsActive);

            if (!string.IsNullOrEmpty(category))
            {
                chunksQuery = chunksQuery.Where(c => c.Document!.Category == category);
            }

            var chunks = await chunksQuery.ToListAsync();

            // Score each chunk
            var scoredChunks = new List<(KnowledgeBaseChunk Chunk, double Score)>();

            foreach (var chunk in chunks)
            {
                double score = 0;

                // Keyword matching score
                var chunkKeywords = (chunk.Keywords ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries);
                var keywordMatchCount = queryKeywords.Count(qk => 
                    chunkKeywords.Any(ck => ck.Equals(qk, StringComparison.OrdinalIgnoreCase)));
                score += keywordMatchCount * 2.0;

                // Direct content match bonus
                var queryLower = query.ToLower();
                if (chunk.Content.ToLower().Contains(queryLower))
                {
                    score += 5.0;
                }

                // Word overlap in content
                var contentWords = Regex.Split(chunk.Content.ToLower(), @"\W+")
                    .Where(w => w.Length > 2);
                var queryWords = Regex.Split(query.ToLower(), @"\W+")
                    .Where(w => w.Length > 2);
                var wordOverlap = queryWords.Count(qw => contentWords.Contains(qw));
                score += wordOverlap * 0.5;

                // Cosine similarity with embedding
                if (!string.IsNullOrEmpty(chunk.EmbeddingJson))
                {
                    try
                    {
                        var chunkEmbedding = JsonSerializer.Deserialize<Dictionary<string, double>>(chunk.EmbeddingJson);
                        if (chunkEmbedding != null)
                        {
                            score += CosineSimilarity(queryEmbedding, chunkEmbedding) * 3.0;
                        }
                    }
                    catch { /* Ignore deserialization errors */ }
                }

                if (score > 0)
                {
                    scoredChunks.Add((chunk, score));
                }
            }

            // Return top K results
            return scoredChunks
                .OrderByDescending(x => x.Score)
                .Take(topK)
                .Select(x => new KnowledgeBaseSearchResult
                {
                    ChunkId = x.Chunk.Id,
                    DocumentId = x.Chunk.DocumentId,
                    FileName = x.Chunk.Document?.FileName ?? "",
                    Content = x.Chunk.Content,
                    Score = x.Score,
                    Category = x.Chunk.Document?.Category ?? ""
                })
                .ToList();
        }

        public async Task<string> GetContextForQueryAsync(string query, int topK = 3)
        {
            var results = await SearchAsync(query, topK);

            if (results.Count == 0)
            {
                return "";
            }

            var sb = new StringBuilder();
            sb.AppendLine("--- KNOWLEDGE BASE CONTEXT ---");
            
            foreach (var result in results)
            {
                sb.AppendLine($"\n[Source: {result.FileName}]");
                sb.AppendLine(result.Content);
            }

            sb.AppendLine("\n--- END CONTEXT ---");
            return sb.ToString();
        }

        public async Task<bool> DeleteDocumentAsync(int documentId)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var document = await context.KnowledgeBaseDocuments
                .Include(d => d.Chunks)
                .FirstOrDefaultAsync(d => d.Id == documentId);

            if (document == null) return false;

            context.KnowledgeBaseChunks.RemoveRange(document.Chunks);
            context.KnowledgeBaseDocuments.Remove(document);
            await context.SaveChangesAsync();

            return true;
        }

        public async Task<List<KnowledgeBaseDocument>> GetAllDocumentsAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            return await context.KnowledgeBaseDocuments
                .Where(d => d.IsActive)
                .OrderByDescending(d => d.UpdatedAt)
                .ToListAsync();
        }

        public async Task<KnowledgeBaseDocument?> GetDocumentAsync(int id)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            return await context.KnowledgeBaseDocuments
                .Include(d => d.Chunks)
                .FirstOrDefaultAsync(d => d.Id == id);
        }

        #region Private Helper Methods

        private async Task<string> ExtractTextAsync(string filePath, string extension)
        {
            return extension switch
            {
                ".pdf" => await ExtractTextFromPdfAsync(filePath),
                ".txt" => await File.ReadAllTextAsync(filePath),
                ".md" => await File.ReadAllTextAsync(filePath),
                ".docx" => ExtractTextFromDocx(filePath),
                ".doc" => ExtractTextFromDocx(filePath),
                _ => throw new NotSupportedException($"File type {extension} is not supported")
            };
        }

        private async Task<string> ExtractTextFromPdfAsync(string filePath)
        {
            return await Task.Run(() =>
            {
                var sb = new StringBuilder();
                using var reader = new PdfReader(filePath);
                using var pdfDoc = new PdfDocument(reader);

                for (int i = 1; i <= pdfDoc.GetNumberOfPages(); i++)
                {
                    var page = pdfDoc.GetPage(i);
                    var strategy = new SimpleTextExtractionStrategy();
                    var text = PdfTextExtractor.GetTextFromPage(page, strategy);
                    sb.AppendLine(text);
                }

                return sb.ToString();
            });
        }

        private string ExtractTextFromDocx(string filePath)
        {
            // Simple DOCX extraction - read the XML content
            try
            {
                using var archive = System.IO.Compression.ZipFile.OpenRead(filePath);
                var documentEntry = archive.GetEntry("word/document.xml");
                if (documentEntry == null) return "";

                using var stream = documentEntry.Open();
                using var reader = new StreamReader(stream);
                var xml = reader.ReadToEnd();

                // Extract text content from XML (simple approach)
                var text = Regex.Replace(xml, @"<[^>]+>", " ");
                text = Regex.Replace(text, @"\s+", " ");
                return System.Net.WebUtility.HtmlDecode(text);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to extract text from DOCX: {FilePath}", filePath);
                return "";
            }
        }

        private async Task<string> ComputeFileHashAsync(string filePath)
        {
            using var sha256 = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            var hash = await sha256.ComputeHashAsync(stream);
            return Convert.ToHexString(hash);
        }

        private List<(string Content, int StartPosition, int EndPosition)> ChunkText(string text)
        {
            var chunks = new List<(string, int, int)>();
            
            if (string.IsNullOrWhiteSpace(text)) return chunks;

            // Clean up text
            text = Regex.Replace(text, @"\s+", " ").Trim();

            var position = 0;
            while (position < text.Length)
            {
                var endPosition = Math.Min(position + ChunkSize, text.Length);
                
                // Try to break at sentence or word boundary
                if (endPosition < text.Length)
                {
                    var lastPeriod = text.LastIndexOf('.', endPosition, Math.Min(ChunkSize, endPosition));
                    var lastSpace = text.LastIndexOf(' ', endPosition, Math.Min(50, endPosition - position));
                    
                    if (lastPeriod > position + ChunkSize / 2)
                    {
                        endPosition = lastPeriod + 1;
                    }
                    else if (lastSpace > position)
                    {
                        endPosition = lastSpace;
                    }
                }

                var chunkContent = text.Substring(position, endPosition - position).Trim();
                if (!string.IsNullOrWhiteSpace(chunkContent))
                {
                    chunks.Add((chunkContent, position, endPosition));
                }

                position = endPosition - ChunkOverlap;
                var lastChunk = chunks.LastOrDefault();
                if (lastChunk != default && position <= lastChunk.Item3 - ChunkOverlap)
                {
                    position = endPosition; // Prevent infinite loop
                }
            }

            return chunks;
        }

        private List<string> ExtractKeywords(string text)
        {
            var words = Regex.Split(text.ToLower(), @"\W+")
                .Where(w => w.Length > 2)
                .Where(w => !StopWords.Contains(w))
                .Where(w => !Regex.IsMatch(w, @"^\d+$")) // Exclude pure numbers
                .GroupBy(w => w)
                .OrderByDescending(g => g.Count())
                .Select(g => g.Key)
                .ToList();

            return words;
        }

        private Dictionary<string, double> CreateSimpleEmbedding(string text)
        {
            var words = ExtractKeywords(text);
            var totalWords = words.Count;
            
            if (totalWords == 0) return new Dictionary<string, double>();

            // Create TF (Term Frequency) based embedding
            return words
                .GroupBy(w => w)
                .ToDictionary(
                    g => g.Key,
                    g => (double)g.Count() / totalWords
                );
        }

        private double CosineSimilarity(Dictionary<string, double> vec1, Dictionary<string, double> vec2)
        {
            var allKeys = vec1.Keys.Union(vec2.Keys).ToList();
            
            double dotProduct = 0;
            double norm1 = 0;
            double norm2 = 0;

            foreach (var key in allKeys)
            {
                var v1 = vec1.GetValueOrDefault(key, 0);
                var v2 = vec2.GetValueOrDefault(key, 0);
                
                dotProduct += v1 * v2;
                norm1 += v1 * v1;
                norm2 += v2 * v2;
            }

            if (norm1 == 0 || norm2 == 0) return 0;
            
            return dotProduct / (Math.Sqrt(norm1) * Math.Sqrt(norm2));
        }

        private string DetectCategory(string text)
        {
            var lowered = text.ToLower();

            var categories = new Dictionary<string, string[]>
            {
                ["IT Policy"] = new[] { "password", "security", "network", "computer", "software", "hardware", "vpn", "firewall" },
                ["HR Policy"] = new[] { "employee", "leave", "vacation", "benefits", "salary", "hiring", "termination", "hr" },
                ["Procedures"] = new[] { "procedure", "step", "process", "instruction", "guideline", "workflow" },
                ["Training"] = new[] { "training", "course", "learning", "certification", "skill", "development" },
                ["Compliance"] = new[] { "compliance", "regulation", "audit", "legal", "policy", "gdpr", "hipaa" },
                ["Operations"] = new[] { "operations", "maintenance", "facility", "equipment", "safety" }
            };

            var bestCategory = "General";
            var bestScore = 0;

            foreach (var kvp in categories)
            {
                var score = kvp.Value.Count(keyword => lowered.Contains(keyword));
                if (score > bestScore)
                {
                    bestScore = score;
                    bestCategory = kvp.Key;
                }
            }

            return bestScore >= 2 ? bestCategory : "General";
        }

        #endregion
    }
}
