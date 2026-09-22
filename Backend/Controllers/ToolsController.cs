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

        public ToolsController(IEmailService emailService, ILogger<ToolsController> logger)
        {
            _emailService = emailService;
            _logger = logger;
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
    }
}
