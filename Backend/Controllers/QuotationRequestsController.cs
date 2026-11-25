using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.Finance;
using ProjectTracker.API.Services.Signatures;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Quotation requests. Anyone asks for something to be bought ("5 office chairs") with — normally — three quotes.
    ///   Pending        → a creditors clerk checks it, may add / fix quotes, then accepts (signs as preparer) and picks the accountant,
    ///                    or declines it back to the requester.
    ///   WithAccountant → the company accountant signs and picks the director, or sends it back to the preparer.
    ///   WithDirector   → the director selects ONE quote and signs, or rejects all.
    ///   Approved / Rejected → the preparer and requester are e-mailed the outcome with the quote approval sheet attached.
    /// Who counts as clerk / accountant / director for a company is the same as for payment packs.
    /// </summary>
    [ApiController]
    [Route("api/quotation-requests")]
    // Exec tokens (directors off-site) are accepted only on the paths ExecAuth.Allows lists: reading and the director decision.
    [Authorize(AuthenticationSchemes = "Bearer," + ExecAuth.Scheme)]
    public class QuotationRequestsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IConfiguration _cfg;
        private readonly ISignatureService _sign;
        private readonly INotificationBroadcaster _notify;
        private readonly IEmailService _email;
        private readonly CreditorPackPdfService _pdf;
        private readonly IMemoryCache _cache;
        private readonly ILogger<QuotationRequestsController> _log;
        private readonly string _root;
        private static readonly string[] AllowedExt = { ".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".xls", ".doc", ".docx" };
        private const long MaxFileBytes = 20L * 1024 * 1024;

        public QuotationRequestsController(ApplicationDbContext db, IConfiguration cfg, ISignatureService sign, INotificationBroadcaster notify,
            IEmailService email, CreditorPackPdfService pdf, IMemoryCache cache, ILogger<QuotationRequestsController> log)
        {
            _db = db; _cfg = cfg; _sign = sign; _notify = notify; _email = email; _pdf = pdf; _cache = cache; _log = log;
            _root = Path.Combine(cfg.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads"), "quotation-requests");
        }

        // ───────────────────────── identity & roles ─────────────────────────

        private int UserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : 0;
        private bool IsAdmin => User.IsAdmin();
        private string? _name;
        private async Task<string> UserNameAsync()
        {
            if (_name != null) return _name;
            var u = await _db.Users.AsNoTracking().Where(x => x.UserId == UserId).Select(x => new { x.Name, x.Surname }).FirstOrDefaultAsync();
            var full = ($"{u?.Name} {u?.Surname}").Trim();
            return _name = full.Length > 0 ? full : (User.FindFirstValue(ClaimTypes.Name) ?? "Unknown");
        }
        private HashSet<string>? _perms;
        private async Task<HashSet<string>> PermsAsync() => _perms ??= await FinanceAuthority.EffectiveAsync(_db, User);
        private async Task<bool> HasAsync(params string[] any) { if (IsAdmin) return true; var p = await PermsAsync(); return p.Contains("*") || any.Any(p.Contains); }
        private CompanyScope? _scope;
        private async Task<bool> InScopeAsync(string? code) => code == null || (_scope ??= await CompanyAccess.ForUserAsync(_db, User, _cache)).Allows(code);

        private Dictionary<string, CompanyApprovers>? _approvers;
        private async Task<Dictionary<string, CompanyApprovers>> AllApproversAsync() => _approvers ??= await ApproverResolver.AllAsync(_db);

        /// <summary>The company's accountants / directors; when nobody is assigned to the company, everyone with the role (so it never gets stuck).</summary>
        private async Task<(List<Approver> People, bool Fallback)> CandidatesAsync(string? code, bool directors)
        {
            var all = await AllApproversAsync();
            if (code != null && all.TryGetValue(code, out var a))
            {
                var list = directors ? a.Directors : a.Accountants;
                if (list.Count > 0) return (list.ToList(), false);
            }
            var any = all.Values.SelectMany(x => directors ? x.Directors : x.Accountants).GroupBy(x => x.UserId).Select(g => g.First()).OrderBy(x => x.Name).ToList();
            return (any, true);
        }

        /// <summary>Creditors clerk (or creditors admin) for the request's company.</summary>
        private async Task<bool> IsClerkAsync(QuotationRequest q) => IsAdmin || (await HasAsync("cred.clerk", "cred.admin") && await InScopeAsync(q.CompanyCode));

        private async Task<bool> IsAccountantForAsync(QuotationRequest q)
        {
            if (IsAdmin) return true;
            if (!await HasAsync("cred.accountant")) return false;
            var (people, _) = await CandidatesAsync(q.CompanyCode, false);
            if (people.Count > 0 && !people.Any(p => p.UserId == UserId)) return false;
            var req = q.RequestedAccountantIdList;
            return req.Count == 0 || req.Contains(UserId);
        }

        private async Task<bool> IsDirectorForAsync(QuotationRequest q)
        {
            if (IsAdmin) return true;
            if (!await HasAsync("cred.director")) return false;
            var (people, _) = await CandidatesAsync(q.CompanyCode, true);
            if (people.Count > 0 && !people.Any(p => p.UserId == UserId)) return false;
            var req = q.RequestedDirectorIdList;
            return req.Count == 0 || req.Contains(UserId);
        }

        /// <summary>Finance people who see the quotation list: admins, creditors clerks / admins, accountants, directors, treasury, or anyone with the finance module.</summary>
        private async Task<bool> CanSeeAllAsync()
        {
            if (IsAdmin) return true;
            if (await HasAsync("cred.clerk", "cred.admin", "cred.accountant", "cred.director", "cred.bank", "cred.readonly")) return true;
            var row = await _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => new { u.Permissions, u.Role, Dept = u.Department != null ? u.Department.Name : null }).FirstOrDefaultAsync();
            if (row == null) return false;
            var perms = FinanceAuthority.Parse(row.Permissions);
            return perms.Contains("finance") || perms.Contains("all") || string.Equals(row.Role, "Finance", StringComparison.OrdinalIgnoreCase)
                || (row.Dept ?? "").Contains("finance", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsRequester(QuotationRequest q) => q.UserId != null && q.UserId == UserId;

        // ───────────────────────── DTO ─────────────────────────

        private async Task<object> DtoAsync(QuotationRequest q, bool withCan = true)
        {
            object? can = null;
            if (withCan)
            {
                var clerk = await IsClerkAsync(q);
                var acc = q.Status == QuoteFlow.WithAccountant && await IsAccountantForAsync(q) && (q.PreparedByUserId != UserId || IsAdmin);
                var dir = q.Status == QuoteFlow.WithDirector && await IsDirectorForAsync(q) && ((q.PreparedByUserId != UserId && q.AccountantUserId != UserId) || IsAdmin);
                can = new
                {
                    editQuotes = q.Status == QuoteFlow.Pending && (clerk || (IsRequester(q) && q.PreparedByUserId == null)),
                    accept = q.Status == QuoteFlow.Pending && clerk && (q.UserId != UserId || IsAdmin),
                    decline = q.Status == QuoteFlow.Pending && clerk,
                    accountant = acc,
                    changeAccountant = q.Status == QuoteFlow.WithAccountant && (clerk || q.PreparedByUserId == UserId),
                    director = dir,
                    delete = (IsRequester(q) && q.Status == QuoteFlow.Pending && q.PreparedByUserId == null) || IsAdmin,
                };
            }
            return new
            {
                q.Id, number = $"Q-{q.Id:0000}", q.UserId, q.RequestedBy, q.RequestedByEmail, q.Department, q.Company, q.CompanyCode,
                q.Subject, q.Details, q.Priority, q.EstimatedAmount, q.FewerQuotesReason,
                q.Status, statusTitle = QuoteFlow.Title(q.Status), q.SubmittedAt, q.UpdatedAt,
                q.ReviewedBy, q.ReviewedAt, q.ReviewNotes, q.PaperlessDocumentId,
                q.PreparedByUserId, q.PreparedByName, q.PreparedAt,
                requestedAccountantIds = q.RequestedAccountantIdList, q.RequestedAccountantNames,
                requestedDirectorIds = q.RequestedDirectorIdList, q.RequestedDirectorNames,
                q.AccountantUserId, q.AccountantName, q.AccountantApprovedAt, q.AccountantComment,
                q.DirectorUserId, q.DirectorName, q.DirectorDecidedAt, q.DirectorComment,
                q.SelectedFileId, q.ReturnReason,
                history = ReadHistory(q),
                files = q.Files.OrderBy(f => f.QuoteNumber == 0 ? int.MaxValue : f.QuoteNumber).ThenBy(f => f.Id)
                    .Select(f => new { f.Id, f.FileName, f.ContentType, f.Size, f.QuoteNumber, f.Supplier, f.Amount }).ToList(),
                quoteCount = q.Files.Count,
                can
            };
        }

        private record HistoryEntry(DateTime At, string By, string Action, string? Note);
        private static List<HistoryEntry> ReadHistory(QuotationRequest q)
        {
            if (string.IsNullOrWhiteSpace(q.HistoryJson)) return new();
            try { return JsonSerializer.Deserialize<List<HistoryEntry>>(q.HistoryJson) ?? new(); } catch { return new(); }
        }
        private async Task LogAsync(QuotationRequest q, string action, string? note = null)
        {
            var h = ReadHistory(q);
            h.Add(new HistoryEntry(DateTime.UtcNow, await UserNameAsync(), action, string.IsNullOrWhiteSpace(note) ? null : Trunc(note.Trim(), 1000)));
            q.HistoryJson = JsonSerializer.Serialize(h);
            q.UpdatedAt = DateTime.UtcNow;
        }

        private static string Trunc(string s, int n) => s.Length > n ? s[..n] : s;
        private static string Csv(IEnumerable<int> ids) => string.Join(",", ids);

        private Task<QuotationRequest?> LoadAsync(int id) => _db.QuotationRequests.Include(x => x.Files).FirstOrDefaultAsync(x => x.Id == id);

        // ───────────────────────── reading ─────────────────────────

        /// <summary>GET api/quotation-requests/companies — paying companies for the request form (any signed-in user).</summary>
        [HttpGet("companies")]
        public async Task<IActionResult> Companies() =>
            Ok(await _db.CreditorCompanies.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).Select(c => new { c.Code, c.Name }).ToListAsync());

        /// <summary>GET api/quotation-requests?status=Pending|WithAccountant|WithDirector|Approved|Rejected|Declined|open|forme|all — Finance view.</summary>
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? status = null, [FromQuery] int take = 300)
        {
            if (!await CanSeeAllAsync()) return Forbid();
            var q = _db.QuotationRequests.AsNoTracking().Include(x => x.Files).AsQueryable();
            if (status == "open") q = q.Where(x => x.Status == QuoteFlow.Pending || x.Status == QuoteFlow.WithAccountant || x.Status == QuoteFlow.WithDirector);
            else if (!string.IsNullOrWhiteSpace(status) && status is not ("all" or "forme")) q = q.Where(x => x.Status == status);
            var rows = await q.OrderByDescending(x => x.Status == QuoteFlow.Pending || x.Status == QuoteFlow.WithAccountant || x.Status == QuoteFlow.WithDirector)
                .ThenByDescending(x => x.SubmittedAt).Take(Math.Clamp(take, 1, 500)).ToListAsync();
            var list = new List<object>();
            foreach (var r in rows)
            {
                if (status == "forme" && !await NeedsMeAsync(r)) continue;
                if (!IsAdmin && r.CompanyCode != null && !await InScopeAsync(r.CompanyCode) && !await IsAccountantForAsync(r) && !await IsDirectorForAsync(r)) continue;
                list.Add(await DtoAsync(r));
            }
            return Ok(list);
        }

        /// <summary>Is this request waiting on the caller right now?</summary>
        private async Task<bool> NeedsMeAsync(QuotationRequest r) => r.Status switch
        {
            QuoteFlow.Pending => await IsClerkAsync(r),
            QuoteFlow.WithAccountant => await IsAccountantForAsync(r) && (r.PreparedByUserId != UserId || IsAdmin),
            QuoteFlow.WithDirector => await IsDirectorForAsync(r) && ((r.PreparedByUserId != UserId && r.AccountantUserId != UserId) || IsAdmin),
            _ => false
        };

        /// <summary>GET api/quotation-requests/{id}</summary>
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var q = await _db.QuotationRequests.AsNoTracking().Include(x => x.Files).FirstOrDefaultAsync(x => x.Id == id);
            if (q == null) return NotFound();
            if (!IsRequester(q) && !await CanSeeAllAsync()) return Forbid();
            return Ok(await DtoAsync(q, withCan: true));
        }

        /// <summary>GET api/quotation-requests/my — the caller's own requests.</summary>
        [HttpGet("my")]
        public async Task<IActionResult> My()
        {
            var rows = await _db.QuotationRequests.AsNoTracking().Include(x => x.Files).Where(x => x.UserId == UserId).OrderByDescending(x => x.SubmittedAt).Take(50).ToListAsync();
            var list = new List<object>();
            foreach (var r in rows) list.Add(await DtoAsync(r, withCan: false));
            return Ok(list);
        }

        /// <summary>GET api/quotation-requests/counts — per status, plus how many are waiting on the caller.</summary>
        [HttpGet("counts")]
        public async Task<IActionResult> Counts()
        {
            var by = await _db.QuotationRequests.AsNoTracking().GroupBy(x => x.Status).Select(g => new { g.Key, n = g.Count() }).ToListAsync();
            int N(string s) => by.FirstOrDefault(x => x.Key == s)?.n ?? 0;
            var forMe = 0;
            if (await CanSeeAllAsync())
            {
                var open = await _db.QuotationRequests.AsNoTracking().Where(x => x.Status == QuoteFlow.Pending || x.Status == QuoteFlow.WithAccountant || x.Status == QuoteFlow.WithDirector).ToListAsync();
                foreach (var r in open) if (await NeedsMeAsync(r)) forMe++;
            }
            var pending = N(QuoteFlow.Pending); var withAcc = N(QuoteFlow.WithAccountant); var withDir = N(QuoteFlow.WithDirector);
            var approved = N(QuoteFlow.Approved); var rejected = N(QuoteFlow.Rejected); var declined = N(QuoteFlow.Declined);
            return Ok(new { pending, withAccountant = withAcc, withDirector = withDir, open = pending + withAcc + withDir, approved, rejected, declined, forMe, total = by.Sum(x => x.n) });
        }

        /// <summary>GET api/quotation-requests/{id}/files/{fileId}</summary>
        [HttpGet("{id:int}/files/{fileId:int}")]
        public async Task<IActionResult> File(int id, int fileId, [FromQuery] bool download = false)
        {
            var f = await _db.QuotationRequestFiles.AsNoTracking().Include(x => x.Request).FirstOrDefaultAsync(x => x.Id == fileId && x.QuotationRequestId == id);
            if (f == null || !System.IO.File.Exists(f.StoragePath)) return NotFound();
            if (f.Request!.UserId != UserId && !await CanSeeAllAsync()) return Forbid();
            var stream = System.IO.File.OpenRead(f.StoragePath);
            if (download) return File(stream, f.ContentType, f.FileName);
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{Uri.EscapeDataString(f.FileName)}\"";
            return File(stream, f.ContentType);
        }

        /// <summary>GET api/quotation-requests/{id}/approval-sheet.pdf — the quote approval sheet (any stage; outstanding signatures are marked).</summary>
        [HttpGet("{id:int}/approval-sheet.pdf")]
        public async Task<IActionResult> ApprovalSheet(int id)
        {
            var q = await _db.QuotationRequests.AsNoTracking().Include(x => x.Files).FirstOrDefaultAsync(x => x.Id == id);
            if (q == null) return NotFound();
            if (!IsRequester(q) && !await CanSeeAllAsync()) return Forbid();
            return File(await _pdf.QuoteApprovalSheetAsync(q), "application/pdf", $"Quote-approval-Q-{q.Id:0000}.pdf");
        }

        /// <summary>GET api/quotation-requests/{id}/approvers — accountants and directors for the request's company (excluding the caller).</summary>
        [HttpGet("{id:int}/approvers")]
        public async Task<IActionResult> Approvers(int id, [FromQuery] string? company = null)
        {
            var q = await _db.QuotationRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (q == null) return NotFound();
            if (!await CanSeeAllAsync()) return Forbid();
            var code = string.IsNullOrWhiteSpace(company) ? q.CompanyCode : company.Trim().ToUpperInvariant();
            var (accs, accFallback) = await CandidatesAsync(code, false);
            var (dirs, dirFallback) = await CandidatesAsync(code, true);
            object P(IEnumerable<Approver> l) => l.Where(a => a.UserId != UserId && a.UserId != q.UserId).Select(a => new { userId = a.UserId, a.Name, a.Role, a.Email }).ToList();
            return Ok(new { accountants = P(accs), accountantsFallback = accFallback, directors = P(dirs), directorsFallback = dirFallback });
        }

        // ───────────────────────── requester ─────────────────────────

        public class SubmitDto
        {
            public string Subject { get; set; } = "";
            public string? Details { get; set; }
            public string? Priority { get; set; }
            public string? Company { get; set; }
            public string? CompanyCode { get; set; }
            public decimal? EstimatedAmount { get; set; }
            public string? FewerQuotesReason { get; set; }
            public int? PaperlessDocumentId { get; set; }
            /// <summary>Supplier and amount per file, in the same order as the files.</summary>
            public List<string>? Suppliers { get; set; }
            public List<decimal?>? Amounts { get; set; }
        }

        /// <summary>POST api/quotation-requests (multipart: subject, details, priority, companyCode, estimatedAmount, fewerQuotesReason, files[], suppliers[], amounts[])</summary>
        [HttpPost]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(80_000_000)]
        public async Task<IActionResult> Submit([FromForm] SubmitDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Subject)) return BadRequest(new { message = "Say what you need quoted." });
            var files = Request.Form.Files.Where(f => f.Length > 0 && AllowedExt.Contains(Path.GetExtension(f.FileName).ToLowerInvariant())).Take(10).ToList();
            if (files.Count < 3 && string.IsNullOrWhiteSpace(dto.FewerQuotesReason))
                return BadRequest(new { message = "Attach three quotes, or say why there are fewer (e.g. only one supplier, or please source quotes for me)." });
            if (files.Any(f => f.Length > MaxFileBytes)) return BadRequest(new { message = "Each quote must be under 20 MB." });

            var code = string.IsNullOrWhiteSpace(dto.CompanyCode) ? null : dto.CompanyCode.Trim().ToUpperInvariant();
            var companyName = code != null ? await _db.CreditorCompanies.AsNoTracking().Where(c => c.Code == code).Select(c => c.Name).FirstOrDefaultAsync() : null;
            if (code != null && companyName == null) return BadRequest(new { message = "Unknown company." });

            var u = await _db.Users.AsNoTracking().Include(x => x.Department).FirstOrDefaultAsync(x => x.UserId == UserId);
            var q = new QuotationRequest
            {
                UserId = UserId == 0 ? null : UserId,
                RequestedBy = u != null ? ($"{u.Name} {u.Surname}").Trim() : (User.FindFirstValue(ClaimTypes.Name) ?? "Unknown"),
                RequestedByEmail = u?.Email ?? User.FindFirstValue(ClaimTypes.Email),
                Department = u?.Department?.Name,
                CompanyCode = code,
                Company = companyName ?? (string.IsNullOrWhiteSpace(dto.Company) ? null : dto.Company.Trim()),
                Subject = Trunc(dto.Subject.Trim(), 300),
                Details = string.IsNullOrWhiteSpace(dto.Details) ? null : dto.Details.Trim(),
                Priority = dto.Priority is "Low" or "Normal" or "High" or "Urgent" ? dto.Priority : "Normal",
                EstimatedAmount = dto.EstimatedAmount,
                FewerQuotesReason = files.Count < 3 && !string.IsNullOrWhiteSpace(dto.FewerQuotesReason) ? Trunc(dto.FewerQuotesReason.Trim(), 500) : null,
                PaperlessDocumentId = dto.PaperlessDocumentId,
                Status = QuoteFlow.Pending,
                SubmittedAt = DateTime.UtcNow
            };
            await LogAsync(q, "Submitted", $"{files.Count} quote{(files.Count == 1 ? "" : "s")} attached");
            _db.QuotationRequests.Add(q);
            await _db.SaveChangesAsync();

            for (var i = 0; i < files.Count; i++)
                await SaveQuoteAsync(q, files[i], dto.Suppliers?.ElementAtOrDefault(i), dto.Amounts?.ElementAtOrDefault(i));
            await _db.SaveChangesAsync();

            // Tell the creditors clerks for the company that a request is waiting.
            var clerks = await ClerksForAsync(code);
            await NotifyAsync(clerks.Select(c => (int?)c.UserId), "New quotation request", $"{q.RequestedBy}: {q.Subject} · {files.Count} quote{(files.Count == 1 ? "" : "s")}", q.Id);
            return Ok(await DtoAsync(q));
        }

        private async Task<List<Approver>> ClerksForAsync(string? code)
        {
            var all = await AllApproversAsync();
            if (code != null && all.TryGetValue(code, out var a) && a.Clerks.Count > 0) return a.Clerks;
            return all.Values.SelectMany(x => x.Clerks).GroupBy(x => x.UserId).Select(g => g.First()).ToList();
        }

        private async Task SaveQuoteAsync(QuotationRequest q, IFormFile f, string? supplier, decimal? amount)
        {
            var dir = Path.Combine(_root, q.Id.ToString());
            Directory.CreateDirectory(dir);
            var ext = Path.GetExtension(f.FileName).ToLowerInvariant();
            var safe = string.Concat(Path.GetFileNameWithoutExtension(f.FileName).Split(Path.GetInvalidFileNameChars())).Trim();
            if (safe.Length == 0) safe = "quote";
            var n = q.Files.Count == 0 ? 1 : q.Files.Max(x => x.QuoteNumber) + 1;
            var path = Path.Combine(dir, $"{n:00}_{Guid.NewGuid().ToString("N")[..6]}_{safe}{ext}");
            await using (var fs = System.IO.File.Create(path)) await f.CopyToAsync(fs);
            q.Files.Add(new QuotationRequestFile
            {
                FileName = f.FileName, ContentType = f.ContentType ?? "application/octet-stream", Size = f.Length, StoragePath = path,
                QuoteNumber = n, Supplier = string.IsNullOrWhiteSpace(supplier) ? null : Trunc(supplier.Trim(), 200), Amount = amount
            });
        }

        // ───────────────────────── quotes (before it is accepted) ─────────────────────────

        public class QuoteFieldsDto { public string? Supplier { get; set; } public decimal? Amount { get; set; } }

        /// <summary>POST api/quotation-requests/{id}/quotes (multipart: file, supplier, amount) — clerk (or requester before acceptance) adds a quote.</summary>
        [HttpPost("{id:int}/quotes")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(25_000_000)]
        public async Task<IActionResult> AddQuote(int id, [FromForm] QuoteFieldsDto dto)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            if (!await CanEditQuotesAsync(q)) return Forbid();
            var f = Request.Form.Files.FirstOrDefault();
            if (f == null || f.Length == 0) return BadRequest(new { message = "Choose the quote file." });
            if (!AllowedExt.Contains(Path.GetExtension(f.FileName).ToLowerInvariant())) return BadRequest(new { message = "Quotes must be PDF, image, Word or Excel files." });
            if (f.Length > MaxFileBytes) return BadRequest(new { message = "Each quote must be under 20 MB." });
            if (q.Files.Count >= 10) return BadRequest(new { message = "A request can hold at most 10 quotes." });
            await SaveQuoteAsync(q, f, dto.Supplier, dto.Amount);
            await LogAsync(q, "QuoteAdded", $"{dto.Supplier ?? f.FileName}{(dto.Amount is decimal a ? $" · R{a:N2}" : "")}");
            await _db.SaveChangesAsync();
            return Ok(await DtoAsync(q));
        }

        /// <summary>PUT api/quotation-requests/{id}/quotes/{fileId} { supplier, amount }</summary>
        [HttpPut("{id:int}/quotes/{fileId:int}")]
        public async Task<IActionResult> UpdateQuote(int id, int fileId, [FromBody] QuoteFieldsDto dto)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            if (!await CanEditQuotesAsync(q)) return Forbid();
            var f = q.Files.FirstOrDefault(x => x.Id == fileId); if (f == null) return NotFound();
            f.Supplier = string.IsNullOrWhiteSpace(dto.Supplier) ? null : Trunc(dto.Supplier.Trim(), 200);
            f.Amount = dto.Amount;
            await LogAsync(q, "QuoteUpdated", $"Quote {f.QuoteNumber}: {f.Supplier}{(f.Amount is decimal a ? $" · R{a:N2}" : "")}");
            await _db.SaveChangesAsync();
            return Ok(await DtoAsync(q));
        }

        /// <summary>DELETE api/quotation-requests/{id}/quotes/{fileId}</summary>
        [HttpDelete("{id:int}/quotes/{fileId:int}")]
        public async Task<IActionResult> RemoveQuote(int id, int fileId)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            if (!await CanEditQuotesAsync(q)) return Forbid();
            var f = q.Files.FirstOrDefault(x => x.Id == fileId); if (f == null) return NotFound();
            try { if (System.IO.File.Exists(f.StoragePath)) System.IO.File.Delete(f.StoragePath); } catch { }
            q.Files.Remove(f); _db.QuotationRequestFiles.Remove(f);
            await LogAsync(q, "QuoteRemoved", f.Supplier ?? f.FileName);
            await _db.SaveChangesAsync();
            return Ok(await DtoAsync(q));
        }

        private async Task<bool> CanEditQuotesAsync(QuotationRequest q) =>
            q.Status == QuoteFlow.Pending && (await IsClerkAsync(q) || (IsRequester(q) && q.PreparedByUserId == null));

        // ───────────────────────── creditors ─────────────────────────

        public class AcceptDto
        {
            public string? CompanyCode { get; set; }
            public int[]? AccountantUserIds { get; set; }
            public string? FewerQuotesReason { get; set; }
            public string? Note { get; set; }
            public string? SignatureImageBase64 { get; set; }
            public bool UseSavedSignature { get; set; } = true;
        }

        /// <summary>POST api/quotation-requests/{id}/accept — creditors clerk accepts, signs as preparer and sends it to the chosen accountant(s).</summary>
        [HttpPost("{id:int}/accept")]
        public async Task<IActionResult> Accept(int id, [FromBody] AcceptDto dto)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            if (q.Status != QuoteFlow.Pending) return Conflict(new { message = "This request has already been accepted." });

            // The clerk confirms (or fixes) the paying company — it decides who may approve.
            var code = string.IsNullOrWhiteSpace(dto.CompanyCode) ? q.CompanyCode : dto.CompanyCode.Trim().ToUpperInvariant();
            if (code == null) return BadRequest(new { message = "Choose the paying company first." });
            var company = await _db.CreditorCompanies.AsNoTracking().Where(c => c.Code == code).Select(c => c.Name).FirstOrDefaultAsync();
            if (company == null) return BadRequest(new { message = "Unknown company." });
            q.CompanyCode = code; q.Company = company;
            if (!await IsClerkAsync(q)) return Forbid();
            if (IsRequester(q) && !IsAdmin) return Conflict(new { message = "You raised this request, so another creditors clerk must accept it." });

            if (q.Files.Count == 0) return BadRequest(new { message = "Add at least one quote before sending it on." });
            if (!string.IsNullOrWhiteSpace(dto.FewerQuotesReason)) q.FewerQuotesReason = Trunc(dto.FewerQuotesReason.Trim(), 500);
            if (q.Files.Count < 3 && string.IsNullOrWhiteSpace(q.FewerQuotesReason)) return BadRequest(new { message = "There are fewer than three quotes — say why before sending it on." });

            var (candidates, _) = await CandidatesAsync(code, false);
            var wanted = (dto.AccountantUserIds ?? Array.Empty<int>()).Distinct().Where(i => i != UserId && i != q.UserId).ToList();
            var chosen = candidates.Where(a => wanted.Contains(a.UserId)).ToList();
            if (wanted.Count == 0 || chosen.Count != wanted.Count) return BadRequest(new { message = "Pick the accountant(s) for this company to send it to." });

            var sig = await ResolveSignatureAsync(dto.SignatureImageBase64, dto.UseSavedSignature);
            if (sig == null) return BadRequest(NoSignature());
            var me = await UserNameAsync();
            q.PreparedByUserId = UserId; q.PreparedByName = me; q.PreparedAt = DateTime.UtcNow;
            q.RequestedAccountantIds = Csv(chosen.Select(a => a.UserId)); q.RequestedAccountantNames = string.Join(", ", chosen.Select(a => a.Name));
            q.RequestedDirectorIds = null; q.RequestedDirectorNames = null;
            q.AccountantUserId = null; q.AccountantName = null; q.AccountantApprovedAt = null; q.AccountantComment = null;
            q.ReturnReason = null;
            q.Status = QuoteFlow.WithAccountant;
            await _sign.SignAsync(new SignatureRequest { EntityType = "QuotationRequest", EntityId = q.Id, Context = "QuotePreparer", SignerUserId = UserId, SignerName = me, SignerRole = "cred.clerk", Action = "Accept", Comment = string.IsNullOrWhiteSpace(dto.Note) ? "Quotes checked" : Trunc(dto.Note.Trim(), 500), Method = sig.Value.Method, IpAddress = Ip(), UserAgent = Ua(), Payload = Snapshot(q), SignatureImage = sig.Value.Bytes, SignatureImageMimeType = sig.Value.Mime });
            await LogAsync(q, "Accepted", $"Sent to {q.RequestedAccountantNames}" + (string.IsNullOrWhiteSpace(dto.Note) ? "" : $" — {dto.Note.Trim()}"));
            await _db.SaveChangesAsync();

            await NotifyAsync(chosen.Select(a => (int?)a.UserId), "Quotation request awaiting your approval", $"Q-{q.Id:0000} · {company} · {q.Subject} · prepared by {me}", q.Id);
            await EmailStepAsync(chosen, q, "check and approve", "Accountant approval", note: dto.Note);
            return Ok(await DtoAsync(q));
        }

        public class ReasonDto { public string? Reason { get; set; } }

        /// <summary>POST api/quotation-requests/{id}/decline — creditors decline it back to the requester (reason required).</summary>
        [HttpPost("{id:int}/decline")]
        public async Task<IActionResult> Decline(int id, [FromBody] ReasonDto dto)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            if (q.Status != QuoteFlow.Pending) return Conflict(new { message = "Only a request still with creditors can be declined." });
            if (!await IsClerkAsync(q)) return Forbid();
            if (string.IsNullOrWhiteSpace(dto.Reason)) return BadRequest(new { message = "Tell the requester why it was declined." });
            var me = await UserNameAsync();
            q.Status = QuoteFlow.Declined; q.ReturnReason = Trunc(dto.Reason.Trim(), 1000);
            q.ReviewedBy = me; q.ReviewedByUserId = UserId; q.ReviewedAt = DateTime.UtcNow; q.ReviewNotes = q.ReturnReason;
            await LogAsync(q, "Declined", q.ReturnReason);
            await _db.SaveChangesAsync();
            await NotifyAsync(new int?[] { q.UserId }, "Quotation request declined", $"Q-{q.Id:0000} · {q.Subject}: {q.ReturnReason}", q.Id, mine: true);
            await EmailOutcomeAsync(q, declinedBy: me);
            return Ok(await DtoAsync(q));
        }

        /// <summary>POST api/quotation-requests/{id}/change-accountant { accountantUserIds } — preparer / clerk moves it to another accountant while it waits.</summary>
        [HttpPost("{id:int}/change-accountant")]
        public async Task<IActionResult> ChangeAccountant(int id, [FromBody] AcceptDto dto)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            if (q.Status != QuoteFlow.WithAccountant) return Conflict(new { message = "Only a request still waiting for the accountant can be moved." });
            if (!await IsClerkAsync(q) && q.PreparedByUserId != UserId) return Forbid();
            var (candidates, _) = await CandidatesAsync(q.CompanyCode, false);
            var wanted = (dto.AccountantUserIds ?? Array.Empty<int>()).Distinct().Where(i => i != q.PreparedByUserId && i != q.UserId && i != UserId).ToList();
            var chosen = candidates.Where(a => wanted.Contains(a.UserId)).ToList();
            if (wanted.Count == 0 || chosen.Count != wanted.Count) return BadRequest(new { message = "Pick the accountant(s) for this company to send it to." });
            var prev = q.RequestedAccountantIdList.ToList(); var prevNames = q.RequestedAccountantNames;
            q.RequestedAccountantIds = Csv(chosen.Select(a => a.UserId)); q.RequestedAccountantNames = string.Join(", ", chosen.Select(a => a.Name));
            await LogAsync(q, "AccountantChanged", $"Moved from {prevNames} to {q.RequestedAccountantNames}" + (string.IsNullOrWhiteSpace(dto.Note) ? "" : $" — {dto.Note.Trim()}"));
            await _db.SaveChangesAsync();
            await NotifyAsync(chosen.Select(a => (int?)a.UserId), "Quotation request awaiting your approval", $"Q-{q.Id:0000} · {q.Company} · {q.Subject} · moved to you by {await UserNameAsync()}", q.Id);
            await EmailStepAsync(chosen, q, "check and approve", "Accountant approval", note: dto.Note);
            var dropped = prev.Where(p => !chosen.Any(c => c.UserId == p)).Select(p => (int?)p).ToList();
            if (dropped.Count > 0) await NotifyAsync(dropped, "Quotation request moved to another accountant", $"Q-{q.Id:0000} was moved to {q.RequestedAccountantNames}. Nothing more for you to do on it.", q.Id);
            return Ok(await DtoAsync(q));
        }

        // ───────────────────────── accountant ─────────────────────────

        public class AccountantDto
        {
            /// <summary>approve | sendback</summary>
            public string Decision { get; set; } = "";
            public string? Comment { get; set; }
            public int[]? DirectorUserIds { get; set; }
            public string? SignatureImageBase64 { get; set; }
            public bool UseSavedSignature { get; set; } = true;
        }

        /// <summary>POST api/quotation-requests/{id}/accountant — approve (sign, → director) or send back to the preparer.</summary>
        [HttpPost("{id:int}/accountant")]
        public async Task<IActionResult> Accountant(int id, [FromBody] AccountantDto dto)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            if (q.Status != QuoteFlow.WithAccountant) return Conflict(new { message = "This request is not waiting for the accountant." });
            if (!await IsAccountantForAsync(q)) return Forbid();
            if (q.PreparedByUserId == UserId && !IsAdmin) return Conflict(new { message = "You prepared this request, so another accountant must approve it." });
            var me = await UserNameAsync();

            if (dto.Decision.Equals("sendback", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest(new { message = "Say what needs fixing when you send it back." });
                q.Status = QuoteFlow.Pending; q.ReturnReason = Trunc(dto.Comment.Trim(), 1000);
                q.RequestedAccountantIds = null; q.RequestedAccountantNames = null;
                await LogAsync(q, "AccountantSentBack", q.ReturnReason);
                await _db.SaveChangesAsync();
                await NotifyAsync(new[] { q.PreparedByUserId }, "Quotation request sent back", $"Q-{q.Id:0000} · {q.Subject}: {q.ReturnReason}", q.Id);
                await EmailSentBackAsync(q, me);
                return Ok(await DtoAsync(q));
            }
            if (!dto.Decision.Equals("approve", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Decision must be approve or sendback." });

            var (candidates, _) = await CandidatesAsync(q.CompanyCode, true);
            var wanted = (dto.DirectorUserIds ?? Array.Empty<int>()).Distinct().Where(i => i != UserId && i != q.PreparedByUserId).ToList();
            var chosen = candidates.Where(a => wanted.Contains(a.UserId)).ToList();
            if (wanted.Count == 0 || chosen.Count != wanted.Count) return BadRequest(new { message = "Pick the director(s) for this company to send it to." });
            var sig = await ResolveSignatureAsync(dto.SignatureImageBase64, dto.UseSavedSignature);
            if (sig == null) return BadRequest(NoSignature());

            q.AccountantUserId = UserId; q.AccountantName = me; q.AccountantApprovedAt = DateTime.UtcNow;
            q.AccountantComment = string.IsNullOrWhiteSpace(dto.Comment) ? null : Trunc(dto.Comment.Trim(), 1000);
            q.RequestedDirectorIds = Csv(chosen.Select(a => a.UserId)); q.RequestedDirectorNames = string.Join(", ", chosen.Select(a => a.Name));
            q.Status = QuoteFlow.WithDirector;
            await _sign.SignAsync(new SignatureRequest { EntityType = "QuotationRequest", EntityId = q.Id, Context = "QuoteAccountant", SignerUserId = UserId, SignerName = me, SignerRole = "cred.accountant", Action = "Approve", Comment = q.AccountantComment, Method = sig.Value.Method, IpAddress = Ip(), UserAgent = Ua(), Payload = Snapshot(q), SignatureImage = sig.Value.Bytes, SignatureImageMimeType = sig.Value.Mime });
            await LogAsync(q, "AccountantApproved", $"Sent to {q.RequestedDirectorNames}" + (q.AccountantComment != null ? $" — {q.AccountantComment}" : ""));
            await _db.SaveChangesAsync();
            await NotifyAsync(chosen.Select(a => (int?)a.UserId), "Quotation request: choose a quote", $"Q-{q.Id:0000} · {q.Company} · {q.Subject} · approved by {me}", q.Id);
            await EmailStepAsync(chosen, q, "choose one quote (or reject all) and sign", "Director decision", approvedBy: me, note: q.AccountantComment);
            return Ok(await DtoAsync(q));
        }

        // ───────────────────────── director ─────────────────────────

        public class DirectorDto
        {
            /// <summary>select | reject</summary>
            public string Decision { get; set; } = "";
            public int? FileId { get; set; }
            public string? Comment { get; set; }
            public string? SignatureImageBase64 { get; set; }
            public bool UseSavedSignature { get; set; } = true;
        }

        /// <summary>POST api/quotation-requests/{id}/director — select one quote and sign, or reject all (reason required).</summary>
        [HttpPost("{id:int}/director")]
        public async Task<IActionResult> Director(int id, [FromBody] DirectorDto dto)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            if (q.Status != QuoteFlow.WithDirector) return Conflict(new { message = "This request is not waiting for the director." });
            if (!await IsDirectorForAsync(q)) return Forbid();
            if (!IsAdmin && (q.PreparedByUserId == UserId || q.AccountantUserId == UserId)) return Conflict(new { message = "You prepared or approved this request, so another director must decide." });

            var select = dto.Decision.Equals("select", StringComparison.OrdinalIgnoreCase);
            var reject = dto.Decision.Equals("reject", StringComparison.OrdinalIgnoreCase);
            if (!select && !reject) return BadRequest(new { message = "Decision must be select or reject." });
            QuotationRequestFile? chosen = null;
            if (select)
            {
                chosen = q.Files.FirstOrDefault(f => f.Id == dto.FileId);
                if (chosen == null) return BadRequest(new { message = "Choose which quote is approved." });
            }
            else if (string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest(new { message = "Say why all the quotes are rejected." });

            var sig = await ResolveSignatureAsync(dto.SignatureImageBase64, dto.UseSavedSignature);
            if (sig == null) return BadRequest(NoSignature());
            var me = await UserNameAsync();
            q.DirectorUserId = UserId; q.DirectorName = me; q.DirectorDecidedAt = DateTime.UtcNow;
            q.DirectorComment = string.IsNullOrWhiteSpace(dto.Comment) ? null : Trunc(dto.Comment.Trim(), 1000);
            q.SelectedFileId = chosen?.Id;
            q.Status = select ? QuoteFlow.Approved : QuoteFlow.Rejected;
            q.ReviewedBy = me; q.ReviewedByUserId = UserId; q.ReviewedAt = DateTime.UtcNow;
            q.ReviewNotes = select ? $"Approved quote {chosen!.QuoteNumber}: {chosen.Supplier ?? chosen.FileName}" + (chosen.Amount is decimal a ? $" · R{a:N2}" : "") : q.DirectorComment;
            await _sign.SignAsync(new SignatureRequest { EntityType = "QuotationRequest", EntityId = q.Id, Context = "QuoteDirector", SignerUserId = UserId, SignerName = me, SignerRole = "cred.director", Action = select ? "SelectQuote" : "RejectAll", Comment = select ? $"Selected: {chosen!.Supplier ?? chosen.FileName}" + (q.DirectorComment != null ? $" — {q.DirectorComment}" : "") : q.DirectorComment, Method = sig.Value.Method, IpAddress = Ip(), UserAgent = Ua(), Payload = Snapshot(q), SignatureImage = sig.Value.Bytes, SignatureImageMimeType = sig.Value.Mime });
            await LogAsync(q, select ? "QuoteSelected" : "AllRejected", select ? q.ReviewNotes : q.DirectorComment);
            await _db.SaveChangesAsync();

            var title = select ? "Quote approved" : "All quotes rejected";
            await NotifyAsync(new[] { q.PreparedByUserId, q.AccountantUserId }, title, $"Q-{q.Id:0000} · {q.Subject}: {q.ReviewNotes}", q.Id);
            await NotifyAsync(new[] { q.UserId }, title, $"Q-{q.Id:0000} · {q.Subject}: {q.ReviewNotes}", q.Id, mine: true);
            await EmailOutcomeAsync(q);
            return Ok(await DtoAsync(q));
        }

        /// <summary>DELETE api/quotation-requests/{id} — requester (before creditors accept it) or an admin.</summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var q = await LoadAsync(id); if (q == null) return NotFound();
            var mine = IsRequester(q) && q.Status == QuoteFlow.Pending && q.PreparedByUserId == null;
            if (!mine && !IsAdmin) return Forbid();
            foreach (var f in q.Files) { try { if (System.IO.File.Exists(f.StoragePath)) System.IO.File.Delete(f.StoragePath); } catch { } }
            _db.QuotationRequests.Remove(q);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ───────────────────────── helpers ─────────────────────────

        private async Task<(byte[] Bytes, string Mime, string Method)?> ResolveSignatureAsync(string? drawnBase64, bool useSaved)
        {
            if (!string.IsNullOrWhiteSpace(drawnBase64))
            {
                try { var bytes = Convert.FromBase64String(drawnBase64.Split(',').Last()); if (bytes.Length > 0) return (bytes, "image/png", "Drawn"); } catch { }
            }
            if (!useSaved) return null;
            var u = await _db.Users.AsNoTracking().Where(x => x.UserId == UserId).Select(x => new { x.SignatureImageData, x.SignatureImageMimeType }).FirstOrDefaultAsync();
            if (u?.SignatureImageData == null) return null;
            return (u.SignatureImageData, u.SignatureImageMimeType ?? "image/png", "Saved");
        }
        private static object NoSignature() => new { message = "A signature is required. Draw one, or save your signature on your profile.", code = "SIGNATURE_REQUIRED" };

        private static object Snapshot(QuotationRequest q) => new
        {
            q.Id, q.Subject, q.Details, q.CompanyCode, q.RequestedBy, q.Status, q.SelectedFileId, q.FewerQuotesReason,
            quotes = q.Files.OrderBy(f => f.QuoteNumber).Select(f => new { f.Id, f.QuoteNumber, f.Supplier, f.Amount, f.FileName, f.Size })
        };

        private string? Ip() => HttpContext.Connection.RemoteIpAddress?.ToString();
        private string? Ua() => Request.Headers.UserAgent.ToString() is { Length: > 0 } s ? (s.Length > 500 ? s[..500] : s) : null;

        private async Task NotifyAsync(IEnumerable<int?> userIds, string title, string body, int id, bool mine = false)
        {
            var ids = userIds.Where(i => i is > 0).Select(i => i!.Value).Distinct().ToList();
            if (ids.Count == 0) return;
            try { await _notify.NotifyUsersAsync(ids, new NotificationPayload { Type = "info", Title = title, Body = body, Url = mine ? "/finance" : $"/finance?tab=approvals&section=quotes&quote={id}" }); }
            catch (Exception e) { _log.LogWarning(e, "Quotation notification failed"); }
        }

        private string IntranetUrl()
        {
            var u = _cfg["Intranet:PublicUrl"] ?? _cfg["App:PublicUrl"];
            if (string.IsNullOrWhiteSpace(u)) u = Request.Headers.Origin.ToString();
            if (string.IsNullOrWhiteSpace(u)) u = $"{Request.Scheme}://{Request.Host}";
            return u.TrimEnd('/');
        }

        private static string H(string? s) => System.Net.WebUtility.HtmlEncode(s ?? "");

        private static string QuotesTable(QuotationRequest q) =>
            "<table style='border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%'>" +
            string.Concat(q.Files.OrderBy(f => f.QuoteNumber).Select(f =>
                $"<tr style='{(f.Id == q.SelectedFileId ? "background:#f0fdf4;font-weight:600" : "")}'><td style='padding:6px 10px;border-top:1px solid #e5e7eb'>Quote {f.QuoteNumber}</td><td style='padding:6px 10px;border-top:1px solid #e5e7eb'>{H(f.Supplier ?? f.FileName)}{(f.Id == q.SelectedFileId ? " ✔ selected" : "")}</td><td style='padding:6px 10px;border-top:1px solid #e5e7eb;text-align:right;white-space:nowrap'>{(f.Amount is decimal a ? "R " + a.ToString("N2") : "—")}</td></tr>")) +
            "</table>";

        private static string Shell(string colour, string heading, string sub, string body) => $@"
<div style='font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#1f2937'>
  <div style='background:{colour};color:#fff;padding:18px 24px;border-radius:12px 12px 0 0'><h2 style='margin:0;font-size:18px'>{heading}</h2><div style='opacity:.9;font-size:13px'>{sub}</div></div>
  <div style='border:1px solid #e5e7eb;border-top:0;padding:22px 24px;border-radius:0 0 12px 12px'>{body}</div>
</div>";

        /// <summary>E-mail the next approvers: "Quotation request Q-0001 … please check and approve / choose a quote".</summary>
        private async Task EmailStepAsync(IEnumerable<Approver> people, QuotationRequest q, string ask, string step, string? approvedBy = null, string? note = null)
        {
            var link = $"{IntranetUrl()}/finance?tab=approvals&section=quotes&quote={q.Id}";
            // Directors can decide off-site on the exec portal.
            var execLink = q.Status == QuoteFlow.WithDirector && ExecAuth.PublicUrl(_cfg) is { } pub ? $"{pub}/quote/{q.Id}" : null;
            var subject = $"[Intranet] Quotation request Q-{q.Id:0000} — {q.Company} · {q.Subject} — please {ask}";
            foreach (var p in people.Where(p => !string.IsNullOrWhiteSpace(p.Email)))
            {
                var body = $@"
    <p style='margin:0 0 12px'>Hi {H(p.Name.Split(' ')[0])},</p>
    <p style='margin:0 0 14px'>Quotation request <b>Q-{q.Id:0000}</b> from <b>{H(q.RequestedBy)}</b>{(string.IsNullOrWhiteSpace(q.Department) ? "" : $" ({H(q.Department)})")} was accepted by <b>{H(q.PreparedByName)}</b>{(approvedBy != null ? $" and approved by <b>{H(approvedBy)}</b>" : "")}. You are requested to <b>{H(ask)}</b> on the intranet.</p>
    <p style='margin:0 0 6px'><b>For:</b> {H(q.Subject)}</p>
    {(string.IsNullOrWhiteSpace(q.Details) ? "" : $"<p style='margin:0 0 12px;color:#4b5563'>{H(q.Details)}</p>")}
    {QuotesTable(q)}
    {(string.IsNullOrWhiteSpace(q.FewerQuotesReason) ? "" : $"<p style='margin:0 0 12px;color:#92400e'>Fewer than three quotes: {H(q.FewerQuotesReason)}</p>")}
    {(string.IsNullOrWhiteSpace(note) ? "" : $"<p style='margin:0 0 12px'><b>Note:</b> {H(note)}</p>")}
    <a href='{link}' style='display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600'>Open it on the intranet</a>
    {(execLink != null ? $"<a href='{execLink}' style='display:inline-block;margin-left:8px;background:#fff;color:#4f46e5;border:1px solid #4f46e5;text-decoration:none;padding:9px 18px;border-radius:8px;font-weight:600'>Decide off-site (phone / home)</a>" : "")}
    <p style='margin:18px 0 0;font-size:12px;color:#6b7280'>Sent automatically by the intranet. If the button doesn't work, copy this link: {link}{(execLink != null ? $" — or, away from the office: {execLink}" : "")}</p>";
                await SendAsync(new[] { p.Email! }, subject, Shell("#4f46e5", "Quotation request awaiting you", H(step), body));
            }
        }

        /// <summary>Accountant sent it back: tell the preparer what to fix.</summary>
        private async Task EmailSentBackAsync(QuotationRequest q, string by)
        {
            var to = await _db.Users.AsNoTracking().Where(u => u.UserId == q.PreparedByUserId).Select(u => new { u.Email, u.Name }).FirstOrDefaultAsync();
            if (string.IsNullOrWhiteSpace(to?.Email)) return;
            var link = $"{IntranetUrl()}/finance?tab=approvals&section=quotes&quote={q.Id}";
            var body = $@"
    <p style='margin:0 0 12px'>Hi {H((to.Name ?? "").Split(' ')[0])},</p>
    <p style='margin:0 0 14px'><b>{H(by)}</b> sent quotation request <b>Q-{q.Id:0000}</b> ({H(q.Subject)}) back to you.</p>
    <p style='margin:0 0 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;color:#991b1b'><b>What needs fixing:</b> {H(q.ReturnReason)}</p>
    <p style='margin:0 0 16px'>Fix the quotes on the intranet and send it to the accountant again.</p>
    <a href='{link}' style='display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600'>Open it on the intranet</a>";
            await SendAsync(new[] { to.Email! }, $"[Intranet] Quotation request Q-{q.Id:0000} sent back — {q.Subject}", Shell("#b45309", "Quotation request sent back", $"{H(q.Company)} · Q-{q.Id:0000}", body));
        }

        /// <summary>Final outcome (approved / all rejected / declined by creditors) to the requester and the preparer, with the quote approval sheet attached.</summary>
        private async Task EmailOutcomeAsync(QuotationRequest q, string? declinedBy = null)
        {
            var ids = new[] { q.UserId, q.PreparedByUserId }.Where(i => i is > 0).Select(i => i!.Value).Distinct().ToList();
            var people = await _db.Users.AsNoTracking().Where(u => ids.Contains(u.UserId) && u.Email != null && u.Email != "").Select(u => u.Email!).ToListAsync();
            if (!string.IsNullOrWhiteSpace(q.RequestedByEmail) && !people.Contains(q.RequestedByEmail, StringComparer.OrdinalIgnoreCase)) people.Add(q.RequestedByEmail);
            if (people.Count == 0) return;

            var sel = q.Files.FirstOrDefault(f => f.Id == q.SelectedFileId);
            string colour, heading, lead;
            if (q.Status == QuoteFlow.Approved && sel != null)
            {
                colour = "#15803d"; heading = "Quote approved";
                lead = $"<b>{H(q.DirectorName)}</b> approved <b>quote {sel.QuoteNumber}: {H(sel.Supplier ?? sel.FileName)}</b>{(sel.Amount is decimal a ? $" for <b>R {a:N2}</b>" : "")}.{(string.IsNullOrWhiteSpace(q.DirectorComment) ? "" : $"<br/><i>“{H(q.DirectorComment)}”</i>")}";
            }
            else if (q.Status == QuoteFlow.Rejected)
            {
                colour = "#b91c1c"; heading = "All quotes rejected";
                lead = $"<b>{H(q.DirectorName)}</b> rejected all the quotes.<br/><b>Reason:</b> {H(q.DirectorComment)}";
            }
            else
            {
                colour = "#b91c1c"; heading = "Quotation request declined";
                lead = $"<b>{H(declinedBy)}</b> in Creditors declined the request.<br/><b>Reason:</b> {H(q.ReturnReason)}";
            }
            var body = $@"
    <p style='margin:0 0 14px'>Quotation request <b>Q-{q.Id:0000}</b> for <b>{H(q.Subject)}</b>, requested by {H(q.RequestedBy)}:</p>
    <p style='margin:0 0 16px'>{lead}</p>
    {QuotesTable(q)}
    {(q.Status == QuoteFlow.Declined ? "" : "<p style='margin:0 0 6px'>The signed <b>quote approval sheet</b> is attached.</p>")}
    <p style='margin:18px 0 0;font-size:12px;color:#6b7280'>Sent automatically by the intranet.</p>";
            List<EmailAttachment>? att = null;
            if (q.Status != QuoteFlow.Declined)
            {
                try { att = new() { new EmailAttachment { FileName = $"Quote-approval-Q-{q.Id:0000}.pdf", Content = await _pdf.QuoteApprovalSheetAsync(q), ContentType = "application/pdf" } }; }
                catch (Exception e) { _log.LogWarning(e, "Quote approval sheet for Q-{Id} failed", q.Id); }
            }
            await SendAsync(people, $"[Intranet] {heading} — Q-{q.Id:0000} · {q.Subject}", Shell(colour, heading, $"{H(q.Company)} · Q-{q.Id:0000}", body), att);
        }

        private async Task SendAsync(IEnumerable<string> to, string subject, string html, List<EmailAttachment>? att = null)
        {
            foreach (var e in to.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                try { if (!await _email.SendEmailAsync(e, subject, html, true, att)) _log.LogWarning("Quotation email to {Email} failed: {Err}", e, _email.LastError); }
                catch (Exception ex) { _log.LogWarning(ex, "Quotation email to {Email} failed", e); }
            }
        }
    }
}
