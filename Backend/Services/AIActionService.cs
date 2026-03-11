using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Services
{
    /// <summary>
    /// Represents the logged-in user's context for AI personalization
    /// </summary>
    public class ChatUserContext
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Surname { get; set; } = string.Empty;
        public string FullName => $"{Name} {Surname}".Trim();
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public int? DepartmentId { get; set; }
    }

    /// <summary>
    /// Result of executing an AI-requested action
    /// </summary>
    public class AIActionResult
    {
        public bool Success { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public int? EntityId { get; set; }
    }

    public interface IAIActionService
    {
        Task<List<AIActionResult>> ProcessActionsAsync(string aiResponse, ChatUserContext user);
        string StripActionTags(string aiResponse);
    }

    /// <summary>
    /// Detects and executes structured action tags embedded in AI responses.
    /// Actions are safe — they use existing database models and validation.
    /// 
    /// Supported action tags:
    ///   [ACTION:CREATE_TICKET] { "title": "...", "description": "...", "priority": "...", "category": "..." } [/ACTION]
    ///   [ACTION:CREATE_MEETING] { "title": "...", "date": "...", "startTime": "...", "location": "..." } [/ACTION]
    ///   [ACTION:SEND_EMAIL] { "to": "...", "subject": "...", "body": "..." } [/ACTION]
    /// </summary>
    public class AIActionService : IAIActionService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AIActionService> _logger;

        // Regex to find action blocks in AI output
        private static readonly Regex ActionPattern = new(
            @"\[ACTION:(\w+)\]\s*(\{[^}]+\})\s*\[/ACTION\]",
            RegexOptions.Compiled | RegexOptions.Singleline);

        public AIActionService(
            IServiceScopeFactory scopeFactory,
            ILogger<AIActionService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        /// <summary>
        /// Scan AI response for action tags and execute them
        /// </summary>
        public async Task<List<AIActionResult>> ProcessActionsAsync(string aiResponse, ChatUserContext user)
        {
            var results = new List<AIActionResult>();

            if (string.IsNullOrEmpty(aiResponse)) return results;

            var matches = ActionPattern.Matches(aiResponse);
            foreach (Match match in matches)
            {
                var actionType = match.Groups[1].Value.ToUpperInvariant();
                var jsonPayload = match.Groups[2].Value;

                _logger.LogInformation("AI Action detected: {ActionType} by user {User}", actionType, user.FullName);

                try
                {
                    var result = actionType switch
                    {
                        "CREATE_TICKET" => await CreateTicketAsync(jsonPayload, user),
                        "CREATE_MEETING" => await CreateMeetingAsync(jsonPayload, user),
                        "SEND_EMAIL" => await SendEmailAsync(jsonPayload, user),
                        _ => new AIActionResult
                        {
                            Success = false,
                            ActionType = actionType,
                            Message = $"Unknown action type: {actionType}"
                        }
                    };

                    results.Add(result);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to execute action {ActionType}", actionType);
                    results.Add(new AIActionResult
                    {
                        Success = false,
                        ActionType = actionType,
                        Message = $"Action failed: {ex.Message}"
                    });
                }
            }

            return results;
        }

        /// <summary>
        /// Remove action tags from the response so the user sees clean text
        /// </summary>
        public string StripActionTags(string aiResponse)
        {
            if (string.IsNullOrEmpty(aiResponse)) return aiResponse;
            return ActionPattern.Replace(aiResponse, "").Trim();
        }

        #region Action Implementations

        private async Task<AIActionResult> CreateTicketAsync(string json, ChatUserContext user)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var payload = JsonSerializer.Deserialize<JsonElement>(json);

            var title = payload.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            var description = payload.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
            var priority = payload.TryGetProperty("priority", out var p) ? p.GetString() ?? "Medium" : "Medium";
            var category = payload.TryGetProperty("category", out var c) ? c.GetString() ?? "General" : "General";

            // Validate priority
            var validPriorities = new[] { "Low", "Medium", "High", "Critical" };
            if (!validPriorities.Contains(priority, StringComparer.OrdinalIgnoreCase))
                priority = "Medium";

            // Validate category
            var validCategories = new[] { "General", "IT Support", "Software", "Hardware", "Network", "Account", "Access", "Other" };
            if (!validCategories.Contains(category, StringComparer.OrdinalIgnoreCase))
                category = "General";

            if (string.IsNullOrWhiteSpace(title))
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "CREATE_TICKET",
                    Message = "Ticket title is required."
                };
            }

            var ticket = new SupportTicket
            {
                Title = title,
                Description = $"{description}\n\n[Created via Welly AI on behalf of {user.FullName}]",
                Priority = priority,
                Category = category,
                SubmittedBy = user.FullName,
                SubmittedByEmail = user.Email,
                SubmittedByUserId = user.UserId,
                Status = "Open",
                SubmittedDate = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            };

            context.SupportTickets.Add(ticket);
            await context.SaveChangesAsync();

            _logger.LogInformation("AI Action: Created ticket #{TicketId} '{Title}' for {User}",
                ticket.TicketId, ticket.Title, user.FullName);

            return new AIActionResult
            {
                Success = true,
                ActionType = "CREATE_TICKET",
                Message = $"✅ Support ticket **#{ticket.TicketId}** created: \"{ticket.Title}\" (Priority: {ticket.Priority})",
                EntityId = ticket.TicketId
            };
        }

        private async Task<AIActionResult> CreateMeetingAsync(string json, ChatUserContext user)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var payload = JsonSerializer.Deserialize<JsonElement>(json);

            var title = payload.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            var description = payload.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
            var dateStr = payload.TryGetProperty("date", out var dt) ? dt.GetString() ?? "" : "";
            var startTimeStr = payload.TryGetProperty("startTime", out var st) ? st.GetString() ?? "" : "";
            var endTimeStr = payload.TryGetProperty("endTime", out var et) ? et.GetString() ?? "" : "";
            var location = payload.TryGetProperty("location", out var loc) ? loc.GetString() ?? "Online" : "Online";

            if (string.IsNullOrWhiteSpace(title))
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "CREATE_MEETING",
                    Message = "Meeting title is required."
                };
            }

            // Parse date — accept multiple formats
            if (!DateTime.TryParse(dateStr, out var meetingDate))
            {
                // Try relative dates
                var lower = dateStr.ToLowerInvariant();
                if (lower.Contains("today"))
                    meetingDate = DateTime.Today;
                else if (lower.Contains("tomorrow"))
                    meetingDate = DateTime.Today.AddDays(1);
                else if (lower.Contains("monday"))
                    meetingDate = GetNextWeekday(DayOfWeek.Monday);
                else if (lower.Contains("tuesday"))
                    meetingDate = GetNextWeekday(DayOfWeek.Tuesday);
                else if (lower.Contains("wednesday"))
                    meetingDate = GetNextWeekday(DayOfWeek.Wednesday);
                else if (lower.Contains("thursday"))
                    meetingDate = GetNextWeekday(DayOfWeek.Thursday);
                else if (lower.Contains("friday"))
                    meetingDate = GetNextWeekday(DayOfWeek.Friday);
                else
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "CREATE_MEETING",
                        Message = $"Could not parse meeting date: \"{dateStr}\""
                    };
                }
            }

            // Parse start time
            if (!TimeSpan.TryParse(startTimeStr, out var startTime))
            {
                // Try common formats like "2pm", "14:00", "2:30 PM"
                if (DateTime.TryParse(startTimeStr, out var parsedTime))
                    startTime = parsedTime.TimeOfDay;
                else
                    startTime = new TimeSpan(9, 0, 0); // Default 9am
            }

            // Parse end time
            TimeSpan? endTime = null;
            if (!string.IsNullOrEmpty(endTimeStr) && TimeSpan.TryParse(endTimeStr, out var et2))
                endTime = et2;
            else if (!string.IsNullOrEmpty(endTimeStr) && DateTime.TryParse(endTimeStr, out var parsedEnd))
                endTime = parsedEnd.TimeOfDay;
            else
                endTime = startTime.Add(TimeSpan.FromHours(1)); // Default 1 hour

            var meeting = new Meeting
            {
                Title = title,
                Description = $"{description}\n\n[Scheduled via Welly AI on behalf of {user.FullName}]".Trim(),
                MeetingDate = meetingDate.Date,
                StartTime = startTime,
                EndTime = endTime,
                Location = location,
                OrganizerId = user.UserId,
                Status = "Confirmed",
                CreatedAt = DateTime.UtcNow
            };

            context.Meetings.Add(meeting);
            await context.SaveChangesAsync();

            _logger.LogInformation("AI Action: Created meeting #{MeetingId} '{Title}' for {User} on {Date}",
                meeting.Id, meeting.Title, user.FullName, meetingDate.ToString("yyyy-MM-dd"));

            return new AIActionResult
            {
                Success = true,
                ActionType = "CREATE_MEETING",
                Message = $"✅ Meeting **\"{meeting.Title}\"** scheduled for {meetingDate:dddd, d MMMM yyyy} at {startTime:hh\\:mm} in {location}.",
                EntityId = meeting.Id
            };
        }

        private async Task<AIActionResult> SendEmailAsync(string json, ChatUserContext user)
        {
            var payload = JsonSerializer.Deserialize<JsonElement>(json);

            var to = payload.TryGetProperty("to", out var t) ? t.GetString() ?? "" : "";
            var subject = payload.TryGetProperty("subject", out var s) ? s.GetString() ?? "" : "";
            var body = payload.TryGetProperty("body", out var b) ? b.GetString() ?? "" : "";

            if (string.IsNullOrWhiteSpace(to))
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "SEND_EMAIL",
                    Message = "Recipient email address is required."
                };
            }

            if (string.IsNullOrWhiteSpace(subject))
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "SEND_EMAIL",
                    Message = "Email subject is required."
                };
            }

            // Basic email validation
            if (!to.Contains('@') || !to.Contains('.'))
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "SEND_EMAIL",
                    Message = $"Invalid email address: \"{to}\""
                };
            }

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

                // Load AI-specific email settings (separate from logistics email)
                var smtpHost = configuration["AIEmail:SmtpHost"] ?? "mail.promedtechnologies.co.za";
                var smtpPort = int.TryParse(configuration["AIEmail:SmtpPort"], out var port) ? port : 465;
                var senderEmail = configuration["AIEmail:SenderEmail"] ?? "ai@promedtechnologies.co.za";
                var senderName = configuration["AIEmail:SenderName"] ?? "Welly - ProMed AI Assistant";
                var senderPassword = configuration["AIEmail:SenderPassword"] ?? "";
                var enableSsl = bool.TryParse(configuration["AIEmail:EnableSsl"], out var ssl) ? ssl : true;

                // Build HTML email body with professional formatting
                var htmlBody = $@"
