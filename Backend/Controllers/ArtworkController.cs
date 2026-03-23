using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Tenders;
using System.Net;
using System.Net.Mail;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ArtworkController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ArtworkController> _logger;

        public ArtworkController(ApplicationDbContext context, IWebHostEnvironment env, IConfiguration configuration, ILogger<ArtworkController> logger)
        {
            _context = context;
            _env = env;
            _configuration = configuration;
            _logger = logger;
        }

        // GET: api/Artwork
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetArtworkFiles(
            [FromQuery] string? companyCode = null,
            [FromQuery] string? category = null,
            [FromQuery] string? search = null)
        {
            var query = _context.ArtworkFiles
                .Include(a => a.Annotations)
                .AsQueryable();

            if (!string.IsNullOrEmpty(companyCode))
                query = query.Where(a => a.CompanyCode == companyCode);

            if (!string.IsNullOrEmpty(category))
                query = query.Where(a => a.Category == category);

            if (!string.IsNullOrEmpty(search))
            {
                var term = search.ToLower();
                query = query.Where(a =>
                    a.FileName.ToLower().Contains(term) ||
                    a.CompanyCode.ToLower().Contains(term) ||
                    a.Category.ToLower().Contains(term) ||
                    (a.TenderNumber != null && a.TenderNumber.ToLower().Contains(term)) ||
                    (a.Notes != null && a.Notes.ToLower().Contains(term)));
            }

            var files = await query
                .OrderByDescending(a => a.UploadedAt)
                .Select(a => new
                {
                    a.Id,
                    a.FileName,
                    a.FileType,
                    a.FileSize,
                    a.CompanyCode,
                    a.Category,
                    a.TenderId,
                    a.TenderNumber,
                    a.Notes,
                    a.UploadedByUserId,
                    a.UploadedByUserName,
                    a.UploadedAt,
                    a.SentToMarketing,
                    a.SentToMarketingAt,
                    Annotations = a.Annotations.Select(an => new
                    {
                        an.Id,
                        an.Type,
                        an.X,
                        an.Y,
                        an.Text,
                        an.Color,
                        an.CreatedByUserId,
                        an.CreatedByUserName,
                        an.CreatedAt
                    }).OrderBy(an => an.Id).ToList()
                })
                .ToListAsync();

            return Ok(files);
        }

        // GET: api/Artwork/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetArtworkFile(int id)
        {
            var artwork = await _context.ArtworkFiles
                .Include(a => a.Annotations)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (artwork == null)
                return NotFound();

            return Ok(new
            {
                artwork.Id,
                artwork.FileName,
                artwork.FileType,
                artwork.FileSize,
                artwork.CompanyCode,
                artwork.Category,
                artwork.TenderId,
                artwork.TenderNumber,
                artwork.Notes,
                artwork.UploadedByUserId,
                artwork.UploadedByUserName,
                artwork.UploadedAt,
                artwork.SentToMarketing,
                artwork.SentToMarketingAt,
                Annotations = artwork.Annotations.Select(an => new
                {
                    an.Id,
                    an.Type,
                    an.X,
                    an.Y,
                    an.Text,
                    an.Color,
                    an.CreatedByUserId,
                    an.CreatedByUserName,
                    an.CreatedAt
                }).OrderBy(an => an.Id).ToList()
            });
        }

        // POST: api/Artwork/upload
        [HttpPost("upload")]
        public async Task<ActionResult<object>> UploadArtwork(
            [FromForm] IFormFile file,
            [FromForm] string companyCode,
            [FromForm] string category,
            [FromForm] int? tenderId = null,
            [FromForm] string? tenderNumber = null,
            [FromForm] string? notes = null,
            [FromForm] int? uploadedByUserId = null,
            [FromForm] string? uploadedByUserName = null)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file provided");

            // Create directory
            var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads", "artwork", companyCode);
            Directory.CreateDirectory(uploadsPath);

            // Save file with timestamp prefix
            var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{file.FileName}";
            var filePath = Path.Combine(uploadsPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Determine file type
            var isPdf = file.ContentType == "application/pdf" ||
                        file.FileName.ToLower().EndsWith(".pdf");
            var fileType = isPdf ? "pdf" : "image";

            var artwork = new ArtworkFile
            {
                FileName = file.FileName,
                FilePath = filePath,
                FileType = fileType,
                FileSize = file.Length,
                MimeType = file.ContentType,
                CompanyCode = companyCode,
                Category = category,
                TenderId = tenderId,
                TenderNumber = tenderNumber,
                Notes = notes,
                UploadedByUserId = uploadedByUserId,
                UploadedByUserName = uploadedByUserName,
                UploadedAt = DateTime.UtcNow
            };

            _context.ArtworkFiles.Add(artwork);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Artwork uploaded: {FileName} for {CompanyCode}/{Category}", file.FileName, companyCode, category);

            return CreatedAtAction(nameof(GetArtworkFile), new { id = artwork.Id }, new
            {
                artwork.Id,
                artwork.FileName,
                artwork.FileType,
                artwork.FileSize,
                artwork.CompanyCode,
                artwork.Category,
                artwork.TenderId,
                artwork.TenderNumber,
                artwork.Notes,
                artwork.UploadedByUserId,
                artwork.UploadedByUserName,
                artwork.UploadedAt,
                artwork.SentToMarketing,
                Annotations = new List<object>()
            });
        }

        // GET: api/Artwork/5/download
        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadArtwork(int id)
        {
            var artwork = await _context.ArtworkFiles.FindAsync(id);
            if (artwork == null || string.IsNullOrEmpty(artwork.FilePath))
                return NotFound();

            if (!System.IO.File.Exists(artwork.FilePath))
                return NotFound("File not found on server");

            var bytes = await System.IO.File.ReadAllBytesAsync(artwork.FilePath);
            return File(bytes, artwork.MimeType ?? "application/octet-stream", artwork.FileName);
        }

        // DELETE: api/Artwork/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteArtwork(int id)
        {
            var artwork = await _context.ArtworkFiles
                .Include(a => a.Annotations)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (artwork == null)
                return NotFound();

            // Delete physical file
            if (!string.IsNullOrEmpty(artwork.FilePath) && System.IO.File.Exists(artwork.FilePath))
            {
                System.IO.File.Delete(artwork.FilePath);
            }

            _context.ArtworkFiles.Remove(artwork); // Cascades to annotations
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ==================== ANNOTATIONS ====================

        // POST: api/Artwork/5/annotations
        [HttpPost("{id}/annotations")]
        public async Task<ActionResult<object>> AddAnnotation(int id, [FromBody] AddAnnotationRequest request)
        {
            var artwork = await _context.ArtworkFiles.FindAsync(id);
            if (artwork == null)
                return NotFound();

            var annotation = new ArtworkAnnotation
            {
                ArtworkFileId = id,
                Type = request.Type ?? "note",
                X = request.X,
                Y = request.Y,
                Text = request.Text,
                Color = request.Color ?? "#FF5722",
                CreatedByUserId = request.CreatedByUserId,
                CreatedByUserName = request.CreatedByUserName,
                CreatedAt = DateTime.UtcNow
            };

            _context.ArtworkAnnotations.Add(annotation);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                annotation.Id,
                annotation.Type,
                annotation.X,
                annotation.Y,
                annotation.Text,
                annotation.Color,
                annotation.CreatedByUserId,
                annotation.CreatedByUserName,
                annotation.CreatedAt
            });
        }

        // PUT: api/Artwork/annotations/5
        [HttpPut("annotations/{annotationId}")]
        public async Task<IActionResult> UpdateAnnotation(int annotationId, [FromBody] UpdateAnnotationRequest request)
        {
            var annotation = await _context.ArtworkAnnotations.FindAsync(annotationId);
            if (annotation == null)
                return NotFound();

            if (request.Text != null)
                annotation.Text = request.Text;
            if (request.X.HasValue)
                annotation.X = request.X.Value;
            if (request.Y.HasValue)
                annotation.Y = request.Y.Value;
            if (request.Color != null)
                annotation.Color = request.Color;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/Artwork/annotations/5
        [HttpDelete("annotations/{annotationId}")]
        public async Task<IActionResult> DeleteAnnotation(int annotationId)
        {
            var annotation = await _context.ArtworkAnnotations.FindAsync(annotationId);
            if (annotation == null)
                return NotFound();

            _context.ArtworkAnnotations.Remove(annotation);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/Artwork/5/annotations (clear all)
        [HttpDelete("{id}/annotations")]
        public async Task<IActionResult> ClearAnnotations(int id)
        {
            var annotations = await _context.ArtworkAnnotations
                .Where(a => a.ArtworkFileId == id)
                .ToListAsync();

            _context.ArtworkAnnotations.RemoveRange(annotations);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ==================== SEND TO MARKETING ====================

        // POST: api/Artwork/5/send-to-marketing
        [HttpPost("{id}/send-to-marketing")]
        public async Task<IActionResult> SendToMarketing(int id, [FromBody] SendToMarketingRequest request)
        {
            var artwork = await _context.ArtworkFiles
                .Include(a => a.Annotations)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (artwork == null)
                return NotFound();

            if (!artwork.Annotations.Any())
                return BadRequest("No annotations to send. Add notes to the artwork first.");

            // Build email
            var smtpHost = _configuration["AIEmail:SmtpHost"] ?? "mail.promedtechnologies.co.za";
            var smtpPort = int.TryParse(_configuration["AIEmail:SmtpPort"], out var port) ? port : 587;
            var senderEmail = _configuration["AIEmail:SenderEmail"] ?? "ai@promedtechnologies.co.za";
            var senderName = _configuration["AIEmail:SenderName"] ?? "Welly - ProMed AI Assistant";
            var senderPassword = _configuration["AIEmail:SenderPassword"] ?? "";
            var enableSsl = bool.TryParse(_configuration["AIEmail:EnableSsl"], out var ssl) ? ssl : true;

            var recipients = request.Recipients.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (recipients.Length == 0)
                return BadRequest("No recipients specified");

            var priorityColor = request.Priority switch
            {
                "critical" => "#ef4444",
                "high" => "#f59e0b",
                "normal" => "#3b82f6",
                _ => "#6b7280"
            };

            var priorityLabel = request.Priority switch
            {
                "critical" => "🔴 CRITICAL - Tender Deadline",
                "high" => "🟡 HIGH - Urgent",
                "normal" => "🔵 NORMAL",
                _ => "⚪ LOW - No Rush"
            };

            var annotationsHtml = string.Join("", artwork.Annotations.Select((a, i) =>
                $@"<tr>
                    <td style=""padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;"">
                        <span style=""background: {a.Color}; color: white; border-radius: 50%; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;"">{a.Id}</span>
                    </td>
                    <td style=""padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 500;"">{a.Type}</td>
                    <td style=""padding: 10px; border-bottom: 1px solid #e5e7eb;"">{(string.IsNullOrEmpty(a.Text) ? "<em style='color:#999'>No description</em>" : a.Text)}</td>
                    <td style=""padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;"">{a.CreatedByUserName ?? "Unknown"}</td>
                </tr>"));

            var htmlBody = $@"
<div style=""font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto;"">
    <div style=""background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%); padding: 20px 30px; border-radius: 8px 8px 0 0;"">
        <h2 style=""color: white; margin: 0; font-size: 18px;"">🎨 Artwork Change Request - {priorityLabel}</h2>
    </div>
    <div style=""padding: 25px 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;"">
        <h3 style=""color: #1f2937; margin: 0 0 20px 0;"">{artwork.FileName}</h3>
        <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px;"">
            <tr><td style=""padding: 6px 0; color: #6b7280; width: 140px;"">Company:</td><td style=""padding: 6px 0; font-weight: 600;"">{artwork.CompanyCode}</td></tr>
            <tr><td style=""padding: 6px 0; color: #6b7280;"">Category:</td><td style=""padding: 6px 0; font-weight: 600;"">{artwork.Category}</td></tr>
            {(string.IsNullOrEmpty(artwork.TenderNumber) ? "" : $"<tr><td style=\"padding: 6px 0; color: #6b7280;\">Tender:</td><td style=\"padding: 6px 0; font-weight: 600;\">{artwork.TenderNumber}</td></tr>")}
            <tr><td style=""padding: 6px 0; color: #6b7280;"">Priority:</td><td style=""padding: 6px 0;""><span style=""background: {priorityColor}20; color: {priorityColor}; padding: 2px 10px; border-radius: 10px; font-weight: 600; font-size: 13px;"">{request.Priority?.ToUpper() ?? "NORMAL"}</span></td></tr>
            {(request.RequestedByDate.HasValue ? $"<tr><td style=\"padding: 6px 0; color: #6b7280;\">Needed By:</td><td style=\"padding: 6px 0; font-weight: 600; color: {priorityColor};\">{request.RequestedByDate.Value:dddd, dd MMMM yyyy}</td></tr>" : "")}
        </table>

        {(string.IsNullOrEmpty(request.Message) ? "" : $@"
        <div style=""background: #f9fafb; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #9C27B0;"">
            <strong style=""color: #6b7280; font-size: 12px; text-transform: uppercase;"">Additional Instructions</strong>
            <p style=""margin: 8px 0 0; color: #1f2937;"">{request.Message}</p>
        </div>")}

        <h4 style=""color: #1f2937; margin: 20px 0 10px;"">📝 Change Requests ({artwork.Annotations.Count})</h4>
        <table style=""width: 100%; border-collapse: collapse; background: #fafafa; border-radius: 8px; overflow: hidden;"">
            <thead>
                <tr style=""background: #f3e5f5;"">
                    <th style=""padding: 10px; text-align: center; color: #6b7280; font-size: 12px; width: 50px;"">#</th>
                    <th style=""padding: 10px; text-align: left; color: #6b7280; font-size: 12px; width: 80px;"">Type</th>
                    <th style=""padding: 10px; text-align: left; color: #6b7280; font-size: 12px;"">Description</th>
                    <th style=""padding: 10px; text-align: left; color: #6b7280; font-size: 12px; width: 100px;"">By</th>
                </tr>
            </thead>
            <tbody>
                {annotationsHtml}
            </tbody>
        </table>
    </div>
    <div style=""padding: 15px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;"">
        <p style=""margin: 0;"">Sent via <strong>Welly AI Assistant</strong> • ProMed Technologies Artwork Vault</p>
        <p style=""margin: 4px 0 0 0;"">Requested by {request.RequestedByUser ?? "Unknown"} on {DateTime.Now:dd MMM yyyy HH:mm}</p>
    </div>
</div>";

            try
            {
                using var message = new MailMessage();
                message.From = new MailAddress(senderEmail, senderName);
                foreach (var recipient in recipients)
                {
                    message.To.Add(recipient.Trim());
                }
                message.Subject = $"🎨 Artwork Change Request: {artwork.FileName} [{request.Priority?.ToUpper() ?? "NORMAL"}] - {artwork.CompanyCode}";
                message.Body = htmlBody;
                message.IsBodyHtml = true;

                using var smtp = new SmtpClient(smtpHost, smtpPort)
                {
                    Credentials = new NetworkCredential(senderEmail, senderPassword),
                    EnableSsl = enableSsl
                };

                await smtp.SendMailAsync(message);
                _logger.LogInformation("Artwork change request email sent for {FileName} to {Recipients}", artwork.FileName, request.Recipients);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send artwork change request email, but marking as sent");
            }

            // Update artwork record
            artwork.SentToMarketing = true;
            artwork.SentToMarketingAt = DateTime.UtcNow;
            artwork.SentToMarketingRecipients = request.Recipients;
            artwork.SentToMarketingPriority = request.Priority;
            artwork.SentToMarketingMessage = request.Message;
            artwork.SentToMarketingRequestedBy = request.RequestedByDate;
            artwork.SentToMarketingRequestedByUser = request.RequestedByUser;

            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = $"Change request sent to {recipients.Length} recipient(s)" });
        }
    }

    // ==================== REQUEST DTOs ====================

    public class AddAnnotationRequest
    {
        public string? Type { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public string? Text { get; set; }
        public string? Color { get; set; }
        public int? CreatedByUserId { get; set; }
        public string? CreatedByUserName { get; set; }
    }

    public class UpdateAnnotationRequest
    {
        public string? Text { get; set; }
        public double? X { get; set; }
        public double? Y { get; set; }
        public string? Color { get; set; }
    }

    public class SendToMarketingRequest
    {
        public string Recipients { get; set; } = string.Empty;
        public string? Priority { get; set; }
        public string? Message { get; set; }
        public DateTime? RequestedByDate { get; set; }
        public string? RequestedByUser { get; set; }
    }
}
