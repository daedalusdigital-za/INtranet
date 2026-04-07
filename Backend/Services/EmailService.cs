using System.Net;
using System.Net.Mail;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ProjectTracker.API.Services
{
    public interface IEmailService
    {
        Task<bool> SendEmailAsync(string to, string subject, string body, bool isHtml = true, List<EmailAttachment>? attachments = null);
        Task<bool> SendEmailAsync(List<string> to, string subject, string body, bool isHtml = true, List<EmailAttachment>? attachments = null, List<string>? cc = null);
        Task<EmailHealthStatus> CheckEmailHealthAsync();
    }

    public class EmailAttachment
    {
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = "application/octet-stream";
    }

    public class EmailHealthStatus
    {
        public bool IsHealthy { get; set; }
        public string ActiveProvider { get; set; } = "None";
        public string Message { get; set; } = string.Empty;
        public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
        public List<ProviderStatus> Providers { get; set; } = new();
    }

    public class ProviderStatus
    {
        public string Name { get; set; } = string.Empty;
        public bool IsAvailable { get; set; }
        public string? Error { get; set; }
        public int ResponseTimeMs { get; set; }
    }

    public class EmailSettings
    {
        public string SmtpHost { get; set; } = "smtp.office365.com";
        public int SmtpPort { get; set; } = 587;
        public string SenderEmail { get; set; } = string.Empty;
        public string SenderName { get; set; } = "ProMed Logistics";
        public string SenderPassword { get; set; } = string.Empty;
        public bool EnableSsl { get; set; } = true;
        public bool UseDefaultCredentials { get; set; } = false;
    }

    public class FallbackEmailSettings
    {
        public string SmtpHost { get; set; } = "mail.promedtechnologies.co.za";
        public int SmtpPort { get; set; } = 465;
        public string SenderEmail { get; set; } = string.Empty;
        public string SenderName { get; set; } = "ProMed Logistics";
        public string SenderPassword { get; set; } = string.Empty;
        public bool EnableSsl { get; set; } = true;
    }

    public class EmailService : IEmailService
    {
        private readonly EmailSettings _settings;
        private readonly FallbackEmailSettings _fallbackSettings;
        private readonly ILogger<EmailService> _logger;
        private readonly IConfiguration _configuration;
        
        // Cache provider health status to avoid repeated connection tests
        private static string? _lastWorkingProvider;
        private static DateTime _lastHealthCheck = DateTime.MinValue;
        private static readonly TimeSpan HealthCheckInterval = TimeSpan.FromMinutes(5);

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _configuration = configuration;
            _settings = new EmailSettings();
            configuration.GetSection("Email").Bind(_settings);
            
            // Load fallback settings - try FallbackEmail first, then AIEmail
            _fallbackSettings = new FallbackEmailSettings();
            var fallbackSection = configuration.GetSection("FallbackEmail");
            if (fallbackSection.Exists())
            {
                fallbackSection.Bind(_fallbackSettings);
            }
            
            // If FallbackEmail not configured, try AIEmail
            if (string.IsNullOrEmpty(_fallbackSettings.SenderEmail))
            {
                configuration.GetSection("AIEmail").Bind(_fallbackSettings);
            }
            
            // If still not configured, use defaults for own mail server
            if (string.IsNullOrEmpty(_fallbackSettings.SmtpHost))
            {
                _fallbackSettings.SmtpHost = "mail.promedtechnologies.co.za";
                _fallbackSettings.SmtpPort = 465;
            }
            
            _logger = logger;
            
            _logger.LogInformation("Email service initialized. Primary: {Primary}, Fallback: {Fallback}",
                _settings.SmtpHost, _fallbackSettings.SmtpHost);
        }

        public async Task<EmailHealthStatus> CheckEmailHealthAsync()
        {
            var status = new EmailHealthStatus();
            
            // Check primary provider (Office 365)
            var primaryStatus = await TestSmtpConnectionAsync(
                "Office365",
                _settings.SmtpHost,
                _settings.SmtpPort,
                _settings.SenderEmail,
                _settings.SenderPassword,
                _settings.EnableSsl);
            status.Providers.Add(primaryStatus);
            
            // Check fallback provider (own mail server)
            var fallbackStatus = await TestSmtpConnectionAsync(
                "ProMedMail",
                _fallbackSettings.SmtpHost,
                _fallbackSettings.SmtpPort,
                _fallbackSettings.SenderEmail,
                _fallbackSettings.SenderPassword,
                _fallbackSettings.EnableSsl);
            status.Providers.Add(fallbackStatus);
            
            // Determine active provider
            if (primaryStatus.IsAvailable)
            {
                status.IsHealthy = true;
                status.ActiveProvider = "Office365";
                status.Message = "Primary email provider is working";
            }
            else if (fallbackStatus.IsAvailable)
            {
                status.IsHealthy = true;
                status.ActiveProvider = "ProMedMail";
                status.Message = "Using fallback email provider (your mail server)";
            }
            else
            {
                status.IsHealthy = false;
                status.ActiveProvider = "None";
                status.Message = "All email providers are unavailable. Check network/IP restrictions.";
            }
            
            return status;
        }

        private async Task<ProviderStatus> TestSmtpConnectionAsync(string name, string host, int port, string email, string password, bool ssl)
        {
            var status = new ProviderStatus { Name = name };
            var sw = System.Diagnostics.Stopwatch.StartNew();
            
            try
            {
                if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
                {
                    status.IsAvailable = false;
                    status.Error = "Not configured (missing email or password)";
                    return status;
                }

                using var client = new MailKit.Net.Smtp.SmtpClient();
                client.Timeout = 10000; // 10 second timeout for health check
                
                var secureOption = ssl 
                    ? (port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
                    : SecureSocketOptions.None;
                
                await client.ConnectAsync(host, port, secureOption);
                await client.AuthenticateAsync(email, password);
                await client.DisconnectAsync(true);
                
                status.IsAvailable = true;
                sw.Stop();
                status.ResponseTimeMs = (int)sw.ElapsedMilliseconds;
            }
            catch (Exception ex)
            {
                status.IsAvailable = false;
                status.Error = ex.Message;
                sw.Stop();
                status.ResponseTimeMs = (int)sw.ElapsedMilliseconds;
                _logger.LogWarning("SMTP provider {Provider} unavailable: {Error}", name, ex.Message);
            }
            
            return status;
        }

        public async Task<bool> SendEmailAsync(string to, string subject, string body, bool isHtml = true, List<EmailAttachment>? attachments = null)
        {
            return await SendEmailAsync(new List<string> { to }, subject, body, isHtml, attachments);
        }

        public async Task<bool> SendEmailAsync(List<string> to, string subject, string body, bool isHtml = true, List<EmailAttachment>? attachments = null, List<string>? cc = null)
        {
            // Try primary provider first, then fallback
            var primarySuccess = await TrySendWithProviderAsync(
                "Office365",
                _settings.SmtpHost,
                _settings.SmtpPort,
                _settings.SenderEmail,
                _settings.SenderName,
                _settings.SenderPassword,
                _settings.EnableSsl,
                to, subject, body, isHtml, attachments, cc);
                
            if (primarySuccess)
            {
                _lastWorkingProvider = "Office365";
                return true;
            }
            
            _logger.LogWarning("Primary email provider failed, trying fallback...");
            
            // Try fallback provider
            var fallbackSuccess = await TrySendWithProviderAsync(
                "ProMedMail",
                _fallbackSettings.SmtpHost,
                _fallbackSettings.SmtpPort,
                _fallbackSettings.SenderEmail,
                _fallbackSettings.SenderName,
                _fallbackSettings.SenderPassword,
                _fallbackSettings.EnableSsl,
                to, subject, body, isHtml, attachments, cc);
                
            if (fallbackSuccess)
            {
                _lastWorkingProvider = "ProMedMail";
                return true;
            }
            
            _logger.LogError("All email providers failed. Email not sent to {Recipients}", string.Join(", ", to));
            return false;
        }

        private async Task<bool> TrySendWithProviderAsync(
            string providerName,
            string host,
            int port,
            string senderEmail,
            string senderName,
            string password,
            bool enableSsl,
            List<string> to,
            string subject,
            string body,
            bool isHtml,
            List<EmailAttachment>? attachments,
            List<string>? cc)
        {
            try
            {
                if (string.IsNullOrEmpty(senderEmail))
                {
                    _logger.LogWarning("{Provider}: Not configured (no sender email)", providerName);
                    return false;
                }

                if (string.IsNullOrEmpty(password))
                {
                    _logger.LogWarning("{Provider}: Not configured (no password)", providerName);
                    return false;
                }

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(senderName, senderEmail));
                
                foreach (var recipient in to.Where(r => !string.IsNullOrWhiteSpace(r)))
                {
                    message.To.Add(MailboxAddress.Parse(recipient.Trim()));
                }

                if (cc != null)
                {
                    foreach (var ccRecipient in cc.Where(r => !string.IsNullOrWhiteSpace(r)))
                    {
                        message.Cc.Add(MailboxAddress.Parse(ccRecipient.Trim()));
                    }
                }

                if (message.To.Count == 0)
                {
                    _logger.LogWarning("No valid recipients provided");
                    return false;
                }

                message.Subject = subject;

                var builder = new BodyBuilder();
                if (isHtml)
                    builder.HtmlBody = body;
                else
                    builder.TextBody = body;

                // Add attachments
                if (attachments != null)
                {
                    foreach (var attachment in attachments)
                    {
                        builder.Attachments.Add(attachment.FileName, attachment.Content, ContentType.Parse(attachment.ContentType));
                    }
                }

                message.Body = builder.ToMessageBody();

                using var client = new MailKit.Net.Smtp.SmtpClient();
                client.Timeout = 30000; // 30 second timeout
                
                // Determine secure connection type
                var secureOption = enableSsl 
                    ? (port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
                    : SecureSocketOptions.None;
                
                await client.ConnectAsync(host, port, secureOption);
                await client.AuthenticateAsync(senderEmail, password);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
                
                _logger.LogInformation("[{Provider}] Email sent successfully to {Recipients}. Subject: {Subject}", 
                    providerName, string.Join(", ", to), subject);
                
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[{Provider}] Failed to send email: {Error}", providerName, ex.Message);
                return false;
            }
        }
    }
}
