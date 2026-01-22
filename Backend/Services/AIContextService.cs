using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.CRM;
using System.Text;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services
{
    public interface IAIContextService
    {
        Task<string?> GetContextForQueryAsync(string query);
        List<string> DetectQueryDomains(string query);
    }

    public class AIContextService : IAIContextService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AIContextService> _logger;
        private readonly ILogisticsAIService _logisticsService;

        // Domain keyword mappings
        private static readonly Dictionary<string, string[]> DomainKeywords = new()
        {
            ["employees"] = new[] { "employee", "employees", "staff", "worker", "colleague", "team member", "who is", "who's", "person", "people", "user", "users", "works", "work in", "works in", "working in", "extension", "extensions", "ext", "phone", "contact", "who works", "list all" },
            ["attendance"] = new[] { "attendance", "clock in", "clock out", "clocked", "present", "absent", "late", "on time", "working hours", "time in", "time out", "checked in" },
            ["leave"] = new[] { "leave", "vacation", "holiday", "sick", "annual leave", "off", "day off", "days off", "time off", "pto", "away", "on leave" },
            ["projects"] = new[] { "project", "projects", "board", "boards", "task", "tasks", "card", "cards", "kanban", "sprint", "backlog", "todo", "to do", "to-do" },
            ["tickets"] = new[] { "ticket", "tickets", "support ticket", "issue", "issues", "problem", "problems", "help desk", "bug", "incident" },
            ["meetings"] = new[] { "meeting", "meetings", "appointment", "appointments", "schedule", "scheduled", "calendar", "boardroom", "call", "conference" },
            ["announcements"] = new[] { "announcement", "announcements", "news", "notice", "notices", "update", "updates", "bulletin", "memo" },
            ["departments"] = new[] { "department", "departments", "team", "teams", "division", "unit", "group" },
            ["crm"] = new[] { "lead", "leads", "customer", "customers", "client", "clients", "prospect", "prospects", "campaign", "sales", "crm", "contact", "contacts" },
            ["logistics"] = new[] { "load", "loads", "trip", "trips", "tripsheet", "delivery", "deliveries", "driver", "drivers", "vehicle", "truck", "transport", "shipment", "logistics", "dispatch", "route", "commodity", "warehouse", "ld-", "ts-", "in transit", "delivered", "scheduled", "pending" },
            ["invoices"] = new[] { "invoice", "invoices", "tfn", "transaction", "transactions", "sales amount", "cost of sales", "billing", "billed", "revenue", "imported invoice", "product sold", "quantity sold" }
        };

        public AIContextService(
            IServiceScopeFactory scopeFactory,
            ILogger<AIContextService> logger,
            ILogisticsAIService logisticsService)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _logisticsService = logisticsService;
        }

        public List<string> DetectQueryDomains(string query)
        {
            var lowerQuery = query.ToLower();
            var detectedDomains = new List<string>();

            foreach (var domain in DomainKeywords)
            {
                if (domain.Value.Any(keyword => lowerQuery.Contains(keyword)))
                {
                    detectedDomains.Add(domain.Key);
                }
            }

            return detectedDomains;
        }

        public async Task<string?> GetContextForQueryAsync(string query)
        {
            var domains = DetectQueryDomains(query);
            _logger.LogInformation("Detected domains for query '{Query}': {Domains}", query, string.Join(", ", domains));
            
            if (!domains.Any())
            {
                _logger.LogWarning("No domains detected for query: {Query}", query);
                return null;
            }

            var contextBuilder = new StringBuilder();
            contextBuilder.AppendLine("## Relevant Data from Database\n");

            foreach (var domain in domains)
            {
                try
                {
                    _logger.LogInformation("Getting context for domain: {Domain}", domain);
                    var domainContext = domain switch
                    {
                        "employees" => await GetEmployeeContextAsync(query),
                        "attendance" => await GetAttendanceContextAsync(query),
                        "leave" => await GetLeaveContextAsync(query),
                        "projects" => await GetProjectsContextAsync(query),
                        "tickets" => await GetTicketsContextAsync(query),
                        "meetings" => await GetMeetingsContextAsync(query),
                        "announcements" => await GetAnnouncementsContextAsync(query),
                        "departments" => await GetDepartmentsContextAsync(query),
                        "crm" => await GetCRMContextAsync(query),
                        "logistics" => await _logisticsService.GetLoadsContextAsync(query),
                        "invoices" => await GetInvoicesContextAsync(query),
                        _ => null
                    };

                    if (!string.IsNullOrEmpty(domainContext))
                    {
                        contextBuilder.AppendLine(domainContext);
                        contextBuilder.AppendLine();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error getting context for domain {Domain}", domain);
                }
            }

            var result = contextBuilder.ToString();
            return string.IsNullOrWhiteSpace(result) ? null : result;
        }

        private async Task<string?> GetEmployeeContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();
            
            // Check if asking about a specific person
            var nameMatch = Regex.Match(query, @"(?:who is|about|find|search|look up)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", RegexOptions.IgnoreCase);
            
            // Check if asking about a specific department
            var deptNames = await context.Departments.Select(d => d.Name).ToListAsync();
            var matchedDept = deptNames.FirstOrDefault(d => lowerQuery.Contains(d.ToLower()));
            
            IQueryable<User> usersQuery = context.Users
                .Include(u => u.Department)
                .Include(u => u.Extensions)
                .Where(u => u.IsActive);

            if (nameMatch.Success && string.IsNullOrEmpty(matchedDept))
            {
                var searchName = nameMatch.Groups[1].Value.Trim().ToLower();
                usersQuery = usersQuery.Where(u => 
                    u.Name.ToLower().Contains(searchName) || 
                    u.Surname.ToLower().Contains(searchName) ||
                    (u.Name + " " + u.Surname).ToLower().Contains(searchName));
            }
            else if (!string.IsNullOrEmpty(matchedDept))
            {
                // Filter by department
                usersQuery = usersQuery.Where(u => u.Department != null && u.Department.Name == matchedDept);
            }

            var users = await usersQuery.Take(50).ToListAsync();

            if (!users.Any())
            {
                // If no specific match, return employee count summary
                var totalCount = await context.Users.CountAsync(u => u.IsActive);
                var departmentCounts = await context.Users
                    .Where(u => u.IsActive && u.DepartmentId != null)
                    .GroupBy(u => u.Department!.Name)
                    .Select(g => new { Department = g.Key, Count = g.Count() })
                    .ToListAsync();

                var sb = new StringBuilder();
                sb.AppendLine($"### Employee Summary");
                sb.AppendLine($"- **Total Active Employees:** {totalCount}");
                if (departmentCounts.Any())
                {
                    sb.AppendLine($"- **By Department:**");
                    foreach (var dc in departmentCounts)
                    {
                        sb.AppendLine($"  - {dc.Department}: {dc.Count}");
                    }
                }
                return sb.ToString();
            }

            var builder = new StringBuilder();
            builder.AppendLine($"### Employee Information ({users.Count} found)");
            
            foreach (var user in users)
            {
                builder.AppendLine($"- **{user.Name} {user.Surname}**");
                builder.AppendLine($"  - Email: {user.Email}");
                builder.AppendLine($"  - Role: {user.Role}");
                if (!string.IsNullOrEmpty(user.Title))
                    builder.AppendLine($"  - Title: {user.Title}");
                if (user.Department != null)
                    builder.AppendLine($"  - Department: {user.Department.Name}");
                if (user.Extensions.Any())
                    builder.AppendLine($"  - Extensions: {string.Join(", ", user.Extensions.Select(e => e.ExtensionNumber))}");
            }

            return builder.ToString();
        }

        private async Task<string?> GetAttendanceContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();
            var today = DateTime.Today;
            DateTime startDate = today;
            DateTime endDate = today;

            // Date parsing
            if (lowerQuery.Contains("today"))
            {
                startDate = today;
                endDate = today;
            }
            else if (lowerQuery.Contains("yesterday"))
            {
                startDate = today.AddDays(-1);
                endDate = today.AddDays(-1);
            }
            else if (lowerQuery.Contains("this week"))
            {
                var diff = (7 + (today.DayOfWeek - DayOfWeek.Monday)) % 7;
                startDate = today.AddDays(-diff);
                endDate = today;
            }
            else if (lowerQuery.Contains("this month"))
            {
                startDate = new DateTime(today.Year, today.Month, 1);
                endDate = today;
            }

            var attendanceRecords = await context.Attendances
                .Include(a => a.Employee)
                .Where(a => a.Date >= startDate && a.Date <= endDate)
                .OrderByDescending(a => a.Date)
                .Take(20)
                .ToListAsync();

            var builder = new StringBuilder();
            var dateRange = startDate == endDate 
                ? startDate.ToString("dd MMM yyyy") 
                : $"{startDate:dd MMM} - {endDate:dd MMM yyyy}";
            
            builder.AppendLine($"### Attendance for {dateRange}");

            if (!attendanceRecords.Any())
            {
                builder.AppendLine("No attendance records found for this period.");
                return builder.ToString();
            }

            var summary = attendanceRecords.GroupBy(a => a.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToList();

            builder.AppendLine($"**Summary:**");
            foreach (var s in summary)
            {
                builder.AppendLine($"- {s.Status}: {s.Count}");
            }

            var lateCount = attendanceRecords.Count(a => a.IsLate);
            if (lateCount > 0)
            {
                builder.AppendLine($"- Late arrivals: {lateCount}");
            }

            // If asking about specific status
            if (lowerQuery.Contains("late"))
            {
                var lateRecords = attendanceRecords.Where(a => a.IsLate).Take(10);
                builder.AppendLine("\n**Late Arrivals:**");
                foreach (var record in lateRecords)
                {
                    builder.AppendLine($"- {record.Employee?.FullName ?? "Unknown"}: {record.LateMinutes} minutes late ({record.TimeIn:HH:mm})");
                }
            }

            if (lowerQuery.Contains("absent"))
            {
                var absentRecords = attendanceRecords.Where(a => a.Status == "Absent").Take(10);
                builder.AppendLine("\n**Absent:**");
                foreach (var record in absentRecords)
                {
                    builder.AppendLine($"- {record.Employee?.FullName ?? "Unknown"} on {record.Date:dd MMM}");
                }
            }

            return builder.ToString();
        }

        private async Task<string?> GetLeaveContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();
            var today = DateTime.Today;

            // Check for people on leave today
            var onLeaveToday = await context.Attendances
                .Include(a => a.Employee)
                .Where(a => a.Date == today && a.Status == "OnLeave")
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("### Leave Information");

            if (lowerQuery.Contains("today") || lowerQuery.Contains("who") || lowerQuery.Contains("on leave"))
            {
                builder.AppendLine($"\n**On Leave Today ({today:dd MMM yyyy}):**");
                if (onLeaveToday.Any())
                {
                    foreach (var record in onLeaveToday)
                    {
                        builder.AppendLine($"- {record.Employee?.FullName ?? "Unknown"} ({record.Remarks ?? "Leave"})");
                    }
                }
                else
                {
                    builder.AppendLine("- No one is on leave today");
                }
            }

            // Upcoming leave this week
            var weekEnd = today.AddDays(7);
            var upcomingLeave = await context.Attendances
                .Include(a => a.Employee)
                .Where(a => a.Date > today && a.Date <= weekEnd && a.Status == "OnLeave")
                .OrderBy(a => a.Date)
                .ToListAsync();

            if (upcomingLeave.Any())
            {
                builder.AppendLine($"\n**Upcoming Leave (Next 7 days):**");
                foreach (var record in upcomingLeave)
                {
                    builder.AppendLine($"- {record.Employee?.FullName ?? "Unknown"}: {record.Date:dd MMM} ({record.Remarks ?? "Leave"})");
                }
            }

            return builder.ToString();
        }

        private async Task<string?> GetProjectsContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();

            // Check for specific project/board name
            var nameMatch = Regex.Match(query, @"(?:project|board)\s+[""']?([^""']+)[""']?", RegexOptions.IgnoreCase);

            IQueryable<Board> boardsQuery = context.Boards
                .Include(b => b.Department)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards);

            if (nameMatch.Success)
            {
                var searchName = nameMatch.Groups[1].Value.Trim().ToLower();
                boardsQuery = boardsQuery.Where(b => b.Title.ToLower().Contains(searchName));
            }

            var boards = await boardsQuery.Take(5).ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("### Projects/Boards");

            if (!boards.Any())
            {
                // Return summary
                var totalBoards = await context.Boards.CountAsync();
                var statusCounts = await context.Boards
                    .GroupBy(b => b.Status)
                    .Select(g => new { Status = g.Key, Count = g.Count() })
                    .ToListAsync();

                builder.AppendLine($"**Total Projects:** {totalBoards}");
                foreach (var sc in statusCounts)
                {
                    builder.AppendLine($"- {sc.Status}: {sc.Count}");
                }
                return builder.ToString();
            }

            foreach (var board in boards)
            {
                var totalCards = board.Lists.Sum(l => l.Cards.Count);
                var completedCards = board.Lists
                    .Where(l => l.Title.ToLower().Contains("done") || l.Title.ToLower().Contains("complete"))
                    .Sum(l => l.Cards.Count);

                builder.AppendLine($"\n**{board.Title}**");
                builder.AppendLine($"- Status: {board.Status}");
                builder.AppendLine($"- Department: {board.Department?.Name ?? "N/A"}");
                builder.AppendLine($"- Total Tasks: {totalCards}");
                if (totalCards > 0)
                {
                    var progress = completedCards * 100 / totalCards;
                    builder.AppendLine($"- Progress: ~{progress}% ({completedCards}/{totalCards} completed)");
                }
                builder.AppendLine($"- Lists: {string.Join(", ", board.Lists.Select(l => $"{l.Title} ({l.Cards.Count})"))}");
            }

            return builder.ToString();
        }

        private async Task<string?> GetTicketsContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();

            IQueryable<SupportTicket> ticketsQuery = context.SupportTickets
                .Include(t => t.SubmittedByUser)
                .Include(t => t.AssignedToUser);

            // Filter by status
            if (lowerQuery.Contains("open"))
                ticketsQuery = ticketsQuery.Where(t => t.Status == "Open");
            else if (lowerQuery.Contains("in progress") || lowerQuery.Contains("working"))
                ticketsQuery = ticketsQuery.Where(t => t.Status == "InProgress");
            else if (lowerQuery.Contains("resolved") || lowerQuery.Contains("closed"))
                ticketsQuery = ticketsQuery.Where(t => t.Status == "Resolved" || t.Status == "Closed");
            else if (lowerQuery.Contains("critical") || lowerQuery.Contains("urgent"))
                ticketsQuery = ticketsQuery.Where(t => t.Priority == "Critical" || t.Priority == "High");

            // Filter by category
            if (lowerQuery.Contains("it") || lowerQuery.Contains("technical"))
                ticketsQuery = ticketsQuery.Where(t => t.Category == "IT Support" || t.Category == "Software" || t.Category == "Hardware" || t.Category == "Network");

            var tickets = await ticketsQuery
                .OrderByDescending(t => t.Priority == "Critical" ? 0 : t.Priority == "High" ? 1 : t.Priority == "Medium" ? 2 : 3)
                .ThenByDescending(t => t.SubmittedDate)
                .Take(10)
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("### Support Tickets");

            // Summary stats
            var openCount = await context.SupportTickets.CountAsync(t => t.Status == "Open");
            var inProgressCount = await context.SupportTickets.CountAsync(t => t.Status == "InProgress");
            var criticalCount = await context.SupportTickets.CountAsync(t => (t.Status == "Open" || t.Status == "InProgress") && t.Priority == "Critical");

            builder.AppendLine($"**Overview:** {openCount} open, {inProgressCount} in progress, {criticalCount} critical");

            if (tickets.Any())
            {
                builder.AppendLine("\n**Recent/Matching Tickets:**");
                foreach (var ticket in tickets)
                {
                    builder.AppendLine($"- **#{ticket.TicketId}** [{ticket.Priority}] {ticket.Title}");
                    builder.AppendLine($"  Status: {ticket.Status} | Category: {ticket.Category}");
                    builder.AppendLine($"  Submitted by: {ticket.SubmittedBy} on {ticket.SubmittedDate:dd MMM yyyy}");
                    if (!string.IsNullOrEmpty(ticket.AssignedTo))
                        builder.AppendLine($"  Assigned to: {ticket.AssignedTo}");
                }
            }

            return builder.ToString();
        }

        private async Task<string?> GetMeetingsContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();
            var today = DateTime.Today;
            var tomorrow = today.AddDays(1);
            var weekEnd = today.AddDays(7);

            IQueryable<Meeting> meetingsQuery = context.Meetings
                .Include(m => m.Organizer)
                .Include(m => m.Attendees)
                    .ThenInclude(a => a.User);

            // Date filtering
            if (lowerQuery.Contains("today"))
            {
                meetingsQuery = meetingsQuery.Where(m => m.MeetingDate.Date == today);
            }
            else if (lowerQuery.Contains("tomorrow"))
            {
                meetingsQuery = meetingsQuery.Where(m => m.MeetingDate.Date == tomorrow);
            }
            else if (lowerQuery.Contains("this week") || lowerQuery.Contains("upcoming"))
            {
                meetingsQuery = meetingsQuery.Where(m => m.MeetingDate.Date >= today && m.MeetingDate.Date <= weekEnd);
            }
            else
            {
                // Default: upcoming meetings
                meetingsQuery = meetingsQuery.Where(m => m.MeetingDate.Date >= today);
            }

            var meetings = await meetingsQuery
                .OrderBy(m => m.MeetingDate)
                .ThenBy(m => m.StartTime)
                .Take(10)
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("### Meetings");

            if (!meetings.Any())
            {
                builder.AppendLine("No meetings found for the specified period.");
                return builder.ToString();
            }

            foreach (var meeting in meetings)
            {
                var endTimeStr = meeting.EndTime.HasValue ? $" - {meeting.EndTime:hh\\:mm}" : "";
                builder.AppendLine($"\n**{meeting.Title}**");
                builder.AppendLine($"- Date: {meeting.MeetingDate:dddd, dd MMM yyyy}");
                builder.AppendLine($"- Time: {meeting.StartTime:hh\\:mm}{endTimeStr}");
                builder.AppendLine($"- Location: {meeting.Location}");
                builder.AppendLine($"- Organizer: {meeting.Organizer?.Name ?? "Unknown"} {meeting.Organizer?.Surname ?? ""}");
                builder.AppendLine($"- Status: {meeting.Status}");
                
                if (meeting.Attendees.Any())
                {
                    var attendeeNames = meeting.Attendees
                        .Where(a => a.User != null)
                        .Select(a => $"{a.User!.Name} ({a.ResponseStatus})")
                        .Take(5);
                    builder.AppendLine($"- Attendees: {string.Join(", ", attendeeNames)}");
                }
            }

            return builder.ToString();
        }

        private async Task<string?> GetAnnouncementsContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var announcements = await context.Announcements
                .Include(a => a.CreatedByUser)
                .Where(a => a.IsActive && (a.ExpiresAt == null || a.ExpiresAt > DateTime.UtcNow))
                .OrderByDescending(a => a.Priority == "Urgent" ? 0 : a.Priority == "High" ? 1 : a.Priority == "Normal" ? 2 : 3)
                .ThenByDescending(a => a.CreatedAt)
                .Take(5)
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("### Announcements");

            if (!announcements.Any())
            {
                builder.AppendLine("No active announcements.");
                return builder.ToString();
            }

            foreach (var announcement in announcements)
            {
                builder.AppendLine($"\n**[{announcement.Priority}] {announcement.Title}**");
                builder.AppendLine($"- Posted: {announcement.CreatedAt:dd MMM yyyy} by {announcement.CreatedByUser?.Name ?? "Unknown"}");
                builder.AppendLine($"- Content: {TruncateText(announcement.Content, 200)}");
                if (announcement.ExpiresAt.HasValue)
                    builder.AppendLine($"- Expires: {announcement.ExpiresAt:dd MMM yyyy}");
            }

            return builder.ToString();
        }

        private async Task<string?> GetDepartmentsContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var departments = await context.Departments
                .Include(d => d.Users.Where(u => u.IsActive))
                .Include(d => d.Boards)
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("### Departments");

            foreach (var dept in departments)
            {
                builder.AppendLine($"\n**{dept.Name}**");
                if (!string.IsNullOrEmpty(dept.ManagerName))
                    builder.AppendLine($"- Manager: {dept.ManagerName}");
                builder.AppendLine($"- Employees: {dept.Users.Count}");
                builder.AppendLine($"- Active Projects: {dept.Boards.Count(b => b.Status == "InProgress")}");
            }

            return builder.ToString();
        }

        private async Task<string?> GetCRMContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();

            var builder = new StringBuilder();
            builder.AppendLine("### CRM Data");

            // Lead summary
            var totalLeads = await context.Leads.CountAsync();
            var newLeadsToday = await context.Leads.CountAsync(l => l.CreatedAt.Date == DateTime.Today);
            var hotLeads = await context.Leads
                .Include(l => l.LeadStatus)
                .Where(l => l.LeadStatus != null && l.LeadStatus.Name.ToLower().Contains("hot"))
                .CountAsync();

            builder.AppendLine($"**Lead Summary:**");
            builder.AppendLine($"- Total Leads: {totalLeads}");
            builder.AppendLine($"- New Today: {newLeadsToday}");
            builder.AppendLine($"- Hot Leads: {hotLeads}");

            // If asking about specific lead or customer
            var nameMatch = Regex.Match(query, @"(?:lead|customer|client|contact)\s+[""']?([^""']+)[""']?", RegexOptions.IgnoreCase);
            if (nameMatch.Success)
            {
                var searchName = nameMatch.Groups[1].Value.Trim().ToLower();
                var matchingLeads = await context.Leads
                    .Include(l => l.LeadStatus)
                    .Include(l => l.AssignedAgent)
                    .Where(l => l.FirstName.ToLower().Contains(searchName) || 
                               (l.LastName != null && l.LastName.ToLower().Contains(searchName)) ||
                               (l.CompanyName != null && l.CompanyName.ToLower().Contains(searchName)))
                    .Take(5)
                    .ToListAsync();

                if (matchingLeads.Any())
                {
                    builder.AppendLine($"\n**Matching Leads:**");
                    foreach (var lead in matchingLeads)
                    {
                        builder.AppendLine($"- **{lead.FirstName} {lead.LastName}** ({lead.CompanyName ?? "Individual"})");
                        builder.AppendLine($"  - Status: {lead.LeadStatus?.Name ?? "N/A"}");
                        builder.AppendLine($"  - Phone: {lead.Phone ?? lead.MobilePhone ?? "N/A"}");
                        builder.AppendLine($"  - Email: {lead.Email ?? "N/A"}");
                        if (lead.AssignedAgent != null)
                            builder.AppendLine($"  - Assigned to: {lead.AssignedAgent.Name}");
                    }
                }
            }

            // Campaign summary
            var activeCampaigns = await context.Campaigns
                .Where(c => c.Status == "Active")
                .Select(c => new { c.Name, c.StartDate, c.EndDate })
                .Take(5)
                .ToListAsync();

            if (activeCampaigns.Any())
            {
                builder.AppendLine($"\n**Active Campaigns:**");
                foreach (var campaign in activeCampaigns)
                {
                    builder.AppendLine($"- {campaign.Name} ({campaign.StartDate:dd MMM} - {campaign.EndDate?.ToString("dd MMM") ?? "Ongoing"})");
                }
            }

            return builder.ToString();
        }

        private static string TruncateText(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength)
                return text;
            return text.Substring(0, maxLength) + "...";
        }

        private async Task<string?> GetInvoicesContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var builder = new StringBuilder();
            builder.AppendLine("### Invoice Data\n");

            var lowerQuery = query.ToLower();

            // Check for specific transaction number
            var txMatch = System.Text.RegularExpressions.Regex.Match(query, @"[A-Z]{2,3}-?\d{4,}", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (txMatch.Success)
            {
                var txNumber = txMatch.Value;
                var invoice = await context.ImportedInvoices
                    .Include(i => i.Customer)
                    .FirstOrDefaultAsync(i => i.TransactionNumber.Contains(txNumber));

                if (invoice != null)
                {
                    builder.AppendLine($"**Invoice: {invoice.TransactionNumber}**");
                    builder.AppendLine($"- Date: {invoice.TransactionDate:dd MMM yyyy}");
                    builder.AppendLine($"- Customer: {invoice.Customer?.Name ?? invoice.CustomerName}");
                    builder.AppendLine($"- Product: {invoice.ProductDescription}");
                    builder.AppendLine($"- Quantity: {invoice.Quantity:N0}");
                    builder.AppendLine($"- Sales Amount: R{invoice.SalesAmount:N2}");
                    builder.AppendLine($"- Cost of Sales: R{invoice.CostOfSales:N2}");
                    builder.AppendLine($"- Status: {invoice.Status}");
                    return builder.ToString();
                }
            }

            // Get date range based on query
            DateTime fromDate = DateTime.Today.AddDays(-30);
            DateTime toDate = DateTime.Today;

            if (lowerQuery.Contains("today"))
            {
                fromDate = DateTime.Today;
                toDate = DateTime.Today.AddDays(1);
            }
            else if (lowerQuery.Contains("yesterday"))
            {
                fromDate = DateTime.Today.AddDays(-1);
                toDate = DateTime.Today;
            }
            else if (lowerQuery.Contains("this week"))
            {
                fromDate = DateTime.Today.AddDays(-(int)DateTime.Today.DayOfWeek);
                toDate = DateTime.Today.AddDays(1);
            }
            else if (lowerQuery.Contains("this month"))
            {
                fromDate = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
                toDate = DateTime.Today.AddDays(1);
            }

            // Check for customer name
            string? customerFilter = null;
            var customerMatch = System.Text.RegularExpressions.Regex.Match(query, @"(?:customer|client|for)\s+([A-Za-z\s]+?)(?:\s+invoice|\s+transaction|\s*$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (customerMatch.Success)
            {
                customerFilter = customerMatch.Groups[1].Value.Trim();
            }

            // Build query
            var invoiceQuery = context.ImportedInvoices
                .Include(i => i.Customer)
                .Where(i => i.TransactionDate >= fromDate && i.TransactionDate <= toDate);

            if (!string.IsNullOrEmpty(customerFilter))
            {
                invoiceQuery = invoiceQuery.Where(i => 
                    (i.Customer != null && i.Customer.Name.ToLower().Contains(customerFilter.ToLower())) ||
                    i.CustomerName.ToLower().Contains(customerFilter.ToLower()));
            }

            // Get summary
            var invoices = await invoiceQuery
                .OrderByDescending(i => i.TransactionDate)
                .Take(20)
                .ToListAsync();

            var totalCount = await invoiceQuery.CountAsync();
            var totalSales = await invoiceQuery.SumAsync(i => i.SalesAmount);
            var totalCost = await invoiceQuery.SumAsync(i => i.CostOfSales);

            builder.AppendLine($"**Summary ({fromDate:dd MMM} - {toDate:dd MMM yyyy}):**");
            builder.AppendLine($"- Total Invoices: {totalCount}");
            builder.AppendLine($"- Total Sales: R{totalSales:N2}");
            builder.AppendLine($"- Total Cost: R{totalCost:N2}");
            builder.AppendLine($"- Gross Profit: R{(totalSales - totalCost):N2}");

            if (invoices.Any())
            {
                builder.AppendLine($"\n**Recent Invoices (showing {invoices.Count} of {totalCount}):**");
                foreach (var inv in invoices.Take(10))
                {
                    builder.AppendLine($"- {inv.TransactionNumber} | {inv.TransactionDate:dd MMM} | {inv.Customer?.Name ?? inv.CustomerName} | {inv.ProductDescription} | R{inv.SalesAmount:N2}");
                }
            }

            // Status breakdown
            var statusBreakdown = await invoiceQuery
                .GroupBy(i => i.Status)
                .Select(g => new { Status = g.Key, Count = g.Count(), Total = g.Sum(i => i.SalesAmount) })
                .ToListAsync();

            if (statusBreakdown.Any())
            {
                builder.AppendLine($"\n**By Status:**");
                foreach (var status in statusBreakdown)
                {
                    builder.AppendLine($"- {status.Status}: {status.Count} invoices (R{status.Total:N2})");
                }
            }

            return builder.ToString();
        }
    }
}
