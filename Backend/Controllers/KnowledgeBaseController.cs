using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Models;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class KnowledgeBaseController : ControllerBase
    {
        private readonly IKnowledgeBaseService _kbService;
        private readonly ILogger<KnowledgeBaseController> _logger;
        private readonly IConfiguration _configuration;

        public KnowledgeBaseController(
            IKnowledgeBaseService kbService,
            ILogger<KnowledgeBaseController> logger,
            IConfiguration configuration)
        {
            _kbService = kbService;
            _logger = logger;
            _configuration = configuration;
        }

        /// <summary>
        /// Get all documents in the knowledge base
        /// </summary>
        [HttpGet("documents")]
        public async Task<ActionResult<List<KnowledgeBaseDocument>>> GetDocuments()
        {
            var documents = await _kbService.GetAllDocumentsAsync();
            return Ok(documents);
        }

        /// <summary>
        /// Get a specific document by ID
        /// </summary>
        [HttpGet("documents/{id}")]
        public async Task<ActionResult<KnowledgeBaseDocument>> GetDocument(int id)
        {
            var document = await _kbService.GetDocumentAsync(id);
            if (document == null)
            {
                return NotFound();
            }
            return Ok(document);
        }

        /// <summary>
        /// Upload a document to the knowledge base
        /// </summary>
        [HttpPost("upload")]
        public async Task<ActionResult> UploadDocument(
            IFormFile file,
            [FromForm] string? title,
            [FromForm] string? description,
            [FromForm] string? category,
            [FromForm] string? tags)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "No file provided" });
            }

            var allowedExtensions = new[] { ".pdf", ".txt", ".md", ".docx", ".doc" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { error = $"File type {extension} is not supported. Allowed: {string.Join(", ", allowedExtensions)}" });
            }

            try
            {
                // Save file to KB folder
                var kbFolder = _configuration["KnowledgeBase:DocumentsPath"] ?? "/app/kb-docs";
                Directory.CreateDirectory(kbFolder);

                var filePath = Path.Combine(kbFolder, file.FileName);
                
                // Handle duplicate filenames
                var counter = 1;
                while (System.IO.File.Exists(filePath))
                {
                    var nameWithoutExt = Path.GetFileNameWithoutExtension(file.FileName);
                    filePath = Path.Combine(kbFolder, $"{nameWithoutExt}_{counter}{extension}");
                    counter++;
                }

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var metadata = new KnowledgeBaseUploadDto
                {
                    Title = title,
                    Description = description,
                    Category = category,
                    Tags = tags
                };

                var documentId = await _kbService.IngestDocumentAsync(filePath, metadata);

                return Ok(new
                {
                    success = true,
                    documentId,
                    message = "Document uploaded and indexed successfully"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload document");
                return StatusCode(500, new { error = "Failed to process document", details = ex.Message });
            }
        }

        /// <summary>
        /// Ingest all documents from the configured KB folder
        /// </summary>
        [HttpPost("ingest-folder")]
        public async Task<ActionResult> IngestFolder()
        {
            try
            {
                var kbFolder = _configuration["KnowledgeBase:DocumentsPath"] ?? "/app/kb-docs";
                
                if (!Directory.Exists(kbFolder))
                {
                    return BadRequest(new { error = $"KB folder does not exist: {kbFolder}" });
                }

                var count = await _kbService.IngestFolderAsync(kbFolder);
                
                return Ok(new
                {
                    success = true,
                    documentsProcessed = count,
                    message = $"Successfully ingested {count} documents"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to ingest folder");
                return StatusCode(500, new { error = "Failed to ingest folder", details = ex.Message });
            }
        }

        /// <summary>
        /// Search the knowledge base
        /// </summary>
        [HttpPost("search")]
        public async Task<ActionResult<List<KnowledgeBaseSearchResult>>> Search([FromBody] KnowledgeBaseSearchRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Query))
            {
                return BadRequest(new { error = "Query is required" });
            }

            var results = await _kbService.SearchAsync(request.Query, request.TopK, request.Category);
            return Ok(results);
        }

        /// <summary>
        /// Get formatted context for a query (used by AI service)
        /// </summary>
        [HttpGet("context")]
        public async Task<ActionResult<string>> GetContext([FromQuery] string query, [FromQuery] int topK = 3)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return BadRequest(new { error = "Query is required" });
            }

            var context = await _kbService.GetContextForQueryAsync(query, topK);
            return Ok(new { context });
        }

        /// <summary>
        /// Delete a document from the knowledge base
        /// </summary>
        [HttpDelete("documents/{id}")]
        public async Task<ActionResult> DeleteDocument(int id)
        {
            var success = await _kbService.DeleteDocumentAsync(id);
            
            if (!success)
            {
                return NotFound(new { error = "Document not found" });
            }

            return Ok(new { success = true, message = "Document deleted successfully" });
        }

        /// <summary>
        /// Get knowledge base statistics
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult> GetStats()
        {
            var documents = await _kbService.GetAllDocumentsAsync();
            
            return Ok(new
            {
                totalDocuments = documents.Count,
                totalChunks = documents.Sum(d => d.ChunkCount),
                categories = documents.GroupBy(d => d.Category).Select(g => new { category = g.Key, count = g.Count() }),
                lastUpdated = documents.Max(d => (DateTime?)d.UpdatedAt)
            });
        }
    }
}
