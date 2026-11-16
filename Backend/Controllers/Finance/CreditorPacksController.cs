using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance.Creditors;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.Finance;
using ProjectTracker.API.Services.Signatures;

namespace ProjectTracker.API.Controllers.Finance;

/// <summary>
/// Creditors payment packs: prepare → automatic checks → company accountant → director e-signature
/// → bank load → paid → closed. See <see cref="CreditorWorkflow"/> for statuses and roles.
/// </summary>
[Authorize]
[ApiController]
[Route("api/finance/creditors")]
[RequireModule("finance", AlsoAllowRoles = "Finance,Manager,Admin")]
public class CreditorPacksController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CreditorChecksService _checks;
    private readonly ISignatureService _sign;
    private readonly INotificationBroadcaster _notify;
    private readonly ILogger<CreditorPacksController> _log;
    private readonly string _root;
    private const long MaxFileBytes = 20L * 1024 * 1024;

    public CreditorPacksController(ApplicationDbContext db, CreditorChecksService checks, ISignatureService sign,
        INotificationBroadcaster notify, IConfiguration cfg, ILogger<CreditorPacksController> log)
    {
        _db = db; _checks = checks; _sign = sign; _notify = notify; _log = log;
        _root = cfg.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
    }

    // ───────────────────────── identity & roles ─────────────────────────

    private int UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
    private string? _fullName;
    private string UserName
    {
        get
        {
            if (_fullName != null) return _fullName;
            var p = _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => new { u.Name, u.Surname }).FirstOrDefault();
            var full = ($"{p?.Name} {p?.Surname}").Trim();
            return _fullName = full.Length > 0 ? full : (User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? "");
        }
    }
    private string UserRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "";
    private bool IsSystemAdmin => UserRole is "Admin" or "Super Admin";

    private HashSet<string>? _perms;
    private async Task<HashSet<string>> PermsAsync()
    {
        if (_perms != null) return _perms;
        var raw = await _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => u.Permissions).FirstOrDefaultAsync() ?? "";
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (raw.TrimStart().StartsWith("["))
        {
            try { foreach (var s in JsonSerializer.Deserialize<string[]>(raw) ?? Array.Empty<string>()) set.Add(s); } catch { }
        }
        else foreach (var s in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) set.Add(s);
        return _perms = set;
    }

    private async Task<bool> HasAsync(string role) => IsSystemAdmin || (await PermsAsync()).Contains(role) || (await PermsAsync()).Contains("*");

    private async Task<bool> IsAccountantForAsync(CreditorCompany? c)
    {
        if (IsSystemAdmin) return true;
        if (!await HasAsync(CreditorWorkflow.RoleAccountant)) return false;
        if (c == null || (c.AccountantUserId == null && c.BackupApproverUserId == null)) return true; // not yet configured: any accountant
        return c.AccountantUserId == UserId || c.BackupApproverUserId == UserId;
    }

    private async Task<bool> IsDirectorForAsync(CreditorCompany? c)
    {
        if (IsSystemAdmin) return true;
        if (!await HasAsync(CreditorWorkflow.RoleDirector)) return false;
        if (c == null || (c.DirectorUserId == null && c.DelegateDirectorUserId == null)) return true;
        return c.DirectorUserId == UserId || c.DelegateDirectorUserId == UserId;
    }

    private async Task<bool> CanPrepareAsync(PaymentBatch b) =>
        IsSystemAdmin || (await HasAsync(CreditorWorkflow.RoleClerk) && (b.PreparedByUserId == UserId || await HasAsync(CreditorWorkflow.RoleAdmin) || true));

    // ───────────────────────── meta & companies ─────────────────────────

    [HttpGet("meta")]
    public async Task<IActionResult> Meta()
    {
        var perms = await PermsAsync();
        var companies = await CompaniesDtoAsync();
        return Ok(new
        {
            companies,
            paymentTypes = CreditorPaymentTypes.All.Select(p => new { key = p.Key, title = p.Title }),
            docTypes = CreditorDocTypes.All.Select(d => new { key = d.Key, title = d.Title, scope = d.Scope }),
            rules = CreditorPaymentTypes.All.ToDictionary(p => p.Key, p => CreditorDocRules.For(p.Key).Select(r => new { r.DocType, r.Required, r.AfterDelivery, r.IfReturned })),
            statuses = new[] { CreditorWorkflow.Draft, CreditorWorkflow.ChecksFailed, CreditorWorkflow.AwaitingAccountant, CreditorWorkflow.QueriedByAccountant, CreditorWorkflow.AwaitingDirector, CreditorWorkflow.QueriedByDirector, CreditorWorkflow.Rejected, CreditorWorkflow.Approved, CreditorWorkflow.LoadedOnBank, CreditorWorkflow.Paid, CreditorWorkflow.Closed }
                .Select(s => new { key = s, title = CreditorWorkflow.Title(s) }),
            roles = CreditorWorkflow.Roles.Select(r => new { key = r.Key, title = r.Title, description = r.Description }),
            me = new
            {
                userId = UserId,
                isAdmin = IsSystemAdmin || perms.Contains(CreditorWorkflow.RoleAdmin),
                clerk = IsSystemAdmin || perms.Contains(CreditorWorkflow.RoleClerk),
                accountant = IsSystemAdmin || perms.Contains(CreditorWorkflow.RoleAccountant),
                director = IsSystemAdmin || perms.Contains(CreditorWorkflow.RoleDirector),
                bank = IsSystemAdmin || perms.Contains(CreditorWorkflow.RoleBank),
                readOnly = perms.Contains(CreditorWorkflow.RoleReadOnly),
            }
        });
    }

    private async Task<List<object>> CompaniesDtoAsync()
    {
        var cs = await _db.CreditorCompanies.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync();
        var ids = cs.SelectMany(c => new[] { c.AccountantUserId, c.BackupApproverUserId, c.DirectorUserId, c.DelegateDirectorUserId }).Where(i => i != null).Select(i => i!.Value).Distinct().ToList();
        var names = await _db.Users.AsNoTracking().Where(u => ids.Contains(u.UserId)).ToDictionaryAsync(u => u.UserId, u => u.Name + " " + u.Surname);
        string? N(int? id) => id != null && names.TryGetValue(id.Value, out var n) ? n : null;
        return cs.Select(c => (object)new
        {
            c.Id, c.Code, c.Name, c.Activity, c.IsActive, c.SortOrder,
            c.AccountantUserId, accountantName = N(c.AccountantUserId),
            c.BackupApproverUserId, backupApproverName = N(c.BackupApproverUserId),
            c.DirectorUserId, directorName = N(c.DirectorUserId),
            c.DelegateDirectorUserId, delegateDirectorName = N(c.DelegateDirectorUserId),
        }).ToList();
    }

    public record CompanyUpsert(string Code, string Name, string? Activity, int? AccountantUserId, int? BackupApproverUserId, int? DirectorUserId, int? DelegateDirectorUserId, bool IsActive, int SortOrder);

    [HttpPut("companies/{id:int}")]
    public async Task<IActionResult> UpdateCompany(int id, [FromBody] CompanyUpsert dto)
    {
        if (!await HasAsync(CreditorWorkflow.RoleAdmin)) return Forbid();
        var c = await _db.CreditorCompanies.FindAsync(id);
        if (c == null) return NotFound();
        c.Name = dto.Name.Trim(); c.Code = dto.Code.Trim().ToUpperInvariant(); c.Activity = dto.Activity;
        c.AccountantUserId = dto.AccountantUserId; c.BackupApproverUserId = dto.BackupApproverUserId;
        c.DirectorUserId = dto.DirectorUserId; c.DelegateDirectorUserId = dto.DelegateDirectorUserId;
        c.IsActive = dto.IsActive; c.SortOrder = dto.SortOrder;
        await _db.SaveChangesAsync();
        return Ok((await CompaniesDtoAsync()).First(x => (int)x.GetType().GetProperty("Id")!.GetValue(x)! == id));
    }

    [HttpPost("companies")]
    public async Task<IActionResult> AddCompany([FromBody] CompanyUpsert dto)
    {
        if (!await HasAsync(CreditorWorkflow.RoleAdmin)) return Forbid();
        if (await _db.CreditorCompanies.AnyAsync(c => c.Code == dto.Code.ToUpper())) return Conflict(new { message = "A company with that code already exists." });
        var c = new CreditorCompany { Code = dto.Code.Trim().ToUpperInvariant(), Name = dto.Name.Trim(), Activity = dto.Activity, AccountantUserId = dto.AccountantUserId, BackupApproverUserId = dto.BackupApproverUserId, DirectorUserId = dto.DirectorUserId, DelegateDirectorUserId = dto.DelegateDirectorUserId, IsActive = dto.IsActive, SortOrder = dto.SortOrder };
        _db.CreditorCompanies.Add(c);
        await _db.SaveChangesAsync();
        return Ok(c);
    }

    /// <summary>Lightweight user list for the approver pickers.</summary>
    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] string? search)
    {
        var q = _db.Users.AsNoTracking().Where(u => u.IsActive);
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(u => u.Name.Contains(search) || u.Surname.Contains(search) || u.Email.Contains(search));
        return Ok(await q.OrderBy(u => u.Name).Take(200).Select(u => new { Id = u.UserId, name = u.Name + " " + u.Surname, u.Email, u.Role, u.Permissions }).ToListAsync());
    }

    /// <summary>Grant/revoke a creditors role on a user (admin only). Keeps other permissions intact.</summary>
    public record RoleToggle(int UserId, string Role, bool Grant);
    [HttpPost("roles")]
    public async Task<IActionResult> ToggleRole([FromBody] RoleToggle dto)
    {
        if (!await HasAsync(CreditorWorkflow.RoleAdmin)) return Forbid();
        if (!CreditorWorkflow.Roles.Any(r => r.Key == dto.Role)) return BadRequest(new { message = "Unknown role." });
        var u = await _db.Users.FindAsync(dto.UserId);
        if (u == null) return NotFound();
        var set = new List<string>();
        var raw = u.Permissions ?? "";
        if (raw.TrimStart().StartsWith("[")) { try { set = (JsonSerializer.Deserialize<string[]>(raw) ?? Array.Empty<string>()).ToList(); } catch { } }
        else set = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        set.RemoveAll(s => s.Equals(dto.Role, StringComparison.OrdinalIgnoreCase));
        if (dto.Grant) set.Add(dto.Role);
        u.Permissions = string.Join(",", set.Distinct());
        await _db.SaveChangesAsync();
        return Ok(new { Id = u.UserId, u.Permissions });
    }

    // ───────────────────────── batches ─────────────────────────

    [HttpGet("batches")]
    public async Task<IActionResult> List([FromQuery] string? company, [FromQuery] string? status, [FromQuery] string? type, [FromQuery] int take = 200)
    {
        var q = _db.PaymentBatches.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(company)) q = q.Where(b => b.CompanyCode == company);
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(b => b.Status == status);
        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(b => b.PaymentType == type);
        var rows = await q.OrderByDescending(b => b.Id).Take(take).Select(b => new
        {
            b.Id, b.BatchNumber, b.CompanyCode, b.PaymentType, b.BatchDate, b.Status, statusTitle = CreditorWorkflow.Title(b.Status),
            b.TotalAmount, items = b.Items.Count, documents = b.Documents.Count(d => d.StoragePath != null),
            b.PreparedByUserId, b.PreparedByName, b.CreatedAt, b.SubmittedAt, b.UpdatedAt, b.ChecksStatus, b.AccountantName, b.AccountantApprovedAt, b.DirectorName, b.DirectorSignedAt,
            b.PaidAt, b.ClosedAt, b.ReturnReason, openPrepayments = b.Items.Count(i => i.PrepaymentOpen),
            approvedItems = b.Items.Count(i => i.DecisionStatus == "Approved"), queriedItems = b.Items.Count(i => i.DecisionStatus == "Queried"), rejectedItems = b.Items.Count(i => i.DecisionStatus == "Rejected")
        }).ToListAsync();
        return Ok(rows);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var by = await _db.PaymentBatches.AsNoTracking().GroupBy(b => b.Status).Select(g => new { status = g.Key, count = g.Count(), amount = g.Sum(b => b.TotalAmount) }).ToListAsync();
        var openPrepay = await _db.PaymentBatchItems.AsNoTracking().CountAsync(i => i.PrepaymentOpen);
        return Ok(new { byStatus = by, openPrepayments = openPrepay });
    }

    public record BatchCreate(string CompanyCode, string PaymentType, DateTime? BatchDate, string? Notes);

    [HttpPost("batches")]
    public async Task<IActionResult> Create([FromBody] BatchCreate dto)
    {
        if (!await HasAsync(CreditorWorkflow.RoleClerk)) return Forbid();
        if (!await _db.CreditorCompanies.AnyAsync(c => c.Code == dto.CompanyCode && c.IsActive)) return BadRequest(new { message = "Unknown paying company." });
        if (!CreditorPaymentTypes.All.Any(p => p.Key == dto.PaymentType)) return BadRequest(new { message = "Unknown payment type." });

        var year = DateTime.UtcNow.Year;
        var prefix = $"CB-{year}-";
        var last = await _db.PaymentBatches.Where(b => b.BatchNumber.StartsWith(prefix)).OrderByDescending(b => b.BatchNumber).Select(b => b.BatchNumber).FirstOrDefaultAsync();
        var seq = last != null && int.TryParse(last[prefix.Length..], out var n) ? n + 1 : 1;

        var b = new PaymentBatch
        {
            BatchNumber = $"{prefix}{seq:0000}", CompanyCode = dto.CompanyCode, PaymentType = dto.PaymentType,
            BatchDate = (dto.BatchDate ?? DateTime.UtcNow).Date, Notes = dto.Notes, PreparedByUserId = UserId, PreparedByName = UserName
        };
        _db.PaymentBatches.Add(b);
        b.Events.Add(Ev("Created", null, CreditorWorkflow.Draft, null));
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(b.Id));
    }

    [HttpGet("batches/{id:int}")]
    public async Task<IActionResult> Get(int id) => (await DetailAsync(id)) is { } d ? Ok(d) : NotFound();

    public record BatchUpdate(DateTime? BatchDate, string? Notes, string? PaymentType);

    [HttpPut("batches/{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] BatchUpdate dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        if (dto.BatchDate != null) b.BatchDate = dto.BatchDate.Value.Date;
        if (dto.Notes != null) b.Notes = dto.Notes;
        if (dto.PaymentType != null && CreditorPaymentTypes.All.Any(p => p.Key == dto.PaymentType)) b.PaymentType = dto.PaymentType;
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    [HttpDelete("batches/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.Draft) return Conflict(new { message = "Only draft batches can be deleted." });
        if (!await CanPrepareAsync(b)) return Forbid();
        foreach (var d in b.Documents.Where(d => d.StoragePath != null)) TryDelete(Abs(d.StoragePath!));
        _db.PaymentBatches.Remove(b);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ───────────────────────── items ─────────────────────────

    public record ItemDto(string SupplierName, string? SupplierVatNumber, string? InvoiceNumbers, string? Description, decimal Amount,
        string? BankName, string? AccountNumber, string? BranchCode, string? AccountHolder, string? PaymentReference, bool StockReturned);

    [HttpPost("batches/{id:int}/items")]
    public async Task<IActionResult> AddItem(int id, [FromBody] ItemDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        var it = new PaymentBatchItem { BatchId = id, SortOrder = b.Items.Count + 1, PrepaymentOpen = b.PaymentType == CreditorPaymentTypes.Prepayment };
        Apply(it, dto);
        b.Items.Add(it);
        Recalc(b);
        b.Events.Add(Ev("ItemAdded", null, null, $"{dto.SupplierName} R{dto.Amount:N2}"));
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    [HttpPut("batches/{id:int}/items/{itemId:int}")]
    public async Task<IActionResult> UpdateItem(int id, int itemId, [FromBody] ItemDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        Apply(it, dto);
        if (b.Status is CreditorWorkflow.QueriedByDirector && it.DecisionStatus == "Queried") { it.DecisionStatus = "Pending"; it.DecisionComment = null; }
        Recalc(b);
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    [HttpDelete("batches/{id:int}/items/{itemId:int}")]
    public async Task<IActionResult> DeleteItem(int id, int itemId)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        foreach (var d in b.Documents.Where(d => d.ItemId == itemId).ToList()) { if (d.StoragePath != null) TryDelete(Abs(d.StoragePath)); _db.PaymentBatchDocuments.Remove(d); }
        _db.PaymentBatchItems.Remove(it);
        b.Items.Remove(it);
        Recalc(b);
        b.Events.Add(Ev("ItemRemoved", null, null, it.SupplierName));
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    private static void Apply(PaymentBatchItem it, ItemDto d)
    {
        it.SupplierName = d.SupplierName.Trim(); it.SupplierVatNumber = d.SupplierVatNumber?.Replace(" ", ""); it.InvoiceNumbers = d.InvoiceNumbers?.Trim();
        it.Description = d.Description; it.Amount = d.Amount; it.BankName = d.BankName; it.AccountNumber = d.AccountNumber?.Replace(" ", "");
        it.BranchCode = d.BranchCode; it.AccountHolder = d.AccountHolder; it.PaymentReference = d.PaymentReference; it.StockReturned = d.StockReturned;
    }

    private static void Recalc(PaymentBatch b) { b.TotalAmount = b.Items.Sum(i => i.Amount); b.UpdatedAt = DateTime.UtcNow; }

    // ───────────────────────── documents ─────────────────────────

    /// <summary>Upload one PDF (one document). After lock only ProofOfPayment and prepayment closing docs (TaxInvoice, GRV) may be added, and replacements need a reason.</summary>
    [HttpPost("batches/{id:int}/documents")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> Upload(int id, IFormFile file, [FromForm] string? docType, [FromForm] int? itemId, [FromForm] int? supersedesDocumentId, [FromForm] string? versionReason)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (file == null || file.Length == 0) return BadRequest(new { message = "No file." });
        if (file.Length > MaxFileBytes) return BadRequest(new { message = "File is larger than 20 MB." });
        var isPdf = file.ContentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) == true || Path.GetExtension(file.FileName).Equals(".pdf", StringComparison.OrdinalIgnoreCase);
        if (!isPdf) return BadRequest(new { message = "PDF only — one document per file." });
        if (itemId != null && b.Items.All(i => i.Id != itemId)) return BadRequest(new { message = "That payment is not on this batch." });

        var locked = CreditorWorkflow.Locked.Contains(b.Status);
        var editable = CreditorWorkflow.PreparerEditable.Contains(b.Status);
        if (!locked && !editable) return Conflict(new { message = "The batch is with an approver — documents can't change now." });
        if (!await CanPrepareAsync(b) && !await HasAsync(CreditorWorkflow.RoleBank)) return Forbid();

        // Read the file once: hash + text
        byte[] bytes;
        using (var ms = new MemoryStream()) { await file.CopyToAsync(ms); bytes = ms.ToArray(); }
        var sha = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (b.Documents.Any(d => d.Sha256 == sha)) return Conflict(new { message = "This exact file is already on the batch." });

        var rel = $"Finance/Creditors/{b.CompanyCode}/{b.BatchNumber}/{Guid.NewGuid():N}.pdf";
        var abs = Abs(rel);
        Directory.CreateDirectory(Path.GetDirectoryName(abs)!);
        await System.IO.File.WriteAllBytesAsync(abs, bytes);

        var ex = await _checks.ReadAsync(abs, file.ContentType, file.FileName);
        if (ex.Encrypted) { TryDelete(abs); return BadRequest(new { message = "Password-protected PDFs are not accepted." }); }

        var type = !string.IsNullOrWhiteSpace(docType) && CreditorDocTypes.All.Any(d => d.Key == docType) ? docType! : (ex.SuggestedType ?? CreditorDocTypes.Other);
        if (locked)
        {
            var allowedAfterLock = type is CreditorDocTypes.ProofOfPayment or CreditorDocTypes.TaxInvoice or CreditorDocTypes.Grv;
            if (!allowedAfterLock) { TryDelete(abs); return Conflict(new { message = "The batch is signed and locked. Only proof of payment and prepayment closing documents can be added." }); }
            if (supersedesDocumentId != null && string.IsNullOrWhiteSpace(versionReason)) { TryDelete(abs); return BadRequest(new { message = "A reason is required to replace a document on a locked batch." }); }
        }

        var doc = new PaymentBatchDocument
        {
            BatchId = id, ItemId = itemId, DocType = type, SuggestedDocType = ex.SuggestedType,
            FileName = Path.GetFileName(rel), OriginalFileName = file.FileName, ContentType = "application/pdf", Size = bytes.Length,
            StoragePath = rel, Sha256 = sha, PageCount = ex.Pages, ExtractedText = ex.Text, TextMethod = ex.Method,
            DocumentDate = ex.DocumentDate, ExtractedAccountNumber = ex.AccountNumber, ExtractedVatNumber = ex.VatNumber, ExtractedInvoiceNumber = ex.InvoiceNumber, ExtractedAmount = ex.Amount,
            UploadedByUserId = UserId, UploadedByName = UserName, SupersedesDocumentId = supersedesDocumentId, VersionReason = versionReason
        };
        if (supersedesDocumentId != null && b.Documents.FirstOrDefault(d => d.Id == supersedesDocumentId) is { } prev) doc.Version = prev.Version + 1;
        // An N/A placeholder for the same slot is replaced by the real file
        var na = b.Documents.FirstOrDefault(d => d.IsNotApplicable && d.DocType == type && d.ItemId == itemId);
        if (na != null && !locked) _db.PaymentBatchDocuments.Remove(na);

        b.Documents.Add(doc);
        b.Events.Add(Ev("DocumentUploaded", null, null, $"{CreditorChecksService.Label(type)} · {file.FileName}" + (itemId != null ? $" · {b.Items.First(i => i.Id == itemId).SupplierName}" : "")));

        // Prepayment closing: tax invoice + GRV both present ⇒ item closed
        if (locked && itemId != null) ClosePrepaymentIfComplete(b, itemId.Value);
        if (locked && type == CreditorDocTypes.ProofOfPayment && itemId != null) b.Items.First(i => i.Id == itemId).PaidAt ??= DateTime.UtcNow;

        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    public record NaDto(string DocType, int? ItemId, string Reason);

    [HttpPost("batches/{id:int}/documents/na")]
    public async Task<IActionResult> MarkNa(int id, [FromBody] NaDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Trim().Length < 5) return BadRequest(new { message = "Give a reason (at least a few words) why this document does not apply." });
        if (b.Documents.Any(d => d.DocType == dto.DocType && d.ItemId == dto.ItemId && (d.IsNotApplicable || d.StoragePath != null))) return Conflict(new { message = "That document slot is already filled." });
        b.Documents.Add(new PaymentBatchDocument { BatchId = id, ItemId = dto.ItemId, DocType = dto.DocType, IsNotApplicable = true, NaReason = dto.Reason.Trim(), UploadedByUserId = UserId, UploadedByName = UserName });
        b.Events.Add(Ev("DocumentNA", null, null, $"{CreditorChecksService.Label(dto.DocType)} marked N/A: {dto.Reason}"));
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    public record DocUpdate(string? DocType, int? ItemId, DateTime? DocumentDate);

    [HttpPut("batches/{id:int}/documents/{docId:int}")]
    public async Task<IActionResult> UpdateDoc(int id, int docId, [FromBody] DocUpdate dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var d = b.Documents.FirstOrDefault(x => x.Id == docId); if (d == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        if (dto.DocType != null && CreditorDocTypes.All.Any(x => x.Key == dto.DocType)) d.DocType = dto.DocType;
        if (dto.ItemId != null) d.ItemId = dto.ItemId == 0 ? null : dto.ItemId;
        if (dto.DocumentDate != null) d.DocumentDate = dto.DocumentDate;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    [HttpDelete("batches/{id:int}/documents/{docId:int}")]
    public async Task<IActionResult> DeleteDoc(int id, int docId)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var d = b.Documents.FirstOrDefault(x => x.Id == docId); if (d == null) return NotFound();
        if (CreditorWorkflow.Locked.Contains(b.Status)) return Conflict(new { message = "The batch is signed and locked — files cannot be removed. Upload a replacement with a reason instead." });
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch is with an approver." });
        if (!await CanPrepareAsync(b)) return Forbid();
        if (d.StoragePath != null) TryDelete(Abs(d.StoragePath));
        _db.PaymentBatchDocuments.Remove(d);
        b.Events.Add(Ev("DocumentRemoved", null, null, $"{CreditorChecksService.Label(d.DocType)} · {d.OriginalFileName ?? "N/A"}"));
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    [HttpGet("batches/{id:int}/documents/{docId:int}/file")]
    public async Task<IActionResult> File(int id, int docId, [FromQuery] bool download = false)
    {
        var d = await _db.PaymentBatchDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == docId && x.BatchId == id);
        if (d?.StoragePath == null) return NotFound();
        var abs = Abs(d.StoragePath);
        if (!System.IO.File.Exists(abs)) return NotFound();
        if (!download) Response.Headers["Content-Disposition"] = $"inline; filename=\"{d.OriginalFileName ?? d.FileName}\"";
        return PhysicalFile(abs, "application/pdf", download ? (d.OriginalFileName ?? d.FileName) : null);
    }

    // ───────────────────────── workflow ─────────────────────────

    /// <summary>Preparer submits: checks run; FAIL → back to preparer, otherwise → company accountant.</summary>
    [HttpPost("batches/{id:int}/submit")]
    public async Task<IActionResult> Submit(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch has already been submitted." });
        if (!await CanPrepareAsync(b)) return Forbid();

        var res = await RunChecksAsync(b);
        var from = b.Status;
        b.SubmittedAt = DateTime.UtcNow;
        if (res.Status == "FAIL")
        {
            b.Status = CreditorWorkflow.ChecksFailed;
            b.ReturnReason = $"{res.Fail} check(s) failed: " + string.Join("; ", res.Findings.Where(f => f.Severity == "FAIL").Take(4).Select(f => f.Title));
            b.Events.Add(Ev("Submitted", from, b.Status, b.ReturnReason));
        }
        else
        {
            b.Status = CreditorWorkflow.AwaitingAccountant;
            b.ReturnReason = null;
            foreach (var it in b.Items.Where(i => i.DecisionStatus == "Queried")) { it.DecisionStatus = "Pending"; it.DecisionComment = null; }
            b.Events.Add(Ev("Submitted", from, b.Status, res.Status == "REVIEW" ? $"{res.Review} item(s) for the accountant to review" : "All checks passed"));
            var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
            await NotifyAsync(new[] { c?.AccountantUserId, c?.BackupApproverUserId }, "Payment pack awaiting your approval", $"{b.BatchNumber} · {b.CompanyCode} · R{b.TotalAmount:N2} · {CreditorChecksService.Label(b.PaymentType)}", b.Id);
        }
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    [HttpPost("batches/{id:int}/checks")]
    public async Task<IActionResult> RerunChecks(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        await RunChecksAsync(b);
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    private async Task<CreditorChecksService.Result> RunChecksAsync(PaymentBatch b)
    {
        var res = await _checks.RunAsync(b);
        b.ChecksRunAt = res.RanAt; b.ChecksStatus = res.Status; b.ChecksJson = CreditorChecksService.Serialize(res);
        return res;
    }

    public record DecisionDto(string Decision, string? Comment);

    /// <summary>Company accountant: approve (→ director) or query (→ preparer). Mandatory before the director can sign.</summary>
    [HttpPost("batches/{id:int}/accountant")]
    public async Task<IActionResult> Accountant(int id, [FromBody] DecisionDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.AwaitingAccountant) return Conflict(new { message = "The batch is not awaiting the accountant." });
        var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
        if (!await IsAccountantForAsync(c)) return Forbid();
        if (b.PreparedByUserId == UserId && !IsSystemAdmin) return Conflict(new { message = "The preparer cannot approve their own batch." });

        var approve = dto.Decision.Equals("approve", StringComparison.OrdinalIgnoreCase);
        if (!approve && string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest(new { message = "Say what needs fixing when you send a pack back." });

        var from = b.Status;
        if (approve)
        {
            b.Status = CreditorWorkflow.AwaitingDirector;
            b.AccountantUserId = UserId; b.AccountantName = UserName; b.AccountantApprovedAt = DateTime.UtcNow; b.AccountantComment = dto.Comment;
            await _sign.SignAsync(new SignatureRequest { EntityType = "PaymentBatch", EntityId = b.Id, Context = "AccountantApproval", SignerUserId = UserId, SignerName = UserName, SignerRole = CreditorWorkflow.RoleAccountant, Action = "Approve", Comment = dto.Comment, Method = "Click", IpAddress = Ip(), UserAgent = Ua(), Payload = Snapshot(b) });
            b.Events.Add(Ev("AccountantApproved", from, b.Status, dto.Comment));
            await NotifyAsync(new[] { c?.DirectorUserId, c?.DelegateDirectorUserId }, "Payment pack ready for sign-off", $"{b.BatchNumber} · {b.CompanyCode} · R{b.TotalAmount:N2} · approved by {UserName}", b.Id);
        }
        else
        {
            b.Status = CreditorWorkflow.QueriedByAccountant;
            b.ReturnReason = dto.Comment;
            b.Events.Add(Ev("AccountantQueried", from, b.Status, dto.Comment));
            await NotifyAsync(new[] { (int?)b.PreparedByUserId }, "Payment pack sent back", $"{b.BatchNumber}: {dto.Comment}", b.Id);
        }
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    /// <summary>Director decides each payment: Approved | Queried | Rejected.</summary>
    [HttpPost("batches/{id:int}/items/{itemId:int}/decision")]
    public async Task<IActionResult> Decide(int id, int itemId, [FromBody] DecisionDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.AwaitingDirector) return Conflict(new { message = "The batch is not with the director." });
        var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
        if (!await IsDirectorForAsync(c)) return Forbid();
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        var d = dto.Decision switch { "Approved" => "Approved", "Queried" => "Queried", "Rejected" => "Rejected", "Pending" => "Pending", _ => null };
        if (d == null) return BadRequest(new { message = "Decision must be Approved, Queried or Rejected." });
        if (d != "Approved" && d != "Pending" && string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest(new { message = "Give a reason when querying or rejecting a payment." });
        it.DecisionStatus = d; it.DecisionComment = dto.Comment; it.DecidedAt = DateTime.UtcNow;
        b.Events.Add(Ev("ItemDecision", null, null, $"{it.SupplierName} R{it.Amount:N2} → {d}" + (dto.Comment != null ? $": {dto.Comment}" : "")));
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    public record SignDto(string TypedName, string? Comment, string? SignatureImageBase64);

    /// <summary>
    /// Director signs the batch. Disabled until the accountant has approved and every payment has a decision.
    /// Any Queried payment ⇒ batch goes back to the preparer. All Rejected ⇒ Rejected. Otherwise ⇒ Approved + locked.
    /// </summary>
    [HttpPost("batches/{id:int}/sign")]
    public async Task<IActionResult> Sign(int id, [FromBody] SignDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.AwaitingDirector) return Conflict(new { message = "The batch is not awaiting the director." });
        if (b.AccountantApprovedAt == null) return Conflict(new { message = "The company accountant has not approved this pack yet." });
        var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
        if (!await IsDirectorForAsync(c)) return Forbid();
        if (b.Items.Any(i => i.DecisionStatus == "Pending")) return Conflict(new { message = "Approve, query or reject every payment before signing." });
        var profile = await _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => new { u.Name, u.Surname }).FirstOrDefaultAsync();
        var expected = ($"{profile?.Name} {profile?.Surname}").Trim();
        if (string.IsNullOrWhiteSpace(expected)) expected = UserName.Trim();
        var typed = (dto.TypedName ?? "").Trim();
        if (!string.Equals(typed, expected, StringComparison.OrdinalIgnoreCase) && !string.Equals(typed, UserName.Trim(), StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = $"Type your full name exactly as it appears on your profile ({expected}) to sign." });

        var from = b.Status;
        if (b.Items.Any(i => i.DecisionStatus == "Queried"))
        {
            b.Status = CreditorWorkflow.QueriedByDirector;
            b.ReturnReason = "Director queries: " + string.Join("; ", b.Items.Where(i => i.DecisionStatus == "Queried").Select(i => $"{i.SupplierName}: {i.DecisionComment}"));
            b.Events.Add(Ev("DirectorQueried", from, b.Status, dto.Comment ?? b.ReturnReason));
            await NotifyAsync(new[] { (int?)b.PreparedByUserId, b.AccountantUserId }, "Director queried a payment pack", $"{b.BatchNumber}: {b.ReturnReason}", b.Id);
        }
        else if (b.Items.All(i => i.DecisionStatus == "Rejected"))
        {
            b.Status = CreditorWorkflow.Rejected;
            b.ReturnReason = "All payments rejected by the director.";
            b.Events.Add(Ev("DirectorRejected", from, b.Status, dto.Comment));
            await NotifyAsync(new[] { (int?)b.PreparedByUserId, b.AccountantUserId }, "Payment pack rejected", $"{b.BatchNumber} rejected by {UserName}", b.Id);
        }
        else
        {
            b.Status = CreditorWorkflow.Approved;
            b.LockedAt = DateTime.UtcNow;
            b.ReturnReason = null;
            b.LockHash = Hash(Snapshot(b));
            b.Events.Add(Ev("DirectorSigned", from, b.Status, $"{b.Items.Count(i => i.DecisionStatus == "Approved")} payment(s) approved, R{b.Items.Where(i => i.DecisionStatus == "Approved").Sum(i => i.Amount):N2}. Batch locked."));
            var bankUsers = await _db.Users.AsNoTracking().Where(u => u.IsActive && u.Permissions != null && u.Permissions.Contains(CreditorWorkflow.RoleBank)).Select(u => (int?)u.UserId).ToListAsync();
            await NotifyAsync(bankUsers.Append(b.PreparedByUserId), "Payment pack approved — load on bank", $"{b.BatchNumber} · {b.CompanyCode} · R{b.Items.Where(i => i.DecisionStatus == "Approved").Sum(i => i.Amount):N2}", b.Id);
        }
        b.DirectorUserId = UserId; b.DirectorName = UserName; b.DirectorSignedAt = DateTime.UtcNow; b.DirectorComment = dto.Comment;

        byte[]? img = null;
        if (!string.IsNullOrWhiteSpace(dto.SignatureImageBase64)) { try { img = Convert.FromBase64String(dto.SignatureImageBase64.Split(',').Last()); } catch { } }
        await _sign.SignAsync(new SignatureRequest
        {
            EntityType = "PaymentBatch", EntityId = b.Id, Context = "DirectorSignOff", SignerUserId = UserId, SignerName = UserName, SignerRole = CreditorWorkflow.RoleDirector,
            Action = b.Status == CreditorWorkflow.Approved ? "Approve" : b.Status == CreditorWorkflow.Rejected ? "Reject" : "Return",
            Comment = dto.Comment, Method = img != null ? "Drawn" : "Typed", IpAddress = Ip(), UserAgent = Ua(), Payload = Snapshot(b), SignatureImage = img, SignatureImageMimeType = img != null ? "image/png" : null
        });
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    /// <summary>Bank file (CSV) for approved payments only. Marks the batch exported.</summary>
    [HttpGet("batches/{id:int}/bank-file")]
    public async Task<IActionResult> BankFile(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!CreditorWorkflow.Locked.Contains(b.Status)) return Conflict(new { message = "Only a signed batch can be exported." });
        if (!await HasAsync(CreditorWorkflow.RoleBank)) return Forbid();
        var sb = new StringBuilder();
        sb.AppendLine("BeneficiaryName,BankName,BranchCode,AccountNumber,Amount,MyReference,BeneficiaryReference");
        foreach (var it in b.Items.Where(i => i.DecisionStatus == "Approved").OrderBy(i => i.SortOrder))
            sb.AppendLine(string.Join(",", Csv(it.AccountHolder ?? it.SupplierName), Csv(it.BankName), Csv(it.BranchCode), Csv(it.AccountNumber), it.Amount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), Csv($"{b.CompanyCode} {b.BatchNumber}"), Csv(it.PaymentReference ?? it.InvoiceNumbers ?? b.BatchNumber)));
        if (b.BankExportedAt == null) { b.BankExportedAt = DateTime.UtcNow; b.BankExportedByUserId = UserId; b.Events.Add(Ev("BankFileExported", null, null, $"{b.Items.Count(i => i.DecisionStatus == "Approved")} approved payment(s)")); await _db.SaveChangesAsync(); }
        return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray(), "text/csv", $"{b.BatchNumber}-bank.csv");
    }

    [HttpPost("batches/{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] DecisionDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var from = b.Status;
        switch (dto.Decision)
        {
            case "LoadedOnBank":
                if (b.Status != CreditorWorkflow.Approved) return Conflict(new { message = "Only an approved batch can be marked loaded." });
                if (!await HasAsync(CreditorWorkflow.RoleBank)) return Forbid();
                b.Status = CreditorWorkflow.LoadedOnBank; break;
            case "Paid":
                if (b.Status is not (CreditorWorkflow.Approved or CreditorWorkflow.LoadedOnBank)) return Conflict(new { message = "Only a loaded batch can be marked paid." });
                if (!await HasAsync(CreditorWorkflow.RoleBank)) return Forbid();
                b.Status = CreditorWorkflow.Paid; b.PaidAt = DateTime.UtcNow;
                foreach (var it in b.Items.Where(i => i.DecisionStatus == "Approved")) it.PaidAt ??= b.PaidAt;
                await NotifyAsync(new[] { (int?)b.PreparedByUserId }, "Payments released — upload proof of payment", $"{b.BatchNumber} paid. Upload the POP for each payment to close the batch.", b.Id);
                break;
            case "Closed":
                if (b.Status != CreditorWorkflow.Paid) return Conflict(new { message = "Only a paid batch can be closed." });
                if (!await CanPrepareAsync(b)) return Forbid();
                var approved = b.Items.Where(i => i.DecisionStatus == "Approved").ToList();
                var missingPop = approved.Where(i => !b.Documents.Any(d => d.ItemId == i.Id && d.DocType == CreditorDocTypes.ProofOfPayment && d.StoragePath != null)).ToList();
                if (missingPop.Count > 0) return Conflict(new { message = "Proof of payment missing for: " + string.Join(", ", missingPop.Select(i => i.SupplierName)) });
                var openPrepay = approved.Where(i => i.PrepaymentOpen).ToList();
                if (openPrepay.Count > 0) return Conflict(new { message = "Prepayments still open (tax invoice + GRV needed): " + string.Join(", ", openPrepay.Select(i => i.SupplierName)) });
                b.Status = CreditorWorkflow.Closed; b.ClosedAt = DateTime.UtcNow; break;
            case "Draft":
                // Preparer takes a sent-back / rejected batch back into editing
                if (b.Status is not (CreditorWorkflow.ChecksFailed or CreditorWorkflow.QueriedByAccountant or CreditorWorkflow.QueriedByDirector or CreditorWorkflow.Rejected)) return Conflict(new { message = "This batch can't be reopened." });
                if (!await CanPrepareAsync(b)) return Forbid();
                b.Status = CreditorWorkflow.Draft; b.AccountantApprovedAt = null; b.AccountantUserId = null; b.AccountantName = null;
                foreach (var it in b.Items) { it.DecisionStatus = "Pending"; it.DecisionComment = null; it.DecidedAt = null; }
                break;
            default: return BadRequest(new { message = "Unknown status." });
        }
        b.Events.Add(Ev("StatusChanged", from, b.Status, dto.Comment));
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    // ───────────────────────── alerts (fraud & control) ─────────────────────────

    [HttpGet("alerts")]
    public async Task<IActionResult> Alerts()
    {
        var open = await _db.PaymentBatches.AsNoTracking()
            .Where(b => b.Status != CreditorWorkflow.Closed && b.Status != CreditorWorkflow.Rejected && b.ChecksJson != null)
            .Select(b => new { b.Id, b.BatchNumber, b.CompanyCode, b.Status, b.ChecksJson }).ToListAsync();
        var alerts = new List<object>();
        foreach (var b in open)
        {
            CreditorChecksService.Result? r = null;
            try { r = JsonSerializer.Deserialize<CreditorChecksService.Result>(b.ChecksJson!, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); } catch { }
            if (r == null) continue;
            foreach (var f in r.Findings.Where(f => f.Code is "C11" or "C2" or "C3" or "C4" or "C12" or "C10" && f.Severity != "PASS"))
                alerts.Add(new { batchId = b.Id, b.BatchNumber, b.CompanyCode, status = b.Status, f.Code, f.Title, f.Severity, f.Detail, f.Supplier });
        }
        var stalePrepay = await _db.PaymentBatchItems.AsNoTracking().Where(i => i.PrepaymentOpen && i.PaidAt != null && i.PaidAt < DateTime.UtcNow.AddDays(-30))
            .Select(i => new { batchId = i.BatchId, i.Batch!.BatchNumber, i.Batch.CompanyCode, status = i.Batch.Status, Code = "C13", Title = "Prepayment open > 30 days", Severity = "REVIEW", Detail = $"{i.SupplierName} paid {i.PaidAt:dd MMM} — tax invoice / GRV still outstanding.", Supplier = i.SupplierName }).ToListAsync();
        alerts.AddRange(stalePrepay);
        return Ok(alerts);
    }

    // ───────────────────────── detail DTO ─────────────────────────

    private Task<PaymentBatch?> Load(int id) => _db.PaymentBatches.Include(b => b.Items).Include(b => b.Documents).Include(b => b.Events).FirstOrDefaultAsync(b => b.Id == id);

    private async Task<object?> DetailAsync(int id)
    {
        var b = await _db.PaymentBatches.AsNoTracking().Include(x => x.Items).Include(x => x.Documents).Include(x => x.Events).FirstOrDefaultAsync(x => x.Id == id);
        if (b == null) return null;
        var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
        var sigs = await _sign.GetForEntityAsync("PaymentBatch", b.Id);
        var closing = CreditorWorkflow.Locked.Contains(b.Status);

        bool Filled(string dt, int? itemId) => b.Documents.Any(d => d.DocType == dt && d.ItemId == itemId && (d.IsNotApplicable || d.StoragePath != null));
        var batchReq = CreditorDocRules.RequiredForBatch(b.PaymentType).Select(dt => new { docType = dt, title = CreditorChecksService.Label(dt), filled = Filled(dt, null) }).ToList();
        var itemReq = b.Items.ToDictionary(i => i.Id, i => CreditorDocRules.RequiredForItem(b.PaymentType, i.StockReturned, closing).Select(dt => new { docType = dt, title = CreditorChecksService.Label(dt), filled = Filled(dt, i.Id) }).ToList());
        var allFilled = batchReq.All(r => r.filled) && itemReq.Values.All(l => l.All(r => r.filled)) && b.Items.Count > 0;

        var canPrepare = await CanPrepareAsync(b);
        var isAcc = await IsAccountantForAsync(c);
        var isDir = await IsDirectorForAsync(c);
        var isBank = await HasAsync(CreditorWorkflow.RoleBank);
        var editable = CreditorWorkflow.PreparerEditable.Contains(b.Status);

        object? checks = null;
        if (b.ChecksJson != null) { try { checks = JsonSerializer.Deserialize<JsonElement>(b.ChecksJson); } catch { } }

        return new
        {
            b.Id, b.BatchNumber, b.CompanyCode, companyName = c?.Name ?? b.CompanyCode, b.PaymentType, paymentTypeTitle = CreditorChecksService.Label(b.PaymentType),
            b.BatchDate, b.Status, statusTitle = CreditorWorkflow.Title(b.Status), b.Notes, b.TotalAmount,
            approvedAmount = b.Items.Where(i => i.DecisionStatus == "Approved").Sum(i => i.Amount),
            b.PreparedByUserId, b.PreparedByName, b.CreatedAt, b.SubmittedAt, b.UpdatedAt,
            b.ChecksRunAt, b.ChecksStatus, checks,
            b.AccountantUserId, b.AccountantName, b.AccountantApprovedAt, b.AccountantComment,
            b.DirectorUserId, b.DirectorName, b.DirectorSignedAt, b.DirectorComment,
            b.LockedAt, b.LockHash, b.BankExportedAt, b.PaidAt, b.ClosedAt, b.ReturnReason,
            responsible = new { accountant = c?.AccountantUserId, backup = c?.BackupApproverUserId, director = c?.DirectorUserId, delegateDirector = c?.DelegateDirectorUserId },
            items = b.Items.OrderBy(i => i.SortOrder).Select(i => new
            {
                i.Id, i.SupplierName, i.SupplierVatNumber, i.InvoiceNumbers, i.Description, i.Amount, i.BankName, i.AccountNumber, i.BranchCode, i.AccountHolder, i.PaymentReference,
                i.StockReturned, i.DecisionStatus, i.DecisionComment, i.DecidedAt, i.PrepaymentOpen, i.PaidAt, i.SortOrder,
                required = itemReq[i.Id],
                documents = b.Documents.Where(d => d.ItemId == i.Id).OrderBy(d => d.DocType).ThenBy(d => d.Version).Select(DocDto)
            }),
            batchDocuments = b.Documents.Where(d => d.ItemId == null).OrderBy(d => d.DocType).Select(DocDto),
            requiredBatchDocs = batchReq,
            readyToSubmit = allFilled,
            events = b.Events.OrderByDescending(e => e.At).Select(e => new { e.Id, e.At, e.UserName, e.Action, e.FromStatus, e.ToStatus, e.Comment }),
            signatures = sigs.Select(s => new { s.Id, s.Context, s.SignerName, s.SignerRole, s.Action, s.Comment, s.Method, s.SignedAtUtc, s.PayloadHash, hasImage = s.SignatureImage != null }),
            can = new
            {
                edit = editable && canPrepare,
                submit = editable && canPrepare && allFilled,
                reopen = canPrepare && b.Status is CreditorWorkflow.ChecksFailed or CreditorWorkflow.QueriedByAccountant or CreditorWorkflow.QueriedByDirector or CreditorWorkflow.Rejected,
                accountant = b.Status == CreditorWorkflow.AwaitingAccountant && isAcc && (b.PreparedByUserId != UserId || IsSystemAdmin),
                direct = b.Status == CreditorWorkflow.AwaitingDirector && isDir,
                sign = b.Status == CreditorWorkflow.AwaitingDirector && isDir && b.AccountantApprovedAt != null && b.Items.All(i => i.DecisionStatus != "Pending"),
                bankFile = CreditorWorkflow.Locked.Contains(b.Status) && isBank,
                markLoaded = b.Status == CreditorWorkflow.Approved && isBank,
                markPaid = b.Status is CreditorWorkflow.Approved or CreditorWorkflow.LoadedOnBank && isBank,
                close = b.Status == CreditorWorkflow.Paid && canPrepare,
                uploadAfterLock = CreditorWorkflow.Locked.Contains(b.Status) && (canPrepare || isBank),
                rerunChecks = canPrepare || isAcc || isDir
            }
        };
    }

    private static object DocDto(PaymentBatchDocument d) => new
    {
        d.Id, d.ItemId, d.DocType, title = CreditorChecksService.Label(d.DocType), d.SuggestedDocType, d.IsNotApplicable, d.NaReason,
        d.OriginalFileName, d.Size, d.PageCount, d.TextMethod, d.DocumentDate, d.ExtractedAccountNumber, d.ExtractedVatNumber, d.ExtractedInvoiceNumber, d.ExtractedAmount,
        d.UploadedByName, d.UploadedAt, d.Version, d.SupersedesDocumentId, d.VersionReason, d.Sha256
    };

    // ───────────────────────── helpers ─────────────────────────

    private PaymentBatchEvent Ev(string action, string? from, string? to, string? comment) => new() { Action = action, FromStatus = from, ToStatus = to, Comment = comment?.Length > 2000 ? comment[..2000] : comment, UserId = UserId, UserName = UserName };

    private static void ClosePrepaymentIfComplete(PaymentBatch b, int itemId)
    {
        var it = b.Items.First(i => i.Id == itemId);
        if (!it.PrepaymentOpen) return;
        var hasInv = b.Documents.Any(d => d.ItemId == itemId && d.DocType == CreditorDocTypes.TaxInvoice && d.StoragePath != null);
        var hasGrv = b.Documents.Any(d => d.ItemId == itemId && d.DocType == CreditorDocTypes.Grv && d.StoragePath != null);
        if (hasInv && hasGrv) { it.PrepaymentOpen = false; b.Events.Add(new PaymentBatchEvent { Action = "PrepaymentClosed", Comment = it.SupplierName, UserId = 0, UserName = "System" }); }
    }

    private static object Snapshot(PaymentBatch b) => new
    {
        b.BatchNumber, b.CompanyCode, b.PaymentType, b.BatchDate, b.TotalAmount,
        items = b.Items.OrderBy(i => i.Id).Select(i => new { i.Id, i.SupplierName, i.InvoiceNumbers, i.Amount, i.AccountNumber, i.BranchCode, i.DecisionStatus }),
        documents = b.Documents.Where(d => d.StoragePath != null).OrderBy(d => d.Id).Select(d => new { d.Id, d.DocType, d.Sha256 })
    };

    private static string Hash(object o) => Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(o))).ToLowerInvariant();

    private async Task NotifyAsync(IEnumerable<int?> userIds, string title, string body, int batchId)
    {
        var ids = userIds.Where(i => i is > 0).Select(i => i!.Value).Distinct().ToList();
        if (ids.Count == 0) return;
        try { await _notify.NotifyUsersAsync(ids, new NotificationPayload { Type = "info", Title = title, Body = body, Url = $"/finance?tab=creditors&batch={batchId}" }); }
        catch (Exception e) { _log.LogWarning(e, "Creditors notification failed"); }
    }

    private string Abs(string rel) => Path.Combine(_root, rel.Replace('/', Path.DirectorySeparatorChar));
    private static void TryDelete(string p) { try { if (System.IO.File.Exists(p)) System.IO.File.Delete(p); } catch { } }
    private string? Ip() => HttpContext.Connection.RemoteIpAddress?.ToString();
    private string? Ua() => Request.Headers.UserAgent.ToString() is { Length: > 0 } s ? (s.Length > 500 ? s[..500] : s) : null;
    private static string Csv(string? s) => s == null ? "" : (s.Contains(',') || s.Contains('"') ? "\"" + s.Replace("\"", "\"\"") + "\"" : s);
}
