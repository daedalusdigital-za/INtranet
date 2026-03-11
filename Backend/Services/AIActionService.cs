using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Hubs;
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
    ///   [ACTION:ASSIGN_TODO] { "title": "...", "assignedTo": "...", "dueDate": "...", "description": "...", "priority": "Normal", "category": "" } [/ACTION]
    ///   [ACTION:TRIPSHEET_GET_WAREHOUSES] {} [/ACTION]
    ///   [ACTION:TRIPSHEET_GET_INVOICES] { "warehouseId": 1, "customerFilter": "" } [/ACTION]
    ///   [ACTION:TRIPSHEET_GET_DRIVERS] {} [/ACTION]
    ///   [ACTION:TRIPSHEET_GET_VEHICLES] {} [/ACTION]
    ///   [ACTION:TRIPSHEET_PREVIEW] { "invoiceIds": [1,2,3] } [/ACTION]
    ///   [ACTION:TRIPSHEET_CREATE] { "invoiceIds": [1,2,3], "warehouseId": 1, "driverId": 1, "vehicleId": 1, "scheduledDate": "2025-01-20", "notes": "" } [/ACTION]
    ///   [ACTION:TRACK_VEHICLE] { "registration": "ABC 123 GP" } [/ACTION]
    ///   [ACTION:FLEET_STATUS] {} [/ACTION]
    /// </summary>
    public class AIActionService : IAIActionService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AIActionService> _logger;

        // Regex to find action blocks in AI output — supports nested JSON with arrays
        private static readonly Regex ActionPattern = new(
            @"\[ACTION:(\w+)\]\s*(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})\s*\[/ACTION\]",
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
                        "ASSIGN_TODO" => await AssignTodoAsync(jsonPayload, user),
                        "TRIPSHEET_GET_WAREHOUSES" => await TripSheetGetWarehousesAsync(),
                        "TRIPSHEET_GET_INVOICES" => await TripSheetGetInvoicesAsync(jsonPayload),
                        "TRIPSHEET_GET_DRIVERS" => await TripSheetGetDriversAsync(),
                        "TRIPSHEET_GET_VEHICLES" => await TripSheetGetVehiclesAsync(),
                        "TRIPSHEET_PREVIEW" => await TripSheetPreviewAsync(jsonPayload),
                        "TRIPSHEET_CREATE" => await TripSheetCreateAsync(jsonPayload, user),
                        "TRACK_VEHICLE" => await TrackVehicleAsync(jsonPayload),
                        "FLEET_STATUS" => await FleetStatusAsync(),
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

        private async Task<AIActionResult> AssignTodoAsync(string json, ChatUserContext user)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var payload = JsonSerializer.Deserialize<JsonElement>(json);

                var title = payload.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
                var description = payload.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
                var assignedTo = payload.TryGetProperty("assignedTo", out var a) ? a.GetString() ?? "" : "";
                var dueDateStr = payload.TryGetProperty("dueDate", out var dd) ? dd.GetString() ?? "" : "";
                var priority = payload.TryGetProperty("priority", out var p) ? p.GetString() ?? "Normal" : "Normal";
                var category = payload.TryGetProperty("category", out var c) ? c.GetString() : null;

                if (string.IsNullOrWhiteSpace(title))
                {
                    return new AIActionResult { Success = false, ActionType = "ASSIGN_TODO", Message = "Task title is required." };
                }

                if (string.IsNullOrWhiteSpace(assignedTo))
                {
                    return new AIActionResult { Success = false, ActionType = "ASSIGN_TODO", Message = "Please specify who to assign this task to (name or email)." };
                }

                // Validate priority
                var validPriorities = new[] { "Low", "Normal", "High", "Urgent" };
                if (!validPriorities.Contains(priority, StringComparer.OrdinalIgnoreCase))
                    priority = "Normal";

                // Resolve assignedTo — search by name or email
                var lowerSearch = assignedTo.ToLower();
                var assignee = await context.Users
                    .Where(u => u.IsActive)
                    .Where(u => u.Email.ToLower() == lowerSearch
                        || (u.Name + " " + u.Surname).ToLower().Contains(lowerSearch)
                        || u.Name.ToLower() == lowerSearch
                        || u.Surname.ToLower() == lowerSearch)
                    .FirstOrDefaultAsync();

                if (assignee == null)
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "ASSIGN_TODO",
                        Message = $"Could not find an active employee matching \"{assignedTo}\". Please check the name or email and try again."
                    };
                }

                // Parse due date
                DateTime dueDate;
                if (!DateTime.TryParse(dueDateStr, out dueDate))
                {
                    var lower = dueDateStr.ToLowerInvariant();
                    if (lower.Contains("today"))
                        dueDate = DateTime.Today;
                    else if (lower.Contains("tomorrow"))
                        dueDate = DateTime.Today.AddDays(1);
                    else if (lower.Contains("monday"))
                        dueDate = GetNextWeekday(DayOfWeek.Monday);
                    else if (lower.Contains("tuesday"))
                        dueDate = GetNextWeekday(DayOfWeek.Tuesday);
                    else if (lower.Contains("wednesday"))
                        dueDate = GetNextWeekday(DayOfWeek.Wednesday);
                    else if (lower.Contains("thursday"))
                        dueDate = GetNextWeekday(DayOfWeek.Thursday);
                    else if (lower.Contains("friday"))
                        dueDate = GetNextWeekday(DayOfWeek.Friday);
                    else
                        dueDate = DateTime.Today.AddDays(1); // Default to tomorrow
                }

                // Create the TodoTask
                var task = new TodoTask
                {
                    Title = title,
                    Description = !string.IsNullOrWhiteSpace(description)
                        ? $"{description}\n\n[Assigned via Welly AI by {user.FullName}]"
                        : $"[Assigned via Welly AI by {user.FullName}]",
                    DueDate = dueDate.Date,
                    CreatedByUserId = user.UserId,
                    AssignedToUserId = assignee.UserId,
                    Priority = priority,
                    Category = category,
                    Status = assignee.UserId == user.UserId ? "Accepted" : "Pending",
                    CreatedAt = DateTime.UtcNow
                };

                context.TodoTasks.Add(task);
                await context.SaveChangesAsync();

                // Create notification if assigned to someone else
                if (assignee.UserId != user.UserId)
                {
                    var notification = new TodoNotification
                    {
                        TodoTaskId = task.Id,
                        UserId = assignee.UserId,
                        NotificationType = "TaskAssigned",
                        Message = $"{user.FullName} assigned you a task: {task.Title}",
                        CreatedAt = DateTime.UtcNow
                    };

                    context.TodoNotifications.Add(notification);
                    await context.SaveChangesAsync();

                    // Send real-time notification via SignalR
                    try
                    {
                        var hubContext = scope.ServiceProvider.GetService<IHubContext<ChatHub>>();
                        if (hubContext != null)
                        {
                            await hubContext.Clients.Group($"user_{assignee.UserId}")
                                .SendAsync("TodoNotification", new
                                {
                                    notification.Id,
                                    notification.TodoTaskId,
                                    TaskTitle = task.Title,
                                    notification.NotificationType,
                                    notification.Message,
                                    AssignedByUserName = user.FullName,
                                    notification.CreatedAt
                                });
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to send SignalR todo notification for task {TaskId}", task.Id);
                    }
                }

                var assigneeName = $"{assignee.Name} {assignee.Surname}".Trim();
                var selfAssigned = assignee.UserId == user.UserId;

                _logger.LogInformation("AI Action: Created todo #{TaskId} '{Title}' assigned to {Assignee} by {Creator}",
                    task.Id, task.Title, assigneeName, user.FullName);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "ASSIGN_TODO",
                    Message = selfAssigned
                        ? $"✅ Todo **\"{task.Title}\"** created for yourself, due {dueDate:dddd, d MMMM yyyy} (Priority: {priority})"
                        : $"✅ Todo **\"{task.Title}\"** assigned to **{assigneeName}**, due {dueDate:dddd, d MMMM yyyy} (Priority: {priority}). They'll receive a notification.",
                    EntityId = task.Id
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to assign todo via AI");
                return new AIActionResult { Success = false, ActionType = "ASSIGN_TODO", Message = $"Failed to create todo: {ex.Message}" };
            }
        }

        #endregion

        #region TripSheet Workflow Actions

        private async Task<AIActionResult> TripSheetGetWarehousesAsync()
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var workflow = scope.ServiceProvider.GetRequiredService<ITripSheetWorkflowService>();
                var data = await workflow.GetWarehousesAsync();

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "TRIPSHEET_GET_WAREHOUSES",
                    Message = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get warehouses for TripSheet workflow");
                return new AIActionResult { Success = false, ActionType = "TRIPSHEET_GET_WAREHOUSES", Message = $"Failed to load warehouses: {ex.Message}" };
            }
        }

        private async Task<AIActionResult> TripSheetGetInvoicesAsync(string json)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<JsonElement>(json);
                int? warehouseId = payload.TryGetProperty("warehouseId", out var wh) && wh.ValueKind == JsonValueKind.Number ? wh.GetInt32() : null;
                string? customerFilter = payload.TryGetProperty("customerFilter", out var cf) ? cf.GetString() : null;
                int limit = payload.TryGetProperty("limit", out var lm) && lm.ValueKind == JsonValueKind.Number ? lm.GetInt32() : 50;

                using var scope = _scopeFactory.CreateScope();
                var workflow = scope.ServiceProvider.GetRequiredService<ITripSheetWorkflowService>();
                var data = await workflow.GetPendingInvoicesAsync(warehouseId, customerFilter, limit);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "TRIPSHEET_GET_INVOICES",
                    Message = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get pending invoices for TripSheet workflow");
                return new AIActionResult { Success = false, ActionType = "TRIPSHEET_GET_INVOICES", Message = $"Failed to load invoices: {ex.Message}" };
            }
        }

        private async Task<AIActionResult> TripSheetGetDriversAsync()
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var workflow = scope.ServiceProvider.GetRequiredService<ITripSheetWorkflowService>();
                var data = await workflow.GetAvailableDriversAsync();

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "TRIPSHEET_GET_DRIVERS",
                    Message = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get drivers for TripSheet workflow");
                return new AIActionResult { Success = false, ActionType = "TRIPSHEET_GET_DRIVERS", Message = $"Failed to load drivers: {ex.Message}" };
            }
        }

        private async Task<AIActionResult> TripSheetGetVehiclesAsync()
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var workflow = scope.ServiceProvider.GetRequiredService<ITripSheetWorkflowService>();
                var data = await workflow.GetAvailableVehiclesAsync();

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "TRIPSHEET_GET_VEHICLES",
                    Message = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get vehicles for TripSheet workflow");
                return new AIActionResult { Success = false, ActionType = "TRIPSHEET_GET_VEHICLES", Message = $"Failed to load vehicles: {ex.Message}" };
            }
        }

        private async Task<AIActionResult> TripSheetPreviewAsync(string json)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<JsonElement>(json);
                var invoiceIds = new List<int>();
                if (payload.TryGetProperty("invoiceIds", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var id in idsEl.EnumerateArray())
                    {
                        if (id.ValueKind == JsonValueKind.Number)
                            invoiceIds.Add(id.GetInt32());
                    }
                }

                if (!invoiceIds.Any())
                    return new AIActionResult { Success = false, ActionType = "TRIPSHEET_PREVIEW", Message = "No invoice IDs provided for preview." };

                using var scope = _scopeFactory.CreateScope();
                var workflow = scope.ServiceProvider.GetRequiredService<ITripSheetWorkflowService>();
                var data = await workflow.GetInvoiceSummaryAsync(invoiceIds);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "TRIPSHEET_PREVIEW",
                    Message = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate TripSheet preview");
                return new AIActionResult { Success = false, ActionType = "TRIPSHEET_PREVIEW", Message = $"Failed to generate preview: {ex.Message}" };
            }
        }

        private async Task<AIActionResult> TripSheetCreateAsync(string json, ChatUserContext user)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<JsonElement>(json);

                var invoiceIds = new List<int>();
                if (payload.TryGetProperty("invoiceIds", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var id in idsEl.EnumerateArray())
                    {
                        if (id.ValueKind == JsonValueKind.Number)
                            invoiceIds.Add(id.GetInt32());
                    }
                }

                if (!invoiceIds.Any())
                    return new AIActionResult { Success = false, ActionType = "TRIPSHEET_CREATE", Message = "No invoice IDs provided. Cannot create TripSheet without invoices." };

                int? warehouseId = payload.TryGetProperty("warehouseId", out var wh) && wh.ValueKind == JsonValueKind.Number ? wh.GetInt32() : null;
                int? driverId = payload.TryGetProperty("driverId", out var dr) && dr.ValueKind == JsonValueKind.Number ? dr.GetInt32() : null;
                int? vehicleId = payload.TryGetProperty("vehicleId", out var vh) && vh.ValueKind == JsonValueKind.Number ? vh.GetInt32() : null;
                DateTime? scheduledDate = payload.TryGetProperty("scheduledDate", out var sd) && sd.ValueKind == JsonValueKind.String
                    ? DateTime.TryParse(sd.GetString(), out var dt) ? dt : null : null;
                string? notes = payload.TryGetProperty("notes", out var n) ? n.GetString() : null;

                using var scope = _scopeFactory.CreateScope();
                var workflow = scope.ServiceProvider.GetRequiredService<ITripSheetWorkflowService>();
                var result = await workflow.CreateTripSheetAsync(invoiceIds, warehouseId, driverId, vehicleId, scheduledDate, notes, user);

                return new AIActionResult
                {
                    Success = result.Success,
                    ActionType = "TRIPSHEET_CREATE",
                    Message = result.Message,
                    EntityId = result.TripSheetId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create TripSheet via AI workflow");
                return new AIActionResult { Success = false, ActionType = "TRIPSHEET_CREATE", Message = $"Failed to create TripSheet: {ex.Message}" };
            }
        }

        #endregion

        #region Vehicle Tracking Actions

        private async Task<AIActionResult> TrackVehicleAsync(string json)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<JsonElement>(json);
                var registration = payload.TryGetProperty("registration", out var r) ? r.GetString() ?? "" : "";

                if (string.IsNullOrWhiteSpace(registration))
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "TRACK_VEHICLE",
                        Message = "Vehicle registration number is required. Please provide the registration plate (e.g. ABC 123 GP)."
                    };
                }

                using var scope = _scopeFactory.CreateScope();
                var cartrackService = scope.ServiceProvider.GetRequiredService<ICarTrackService>();

                // Get all vehicle locations from CarTrack
                var allVehicles = await cartrackService.GetAllVehicleLocationsAsync();

                if (!allVehicles.Any())
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "TRACK_VEHICLE",
                        Message = "Unable to reach the CarTrack tracking system at this time. Please try again in a moment."
                    };
                }

                // Normalize search: remove spaces, dashes, dots for flexible matching
                var searchNorm = registration.Replace(" ", "").Replace("-", "").Replace(".", "").ToUpperInvariant();

                // Try exact match on registration first, then fuzzy
                var vehicle = allVehicles.FirstOrDefault(v =>
                    v.RegistrationNumber != null &&
                    v.RegistrationNumber.Replace(" ", "").Replace("-", "").Replace(".", "").ToUpperInvariant() == searchNorm);

                // If no exact match, try contains match
                if (vehicle == null)
                {
                    vehicle = allVehicles.FirstOrDefault(v =>
                        v.RegistrationNumber != null &&
                        v.RegistrationNumber.Replace(" ", "").Replace("-", "").Replace(".", "").ToUpperInvariant().Contains(searchNorm));
                }

                // Also try matching on vehicle name
                if (vehicle == null)
                {
                    vehicle = allVehicles.FirstOrDefault(v =>
                        v.VehicleName != null &&
                        v.VehicleName.Replace(" ", "").Replace("-", "").Replace(".", "").ToUpperInvariant().Contains(searchNorm));
                }

                if (vehicle == null)
                {
                    // Provide helpful list of available registrations
                    var availableRegs = allVehicles
                        .Where(v => !string.IsNullOrEmpty(v.RegistrationNumber))
                        .Select(v => v.RegistrationNumber)
                        .Take(15)
                        .ToList();

                    var regList = availableRegs.Any()
                        ? $" Available vehicles: {string.Join(", ", availableRegs)}"
                        : "";

                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "TRACK_VEHICLE",
                        Message = $"Vehicle with registration \"{registration}\" was not found in the CarTrack system.{regList}"
                    };
                }

                // Build a rich response
                var statusEmoji = vehicle.Status?.ToLower() switch
                {
                    "moving" => "🟢",
                    "idling" => "🟡",
                    "stopped" => "🔴",
                    "offline" => "⚫",
                    _ => "⚪"
                };

                var statusLabel = vehicle.Status?.ToLower() switch
                {
                    "moving" => "Moving",
                    "idling" => "Idling (engine on, stationary)",
                    "stopped" => "Stationary (engine off)",
                    "offline" => "Offline (no signal)",
                    _ => vehicle.Status ?? "Unknown"
                };

                var lines = new List<string>
                {
                    $"**🚛 Vehicle: {vehicle.RegistrationNumber ?? vehicle.VehicleName}**",
                    $"",
                    $"| Detail | Info |",
                    $"|--------|------|",
                    $"| **Status** | {statusEmoji} {statusLabel} |"
                };

                if (vehicle.Location != null)
                {
                    lines.Add($"| **Location** | {vehicle.Location.Address} |");
                    lines.Add($"| **Coordinates** | {vehicle.Location.Latitude:F6}, {vehicle.Location.Longitude:F6} |");
                }

                lines.Add($"| **Speed** | {vehicle.Speed:F0} km/h |");

                if (!string.IsNullOrEmpty(vehicle.CurrentDriverName))
                {
                    lines.Add($"| **Driver** | {vehicle.CurrentDriverName} |");
                }

                if (vehicle.LastUpdate.HasValue)
                {
                    var ago = DateTime.UtcNow - vehicle.LastUpdate.Value;
                    var agoText = ago.TotalMinutes < 1 ? "just now" :
                                  ago.TotalMinutes < 60 ? $"{ago.TotalMinutes:F0} min ago" :
                                  ago.TotalHours < 24 ? $"{ago.TotalHours:F0} hours ago" :
                                  $"{ago.TotalDays:F0} days ago";
                    lines.Add($"| **Last Update** | {vehicle.LastUpdate.Value:yyyy-MM-dd HH:mm} ({agoText}) |");
                }

                // Also persist the location update to our local DB
                try
                {
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var regNorm = vehicle.RegistrationNumber?.Replace(" ", "").Replace("-", "").ToUpperInvariant();
                    var dbVehicle = await context.Vehicles
                        .FirstOrDefaultAsync(v => v.RegistrationNumber.Replace(" ", "").Replace("-", "").ToUpper() == regNorm);
                    if (dbVehicle != null && vehicle.Location != null)
                    {
                        dbVehicle.LastKnownLatitude = (decimal)vehicle.Location.Latitude;
                        dbVehicle.LastKnownLongitude = (decimal)vehicle.Location.Longitude;
                        dbVehicle.LastKnownAddress = vehicle.Location.Address;
                        dbVehicle.LastLocationUpdate = vehicle.LastUpdate ?? DateTime.UtcNow;
                        dbVehicle.LastKnownStatus = vehicle.Status;
                        await context.SaveChangesAsync();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to persist vehicle location update for {Reg}", vehicle.RegistrationNumber);
                }

                _logger.LogInformation("AI Action: Tracked vehicle {Reg} — Status: {Status}, Location: {Address}",
                    vehicle.RegistrationNumber, vehicle.Status, vehicle.Location?.Address);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "TRACK_VEHICLE",
                    Message = string.Join("\n", lines)
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to track vehicle via AI");
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "TRACK_VEHICLE",
                    Message = $"Failed to track vehicle: {ex.Message}"
                };
            }
        }

        private async Task<AIActionResult> FleetStatusAsync()
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var cartrackService = scope.ServiceProvider.GetRequiredService<ICarTrackService>();

                var status = await cartrackService.GetFleetStatusAsync();

                if (status.TotalVehicles == 0)
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "FLEET_STATUS",
                        Message = "Unable to reach the CarTrack tracking system or no vehicles are registered. Please try again in a moment."
                    };
                }

                var lines = new List<string>
                {
                    $"**📊 Fleet Status Overview** (as of {DateTime.Now:HH:mm})",
                    $"",
                    $"| Status | Count |",
                    $"|--------|-------|",
                    $"| 🟢 Moving | {status.VehiclesMoving} |",
                    $"| 🟡 Idling | {status.VehiclesIdling} |",
                    $"| 🔴 Stopped | {status.VehiclesStopped} |",
                    $"| ⚫ Offline | {status.VehiclesOffline} |",
                    $"| **Total** | **{status.TotalVehicles}** |"
                };

                // Add a summary of moving vehicles if any
                if (status.Vehicles != null && status.Vehicles.Any())
                {
                    var moving = status.Vehicles.Where(v => v.Status == "moving").ToList();
                    if (moving.Any())
                    {
                        lines.Add($"");
                        lines.Add($"**🟢 Moving Vehicles:**");
                        foreach (var v in moving.Take(10))
                        {
                            var driver = !string.IsNullOrEmpty(v.CurrentDriverName) ? $" ({v.CurrentDriverName})" : "";
                            var address = v.Location?.Address ?? "Unknown";
                            lines.Add($"- **{v.RegistrationNumber}**{driver} — {v.Speed:F0} km/h near {address}");
                        }
                        if (moving.Count > 10)
                            lines.Add($"- ...and {moving.Count - 10} more");
                    }

                    var stopped = status.Vehicles.Where(v => v.Status == "stopped").ToList();
                    if (stopped.Any())
                    {
                        lines.Add($"");
                        lines.Add($"**🔴 Stationary Vehicles:**");
                        foreach (var v in stopped.Take(10))
                        {
                            var driver = !string.IsNullOrEmpty(v.CurrentDriverName) ? $" ({v.CurrentDriverName})" : "";
                            var address = v.Location?.Address ?? "Unknown";
                            lines.Add($"- **{v.RegistrationNumber}**{driver} — at {address}");
                        }
                        if (stopped.Count > 10)
                            lines.Add($"- ...and {stopped.Count - 10} more");
                    }
                }

                _logger.LogInformation("AI Action: Fleet status — {Total} vehicles, {Moving} moving, {Stopped} stopped",
                    status.TotalVehicles, status.VehiclesMoving, status.VehiclesStopped);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "FLEET_STATUS",
                    Message = string.Join("\n", lines)
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get fleet status via AI");
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "FLEET_STATUS",
                    Message = $"Failed to get fleet status: {ex.Message}"
                };
            }
        }

        #endregion
    }
}
