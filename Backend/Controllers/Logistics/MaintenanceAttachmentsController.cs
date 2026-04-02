using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    [ApiController]
    [Route("api/logistics/maintenance-attachments")]
    [Authorize]
    public class MaintenanceAttachmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<MaintenanceAttachmentsController> _logger;

        public MaintenanceAttachmentsController(
            ApplicationDbContext context,
            IWebHostEnvironment env,
            ILogger<MaintenanceAttachmentsController> logger)
        {
            _context = context;
            _env = env;
            _logger = logger;
        }

        /// <summary>
        /// List all attachments for a specific maintenance record.
        /// </summary>
        [HttpGet("{maintenanceRecordId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetAttachments(int maintenanceRecordId)
        {
            var attachments = await _context.MaintenanceAttachments
                .Where(a => a.MaintenanceRecordId == maintenanceRecordId)
                .OrderByDescending(a => a.UploadedAt)
                .Select(a => new
                {
                    a.Id,
                    a.MaintenanceRecordId,
                    a.VehicleRegistration,
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
        /// Upload one or more files attached to a maintenance record.
        /// </summary>
        [HttpPost("upload")]
        [RequestSizeLimit(50_000_000)] // 50 MB limit
        public async Task<ActionResult<IEnumerable<object>>> UploadAttachments(
            [FromForm] List<IFormFile> files,
            [FromForm] int maintenanceRecordId,
            [FromForm] string? vehicleRegistration = null,
            [FromForm] string? uploadedBy = null)
        {
            if (files == null || files.Count == 0)
                return BadRequest("No files provided");

            // Create directory
            var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads", "maintenance");
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

                var attachment = new MaintenanceAttachment
                {
                    MaintenanceRecordId = maintenanceRecordId,
                    VehicleRegistration = vehicleRegistration,
                    FileName = file.FileName,
                    StoredFileName = storedFileName,
                    ContentType = file.ContentType,
                    FileSize = file.Length,
                    UploadedBy = uploadedBy,
                    UploadedAt = DateTime.UtcNow
                };

                _context.MaintenanceAttachments.Add(attachment);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Maintenance attachment uploaded: {FileName} for record {MaintenanceRecordId} ({VehicleReg})",
                    file.FileName, maintenanceRecordId, vehicleRegistration);

                results.Add(new
                {
                    attachment.Id,
                    attachment.MaintenanceRecordId,
                    attachment.VehicleRegistration,
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
            var attachment = await _context.MaintenanceAttachments.FindAsync(id);
            if (attachment == null)
                return NotFound();

            var filePath = Path.Combine(_env.ContentRootPath, "uploads", "maintenance", attachment.StoredFileName);
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
            var attachment = await _context.MaintenanceAttachments.FindAsync(id);
            if (attachment == null)
                return NotFound();

            // Delete physical file
            var filePath = Path.Combine(_env.ContentRootPath, "uploads", "maintenance", attachment.StoredFileName);
            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
                _logger.LogInformation("Deleted maintenance attachment file: {StoredFileName}", attachment.StoredFileName);
            }

            _context.MaintenanceAttachments.Remove(attachment);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Get attachment counts for multiple maintenance records at once (for displaying badges in the table).
        /// </summary>
        [HttpPost("counts")]
        public async Task<ActionResult<Dictionary<int, int>>> GetAttachmentCounts([FromBody] List<int> maintenanceRecordIds)
        {
            var counts = await _context.MaintenanceAttachments
                .Where(a => maintenanceRecordIds.Contains(a.MaintenanceRecordId))
                .GroupBy(a => a.MaintenanceRecordId)
                .Select(g => new { MaintenanceRecordId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.MaintenanceRecordId, x => x.Count);

            return Ok(counts);
        }
    }
}
