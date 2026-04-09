using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Logistics;
using System.Collections.Concurrent;
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

        // Simple in-memory cache for slow-changing data
        private static readonly ConcurrentDictionary<string, (DateTime Expiry, object Data)> _cache = new();
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

        // Max context budget (chars) — keeps total DB context under ~3000 tokens
        private const int MaxContextChars = 12000;

        // Domain keyword mappings with weighted scores
        // Multi-word phrases score higher (2pts) vs single words (1pt) to reduce false positives
        private static readonly Dictionary<string, (string Keyword, int Weight)[]> DomainKeywords = new()
        {
            ["employees"] = new[] {
                ("employee", 2), ("employees", 2), ("staff", 1), ("who is", 2), ("who's", 2),
                ("team member", 2), ("works in", 2), ("working in", 2), ("who works", 2),
                ("extension", 1), ("phone number", 2), ("contact number", 2), ("personnel", 2)
            },
            ["attendance"] = new[] {
                ("attendance", 3), ("clock in", 3), ("clock out", 3), ("clocked", 2),
                ("present", 1), ("absent", 2), ("late", 1), ("working hours", 2),
                ("time in", 2), ("time out", 2), ("checked in", 2)
            },
            ["leave"] = new[] {
                ("leave", 2), ("vacation", 2), ("holiday", 1), ("sick leave", 3), ("annual leave", 3),
                ("day off", 2), ("days off", 2), ("time off", 2), ("pto", 3), ("on leave", 3)
            },
            ["customers"] = new[] {
                ("customer", 2), ("customers", 2), ("client", 2), ("clients", 2),
                ("customer code", 3), ("customer name", 3), ("contact person", 2),
                ("credit limit", 3), ("payment terms", 3), ("vat number", 3)
            },
            ["tickets"] = new[] {
                ("ticket", 2), ("tickets", 2), ("support ticket", 3), ("issue", 1),
                ("help desk", 3), ("bug", 2), ("incident", 2)
            },
            ["meetings"] = new[] {
                ("meeting", 2), ("meetings", 2), ("appointment", 2), ("scheduled", 1),
                ("calendar", 2), ("boardroom", 2), ("conference", 1)
            },
            ["announcements"] = new[] {
                ("announcement", 3), ("announcements", 3), ("notice", 1), ("bulletin", 2), ("memo", 2)
            },
            ["departments"] = new[] {
                ("department", 2), ("departments", 2), ("division", 2), ("unit", 1)
            },
            ["logistics"] = new[] {
                ("load", 1), ("loads", 2), ("delivery", 1), ("deliveries", 2), ("driver", 1), ("drivers", 2),
                ("vehicle", 1), ("truck", 2), ("transport", 2), ("shipment", 2), ("logistics", 3),
                ("dispatch", 2), ("route", 1), ("commodity", 2), ("rf-", 3), ("ld-", 3), ("in transit", 3)
            },
            ["tripsheets"] = new[] {
                ("tripsheet", 3), ("tripsheets", 3), ("trip sheet", 3), ("trip sheets", 3),
                ("ts-", 3), ("generate load", 3), ("available tripsheet", 3)
            },
            ["invoices"] = new[] {
                ("invoice", 2), ("invoices", 2), ("tfn", 3), ("transaction", 1), ("transactions", 2),
                ("sales amount", 3), ("cost of sales", 3), ("billing", 2), ("revenue", 2)
            },
            ["stock"] = new[] {
                ("stock", 2), ("inventory", 2), ("stock on hand", 3), ("soh", 3),
                ("warehouse", 2), ("warehouses", 2), ("stock level", 3), ("stock available", 3)
            },
            ["email_accounts"] = new[] {
                ("email account", 3), ("email address", 2), ("mailbox", 2), ("email password", 3),
                ("email credentials", 3), ("email login", 3), ("@promedtechnologies", 3)
            }
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

        /// <summary>
        /// Detect relevant domains using weighted keyword scoring.
        /// Returns top 2 domains with score >= 2 to avoid context bloat.
        /// </summary>
        public List<string> DetectQueryDomains(string query)
        {
            var lowerQuery = query.ToLower();
            var domainScores = new Dictionary<string, int>();

            foreach (var domain in DomainKeywords)
            {
                var score = 0;
                foreach (var (keyword, weight) in domain.Value)
                {
                    if (lowerQuery.Contains(keyword))
                    {
                        score += weight;
                    }
                }
                if (score >= 2)
                {
                    domainScores[domain.Key] = score;
                }
            }

            // Return top 2 domains by score (prevents over-fetching from too many domains)
            return domainScores
                .OrderByDescending(d => d.Value)
                .Take(2)
                .Select(d => d.Key)
                .ToList();
        }

        public async Task<string?> GetContextForQueryAsync(string query)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var domains = DetectQueryDomains(query);
            _logger.LogInformation("AI Context: Detected domains for '{Query}': [{Domains}]", 
                query, string.Join(", ", domains));
            
            if (!domains.Any())
            {
                return null;
            }

            var contextBuilder = new StringBuilder();
            contextBuilder.AppendLine("## Database Context\n");

            foreach (var domain in domains)
            {
                try
                {
                    var domainContext = domain switch
                    {
                        "employees" => await GetEmployeeContextAsync(query),
                        "attendance" => await GetAttendanceContextAsync(query),
                        "leave" => await GetLeaveContextAsync(query),
                        "customers" => await GetCustomerContextAsync(query),
                        "tickets" => await GetTicketsContextAsync(query),
                        "meetings" => await GetMeetingsContextAsync(query),
                        "announcements" => await GetAnnouncementsContextAsync(query),
                        "departments" => await GetDepartmentsContextAsync(query),
                        "logistics" => await _logisticsService.GetLoadsContextAsync(query),
                        "tripsheets" => await GetTripSheetsContextAsync(query),
                        "invoices" => await GetInvoicesContextAsync(query),
                        "stock" => await GetStockContextAsync(query),
                        "email_accounts" => await GetEmailAccountsContextAsync(query),
                        _ => null
                    };

                    if (!string.IsNullOrEmpty(domainContext))
                    {
                        contextBuilder.AppendLine(domainContext);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error getting context for domain {Domain}", domain);
                }
            }

            var result = contextBuilder.ToString();
            
            // Truncate if over budget to prevent context window overflow
            if (result.Length > MaxContextChars)
            {
                result = result.Substring(0, MaxContextChars) + "\n\n[Context truncated for brevity]";
                _logger.LogWarning("AI Context truncated from {Original} to {Max} chars", contextBuilder.Length, MaxContextChars);
            }

            sw.Stop();
            _logger.LogInformation("AI Context: Built {Chars} chars in {Ms}ms for domains [{Domains}]", 
                result.Length, sw.ElapsedMilliseconds, string.Join(", ", domains));

            return string.IsNullOrWhiteSpace(result) ? null : result;
        }

        /// <summary>
        /// Simple cache helper — returns cached data or fetches fresh
        /// </summary>
        private T GetCached<T>(string key, Func<T> factory)
        {
            if (_cache.TryGetValue(key, out var cached) && cached.Expiry > DateTime.UtcNow)
            {
                return (T)cached.Data;
            }
            var data = factory();
            _cache[key] = (DateTime.UtcNow.Add(CacheDuration), data!);
            return data;
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

            var users = await usersQuery.Take(10).ToListAsync();

            if (!users.Any())
            {
                var totalCount = await context.Users.CountAsync(u => u.IsActive);
                var departmentCounts = await context.Users
                    .Where(u => u.IsActive && u.DepartmentId != null)
                    .GroupBy(u => u.Department!.Name)
                    .Select(g => new { Department = g.Key, Count = g.Count() })
                    .ToListAsync();

                var sb = new StringBuilder();
                sb.AppendLine($"### Employees: {totalCount} active");
                foreach (var dc in departmentCounts)
                    sb.AppendLine($"- {dc.Department}: {dc.Count}");
                return sb.ToString();
            }

            var builder = new StringBuilder();
            builder.AppendLine($"### Employees ({users.Count} found)");
            foreach (var user in users)
            {
                var dept = user.Department?.Name ?? "";
                var title = !string.IsNullOrEmpty(user.Title) ? $", {user.Title}" : "";
                var ext = user.Extensions.Any() ? $", Ext: {string.Join("/", user.Extensions.Select(e => e.ExtensionNumber))}" : "";
                builder.AppendLine($"- **{user.Name} {user.Surname}** — {user.Email} | {user.Role}{title} | {dept}{ext}");
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
                .Take(15)
                .ToListAsync();

            var builder = new StringBuilder();
            var dateRange = startDate == endDate 
                ? startDate.ToString("dd MMM yyyy") 
                : $"{startDate:dd MMM} - {endDate:dd MMM yyyy}";
            
            builder.AppendLine($"### Attendance ({dateRange})");

            if (!attendanceRecords.Any())
            {
                builder.AppendLine("No records found.");
                return builder.ToString();
            }

            var summary = attendanceRecords.GroupBy(a => a.Status).Select(g => $"{g.Key}: {g.Count()}");
            var lateCount = attendanceRecords.Count(a => a.IsLate);
            builder.AppendLine($"**Summary:** {string.Join(", ", summary)}{(lateCount > 0 ? $", Late: {lateCount}" : "")}");

            if (lowerQuery.Contains("late"))
            {
                foreach (var record in attendanceRecords.Where(a => a.IsLate).Take(8))
                    builder.AppendLine($"- {record.Employee?.FullName ?? "?"}: {record.LateMinutes}min late ({record.TimeIn:HH:mm})");
            }

            if (lowerQuery.Contains("absent"))
            {
                foreach (var record in attendanceRecords.Where(a => a.Status == "Absent").Take(8))
                    builder.AppendLine($"- {record.Employee?.FullName ?? "?"}: absent {record.Date:dd MMM}");
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

        private async Task<string?> GetCustomerContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();
            var builder = new StringBuilder();
            builder.AppendLine("### Customer Information\n");

            // Check for specific customer search by name or code
            var nameMatch = Regex.Match(query, @"(?:customer|client|account)\s+[""']?([^""']+?)[""']?(?:\s+details|\s+info|\s+address|\s*$)", RegexOptions.IgnoreCase);
            var codeMatch = Regex.Match(query, @"[A-Z]{2,5}-?\d{3,}", RegexOptions.IgnoreCase);

            IQueryable<Customer> customersQuery = context.LogisticsCustomers;

            // Only include heavy relations if asking about a specific customer
            bool specificSearch = codeMatch.Success || (nameMatch.Success && !new[] { "list", "all", "info", "details", "how many", "total" }.Contains(nameMatch.Groups[1].Value.Trim().ToLower()));
            
            if (specificSearch)
            {
                customersQuery = customersQuery
                    .Include(c => c.Contracts.Where(ct => ct.Status == "Active"))
                    .Include(c => c.DeliveryAddresses);
            }

            // Filter by specific customer code
            if (codeMatch.Success)
            {
                var code = codeMatch.Value;
                customersQuery = customersQuery.Where(c => c.CustomerCode != null && c.CustomerCode.Contains(code));
            }
            else if (nameMatch.Success)
            {
                var searchName = nameMatch.Groups[1].Value.Trim().ToLower();
                if (!new[] { "list", "all", "info", "details", "how many", "total" }.Contains(searchName))
                {
                    customersQuery = customersQuery.Where(c =>
                        c.Name.ToLower().Contains(searchName) ||
                        (c.ShortName != null && c.ShortName.ToLower().Contains(searchName)) ||
                        (c.CustomerCode != null && c.CustomerCode.ToLower().Contains(searchName)));
                }
            }

            // Filter by status
            if (lowerQuery.Contains("inactive"))
                customersQuery = customersQuery.Where(c => c.Status == "Inactive");
            else if (lowerQuery.Contains("suspended"))
                customersQuery = customersQuery.Where(c => c.Status == "Suspended");
            else if (lowerQuery.Contains("active") && !lowerQuery.Contains("inactive"))
                customersQuery = customersQuery.Where(c => c.Status == "Active");

            // Filter by province
            if (lowerQuery.Contains("gauteng") || lowerQuery.Contains("gp"))
                customersQuery = customersQuery.Where(c => c.Province != null && c.Province.ToLower().Contains("gauteng"));
            else if (lowerQuery.Contains("kzn") || lowerQuery.Contains("kwazulu"))
                customersQuery = customersQuery.Where(c => c.Province != null && (c.Province.ToLower().Contains("kzn") || c.Province.ToLower().Contains("kwazulu")));
            else if (lowerQuery.Contains("western cape") || lowerQuery.Contains("cape town"))
                customersQuery = customersQuery.Where(c => c.Province != null && (c.Province.ToLower().Contains("western cape") || c.Province.ToLower().Contains("cape")));
            else if (lowerQuery.Contains("eastern cape") || lowerQuery.Contains("pe") || lowerQuery.Contains("gqeberha"))
                customersQuery = customersQuery.Where(c => c.Province != null && (c.Province.ToLower().Contains("eastern cape")));

            var customers = await customersQuery
                .OrderBy(c => c.Name)
                .Take(10)
                .ToListAsync();

            // Only include summary stats if this is a general customer query (not specific lookup)
            if (!specificSearch)
            {
                var totalCount = await context.LogisticsCustomers.CountAsync();
                var activeCount = await context.LogisticsCustomers.CountAsync(c => c.Status == "Active");
                builder.AppendLine($"**Customers:** {totalCount} total ({activeCount} active)");
            }

            if (customers.Any())
            {
                foreach (var customer in customers)
                {
                    var code = !string.IsNullOrEmpty(customer.CustomerCode) ? $" ({customer.CustomerCode})" : "";
                    var location = !string.IsNullOrEmpty(customer.City) ? $" | {customer.City}" : "";
                    var province = !string.IsNullOrEmpty(customer.Province) ? $", {customer.Province}" : "";
                    builder.AppendLine($"\n**{customer.Name}**{code} — {customer.Status}{location}{province}");
                    
                    if (!string.IsNullOrEmpty(customer.ContactPerson))
                        builder.AppendLine($"- Contact: {customer.ContactPerson} | {customer.Email ?? ""} | {customer.PhoneNumber ?? ""}");
                    if (!string.IsNullOrEmpty(customer.PaymentTerms) || customer.CreditLimit.HasValue)
                        builder.AppendLine($"- Terms: {customer.PaymentTerms ?? "N/A"}{(customer.CreditLimit.HasValue ? $" | Credit: R{customer.CreditLimit:N2}" : "")}");
                    
                    // Only show contracts/addresses for specific lookups
                    if (specificSearch)
                    {
                        if (!string.IsNullOrEmpty(customer.VatNumber))
                            builder.AppendLine($"- VAT: {customer.VatNumber}");
                        if (customer.Contracts?.Any() == true)
                        {
                            foreach (var contract in customer.Contracts.Take(3))
                                builder.AppendLine($"- Contract: {contract.ContractNumber} — {contract.ContractName ?? "N/A"} (R{contract.TotalValue:N2}, exp {contract.EndDate:dd MMM yyyy})");
                        }
                        if (customer.DeliveryAddresses?.Any() == true)
                            builder.AppendLine($"- Delivery Addresses: {customer.DeliveryAddresses.Count}");
                    }
                }
            }
            else if (specificSearch)
            {
                builder.AppendLine("No customers found matching your search.");
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
                .Take(8)
                .ToListAsync();

            var builder = new StringBuilder();
            
            var openCount = await context.SupportTickets.CountAsync(t => t.Status == "Open");
            var inProgressCount = await context.SupportTickets.CountAsync(t => t.Status == "InProgress");
            var criticalCount = await context.SupportTickets.CountAsync(t => (t.Status == "Open" || t.Status == "InProgress") && t.Priority == "Critical");
            builder.AppendLine($"### Tickets: {openCount} open, {inProgressCount} in-progress, {criticalCount} critical");

            foreach (var ticket in tickets)
            {
                var assigned = !string.IsNullOrEmpty(ticket.AssignedTo) ? $" → {ticket.AssignedTo}" : "";
                builder.AppendLine($"- **#{ticket.TicketId}** [{ticket.Priority}] {ticket.Title} | {ticket.Status} | {ticket.Category} | by {ticket.SubmittedBy}{assigned}");
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
                .Take(8)
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine($"### Meetings ({meetings.Count} found)");

            if (!meetings.Any())
            {
                builder.AppendLine("No meetings found.");
                return builder.ToString();
            }

            foreach (var meeting in meetings)
            {
                var end = meeting.EndTime.HasValue ? $"-{meeting.EndTime:hh\\:mm}" : "";
                var attendees = meeting.Attendees.Any() 
                    ? $" | {string.Join(", ", meeting.Attendees.Where(a => a.User != null).Take(4).Select(a => a.User!.Name))}"
                    : "";
                builder.AppendLine($"- **{meeting.Title}** — {meeting.MeetingDate:ddd dd MMM} {meeting.StartTime:hh\\:mm}{end} | {meeting.Location} | {meeting.Status}{attendees}");
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
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("### Departments");
            foreach (var dept in departments)
            {
                var manager = !string.IsNullOrEmpty(dept.ManagerName) ? $" (Mgr: {dept.ManagerName})" : "";
                builder.AppendLine($"- **{dept.Name}**: {dept.Users.Count} employees{manager}");
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
                .Take(10)
                .ToListAsync();

            var totalCount = await invoiceQuery.CountAsync();
            var totalSales = await invoiceQuery.SumAsync(i => i.SalesAmount);
            var totalCost = await invoiceQuery.SumAsync(i => i.CostOfSales);

            builder.AppendLine($"**{fromDate:dd MMM} - {toDate:dd MMM yyyy}:** {totalCount} invoices | Sales: R{totalSales:N2} | Cost: R{totalCost:N2} | Profit: R{(totalSales - totalCost):N2}");

            if (invoices.Any())
            {
                builder.AppendLine($"\n**Recent ({Math.Min(invoices.Count, 10)} of {totalCount}):**");
                foreach (var inv in invoices)
                    builder.AppendLine($"- {inv.TransactionNumber} | {inv.TransactionDate:dd MMM} | {inv.Customer?.Name ?? inv.CustomerName} | {inv.ProductDescription} | R{inv.SalesAmount:N2} | {inv.Status}");
            }

            return builder.ToString();
        }

        private async Task<string?> GetTripSheetsContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var builder = new StringBuilder();
            builder.AppendLine("### TripSheet/Load Data\n");

            var lowerQuery = query.ToLower();

            // TripSheets are generated from Loads - check for load numbers
            var loadMatch = System.Text.RegularExpressions.Regex.Match(query, @"(TS|LD|RF)-?\d{6}", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            IQueryable<Models.Logistics.Load> loadsQuery = context.Loads
                .Include(l => l.Driver)
                .Include(l => l.Vehicle)
                .Include(l => l.Warehouse)
                .Include(l => l.Customer)
                .Include(l => l.Stops);

            if (loadMatch.Success)
            {
                var loadNumber = loadMatch.Value.ToUpper();
                loadsQuery = loadsQuery.Where(l => l.LoadNumber.Contains(loadNumber));
            }

            // Filter by status
            if (lowerQuery.Contains("available"))
                loadsQuery = loadsQuery.Where(l => l.Status == "Available");
            else if (lowerQuery.Contains("active") || lowerQuery.Contains("assigned"))
                loadsQuery = loadsQuery.Where(l => l.Status == "Assigned" || l.Status == "Active");
            else if (lowerQuery.Contains("in transit") || lowerQuery.Contains("intransit"))
                loadsQuery = loadsQuery.Where(l => l.Status == "InTransit");
            else if (lowerQuery.Contains("completed") || lowerQuery.Contains("delivered"))
                loadsQuery = loadsQuery.Where(l => l.Status == "Delivered");
            else if (lowerQuery.Contains("cancelled"))
                loadsQuery = loadsQuery.Where(l => l.Status == "Cancelled");

            // Filter by driver
            var driverMatch = System.Text.RegularExpressions.Regex.Match(query, @"(?:driver|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (driverMatch.Success)
            {
                var driverName = driverMatch.Groups[1].Value.Trim().ToLower();
                if (!new[] { "today", "available", "active" }.Contains(driverName))
                {
                    loadsQuery = loadsQuery.Where(l => l.Driver != null &&
                        (l.Driver.FirstName.ToLower().Contains(driverName) ||
                         l.Driver.LastName.ToLower().Contains(driverName)));
                }
            }

            // Date filtering
            if (lowerQuery.Contains("today"))
            {
                loadsQuery = loadsQuery.Where(l => l.ScheduledPickupDate.HasValue && l.ScheduledPickupDate.Value.Date == DateTime.Today);
            }
            else if (lowerQuery.Contains("this week"))
            {
                var startOfWeek = DateTime.Today.AddDays(-(int)DateTime.Today.DayOfWeek);
                loadsQuery = loadsQuery.Where(l => l.ScheduledPickupDate.HasValue && l.ScheduledPickupDate.Value.Date >= startOfWeek);
            }
            else if (lowerQuery.Contains("this month"))
            {
                var startOfMonth = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
                loadsQuery = loadsQuery.Where(l => l.ScheduledPickupDate.HasValue && l.ScheduledPickupDate.Value.Date >= startOfMonth);
            }

            var loads = await loadsQuery
                .OrderByDescending(l => l.ScheduledPickupDate ?? l.CreatedAt)
                .Take(10)
                .ToListAsync();

            // Summary stats
            var totalCount = await context.Loads.CountAsync();
            var availableCount = await context.Loads.CountAsync(l => l.Status == "Available");
            var assignedCount = await context.Loads.CountAsync(l => l.Status == "Assigned" || l.Status == "Active");
            var inTransitCount = await context.Loads.CountAsync(l => l.Status == "InTransit");

            builder.AppendLine($"**Loads:** {totalCount} total | Available: {availableCount} | Active: {assignedCount} | In Transit: {inTransitCount}");

            if (loads.Any())
            {
                builder.AppendLine($"\n**Showing {loads.Count} loads:**");
                foreach (var load in loads)
                {
                    var driver = load.Driver != null ? $"{load.Driver.FirstName} {load.Driver.LastName}" : "Unassigned";
                    var vehicle = load.Vehicle?.RegistrationNumber ?? "N/A";
                    var date = load.ScheduledPickupDate?.ToString("dd MMM") ?? "Not scheduled";
                    var route = $"{load.PickupLocation ?? "?"} → {load.DeliveryLocation ?? "?"}";
                    builder.AppendLine($"- **{load.LoadNumber}** | {load.Status} | {date} | {driver} | {vehicle} | {route} | {load.Stops.Count} stops");
                }
            }

            return builder.ToString();
        }

        private async Task<string?> GetStockContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var builder = new StringBuilder();
            builder.AppendLine("### Live Inventory Data\n");

            var lowerQuery = query.ToLower();

            // Get warehouses and buildings info
            var warehouses = await context.Warehouses
                .Include(w => w.Buildings)
                .ToListAsync();

            // Determine which warehouse to filter
            int? warehouseFilter = null;
            if (lowerQuery.Contains("gauteng") || lowerQuery.Contains("johannesburg") || lowerQuery.Contains("gp"))
                warehouseFilter = warehouses.FirstOrDefault(w => w.Code == "GP")?.Id;
            else if (lowerQuery.Contains("kzn") || lowerQuery.Contains("durban"))
                warehouseFilter = warehouses.FirstOrDefault(w => w.Code == "KZN")?.Id;
            else if (lowerQuery.Contains("cape") || lowerQuery.Contains("wc"))
                warehouseFilter = warehouses.FirstOrDefault(w => w.Code == "WC")?.Id;
            else if (lowerQuery.Contains("eastern cape") || lowerQuery.Contains("ec"))
                warehouseFilter = warehouses.FirstOrDefault(w => w.Code == "EC")?.Id;

            // Get inventory query
            var inventoryQuery = context.BuildingInventory
                .Include(i => i.Building)
                .ThenInclude(b => b!.Warehouse)
                .AsQueryable();

            if (warehouseFilter.HasValue)
            {
                inventoryQuery = inventoryQuery.Where(i => i.Building!.WarehouseId == warehouseFilter.Value);
            }

            // Check for specific item search
            var itemMatch = System.Text.RegularExpressions.Regex.Match(query, @"(?:item|product|stock for)\s+[""']?([^""']+)[""']?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (itemMatch.Success)
            {
                var searchItem = itemMatch.Groups[1].Value.Trim().ToLower();
                inventoryQuery = inventoryQuery.Where(i => i.ItemCode!.ToLower().Contains(searchItem) || 
                                                   i.ItemDescription!.ToLower().Contains(searchItem));
            }

            // Get summary by building
            var summaryByBuilding = await context.BuildingInventory
                .Include(i => i.Building)
                .GroupBy(i => new { i.BuildingId, BuildingName = i.Building!.Name, i.Building!.WarehouseId })
                .Select(g => new
                {
                    BuildingId = g.Key.BuildingId,
                    BuildingName = g.Key.BuildingName,
                    WarehouseId = g.Key.WarehouseId,
                    ItemCount = g.Count(),
                    TotalQty = g.Sum(i => i.QuantityOnHand),
                    TotalValue = g.Sum(i => i.QuantityOnHand * i.UnitCost)
                })
                .ToListAsync();

            builder.AppendLine("**Live Inventory Summary:**\n");

            // Show warehouse managers and building summaries
            builder.AppendLine("**Warehouses:**");
            foreach (var wh in warehouses)
            {
                var buildingSummaries = summaryByBuilding.Where(s => s.WarehouseId == wh.Id).ToList();
                var totalItems = buildingSummaries.Sum(s => s.ItemCount);
                var totalValue = buildingSummaries.Sum(s => s.TotalValue);
                var bldgList = string.Join(", ", buildingSummaries.Select(b => $"{b.BuildingName}: {b.ItemCount}items R{b.TotalValue:N0}"));
                builder.AppendLine($"- **{wh.Name}** ({wh.Code}) | Mgr: {wh.ManagerName ?? "N/A"} | {totalItems:N0} items R{totalValue:N2} | {bldgList}");
            }

            // If specific location or item was queried, show top items
            if (warehouseFilter.HasValue || itemMatch.Success)
            {
                var items = await inventoryQuery
                    .OrderByDescending(i => i.QuantityOnHand * i.UnitCost)
                    .Take(10)
                    .ToListAsync();

                if (items.Any())
                {
                    builder.AppendLine($"\n**Top Items:**");
                    foreach (var item in items)
                        builder.AppendLine($"- {item.ItemCode}: {item.ItemDescription} | {item.Building?.Name ?? "?"} | Qty: {item.QuantityOnHand:N0} {item.Uom} | Avail: {item.QuantityAvailable:N0} | R{item.QuantityOnHand * item.UnitCost:N2}");
                }
            }

            var overallTotal = summaryByBuilding.Sum(s => s.TotalValue);
            builder.AppendLine($"\n**Total Stock Value: R{overallTotal:N2}**");

            return builder.ToString();
        }

        private async Task<string?> GetEmailAccountsContextAsync(string query)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var lowerQuery = query.ToLower();
            var accounts = await context.EmailAccounts
                .Where(e => e.IsActive)
                .OrderBy(e => e.Email)
                .ToListAsync();

            if (!accounts.Any())
                return null;

            // If a specific email/name is mentioned, filter
            var searchTerms = lowerQuery.Split(' ').Where(t => t.Length > 2 && t != "email" && t != "password" && t != "account" && t != "what" && t != "the" && t != "for").ToList();
            var filtered = accounts;
            if (searchTerms.Any())
            {
                filtered = accounts.Where(e =>
                    searchTerms.Any(t => e.Email.ToLower().Contains(t) ||
                        (e.DisplayName != null && e.DisplayName.ToLower().Contains(t)) ||
                        (e.Department != null && e.Department.ToLower().Contains(t))))
                    .ToList();
            }

            // If no specific match, return all
            if (!filtered.Any())
                filtered = accounts;

            var builder = new StringBuilder();
            builder.AppendLine($"### Email Accounts ({filtered.Count} found)");
            foreach (var acct in filtered)
            {
                var dept = !string.IsNullOrEmpty(acct.Department) ? $" | {acct.Department}" : "";
                var display = !string.IsNullOrEmpty(acct.DisplayName) ? $" ({acct.DisplayName})" : "";
                // Only include password if user specifically asked for it
                var pwd = lowerQuery.Contains("password") || lowerQuery.Contains("credential") || lowerQuery.Contains("login")
                    ? $" | Pwd: {acct.Password}" : "";
                builder.AppendLine($"- **{acct.Email}**{display}{dept}{pwd}");
            }

            return builder.ToString();
        }
    }
}
