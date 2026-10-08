using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Misc utility endpoints for the front-end "Tools" (e.g. I Hate PDF).
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ToolsController : ControllerBase
    {
        private readonly IEmailService _emailService;
        private readonly ILogger<ToolsController> _logger;
        private readonly IAuditLogService _auditLog;
        private readonly string _documentsBasePath;

        public ToolsController(
            IEmailService emailService,
            ILogger<ToolsController> logger,
            IAuditLogService auditLog,
            IConfiguration configuration)
        {
            _emailService = emailService;
            _logger = logger;
            _auditLog = auditLog;
            _documentsBasePath = configuration.GetValue<string>("DocumentsPath") ?? "/app/documents";
        }

        /// <summary>
        /// Email an already-built PDF (e.g. a merged/compressed file from the
        /// I Hate PDF tool) as an attachment. The file is streamed from the
        /// browser and never persisted server-side.
        /// </summary>
        [HttpPost("email-pdf")]
        [RequestSizeLimit(60_000_000)] // 60 MB
        public async Task<IActionResult> EmailPdf(
            [FromForm] string to,
            [FromForm] string? subject,
            [FromForm] string? message,
            IFormFile file)
        {
            if (string.IsNullOrWhiteSpace(to))
                return BadRequest(new { message = "Recipient email is required." });

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file provided." });

            // Split multiple recipients on comma / semicolon.
            var recipients = to
                .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(r => r.Trim())
                .Where(r => r.Length > 0)
                .ToList();

            if (recipients.Count == 0)
                return BadRequest(new { message = "No valid recipient email addresses." });

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var bytes = ms.ToArray();

            var fileName = string.IsNullOrWhiteSpace(file.FileName) ? "document.pdf" : file.FileName;
            if (!fileName.ToLower().EndsWith(".pdf")) fileName += ".pdf";

            var attachments = new List<EmailAttachment>
            {
                new EmailAttachment
                {
                    FileName = fileName,
                    Content = bytes,
                    ContentType = "application/pdf"
                }
            };

            var safeSubject = string.IsNullOrWhiteSpace(subject) ? "Document from Intranet" : subject!;
            var bodyText = string.IsNullOrWhiteSpace(message)
                ? "Please find the attached PDF document."
                : message!;
            var body = $@"<div style=""font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1e293b;line-height:1.6"">
                <p>{System.Net.WebUtility.HtmlEncode(bodyText).Replace("\n", "<br>")}</p>
                <hr style=""border:none;border-top:1px solid #e2e8f0;margin:16px 0"">
                <p style=""color:#64748b;font-size:12px"">Sent from the Promed Technologies Intranet — I Hate PDF tool.</p>
            </div>";

            try
            {
                var ok = await _emailService.SendEmailAsync(recipients, safeSubject, body, true, attachments);
                if (!ok)
                    return StatusCode(502, new { message = "The email could not be sent. Please try again later." });

                _logger.LogInformation("Emailed PDF '{FileName}' to {Recipients}", fileName, string.Join(", ", recipients));
                return Ok(new { message = "Email sent successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to email PDF to {Recipients}", string.Join(", ", recipients));
                return StatusCode(500, new { message = "An error occurred while sending the email." });
            }
        }

        /// <summary>
        /// Persist a stamped PDF (produced client-side by the I Hate PDF ▸ Stamp tool)
        /// into the IT portal under a "Stamped" folder, and record the activity in the
        /// admin audit log for traceability.
        /// </summary>
        [HttpPost("stamp-pdf")]
        [RequestSizeLimit(80_000_000)] // 80 MB
        public async Task<IActionResult> SaveStampedPdf(
            [FromForm] string? originalName,
            [FromForm] string? stampName,
            IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file provided." });

            try
            {
                _auditLog.SetHttpContext(HttpContext);

                // Store in the IT portal ▸ Stamped folder.
                var stampedDir = Path.Combine(_documentsBasePath, "IT", "Stamped");
                Directory.CreateDirectory(stampedDir);

                // Build a safe, timestamped file name.
                var baseName = string.IsNullOrWhiteSpace(originalName) ? "document.pdf" : originalName!;
                baseName = Path.GetFileName(baseName); // strip any path components
                var nameNoExt = Path.GetFileNameWithoutExtension(baseName);
                if (string.IsNullOrWhiteSpace(nameNoExt)) nameNoExt = "document";
                foreach (var c in Path.GetInvalidFileNameChars())
                    nameNoExt = nameNoExt.Replace(c, '_');

                var stampLabel = string.IsNullOrWhiteSpace(stampName) ? "" : $"-{stampName}";
                foreach (var c in Path.GetInvalidFileNameChars())
                    stampLabel = stampLabel.Replace(c, '_');

                var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
                var finalName = $"{nameNoExt}{stampLabel}-STAMPED-{stamp}.pdf";
                var finalPath = Path.Combine(stampedDir, finalName);

                using (var stream = new FileStream(finalPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var details = System.Text.Json.JsonSerializer.Serialize(new
                {
                    originalName = baseName,
                    stampName = stampName ?? "(unspecified)",
                    savedAs = finalName,
                    folder = "IT/Stamped",
                    sizeBytes = file.Length
                });

                await _auditLog.LogAsync(
                    action: "Stamped PDF",
                    category: "document",
                    entityType: "Document",
                    entityId: null,
                    description: $"Applied '{stampName ?? "stamp"}' stamp to '{baseName}' and saved to IT ▸ Stamped.",
                    details: details,
                    severity: "info",
                    isSuccess: true);

                _logger.LogInformation("Saved stamped PDF '{FinalName}' to IT/Stamped.", finalName);

                return Ok(new
                {
                    message = "Stamped PDF saved to IT portal (Stamped).",
                    savedAs = finalName,
                    folder = "IT/Stamped"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save stamped PDF.");
                return StatusCode(500, new { message = "Failed to save the stamped PDF." });
            }
        }
    }
}
