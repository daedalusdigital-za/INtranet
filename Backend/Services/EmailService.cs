using System.Net;
using System.Net.Mail;

namespace ProjectTracker.API.Services
{
    public interface IEmailService
    {
        Task<bool> SendEmailAsync(string to, string subject, string body, bool isHtml = true, List<EmailAttachment>? attachments = null);
        Task<bool> SendEmailAsync(List<string> to, string subject, string body, bool isHtml = true, List<EmailAttachment>? attachments = null, List<string>? cc = null);
    }

    public class EmailAttachment
    {
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = "application/octet-stream";
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

    public class EmailService : IEmailService
    {
        private readonly EmailSettings _settings;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _settings = new EmailSettings();
            configuration.GetSection("Email").Bind(_settings);
            _logger = logger;
        }

        public async Task<bool> SendEmailAsync(string to, string subject, string body, bool isHtml = true, List<EmailAttachment>? attachments = null)
        {
            return await SendEmailAsync(new List<string> { to }, subject, body, isHtml, attachments);
        }

        public async Task<bool> SendEmailAsync(List<string> to, string subject, string body, bool isHtml = true, List<EmailAttachment>? attachments = null, List<string>? cc = null)
        {
            try
            {
                if (string.IsNullOrEmpty(_settings.SenderEmail))
                {
                    _logger.LogWarning("Email service not configured. SenderEmail is empty.");
                    return false;
                }

                using var message = new MailMessage();
                message.From = new MailAddress(_settings.SenderEmail, _settings.SenderName);
                
                foreach (var recipient in to.Where(r => !string.IsNullOrWhiteSpace(r)))
                {
                    message.To.Add(recipient.Trim());
                }

                if (cc != null)
                {
                    foreach (var ccRecipient in cc.Where(r => !string.IsNullOrWhiteSpace(r)))
                    {
                        message.CC.Add(ccRecipient.Trim());
                    }
                }

                if (message.To.Count == 0)
                {
                    _logger.LogWarning("No valid recipients provided");
                    return false;
                }

                message.Subject = subject;
                message.Body = body;
                message.IsBodyHtml = isHtml;

                // Add attachments
                if (attachments != null)
                {
                    foreach (var attachment in attachments)
                    {
                        var stream = new MemoryStream(attachment.Content);
                        var mailAttachment = new Attachment(stream, attachment.FileName, attachment.ContentType);
                        message.Attachments.Add(mailAttachment);
                    }
                }

                using var client = new SmtpClient(_settings.SmtpHost, _settings.SmtpPort);
                client.EnableSsl = _settings.EnableSsl;
                client.UseDefaultCredentials = _settings.UseDefaultCredentials;
                
                if (!_settings.UseDefaultCredentials && !string.IsNullOrEmpty(_settings.SenderPassword))
                {
                    client.Credentials = new NetworkCredential(_settings.SenderEmail, _settings.SenderPassword);
                }

                await client.SendMailAsync(message);
                
                _logger.LogInformation("Email sent successfully to {Recipients}. Subject: {Subject}", 
                    string.Join(", ", to), subject);
                
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {Recipients}. Subject: {Subject}", 
                    string.Join(", ", to), subject);
                return false;
            }
        }
    }
}
