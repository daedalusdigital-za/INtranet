using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services.Finance;

namespace ProjectTracker.API.Controllers.Finance
{
    /// <summary>Remittance advices swept from the finance mailbox — list, read in context, open attachments, mark allocated.</summary>
    [Authorize]
    [ApiController]
    [Route("api/finance/remittances")]
    [RequireModule("finance", AlsoAllowRoles = "Finance")]
    public class FinanceRemittancesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IRemittanceSweepService _sweep;
        private readonly string _root;
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        public FinanceRemittancesController(ApplicationDbContext db, IRemittanceSweepService sweep, IConfiguration cfg)
        {
            _db = db; _sweep = sweep;
            _root = cfg.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        }
        private int UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

        /// <summary>GET api/finance/remittances?status=New&search=&days=90</summary>
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? search, [FromQuery] int days = 180)
        {
            var q = _db.RemittanceEmails.AsNoTracking().Include(r => r.Attachments).Where(r => r.ReceivedAt >= DateTime.UtcNow.AddDays(-days));
            if (!string.IsNullOrWhiteSpace(status) && status != "All") q = q.Where(r => r.Status == status);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(r => (r.Subject != null && r.Subject.Contains(s)) || (r.FromEmail != null && r.FromEmail.Contains(s)) || (r.FromName != null && r.FromName.Contains(s))
                              || (r.CustomerName != null && r.CustomerName.Contains(s)) || (r.ExtractedJson != null && r.ExtractedJson.Contains(s)) || r.Attachments.Any(a => a.FileName.Contains(s)));
            }
            var rows = await q.OrderByDescending(r => r.ReceivedAt).Take(500).ToListAsync();
            var counts = await _db.RemittanceEmails.AsNoTracking().GroupBy(r => r.Status).Select(g => new { status = g.Key, n = g.Count() }).ToListAsync();
            var lastScan = await _db.RemittanceScans.AsNoTracking().OrderByDescending(s => s.Id).FirstOrDefaultAsync();
            return Ok(new
            {
                mailboxes = _sweep.Mailboxes, keywords = _sweep.Keywords, lastScan, counts,
                items = rows.Select(r => new
                {
                    r.Id, r.Mailbox, r.FromName, r.FromEmail, r.Subject, r.ReceivedAt, r.MatchedOn, r.CustomerCode, r.CustomerName,
                    r.InvoiceCount, r.MatchedCount, r.TotalAmount, r.MatchedBalance, r.Status, r.Notes, r.ReviewedAt,
                    attachments = r.Attachments.Select(a => new { a.Id, a.FileName, a.ContentType, a.Size, isPdf = a.ContentType == "application/pdf" || a.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) })
                })
            });
        }

        /// <summary>GET api/finance/remittances/{id} → full context: body, attachments, extracted invoices with aging matches.</summary>
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var r = await _db.RemittanceEmails.AsNoTracking().Include(x => x.Attachments).FirstOrDefaultAsync(x => x.Id == id);
            if (r == null) return NotFound();
            var ex = string.IsNullOrEmpty(r.ExtractedJson) ? new RemittanceExtraction() : JsonSerializer.Deserialize<RemittanceExtraction>(r.ExtractedJson, Json) ?? new RemittanceExtraction();
            // Live POD check for the invoices on this remittance
            var nos = ex.Invoices.Select(i => i.InvoiceNumber).ToList();
            var pods = nos.Count == 0 ? new HashSet<string>() : (await _db.PodDocumentInvoiceLinks.AsNoTracking()
                .Where(l => (l.InvoiceNumber != null && nos.Contains(l.InvoiceNumber)) || (l.Invoice != null && nos.Contains(l.Invoice.TransactionNumber)))
                .Select(l => l.InvoiceNumber ?? l.Invoice!.TransactionNumber).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            return Ok(new
            {
                r.Id, r.Mailbox, r.MessageId, r.FromName, r.FromEmail, r.Subject, r.ReceivedAt, r.BodyText, r.MatchedOn, r.CustomerCode, r.CustomerName,
                r.InvoiceCount, r.MatchedCount, r.TotalAmount, r.MatchedBalance, r.Status, r.Notes, r.ReviewedAt, r.ReviewedBy,
                attachments = r.Attachments.Select(a => new { a.Id, a.FileName, a.ContentType, a.Size, hasText = !string.IsNullOrEmpty(a.ExtractedText), isPdf = a.ContentType == "application/pdf" || a.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) }),
                extraction = new
                {
                    ex.PaymentDate, ex.PaymentReference, ex.Amounts,
                    invoices = ex.Invoices.Select(i => new { i.InvoiceNumber, i.Amount, i.Source, i.InAging, i.CustomerCode, i.CustomerName, i.AgingBalance, i.DaysOver, i.Company, hasPod = pods.Contains(i.InvoiceNumber),
                        shortPaid = i.Amount.HasValue && i.AgingBalance.HasValue && i.Amount.Value < i.AgingBalance.Value - 0.01m })
                }
            });
        }

        /// <summary>GET api/finance/remittances/{id}/attachments/{aid}?download=1</summary>
        [HttpGet("{id:int}/attachments/{aid:int}")]
        public async Task<IActionResult> Attachment(int id, int aid, [FromQuery] bool download = false)
        {
            var a = await _db.RemittanceAttachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == aid && x.RemittanceEmailId == id);
            if (a == null) return NotFound();
            var full = Path.GetFullPath(Path.Combine(_root, a.StoragePath));
            if (!full.StartsWith(Path.GetFullPath(_root), StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(full)) return NotFound(new { message = "File is missing from storage." });
            var mime = a.ContentType ?? "application/octet-stream";
            return download ? PhysicalFile(full, mime, a.FileName) : PhysicalFile(full, mime, enableRangeProcessing: true);
        }

        public record StatusDto(string Status, string? Notes);

        /// <summary>PUT api/finance/remittances/{id}/status {status: New|Reviewed|Allocated|Ignored, notes}</summary>
        [HttpPut("{id:int}/status")]
        public async Task<IActionResult> SetStatus(int id, [FromBody] StatusDto dto)
        {
            var r = await _db.RemittanceEmails.FindAsync(id);
            if (r == null) return NotFound();
            if (dto.Status is not ("New" or "Reviewed" or "Allocated" or "Ignored")) return BadRequest(new { message = "Unknown status." });
            r.Status = dto.Status; r.Notes = dto.Notes?.Trim(); r.ReviewedBy = UserId; r.ReviewedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { r.Id, r.Status, r.Notes, r.ReviewedAt });
        }

        /// <summary>POST api/finance/remittances/scan → run the mailbox sweep now.</summary>
        [HttpPost("scan")]
        public async Task<IActionResult> Scan(CancellationToken ct)
        {
            try
            {
                var scan = await _sweep.SweepAsync("manual", ct);
                if (scan.Error != null) return StatusCode(502, new { message = scan.Error, scan });
                return Ok(scan);
            }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        }

        /// <summary>GET api/finance/remittances/scans → recent sweep history.</summary>
        [HttpGet("scans")]
        public async Task<IActionResult> Scans() => Ok(await _db.RemittanceScans.AsNoTracking().OrderByDescending(s => s.Id).Take(30).ToListAsync());
    }
}
