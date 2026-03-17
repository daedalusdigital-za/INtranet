using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Tenders;
using System.Net;
using System.Net.Mail;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TendersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;
        private readonly ILogger<TendersController> _logger;

        public TendersController(ApplicationDbContext context, IWebHostEnvironment env, IConfiguration configuration, ILogger<TendersController> logger)
        {
            _context = context;
            _env = env;
            _configuration = configuration;
            _logger = logger;
        }

        // GET: api/Tenders
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Tender>>> GetTenders(
            [FromQuery] string? status = null,
            [FromQuery] string? province = null,
            [FromQuery] string? department = null,
            [FromQuery] string? companyCode = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] string? search = null)
        {
            var query = _context.Tenders
                .AsNoTracking()
                .Include(t => t.TeamMembers)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(t => t.Status == status);

            if (!string.IsNullOrEmpty(province))
                query = query.Where(t => t.Province == province);

            if (!string.IsNullOrEmpty(department))
                query = query.Where(t => t.DepartmentCategory == department);

            if (!string.IsNullOrEmpty(companyCode))
                query = query.Where(t => t.CompanyCode == companyCode);

            if (fromDate.HasValue)
                query = query.Where(t => t.ClosingDate >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(t => t.ClosingDate <= toDate.Value);

            if (!string.IsNullOrEmpty(search))
            {
                search = search.ToLower();
                query = query.Where(t =>
                    t.TenderNumber.ToLower().Contains(search) ||
                    t.Title.ToLower().Contains(search) ||
                    t.IssuingDepartment.ToLower().Contains(search));
            }

            return await query.OrderByDescending(t => t.ClosingDate).ToListAsync();
        }

        // GET: api/Tenders/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Tender>> GetTender(int id)
        {
            var tender = await _context.Tenders
                .AsNoTracking()
                .Include(t => t.Documents)
                .Include(t => t.TeamMembers)
                .Include(t => t.Activities.OrderByDescending(a => a.CreatedAt).Take(20))
                .Include(t => t.BOQItems.OrderBy(b => b.LineNumber))
                .FirstOrDefaultAsync(t => t.Id == id);

            if (tender == null)
                return NotFound();

            return tender;
        }

        // GET: api/Tenders/stats
        [HttpGet("stats")]
        public async Task<ActionResult<TenderStats>> GetStats()
        {
            var now = DateTime.UtcNow;
            var startOfYear = new DateTime(now.Year, 1, 1);
            var endOfWeek = now.AddDays(7);

            var tenders = await _context.Tenders.AsNoTracking().ToListAsync();
            var complianceDocs = await _context.ComplianceDocuments.AsNoTracking().ToListAsync();

            var stats = new TenderStats
            {
                ActiveTenders = tenders.Count(t => t.Status != "Awarded" && t.Status != "Lost" && t.Status != "Cancelled"),
                ClosingThisWeek = tenders.Count(t => t.ClosingDate >= now && t.ClosingDate <= endOfWeek && t.Status != "Awarded" && t.Status != "Lost" && t.Status != "Cancelled"),
                ComplianceExpiring = complianceDocs.Count(c => c.DaysLeft <= 30 && c.DaysLeft >= 0),
                AwardedYTD = tenders.Count(t => t.Status == "Awarded" && t.AwardDate >= startOfYear),
                LostYTD = tenders.Count(t => t.Status == "Lost" && t.UpdatedAt >= startOfYear),
                TotalValueSubmitted = tenders.Where(t => t.Status == "Submitted" || t.Status == "Evaluation" || t.Status == "Awarded" || t.Status == "Lost").Sum(t => t.EstimatedValue ?? 0),
                TotalValueAwarded = tenders.Where(t => t.Status == "Awarded").Sum(t => t.AwardedValue ?? t.EstimatedValue ?? 0),
                ByProvince = tenders.Where(t => !string.IsNullOrEmpty(t.Province)).GroupBy(t => t.Province!).ToDictionary(g => g.Key, g => g.Count()),
                ByDepartment = tenders.Where(t => !string.IsNullOrEmpty(t.DepartmentCategory)).GroupBy(t => t.DepartmentCategory!).ToDictionary(g => g.Key, g => g.Count()),
                ByStatus = tenders.GroupBy(t => t.Status).ToDictionary(g => g.Key, g => g.Count()),
                ByCompany = tenders.GroupBy(t => t.CompanyCode).ToDictionary(g => g.Key, g => g.Count())
            };

            // Calculate win rate
            var totalDecided = stats.AwardedYTD + stats.LostYTD;
            stats.WinRate = totalDecided > 0 ? (decimal)stats.AwardedYTD / totalDecided * 100 : 0;

            return stats;
        }

        // GET: api/Tenders/calendar
        [HttpGet("calendar")]
        public async Task<ActionResult<IEnumerable<object>>> GetCalendarEvents(
            [FromQuery] DateTime? start = null,
            [FromQuery] DateTime? end = null)
        {
            start ??= DateTime.UtcNow.AddMonths(-1);
            end ??= DateTime.UtcNow.AddMonths(3);

            var tenders = await _context.Tenders
                .AsNoTracking()
                .Where(t => t.ClosingDate >= start && t.ClosingDate <= end)
                .ToListAsync();

            var events = new List<object>();

            foreach (var t in tenders)
            {
                // Closing date
                events.Add(new
                {
                    id = $"close-{t.Id}",
                    tenderId = t.Id,
                    title = $"CLOSE: {t.TenderNumber}",
                    start = t.ClosingDate,
                    type = "closing",
                    companyCode = t.CompanyCode,
                    status = t.Status
                });

                // Briefing date
                if (t.CompulsoryBriefingDate.HasValue)
                {
                    events.Add(new
                    {
                        id = $"brief-{t.Id}",
                        tenderId = t.Id,
                        title = $"BRIEFING: {t.TenderNumber}",
                        start = t.CompulsoryBriefingDate.Value,
                        type = "briefing",
                        companyCode = t.CompanyCode,
                        venue = t.BriefingVenue
                    });
                }

                // Site visit
                if (t.SiteVisitDate.HasValue)
                {
                    events.Add(new
                    {
                        id = $"site-{t.Id}",
                        tenderId = t.Id,
                        title = $"SITE VISIT: {t.TenderNumber}",
                        start = t.SiteVisitDate.Value,
                        type = "siteVisit",
                        companyCode = t.CompanyCode
                    });
                }

                // Clarification deadline
                if (t.ClarificationDeadline.HasValue)
                {
                    events.Add(new
                    {
                        id = $"clarify-{t.Id}",
                        tenderId = t.Id,
                        title = $"CLARIFICATION: {t.TenderNumber}",
                        start = t.ClarificationDeadline.Value,
                        type = "clarification",
                        companyCode = t.CompanyCode
                    });
                }

                // Evaluation date
                if (t.EvaluationDate.HasValue)
                {
                    events.Add(new
                    {
                        id = $"eval-{t.Id}",
                        tenderId = t.Id,
                        title = $"EVALUATION: {t.TenderNumber}",
                        start = t.EvaluationDate.Value,
                        type = "evaluation",
                        companyCode = t.CompanyCode
                    });
                }
            }

            return events;
        }

        // POST: api/Tenders
        [HttpPost]
        public async Task<ActionResult<Tender>> CreateTender([FromBody] CreateTenderRequest request)
        {
            var tender = new Tender
            {
                TenderNumber = request.TenderNumber,
                Title = request.Title,
                Description = request.Description,
                IssuingDepartment = request.IssuingDepartment,
                DepartmentCategory = request.DepartmentCategory,
                Province = request.Province,
                ContactPerson = request.ContactPerson,
                ContactEmail = request.ContactEmail,
                ContactPhone = request.ContactPhone,
                CompanyCode = request.CompanyCode,
                EstimatedValue = request.EstimatedValue,
                EvaluationCriteria = request.EvaluationCriteria,
                PublishedDate = request.PublishedDate,
                CompulsoryBriefingDate = request.CompulsoryBriefingDate,
                BriefingVenue = request.BriefingVenue,
                SiteVisitDate = request.SiteVisitDate,
                ClarificationDeadline = request.ClarificationDeadline,
                ClosingDate = request.ClosingDate,
                EvaluationDate = request.EvaluationDate,
                Status = "Draft",
                WorkflowStatus = "Draft",
                Priority = request.Priority ?? "Medium",
                CreatedByUserId = request.CreatedByUserId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Tenders.Add(tender);

            // Add activity
            _context.TenderActivities.Add(new TenderActivity
            {
                Tender = tender,
                ActivityType = "Created",
                Description = $"Tender created: {tender.Title}",
                UserId = request.CreatedByUserId,
                UserName = request.CreatedByUserName
            });

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTender), new { id = tender.Id }, tender);
        }

        // PUT: api/Tenders/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTender(int id, [FromBody] UpdateTenderRequest request)
        {
            var tender = await _context.Tenders.FindAsync(id);
            if (tender == null)
                return NotFound();

            tender.TenderNumber = request.TenderNumber ?? tender.TenderNumber;
            tender.Title = request.Title ?? tender.Title;
            tender.Description = request.Description ?? tender.Description;
            tender.IssuingDepartment = request.IssuingDepartment ?? tender.IssuingDepartment;
            tender.DepartmentCategory = request.DepartmentCategory ?? tender.DepartmentCategory;
            tender.Province = request.Province ?? tender.Province;
            tender.ContactPerson = request.ContactPerson ?? tender.ContactPerson;
            tender.ContactEmail = request.ContactEmail ?? tender.ContactEmail;
            tender.ContactPhone = request.ContactPhone ?? tender.ContactPhone;
            tender.EstimatedValue = request.EstimatedValue ?? tender.EstimatedValue;
            tender.EvaluationCriteria = request.EvaluationCriteria ?? tender.EvaluationCriteria;
            tender.CompulsoryBriefingDate = request.CompulsoryBriefingDate ?? tender.CompulsoryBriefingDate;
            tender.BriefingVenue = request.BriefingVenue ?? tender.BriefingVenue;
            tender.SiteVisitDate = request.SiteVisitDate ?? tender.SiteVisitDate;
            tender.ClarificationDeadline = request.ClarificationDeadline ?? tender.ClarificationDeadline;
            tender.ClosingDate = request.ClosingDate ?? tender.ClosingDate;
            tender.EvaluationDate = request.EvaluationDate ?? tender.EvaluationDate;
            tender.Priority = request.Priority ?? tender.Priority;
            tender.RiskScore = request.RiskScore ?? tender.RiskScore;
            tender.RiskNotes = request.RiskNotes ?? tender.RiskNotes;
            tender.UpdatedAt = DateTime.UtcNow;

            // Add activity
            _context.TenderActivities.Add(new TenderActivity
            {
                TenderId = id,
                ActivityType = "Updated",
                Description = "Tender details updated",
                UserId = request.UpdatedByUserId,
                UserName = request.UpdatedByUserName
            });

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/Tenders/5/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusRequest request)
        {
            var tender = await _context.Tenders.FindAsync(id);
            if (tender == null)
                return NotFound();

            var oldStatus = tender.Status;
            tender.Status = request.Status;
            tender.UpdatedAt = DateTime.UtcNow;

            // Handle specific status transitions
            if (request.Status == "Submitted")
            {
                tender.SubmittedAt = DateTime.UtcNow;
                tender.SubmissionMethod = request.SubmissionMethod;
                tender.SubmissionReference = request.SubmissionReference;
            }
            else if (request.Status == "Awarded")
            {
                tender.AwardDate = DateTime.UtcNow;
                tender.AwardedValue = request.AwardedValue;
                tender.ResultNotes = request.Notes;
            }
            else if (request.Status == "Lost")
            {
                tender.LossReason = request.LossReason;
                tender.ResultNotes = request.Notes;
            }

            // Add activity
            _context.TenderActivities.Add(new TenderActivity
            {
                TenderId = id,
                ActivityType = "StatusChange",
                Description = $"Status changed from {oldStatus} to {request.Status}",
                UserId = request.UserId,
                UserName = request.UserName,
                Metadata = request.Notes
            });

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/Tenders/5/workflow
        [HttpPut("{id}/workflow")]
        public async Task<IActionResult> UpdateWorkflow(int id, [FromBody] UpdateWorkflowRequest request)
        {
            var tender = await _context.Tenders.FindAsync(id);
            if (tender == null)
                return NotFound();

            var oldWorkflow = tender.WorkflowStatus;
            tender.WorkflowStatus = request.WorkflowStatus;
            tender.UpdatedAt = DateTime.UtcNow;

            // Add activity
            _context.TenderActivities.Add(new TenderActivity
            {
                TenderId = id,
                ActivityType = "WorkflowChange",
                Description = $"Workflow status changed from {oldWorkflow} to {request.WorkflowStatus}",
                UserId = request.UserId,
                UserName = request.UserName
            });

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/Tenders/5/team
        [HttpPost("{id}/team")]
        public async Task<ActionResult<TenderTeamMember>> AddTeamMember(int id, [FromBody] AddTeamMemberRequest request)
        {
            var tender = await _context.Tenders.FindAsync(id);
            if (tender == null)
                return NotFound();

            var member = new TenderTeamMember
            {
                TenderId = id,
                UserId = request.UserId,
                UserName = request.UserName,
                Role = request.Role,
                Status = "Pending",
                AssignedAt = DateTime.UtcNow
            };

            _context.TenderTeamMembers.Add(member);

            // Add activity
            _context.TenderActivities.Add(new TenderActivity
            {
                TenderId = id,
                ActivityType = "TeamAssignment",
                Description = $"{request.UserName} assigned as {request.Role}",
                UserId = request.AssignedByUserId,
                UserName = request.AssignedByUserName
            });

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTender), new { id }, member);
        }

        // PUT: api/Tenders/team/5
        [HttpPut("team/{memberId}")]
        public async Task<IActionResult> UpdateTeamMember(int memberId, [FromBody] UpdateTeamMemberRequest request)
        {
            var member = await _context.TenderTeamMembers.FindAsync(memberId);
            if (member == null)
                return NotFound();

            member.Status = request.Status;
            member.Notes = request.Notes;

            if (request.Status == "Completed" || request.Status == "Approved")
            {
                member.CompletedAt = DateTime.UtcNow;
            }

            // Add activity
            _context.TenderActivities.Add(new TenderActivity
            {
                TenderId = member.TenderId,
                ActivityType = "TeamStatusUpdate",
                Description = $"{member.UserName} ({member.Role}): {request.Status}",
                UserId = request.UpdatedByUserId,
                UserName = request.UpdatedByUserName
            });

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/Tenders/5/documents
        [HttpPost("{id}/documents")]
        public async Task<ActionResult<TenderDocument>> UploadDocument(int id, [FromForm] IFormFile file, [FromForm] string documentType, [FromForm] int uploadedByUserId, [FromForm] string? uploadedByUserName, [FromForm] string? notes)
        {
            var tender = await _context.Tenders.FindAsync(id);
            if (tender == null)
                return NotFound();

            // Create directory if not exists
            var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads", "tenders", id.ToString());
            Directory.CreateDirectory(uploadsPath);

            // Save file
            var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{file.FileName}";
            var filePath = Path.Combine(uploadsPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var doc = new TenderDocument
            {
                TenderId = id,
                FileName = file.FileName,
                FilePath = filePath,
                DocumentType = documentType,
                Version = "1.0",
                FileSize = file.Length,
                MimeType = file.ContentType,
                UploadedByUserId = uploadedByUserId,
                UploadedByUserName = uploadedByUserName,
                Notes = notes,
                UploadedAt = DateTime.UtcNow
            };

            _context.TenderDocuments.Add(doc);

            // Add activity
            _context.TenderActivities.Add(new TenderActivity
            {
                TenderId = id,
                ActivityType = "DocumentUpload",
                Description = $"Document uploaded: {file.FileName} ({documentType})",
                UserId = uploadedByUserId,
                UserName = uploadedByUserName
            });

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTender), new { id }, doc);
        }

        // GET: api/Tenders/documents/5/download
        [HttpGet("documents/{docId}/download")]
        public async Task<IActionResult> DownloadDocument(int docId)
        {
            var doc = await _context.TenderDocuments.FindAsync(docId);
            if (doc == null || string.IsNullOrEmpty(doc.FilePath))
                return NotFound();

            if (!System.IO.File.Exists(doc.FilePath))
                return NotFound("File not found on server");

            var bytes = await System.IO.File.ReadAllBytesAsync(doc.FilePath);
            return File(bytes, doc.MimeType ?? "application/octet-stream", doc.FileName);
        }

        // DELETE: api/Tenders/documents/5
        [HttpDelete("documents/{docId}")]
        public async Task<IActionResult> DeleteDocument(int docId)
        {
            var doc = await _context.TenderDocuments.FindAsync(docId);
            if (doc == null)
                return NotFound();

            // Delete file
            if (!string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath))
            {
                System.IO.File.Delete(doc.FilePath);
            }

            _context.TenderDocuments.Remove(doc);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/Tenders/5/boq
        [HttpPost("{id}/boq")]
        public async Task<ActionResult<TenderBOQItem>> AddBOQItem(int id, [FromBody] AddBOQItemRequest request)
        {
            var tender = await _context.Tenders.FindAsync(id);
            if (tender == null)
                return NotFound();

            var maxLineNumber = await _context.TenderBOQItems
                .Where(b => b.TenderId == id)
                .MaxAsync(b => (int?)b.LineNumber) ?? 0;

            var item = new TenderBOQItem
            {
                TenderId = id,
                LineNumber = maxLineNumber + 1,
                ItemCode = request.ItemCode,
                Description = request.Description,
                Unit = request.Unit,
                Quantity = request.Quantity,
                UnitCost = request.UnitCost,
                UnitPrice = request.UnitPrice,
                MarginPercent = request.UnitCost.HasValue && request.UnitCost > 0
                    ? (request.UnitPrice - request.UnitCost.Value) / request.UnitCost.Value * 100
                    : null,
                IsBelowCost = request.UnitCost.HasValue && request.UnitPrice < request.UnitCost.Value,
                Notes = request.Notes
            };

            _context.TenderBOQItems.Add(item);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTender), new { id }, item);
        }

        // PUT: api/Tenders/boq/5
        [HttpPut("boq/{itemId}")]
        public async Task<IActionResult> UpdateBOQItem(int itemId, [FromBody] UpdateBOQItemRequest request)
        {
            var item = await _context.TenderBOQItems.FindAsync(itemId);
            if (item == null)
                return NotFound();

            item.ItemCode = request.ItemCode ?? item.ItemCode;
            item.Description = request.Description ?? item.Description;
            item.Unit = request.Unit ?? item.Unit;
            item.Quantity = request.Quantity ?? item.Quantity;
            item.UnitCost = request.UnitCost ?? item.UnitCost;
            item.UnitPrice = request.UnitPrice ?? item.UnitPrice;
            item.Notes = request.Notes ?? item.Notes;

            // Recalculate margin
            if (item.UnitCost.HasValue && item.UnitCost > 0)
            {
                item.MarginPercent = (item.UnitPrice - item.UnitCost.Value) / item.UnitCost.Value * 100;
                item.IsBelowCost = item.UnitPrice < item.UnitCost.Value;
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Tenders/boq/5
        [HttpDelete("boq/{itemId}")]
        public async Task<IActionResult> DeleteBOQItem(int itemId)
        {
            var item = await _context.TenderBOQItems.FindAsync(itemId);
            if (item == null)
                return NotFound();

            _context.TenderBOQItems.Remove(item);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Tenders/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTender(int id)
        {
            var tender = await _context.Tenders
                .Include(t => t.Documents)
                .Include(t => t.TeamMembers)
                .Include(t => t.Activities)
                .Include(t => t.BOQItems)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (tender == null)
                return NotFound();

            // Delete associated files
            foreach (var doc in tender.Documents)
            {
                if (!string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath))
                {
                    System.IO.File.Delete(doc.FilePath);
                }
            }

            _context.Tenders.Remove(tender);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ==================== TENDER REMINDERS ====================

        // GET: api/Tenders/reminders
        [HttpGet("reminders")]
        public async Task<ActionResult<IEnumerable<TenderReminder>>> GetReminders([FromQuery] int? tenderId = null)
        {
            var query = _context.TenderReminders
                .AsNoTracking()
                .Include(r => r.Tender)
                .Where(r => r.IsActive)
                .AsQueryable();

            if (tenderId.HasValue)
                query = query.Where(r => r.TenderId == tenderId.Value);

            var reminders = await query
                .OrderBy(r => r.EventDate)
                .Select(r => new {
                    r.Id,
                    r.TenderId,
                    TenderTitle = r.Tender!.Title,
                    TenderNumber = r.Tender.TenderNumber,
                    r.EventType,
                    r.EventDate,
                    r.DaysBefore,
                    r.EmailRecipients,
                    r.Notes,
                    r.IsSent,
                    r.SentAt,
                    r.IsActive,
                    r.CreatedByUserId,
                    r.CreatedByUserName,
                    r.CreatedAt,
                    ReminderDate = r.EventDate.AddDays(-r.DaysBefore),
                    IsDue = r.EventDate.AddDays(-r.DaysBefore) <= DateTime.UtcNow && !r.IsSent
                })
                .ToListAsync();

            return Ok(reminders);
        }

        // GET: api/Tenders/reminders/5
        [HttpGet("reminders/{id}")]
        public async Task<ActionResult> GetReminder(int id)
        {
            var reminder = await _context.TenderReminders
                .AsNoTracking()
                .Include(r => r.Tender)
                .Where(r => r.Id == id)
                .Select(r => new {
                    r.Id,
                    r.TenderId,
                    TenderTitle = r.Tender!.Title,
                    TenderNumber = r.Tender.TenderNumber,
                    r.EventType,
                    r.EventDate,
                    r.DaysBefore,
                    r.EmailRecipients,
                    r.Notes,
                    r.IsSent,
                    r.SentAt,
                    r.IsActive,
                    r.CreatedByUserId,
                    r.CreatedByUserName,
                    r.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (reminder == null) return NotFound();
            return Ok(reminder);
        }

        // POST: api/Tenders/reminders
        [HttpPost("reminders")]
        public async Task<ActionResult<TenderReminder>> CreateReminder([FromBody] CreateReminderRequest request)
        {
            var tender = await _context.Tenders.FindAsync(request.TenderId);
            if (tender == null) return NotFound("Tender not found");

            // Resolve event date from tender
            DateTime? eventDate = request.EventType switch
            {
                "ClosingDate" => tender.ClosingDate,
                "Briefing" => tender.CompulsoryBriefingDate,
                "SiteVisit" => tender.SiteVisitDate,
                "Clarification" => tender.ClarificationDeadline,
                "Evaluation" => tender.EvaluationDate,
                _ => null
            };

            if (!eventDate.HasValue)
                return BadRequest($"Tender does not have a date set for {request.EventType}");

            var reminder = new TenderReminder
            {
                TenderId = request.TenderId,
                EventType = request.EventType,
                EventDate = eventDate.Value,
                DaysBefore = request.DaysBefore,
                EmailRecipients = request.EmailRecipients,
                Notes = request.Notes,
                CreatedByUserId = request.CreatedByUserId,
                CreatedByUserName = request.CreatedByUserName,
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
                IsSent = false
            };

            _context.TenderReminders.Add(reminder);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetReminder), new { id = reminder.Id }, reminder);
        }

        // PUT: api/Tenders/reminders/5
        [HttpPut("reminders/{id}")]
        public async Task<IActionResult> UpdateReminder(int id, [FromBody] UpdateReminderRequest request)
        {
            var reminder = await _context.TenderReminders.FindAsync(id);
            if (reminder == null) return NotFound();

            if (request.DaysBefore.HasValue)
                reminder.DaysBefore = request.DaysBefore.Value;
            if (request.EmailRecipients != null)
                reminder.EmailRecipients = request.EmailRecipients;
            if (request.Notes != null)
                reminder.Notes = request.Notes;
            if (request.IsActive.HasValue)
                reminder.IsActive = request.IsActive.Value;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/Tenders/reminders/5
        [HttpDelete("reminders/{id}")]
        public async Task<IActionResult> DeleteReminder(int id)
        {
            var reminder = await _context.TenderReminders.FindAsync(id);
            if (reminder == null) return NotFound();

            _context.TenderReminders.Remove(reminder);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/Tenders/reminders/check-and-send
        [HttpPost("reminders/check-and-send")]
        public async Task<ActionResult> CheckAndSendReminders()
        {
            var now = DateTime.UtcNow;
            var dueReminders = await _context.TenderReminders
                .Include(r => r.Tender)
                .Where(r => r.IsActive && !r.IsSent && r.EventDate.AddDays(-r.DaysBefore) <= now)
                .ToListAsync();

            if (!dueReminders.Any())
                return Ok(new { sent = 0, message = "No reminders due" });

            var smtpHost = _configuration["AIEmail:SmtpHost"] ?? "mail.promedtechnologies.co.za";
            var smtpPort = int.TryParse(_configuration["AIEmail:SmtpPort"], out var port) ? port : 587;
            var senderEmail = _configuration["AIEmail:SenderEmail"] ?? "ai@promedtechnologies.co.za";
            var senderName = _configuration["AIEmail:SenderName"] ?? "Welly - ProMed AI Assistant";
            var senderPassword = _configuration["AIEmail:SenderPassword"] ?? "";
            var enableSsl = bool.TryParse(_configuration["AIEmail:EnableSsl"], out var ssl) ? ssl : true;

            int sentCount = 0;
            var errors = new List<string>();

            foreach (var reminder in dueReminders)
            {
                try
                {
                    if (string.IsNullOrWhiteSpace(reminder.EmailRecipients)) continue;

                    var recipients = reminder.EmailRecipients.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    if (recipients.Length == 0) continue;

                    var eventLabel = reminder.EventType switch
                    {
                        "ClosingDate" => "Closing Date",
                        "Briefing" => "Compulsory Briefing",
                        "SiteVisit" => "Site Visit",
                        "Clarification" => "Clarification Deadline",
                        "Evaluation" => "Evaluation Date",
                        _ => reminder.EventType
                    };

                    var daysUntil = (reminder.EventDate - now).Days;
                    var urgency = daysUntil <= 1 ? "🔴 URGENT" : daysUntil <= 3 ? "🟡 UPCOMING" : "🔵 REMINDER";

                    var htmlBody = $@"
<div style=""font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;"">
    <div style=""background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px 30px; border-radius: 8px 8px 0 0;"">
        <h2 style=""color: white; margin: 0; font-size: 18px;"">📋 Tender Reminder - {urgency}</h2>
    </div>
    <div style=""padding: 25px 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;"">
        <h3 style=""color: #1f2937; margin: 0 0 15px 0;"">{reminder.Tender?.Title ?? "Tender"}</h3>
        <table style=""width: 100%; border-collapse: collapse;"">
            <tr><td style=""padding: 8px 0; color: #6b7280; width: 140px;"">Tender Number:</td><td style=""padding: 8px 0; color: #1f2937; font-weight: 600;"">{reminder.Tender?.TenderNumber}</td></tr>
            <tr><td style=""padding: 8px 0; color: #6b7280;"">Event:</td><td style=""padding: 8px 0; color: #1f2937; font-weight: 600;"">{eventLabel}</td></tr>
            <tr><td style=""padding: 8px 0; color: #6b7280;"">Event Date:</td><td style=""padding: 8px 0; color: #1f2937; font-weight: 600;"">{reminder.EventDate:dddd, dd MMMM yyyy}</td></tr>
            <tr><td style=""padding: 8px 0; color: #6b7280;"">Days Until Event:</td><td style=""padding: 8px 0; color: {(daysUntil <= 1 ? "#ef4444" : daysUntil <= 3 ? "#f59e0b" : "#3b82f6")}; font-weight: 700; font-size: 16px;"">{Math.Max(0, daysUntil)} day{(daysUntil != 1 ? "s" : "")}</td></tr>
            {(string.IsNullOrEmpty(reminder.Notes) ? "" : $"<tr><td style=\"padding: 8px 0; color: #6b7280;\">Notes:</td><td style=\"padding: 8px 0; color: #1f2937;\">{reminder.Notes}</td></tr>")}
        </table>
    </div>
    <div style=""padding: 15px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;"">
        <p style=""margin: 0;"">Sent via <strong>Welly AI Assistant</strong> • ProMed Technologies Tender Management</p>
        <p style=""margin: 4px 0 0 0;"">Set by {reminder.CreatedByUserName ?? "System"} on {reminder.CreatedAt:dd MMM yyyy}</p>
    </div>
</div>";

                    using var message = new MailMessage();
                    message.From = new MailAddress(senderEmail, senderName);
                    foreach (var recipient in recipients)
                    {
                        message.To.Add(recipient);
                    }
                    message.Subject = $"{urgency} Tender Reminder: {eventLabel} - {reminder.Tender?.TenderNumber ?? "N/A"}";
                    message.Body = htmlBody;
                    message.IsBodyHtml = true;

                    using var client = new SmtpClient(smtpHost, smtpPort);
                    client.EnableSsl = enableSsl;
                    client.UseDefaultCredentials = false;
                    client.Credentials = new NetworkCredential(senderEmail, senderPassword);

                    await client.SendMailAsync(message);

                    reminder.IsSent = true;
                    reminder.SentAt = DateTime.UtcNow;
                    sentCount++;

                    _logger.LogInformation("Tender reminder sent for {TenderNumber} - {EventType} to {Recipients}",
                        reminder.Tender?.TenderNumber, reminder.EventType, reminder.EmailRecipients);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send tender reminder {ReminderId}", reminder.Id);
                    errors.Add($"Reminder {reminder.Id}: {ex.Message}");
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { sent = sentCount, total = dueReminders.Count, errors = errors.Any() ? errors : null });
        }

        // POST: api/Tenders/reminders/send-now/5
        [HttpPost("reminders/send-now/{id}")]
        public async Task<ActionResult> SendReminderNow(int id)
        {
            var reminder = await _context.TenderReminders
                .Include(r => r.Tender)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (reminder == null) return NotFound();
            if (string.IsNullOrWhiteSpace(reminder.EmailRecipients))
                return BadRequest("No email recipients set for this reminder");

            var smtpHost = _configuration["AIEmail:SmtpHost"] ?? "mail.promedtechnologies.co.za";
            var smtpPort = int.TryParse(_configuration["AIEmail:SmtpPort"], out var port) ? port : 587;
            var senderEmail = _configuration["AIEmail:SenderEmail"] ?? "ai@promedtechnologies.co.za";
            var senderName = _configuration["AIEmail:SenderName"] ?? "Welly - ProMed AI Assistant";
            var senderPassword = _configuration["AIEmail:SenderPassword"] ?? "";
            var enableSsl = bool.TryParse(_configuration["AIEmail:EnableSsl"], out var ssl) ? ssl : true;

            var eventLabel = reminder.EventType switch
            {
                "ClosingDate" => "Closing Date",
                "Briefing" => "Compulsory Briefing",
                "SiteVisit" => "Site Visit",
                "Clarification" => "Clarification Deadline",
                "Evaluation" => "Evaluation Date",
                _ => reminder.EventType
            };

            var daysUntil = (reminder.EventDate - DateTime.UtcNow).Days;

            var htmlBody = $@"
<div style=""font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;"">
    <div style=""background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px 30px; border-radius: 8px 8px 0 0;"">
        <h2 style=""color: white; margin: 0; font-size: 18px;"">📋 Tender Reminder</h2>
    </div>
    <div style=""padding: 25px 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;"">
        <h3 style=""color: #1f2937; margin: 0 0 15px 0;"">{reminder.Tender?.Title ?? "Tender"}</h3>
        <table style=""width: 100%; border-collapse: collapse;"">
            <tr><td style=""padding: 8px 0; color: #6b7280; width: 140px;"">Tender Number:</td><td style=""padding: 8px 0; color: #1f2937; font-weight: 600;"">{reminder.Tender?.TenderNumber}</td></tr>
            <tr><td style=""padding: 8px 0; color: #6b7280;"">Event:</td><td style=""padding: 8px 0; color: #1f2937; font-weight: 600;"">{eventLabel}</td></tr>
            <tr><td style=""padding: 8px 0; color: #6b7280;"">Event Date:</td><td style=""padding: 8px 0; color: #1f2937; font-weight: 600;"">{reminder.EventDate:dddd, dd MMMM yyyy}</td></tr>
            <tr><td style=""padding: 8px 0; color: #6b7280;"">Days Until Event:</td><td style=""padding: 8px 0; color: #1f2937; font-weight: 600;"">{Math.Max(0, daysUntil)} day{(daysUntil != 1 ? "s" : "")}</td></tr>
            {(string.IsNullOrEmpty(reminder.Notes) ? "" : $"<tr><td style=\"padding: 8px 0; color: #6b7280;\">Notes:</td><td style=\"padding: 8px 0; color: #1f2937;\">{reminder.Notes}</td></tr>")}
        </table>
    </div>
    <div style=""padding: 15px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;"">
        <p style=""margin: 0;"">Sent via <strong>Welly AI Assistant</strong> • ProMed Technologies Tender Management</p>
    </div>
</div>";

            try
            {
                var recipients = reminder.EmailRecipients.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                using var message = new MailMessage();
                message.From = new MailAddress(senderEmail, senderName);
                foreach (var recipient in recipients)
                {
                    message.To.Add(recipient);
                }
                message.Subject = $"Tender Reminder: {eventLabel} - {reminder.Tender?.TenderNumber ?? "N/A"}";
                message.Body = htmlBody;
                message.IsBodyHtml = true;

                using var client = new SmtpClient(smtpHost, smtpPort);
                client.EnableSsl = enableSsl;
                client.UseDefaultCredentials = false;
                client.Credentials = new NetworkCredential(senderEmail, senderPassword);

                await client.SendMailAsync(message);

                reminder.IsSent = true;
                reminder.SentAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Reminder email sent to {reminder.EmailRecipients}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send reminder {ReminderId} manually", id);
                return StatusCode(500, new { success = false, message = $"Failed to send email: {ex.Message}" });
            }
        }
    }

    // Request DTOs
    public class CreateTenderRequest
    {
        public string TenderNumber { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string IssuingDepartment { get; set; } = string.Empty;
        public string? DepartmentCategory { get; set; }
        public string? Province { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactEmail { get; set; }
        public string? ContactPhone { get; set; }
        public string CompanyCode { get; set; } = string.Empty;
        public decimal? EstimatedValue { get; set; }
        public string? EvaluationCriteria { get; set; }
        public DateTime? PublishedDate { get; set; }
        public DateTime? CompulsoryBriefingDate { get; set; }
        public string? BriefingVenue { get; set; }
        public DateTime? SiteVisitDate { get; set; }
        public DateTime? ClarificationDeadline { get; set; }
        public DateTime ClosingDate { get; set; }
        public DateTime? EvaluationDate { get; set; }
        public string? Priority { get; set; }
        public int CreatedByUserId { get; set; }
        public string? CreatedByUserName { get; set; }
    }

    public class UpdateTenderRequest
    {
        public string? TenderNumber { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? IssuingDepartment { get; set; }
        public string? DepartmentCategory { get; set; }
        public string? Province { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactEmail { get; set; }
        public string? ContactPhone { get; set; }
        public decimal? EstimatedValue { get; set; }
        public string? EvaluationCriteria { get; set; }
        public DateTime? CompulsoryBriefingDate { get; set; }
        public string? BriefingVenue { get; set; }
        public DateTime? SiteVisitDate { get; set; }
        public DateTime? ClarificationDeadline { get; set; }
        public DateTime? ClosingDate { get; set; }
        public DateTime? EvaluationDate { get; set; }
        public string? Priority { get; set; }
        public int? RiskScore { get; set; }
        public string? RiskNotes { get; set; }
        public int? UpdatedByUserId { get; set; }
        public string? UpdatedByUserName { get; set; }
    }

    public class UpdateStatusRequest
    {
        public string Status { get; set; } = string.Empty;
        public string? SubmissionMethod { get; set; }
        public string? SubmissionReference { get; set; }
        public decimal? AwardedValue { get; set; }
        public string? LossReason { get; set; }
        public string? Notes { get; set; }
        public int? UserId { get; set; }
        public string? UserName { get; set; }
    }

    public class UpdateWorkflowRequest
    {
        public string WorkflowStatus { get; set; } = string.Empty;
        public int? UserId { get; set; }
        public string? UserName { get; set; }
    }

    public class AddTeamMemberRequest
    {
        public int? UserId { get; set; }
        public string? UserName { get; set; }
        public string Role { get; set; } = string.Empty;
        public int? AssignedByUserId { get; set; }
        public string? AssignedByUserName { get; set; }
    }

    public class UpdateTeamMemberRequest
    {
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public int? UpdatedByUserId { get; set; }
        public string? UpdatedByUserName { get; set; }
    }

    public class AddBOQItemRequest
    {
        public string? ItemCode { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? Unit { get; set; }
        public decimal Quantity { get; set; }
        public decimal? UnitCost { get; set; }
        public decimal UnitPrice { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateBOQItemRequest
    {
        public string? ItemCode { get; set; }
        public string? Description { get; set; }
        public string? Unit { get; set; }
        public decimal? Quantity { get; set; }
        public decimal? UnitCost { get; set; }
        public decimal? UnitPrice { get; set; }
        public string? Notes { get; set; }
    }

    public class CreateReminderRequest
    {
        public int TenderId { get; set; }
        public string EventType { get; set; } = string.Empty;  // ClosingDate, Briefing, SiteVisit, Clarification, Evaluation
        public int DaysBefore { get; set; } = 3;
        public string? EmailRecipients { get; set; }  // Comma-separated
        public string? Notes { get; set; }
        public int CreatedByUserId { get; set; }
        public string? CreatedByUserName { get; set; }
    }

    public class UpdateReminderRequest
    {
        public int? DaysBefore { get; set; }
        public string? EmailRecipients { get; set; }
        public string? Notes { get; set; }
        public bool? IsActive { get; set; }
    }
}