<div style=""font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;"">
    <div style=""background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px 30px; border-radius: 8px 8px 0 0;"">
        <h2 style=""color: white; margin: 0; font-size: 18px;"">📧 Message from ProMed Technologies</h2>
    </div>
    <div style=""padding: 25px 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;"">
        {body.Replace("\n", "<br/>")}
    </div>
    <div style=""padding: 15px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;"">
        <p style=""margin: 0;"">Sent via <strong>Welly AI Assistant</strong> on behalf of <strong>{user.FullName}</strong> ({user.Email})</p>
        <p style=""margin: 4px 0 0 0;"">ProMed Technologies • <a href=""mailto:{user.Email}"" style=""color: #667eea;"">{user.Email}</a></p>
    </div>
</div>";

                using var message = new System.Net.Mail.MailMessage();
                message.From = new System.Net.Mail.MailAddress(senderEmail, senderName);
                message.To.Add(to.Trim());
                message.Subject = subject;
                message.Body = htmlBody;
                message.IsBodyHtml = true;

                // Add Reply-To as the requesting user so replies go back to them
                message.ReplyToList.Add(new System.Net.Mail.MailAddress(user.Email, user.FullName));

                using var client = new System.Net.Mail.SmtpClient(smtpHost, smtpPort);
                client.EnableSsl = enableSsl;
                client.UseDefaultCredentials = false;
                client.Credentials = new System.Net.NetworkCredential(senderEmail, senderPassword);

                await client.SendMailAsync(message);

                _logger.LogInformation("AI Action: Sent email to '{To}' subject '{Subject}' on behalf of {User}",
                    to, subject, user.FullName);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "SEND_EMAIL",
                    Message = $"✅ Email sent to **{to}** with subject \"{subject}\"."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AI Action: Failed to send email to '{To}' for {User}", to, user.FullName);
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "SEND_EMAIL",
                    Message = $"Failed to send email: {ex.Message}"
                };
            }
        }

        private static DateTime GetNextWeekday(DayOfWeek day)
        {
            var today = DateTime.Today;
            var daysUntil = ((int)day - (int)today.DayOfWeek + 7) % 7;
            if (daysUntil == 0) daysUntil = 7; // Next week if today
            return today.AddDays(daysUntil);
        }

        #endregion
    }
}
