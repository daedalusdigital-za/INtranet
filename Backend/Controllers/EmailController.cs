using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmailController : ControllerBase
    {
        private readonly IEmailService _emailService;
        private readonly ILogger<EmailController> _logger;

        public EmailController(IEmailService emailService, ILogger<EmailController> logger)
        {
            _emailService = emailService;
            _logger = logger;
        }

        /// <summary>
        /// Check email service health and which providers are available
        /// </summary>
        [HttpGet("health")]
        public async Task<IActionResult> CheckHealth()
        {
            try
            {
                var status = await _emailService.CheckEmailHealthAsync();
                
                if (status.IsHealthy)
                {
                    return Ok(new
                    {
                        status = "healthy",
                        activeProvider = status.ActiveProvider,
                        message = status.Message,
                        providers = status.Providers.Select(p => new
                        {
                            name = p.Name,
                            available = p.IsAvailable,
                            error = p.Error,
                            responseTimeMs = p.ResponseTimeMs
                        }),
                        checkedAt = status.CheckedAt
                    });
                }
                else
                {
                    return Ok(new
                    {
                        status = "unhealthy",
                        activeProvider = "None",
                        message = status.Message,
                        providers = status.Providers.Select(p => new
                        {
                            name = p.Name,
                            available = p.IsAvailable,
                            error = p.Error,
                            responseTimeMs = p.ResponseTimeMs
                        }),
                        checkedAt = status.CheckedAt,
                        suggestion = "Your office IP may be blocked. Try: 1) Check with ISP, 2) Use VPN, 3) Configure a SendGrid/Mailgun relay"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking email health");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Send a test email to verify the service is working
        /// </summary>
        [HttpPost("test")]
        public async Task<IActionResult> SendTestEmail([FromBody] TestEmailRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.To))
                {
                    return BadRequest(new { error = "Recipient email is required" });
                }

                var subject = request.Subject ?? "ProMed Intranet - Test Email";
                var body = request.Body ?? $@"
                    <html>
                    <body style='font-family: Arial, sans-serif;'>
                        <h2 style='color: #1976d2;'>Test Email from ProMed Intranet</h2>
                        <p>This is a test email to verify the email service is working correctly.</p>
                        <p>If you received this email, the email system is functioning properly.</p>
                        <hr/>
                        <p style='color: #666; font-size: 12px;'>Sent at: {DateTime.Now:yyyy-MM-dd HH:mm:ss}</p>
                    </body>
                    </html>";

                var success = await _emailService.SendEmailAsync(request.To, subject, body);

                if (success)
                {
                    return Ok(new
                    {
                        success = true,
                        message = $"Test email sent successfully to {request.To}"
                    });
                }
                else
                {
                    return Ok(new
                    {
                        success = false,
                        message = "Failed to send test email. Check email service health.",
                        suggestion = "Run GET /api/email/health to diagnose the issue"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending test email");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class TestEmailRequest
    {
        public string To { get; set; } = string.Empty;
        public string? Subject { get; set; }
        public string? Body { get; set; }
    }
}
