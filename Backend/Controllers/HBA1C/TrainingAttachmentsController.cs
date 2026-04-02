using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Projects;

namespace ProjectTracker.API.Controllers.HBA1C
{
    [ApiController]
    [Route("api/hba1c/training-attachments")]
    [Authorize]
    public class TrainingAttachmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<TrainingAttachmentsController> _logger;

        public TrainingAttachmentsController(
            ApplicationDbContext context,
            IWebHostEnvironment env,
            ILogger<TrainingAttachmentsController> logger)
        {
            _context = context;
            _env = env;
            _logger = logger;
        }

        /// <summary>
        /// List all attachments for a specific training session.
        /// </summary>
        [HttpGet("{trainingSessionId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetAttachments(int trainingSessionId)
        {
            var attachments = await _context.TrainingAttachments
                .Where(a => a.TrainingSessionId == trainingSessionId)
                .OrderByDescending(a => a.UploadedAt)
                .Select(a => new
                {
                    a.Id,
                    a.TrainingSessionId,
                    a.TrainingName,
                    a.FileName,
                    a.ContentType,
                    a.FileSize,
                    a.UploadedBy,
                    a.UploadedAt
                })
                .ToListAsync();

            return Ok(attachments);
        }

        /// <summary>
        /// Upload one or more files attached to a training session.
        /// </summary>
        [HttpPost("upload")]
        [RequestSizeLimit(50_000_000)] // 50 MB limit
        public async Task<ActionResult<IEnumerable<object>>> UploadAttachments(
            [FromForm] List<IFormFile> files,
            [FromForm] int trainingSessionId,
            [FromForm] string? trainingName = null,
            [FromForm] string? uploadedBy = null)
        {
            if (files == null || files.Count == 0)
                return BadRequest("No files provided");

            // Create directory
            var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads", "training");
            Directory.CreateDirectory(uploadsPath);

            var results = new List<object>();

            foreach (var file in files)
            {
                if (file.Length == 0)
                    continue;

                // Generate unique stored file name
                var extension = Path.GetExtension(file.FileName);
                var storedFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{extension}";
                var filePath = Path.Combine(uploadsPath, storedFileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var attachment = new TrainingAttachment
                {
                    TrainingSessionId = trainingSessionId,
                    TrainingName = trainingName,
                    FileName = file.FileName,
                    StoredFileName = storedFileName,
                    ContentType = file.ContentType,
                    FileSize = file.Length,
                    UploadedBy = uploadedBy,
                    UploadedAt = DateTime.UtcNow
                };

                _context.TrainingAttachments.Add(attachment);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Training attachment uploaded: {FileName} for session {TrainingSessionId} ({TrainingName})",
                    file.FileName, trainingSessionId, trainingName);

                results.Add(new
                {
                    attachment.Id,
                    attachment.TrainingSessionId,
                    attachment.TrainingName,
                    attachment.FileName,
                    attachment.ContentType,
                    attachment.FileSize,
                    attachment.UploadedBy,
                    attachment.UploadedAt
                });
            }

            return Ok(results);
        }

        /// <summary>
        /// Download an attachment by its ID.
        /// </summary>
        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadAttachment(int id)
        {
            var attachment = await _context.TrainingAttachments.FindAsync(id);
            if (attachment == null)
                return NotFound();

            var filePath = Path.Combine(_env.ContentRootPath, "uploads", "training", attachment.StoredFileName);
            if (!System.IO.File.Exists(filePath))
                return NotFound("File not found on server");

            var bytes = await System.IO.File.ReadAllBytesAsync(filePath);
            return File(bytes, attachment.ContentType ?? "application/octet-stream", attachment.FileName);
        }

        /// <summary>
        /// Delete an attachment by its ID (removes file from disk and DB record).
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAttachment(int id)
        {
            var attachment = await _context.TrainingAttachments.FindAsync(id);
            if (attachment == null)
                return NotFound();

            // Delete physical file
            var filePath = Path.Combine(_env.ContentRootPath, "uploads", "training", attachment.StoredFileName);
            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
                _logger.LogInformation("Deleted training attachment file: {StoredFileName}", attachment.StoredFileName);
            }

            _context.TrainingAttachments.Remove(attachment);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Get attachment counts for multiple training sessions at once (for displaying badges in the table).
        /// </summary>
        [HttpPost("counts")]
        public async Task<ActionResult<Dictionary<int, int>>> GetAttachmentCounts([FromBody] List<int> trainingSessionIds)
        {
            var counts = await _context.TrainingAttachments
                .Where(a => trainingSessionIds.Contains(a.TrainingSessionId))
                .GroupBy(a => a.TrainingSessionId)
                .Select(g => new { TrainingSessionId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.TrainingSessionId, x => x.Count);

            return Ok(counts);
        }
    }
}
