using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Tenders;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TendersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;

        public TendersController(ApplicationDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
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

            var tenders = await _context.Tenders.ToListAsync();
            var complianceDocs = await _context.ComplianceDocuments.ToListAsync();

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
}
