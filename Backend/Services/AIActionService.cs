using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services.Google;

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
    ///   [ACTION:UPDATE_CUSTOMER] { "customer": "ABC001", "name": "...", "contactPerson": "...", "email": "...", "phone": "...", "address": "...", "city": "...", "province": "...", "postalCode": "..." } [/ACTION]
    ///   [ACTION:LOOKUP_ADDRESS] { "address": "123 Main St, Johannesburg" } [/ACTION]
    ///   [ACTION:EDIT_EMPLOYEE] { "employee": "John Smith", "name": "...", "surname": "...", "email": "...", "role": "...", "title": "...", "department": "..." } [/ACTION]
    ///   [ACTION:RESET_PASSWORD] { "employee": "John Smith", "newPassword": "TempPass123!" } [/ACTION]
    ///   [ACTION:SYSTEM_OVERVIEW] {} [/ACTION]
    ///   [ACTION:CREATE_ANNOUNCEMENT] { "title": "...", "content": "...", "priority": "Normal", "category": "General" } [/ACTION]
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
                        "UPDATE_CUSTOMER" => await UpdateCustomerAsync(jsonPayload, user),
                        "LOOKUP_ADDRESS" => await LookupAddressAsync(jsonPayload),
                        "EDIT_EMPLOYEE" => await EditEmployeeAsync(jsonPayload, user),
                        "RESET_PASSWORD" => await ResetPasswordAsync(jsonPayload, user),
                        "SYSTEM_OVERVIEW" => await SystemOverviewAsync(),
                        "CREATE_ANNOUNCEMENT" => await CreateAnnouncementAsync(jsonPayload, user),
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

        #region Customer Management Actions

        private async Task<AIActionResult> UpdateCustomerAsync(string json, ChatUserContext user)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var customerSearch = root.TryGetProperty("customer", out var cs) ? cs.GetString() ?? "" : "";

                if (string.IsNullOrWhiteSpace(customerSearch))
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "UPDATE_CUSTOMER",
                        Message = "Customer name or code is required. Please specify which customer to update."
                    };
                }

                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Search by code first, then by name (fuzzy)
                var customer = await context.LogisticsCustomers
                    .FirstOrDefaultAsync(c => c.CustomerCode == customerSearch);

                if (customer == null)
                {
                    // Try exact name match
                    customer = await context.LogisticsCustomers
                        .FirstOrDefaultAsync(c => c.Name.ToLower() == customerSearch.ToLower());
                }

                if (customer == null)
                {
                    // Fuzzy name search — contains match
                    var searchLower = customerSearch.ToLower();
                    customer = await context.LogisticsCustomers
                        .Where(c => c.Name.ToLower().Contains(searchLower) ||
                                    (c.ShortName != null && c.ShortName.ToLower().Contains(searchLower)))
                        .FirstOrDefaultAsync();
                }

                if (customer == null)
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "UPDATE_CUSTOMER",
                        Message = $"Could not find a customer matching \"{customerSearch}\". Please check the name or customer code and try again."
                    };
                }

                // Track what was changed
                var changes = new List<string>();

                // Update fields only if provided
                if (root.TryGetProperty("name", out var nameEl) && !string.IsNullOrWhiteSpace(nameEl.GetString()))
                {
                    var oldVal = customer.Name;
                    customer.Name = nameEl.GetString()!;
                    changes.Add($"Name: {oldVal} → {customer.Name}");
                }

                if (root.TryGetProperty("shortName", out var shortNameEl) && !string.IsNullOrWhiteSpace(shortNameEl.GetString()))
                {
                    customer.ShortName = shortNameEl.GetString()!;
                    changes.Add($"Short Name → {customer.ShortName}");
                }

                if (root.TryGetProperty("contactPerson", out var contactEl) && !string.IsNullOrWhiteSpace(contactEl.GetString()))
                {
                    customer.ContactPerson = contactEl.GetString()!;
                    changes.Add($"Contact Person → {customer.ContactPerson}");
                }

                if (root.TryGetProperty("email", out var emailEl) && !string.IsNullOrWhiteSpace(emailEl.GetString()))
                {
                    customer.Email = emailEl.GetString()!;
                    changes.Add($"Email → {customer.Email}");
                }

                if (root.TryGetProperty("phone", out var phoneEl) && !string.IsNullOrWhiteSpace(phoneEl.GetString()))
                {
                    customer.PhoneNumber = phoneEl.GetString()!;
                    changes.Add($"Phone → {customer.PhoneNumber}");
                }

                if (root.TryGetProperty("mobile", out var mobileEl) && !string.IsNullOrWhiteSpace(mobileEl.GetString()))
                {
                    customer.MobileNumber = mobileEl.GetString()!;
                    changes.Add($"Mobile → {customer.MobileNumber}");
                }

                if (root.TryGetProperty("fax", out var faxEl) && !string.IsNullOrWhiteSpace(faxEl.GetString()))
                {
                    customer.Fax = faxEl.GetString()!;
                    changes.Add($"Fax → {customer.Fax}");
                }

                if (root.TryGetProperty("vatNumber", out var vatEl) && !string.IsNullOrWhiteSpace(vatEl.GetString()))
                {
                    customer.VatNumber = vatEl.GetString()!;
                    changes.Add($"VAT Number → {customer.VatNumber}");
                }

                // Address fields
                bool addressChanged = false;
                string? newAddress = null;

                if (root.TryGetProperty("address", out var addrEl) && !string.IsNullOrWhiteSpace(addrEl.GetString()))
                {
                    newAddress = addrEl.GetString()!;
                    customer.PhysicalAddress = newAddress;
                    customer.Address = newAddress;
                    addressChanged = true;
                    changes.Add($"Address → {newAddress}");
                }

                if (root.TryGetProperty("city", out var cityEl) && !string.IsNullOrWhiteSpace(cityEl.GetString()))
                {
                    customer.City = cityEl.GetString()!;
                    addressChanged = true;
                    changes.Add($"City → {customer.City}");
                }

                if (root.TryGetProperty("province", out var provEl) && !string.IsNullOrWhiteSpace(provEl.GetString()))
                {
                    customer.Province = provEl.GetString()!;
                    changes.Add($"Province → {customer.Province}");
                }

                if (root.TryGetProperty("postalCode", out var pcEl) && !string.IsNullOrWhiteSpace(pcEl.GetString()))
                {
                    customer.PostalCode = pcEl.GetString()!;
                    changes.Add($"Postal Code → {customer.PostalCode}");
                }

                if (root.TryGetProperty("country", out var countryEl) && !string.IsNullOrWhiteSpace(countryEl.GetString()))
                {
                    customer.Country = countryEl.GetString()!;
                    changes.Add($"Country → {customer.Country}");
                }

                // Delivery address fields
                if (root.TryGetProperty("deliveryAddress", out var delAddrEl) && !string.IsNullOrWhiteSpace(delAddrEl.GetString()))
                {
                    customer.DeliveryAddress = delAddrEl.GetString()!;
                    changes.Add($"Delivery Address → {customer.DeliveryAddress}");
                }

                if (root.TryGetProperty("deliveryCity", out var delCityEl) && !string.IsNullOrWhiteSpace(delCityEl.GetString()))
                {
                    customer.DeliveryCity = delCityEl.GetString()!;
                    changes.Add($"Delivery City → {customer.DeliveryCity}");
                }

                if (root.TryGetProperty("deliveryProvince", out var delProvEl) && !string.IsNullOrWhiteSpace(delProvEl.GetString()))
                {
                    customer.DeliveryProvince = delProvEl.GetString()!;
                    changes.Add($"Delivery Province → {customer.DeliveryProvince}");
                }

                if (root.TryGetProperty("deliveryPostalCode", out var delPcEl) && !string.IsNullOrWhiteSpace(delPcEl.GetString()))
                {
                    customer.DeliveryPostalCode = delPcEl.GetString()!;
                    changes.Add($"Delivery Postal Code → {customer.DeliveryPostalCode}");
                }

                // Payment / credit
                if (root.TryGetProperty("paymentTerms", out var ptEl) && !string.IsNullOrWhiteSpace(ptEl.GetString()))
                {
                    customer.PaymentTerms = ptEl.GetString()!;
                    changes.Add($"Payment Terms → {customer.PaymentTerms}");
                }

                if (root.TryGetProperty("creditLimit", out var clEl))
                {
                    if (clEl.TryGetDecimal(out var creditLimit))
                    {
                        customer.CreditLimit = creditLimit;
                        changes.Add($"Credit Limit → R{creditLimit:N2}");
                    }
                }

                if (changes.Count == 0)
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "UPDATE_CUSTOMER",
                        Message = $"No changes specified for **{customer.Name}** ({customer.CustomerCode}). Please tell me what you'd like to update."
                    };
                }

                // Auto-geocode if address was changed
                if (addressChanged)
                {
                    try
                    {
                        var geocodingService = scope.ServiceProvider.GetRequiredService<GeocodingService>();
                        var fullAddress = $"{customer.PhysicalAddress ?? customer.Address}, {customer.City}, {customer.Province}, {customer.PostalCode}".Trim(' ', ',');
                        var geoResult = await geocodingService.GeocodeAddressAsync(fullAddress);

                        if (geoResult.Success)
                        {
                            customer.Latitude = geoResult.Latitude;
                            customer.Longitude = geoResult.Longitude;
                            customer.GooglePlaceId = geoResult.PlaceId;
                            customer.AddressVerified = true;
                            customer.AddressVerifiedAt = DateTime.UtcNow;

                            // Fill in missing city/province from geocoding
                            if (string.IsNullOrEmpty(customer.City) && !string.IsNullOrEmpty(geoResult.City))
                                customer.City = geoResult.City;
                            if (string.IsNullOrEmpty(customer.Province) && !string.IsNullOrEmpty(geoResult.Province))
                                customer.Province = geoResult.Province;
                            if (string.IsNullOrEmpty(customer.PostalCode) && !string.IsNullOrEmpty(geoResult.PostalCode))
                                customer.PostalCode = geoResult.PostalCode;

                            changes.Add($"📍 GPS → {geoResult.Latitude:F6}, {geoResult.Longitude:F6} (verified via Google)");
                        }
                        else
                        {
                            customer.AddressVerified = false;
                            changes.Add($"⚠️ Address could not be verified: {geoResult.Error}");
                        }
                    }
                    catch (Exception geoEx)
                    {
                        _logger.LogWarning(geoEx, "Geocoding failed for customer {Id} address update", customer.Id);
                        changes.Add("⚠️ Address geocoding failed — GPS coordinates not updated");
                    }
                }

                customer.UpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();

                var changeList = string.Join("\n", changes.Select(c => $"- {c}"));
                _logger.LogInformation("AI Action: Updated customer {Code} ({Name}) by {User} — {Count} changes",
                    customer.CustomerCode, customer.Name, user.FullName, changes.Count);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "UPDATE_CUSTOMER",
                    EntityId = customer.Id,
                    Message = $"✅ Updated **{customer.Name}** ({customer.CustomerCode}):\n{changeList}"
                };
            }
            catch (JsonException)
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "UPDATE_CUSTOMER",
                    Message = "Invalid data format. Please try again with the correct customer details."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update customer via AI");
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "UPDATE_CUSTOMER",
                    Message = $"Failed to update customer: {ex.Message}"
                };
            }
        }

        private async Task<AIActionResult> LookupAddressAsync(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var address = root.TryGetProperty("address", out var addrEl) ? addrEl.GetString() ?? "" : "";

                if (string.IsNullOrWhiteSpace(address))
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "LOOKUP_ADDRESS",
                        Message = "Please provide an address to look up."
                    };
                }

                using var scope = _scopeFactory.CreateScope();
                var geocodingService = scope.ServiceProvider.GetRequiredService<GeocodingService>();
                var result = await geocodingService.GeocodeAddressAsync(address);

                if (!result.Success)
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "LOOKUP_ADDRESS",
                        Message = $"Could not find that address: {result.Error}"
                    };
                }

                var lines = new List<string>
                {
                    $"**📍 Address Lookup Result**",
                    $"",
                    $"| Field | Value |",
                    $"|-------|-------|",
                    $"| Formatted Address | {result.FormattedAddress} |",
                    $"| Street | {result.StreetNumber} {result.Route} |",
                    $"| Suburb | {result.Suburb ?? "—"} |",
                    $"| City | {result.City ?? "—"} |",
                    $"| Province | {result.Province ?? "—"} |",
                    $"| Postal Code | {result.PostalCode ?? "—"} |",
                    $"| Country | {result.Country ?? "—"} |",
                    $"| GPS | {result.Latitude:F6}, {result.Longitude:F6} |",
                    $"| Google Place ID | {result.PlaceId} |"
                };

                _logger.LogInformation("AI Action: Address lookup for '{Address}' → {FormattedAddress}",
                    address, result.FormattedAddress);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "LOOKUP_ADDRESS",
                    Message = string.Join("\n", lines)
                };
            }
            catch (JsonException)
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "LOOKUP_ADDRESS",
                    Message = "Invalid data format for address lookup."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to lookup address via AI");
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "LOOKUP_ADDRESS",
                    Message = $"Failed to look up address: {ex.Message}"
                };
            }
        }

        #endregion

        #region Admin / Employee Management Actions

        private async Task<AIActionResult> EditEmployeeAsync(string json, ChatUserContext user)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var employeeSearch = root.TryGetProperty("employee", out var es) ? es.GetString() ?? "" : "";

                if (string.IsNullOrWhiteSpace(employeeSearch))
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "EDIT_EMPLOYEE",
                        Message = "Please specify the employee's name or email to edit."
                    };
                }

                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Search by email first, then by name (fuzzy)
                var searchLower = employeeSearch.ToLower().Trim();
                var userEntity = await context.Users
                    .Include(u => u.Department)
                    .FirstOrDefaultAsync(u => u.Email.ToLower() == searchLower);

                if (userEntity == null)
                {
                    // Exact full name match
                    userEntity = await context.Users
                        .Include(u => u.Department)
                        .FirstOrDefaultAsync(u => (u.Name + " " + u.Surname).ToLower() == searchLower);
                }

                if (userEntity == null)
                {
                    // Fuzzy — contains on name or surname
                    userEntity = await context.Users
                        .Include(u => u.Department)
                        .Where(u => u.Name.ToLower().Contains(searchLower) ||
                                    u.Surname.ToLower().Contains(searchLower) ||
                                    (u.Name + " " + u.Surname).ToLower().Contains(searchLower))
                        .FirstOrDefaultAsync();
                }

                if (userEntity == null)
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "EDIT_EMPLOYEE",
                        Message = $"Could not find an employee matching \"{employeeSearch}\". Please check the name or email."
                    };
                }

                var changes = new List<string>();

                if (root.TryGetProperty("name", out var nameEl) && !string.IsNullOrWhiteSpace(nameEl.GetString()))
                {
                    var oldVal = userEntity.Name;
                    userEntity.Name = nameEl.GetString()!;
                    changes.Add($"First Name: {oldVal} → {userEntity.Name}");
                }

                if (root.TryGetProperty("surname", out var surnameEl) && !string.IsNullOrWhiteSpace(surnameEl.GetString()))
                {
                    var oldVal = userEntity.Surname;
                    userEntity.Surname = surnameEl.GetString()!;
                    changes.Add($"Surname: {oldVal} → {userEntity.Surname}");
                }

                if (root.TryGetProperty("email", out var emailEl) && !string.IsNullOrWhiteSpace(emailEl.GetString()))
                {
                    var newEmail = emailEl.GetString()!;
                    // Check for duplicates
                    if (await context.Users.AnyAsync(u => u.Email.ToLower() == newEmail.ToLower() && u.UserId != userEntity.UserId))
                    {
                        return new AIActionResult
                        {
                            Success = false,
                            ActionType = "EDIT_EMPLOYEE",
                            Message = $"The email \"{newEmail}\" is already in use by another user."
                        };
                    }
                    var oldVal = userEntity.Email;
                    userEntity.Email = newEmail;
                    changes.Add($"Email: {oldVal} → {newEmail}");
                }

                if (root.TryGetProperty("role", out var roleEl) && !string.IsNullOrWhiteSpace(roleEl.GetString()))
                {
                    var newRole = roleEl.GetString()!;
                    // Normalize common role values
                    var roleMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                    {
                        { "admin", "Admin" }, { "administrator", "Admin" },
                        { "manager", "Manager" }, { "mgr", "Manager" },
                        { "employee", "Employee" }, { "staff", "Employee" }, { "user", "Employee" }
                    };
                    if (roleMap.TryGetValue(newRole, out var mapped)) newRole = mapped;

                    var oldVal = userEntity.Role;
                    userEntity.Role = newRole;
                    changes.Add($"Role: {oldVal} → {newRole}");
                }

                if (root.TryGetProperty("title", out var titleEl) && !string.IsNullOrWhiteSpace(titleEl.GetString()))
                {
                    var oldVal = userEntity.Title ?? "—";
                    userEntity.Title = titleEl.GetString()!;
                    changes.Add($"Job Title: {oldVal} → {userEntity.Title}");
                }

                if (root.TryGetProperty("department", out var deptEl) && !string.IsNullOrWhiteSpace(deptEl.GetString()))
                {
                    var deptName = deptEl.GetString()!;
                    var department = await context.Departments
                        .FirstOrDefaultAsync(d => d.Name.ToLower() == deptName.ToLower());

                    if (department == null)
                    {
                        // Fuzzy search
                        department = await context.Departments
                            .FirstOrDefaultAsync(d => d.Name.ToLower().Contains(deptName.ToLower()));
                    }

                    if (department != null)
                    {
                        var oldDept = userEntity.Department?.Name ?? "None";
                        userEntity.DepartmentId = department.DepartmentId;
                        changes.Add($"Department: {oldDept} → {department.Name}");
                    }
                    else
                    {
                        changes.Add($"⚠️ Department \"{deptName}\" not found — skipped");
                    }
                }

                if (root.TryGetProperty("isActive", out var activeEl))
                {
                    bool? isActive = null;
                    if (activeEl.ValueKind == JsonValueKind.True) isActive = true;
                    else if (activeEl.ValueKind == JsonValueKind.False) isActive = false;
                    else if (activeEl.ValueKind == JsonValueKind.String)
                    {
                        var val = activeEl.GetString()?.ToLower();
                        if (val == "true" || val == "yes" || val == "active") isActive = true;
                        else if (val == "false" || val == "no" || val == "inactive") isActive = false;
                    }

                    if (isActive.HasValue)
                    {
                        var oldVal = userEntity.IsActive ? "Active" : "Inactive";
                        userEntity.IsActive = isActive.Value;
                        changes.Add($"Status: {oldVal} → {(isActive.Value ? "Active" : "Inactive")}");
                    }
                }

                if (root.TryGetProperty("birthday", out var bdayEl) && !string.IsNullOrWhiteSpace(bdayEl.GetString()))
                {
                    if (DateTime.TryParse(bdayEl.GetString(), out var birthday))
                    {
                        userEntity.Birthday = birthday;
                        changes.Add($"Birthday → {birthday:dd MMM yyyy}");
                    }
                }

                if (changes.Count == 0)
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "EDIT_EMPLOYEE",
                        Message = $"No changes specified for **{userEntity.FullName}** ({userEntity.Email}). Please tell me what you'd like to update."
                    };
                }

                userEntity.UpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();

                var changeList = string.Join("\n", changes.Select(c => $"- {c}"));
                _logger.LogInformation("AI Action: Edited employee {UserId} ({Name}) by {Admin} — {Count} changes",
                    userEntity.UserId, userEntity.FullName, user.FullName, changes.Count);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "EDIT_EMPLOYEE",
                    EntityId = userEntity.UserId,
                    Message = $"✅ Updated **{userEntity.FullName}** ({userEntity.Email}):\n{changeList}"
                };
            }
            catch (JsonException)
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "EDIT_EMPLOYEE",
                    Message = "Invalid data format. Please try again."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to edit employee via AI");
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "EDIT_EMPLOYEE",
                    Message = $"Failed to edit employee: {ex.Message}"
                };
            }
        }

        private async Task<AIActionResult> ResetPasswordAsync(string json, ChatUserContext user)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var employeeSearch = root.TryGetProperty("employee", out var es) ? es.GetString() ?? "" : "";
                var newPassword = root.TryGetProperty("newPassword", out var pw) ? pw.GetString() ?? "" : "";

                if (string.IsNullOrWhiteSpace(employeeSearch))
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "RESET_PASSWORD",
                        Message = "Please specify the employee's name or email."
                    };
                }

                // Generate a secure temp password if none provided
                if (string.IsNullOrWhiteSpace(newPassword))
                {
                    newPassword = GenerateTempPassword();
                }

                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var searchLower = employeeSearch.ToLower().Trim();
                var userEntity = await context.Users
                    .FirstOrDefaultAsync(u => u.Email.ToLower() == searchLower);

                if (userEntity == null)
                {
                    userEntity = await context.Users
                        .FirstOrDefaultAsync(u => (u.Name + " " + u.Surname).ToLower() == searchLower);
                }

                if (userEntity == null)
                {
                    userEntity = await context.Users
                        .Where(u => u.Name.ToLower().Contains(searchLower) ||
                                    u.Surname.ToLower().Contains(searchLower) ||
                                    (u.Name + " " + u.Surname).ToLower().Contains(searchLower))
                        .FirstOrDefaultAsync();
                }

                if (userEntity == null)
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "RESET_PASSWORD",
                        Message = $"Could not find an employee matching \"{employeeSearch}\"."
                    };
                }

                userEntity.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
                userEntity.UpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();

                _logger.LogInformation("AI Action: Password reset for user {UserId} ({Email}) by {Admin}",
                    userEntity.UserId, userEntity.Email, user.FullName);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "RESET_PASSWORD",
                    EntityId = userEntity.UserId,
                    Message = $"🔑 Password reset for **{userEntity.FullName}** ({userEntity.Email}).\n\nNew temporary password: `{newPassword}`\n\n⚠️ Please share this securely and ask them to change it on first login."
                };
            }
            catch (JsonException)
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "RESET_PASSWORD",
                    Message = "Invalid data format for password reset."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to reset password via AI");
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "RESET_PASSWORD",
                    Message = $"Failed to reset password: {ex.Message}"
                };
            }
        }

        private static string GenerateTempPassword()
        {
            const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const string lower = "abcdefghjkmnpqrstuvwxyz";
            const string digits = "23456789";
            const string special = "!@#$%";

            var rng = new Random();
            var chars = new char[12];
            chars[0] = upper[rng.Next(upper.Length)];
            chars[1] = lower[rng.Next(lower.Length)];
            chars[2] = digits[rng.Next(digits.Length)];
            chars[3] = special[rng.Next(special.Length)];

            var all = upper + lower + digits + special;
            for (int i = 4; i < 12; i++)
                chars[i] = all[rng.Next(all.Length)];

            // Shuffle
            for (int i = chars.Length - 1; i > 0; i--)
            {
                int j = rng.Next(i + 1);
                (chars[i], chars[j]) = (chars[j], chars[i]);
            }

            return new string(chars);
        }

        private async Task<AIActionResult> SystemOverviewAsync()
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Gather all counts in parallel
                var usersTotal = await context.Users.CountAsync();
                var usersActive = await context.Users.CountAsync(u => u.IsActive);
                var departments = await context.Departments.CountAsync();
                var customers = await context.LogisticsCustomers.CountAsync();

                var ticketsTotal = await context.SupportTickets.CountAsync();
                var ticketsOpen = await context.SupportTickets.CountAsync(t => t.Status == "Open");
                var ticketsInProgress = await context.SupportTickets.CountAsync(t => t.Status == "InProgress");
                var ticketsResolved = await context.SupportTickets.CountAsync(t => t.Status == "Resolved");

                var loadsTotal = await context.Loads.CountAsync();
                var loadsActive = await context.Loads.CountAsync(l => l.Status == "InTransit" || l.Status == "Assigned");
                var loadsPending = await context.Loads.CountAsync(l => l.Status == "Available");

                var meetings = await context.Meetings.CountAsync(m => m.MeetingDate >= DateTime.Today);
                var announcements = await context.Announcements.CountAsync(a => a.IsActive);

                var todosTotal = await context.TodoTasks.CountAsync();
                var todosPending = await context.TodoTasks.CountAsync(t => t.Status == "Pending" || t.Status == "InProgress");

                var vehicles = await context.Vehicles.CountAsync();
                var drivers = await context.Drivers.CountAsync();
                var warehouses = await context.Warehouses.CountAsync();

                var lines = new List<string>
                {
                    $"**📊 System Overview** (as of {DateTime.Now:dd MMM yyyy, HH:mm})",
                    $"",
                    $"### 👥 People",
                    $"| Metric | Count |",
                    $"|--------|-------|",
                    $"| Total Users | {usersTotal} |",
                    $"| Active Users | {usersActive} |",
                    $"| Inactive Users | {usersTotal - usersActive} |",
                    $"| Departments | {departments} |",
                    $"",
                    $"### 🏢 Customers",
                    $"| Metric | Count |",
                    $"|--------|-------|",
                    $"| Total Customers | {customers} |",
                    $"",
                    $"### 🎫 Support Tickets",
                    $"| Status | Count |",
                    $"|--------|-------|",
                    $"| Open | {ticketsOpen} |",
                    $"| In Progress | {ticketsInProgress} |",
                    $"| Resolved | {ticketsResolved} |",
                    $"| Total | {ticketsTotal} |",
                    $"",
                    $"### 🚛 Logistics",
                    $"| Metric | Count |",
                    $"|--------|-------|",
                    $"| Active Loads | {loadsActive} |",
                    $"| Pending Loads | {loadsPending} |",
                    $"| Total Loads | {loadsTotal} |",
                    $"| Vehicles | {vehicles} |",
                    $"| Drivers | {drivers} |",
                    $"| Warehouses | {warehouses} |",
                    $"",
                    $"### 📋 Tasks & Activities",
                    $"| Metric | Count |",
                    $"|--------|-------|",
                    $"| Pending Todos | {todosPending} |",
                    $"| Total Todos | {todosTotal} |",
                    $"| Upcoming Meetings | {meetings} |",
                    $"| Active Announcements | {announcements} |"
                };

                _logger.LogInformation("AI Action: System overview requested — {Users} users, {Customers} customers, {Tickets} tickets",
                    usersTotal, customers, ticketsTotal);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "SYSTEM_OVERVIEW",
                    Message = string.Join("\n", lines)
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate system overview");
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "SYSTEM_OVERVIEW",
                    Message = $"Failed to generate system overview: {ex.Message}"
                };
            }
        }

        #endregion

        #region Announcement Actions

        private async Task<AIActionResult> CreateAnnouncementAsync(string json, ChatUserContext user)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var title = root.TryGetProperty("title", out var titleEl) ? titleEl.GetString() ?? "" : "";
                var content = root.TryGetProperty("content", out var contentEl) ? contentEl.GetString() ?? "" : "";
                var priority = root.TryGetProperty("priority", out var prioEl) ? prioEl.GetString() ?? "Normal" : "Normal";
                var category = root.TryGetProperty("category", out var catEl) ? catEl.GetString() : null;

                if (string.IsNullOrWhiteSpace(title))
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "CREATE_ANNOUNCEMENT",
                        Message = "A title is required for the announcement."
                    };
                }

                if (string.IsNullOrWhiteSpace(content))
                {
                    return new AIActionResult
                    {
                        Success = false,
                        ActionType = "CREATE_ANNOUNCEMENT",
                        Message = "Content is required for the announcement."
                    };
                }

                // Normalize priority
                var validPriorities = new[] { "Low", "Normal", "High", "Urgent" };
                if (!validPriorities.Contains(priority, StringComparer.OrdinalIgnoreCase))
                    priority = "Normal";
                priority = validPriorities.First(p => p.Equals(priority, StringComparison.OrdinalIgnoreCase));

                // Parse optional expiry
                DateTime? expiresAt = null;
                if (root.TryGetProperty("expiresAt", out var expEl) && !string.IsNullOrWhiteSpace(expEl.GetString()))
                {
                    if (DateTime.TryParse(expEl.GetString(), out var parsed))
                        expiresAt = parsed;
                }
                if (root.TryGetProperty("expiresInDays", out var expDaysEl))
                {
                    if (expDaysEl.TryGetInt32(out var days) && days > 0)
                        expiresAt = DateTime.UtcNow.AddDays(days);
                }

                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var announcement = new Announcement
                {
                    Title = title,
                    Content = content,
                    Priority = priority,
                    Category = category,
                    CreatedByUserId = user.UserId,
                    ExpiresAt = expiresAt,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                context.Announcements.Add(announcement);
                await context.SaveChangesAsync();

                // Send real-time notification via SignalR
                try
                {
                    var hubContext = scope.ServiceProvider.GetService<IHubContext<ChatHub>>();
                    if (hubContext != null)
                    {
                        await hubContext.Clients.All.SendAsync("AnnouncementCreated", new
                        {
                            announcementId = announcement.AnnouncementId,
                            title = announcement.Title,
                            priority = announcement.Priority,
                            createdBy = user.FullName
                        });
                    }
                }
                catch (Exception hubEx)
                {
                    _logger.LogWarning(hubEx, "Failed to send announcement SignalR notification");
                }

                var priorityIcon = priority switch
                {
                    "Urgent" => "🔴",
                    "High" => "🟠",
                    "Normal" => "🟢",
                    "Low" => "⚪",
                    _ => "🟢"
                };

                var expiryText = expiresAt.HasValue ? $"\n- Expires: {expiresAt.Value:dd MMM yyyy}" : "";
                var categoryText = !string.IsNullOrEmpty(category) ? $"\n- Category: {category}" : "";

                _logger.LogInformation("AI Action: Announcement created '{Title}' by {User} (Priority: {Priority})",
                    title, user.FullName, priority);

                return new AIActionResult
                {
                    Success = true,
                    ActionType = "CREATE_ANNOUNCEMENT",
                    EntityId = announcement.AnnouncementId,
                    Message = $"{priorityIcon} Announcement published!\n\n**{title}**\n\n{content}\n\n- Priority: {priority}\n- Posted by: {user.FullName}{categoryText}{expiryText}"
                };
            }
            catch (JsonException)
            {
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "CREATE_ANNOUNCEMENT",
                    Message = "Invalid data format for announcement."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create announcement via AI");
                return new AIActionResult
                {
                    Success = false,
                    ActionType = "CREATE_ANNOUNCEMENT",
                    Message = $"Failed to create announcement: {ex.Message}"
                };
            }
        }

        #endregion
    }
}
