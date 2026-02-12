using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Tenders;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ComplianceController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;

        public ComplianceController(ApplicationDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // GET: api/Compliance
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ComplianceDocument>>> GetDocuments(
            [FromQuery] string? companyCode = null,
            [FromQuery] string? documentType = null,
            [FromQuery] string? status = null)
        {
            var query = _context.ComplianceDocuments.AsQueryable();

            if (!string.IsNullOrEmpty(companyCode))
                query = query.Where(c => c.CompanyCode == companyCode);

            if (!string.IsNullOrEmpty(documentType))
                query = query.Where(c => c.DocumentType == documentType);

            // Filter by computed status
            if (!string.IsNullOrEmpty(status))
            {
                var now = DateTime.UtcNow;
                query = status switch
                {
                    "Valid" => query.Where(c => c.ExpiryDate > now.AddDays(60)),
                    "Expiring" => query.Where(c => c.ExpiryDate <= now.AddDays(60) && c.ExpiryDate > now.AddDays(30)),
                    "Warning" => query.Where(c => c.ExpiryDate <= now.AddDays(30) && c.ExpiryDate > now),
                    "Expired" => query.Where(c => c.ExpiryDate <= now),
                    _ => query
                };
            }

            return await query.OrderBy(c => c.ExpiryDate).ToListAsync();
        }

        // GET: api/Compliance/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ComplianceDocument>> GetDocument(int id)
        {
            var doc = await _context.ComplianceDocuments.FindAsync(id);
            if (doc == null)
                return NotFound();

            return doc;
        }

        // GET: api/Compliance/expiring
        [HttpGet("expiring")]
        public async Task<ActionResult<IEnumerable<ComplianceDocument>>> GetExpiringDocuments(
            [FromQuery] int daysAhead = 45)
        {
            var cutoff = DateTime.UtcNow.AddDays(daysAhead);
            var now = DateTime.UtcNow;

            return await _context.ComplianceDocuments
                .Where(c => c.ExpiryDate <= cutoff && c.ExpiryDate >= now)
                .OrderBy(c => c.ExpiryDate)
                .ToListAsync();
        }

        // GET: api/Compliance/expired
        [HttpGet("expired")]
        public async Task<ActionResult<IEnumerable<ComplianceDocument>>> GetExpiredDocuments()
        {
            return await _context.ComplianceDocuments
                .Where(c => c.ExpiryDate < DateTime.UtcNow)
                .OrderBy(c => c.ExpiryDate)
                .ToListAsync();
        }

        // GET: api/Compliance/summary
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary()
        {
            var now = DateTime.UtcNow;
            var docs = await _context.ComplianceDocuments.ToListAsync();

            var summary = new
            {
                Total = docs.Count,
                Valid = docs.Count(d => d.ExpiryDate > now.AddDays(60)),
                Expiring = docs.Count(d => d.ExpiryDate <= now.AddDays(60) && d.ExpiryDate > now.AddDays(30)),
                Warning = docs.Count(d => d.ExpiryDate <= now.AddDays(30) && d.ExpiryDate > now),
                Expired = docs.Count(d => d.ExpiryDate <= now),
                ByCompany = docs.GroupBy(d => d.CompanyCode).Select(g => new
                {
                    Company = g.Key,
                    Total = g.Count(),
                    Valid = g.Count(d => d.ExpiryDate > now.AddDays(60)),
                    Expiring = g.Count(d => d.ExpiryDate <= now.AddDays(60) && d.ExpiryDate > now),
                    Expired = g.Count(d => d.ExpiryDate <= now)
                }).ToList(),
                ByType = docs.GroupBy(d => d.DocumentType).Select(g => new
                {
                    Type = g.Key,
                    Total = g.Count(),
                    Valid = g.Count(d => d.ExpiryDate > now.AddDays(60)),
                    Expiring = g.Count(d => d.ExpiryDate <= now.AddDays(60) && d.ExpiryDate > now),
                    Expired = g.Count(d => d.ExpiryDate <= now)
                }).ToList()
            };

            return summary;
        }

        // GET: api/Compliance/alerts
        [HttpGet("alerts")]
        public async Task<ActionResult<IEnumerable<ComplianceAlert>>> GetAlerts(
            [FromQuery] string? companyCode = null,
            [FromQuery] bool? acknowledged = null)
        {
            var query = _context.ComplianceAlerts
                .Include(a => a.ComplianceDocument)
                .AsQueryable();

            if (!string.IsNullOrEmpty(companyCode))
                query = query.Where(a => a.ComplianceDocument != null && a.ComplianceDocument.CompanyCode == companyCode);

            if (acknowledged.HasValue)
                query = query.Where(a => a.IsAcknowledged == acknowledged.Value);

            return await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
        }

        // POST: api/Compliance
        [HttpPost]
        public async Task<ActionResult<ComplianceDocument>> CreateDocument([FromForm] CreateComplianceRequest request)
        {
            var doc = new ComplianceDocument
            {
                CompanyCode = request.CompanyCode,
                DocumentType = request.DocumentType,
                DocumentNumber = request.DocumentNumber,
                IssueDate = request.IssueDate,
                ExpiryDate = request.ExpiryDate,
                IssuingAuthority = request.IssuingAuthority,
                Notes = request.Notes,
                UploadedByUserId = request.UploadedByUserId,
                UploadedByUserName = request.UploadedByUserName,
                UploadedAt = DateTime.UtcNow
            };

            // Handle file upload
            if (request.File != null)
            {
                var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads", "compliance", request.CompanyCode);
                Directory.CreateDirectory(uploadsPath);

                var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{request.File.FileName}";
                var filePath = Path.Combine(uploadsPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await request.File.CopyToAsync(stream);
                }

                doc.FileName = request.File.FileName;
                doc.FilePath = filePath;
                doc.FileSize = request.File.Length;
                doc.MimeType = request.File.ContentType;
            }

            _context.ComplianceDocuments.Add(doc);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDocument), new { id = doc.Id }, doc);
        }

        // PUT: api/Compliance/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDocument(int id, [FromBody] UpdateComplianceRequest request)
        {
            var doc = await _context.ComplianceDocuments.FindAsync(id);
            if (doc == null)
                return NotFound();

            doc.DocumentNumber = request.DocumentNumber ?? doc.DocumentNumber;
            doc.IssueDate = request.IssueDate ?? doc.IssueDate;
            doc.ExpiryDate = request.ExpiryDate ?? doc.ExpiryDate;
            doc.IssuingAuthority = request.IssuingAuthority ?? doc.IssuingAuthority;
            doc.Notes = request.Notes ?? doc.Notes;
            doc.UpdatedAt = DateTime.UtcNow;

            // Reset alert flags if expiry date changed
            if (request.ExpiryDate.HasValue)
            {
                doc.Alert45DaysSent = false;
                doc.Alert30DaysSent = false;
                doc.Alert7DaysSent = false;
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/Compliance/5/upload
        [HttpPost("{id}/upload")]
        public async Task<IActionResult> UploadFile(int id, [FromForm] IFormFile file)
        {
            var doc = await _context.ComplianceDocuments.FindAsync(id);
            if (doc == null)
                return NotFound();

            // Delete old file if exists
            if (!string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath))
            {
                System.IO.File.Delete(doc.FilePath);
            }

            var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads", "compliance", doc.CompanyCode);
            Directory.CreateDirectory(uploadsPath);

            var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{file.FileName}";
            var filePath = Path.Combine(uploadsPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            doc.FileName = file.FileName;
            doc.FilePath = filePath;
            doc.FileSize = file.Length;
            doc.MimeType = file.ContentType;
            doc.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/Compliance/5/download
        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadDocument(int id)
        {
            var doc = await _context.ComplianceDocuments.FindAsync(id);
            if (doc == null || string.IsNullOrEmpty(doc.FilePath))
                return NotFound();

            if (!System.IO.File.Exists(doc.FilePath))
                return NotFound("File not found on server");

            var bytes = await System.IO.File.ReadAllBytesAsync(doc.FilePath);
            return File(bytes, doc.MimeType ?? "application/octet-stream", doc.FileName);
        }

        // POST: api/Compliance/alerts/5/acknowledge
        [HttpPost("alerts/{alertId}/acknowledge")]
        public async Task<IActionResult> AcknowledgeAlert(int alertId, [FromBody] AcknowledgeAlertRequest request)
        {
            var alert = await _context.ComplianceAlerts.FindAsync(alertId);
            if (alert == null)
                return NotFound();

            alert.IsAcknowledged = true;
            alert.AcknowledgedByUserId = request.UserId;
            alert.AcknowledgedByUserName = request.UserName;
            alert.AcknowledgedAt = DateTime.UtcNow;
            alert.AcknowledgmentNotes = request.Notes;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/Compliance/check-alerts
        [HttpPost("check-alerts")]
        public async Task<ActionResult<object>> CheckAndSendAlerts()
        {
            var now = DateTime.UtcNow;
            var docs = await _context.ComplianceDocuments.ToListAsync();
            var alertsCreated = new List<ComplianceAlert>();

            foreach (var doc in docs)
            {
                var daysLeft = doc.DaysLeft;

                // 45-day alert
                if (daysLeft <= 45 && daysLeft > 30 && !doc.Alert45DaysSent)
                {
                    var alert = new ComplianceAlert
                    {
                        ComplianceDocumentId = doc.Id,
                        AlertType = "45Day",
                        Message = $"{doc.DocumentType} for {doc.CompanyCode} expires in {daysLeft} days",
                        DaysRemaining = daysLeft,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.ComplianceAlerts.Add(alert);
                    alertsCreated.Add(alert);
                    doc.Alert45DaysSent = true;
                }

                // 30-day alert
                if (daysLeft <= 30 && daysLeft > 7 && !doc.Alert30DaysSent)
                {
                    var alert = new ComplianceAlert
                    {
                        ComplianceDocumentId = doc.Id,
                        AlertType = "30Day",
                        Message = $"URGENT: {doc.DocumentType} for {doc.CompanyCode} expires in {daysLeft} days",
                        DaysRemaining = daysLeft,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.ComplianceAlerts.Add(alert);
                    alertsCreated.Add(alert);
                    doc.Alert30DaysSent = true;
                }

                // 7-day alert
                if (daysLeft <= 7 && daysLeft >= 0 && !doc.Alert7DaysSent)
                {
                    var alert = new ComplianceAlert
                    {
                        ComplianceDocumentId = doc.Id,
                        AlertType = "7Day",
                        Message = $"CRITICAL: {doc.DocumentType} for {doc.CompanyCode} expires in {daysLeft} days!",
                        DaysRemaining = daysLeft,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.ComplianceAlerts.Add(alert);
                    alertsCreated.Add(alert);
                    doc.Alert7DaysSent = true;
                }
            }

            await _context.SaveChangesAsync();

            return new
            {
                AlertsCreated = alertsCreated.Count,
                Alerts = alertsCreated.Select(a => new { a.AlertType, a.Message })
            };
        }

        // DELETE: api/Compliance/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(int id)
        {
            var doc = await _context.ComplianceDocuments.FindAsync(id);
            if (doc == null)
                return NotFound();

            // Delete file
            if (!string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath))
            {
                System.IO.File.Delete(doc.FilePath);
            }

            _context.ComplianceDocuments.Remove(doc);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }

    // Request DTOs
    public class CreateComplianceRequest
    {
        public string CompanyCode { get; set; } = string.Empty;
        public string DocumentType { get; set; } = string.Empty;
        public string? DocumentNumber { get; set; }
        public DateTime IssueDate { get; set; }
        public DateTime ExpiryDate { get; set; }
        public string? IssuingAuthority { get; set; }
        public string? Notes { get; set; }
        public IFormFile? File { get; set; }
        public int? UploadedByUserId { get; set; }
        public string? UploadedByUserName { get; set; }
    }

    public class UpdateComplianceRequest
    {
        public string? DocumentNumber { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string? IssuingAuthority { get; set; }
        public string? Notes { get; set; }
    }

    public class AcknowledgeAlertRequest
    {
        public int? UserId { get; set; }
        public string? UserName { get; set; }
        public string? Notes { get; set; }
    }
}
