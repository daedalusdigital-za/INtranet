using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Quotation requests: anyone asks ("5 office chairs", "new compressor for KZN"), optionally attaching the
    /// quotes already received; Finance approves or declines on Finance › Approvals. Approved requests are what the
    /// clerks then buy / put into a payment pack.
    /// </summary>
    [ApiController]
    [Route("api/quotation-requests")]
    [Authorize]
    public class QuotationRequestsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly string _root;
        private static readonly string[] AllowedExt = { ".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".xls", ".doc", ".docx" };

        public QuotationRequestsController(ApplicationDbContext db, IConfiguration cfg)
        {
            _db = db;
            _root = Path.Combine(cfg.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads"), "quotation-requests");
        }

        private int UserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : 0;

        /// <summary>Finance people who may approve: admins, accountants / finance managers, creditors admins, treasurer, or anyone with the finance module.</summary>
        private async Task<bool> CanReviewAsync()
        {
            if (User.IsAdmin()) return true;
            if (await FinanceAuthority.HasAsync(_db, User, "cred.accountant", "cred.admin", "cred.bank")) return true;
            var row = await _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => new { u.Permissions, u.Role, Dept = u.Department != null ? u.Department.Name : null }).FirstOrDefaultAsync();
            if (row == null) return false;
            var perms = FinanceAuthority.Parse(row.Permissions);
            return perms.Contains("finance") || perms.Contains("all") || string.Equals(row.Role, "Finance", StringComparison.OrdinalIgnoreCase)
                || (row.Dept ?? "").Contains("finance", StringComparison.OrdinalIgnoreCase);
        }

        private static object Dto(QuotationRequest q) => new
        {
            q.Id, q.UserId, q.RequestedBy, q.RequestedByEmail, q.Department, q.Company, q.Subject, q.Details, q.Priority, q.EstimatedAmount,
            q.Status, q.SubmittedAt, q.ReviewedBy, q.ReviewedAt, q.ReviewNotes, q.PaperlessDocumentId,
            files = q.Files.OrderBy(f => f.Id).Select(f => new { f.Id, f.FileName, f.ContentType, f.Size }).ToList(),
            quoteCount = q.Files.Count
        };

        public class SubmitDto
        {
            public string Subject { get; set; } = "";
            public string? Details { get; set; }
            public string? Priority { get; set; }
            public string? Company { get; set; }
            public decimal? EstimatedAmount { get; set; }
            public int? PaperlessDocumentId { get; set; }
        }

        /// <summary>POST api/quotation-requests (multipart: subject, details, priority?, company?, estimatedAmount?, files[])</summary>
        [HttpPost]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(80_000_000)]
        public async Task<IActionResult> Submit([FromForm] SubmitDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Subject)) return BadRequest(new { message = "Say what you need quoted." });
            var u = await _db.Users.AsNoTracking().Include(x => x.Department).FirstOrDefaultAsync(x => x.UserId == UserId);
            var q = new QuotationRequest
            {
                UserId = UserId == 0 ? null : UserId,
                RequestedBy = u != null ? ($"{u.Name} {u.Surname}").Trim() : (User.FindFirstValue(ClaimTypes.Name) ?? "Unknown"),
                RequestedByEmail = u?.Email ?? User.FindFirstValue(ClaimTypes.Email),
                Department = u?.Department?.Name,
                Company = string.IsNullOrWhiteSpace(dto.Company) ? null : dto.Company.Trim(),
                Subject = dto.Subject.Trim(),
                Details = string.IsNullOrWhiteSpace(dto.Details) ? null : dto.Details.Trim(),
                Priority = dto.Priority is "Low" or "Normal" or "High" or "Urgent" ? dto.Priority : "Normal",
                EstimatedAmount = dto.EstimatedAmount,
                PaperlessDocumentId = dto.PaperlessDocumentId,
                Status = "Pending",
                SubmittedAt = DateTime.UtcNow
            };
            _db.QuotationRequests.Add(q);
            await _db.SaveChangesAsync();

            var dir = Path.Combine(_root, q.Id.ToString());
            Directory.CreateDirectory(dir);
            foreach (var f in Request.Form.Files.Take(10))
            {
                var ext = Path.GetExtension(f.FileName).ToLowerInvariant();
                if (!AllowedExt.Contains(ext) || f.Length == 0) continue;
                var safe = string.Concat(Path.GetFileNameWithoutExtension(f.FileName).Split(Path.GetInvalidFileNameChars())).Trim();
                if (safe.Length == 0) safe = "quote";
                var path = Path.Combine(dir, $"{q.Files.Count + 1:00}_{safe}{ext}");
                await using (var fs = System.IO.File.Create(path)) await f.CopyToAsync(fs);
                q.Files.Add(new QuotationRequestFile { FileName = f.FileName, ContentType = f.ContentType ?? "application/octet-stream", Size = f.Length, StoragePath = path });
            }
            await _db.SaveChangesAsync();
            return Ok(Dto(q));
        }

        /// <summary>GET api/quotation-requests?status=Pending|Approved|Declined|all — Finance view.</summary>
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? status = null, [FromQuery] int take = 300)
        {
            if (!await CanReviewAsync()) return Forbid();
            var q = _db.QuotationRequests.AsNoTracking().Include(x => x.Files).AsQueryable();
            if (!string.IsNullOrWhiteSpace(status) && status != "all") q = q.Where(x => x.Status == status);
            var rows = await q.OrderByDescending(x => x.Status == "Pending").ThenByDescending(x => x.SubmittedAt).Take(take).ToListAsync();
            return Ok(rows.Select(Dto));
        }

        /// <summary>GET api/quotation-requests/my — the caller's own requests.</summary>
        [HttpGet("my")]
        public async Task<IActionResult> My()
        {
            var rows = await _db.QuotationRequests.AsNoTracking().Include(x => x.Files).Where(x => x.UserId == UserId).OrderByDescending(x => x.SubmittedAt).Take(50).ToListAsync();
            return Ok(rows.Select(Dto));
        }

        /// <summary>GET api/quotation-requests/counts</summary>
        [HttpGet("counts")]
        public async Task<IActionResult> Counts()
        {
            var by = await _db.QuotationRequests.AsNoTracking().GroupBy(x => x.Status).Select(g => new { g.Key, n = g.Count() }).ToListAsync();
            int N(string s) => by.FirstOrDefault(x => x.Key == s)?.n ?? 0;
            var pending = N("Pending"); var approved = N("Approved"); var declined = N("Declined");
            return Ok(new { pending, approved, declined, total = pending + approved + declined });
        }

        /// <summary>GET api/quotation-requests/{id}/files/{fileId}</summary>
        [HttpGet("{id:int}/files/{fileId:int}")]
        public async Task<IActionResult> File(int id, int fileId, [FromQuery] bool download = false)
        {
            var f = await _db.QuotationRequestFiles.AsNoTracking().Include(x => x.Request).FirstOrDefaultAsync(x => x.Id == fileId && x.QuotationRequestId == id);
            if (f == null || !System.IO.File.Exists(f.StoragePath)) return NotFound();
            if (f.Request!.UserId != UserId && !await CanReviewAsync()) return Forbid();
            var stream = System.IO.File.OpenRead(f.StoragePath);
            if (download) return File(stream, f.ContentType, f.FileName);
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{Uri.EscapeDataString(f.FileName)}\"";
            return File(stream, f.ContentType);
        }

        public class ReviewDto { public string Status { get; set; } = ""; public string? Notes { get; set; } }

        /// <summary>PUT api/quotation-requests/{id}/review { status: Approved|Declined|Pending, notes }</summary>
        [HttpPut("{id:int}/review")]
        public async Task<IActionResult> Review(int id, [FromBody] ReviewDto dto)
        {
            if (!await CanReviewAsync()) return Forbid();
            if (dto.Status is not ("Approved" or "Declined" or "Pending")) return BadRequest(new { message = "Status must be Approved, Declined or Pending." });
            if (dto.Status == "Declined" && string.IsNullOrWhiteSpace(dto.Notes)) return BadRequest(new { message = "Tell the requester why it was declined." });
            var q = await _db.QuotationRequests.Include(x => x.Files).FirstOrDefaultAsync(x => x.Id == id);
            if (q == null) return NotFound();
            var u = await _db.Users.AsNoTracking().Where(x => x.UserId == UserId).Select(x => new { x.Name, x.Surname }).FirstOrDefaultAsync();
            q.Status = dto.Status;
            if (dto.Status == "Pending") { q.ReviewedBy = null; q.ReviewedByUserId = null; q.ReviewedAt = null; q.ReviewNotes = null; }
            else { q.ReviewedBy = u != null ? ($"{u.Name} {u.Surname}").Trim() : "Finance"; q.ReviewedByUserId = UserId; q.ReviewedAt = DateTime.UtcNow; q.ReviewNotes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim(); }
            q.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(Dto(q));
        }

        /// <summary>DELETE api/quotation-requests/{id} — requester (while pending) or finance.</summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var q = await _db.QuotationRequests.Include(x => x.Files).FirstOrDefaultAsync(x => x.Id == id);
            if (q == null) return NotFound();
            var mine = q.UserId == UserId && q.Status == "Pending";
            if (!mine && !await CanReviewAsync()) return Forbid();
            foreach (var f in q.Files) { try { if (System.IO.File.Exists(f.StoragePath)) System.IO.File.Delete(f.StoragePath); } catch { } }
            _db.QuotationRequests.Remove(q);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
