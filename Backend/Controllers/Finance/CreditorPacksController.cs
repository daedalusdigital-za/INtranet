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
[Authorize(AuthenticationSchemes = "Bearer," + ExecAuth.Scheme)]
[ApiController]
[Route("api/finance/creditors")]
[RequireModule("finance", AlsoAllowRoles = "Finance,Manager,Admin")]
public class CreditorPacksController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CreditorChecksService _checks;
    private readonly ISignatureService _sign;
    private readonly INotificationBroadcaster _notify;
    private readonly IEmailService _email;
    private readonly IConfiguration _cfg;
    private readonly CreditorPackPdfService _packPdf;
    private readonly ILogger<CreditorPacksController> _log;
    private readonly string _root;
    private const long MaxFileBytes = 20L * 1024 * 1024;

    public CreditorPacksController(ApplicationDbContext db, CreditorChecksService checks, ISignatureService sign,
        INotificationBroadcaster notify, IEmailService email, IConfiguration cfg, CreditorPackPdfService packPdf, ILogger<CreditorPacksController> log,
        Microsoft.Extensions.Caching.Memory.IMemoryCache cache)
    {
        _db = db; _checks = checks; _sign = sign; _notify = notify; _email = email; _cfg = cfg; _packPdf = packPdf; _log = log; _cache = cache;
        _root = cfg.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
    }

    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;
    private CompanyScope? _scope;
    /// <summary>Companies the caller may see (admins: all; others: their assigned operating companies).</summary>
    private async Task<CompanyScope> ScopeAsync() => _scope ??= await CompanyAccess.ForUserAsync(_db, User, _cache);
    private async Task<bool> InScopeAsync(string? companyCode) => (await ScopeAsync()).Allows(companyCode);

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
    // Explicit ticks ∪ what the job role implies (Director → sign, Treasurer → bank, Accountant → approve, Creditor Clerk → prepare)
    private async Task<HashSet<string>> PermsAsync() => _perms ??= await FinanceAuthority.EffectiveAsync(_db, User);

    private async Task<bool> HasAsync(string role) => IsSystemAdmin || (await PermsAsync()).Contains(role) || (await PermsAsync()).Contains("*");

    private Dictionary<string, CompanyApprovers>? _approvers;
    /// <summary>Approvers per paying company (job role + company assignment, or the pinned override). Loaded once per request.</summary>
    private async Task<Dictionary<string, CompanyApprovers>> ApproversAsync() => _approvers ??= await ApproverResolver.AllAsync(_db);
    private async Task<CompanyApprovers> ApproversForAsync(string? code)
    {
        var all = await ApproversAsync();
        return code != null && all.TryGetValue(code, out var a) ? a : new CompanyApprovers { CompanyCode = code ?? "" };
    }

    private async Task<bool> IsAccountantForAsync(CreditorCompany? c)
    {
        if (IsSystemAdmin) return true;
        if (!await HasAsync(CreditorWorkflow.RoleAccountant)) return false;
        if (c == null) return true;
        var a = await ApproversForAsync(c.Code);
        return a.Accountants.Count == 0 || a.IsAccountant(UserId); // nobody assigned to this company yet: any accountant
    }

    private async Task<bool> IsDirectorForAsync(CreditorCompany? c)
    {
        if (IsSystemAdmin) return true;
        if (!await HasAsync(CreditorWorkflow.RoleDirector)) return false;
        if (c == null) return true;
        var a = await ApproversForAsync(c.Code);
        return a.Directors.Count == 0 || a.IsDirector(UserId);
    }

    /// <summary>Company accountant AND (if the preparer picked specific people) one of them.</summary>
    private async Task<bool> IsAccountantForAsync(PaymentBatch b, CreditorCompany? c)
    {
        if (IsSystemAdmin) return true;
        if (!await IsAccountantForAsync(c)) return false;
        var req = b.RequestedApproverIdList;
        return req.Count == 0 || req.Contains(UserId);
    }

    private async Task<bool> IsDirectorForAsync(PaymentBatch b, CreditorCompany? c)
    {
        if (IsSystemAdmin) return true;
        if (!await IsDirectorForAsync(c)) return false;
        var req = b.RequestedDirectorIdList;
        return req.Count == 0 || req.Contains(UserId);
    }

    /// <summary>Preparer of the pack, or a finance admin. Any clerk assigned to the company may also pick up a colleague's pack.</summary>
    private async Task<bool> CanPrepareAsync(PaymentBatch b) =>
        IsSystemAdmin || (await HasAsync(CreditorWorkflow.RoleClerk) && (b.PreparedByUserId == UserId || await HasAsync(CreditorWorkflow.RoleAdmin) || await InScopeAsync(b.CompanyCode)));

    /// <summary>Segregation of duties: the person signing as director may not be the preparer or the approving accountant of the same pack.</summary>
    private string? DirectorConflict(PaymentBatch b)
    {
        if (IsSystemAdmin) return null; // same bypass the accountant step gives system admins
        if (b.PreparedByUserId == UserId) return "You prepared this pack, so you cannot sign it as director. Another director must sign.";
        if (b.AccountantUserId == UserId) return "You approved this pack as accountant, so you cannot also sign it as director. Another director must sign.";
        return null;
    }

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
            paymentModes = CreditorPaymentModes.All.Select(m => new { key = m, title = CreditorPaymentModes.Title(m) }),
            complianceKinds = CreditorComplianceKinds.All.Select(k => new { key = k.Key, title = k.Title }),
            rules = CreditorPaymentTypes.All.ToDictionary(p => p.Key, p => CreditorDocRules.For(p.Key).Select(r => new { r.DocType, r.Required, r.AfterDelivery, r.IfReturned, r.WithRecon })),
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
                hasSignature = await _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => u.SignatureImageData != null).FirstOrDefaultAsync(),
            }
        });
    }

    private async Task<List<object>> CompaniesDtoAsync()
    {
        var scope = await ScopeAsync();
        var cs = await _db.CreditorCompanies.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync();
        var ids = cs.SelectMany(c => new[] { c.AccountantUserId, c.BackupApproverUserId, c.DirectorUserId, c.DelegateDirectorUserId }).Where(i => i != null).Select(i => i!.Value).Distinct().ToList();
        var names = await _db.Users.AsNoTracking().Where(u => ids.Contains(u.UserId)).ToDictionaryAsync(u => u.UserId, u => u.Name + " " + u.Surname);
        var approvers = await ApproversAsync();
        string? N(int? id) => id != null && names.TryGetValue(id.Value, out var n) ? n : null;
        return cs.Select(c =>
        {
            approvers.TryGetValue(c.Code, out var a);
            object People(IEnumerable<Approver>? list) => (list ?? Enumerable.Empty<Approver>()).Select(p => new { userId = p.UserId, p.Name, p.Role, p.Email, p.Pinned }).ToList();
            return (object)new
            {
                c.Id, c.Code, c.Name, c.Activity, c.IsActive, c.SortOrder, c.OperatingCompanyId,
                allowed = scope.Allows(c.Code),
                c.AccountantUserId, accountantName = N(c.AccountantUserId),
                c.BackupApproverUserId, backupApproverName = N(c.BackupApproverUserId),
                c.DirectorUserId, directorName = N(c.DirectorUserId),
                c.DelegateDirectorUserId, delegateDirectorName = N(c.DelegateDirectorUserId),
                // Who actually approves / signs / pays / prepares for this company (job role + Users › Companies, or the pinned override)
                approvers = new
                {
                    accountants = People(a?.Accountants), directors = People(a?.Directors), treasurers = People(a?.Treasurers), clerks = People(a?.Clerks),
                    accountantsPinned = a?.AccountantsPinned ?? false, directorsPinned = a?.DirectorsPinned ?? false
                }
            };
        }).ToList();
    }

    public record CompanyUpsert(string Code, string Name, string? Activity, int? AccountantUserId, int? BackupApproverUserId, int? DirectorUserId, int? DelegateDirectorUserId, bool IsActive, int SortOrder, int? OperatingCompanyId = null);

    /// <summary>Picking someone as a company's accountant/director implies the role — grant it so they don't have to be ticked separately first.</summary>
    private async Task EnsureRolesForCompanyAsync(CompanyUpsert dto)
    {
        var wanted = new List<(int? userId, string role)>
        {
            (dto.AccountantUserId, CreditorWorkflow.RoleAccountant), (dto.BackupApproverUserId, CreditorWorkflow.RoleAccountant),
            (dto.DirectorUserId, CreditorWorkflow.RoleDirector), (dto.DelegateDirectorUserId, CreditorWorkflow.RoleDirector)
        };
        foreach (var (userId, role) in wanted)
        {
            if (userId is not int id) continue;
            var u = await _db.Users.FindAsync(id);
            if (u == null) continue;
            var raw = u.Permissions ?? "";
            List<string> set;
            if (raw.TrimStart().StartsWith("[")) { try { set = (JsonSerializer.Deserialize<string[]>(raw) ?? Array.Empty<string>()).ToList(); } catch { set = new(); } }
            else set = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            if (set.Any(s => s.Equals(role, StringComparison.OrdinalIgnoreCase))) continue;
            set.Add(role);
            u.Permissions = string.Join(",", set.Distinct());
        }
    }

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
        if (dto.OperatingCompanyId != null) c.OperatingCompanyId = dto.OperatingCompanyId == 0 ? null : dto.OperatingCompanyId;
        await EnsureRolesForCompanyAsync(dto);
        await _db.SaveChangesAsync();
        return Ok((await CompaniesDtoAsync()).First(x => (int)x.GetType().GetProperty("Id")!.GetValue(x)! == id));
    }

    [HttpPost("companies")]
    public async Task<IActionResult> AddCompany([FromBody] CompanyUpsert dto)
    {
        if (!await HasAsync(CreditorWorkflow.RoleAdmin)) return Forbid();
        if (await _db.CreditorCompanies.AnyAsync(c => c.Code == dto.Code.ToUpper())) return Conflict(new { message = "A company with that code already exists." });
        var c = new CreditorCompany { Code = dto.Code.Trim().ToUpperInvariant(), Name = dto.Name.Trim(), Activity = dto.Activity, AccountantUserId = dto.AccountantUserId, BackupApproverUserId = dto.BackupApproverUserId, DirectorUserId = dto.DirectorUserId, DelegateDirectorUserId = dto.DelegateDirectorUserId, IsActive = dto.IsActive, SortOrder = dto.SortOrder, OperatingCompanyId = dto.OperatingCompanyId == 0 ? null : dto.OperatingCompanyId };
        _db.CreditorCompanies.Add(c);
        await EnsureRolesForCompanyAsync(dto);
        await _db.SaveChangesAsync();
        return Ok(c);
    }

    /// <summary>Lightweight user list for the approver pickers. <c>effective</c> = ticked permissions ∪ what the job role implies.</summary>
    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] string? search)
    {
        var q = _db.Users.AsNoTracking().Where(u => u.IsActive);
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(u => u.Name.Contains(search) || u.Surname.Contains(search) || u.Email.Contains(search));
        var rows = await q.OrderBy(u => u.Name).Take(300).Select(u => new { u.UserId, u.Name, u.Surname, u.Email, u.Role, u.Title, u.Permissions, Department = u.Department != null ? u.Department.Name : null }).ToListAsync();
        return Ok(rows.Select(u =>
        {
            var eff = FinanceAuthority.Parse(u.Permissions);
            foreach (var p in FinanceAuthority.ImpliedBy(u.Role, u.Department)) eff.Add(p);
            return new { Id = u.UserId, name = (u.Name + " " + u.Surname).Trim(), u.Email, u.Role, u.Title, u.Department, u.Permissions, effective = eff.OrderBy(x => x).ToArray() };
        }));
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
        var scope = await ScopeAsync();
        if (!string.IsNullOrWhiteSpace(company) && !scope.Allows(company)) return StatusCode(403, new { message = "You are not assigned to that company." });
        var q = _db.PaymentBatches.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(company)) q = q.Where(b => b.CompanyCode == company);
        else if (!scope.All) { var codes = scope.CreditorCodes.ToList(); q = q.Where(b => codes.Contains(b.CompanyCode)); }
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(b => b.Status == status);
        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(b => b.PaymentType == type);
        var rows = await q.OrderByDescending(b => b.Id).Take(take).Select(b => new
        {
            b.Id, b.BatchNumber, b.CompanyCode, b.PaymentType, b.BatchDate, b.Status, statusTitle = CreditorWorkflow.Title(b.Status),
            b.TotalAmount, items = b.Items.Count, documents = b.Documents.Count(d => d.StoragePath != null),
            b.PreparedByUserId, b.PreparedByName, b.CreatedAt, b.SubmittedAt, b.UpdatedAt, b.ChecksStatus, b.AccountantName, b.AccountantApprovedAt, b.DirectorName, b.DirectorSignedAt,
            b.PaidAt, b.ClosedAt, b.ReturnReason, b.ScheduledPayDate, openPrepayments = b.Items.Count(i => i.PrepaymentOpen),
            approvedItems = b.Items.Count(i => i.DecisionStatus == "Approved"), queriedItems = b.Items.Count(i => i.DecisionStatus == "Queried"), rejectedItems = b.Items.Count(i => i.DecisionStatus == "Rejected"),
            complianceKinds = b.Items.Where(i => i.ComplianceKind != null).Select(i => i.ComplianceKind).Distinct().ToList()
        }).ToListAsync();
        return Ok(rows);
    }

    /// <summary>
    /// Packs waiting on the signed-in user: accountant approvals and director signatures they are entitled to give.
    /// Drives the "Waiting for you" strip on the board and the e-mail / notification deep links.
    /// </summary>
    [HttpGet("inbox")]
    public async Task<IActionResult> Inbox()
    {
        var scope = await ScopeAsync();
        var isAcc = await HasAsync(CreditorWorkflow.RoleAccountant);
        var isDir = await HasAsync(CreditorWorkflow.RoleDirector);
        if (!isAcc && !isDir) return Ok(Array.Empty<object>());
        var statuses = new List<string>();
        if (isAcc) statuses.Add(CreditorWorkflow.AwaitingAccountant);
        if (isDir) statuses.Add(CreditorWorkflow.AwaitingDirector);
        var codes = scope.CreditorCodes.ToList();
        var q = _db.PaymentBatches.AsNoTracking().Where(b => statuses.Contains(b.Status));
        if (!scope.All) q = q.Where(b => codes.Contains(b.CompanyCode));
        var rows = await q.OrderBy(b => b.SubmittedAt ?? b.CreatedAt).Select(b => new
        {
            b.Id, b.BatchNumber, b.CompanyCode, b.PaymentType, b.BatchDate, b.Status, b.TotalAmount, b.Notes,
            items = b.Items.Count, pendingItems = b.Items.Count(i => i.DecisionStatus == "Pending"),
            b.PreparedByUserId, b.PreparedByName, b.SubmittedAt, b.AccountantUserId, b.AccountantName, b.AccountantApprovedAt, b.AccountantComment,
            b.RequestedApproverIds, b.RequestedDirectorIds, b.UpdatedAt,
            complianceKinds = b.Items.Where(i => i.ComplianceKind != null).Select(i => i.ComplianceKind).Distinct().ToList()
        }).ToListAsync();
        var companies = await _db.CreditorCompanies.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x);
        var list = new List<object>();
        foreach (var r in rows)
        {
            companies.TryGetValue(r.CompanyCode, out var c);
            string role; string? blocked = null;
            if (r.Status == CreditorWorkflow.AwaitingAccountant)
            {
                if (!isAcc) continue;
                var req = PaymentBatch.ParseIds(r.RequestedApproverIds);
                if (!IsSystemAdmin && (!await IsAccountantForAsync(c) || (req.Count > 0 && !req.Contains(UserId)))) continue;
                if (r.PreparedByUserId == UserId) blocked = "You prepared this pack — another accountant must approve it.";
                role = "accountant";
            }
            else
            {
                if (!isDir) continue;
                var req = PaymentBatch.ParseIds(r.RequestedDirectorIds);
                if (!IsSystemAdmin && (!await IsDirectorForAsync(c) || (req.Count > 0 && !req.Contains(UserId)))) continue;
                if (r.PreparedByUserId == UserId) blocked = "You prepared this pack — another director must sign it.";
                else if (r.AccountantUserId == UserId) blocked = "You approved this pack as accountant — another director must sign it.";
                role = "director";
            }
            var waitingSince = r.Status == CreditorWorkflow.AwaitingDirector ? (r.AccountantApprovedAt ?? r.SubmittedAt) : r.SubmittedAt;
            list.Add(new
            {
                r.Id, r.BatchNumber, r.CompanyCode, companyName = c?.Name ?? r.CompanyCode, r.PaymentType, paymentTypeTitle = CreditorPaymentTypes.All.Where(p => p.Key == r.PaymentType).Select(p => p.Title).FirstOrDefault() ?? r.PaymentType,
                r.BatchDate, r.Status, statusTitle = CreditorWorkflow.Title(r.Status), r.TotalAmount, r.Notes, r.items, r.pendingItems,
                r.PreparedByName, r.AccountantName, r.AccountantComment, waitingSince, role, blocked, r.complianceKinds
            });
        }
        return Ok(list);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var scope = await ScopeAsync();
        var codes = scope.CreditorCodes.ToList();
        var batches = scope.All ? _db.PaymentBatches.AsNoTracking() : _db.PaymentBatches.AsNoTracking().Where(b => codes.Contains(b.CompanyCode));
        var by = await batches.GroupBy(b => b.Status).Select(g => new { status = g.Key, count = g.Count(), amount = g.Sum(b => b.TotalAmount) }).ToListAsync();
        var openPrepay = await _db.PaymentBatchItems.AsNoTracking().CountAsync(i => i.PrepaymentOpen && (scope.All || codes.Contains(i.Batch!.CompanyCode)));
        return Ok(new { byStatus = by, openPrepayments = openPrepay });
    }

    public record BatchCreate(string CompanyCode, string PaymentType, DateTime? BatchDate, string? Notes);

    [HttpPost("batches")]
    public async Task<IActionResult> Create([FromBody] BatchCreate dto)
    {
        if (!await HasAsync(CreditorWorkflow.RoleClerk)) return Forbid();
        if (!await InScopeAsync(dto.CompanyCode)) return StatusCode(403, new { message = "You are not assigned to that company." });
        if (!await _db.CreditorCompanies.AnyAsync(c => c.Code == dto.CompanyCode && c.IsActive)) return BadRequest(new { message = "Unknown paying company." });
        if (!CreditorPaymentTypes.All.Any(p => p.Key == dto.PaymentType)) return BadRequest(new { message = "Unknown payment type." });

        // One series per paying company per year: CB-PMT-2026-0001, CB-ACM-2026-0001 … (older packs kept the shared CB-2026-xxxx form).
        var year = DateTime.UtcNow.Year;
        var prefix = $"CB-{dto.CompanyCode.ToUpperInvariant()}-{year}-";
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
        if (!CreditorWorkflow.Deletable.Contains(b.Status)) return Conflict(new { message = "Signed, paid or closed packs are kept for the audit trail and can't be deleted." });
        if (!await CanPrepareAsync(b)) return Forbid();
        foreach (var d in b.Documents.Where(d => d.StoragePath != null)) TryDelete(Abs(d.StoragePath!));
        _log.LogInformation("Payment pack {Batch} ({Status}, R{Amount}) deleted by {User}", b.BatchNumber, b.Status, b.TotalAmount, UserName);
        _db.PaymentBatches.Remove(b);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ───────────────────────── items ─────────────────────────

    public record ItemDto(string SupplierName, string? SupplierVatNumber, string? InvoiceNumbers, string? Description, decimal Amount,
        string? BankName, string? AccountNumber, string? BranchCode, string? AccountHolder, string? PaymentReference, bool StockReturned,
        bool IsUrgent = false, string? PaymentMode = null, string? PayoutMethod = null, string? ComplianceKind = null, string? ComplianceDetail = null);

    /// <summary>Compliance payments must say what kind they are; "Other" needs a description.</summary>
    private static string? ValidateItem(ItemDto d, string paymentType)
    {
        if (paymentType != CreditorPaymentTypes.Compliance) return null;
        var kind = CreditorComplianceKinds.Normalise(d.ComplianceKind);
        if (kind == null) return "Choose what kind of compliance payment this is.";
        if (kind == CreditorComplianceKinds.Other && string.IsNullOrWhiteSpace(d.ComplianceDetail)) return "Describe what the compliance payment is for.";
        return null;
    }

    [HttpPost("batches/{id:int}/items")]
    public async Task<IActionResult> AddItem(int id, [FromBody] ItemDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        if (ValidateItem(dto, b.PaymentType) is { } bad) return BadRequest(new { message = bad });
        var it = new PaymentBatchItem { BatchId = id, SortOrder = b.Items.Count + 1, PrepaymentOpen = b.PaymentType == CreditorPaymentTypes.Prepayment };
        Apply(it, dto, b.PaymentType);
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
        if (ValidateItem(dto, b.PaymentType) is { } bad) return BadRequest(new { message = bad });
        Apply(it, dto, b.PaymentType);
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

    private static void Apply(PaymentBatchItem it, ItemDto d, string paymentType)
    {
        it.SupplierName = d.SupplierName.Trim(); it.SupplierVatNumber = d.SupplierVatNumber?.Replace(" ", ""); it.InvoiceNumbers = d.InvoiceNumbers?.Trim();
        it.Description = d.Description; it.Amount = d.Amount; it.PaymentReference = d.PaymentReference; it.StockReturned = d.StockReturned;
        it.IsUrgent = d.IsUrgent; it.PaymentMode = CreditorPaymentModes.Normalise(d.PaymentMode);
        if (paymentType == CreditorPaymentTypes.Compliance)
        {
            it.ComplianceKind = CreditorComplianceKinds.Normalise(d.ComplianceKind);
            var detail = d.ComplianceDetail?.Trim();
            it.ComplianceDetail = it.ComplianceKind == CreditorComplianceKinds.Other && !string.IsNullOrEmpty(detail) ? detail[..Math.Min(detail.Length, 200)] : null;
        }
        else { it.ComplianceKind = null; it.ComplianceDetail = null; }
        if (paymentType == CreditorPaymentTypes.Prepayment)
        {
            // Prepayments are paid off the quote; Treasury loads the beneficiary manually from the bank letter, so nothing is captured here.
            it.BankName = null; it.AccountNumber = null; it.BranchCode = null; it.AccountHolder = null;
        }
        else if (CreditorPaymentTypes.IsRequisitionBased(paymentType))
        {
            it.PayoutMethod = StaffPayoutMethods.Normalise(d.PayoutMethod);
            if (it.PayoutMethod == StaffPayoutMethods.EWallet)
            {
                // eWallet: the cellphone number rides in AccountNumber so the schedule / bank file show it as-is.
                it.BankName = StaffPayoutMethods.EWalletBankName; it.AccountNumber = d.AccountNumber?.Replace(" ", "");
                it.BranchCode = null; it.AccountHolder = string.IsNullOrWhiteSpace(d.AccountHolder) ? it.SupplierName : d.AccountHolder;
            }
            else
            {
                it.BankName = d.BankName == StaffPayoutMethods.EWalletBankName ? null : d.BankName;
                it.AccountNumber = d.AccountNumber?.Replace(" ", ""); it.BranchCode = d.BranchCode; it.AccountHolder = d.AccountHolder;
            }
        }
        else
        {
            it.BankName = d.BankName; it.AccountNumber = d.AccountNumber?.Replace(" ", ""); it.BranchCode = d.BranchCode; it.AccountHolder = d.AccountHolder;
        }
    }

    // ───────────────────────── supplier directory & invoice intake ─────────────────────────

    /// <summary>
    /// Suppliers we already know — from previous payment packs (with their bank details and VAT number) and from invoices in Books.
    /// Used to autocomplete "Who is being paid?" so bank details come along and names stay consistent.
    /// </summary>
    [HttpGet("suppliers")]
    public async Task<IActionResult> Suppliers([FromQuery] string? q, [FromQuery] int take = 15, [FromQuery] string? company = null)
    {
        var s = (q ?? "").Trim().ToLower();
        take = Math.Clamp(take, 1, 50);

        var fromPacks = await _db.PaymentBatchItems.AsNoTracking()
            .Where(i => s == "" || i.SupplierName.ToLower().Contains(s) || (i.AccountNumber != null && i.AccountNumber.Contains(s)) || (i.SupplierVatNumber != null && i.SupplierVatNumber.Contains(s)))
            .OrderByDescending(i => i.Id).Take(400)
            .Select(i => new { i.SupplierName, i.SupplierVatNumber, i.BankName, i.AccountNumber, i.BranchCode, i.AccountHolder, i.PaymentReference, i.Amount, i.Batch!.CreatedAt })
            .ToListAsync();
        var fromBooks = await _db.BookInvoices.AsNoTracking()
            .Where(b => s == "" || b.SupplierName.ToLower().Contains(s) || (b.SupplierAccount != null && b.SupplierAccount.ToLower().Contains(s)))
            .OrderByDescending(b => b.Id).Take(400)
            .Select(b => new { b.SupplierName, b.SupplierAccount, b.Total, b.CreatedAt, b.CompanyName })
            .ToListAsync();

        static string Key(string n) => System.Text.RegularExpressions.Regex.Replace(n.ToUpperInvariant(), @"[^A-Z0-9]", "");
        var result = fromPacks.GroupBy(i => Key(i.SupplierName)).Select(g =>
        {
            var latest = g.OrderByDescending(i => i.CreatedAt).First();
            var withBank = g.Where(i => !string.IsNullOrWhiteSpace(i.AccountNumber)).OrderByDescending(i => i.CreatedAt).FirstOrDefault() ?? latest;
            return new SupplierHit(latest.SupplierName, withBank.SupplierVatNumber ?? g.Select(x => x.SupplierVatNumber).FirstOrDefault(x => x != null),
                withBank.BankName, withBank.AccountNumber, withBank.BranchCode, withBank.AccountHolder, withBank.PaymentReference, null,
                g.Count(), 0, latest.CreatedAt, "packs");
        }).ToDictionary(h => Key(h.Name));
        foreach (var g in fromBooks.GroupBy(b => Key(b.SupplierName)))
        {
            var latest = g.OrderByDescending(b => b.CreatedAt).First();
            var acc = g.Select(b => b.SupplierAccount).FirstOrDefault(a => !string.IsNullOrWhiteSpace(a));
            if (result.TryGetValue(g.Key, out var h)) result[g.Key] = h with { Invoices = g.Count(), SupplierAccount = acc, LastUsed = latest.CreatedAt > h.LastUsed ? latest.CreatedAt : h.LastUsed, Source = "packs+books" };
            else result[g.Key] = new SupplierHit(latest.SupplierName, null, null, null, null, null, null, acc, 0, g.Count(), latest.CreatedAt, "books");
        }
        // Vendors on the creditors aging (Sage A/P) — the suppliers most likely to be paid. The paying company's latest
        // snapshot first; other companies' vendors are offered too (a supplier may be new to this company but known to the group).
        var toks = s.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var first = toks.FirstOrDefault() ?? "";
        bool TokMatch(string name, string code) => toks.All(t => name.Contains(t, StringComparison.OrdinalIgnoreCase) || code.Contains(t, StringComparison.OrdinalIgnoreCase));
        var latestSnaps = await _db.ApAgingSnapshots.AsNoTracking()
            .GroupBy(x => x.CompanyCode).Select(g => g.OrderByDescending(x => x.AsOfDate).ThenByDescending(x => x.Id).Select(x => new { x.Id, x.CompanyCode, x.AsOfDate }).First())
            .ToListAsync();
        if (latestSnaps.Count > 0)
        {
            var snapIds = latestSnaps.Select(x => x.Id).ToList();
            var snapCo = latestSnaps.ToDictionary(x => x.Id, x => x.CompanyCode);
            var vendorsRaw = await _db.ApAgingVendors.AsNoTracking()
                .Where(v => snapIds.Contains(v.SnapshotId) && (first == "" || v.VendorName.ToLower().Contains(first) || v.VendorCode.ToLower().Contains(first)))
                .Select(v => new { v.SnapshotId, v.VendorCode, v.VendorName, v.Total, v.Overdue, v.Snapshot!.AsOfDate }).ToListAsync();
            var vendors = vendorsRaw.Where(v => toks.Length <= 1 || TokMatch(v.VendorName, v.VendorCode))
                .Select(v => new { v.VendorCode, v.VendorName, v.Total, v.Overdue, v.AsOfDate, Company = snapCo[v.SnapshotId], Own = string.Equals(snapCo[v.SnapshotId], company, StringComparison.OrdinalIgnoreCase) })
                // One row per vendor name: the paying company's entry wins, then the biggest balance
                .GroupBy(v => Key(v.VendorName)).Select(g => g.OrderByDescending(v => v.Own).ThenByDescending(v => v.Total).First())
                .OrderByDescending(v => v.Own).ThenByDescending(v => v.Total != 0).ThenByDescending(v => v.Total)
                .Take(string.IsNullOrWhiteSpace(company) ? 300 : 300).ToList();
            foreach (var v in vendors)
            {
                var k = Key(v.VendorName);
                if (result.TryGetValue(k, out var h)) result[k] = h with { VendorCode = v.VendorCode, AgingBalance = v.Total, AgingOverdue = v.Overdue, Source = h.Source + "+aging", AgingCompany = v.Company };
                else result[k] = new SupplierHit(v.VendorName, null, null, null, null, null, null, null, 0, 0, v.AsOfDate, "aging", v.VendorCode, v.Total, v.Overdue, v.Company);
            }
        }
        bool Own(SupplierHit h) => company != null && string.Equals(h.AgingCompany, company, StringComparison.OrdinalIgnoreCase);
        var list = result.Values
            .Where(h => toks.Length <= 1 || TokMatch(h.Name, h.VendorCode ?? "") || h.Name.ToLower().Contains(s))
            .OrderByDescending(h => s != "" && h.Name.ToLower().StartsWith(s)).ThenByDescending(Own).ThenByDescending(h => h.Payments + h.Invoices > 0 || h.AgingBalance != 0).ThenByDescending(h => h.AgingBalance ?? 0).ThenByDescending(h => h.Payments + h.Invoices).ThenByDescending(h => h.LastUsed)
            .Take(take).ToList();
        return Ok(list);
    }
    public record SupplierHit(string Name, string? VatNumber, string? BankName, string? AccountNumber, string? BranchCode, string? AccountHolder, string? PaymentReference, string? SupplierAccount, int Payments, int Invoices, DateTime LastUsed, string Source,
        string? VendorCode = null, decimal? AgingBalance = null, decimal? AgingOverdue = null, string? AgingCompany = null);

    /// <summary>
    /// Read a supplier invoice before it is attached: who is being paid, the total, the VAT, the invoice number and date.
    /// Nothing is stored — the client fills the payment form, then uploads the same file as the Tax invoice when the payment is saved.
    /// </summary>
    [HttpPost("read-invoice")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> ReadInvoice(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { message = "No file." });
        if (file.Length > MaxFileBytes) return BadRequest(new { message = "File is larger than 20 MB." });
        var isPdf = file.ContentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) == true || Path.GetExtension(file.FileName).Equals(".pdf", StringComparison.OrdinalIgnoreCase);
        if (!isPdf) return BadRequest(new { message = "PDF only." });
        var tmp = Path.Combine(Path.GetTempPath(), $"cred-read-{Guid.NewGuid():N}.pdf");
        try
        {
            await using (var fs = System.IO.File.Create(tmp)) await file.CopyToAsync(fs);
            var ex = await _checks.ReadAsync(tmp, file.ContentType, file.FileName);
            if (ex.Encrypted) return BadRequest(new { message = "Password-protected PDFs are not accepted." });

            // Prefer a supplier we already know if their name appears in the text
            var text = ex.Text.ToUpperInvariant();
            string? known = null; SupplierHit? hit = null;
            if (text.Length > 20)
            {
                var names = await _db.PaymentBatchItems.AsNoTracking().Select(i => i.SupplierName).Distinct().Take(2000).ToListAsync();
                names.AddRange(await _db.BookInvoices.AsNoTracking().Select(b => b.SupplierName).Distinct().Take(2000).ToListAsync());
                known = names.Where(n => n.Length >= 4).Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderByDescending(n => n.Length).FirstOrDefault(n => text.Contains(n.ToUpperInvariant()));
                if (known != null && await Suppliers(known, 1) is OkObjectResult { Value: List<SupplierHit> { Count: > 0 } hits }) hit = hits[0];
            }
            return Ok(new
            {
                supplierName = known ?? ex.SupplierName, knownSupplier = known != null, supplier = hit,
                amount = ex.Amount, vatAmount = ex.VatAmount, vatNumber = ex.VatNumber, invoiceNumber = ex.InvoiceNumber, documentDate = ex.DocumentDate,
                description = ex.Description, orderNumber = ex.OrderNumber, customerAccount = ex.CustomerAccount,
                bankName = ex.BankName, accountNumber = ex.AccountNumber, branchCode = ex.BranchCode, accountHolder = ex.AccountHolder,
                employeeName = ex.EmployeeName, employeeNumber = ex.EmployeeNumber, department = ex.Department, reason = ex.Reason,
                suggestedType = ex.SuggestedType, pages = ex.Pages, method = ex.Method, scanned = ex.Method == "ocr", readable = ex.Method != "none"
            });
        }
        finally { TryDelete(tmp); }
    }

    /// <summary>Supplier invoices in Books that can be linked to a payment (not already linked to another pack line).</summary>
    [HttpGet("books-invoices")]
    public async Task<IActionResult> BooksInvoices([FromQuery] string? q, [FromQuery] string? company, [FromQuery] int take = 25)
    {
        var s = (q ?? "").Trim().ToLower();
        var query = _db.BookInvoices.AsNoTracking().Where(b => b.Status != "Archived" && b.Status != "Draft");
        if (!string.IsNullOrWhiteSpace(company)) query = query.Where(b => b.CompanyName == company);
        if (s != "") query = query.Where(b => b.SupplierName.ToLower().Contains(s) || (b.InvoiceNumber != null && b.InvoiceNumber.ToLower().Contains(s)) || (b.Description != null && b.Description.ToLower().Contains(s)));
        var rows = await query.OrderByDescending(b => b.InvoiceDate).Take(Math.Clamp(take, 1, 100))
            .Select(b => new { b.Id, b.SupplierName, b.SupplierAccount, b.InvoiceNumber, b.InvoiceDate, b.Total, b.VatAmount, b.CompanyName, b.Description, b.Status, b.PaymentDate, hasPdf = b.FilePath != null, b.FileName,
                DepartmentName = _db.Departments.Where(d => d.DepartmentId == b.DepartmentId).Select(d => d.Name).FirstOrDefault() })
            .ToListAsync();
        var linked = await _db.PaymentBatchDocuments.AsNoTracking().Where(d => d.OriginalFileName != null && d.OriginalFileName.StartsWith("books:")).Select(d => d.OriginalFileName!).ToListAsync();
        var linkedIds = linked.Select(l => int.TryParse(l.Split(':')[1].Split('|')[0], out var i) ? i : 0).ToHashSet();
        return Ok(rows.Select(r => new { r.Id, r.SupplierName, r.SupplierAccount, r.InvoiceNumber, r.InvoiceDate, r.Total, r.VatAmount, r.CompanyName, r.Description, r.Status, r.PaymentDate, r.hasPdf, r.FileName, r.DepartmentName, alreadyLinked = linkedIds.Contains(r.Id) }));
    }

    public record LinkInvoiceDto(int BookInvoiceId);

    /// <summary>Attach an invoice that already lives in Books to a payment line as its Tax invoice (copies the PDF so the pack is self-contained).</summary>
    [HttpPost("batches/{id:int}/items/{itemId:int}/link-invoice")]
    public async Task<IActionResult> LinkInvoice(int id, int itemId, [FromBody] LinkInvoiceDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        var inv = await _db.BookInvoices.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.BookInvoiceId);
        if (inv == null) return NotFound(new { message = "That Books invoice no longer exists." });
        if (string.IsNullOrWhiteSpace(inv.FilePath) || !System.IO.File.Exists(inv.FilePath)) return BadRequest(new { message = "The Books invoice has no PDF on disk." });

        var bytes = await System.IO.File.ReadAllBytesAsync(inv.FilePath);
        var sha = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (b.Documents.Any(d => d.Sha256 == sha)) return Conflict(new { message = "That invoice is already on this batch." });
        var rel = $"Finance/Creditors/{b.CompanyCode}/{b.BatchNumber}/{Guid.NewGuid():N}.pdf";
        var abs = Abs(rel); Directory.CreateDirectory(Path.GetDirectoryName(abs)!);
        await System.IO.File.WriteAllBytesAsync(abs, bytes);
        var ex = await _checks.ReadAsync(abs, "application/pdf", inv.OriginalFileName ?? inv.FileName);

        var na = b.Documents.FirstOrDefault(d => d.IsNotApplicable && d.DocType == CreditorDocTypes.TaxInvoice && d.ItemId == itemId);
        if (na != null) _db.PaymentBatchDocuments.Remove(na);
        b.Documents.Add(new PaymentBatchDocument
        {
            BatchId = id, ItemId = itemId, DocType = CreditorDocTypes.TaxInvoice, SuggestedDocType = ex.SuggestedType,
            FileName = Path.GetFileName(rel), OriginalFileName = $"books:{inv.Id}|{inv.OriginalFileName ?? inv.FileName}", ContentType = "application/pdf", Size = bytes.Length,
            StoragePath = rel, Sha256 = sha, PageCount = ex.Pages, ExtractedText = ex.Text, TextMethod = ex.Method,
            DocumentDate = inv.InvoiceDate, ExtractedVatNumber = ex.VatNumber, ExtractedInvoiceNumber = inv.InvoiceNumber ?? ex.InvoiceNumber, ExtractedAmount = inv.Total,
            UploadedByUserId = UserId, UploadedByName = UserName
        });
        // Fill gaps on the line from Books
        if (string.IsNullOrWhiteSpace(it.InvoiceNumbers) && !string.IsNullOrWhiteSpace(inv.InvoiceNumber)) it.InvoiceNumbers = inv.InvoiceNumber;
        if (string.IsNullOrWhiteSpace(it.Description) && !string.IsNullOrWhiteSpace(inv.Description)) it.Description = inv.Description;
        b.Events.Add(Ev("DocumentUploaded", null, null, $"Tax invoice linked from Books · {inv.SupplierName} {inv.InvoiceNumber} · {it.SupplierName}"));
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    private static void Recalc(PaymentBatch b) { b.TotalAmount = b.Items.Sum(i => i.Amount); b.UpdatedAt = DateTime.UtcNow; }

    // ───────────────────────── documents ─────────────────────────

    /// <summary>Read a supplier recon (.xlsx/.xls/.csv/.pdf) without storing it: returns the same auto-fill fields as read-invoice.</summary>
    [HttpPost("read-recon")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> ReadRecon(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { message = "No file." });
        if (file.Length > MaxFileBytes) return BadRequest(new { message = "File is larger than 20 MB." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var isSheet = ext is ".xlsx" or ".xls" or ".csv";
        if (!isSheet && ext != ".pdf") return BadRequest(new { message = "The recon must be .xlsx, .xls, .csv or .pdf." });
        var tmp = Path.Combine(Path.GetTempPath(), $"cred-recon-{Guid.NewGuid():N}{ext}");
        try
        {
            await using (var fs = System.IO.File.Create(tmp)) await file.CopyToAsync(fs);
            var ex = isSheet ? _checks.ReadSheet(tmp, file.FileName) : await _checks.ReadAsync(tmp, file.ContentType, file.FileName);
            if (ex.Encrypted) return BadRequest(new { message = "Password-protected PDFs are not accepted." });
            var text = ex.Text.ToUpperInvariant();
            string? known = null; SupplierHit? hit = null;
            if (text.Length > 20)
            {
                var names = await _db.PaymentBatchItems.AsNoTracking().Select(i => i.SupplierName).Distinct().Take(2000).ToListAsync();
                names.AddRange(await _db.BookInvoices.AsNoTracking().Select(b => b.SupplierName).Distinct().Take(2000).ToListAsync());
                known = names.Where(n => n.Length >= 4).Distinct(StringComparer.OrdinalIgnoreCase).OrderByDescending(n => n.Length).FirstOrDefault(n => text.Contains(n.ToUpperInvariant()));
                if (known != null && await Suppliers(known, 1) is OkObjectResult { Value: List<SupplierHit> { Count: > 0 } hits }) hit = hits[0];
            }
            // Invoice numbers listed on the recon (up to 12) — handy for "Invoice / reference numbers being paid"
            var invoices = System.Text.RegularExpressions.Regex.Matches(ex.Text, @"\b(?:INV|TAX\s*INV(?:OICE)?)[\s#:\-]*([A-Z]{0,4}[\-/]?\d{3,10})\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase)
                .Select(m => m.Groups[1].Value.ToUpperInvariant()).Distinct().Take(12).ToList();
            return Ok(new
            {
                supplierName = known ?? ex.SupplierName, knownSupplier = known != null, supplier = hit,
                amount = ex.Amount, vatNumber = ex.VatNumber, invoiceNumber = ex.InvoiceNumber, invoiceNumbers = invoices, documentDate = ex.DocumentDate,
                customerAccount = ex.CustomerAccount, bankName = ex.BankName, accountNumber = ex.AccountNumber, branchCode = ex.BranchCode, accountHolder = ex.AccountHolder,
                pages = ex.Pages, method = ex.Method, readable = ex.Method != "none"
            });
        }
        finally { TryDelete(tmp); }
    }

    /// <summary>Upload one PDF (one document). After lock only ProofOfPayment and prepayment closing docs (TaxInvoice, GRV) may be added, and replacements need a reason.</summary>
    [HttpPost("batches/{id:int}/documents")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> Upload(int id, IFormFile file, [FromForm] string? docType, [FromForm] int? itemId, [FromForm] int? supersedesDocumentId, [FromForm] string? versionReason)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (file == null || file.Length == 0) return BadRequest(new { message = "No file." });
        if (file.Length > MaxFileBytes) return BadRequest(new { message = "File is larger than 20 MB." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var isPdf = file.ContentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) == true || ext == ".pdf";
        var isSheet = ext is ".xlsx" or ".xls" or ".csv";
        if (!isPdf && !isSheet) return BadRequest(new { message = "PDF only — one document per file (Excel/CSV is accepted for recons and schedules)." });
        if (isSheet && (string.IsNullOrWhiteSpace(docType) || !CreditorDocTypes.AllowsSpreadsheet(docType)))
            return BadRequest(new { message = "Spreadsheets are only accepted for the supplier recon, creditors recon, payment schedule and Sage batch slots. Pick that slot first." });
        if (itemId != null && b.Items.All(i => i.Id != itemId)) return BadRequest(new { message = "That payment is not on this batch." });
        if (IsExecToken && (docType != CreditorDocTypes.ProofOfPayment || itemId == null || !isPdf || b.Status != CreditorWorkflow.Paid || !await HasAsync(CreditorWorkflow.RoleBank)))
            return StatusCode(403, new { message = "From the off-site portal you can only upload a proof of payment (PDF) on a paid pack." });

        var locked = CreditorWorkflow.Locked.Contains(b.Status);
        var editable = CreditorWorkflow.PreparerEditable.Contains(b.Status);
        if (!locked && !editable) return Conflict(new { message = "The batch is with an approver — documents can't change now." });
        if (!await CanPrepareAsync(b) && !await HasAsync(CreditorWorkflow.RoleBank)) return Forbid();

        // Read the file once: hash + text
        byte[] bytes;
        using (var ms = new MemoryStream()) { await file.CopyToAsync(ms); bytes = ms.ToArray(); }
        var sha = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (b.Documents.Any(d => d.Sha256 == sha)) return Conflict(new { message = "This exact file is already on the batch." });

        var rel = $"Finance/Creditors/{b.CompanyCode}/{b.BatchNumber}/{Guid.NewGuid():N}{(isSheet ? ext : ".pdf")}";
        var abs = Abs(rel);
        Directory.CreateDirectory(Path.GetDirectoryName(abs)!);
        await System.IO.File.WriteAllBytesAsync(abs, bytes);

        var ex = isSheet ? _checks.ReadSheet(abs, file.FileName) : await _checks.ReadAsync(abs, file.ContentType, file.FileName);
        if (isSheet) ex.SuggestedType = docType;
        if (ex.Encrypted) { TryDelete(abs); return BadRequest(new { message = "Password-protected PDFs are not accepted." }); }
        var storedContentType = isSheet ? ext switch { ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xls" => "application/vnd.ms-excel", _ => "text/csv" } : "application/pdf";

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
            FileName = Path.GetFileName(rel), OriginalFileName = file.FileName, ContentType = storedContentType, Size = bytes.Length,
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
        // Re-check right before saving: the OCR above can take a while and a second click on "Upload" with the same file
        // may have been racing us (both passed the in-memory check above). The filtered unique index is the last line of defence.
        if (await _db.PaymentBatchDocuments.AsNoTracking().AnyAsync(d => d.BatchId == id && d.Sha256 == sha)) { TryDelete(abs); return Conflict(new { message = "This exact file is already on the batch." }); }
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException dup) when (dup.InnerException?.Message.Contains("UX_PaymentBatchDocuments_Batch_Sha") == true) { TryDelete(abs); return Conflict(new { message = "This exact file is already on the batch." }); }
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

    public record RequisitionFormDto(string EmployeeName, string? EmployeeNumber, string? Department, string Reason, decimal Amount,
        string? RequestedBy, string? AuthorisedBy, DateTime? Date, string? Notes);

    /// <summary>
    /// Staff payments: fill in the requisition on the intranet instead of uploading a scanned one. The form is generated as a
    /// PDF and stored as the payment's Requisition document (replacing an earlier generated/uploaded one while the pack is editable).
    /// </summary>
    [HttpPost("batches/{id:int}/items/{itemId:int}/requisition")]
    public async Task<IActionResult> FillRequisition(int id, int itemId, [FromBody] RequisitionFormDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch can no longer be edited." });
        if (!await CanPrepareAsync(b)) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.EmployeeName)) return BadRequest(new { message = "Who is the requisition for?" });
        if (string.IsNullOrWhiteSpace(dto.Reason)) return BadRequest(new { message = "Give the reason for the payment." });

        var company = await _db.CreditorCompanies.AsNoTracking().Where(c => c.Code == b.CompanyCode).Select(c => c.Name).FirstOrDefaultAsync() ?? b.CompanyCode;
        var form = new CreditorPackPdfService.RequisitionForm(
            company, b.BatchNumber, dto.EmployeeName.Trim(), dto.EmployeeNumber?.Trim(), dto.Department?.Trim(), dto.Reason.Trim(), dto.Amount,
            string.IsNullOrWhiteSpace(dto.RequestedBy) ? UserName : dto.RequestedBy.Trim(), dto.AuthorisedBy?.Trim(), (dto.Date ?? DateTime.UtcNow.AddHours(2)).Date,
            dto.Notes?.Trim(), StaffPayoutMethods.Title(it.PayoutMethod), it.BankName, it.AccountNumber, it.BranchCode, it.AccountHolder, UserName, b.PaymentType == CreditorPaymentTypes.StaffPayment);
        var (bytes, text) = _packPdf.Requisition(form);
        var sha = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        // Replace whatever filled the slot before (an earlier version of this form, an upload, or an N/A) — the pack is still a draft.
        foreach (var old in b.Documents.Where(d => d.ItemId == itemId && d.DocType == CreditorDocTypes.Requisition).ToList())
        { if (old.StoragePath != null) TryDelete(Abs(old.StoragePath)); _db.PaymentBatchDocuments.Remove(old); b.Documents.Remove(old); }

        var rel = $"Finance/Creditors/{b.CompanyCode}/{b.BatchNumber}/{Guid.NewGuid():N}.pdf";
        var abs = Abs(rel);
        Directory.CreateDirectory(Path.GetDirectoryName(abs)!);
        await System.IO.File.WriteAllBytesAsync(abs, bytes);
        var fileName = $"Requisition - {SafeName(dto.EmployeeName)}.pdf";
        b.Documents.Add(new PaymentBatchDocument
        {
            BatchId = id, ItemId = itemId, DocType = CreditorDocTypes.Requisition, SuggestedDocType = CreditorDocTypes.Requisition,
            FileName = Path.GetFileName(rel), OriginalFileName = fileName, ContentType = "application/pdf", Size = bytes.Length,
            StoragePath = rel, Sha256 = sha, PageCount = 1, ExtractedText = text, TextMethod = "itext",
            DocumentDate = form.Date, ExtractedAmount = dto.Amount, UploadedByUserId = UserId, UploadedByName = UserName
        });
        b.Events.Add(Ev("DocumentUploaded", null, null, $"Requisition filled in on the intranet · {it.SupplierName} R{dto.Amount:N2}"));
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    private static string SafeName(string s) { var n = new string(s.Where(ch => !Path.GetInvalidFileNameChars().Contains(ch)).ToArray()).Trim(); return n.Length > 60 ? n[..60] : n; }

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

    /// <summary>
    /// The payment schedule is generated from the payments in the batch rather than uploaded: supplier, invoice date,
    /// document number (invoice numbers), payable-by (the batch's payment-run date) and amount. JSON for the on-screen
    /// table; ?format=xlsx for the Excel the director / bank user takes away.
    /// </summary>
    [HttpGet("batches/{id:int}/schedule")]
    public async Task<IActionResult> Schedule(int id, [FromQuery] string? format = null)
    {
        var b = await _db.PaymentBatches.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        if (b == null) return NotFound();
        var co = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(c => c.Code == b.CompanyCode);
        var invoiceDocs = await _db.PaymentBatchDocuments.AsNoTracking()
            .Where(d => d.BatchId == id && d.ItemId != null && d.DocType == CreditorDocTypes.TaxInvoice && !d.IsNotApplicable)
            .Select(d => new { d.ItemId, d.DocumentDate, d.ExtractedInvoiceNumber })
            .ToListAsync();
        var byItem = invoiceDocs.GroupBy(d => d.ItemId!.Value).ToDictionary(g => g.Key, g => g.ToList());

        var typeTitle = CreditorPaymentTypes.All.FirstOrDefault(p => p.Key == b.PaymentType).Title ?? b.PaymentType;
        var lines = b.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select((i, n) =>
        {
            byItem.TryGetValue(i.Id, out var docs);
            var invDate = docs?.Select(d => d.DocumentDate).Where(d => d.HasValue).Max();
            var docNo = !string.IsNullOrWhiteSpace(i.InvoiceNumbers) ? i.InvoiceNumbers!.Trim()
                      : docs?.Select(d => d.ExtractedInvoiceNumber).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? "";
            var payable = i.DecisionStatus is "Rejected" or "SentBack" ? 0m : i.Amount;
            return new
            {
                no = n + 1, itemId = i.Id, supplier = i.SupplierName, invoiceDate = invDate, documentNumber = docNo,
                description = i.DisplayDescription, payableBy = b.BatchDate, amount = i.Amount, payable,
                bank = i.BankName, accountNumber = i.AccountNumber, branchCode = i.BranchCode, reference = i.PaymentReference,
                decision = i.DecisionStatus, hasInvoice = docs != null && docs.Count > 0
            };
        }).ToList();

        var head = new
        {
            batchNumber = b.BatchNumber, company = co?.Name ?? b.CompanyCode, companyCode = b.CompanyCode, paymentType = typeTitle,
            paymentRunDate = b.BatchDate, preparedBy = b.PreparedByName, generatedAt = DateTime.UtcNow,
            total = lines.Sum(l => l.amount), totalPayable = lines.Sum(l => l.payable), count = lines.Count,
            missingInvoiceDates = lines.Count(l => l.invoiceDate == null), missingDocNumbers = lines.Count(l => string.IsNullOrEmpty(l.documentNumber))
        };

        if (!string.Equals(format, "xlsx", StringComparison.OrdinalIgnoreCase)) return Ok(new { head, lines });

        using var wb = new ClosedXML.Excel.XLWorkbook();
        var ws = wb.Worksheets.Add("Payment schedule");
        ws.Cell(1, 1).Value = $"{head.company} — Payment schedule"; ws.Cell(1, 1).Style.Font.Bold = true; ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Cell(2, 1).Value = "Batch"; ws.Cell(2, 2).Value = b.BatchNumber;
        ws.Cell(3, 1).Value = "Payment type"; ws.Cell(3, 2).Value = typeTitle;
        ws.Cell(4, 1).Value = "Payment run date"; ws.Cell(4, 2).Value = b.BatchDate; ws.Cell(4, 2).Style.DateFormat.Format = "dd MMM yyyy";
        ws.Cell(5, 1).Value = "Prepared by"; ws.Cell(5, 2).Value = b.PreparedByName;
        ws.Cell(6, 1).Value = "Generated"; ws.Cell(6, 2).Value = DateTime.UtcNow; ws.Cell(6, 2).Style.DateFormat.Format = "dd MMM yyyy HH:mm";
        ws.Range(2, 1, 6, 1).Style.Font.Bold = true;

        var r = 8;
        string[] cols = { "#", "Supplier", "Invoice date", "Document number", "Description", "Payable by", "Amount (R)", "Bank", "Account no.", "Branch", "Reference", "Director decision" };
        for (var c = 0; c < cols.Length; c++) ws.Cell(r, c + 1).Value = cols[c];
        var hdr = ws.Range(r, 1, r, cols.Length); hdr.Style.Font.Bold = true; hdr.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromHtml("#E8EEF7"); hdr.Style.Border.BottomBorder = ClosedXML.Excel.XLBorderStyleValues.Thin;
        foreach (var l in lines)
        {
            r++;
            ws.Cell(r, 1).Value = l.no; ws.Cell(r, 2).Value = l.supplier;
            if (l.invoiceDate.HasValue) { ws.Cell(r, 3).Value = l.invoiceDate.Value; ws.Cell(r, 3).Style.DateFormat.Format = "dd MMM yyyy"; }
            ws.Cell(r, 4).Value = l.documentNumber; ws.Cell(r, 5).Value = l.description ?? "";
            ws.Cell(r, 6).Value = l.payableBy; ws.Cell(r, 6).Style.DateFormat.Format = "dd MMM yyyy";
            ws.Cell(r, 7).Value = l.amount; ws.Cell(r, 7).Style.NumberFormat.Format = "#,##0.00";
            ws.Cell(r, 8).Value = l.bank ?? ""; ws.Cell(r, 9).Value = l.accountNumber ?? ""; ws.Cell(r, 9).Style.NumberFormat.Format = "@";
            ws.Cell(r, 10).Value = l.branchCode ?? ""; ws.Cell(r, 10).Style.NumberFormat.Format = "@"; ws.Cell(r, 11).Value = l.reference ?? ""; ws.Cell(r, 12).Value = l.decision;
            if (l.decision == "Rejected") ws.Range(r, 1, r, cols.Length).Style.Font.Strikethrough = true;
        }
        r++;
        ws.Cell(r, 6).Value = "Total"; ws.Cell(r, 6).Style.Font.Bold = true;
        ws.Cell(r, 7).FormulaA1 = $"SUM(G{9}:G{r - 1})"; ws.Cell(r, 7).Style.NumberFormat.Format = "#,##0.00"; ws.Cell(r, 7).Style.Font.Bold = true;
        ws.Range(r, 1, r, cols.Length).Style.Border.TopBorder = ClosedXML.Excel.XLBorderStyleValues.Thin;
        ws.Columns().AdjustToContents(); ws.Column(2).Width = Math.Min(ws.Column(2).Width, 40); ws.Column(5).Width = Math.Min(ws.Column(5).Width, 50);
        ws.SheetView.FreezeRows(8);

        using var ms = new MemoryStream(); wb.SaveAs(ms);
        var safeCo = string.Concat((co?.Name ?? b.CompanyCode).Where(ch => char.IsLetterOrDigit(ch) || ch == ' ')).Replace(' ', '-');
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Payment-schedule-{b.BatchNumber}-{safeCo}.xlsx");
    }

    [HttpGet("batches/{id:int}/documents/{docId:int}/file")]
    public async Task<IActionResult> File(int id, int docId, [FromQuery] bool download = false)
    {
        var d = await _db.PaymentBatchDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == docId && x.BatchId == id);
        if (d?.StoragePath == null) return NotFound();
        var abs = Abs(d.StoragePath);
        if (!System.IO.File.Exists(abs)) return NotFound();
        var isPdfDoc = string.IsNullOrEmpty(d.ContentType) || d.ContentType.Contains("pdf", StringComparison.OrdinalIgnoreCase);
        if (!download && isPdfDoc) Response.Headers["Content-Disposition"] = $"inline; filename=\"{d.OriginalFileName ?? d.FileName}\"";
        return PhysicalFile(abs, isPdfDoc ? "application/pdf" : d.ContentType!, download || !isPdfDoc ? (d.OriginalFileName ?? d.FileName) : null);
    }

    /// <summary>
    /// Spreadsheet document (recon / schedule) as a grid for in-page preview, plus everything we extracted from it.
    /// Up to 5 sheets × 300 rows × 30 columns.
    /// </summary>
    [HttpGet("batches/{id:int}/documents/{docId:int}/sheet")]
    public async Task<IActionResult> Sheet(int id, int docId)
    {
        var d = await _db.PaymentBatchDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == docId && x.BatchId == id);
        if (d?.StoragePath == null) return NotFound();
        var abs = Abs(d.StoragePath);
        if (!System.IO.File.Exists(abs)) return NotFound();
        var ext = Path.GetExtension(d.OriginalFileName ?? d.FileName).ToLowerInvariant();
        if (ext is not (".xlsx" or ".xls" or ".csv")) return BadRequest(new { message = "Not a spreadsheet." });

        var sheets = new List<object>();
        try
        {
            if (ext == ".csv")
            {
                var rows = System.IO.File.ReadLines(abs).Take(300).Select(l => l.Split(new[] { ',', ';' }).Take(30).Select(c => c.Trim().Trim('"')).ToArray()).ToList();
                sheets.Add(new { name = "Sheet1", rows });
            }
            else
            {
                using var wb = new ClosedXML.Excel.XLWorkbook(abs);
                foreach (var ws in wb.Worksheets.Take(5))
                {
                    var used = ws.RangeUsed(); if (used == null) continue;
                    var firstCol = used.FirstColumn().ColumnNumber(); var lastCol = Math.Min(used.LastColumn().ColumnNumber(), firstCol + 29);
                    var rows = new List<string[]>();
                    foreach (var row in used.Rows().Take(300))
                    {
                        var cells = new string[lastCol - firstCol + 1];
                        for (var c = firstCol; c <= lastCol; c++) { var cell = row.Cell(c); cells[c - firstCol] = cell.IsEmpty() ? "" : cell.GetFormattedString(); }
                        if (cells.All(string.IsNullOrWhiteSpace)) continue;
                        rows.Add(cells);
                    }
                    sheets.Add(new { name = ws.Name, rows });
                }
            }
        }
        catch (Exception e) { return BadRequest(new { message = "Couldn't read the spreadsheet: " + e.Message }); }

        var text = d.ExtractedText ?? "";
        var invoiceNumbers = System.Text.RegularExpressions.Regex.Matches(text, @"\b(?:INV|TAX\s*INV(?:OICE)?)[\s#:\-]*([A-Z]{0,4}[\-/]?\d{3,10})\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase)
            .Select(m => m.Groups[1].Value.ToUpperInvariant()).Distinct().Take(20).ToList();
        var amounts = System.Text.RegularExpressions.Regex.Matches(text, @"(?:BALANCE\s+(?:DUE|PAYABLE|OWING)|AMOUNT\s+(?:DUE|PAYABLE)|TOTAL(?:\s+DUE|\s+PAYABLE)?|TO\s+PAY)\s*[:\-]?\s*R?\s*(-?[\d\s]{1,12}[.,]\d{2})\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase)
            .Select(m => new { label = m.Value.Split(new[] { ':', '-', 'R' }, 2)[0].Trim(), value = m.Groups[1].Value.Trim() }).Take(8).ToList();
        var item = d.ItemId == null ? null : await _db.PaymentBatchItems.AsNoTracking().Where(i => i.Id == d.ItemId).Select(i => new { i.SupplierName, i.Amount, i.InvoiceNumbers, i.AccountNumber }).FirstOrDefaultAsync();

        return Ok(new
        {
            d.Id, d.DocType, title = CreditorChecksService.Label(d.DocType), d.OriginalFileName, d.Size, d.UploadedByName, d.UploadedAt,
            extracted = new
            {
                amount = d.ExtractedAmount, invoiceNumber = d.ExtractedInvoiceNumber, invoiceNumbers, accountNumber = d.ExtractedAccountNumber, vatNumber = d.ExtractedVatNumber,
                documentDate = d.DocumentDate, amounts,
                matchesSchedule = item == null || d.ExtractedAmount == null ? (bool?)null : Math.Abs(d.ExtractedAmount.Value - item.Amount) <= 1m,
                scheduleAmount = item?.Amount, scheduleInvoices = item?.InvoiceNumbers, supplier = item?.SupplierName
            },
            sheets
        });
    }

    // ───────────────────────── workflow ─────────────────────────

    public record SubmitDto(int[]? ApproverUserIds, string? SignatureImageBase64 = null, bool UseSavedSignature = true);

    /// <summary>
    /// Resolve the signature image for the signed-in user: a freshly drawn one wins, otherwise the saved signature on their profile.
    /// Returns (bytes, mime, method) or null when the person has no signature at all.
    /// </summary>
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
    private static object NoSignature() => new { message = "A digital signature is required. Draw one now or ask an admin to upload your saved signature under Settings › Users.", code = "SIGNATURE_REQUIRED" };

    /// <summary>Who may be asked to approve / sign this batch (the company's approvers, excluding the caller). Used by the submit and approve pickers.</summary>
    [HttpGet("batches/{id:int}/approvers")]
    public async Task<IActionResult> BatchApprovers(int id)
    {
        var b = await _db.PaymentBatches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id); if (b == null) return NotFound();
        if (!await InScopeAsync(b.CompanyCode)) return Forbid();
        var (accs, accsFallback) = await CandidateApproversAsync(b.CompanyCode, CreditorWorkflow.RoleAccountant);
        var (dirs, dirsFallback) = await CandidateApproversAsync(b.CompanyCode, CreditorWorkflow.RoleDirector);
        object P(IEnumerable<Approver> l) => l.Where(a => a.UserId != UserId).Select(a => new { userId = a.UserId, a.Name, a.Role, a.Email }).ToList();
        return Ok(new { accountants = P(accs), accountantsFallback = accsFallback, directors = P(dirs), directorsFallback = dirsFallback });
    }

    /// <summary>Company approvers for a role; if the company has nobody assigned, falls back to everyone with the role (so the pack never gets stuck).</summary>
    private async Task<(List<Approver> People, bool Fallback)> CandidateApproversAsync(string companyCode, string role)
    {
        var a = await ApproversForAsync(companyCode);
        var list = role == CreditorWorkflow.RoleAccountant ? a.Accountants : a.Directors;
        if (list.Count > 0) return (list.ToList(), false);
        var all = await ApproversAsync();
        var any = all.Values.SelectMany(x => role == CreditorWorkflow.RoleAccountant ? x.Accountants : x.Directors).GroupBy(x => x.UserId).Select(g => g.First()).OrderBy(x => x.Name).ToList();
        return (any, true);
    }

    /// <summary>Preparer submits: checks run; FAIL → back to preparer, otherwise → the chosen company accountant(s).</summary>
    [HttpPost("batches/{id:int}/submit")]
    public async Task<IActionResult> Submit(int id, [FromBody] SubmitDto? dto = null)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!CreditorWorkflow.PreparerEditable.Contains(b.Status)) return Conflict(new { message = "This batch has already been submitted." });
        if (!await CanPrepareAsync(b)) return Forbid();

        // Who to send it to: must be one of the company's accountants (or any accountant if the company has none), never the preparer.
        var (candidates, _) = await CandidateApproversAsync(b.CompanyCode, CreditorWorkflow.RoleAccountant);
        var wanted = (dto?.ApproverUserIds ?? Array.Empty<int>()).Distinct().Where(i => i != UserId).ToList();
        var chosen = wanted.Count == 0 ? candidates.Where(a => a.UserId != UserId).ToList() : candidates.Where(a => wanted.Contains(a.UserId)).ToList();
        if (wanted.Count > 0 && chosen.Count != wanted.Count) return BadRequest(new { message = "One of the people you picked isn't an accountant for this company." });
        if (chosen.Count == 0 && candidates.Count > 0) return BadRequest(new { message = "Pick at least one accountant to send the pack to." });

        var res = await RunChecksAsync(b);
        if (res.Status != "FAIL")
        {
            // The preparer signs the pack before it leaves them.
            var sig = await ResolveSignatureAsync(dto?.SignatureImageBase64, dto?.UseSavedSignature ?? true);
            if (sig == null) return BadRequest(NoSignature());
            await _sign.SignAsync(new SignatureRequest { EntityType = "PaymentBatch", EntityId = b.Id, Context = "PreparerSubmission", SignerUserId = UserId, SignerName = UserName, SignerRole = CreditorWorkflow.RoleClerk, Action = "Submit", Comment = "Prepared and checked", Method = sig.Value.Method, IpAddress = Ip(), UserAgent = Ua(), Payload = Snapshot(b), SignatureImage = sig.Value.Bytes, SignatureImageMimeType = sig.Value.Mime });
        }
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
            b.RequestedApproverIds = wanted.Count == 0 ? null : string.Join(",", chosen.Select(a => a.UserId));
            b.RequestedApproverNames = chosen.Count == 0 ? null : string.Join(", ", chosen.Select(a => a.Name));
            b.RequestedDirectorIds = null; b.RequestedDirectorNames = null;
            foreach (var it in b.Items.Where(i => i.DecisionStatus == "Queried")) { it.DecisionStatus = "Pending"; it.DecisionComment = null; }
            var note = res.Status == "REVIEW" ? $"{res.Review} item(s) for the accountant to review" : "All checks passed";
            b.Events.Add(Ev("Submitted", from, b.Status, note + (chosen.Count > 0 ? $" · sent to {b.RequestedApproverNames}" : "")));
            await NotifyAsync(chosen.Select(a => (int?)a.UserId), "Payment pack awaiting your approval", $"{b.BatchNumber} · {b.CompanyCode} · R{b.TotalAmount:N2} · {CreditorChecksService.Label(b.PaymentType)} · prepared by {UserName}", b.Id);
            await EmailApproversAsync(chosen, b, "check and approve", "Accountant approval");
        }
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    public record ReassignDto(int[]? ApproverUserIds, string? Note);
    public record RecallDto(string? Reason);

    /// <summary>Accountants the pack is currently with: the ones the preparer picked, or every company accountant if none were picked.</summary>
    private async Task<List<Approver>> CurrentAccountantsAsync(PaymentBatch b)
    {
        var (candidates, _) = await CandidateApproversAsync(b.CompanyCode, CreditorWorkflow.RoleAccountant);
        var req = b.RequestedApproverIdList;
        return req.Count == 0 ? candidates.Where(a => a.UserId != b.PreparedByUserId).ToList() : candidates.Where(a => req.Contains(a.UserId)).ToList();
    }

    /// <summary>Undecided per-payment marks the previous accountant saved but never signed — the next accountant decides afresh.</summary>
    private static void ClearAccountantMarks(PaymentBatch b)
    {
        foreach (var it in b.Items.Where(i => i.DecisionStatus != "SentBack")) { it.AccountantDecision = null; it.AccountantDecisionComment = null; it.AccountantDecidedAt = null; }
    }

    /// <summary>
    /// Preparer moves a pack that is still waiting for the accountant to a different accountant (e.g. the one picked is away today).
    /// The pack stays "Awaiting company accountant": no re-check, no new preparer signature.
    /// </summary>
    [HttpPost("batches/{id:int}/reassign-accountant")]
    public async Task<IActionResult> ReassignAccountant(int id, [FromBody] ReassignDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.AwaitingAccountant) return Conflict(new { message = "Only a pack that is still waiting for the accountant can be moved to another accountant." });
        if (!await CanPrepareAsync(b)) return Forbid();

        var (candidates, _) = await CandidateApproversAsync(b.CompanyCode, CreditorWorkflow.RoleAccountant);
        var wanted = (dto.ApproverUserIds ?? Array.Empty<int>()).Distinct().Where(i => i != b.PreparedByUserId && i != UserId).ToList();
        if (wanted.Count == 0) return BadRequest(new { message = "Pick the accountant to send the pack to." });
        var chosen = candidates.Where(a => wanted.Contains(a.UserId)).ToList();
        if (chosen.Count != wanted.Count) return BadRequest(new { message = "One of the people you picked isn't an accountant for this company." });

        var previous = await CurrentAccountantsAsync(b);
        var prevNames = b.RequestedApproverNames ?? (previous.Count > 0 ? string.Join(", ", previous.Select(a => a.Name)) : "the company accountants");
        b.RequestedApproverIds = string.Join(",", chosen.Select(a => a.UserId));
        b.RequestedApproverNames = string.Join(", ", chosen.Select(a => a.Name));
        ClearAccountantMarks(b);
        var note = string.IsNullOrWhiteSpace(dto.Note) ? null : Trunc(dto.Note.Trim(), 500);
        b.Events.Add(Ev("AccountantChanged", null, null, $"Moved from {prevNames} to {b.RequestedApproverNames}" + (note != null ? $" — {note}" : "")));
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await NotifyAsync(chosen.Select(a => (int?)a.UserId), "Payment pack awaiting your approval", $"{b.BatchNumber} · {b.CompanyCode} · R{b.TotalAmount:N2} · {CreditorChecksService.Label(b.PaymentType)} · moved to you by {UserName}" + (note != null ? $": {note}" : ""), b.Id);
        await EmailApproversAsync(chosen, b, "check and approve", "Accountant approval");
        var dropped = previous.Where(p => !chosen.Any(c => c.UserId == p.UserId)).Select(p => (int?)p.UserId).ToList();
        if (dropped.Count > 0) await NotifyAsync(dropped, "Payment pack moved to another accountant", $"{b.BatchNumber} was moved to {b.RequestedApproverNames} by {UserName}. Nothing more for you to do on it.", b.Id);
        return Ok(await DetailAsync(id));
    }

    /// <summary>
    /// Preparer pulls a pack that is still waiting for the accountant back to Draft to change it.
    /// Sending it again re-runs the checks and the preparer signs again.
    /// </summary>
    [HttpPost("batches/{id:int}/recall")]
    public async Task<IActionResult> Recall(int id, [FromBody] RecallDto? dto = null)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.AwaitingAccountant) return Conflict(new { message = "Only a pack that is still waiting for the accountant can be recalled. Once the accountant has approved it, ask them or the director to send it back." });
        if (!await CanPrepareAsync(b)) return Forbid();

        var previous = await CurrentAccountantsAsync(b);
        var from = b.Status;
        var reason = string.IsNullOrWhiteSpace(dto?.Reason) ? null : Trunc(dto!.Reason!.Trim(), 500);
        b.Status = CreditorWorkflow.Draft;
        b.RequestedApproverIds = null; b.RequestedApproverNames = null;
        b.ReturnReason = null;
        ClearAccountantMarks(b);
        b.Events.Add(Ev("Recalled", from, b.Status, "Recalled by the preparer" + (reason != null ? $" — {reason}" : "")));
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (previous.Count > 0) await NotifyAsync(previous.Select(a => (int?)a.UserId), "Payment pack recalled", $"{UserName} recalled {b.BatchNumber} to make changes. Nothing for you to do on it for now.", b.Id);
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

    public record DecisionDto(string Decision, string? Comment, int[]? DirectorUserIds = null, string? SignatureImageBase64 = null, bool UseSavedSignature = true);

    /// <summary>Company accountant: approve (→ chosen director(s)) or query (→ preparer). Mandatory before the director can sign.</summary>
    [HttpPost("batches/{id:int}/accountant")]
    public async Task<IActionResult> Accountant(int id, [FromBody] DecisionDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.AwaitingAccountant) return Conflict(new { message = "The batch is not awaiting the accountant." });
        var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
        if (!await IsAccountantForAsync(b, c)) return Forbid();
        if (b.PreparedByUserId == UserId && !IsSystemAdmin) return Conflict(new { message = "The preparer cannot approve their own batch." });

        var approve = dto.Decision.Equals("approve", StringComparison.OrdinalIgnoreCase);
        if (!approve && string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest(new { message = "Say what needs fixing when you send a pack back." });
        List<PaymentBatchItem>? pendingEmail = null;

        var from = b.Status;
        // Per-payment: anything the accountant marked "Send back" stays on the pack as SentBack (never paid from it); the rest goes forward.
        var live = b.Items.Where(i => i.DecisionStatus != "SentBack").ToList();
        var sendBack = live.Where(i => i.AccountantDecision == "SentBack").ToList();
        if (approve && live.Count > 0 && sendBack.Count == live.Count)
            return BadRequest(new { message = "You've sent back every payment — use “Send back” for the whole pack instead." });
        if (approve)
        {
            var (candidates, _) = await CandidateApproversAsync(b.CompanyCode, CreditorWorkflow.RoleDirector);
            var wanted = (dto.DirectorUserIds ?? Array.Empty<int>()).Distinct().Where(i => i != UserId).ToList();
            var chosen = wanted.Count == 0 ? candidates.Where(a => a.UserId != UserId).ToList() : candidates.Where(a => wanted.Contains(a.UserId)).ToList();
            if (wanted.Count > 0 && chosen.Count != wanted.Count) return BadRequest(new { message = "One of the people you picked isn't a director for this company." });
            var sig = await ResolveSignatureAsync(dto.SignatureImageBase64, dto.UseSavedSignature);
            if (sig == null) return BadRequest(NoSignature());

            b.Status = CreditorWorkflow.AwaitingDirector;
            b.AccountantUserId = UserId; b.AccountantName = UserName; b.AccountantApprovedAt = DateTime.UtcNow; b.AccountantComment = dto.Comment;
            foreach (var it in live)
            {
                if (it.AccountantDecision == "SentBack") { it.DecisionStatus = "SentBack"; it.DecisionComment = it.AccountantDecisionComment; it.DecidedAt = DateTime.UtcNow; }
                else { it.AccountantDecision = "Approved"; it.AccountantDecidedAt ??= DateTime.UtcNow; }
            }
            if (sendBack.Count > 0)
                b.Events.Add(Ev("AccountantSentBackItems", null, null, Trunc($"{sendBack.Count} payment(s) sent back: " + string.Join("; ", sendBack.Select(i => $"{i.SupplierName} R{i.Amount:N2} — {i.AccountantDecisionComment}")), 1000)));
            b.RequestedDirectorIds = wanted.Count == 0 ? null : string.Join(",", chosen.Select(a => a.UserId));
            b.RequestedDirectorNames = chosen.Count == 0 ? null : string.Join(", ", chosen.Select(a => a.Name));
            await _sign.SignAsync(new SignatureRequest { EntityType = "PaymentBatch", EntityId = b.Id, Context = "AccountantApproval", SignerUserId = UserId, SignerName = UserName, SignerRole = CreditorWorkflow.RoleAccountant, Action = "Approve", Comment = dto.Comment, Method = sig.Value.Method, IpAddress = Ip(), UserAgent = Ua(), Payload = Snapshot(b), SignatureImage = sig.Value.Bytes, SignatureImageMimeType = sig.Value.Mime });
            b.Events.Add(Ev("AccountantApproved", from, b.Status, (dto.Comment ?? "") + (chosen.Count > 0 ? $" · sent to {b.RequestedDirectorNames}" : "")));
            await NotifyAsync(chosen.Select(d => (int?)d.UserId), "Payment pack ready for your signature", $"{b.BatchNumber} · {b.CompanyCode} · R{b.TotalAmount:N2} · prepared by {b.PreparedByName}, approved by {UserName}", b.Id);
            await EmailApproversAsync(chosen, b, "check and sign", "Director sign-off", approvedBy: UserName);
            if (sendBack.Count > 0)
            {
                await NotifyAsync(new[] { (int?)b.PreparedByUserId }, $"{sendBack.Count} payment{(sendBack.Count == 1 ? "" : "s")} sent back by {UserName}",
                    $"{b.BatchNumber}: " + string.Join("; ", sendBack.Select(i => $"{i.SupplierName} R{i.Amount:N2} — {i.AccountantDecisionComment}")), b.Id);
                pendingEmail = sendBack;
            }
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
        if (pendingEmail != null) await EmailRejectedAsync(b, pendingEmail, "accountant");
        return Ok(await DetailAsync(id));
    }

    /// <summary>Accountant decides one payment: Approved | SentBack (needs a reason) | Pending (undecided). Applied when the accountant signs.</summary>
    [HttpPost("batches/{id:int}/items/{itemId:int}/accountant-decision")]
    public async Task<IActionResult> AccountantDecide(int id, int itemId, [FromBody] DecisionDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.AwaitingAccountant) return Conflict(new { message = "The pack is not with the accountant." });
        var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
        if (!await IsAccountantForAsync(b, c)) return Forbid();
        if (b.PreparedByUserId == UserId && !IsSystemAdmin) return Conflict(new { message = "The preparer cannot approve their own batch." });
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        if (it.DecisionStatus == "SentBack") return Conflict(new { message = "This payment was already sent back — the preparer fixes it on a new pack." });
        var d = dto.Decision switch { "Approved" => "Approved", "SentBack" => "SentBack", "Pending" => null, _ => "?" };
        if (d == "?") return BadRequest(new { message = "Decision must be Approved or SentBack." });
        if (d == "SentBack" && string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest(new { message = "Say why this payment is being sent back." });
        it.AccountantDecision = d; it.AccountantDecisionComment = d == "SentBack" ? Trunc(dto.Comment!.Trim(), 1000) : (string.IsNullOrWhiteSpace(dto.Comment) ? null : Trunc(dto.Comment.Trim(), 1000));
        it.AccountantDecidedAt = d == null ? null : DateTime.UtcNow;
        b.Events.Add(Ev("AccountantItemDecision", null, null, Trunc($"{it.SupplierName} R{it.Amount:N2} → {d ?? "undecided"}" + (it.AccountantDecisionComment != null ? $": {it.AccountantDecisionComment}" : ""), 1000)));
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
        if (!await IsDirectorForAsync(b, c)) return Forbid();
        if (DirectorConflict(b) is { } conflict) return StatusCode(403, new { message = conflict });
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        if (it.DecisionStatus == "SentBack") return Conflict(new { message = "The accountant sent this payment back — it isn't for your decision." });
        var d = dto.Decision switch { "Approved" => "Approved", "Queried" => "Queried", "Rejected" => "Rejected", "Pending" => "Pending", _ => null };
        if (d == null) return BadRequest(new { message = "Decision must be Approved, Queried or Rejected." });
        if (d != "Approved" && d != "Pending" && string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest(new { message = "Give a reason when querying or rejecting a payment." });
        it.DecisionStatus = d; it.DecisionComment = dto.Comment; it.DecidedAt = DateTime.UtcNow;
        if (d == "Queried")
        {
            it.QueryQuestion = dto.Comment!.Trim(); it.QueryAskedByName = UserName; it.QueryAskedAt = DateTime.UtcNow;
            it.QueryResponse = null; it.QueryRespondedByName = null; it.QueryRespondedAt = null;
        }
        else if (it.QueryResponse == null) { it.QueryQuestion = null; it.QueryAskedByName = null; it.QueryAskedAt = null; } // changed their mind before anyone answered
        b.Events.Add(Ev("ItemDecision", null, null, $"{it.SupplierName} R{it.Amount:N2} → {d}" + (dto.Comment != null ? $": {dto.Comment}" : "")));
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    /// <summary>
    /// The director approved some payments and queried others: move the queried ones (with their documents) to a new pack of their
    /// own so the approved ones can be locked and paid. The new pack keeps the accountant's approval and waits for answers.
    /// </summary>
    private async Task<PaymentBatch> SplitQueriedAsync(PaymentBatch b)
    {
        var prefix = $"CB-{b.CompanyCode.ToUpperInvariant()}-{DateTime.UtcNow.Year}-";
        var last = await _db.PaymentBatches.Where(x => x.BatchNumber.StartsWith(prefix)).OrderByDescending(x => x.BatchNumber).Select(x => x.BatchNumber).FirstOrDefaultAsync();
        var seq = last != null && int.TryParse(last[prefix.Length..], out var n) ? n + 1 : 1;
        var queried = b.Items.Where(i => i.DecisionStatus == "Queried").ToList();
        var reason = "Director queries: " + string.Join("; ", queried.Select(i => $"{i.SupplierName}: {i.QueryQuestion ?? i.DecisionComment}"));
        var nb = new PaymentBatch
        {
            BatchNumber = $"{prefix}{seq:0000}", CompanyCode = b.CompanyCode, PaymentType = b.PaymentType, BatchDate = b.BatchDate,
            Status = CreditorWorkflow.QueriedByDirector, Notes = Trunc($"Queried payments split from {b.BatchNumber}." + (string.IsNullOrWhiteSpace(b.Notes) ? "" : " " + b.Notes), 1000),
            PreparedByUserId = b.PreparedByUserId, PreparedByName = b.PreparedByName, SubmittedAt = b.SubmittedAt,
            RequestedApproverIds = b.RequestedApproverIds, RequestedApproverNames = b.RequestedApproverNames,
            RequestedDirectorIds = b.RequestedDirectorIds, RequestedDirectorNames = b.RequestedDirectorNames,
            AccountantUserId = b.AccountantUserId, AccountantName = b.AccountantName, AccountantApprovedAt = b.AccountantApprovedAt,
            AccountantComment = b.AccountantComment, ChecksRunAt = b.ChecksRunAt, ChecksStatus = b.ChecksStatus,
            ReturnReason = Trunc(reason, 1000), TotalAmount = queried.Sum(i => i.Amount)
        };
        nb.Events.Add(Ev("Created", null, CreditorWorkflow.QueriedByDirector, $"Split from {b.BatchNumber}: {queried.Count} payment(s) queried by {UserName}."));
        _db.PaymentBatches.Add(nb);
        await _db.SaveChangesAsync();

        var ids = queried.Select(i => i.Id).ToHashSet();
        var docs = b.Documents.Where(d => d.ItemId != null && ids.Contains(d.ItemId.Value)).ToList();
        // Re-parent by changing the foreign keys (not Remove(), which would mark the rows as orphans to delete);
        // DetectChanges then fixes up the loaded collections so b.Items / b.Documents no longer hold them.
        foreach (var it in queried) { it.BatchId = nb.Id; it.QueriedFromBatchNumber = b.BatchNumber; }
        foreach (var d in docs) d.BatchId = nb.Id;
        _db.ChangeTracker.DetectChanges();
        if (b.Items.Any(i => ids.Contains(i.Id))) throw new InvalidOperationException("Could not move the queried payments to their own pack.");
        b.TotalAmount = b.Items.Sum(i => i.Amount);
        b.Events.Add(Ev("QueriedSplit", null, null, Trunc($"{queried.Count} queried payment(s) moved to {nb.BatchNumber}: " + string.Join("; ", queried.Select(i => $"{i.SupplierName} R{i.Amount:N2}")), 1000)));
        return nb;
    }

    private static string Trunc(string s, int max) => s.Length > max ? s[..max] : s;

    /// <summary>
    /// Fix and resubmit a payment the director rejected: copies it (and its documents, as new files) onto a new draft pack for the
    /// same company and payment type, prepared by whoever clicks. The original stays on its signed pack, marked as resubmitted.
    /// </summary>
    [HttpPost("batches/{id:int}/items/{itemId:int}/resubmit")]
    public async Task<IActionResult> ResubmitRejected(int id, int itemId)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        var sentBack = it.DecisionStatus == "SentBack" && b.AccountantApprovedAt != null;
        if (!sentBack && (it.DecisionStatus != "Rejected" || b.DirectorSignedAt == null)) return Conflict(new { message = "Only a payment the accountant sent back, or the director rejected and signed off, can be resubmitted." });
        if (it.ResubmittedAsBatchNumber != null) return Conflict(new { message = $"This payment was already resubmitted on {it.ResubmittedAsBatchNumber}." });
        if (!await CanPrepareAsync(b)) return Forbid();

        var prefix = $"CB-{b.CompanyCode.ToUpperInvariant()}-{DateTime.UtcNow.Year}-";
        var last = await _db.PaymentBatches.Where(x => x.BatchNumber.StartsWith(prefix)).OrderByDescending(x => x.BatchNumber).Select(x => x.BatchNumber).FirstOrDefaultAsync();
        var seq = last != null && int.TryParse(last[prefix.Length..], out var n) ? n + 1 : 1;
        var nb = new PaymentBatch
        {
            BatchNumber = $"{prefix}{seq:0000}", CompanyCode = b.CompanyCode, PaymentType = b.PaymentType, BatchDate = DateTime.UtcNow.Date,
            Notes = Trunc(sentBack ? $"Resubmitted: {it.SupplierName} was sent back on {b.BatchNumber} by {b.AccountantName} — {it.DecisionComment}"
                                   : $"Resubmitted: {it.SupplierName} was rejected on {b.BatchNumber} by {b.DirectorName} — {it.DecisionComment}", 1000),
            PreparedByUserId = UserId, PreparedByName = UserName
        };
        nb.Events.Add(Ev("Created", null, CreditorWorkflow.Draft, Trunc($"Resubmitting {it.SupplierName} R{it.Amount:N2}, {(sentBack ? "sent back" : "rejected")} on {b.BatchNumber}: {it.DecisionComment}", 1000)));
        _db.PaymentBatches.Add(nb);
        await _db.SaveChangesAsync();

        var copy = (PaymentBatchItem)_db.Entry(it).CurrentValues.ToObject();
        copy.Id = 0; copy.BatchId = nb.Id; copy.Batch = null; copy.SortOrder = 1;
        copy.DecisionStatus = "Pending"; copy.DecisionComment = null; copy.DecidedAt = null; copy.PaidAt = null;
        copy.PrepaymentOpen = b.PaymentType == CreditorPaymentTypes.Prepayment;
        copy.QueryQuestion = null; copy.QueryAskedByName = null; copy.QueryAskedAt = null; copy.QueryResponse = null; copy.QueryRespondedByName = null; copy.QueryRespondedAt = null;
        copy.QueriedFromBatchNumber = null; copy.ResubmittedAsBatchNumber = null;
        copy.AccountantDecision = null; copy.AccountantDecisionComment = null; copy.AccountantDecidedAt = null;
        _db.PaymentBatchItems.Add(copy);
        await _db.SaveChangesAsync();

        foreach (var d in b.Documents.Where(d => d.ItemId == it.Id).ToList())
        {
            var dc = (PaymentBatchDocument)_db.Entry(d).CurrentValues.ToObject();
            dc.Id = 0; dc.BatchId = nb.Id; dc.ItemId = copy.Id; dc.Batch = null; dc.Version = 1; dc.SupersedesDocumentId = null; dc.VersionReason = null;
            if (d.StoragePath != null)
            {
                var src = Abs(d.StoragePath);
                if (!System.IO.File.Exists(src)) continue; // file gone — the preparer re-attaches it
                var rel = $"Finance/Creditors/{nb.CompanyCode}/{nb.BatchNumber}/{Guid.NewGuid():N}{Path.GetExtension(d.StoragePath)}";
                var dst = Abs(rel); Directory.CreateDirectory(Path.GetDirectoryName(dst)!);
                System.IO.File.Copy(src, dst);
                dc.StoragePath = rel; dc.FileName = Path.GetFileName(rel);
            }
            _db.PaymentBatchDocuments.Add(dc);
        }
        nb.TotalAmount = copy.Amount;
        it.ResubmittedAsBatchNumber = nb.BatchNumber;
        b.Events.Add(Ev("Resubmitted", null, null, $"{it.SupplierName} R{it.Amount:N2} resubmitted on {nb.BatchNumber}"));
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(nb.Id));
    }

    /// <summary>Emails the preparer: which payments the director rejected, why, and a link to open the pack and fix/resubmit them.</summary>
    private async Task EmailRejectedAsync(PaymentBatch b, List<PaymentBatchItem> rejected, string by)
    {
        var acc = by == "accountant";
        var verb = acc ? "sent back" : "rejected";
        var to = await _db.Users.AsNoTracking().Where(u => u.UserId == b.PreparedByUserId).Select(u => new { u.Email, u.Name }).FirstOrDefaultAsync();
        if (to == null || string.IsNullOrWhiteSpace(to.Email)) return;
        var company = await _db.CreditorCompanies.AsNoTracking().Where(x => x.Code == b.CompanyCode).Select(x => x.Name).FirstOrDefaultAsync() ?? b.CompanyCode;
        var link = $"{IntranetUrl()}/finance?tab=creditors&batch={b.Id}";
        static string H(string? s) => System.Net.WebUtility.HtmlEncode(s ?? "");
        var rows = string.Concat(rejected.Select(i => $@"
      <tr><td style='padding:8px 10px;border-top:1px solid #fecaca;vertical-align:top'><b>{H(i.SupplierName)}</b>{(string.IsNullOrWhiteSpace(i.InvoiceNumbers) ? "" : $"<br/><span style='color:#6b7280;font-size:12px'>Invoice {H(i.InvoiceNumbers)}</span>")}</td>
          <td style='padding:8px 10px;border-top:1px solid #fecaca;vertical-align:top;white-space:nowrap;text-align:right'>R {i.Amount:N2}</td>
          <td style='padding:8px 10px;border-top:1px solid #fecaca;vertical-align:top'>{(string.IsNullOrWhiteSpace(i.DecisionComment) ? "<em>No reason given</em>" : H(i.DecisionComment))}</td></tr>"));
        var subject = $"[Intranet] {rejected.Count} payment{(rejected.Count == 1 ? "" : "s")} {verb} on {b.BatchNumber} — {company}";
        var html = $@"
<div style='font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#1f2937'>
  <div style='background:#b91c1c;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0'><h2 style='margin:0;font-size:18px'>Payment{(rejected.Count == 1 ? "" : "s")} {verb} by the {by}</h2><div style='opacity:.9;font-size:13px'>{H(company)} · {H(b.BatchNumber)}</div></div>
  <div style='border:1px solid #e5e7eb;border-top:0;padding:22px 24px;border-radius:0 0 12px 12px'>
    <p style='margin:0 0 12px'>Hi {H((to.Name ?? b.PreparedByName ?? "").Split(' ')[0])},</p>
    <p style='margin:0 0 14px'><b>{H(UserName)}</b> {(acc ? "approved" : "signed")} payment pack <b>{H(b.BatchNumber)}</b> and {verb} {(rejected.Count == 1 ? "one of your payments" : $"{rejected.Count} of your payments")}. {(rejected.Count == 1 ? "It will not be paid" : "They will not be paid")} on this pack{(acc ? "; the rest have gone to the director" : "")}.</p>
    <table style='border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%;background:#fef2f2;border:1px solid #fecaca;border-radius:8px'>
      <tr style='color:#991b1b;font-size:12px;text-align:left'><th style='padding:8px 10px'>Payment</th><th style='padding:8px 10px;text-align:right'>Amount</th><th style='padding:8px 10px'>Reason</th></tr>{rows}
    </table>
    <p style='margin:0 0 16px'>Open the pack on the intranet to see the details. If it can be fixed, use <b>Fix and resubmit</b> on the payment: it puts a copy, with its documents, on a new draft pack for you to correct and send through again.</p>
    <a href='{link}' style='display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600'>Log on and view the pack</a>
    <p style='margin:18px 0 0;font-size:12px;color:#6b7280'>Sent automatically by the intranet. If the button doesn't work, copy this link: {link}</p>
  </div>
</div>";
        try { if (!await _email.SendEmailAsync(to.Email, subject, html)) _log.LogWarning("Rejection email to {Email} failed: {Err}", to.Email, _email.LastError); }
        catch (Exception e) { _log.LogWarning(e, "Rejection email to {Email} failed", to.Email); }
    }

    public record QueryAnswerDto(string Answer);

    /// <summary>
    /// The preparer (or the company accountant) answers the director's query on one payment. Once every queried payment on the pack has
    /// an answer, the pack goes straight back to the director — the accountant has already approved it.
    /// </summary>
    [HttpPost("batches/{id:int}/items/{itemId:int}/query-answer")]
    public async Task<IActionResult> AnswerQuery(int id, int itemId, [FromBody] QueryAnswerDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status != CreditorWorkflow.QueriedByDirector) return Conflict(new { message = "This pack has no open director queries." });
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        if (it.DecisionStatus != "Queried") return Conflict(new { message = "That payment isn't queried." });
        if (string.IsNullOrWhiteSpace(dto.Answer)) return BadRequest(new { message = "Type your answer for the director." });
        var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
        if (!await CanPrepareAsync(b) && !await IsAccountantForAsync(b, c)) return Forbid();

        it.QueryResponse = Trunc(dto.Answer.Trim(), 2000); it.QueryRespondedByName = UserName; it.QueryRespondedAt = DateTime.UtcNow;
        b.Events.Add(Ev("QueryAnswered", null, null, Trunc($"{it.SupplierName}: {it.QueryResponse}", 1000)));

        var stillOpen = b.Items.Any(i => i.DecisionStatus == "Queried" && i.QueryResponse == null);
        if (!stillOpen && b.AccountantApprovedAt != null)
        {
            foreach (var q in b.Items.Where(i => i.DecisionStatus == "Queried")) { q.DecisionStatus = "Pending"; q.DecidedAt = null; }
            var from = b.Status;
            b.Status = CreditorWorkflow.AwaitingDirector; b.ReturnReason = null;
            b.Events.Add(Ev("QueriesAnswered", from, b.Status, "Every query answered — back with the director."));
            var directors = b.RequestedDirectorIdList.Select(x => (int?)x).Append(b.DirectorUserId).Distinct();
            await NotifyAsync(directors, "Your payment queries were answered", $"{b.BatchNumber} · {b.CompanyCode}: the queried payments have answers and are back for your decision.", b.Id);
        }
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    /// <summary>
    /// Every payment the director has queried that is still open: waiting for an answer, or answered and back with the director.
    /// Feeds the Queried payments tab.
    /// </summary>
    [HttpGet("queries")]
    public async Task<IActionResult> Queries()
    {
        var rows = await _db.PaymentBatchItems.AsNoTracking()
            .Where(i => i.QueryQuestion != null
                        && (i.Batch!.Status == CreditorWorkflow.QueriedByDirector || i.Batch.Status == CreditorWorkflow.AwaitingDirector))
            .Select(i => new
            {
                i.Id, i.BatchId, i.Batch!.BatchNumber, i.Batch.CompanyCode, BatchStatus = i.Batch.Status,
                i.SupplierName, i.InvoiceNumbers, i.Description, i.Amount, i.DecisionStatus,
                i.QueryQuestion, i.QueryAskedByName, i.QueryAskedAt, i.QueryResponse, i.QueryRespondedByName, i.QueryRespondedAt, i.QueriedFromBatchNumber
            })
            .OrderByDescending(i => i.QueryAskedAt).Take(300).ToListAsync();
        var companies = await _db.CreditorCompanies.AsNoTracking().ToDictionaryAsync(c => c.Code, c => c.Name);
        var scope = new Dictionary<string, bool>();
        var outRows = new List<object>();
        foreach (var r in rows)
        {
            if (!scope.TryGetValue(r.CompanyCode, out var ok)) scope[r.CompanyCode] = ok = await InScopeAsync(r.CompanyCode);
            if (!ok) continue;
            var open = r.BatchStatus == CreditorWorkflow.QueriedByDirector && r.DecisionStatus == "Queried";
            var withDirector = r.BatchStatus == CreditorWorkflow.AwaitingDirector && r.DecisionStatus == "Pending" && r.QueryResponse != null;
            if (!open && !withDirector) continue;
            outRows.Add(new
            {
                itemId = r.Id, batchId = r.BatchId, batchNumber = r.BatchNumber, companyCode = r.CompanyCode, companyName = companies.GetValueOrDefault(r.CompanyCode, r.CompanyCode),
                supplierName = r.SupplierName, invoiceNumbers = r.InvoiceNumbers, description = r.Description, amount = r.Amount,
                question = r.QueryQuestion, askedBy = r.QueryAskedByName, askedAt = r.QueryAskedAt,
                answer = r.QueryResponse, answeredBy = r.QueryRespondedByName, answeredAt = r.QueryRespondedAt,
                fromBatch = r.QueriedFromBatchNumber,
                state = open ? (r.QueryResponse == null ? "Open" : "Answered") : "WithDirector"
            });
        }
        return Ok(outRows);
    }

    public record SignDto(string TypedName, string? Comment, string? SignatureImageBase64, bool UseSavedSignature = true);

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
        if (!await IsDirectorForAsync(b, c)) return Forbid();
        if (DirectorConflict(b) is { } conflict) return StatusCode(403, new { message = conflict });
        if (b.Items.Any(i => i.DecisionStatus == "Pending")) return Conflict(new { message = "Approve, query or reject every payment before signing." });
        var profile = await _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => new { u.Name, u.Surname }).FirstOrDefaultAsync();
        var expected = ($"{profile?.Name} {profile?.Surname}").Trim();
        if (string.IsNullOrWhiteSpace(expected)) expected = UserName.Trim();
        var typed = (dto.TypedName ?? "").Trim();
        if (!string.Equals(typed, expected, StringComparison.OrdinalIgnoreCase) && !string.Equals(typed, UserName.Trim(), StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = $"Type your full name exactly as it appears on your profile ({expected}) to sign." });
        var dsig = await ResolveSignatureAsync(dto.SignatureImageBase64, dto.UseSavedSignature);
        if (dsig == null) return BadRequest(NoSignature());

        var from = b.Status;
        PaymentBatch? split = null;
        if (b.Items.Any(i => i.DecisionStatus == "Queried") && b.Items.Any(i => i.DecisionStatus == "Approved"))
            split = await SplitQueriedAsync(b);

        if (b.Items.Any(i => i.DecisionStatus == "Queried"))
        {
            b.Status = CreditorWorkflow.QueriedByDirector;
            b.ReturnReason = "Director queries: " + string.Join("; ", b.Items.Where(i => i.DecisionStatus == "Queried").Select(i => $"{i.SupplierName}: {i.DecisionComment}"));
            b.Events.Add(Ev("DirectorQueried", from, b.Status, dto.Comment ?? b.ReturnReason));
            await NotifyAsync(new[] { (int?)b.PreparedByUserId, b.AccountantUserId }, "Director queried a payment pack", $"{b.BatchNumber}: {b.ReturnReason}", b.Id);
        }
        else if (b.Items.All(i => i.DecisionStatus is "Rejected" or "SentBack"))
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
            b.ScheduledPayDate = CreditorWorkflow.NextPayDay(DateTime.UtcNow);
            b.Events.Add(Ev("DirectorSigned", from, b.Status, $"{b.Items.Count(i => i.DecisionStatus == "Approved")} payment(s) approved, R{b.Items.Where(i => i.DecisionStatus == "Approved").Sum(i => i.Amount):N2}. Batch locked. Booked on the {b.ScheduledPayDate:ddd d MMM} pay-run."));
            var bankUsers = await _db.Users.AsNoTracking().Where(u => u.IsActive && u.Permissions != null && u.Permissions.Contains(CreditorWorkflow.RoleBank)).Select(u => (int?)u.UserId).ToListAsync();
            await NotifyAsync(bankUsers.Append(b.PreparedByUserId), "Payment pack approved — on the payment schedule", $"{b.BatchNumber} · {b.CompanyCode} · R{b.Items.Where(i => i.DecisionStatus == "Approved").Sum(i => i.Amount):N2} · pay-run {b.ScheduledPayDate:ddd d MMM}", b.Id);
        }
        if (split != null)
        {
            split.DirectorUserId = UserId; split.DirectorName = UserName; split.DirectorSignedAt = DateTime.UtcNow;
            await NotifyAsync(new[] { (int?)split.PreparedByUserId, split.AccountantUserId }, "Director queried payments",
                $"{split.BatchNumber}: {split.ReturnReason} Answer them on the Queried payments tab.", split.Id);
        }
        b.DirectorUserId = UserId; b.DirectorName = UserName; b.DirectorSignedAt = DateTime.UtcNow; b.DirectorComment = dto.Comment;

        await _sign.SignAsync(new SignatureRequest
        {
            EntityType = "PaymentBatch", EntityId = b.Id, Context = "DirectorSignOff", SignerUserId = UserId, SignerName = UserName, SignerRole = CreditorWorkflow.RoleDirector,
            Action = b.Status == CreditorWorkflow.Approved ? "Approve" : b.Status == CreditorWorkflow.Rejected ? "Reject" : "Return",
            Comment = dto.Comment, Method = dsig.Value.Method, IpAddress = Ip(), UserAgent = Ua(), Payload = Snapshot(b), SignatureImage = dsig.Value.Bytes, SignatureImageMimeType = dsig.Value.Mime
        });
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Tell the preparer which payments were rejected and why (in-app + email), with a link to fix and resubmit them.
        var rejected = b.Items.Where(i => i.DecisionStatus == "Rejected").ToList();
        if (rejected.Count > 0)
        {
            await NotifyAsync(new[] { (int?)b.PreparedByUserId }, $"{rejected.Count} payment{(rejected.Count == 1 ? "" : "s")} rejected by {UserName}",
                $"{b.BatchNumber}: " + string.Join("; ", rejected.Select(i => $"{i.SupplierName} R{i.Amount:N2} — {i.DecisionComment}")), b.Id);
            await EmailRejectedAsync(b, rejected, "director");
        }
        return Ok(await DetailAsync(id));
    }

    /// <summary>Image of one signature captured on this batch.</summary>
    [HttpGet("batches/{id:int}/signatures/{sigId:int}/image")]
    public async Task<IActionResult> SignatureImage(int id, int sigId)
    {
        var b = await _db.PaymentBatches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id); if (b == null) return NotFound();
        if (!await InScopeAsync(b.CompanyCode)) return Forbid();
        var s = await _db.ElectronicSignatures.AsNoTracking().FirstOrDefaultAsync(x => x.Id == sigId && x.EntityType == "PaymentBatch" && x.EntityId == id);
        if (s?.SignatureImage == null) return NotFound();
        return File(s.SignatureImage, s.SignatureImageMimeType ?? "image/png");
    }

    /// <summary>
    /// Signed approval sheet (PDF): payment schedule + the digital signatures of the preparer, accountant and director
    /// with names, dates and tamper hashes. Available at any stage; shows which signatures are still outstanding.
    /// </summary>
    [HttpGet("batches/{id:int}/approval-sheet.pdf")]
    public async Task<IActionResult> ApprovalSheet(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!await InScopeAsync(b.CompanyCode)) return Forbid();
        var pdf = await _packPdf.ApprovalSheetAsync(b);
        return File(pdf, "application/pdf", $"Approval-sheet-{b.BatchNumber}.pdf");
    }

    /// <summary>Printable payment schedule (A4 landscape): every payment with full bank details, amounts, decisions and signature lines.</summary>
    [HttpGet("batches/{id:int}/schedule.pdf")]
    public async Task<IActionResult> Schedule(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!await InScopeAsync(b.CompanyCode)) return Forbid();
        var pdf = await _packPdf.ScheduleAsync(b);
        return File(pdf, "application/pdf", $"Payment-schedule-{b.BatchNumber}.pdf");
    }

    /// <summary>
    /// Whole signed pack as one PDF: approval sheet first, then every uploaded PDF document, each stamped on its final page
    /// with the signature block. Only once the director has signed.
    /// </summary>
    [HttpGet("batches/{id:int}/signed-pack.pdf")]
    public async Task<IActionResult> SignedPack(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!await InScopeAsync(b.CompanyCode)) return Forbid();
        if (!CreditorWorkflow.Locked.Contains(b.Status)) return Conflict(new { message = "The signed pack is available once the director has signed." });
        var pdf = await _packPdf.SignedPackAsync(b, rel => Abs(rel));
        return File(pdf, "application/pdf", $"Signed-pack-{b.BatchNumber}.pdf");
    }

    /// <summary>
    /// Reading copy for approvers: approval sheet (with outstanding signatures marked) followed by every PDF in the pack, unstamped.
    /// Lets the accountant / director read the whole pack in one scroll before deciding. Not for drafts.
    /// </summary>
    [HttpGet("batches/{id:int}/review-pack.pdf")]
    public async Task<IActionResult> ReviewPack(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!await InScopeAsync(b.CompanyCode)) return Forbid();
        // Drafts too: the preparer can read the pack exactly as the approvers will (signatures simply show as outstanding).
        var pdf = await _packPdf.SignedPackAsync(b, rel => Abs(rel), stamp: CreditorWorkflow.Locked.Contains(b.Status));
        return File(pdf, "application/pdf", $"Pack-{b.BatchNumber}.pdf");
    }

    /// <summary>One payment, in one scroll: the approval sheet followed by every PDF attached to that payment.</summary>
    [HttpGet("batches/{id:int}/items/{itemId:int}/review.pdf")]
    public async Task<IActionResult> ReviewItem(int id, int itemId)
    {
        var b = await Load(id); if (b == null) return NotFound();
        var it = b.Items.FirstOrDefault(i => i.Id == itemId); if (it == null) return NotFound();
        var pdf = await _packPdf.SignedPackAsync(b, rel => Abs(rel), stamp: CreditorWorkflow.Locked.Contains(b.Status), itemId: itemId);
        return File(pdf, "application/pdf", $"Pack-{b.BatchNumber}-{SafeName(it.SupplierName)}.pdf");
    }

    /// <summary>
    /// Every document of a signed pack in one ZIP, for Treasury when loading on the bank: the approval sheet, the payment schedule,
    /// the pack-level documents and each approved payment's documents (originals, numbered by payment). Rejected and
    /// sent-back payments are left out — they are not being paid.
    /// </summary>
    [HttpGet("batches/{id:int}/documents.zip")]
    public async Task<IActionResult> DocumentsZip(int id)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (!await InScopeAsync(b.CompanyCode)) return Forbid();
        if (!CreditorWorkflow.Locked.Contains(b.Status)) return Conflict(new { message = "The documents can be downloaded once the director has signed." });
        var paid = b.Items.Where(i => i.DecisionStatus == "Approved").OrderBy(i => i.SortOrder).ThenBy(i => i.Id).ToList();
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        string Unique(string name)
        {
            var n = name; var k = 2;
            while (!used.Add(n)) n = $"{Path.GetFileNameWithoutExtension(name)} ({k++}){Path.GetExtension(name)}";
            return n;
        }
        using var ms = new MemoryStream();
        using (var zip = new System.IO.Compression.ZipArchive(ms, System.IO.Compression.ZipArchiveMode.Create, leaveOpen: true))
        {
            async Task AddBytes(string name, byte[] bytes)
            {
                var e = zip.CreateEntry(Unique(name), System.IO.Compression.CompressionLevel.Fastest);
                await using var es = e.Open(); await es.WriteAsync(bytes);
            }
            void AddFile(string name, string abs)
            {
                var e = zip.CreateEntry(Unique(name), System.IO.Compression.CompressionLevel.Fastest);
                using var es = e.Open(); using var fs = System.IO.File.OpenRead(abs); fs.CopyTo(es);
            }
            await AddBytes($"00 Approval sheet {b.BatchNumber}.pdf", await _packPdf.ApprovalSheetAsync(b));
            await AddBytes($"00 Payment schedule {b.BatchNumber}.pdf", await _packPdf.ScheduleAsync(b));
            string Ext(PaymentBatchDocument d) => Path.GetExtension(d.StoragePath ?? d.OriginalFileName ?? ".pdf");
            string Orig(PaymentBatchDocument d) => SafeName(Path.GetFileNameWithoutExtension((d.OriginalFileName ?? d.FileName ?? "document").Split('|').Last()));
            foreach (var d in b.Documents.Where(d => d.ItemId == null && !d.IsNotApplicable && d.StoragePath != null))
            {
                var abs = Abs(d.StoragePath!); if (!System.IO.File.Exists(abs)) continue;
                AddFile($"00 Pack - {CreditorChecksService.Label(d.DocType)} - {Orig(d)}{Ext(d)}", abs);
            }
            var n = 0;
            foreach (var it in paid)
            {
                n++;
                foreach (var d in b.Documents.Where(d => d.ItemId == it.Id && !d.IsNotApplicable && d.StoragePath != null).OrderBy(d => d.Id))
                {
                    var abs = Abs(d.StoragePath!); if (!System.IO.File.Exists(abs)) continue;
                    AddFile($"{n:00} {SafeName(it.SupplierName)} - {CreditorChecksService.Label(d.DocType)} - {Orig(d)}{Ext(d)}", abs);
                }
            }
        }
        b.Events.Add(Ev("DocumentsDownloaded", null, null, "All documents downloaded (ZIP)"));
        await _db.SaveChangesAsync();
        return File(ms.ToArray(), "application/zip", $"Documents-{b.BatchNumber}.zip");
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
        if (IsExecToken && dto.Decision is not ("LoadedOnBank" or "Paid" or "Closed"))
            return StatusCode(403, new { message = "Only Treasury steps (loaded, paid, closed) can be done from the off-site portal." });
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
                // The pay-run screen offers Close to Treasury as well as the preparer — honour that here.
                if (!await CanPrepareAsync(b) && !await HasAsync(CreditorWorkflow.RoleBank)) return Forbid();
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
                foreach (var it in b.Items.Where(i => i.DecisionStatus != "SentBack")) { it.DecisionStatus = "Pending"; it.DecisionComment = null; it.DecidedAt = null; it.AccountantDecision = null; it.AccountantDecisionComment = null; it.AccountantDecidedAt = null; }
                break;
            default: return BadRequest(new { message = "Unknown status." });
        }
        b.Events.Add(Ev("StatusChanged", from, b.Status, dto.Comment));
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    /// <summary>
    /// Lists only need a document's type, owner and file — not the text read off it (which runs to ~1 MB across the open packs).
    /// Loads that light shape and hangs it on the (untracked) batches.
    /// </summary>
    private async Task AttachLiteDocsAsync(List<PaymentBatch> batches)
    {
        if (batches.Count == 0) return;
        var ids = batches.Select(b => b.Id).ToList();
        var docs = await _db.PaymentBatchDocuments.AsNoTracking().Where(d => ids.Contains(d.BatchId))
            .Select(d => new PaymentBatchDocument
            {
                Id = d.Id, BatchId = d.BatchId, ItemId = d.ItemId, DocType = d.DocType, IsNotApplicable = d.IsNotApplicable,
                FileName = d.FileName, OriginalFileName = d.OriginalFileName, ContentType = d.ContentType, StoragePath = d.StoragePath,
                TextMethod = d.TextMethod, UploadedByName = d.UploadedByName, UploadedAt = d.UploadedAt, Version = d.Version
            }).ToListAsync();
        var byBatch = docs.ToLookup(d => d.BatchId);
        foreach (var b in batches) b.Documents = byBatch[b.Id].ToList();
    }

    /// <summary>True when the request came in on an off-site (exec portal) token.</summary>
    private bool IsExecToken => User.HasClaim(ExecAuth.ClaimScope, ExecAuth.ScopeValue);

    // ───────────────────────── payment schedule (treasury) ─────────────────────────

    /// <summary>
    /// Everything that has cleared the pack process (director signed) and still has to be loaded, paid or closed with proof of payment,
    /// grouped by the pay-run it is booked on. Pay-runs are Mondays and Wednesdays.
    /// </summary>
    [HttpGet("schedule")]
    public async Task<IActionResult> Schedule()
    {
        var isBank = await HasAsync(CreditorWorkflow.RoleBank);
        var isClerk = await HasAsync(CreditorWorkflow.RoleClerk);
        var companies = await _db.CreditorCompanies.AsNoTracking().ToDictionaryAsync(c => c.Code, c => c.Name);
        var scope = await ScopeAsync();
        var batches = (await _db.PaymentBatches.AsNoTracking().Include(b => b.Items)
            .Where(b => CreditorWorkflow.OnSchedule.Contains(b.Status))
            .OrderBy(b => b.ScheduledPayDate).ThenBy(b => b.Id).AsSplitQuery().ToListAsync())
            .Where(b => scope.Allows(b.CompanyCode)).ToList();
        await AttachLiteDocsAsync(batches);

        var rows = batches.Select(b =>
        {
            var approved = b.Items.Where(i => i.DecisionStatus == "Approved").OrderBy(i => i.SortOrder).ToList();
            bool HasPop(int itemId) => b.Documents.Any(d => d.ItemId == itemId && d.DocType == CreditorDocTypes.ProofOfPayment && d.StoragePath != null);
            var popDone = approved.Count(i => HasPop(i.Id));
            var payDate = b.ScheduledPayDate ?? CreditorWorkflow.NextPayDay(b.DirectorSignedAt ?? DateTime.UtcNow);
            return new
            {
                b.Id, b.BatchNumber, b.CompanyCode, companyName = companies.TryGetValue(b.CompanyCode, out var n) ? n : b.CompanyCode,
                b.PaymentType, paymentTypeTitle = CreditorChecksService.Label(b.PaymentType), b.Status, statusTitle = CreditorWorkflow.Title(b.Status),
                scheduledPayDate = payDate, overdue = b.Status != CreditorWorkflow.Paid && payDate.Date < (DateTime.UtcNow + TimeSpan.FromHours(2)).Date,
                b.DirectorName, b.DirectorSignedAt, b.AccountantName, b.PreparedByName, b.BankExportedAt, b.PaidAt,
                approvedAmount = approved.Sum(i => i.Amount), approvedItems = approved.Count, popDone, popMissing = approved.Count - popDone,
                openPrepayments = approved.Count(i => i.PrepaymentOpen),
                items = approved.Select(i => new
                {
                    i.Id, i.SupplierName, i.Amount, i.InvoiceNumbers, i.Description, i.BankName, i.AccountNumber, i.BranchCode, i.AccountHolder, i.PaymentReference, i.PaidAt, i.PrepaymentOpen,
                    i.ComplianceKind, i.ComplianceTitle,
                    hasPop = HasPop(i.Id),
                    popDocId = b.Documents.Where(d => d.ItemId == i.Id && d.DocType == CreditorDocTypes.ProofOfPayment && d.StoragePath != null).OrderByDescending(d => d.Version).Select(d => (int?)d.Id).FirstOrDefault()
                }),
                can = new
                {
                    bankFile = isBank, markLoaded = isBank && b.Status == CreditorWorkflow.Approved, markPaid = isBank && b.Status is CreditorWorkflow.Approved or CreditorWorkflow.LoadedOnBank,
                    uploadPop = isBank || isClerk, close = b.Status == CreditorWorkflow.Paid && (isClerk || isBank), reschedule = (isBank || isClerk) && b.Status != CreditorWorkflow.Paid
                }
            };
        }).ToList();

        // In progress: packs still being prepared or approved. Read-only for Treasury — shows where each one is and what has been uploaded.
        var inProgressBatches = (await _db.PaymentBatches.AsNoTracking().Include(b => b.Items)
            .Where(b => CreditorWorkflow.InProgress.Contains(b.Status))
            .OrderBy(b => b.SubmittedAt ?? b.CreatedAt).ThenBy(b => b.Id).AsSplitQuery().ToListAsync())
            .Where(b => scope.Allows(b.CompanyCode)).ToList();
        await AttachLiteDocsAsync(inProgressBatches);
        var inProgress = inProgressBatches.Select(b =>
        {
            var live = b.Items.Where(i => i.DecisionStatus != "Rejected" && i.DecisionStatus != "SentBack").OrderBy(i => i.SortOrder).ThenBy(i => i.Id).ToList();
            object Doc(PaymentBatchDocument d) => new { d.Id, d.DocType, title = CreditorChecksService.Label(d.DocType), d.OriginalFileName, d.TextMethod, d.UploadedAt, d.UploadedByName };
            var uploaded = b.Documents.Where(d => d.StoragePath != null).ToList();
            return new
            {
                b.Id, b.BatchNumber, b.CompanyCode, companyName = companies.TryGetValue(b.CompanyCode, out var n) ? n : b.CompanyCode,
                b.PaymentType, paymentTypeTitle = CreditorChecksService.Label(b.PaymentType), b.Status, statusTitle = CreditorWorkflow.Title(b.Status),
                stage = CreditorWorkflow.StageOf(b.Status), sentBack = b.Status is CreditorWorkflow.ChecksFailed or CreditorWorkflow.QueriedByAccountant or CreditorWorkflow.QueriedByDirector,
                b.BatchDate, b.CreatedAt, b.SubmittedAt, b.PreparedByName, b.AccountantName, b.AccountantApprovedAt, b.ChecksStatus, b.ReturnReason,
                b.RequestedApproverNames, b.RequestedDirectorNames,
                amount = live.Sum(i => i.Amount), itemCount = live.Count, documentCount = uploaded.Count,
                expectedPayDate = CreditorWorkflow.NextPayDay(DateTime.UtcNow),
                batchDocuments = uploaded.Where(d => d.ItemId == null).OrderBy(d => d.DocType).Select(Doc),
                items = live.Select(i => new
                {
                    i.Id, i.SupplierName, i.Amount, i.InvoiceNumbers, i.Description, i.ComplianceKind, i.ComplianceTitle, i.DecisionStatus,
                    documents = uploaded.Where(d => d.ItemId == i.Id).OrderBy(d => d.DocType).ThenBy(d => d.Version).Select(Doc)
                })
            };
        }).ToList();

        return Ok(new
        {
            inProgress,
            payDays = CreditorWorkflow.UpcomingPayDays(DateTime.UtcNow, 6),
            nextPayDay = CreditorWorkflow.NextPayDay(DateTime.UtcNow),
            me = new { bank = isBank, clerk = isClerk },
            totals = new
            {
                toLoad = rows.Where(r => r.Status == CreditorWorkflow.Approved).Sum(r => r.approvedAmount), toLoadCount = rows.Count(r => r.Status == CreditorWorkflow.Approved),
                loaded = rows.Where(r => r.Status == CreditorWorkflow.LoadedOnBank).Sum(r => r.approvedAmount), loadedCount = rows.Count(r => r.Status == CreditorWorkflow.LoadedOnBank),
                awaitingPop = rows.Where(r => r.Status == CreditorWorkflow.Paid).Sum(r => r.approvedAmount), awaitingPopCount = rows.Count(r => r.Status == CreditorWorkflow.Paid),
                overdue = rows.Count(r => r.overdue),
                inProgress = inProgress.Sum(r => r.amount), inProgressCount = inProgress.Count
            },
            batches = rows
        });
    }

    public record ScheduleDto(DateTime Date, string? Comment);

    /// <summary>Move a signed batch to another pay-run (treasurer / clerk).</summary>
    [HttpPost("batches/{id:int}/schedule")]
    public async Task<IActionResult> Reschedule(int id, [FromBody] ScheduleDto dto)
    {
        var b = await Load(id); if (b == null) return NotFound();
        if (b.Status is not (CreditorWorkflow.Approved or CreditorWorkflow.LoadedOnBank)) return Conflict(new { message = "Only a signed, unpaid batch can be rescheduled." });
        if (!(await HasAsync(CreditorWorkflow.RoleBank) || await HasAsync(CreditorWorkflow.RoleClerk))) return Forbid();
        var date = dto.Date.Date;
        if (!CreditorWorkflow.PayDays.Contains(date.DayOfWeek)) return BadRequest(new { message = "Pay-runs are on Mondays and Wednesdays." });
        var from = b.ScheduledPayDate;
        b.ScheduledPayDate = date;
        b.Events.Add(Ev("Rescheduled", null, null, $"Pay-run moved {(from == null ? "" : $"from {from:ddd d MMM} ")}to {date:ddd d MMM}. {dto.Comment}".Trim()));
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await DetailAsync(id));
    }

    // ───────────────────────── history (treasury / directors) ─────────────────────────

    /// <summary>
    /// Payment history: batches that have been paid or closed, with their items and proofs of payment.
    /// Filters: from/to (paid date), company, q (batch number / supplier / reference).
    /// </summary>
    [HttpGet("history")]
    public async Task<IActionResult> History([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? company, [FromQuery] string? q, [FromQuery] string? supplier, [FromQuery] int take = 300)
    {
        var companies = await _db.CreditorCompanies.AsNoTracking().ToDictionaryAsync(c => c.Code, c => c.Name);
        var scope = await ScopeAsync();
        if (!scope.All) companies = companies.Where(kv => scope.Allows(kv.Key)).ToDictionary(kv => kv.Key, kv => kv.Value);
        if (!string.IsNullOrWhiteSpace(company) && !scope.Allows(company)) return StatusCode(403, new { message = "You are not assigned to that company." });
        var query = _db.PaymentBatches.AsNoTracking().Include(b => b.Items)
            .Where(b => b.Status == CreditorWorkflow.Paid || b.Status == CreditorWorkflow.Closed);
        if (!scope.All) { var codes = scope.CreditorCodes.ToList(); query = query.Where(b => codes.Contains(b.CompanyCode)); }
        if (from.HasValue) query = query.Where(b => (b.PaidAt ?? b.ClosedAt ?? b.UpdatedAt) >= from.Value.Date);
        if (to.HasValue) { var t = to.Value.Date.AddDays(1); query = query.Where(b => (b.PaidAt ?? b.ClosedAt ?? b.UpdatedAt) < t); }
        if (!string.IsNullOrWhiteSpace(company)) query = query.Where(b => b.CompanyCode == company);
        if (!string.IsNullOrWhiteSpace(supplier)) { var sn = supplier.Trim().ToLower(); query = query.Where(b => b.Items.Any(i => i.SupplierName.ToLower().Contains(sn))); }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            // "12 345.67" / "R12,345.67" also matches on amount (pack total or a single payment)
            var amt = decimal.TryParse(s.Replace("r", "").Replace(" ", "").Replace(",", ""), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var a) ? a : (decimal?)null;
            query = query.Where(b => b.BatchNumber.ToLower().Contains(s) || (b.Notes != null && b.Notes.ToLower().Contains(s)) || (b.PreparedByName != null && b.PreparedByName.ToLower().Contains(s))
                || b.Items.Any(i => i.SupplierName.ToLower().Contains(s) || (i.PaymentReference != null && i.PaymentReference.ToLower().Contains(s)) || (i.InvoiceNumbers != null && i.InvoiceNumbers.ToLower().Contains(s)) || (i.Description != null && i.Description.ToLower().Contains(s)) || (i.ComplianceDetail != null && i.ComplianceDetail.ToLower().Contains(s)))
                || (amt != null && (b.TotalAmount == amt || b.Items.Any(i => i.Amount == amt))));
        }
        var batches = await query.OrderByDescending(b => b.PaidAt ?? b.ClosedAt ?? b.UpdatedAt).Take(Math.Clamp(take, 1, 2000)).AsSplitQuery().ToListAsync();
        await AttachLiteDocsAsync(batches);

        var rows = batches.Select(b =>
        {
            var approved = b.Items.Where(i => i.DecisionStatus == "Approved").OrderBy(i => i.SortOrder).ToList();
            int? Pop(int itemId) => b.Documents.Where(d => d.ItemId == itemId && d.DocType == CreditorDocTypes.ProofOfPayment && d.StoragePath != null).OrderByDescending(d => d.Version).Select(d => (int?)d.Id).FirstOrDefault();
            var popDone = approved.Count(i => Pop(i.Id) != null);
            return new
            {
                b.Id, b.BatchNumber, b.CompanyCode, companyName = companies.TryGetValue(b.CompanyCode, out var n) ? n : b.CompanyCode,
                b.PaymentType, paymentTypeTitle = CreditorChecksService.Label(b.PaymentType), b.Status, statusTitle = CreditorWorkflow.Title(b.Status),
                b.ScheduledPayDate, b.DirectorName, b.DirectorSignedAt, b.AccountantName, b.AccountantApprovedAt, b.PreparedByName, b.BankExportedAt, b.PaidAt, b.ClosedAt,
                amount = approved.Sum(i => i.Amount), items = approved.Count, popDone, popMissing = approved.Count - popDone,
                lines = approved.Select(i => new { i.Id, i.SupplierName, i.Amount, i.InvoiceNumbers, i.Description, i.ComplianceKind, i.ComplianceTitle, i.BankName, i.AccountNumber, i.PaymentReference, i.PaidAt, popDocId = Pop(i.Id) })
            };
        }).ToList();

        return Ok(new
        {
            count = rows.Count, total = rows.Sum(r => r.amount), popMissing = rows.Sum(r => r.popMissing),
            companies = companies.Select(c => new { code = c.Key, name = c.Value }).OrderBy(c => c.name),
            batches = rows
        });
    }

    // ───────────────────────── executive (directors) ─────────────────────────

    /// <summary>Director's view: packs waiting for signature, the pipeline, the next pay-runs, and how each company is paying out.</summary>
    [HttpGet("executive")]
    public async Task<IActionResult> Executive()
    {
        var isDirector = await HasAsync(CreditorWorkflow.RoleDirector);
        var isExecRole = UserRole is "Manager" or "Director" or "Treasurer";
        var hasExecPerm = await HasAsync(FinanceAuthority.ExecDashboard) || await HasAsync(CreditorWorkflow.RoleBank);
        // Accountants and clerks never see the executive view, whatever else they've been granted.
        var isFinanceStaff = (UserRole ?? "").Trim().ToLowerInvariant() is "accountant" or "clerk" or "creditor clerk" or "debtor clerk";
        if (!IsSystemAdmin && (isFinanceStaff || (!isDirector && !isExecRole && !hasExecPerm))) return Forbid();

        var now = DateTime.UtcNow;
        var scope = await ScopeAsync();
        var companies = (await _db.CreditorCompanies.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ToListAsync()).Where(c => scope.Allows(c.Code)).ToList();
        var all = (await _db.PaymentBatches.AsNoTracking().Include(b => b.Items)
            .Where(b => b.Status != CreditorWorkflow.Rejected && (b.Status != CreditorWorkflow.Closed || b.PaidAt >= now.AddMonths(-7)))
            .ToListAsync()).Where(b => scope.Allows(b.CompanyCode)).ToList();
        string Name(string code) => companies.FirstOrDefault(c => c.Code == code)?.Name ?? code;
        decimal Appr(PaymentBatch b) => b.Items.Where(i => i.DecisionStatus == "Approved").Sum(i => i.Amount);

        var approversAll = await ApproversAsync();
        var awaiting = all.Where(b => b.Status == CreditorWorkflow.AwaitingDirector).OrderBy(b => b.SubmittedAt).Select(b =>
        {
            approversAll.TryGetValue(b.CompanyCode, out var ap);
            var req = b.RequestedDirectorIdList;
            var forMe = IsSystemAdmin || ((ap == null || ap.Directors.Count == 0 || ap.IsDirector(UserId)) && (req.Count == 0 || req.Contains(UserId)));
            return new
            {
                b.Id, b.BatchNumber, b.CompanyCode, companyName = Name(b.CompanyCode), b.PaymentType, paymentTypeTitle = CreditorChecksService.Label(b.PaymentType),
                b.TotalAmount, items = b.Items.Count, decided = b.Items.Count(i => i.DecisionStatus != "Pending"),
                b.PreparedByName, b.SubmittedAt, b.AccountantName, b.AccountantApprovedAt, b.ChecksStatus, forMe,
                waitingDays = b.AccountantApprovedAt != null ? (int)(now - b.AccountantApprovedAt.Value).TotalDays : 0,
                suppliers = b.Items.OrderByDescending(i => i.Amount).Take(4).Select(i => new { i.SupplierName, i.Amount })
            };
        }).ToList();

        var pipeline = CreditorWorkflow.Ordered.Concat(new[] { CreditorWorkflow.ChecksFailed, CreditorWorkflow.QueriedByAccountant, CreditorWorkflow.QueriedByDirector })
            .Select(s => new { status = s, title = CreditorWorkflow.Title(s), count = all.Count(b => b.Status == s), amount = all.Where(b => b.Status == s).Sum(b => CreditorWorkflow.Locked.Contains(s) ? Appr(b) : b.TotalAmount) })
            .Where(x => x.count > 0).ToList();

        var schedule = all.Where(b => CreditorWorkflow.OnSchedule.Contains(b.Status))
            .GroupBy(b => (b.ScheduledPayDate ?? CreditorWorkflow.NextPayDay(b.DirectorSignedAt ?? now)).Date)
            .OrderBy(g => g.Key)
            .Select(g => new { date = g.Key, count = g.Count(), amount = g.Sum(Appr), paid = g.Where(b => b.Status == CreditorWorkflow.Paid).Sum(Appr), loaded = g.Where(b => b.Status == CreditorWorkflow.LoadedOnBank).Sum(Appr) })
            .ToList();

        var months = Enumerable.Range(0, 6).Select(i => new DateTime(now.Year, now.Month, 1).AddMonths(-5 + i)).ToList();
        var paidByMonth = months.Select(m => new
        {
            month = m, label = m.ToString("MMM yy"),
            total = all.Where(b => b.PaidAt != null && b.PaidAt >= m && b.PaidAt < m.AddMonths(1)).Sum(Appr),
            byCompany = companies.Select(c => new { c.Code, amount = all.Where(b => b.CompanyCode == c.Code && b.PaidAt != null && b.PaidAt >= m && b.PaidAt < m.AddMonths(1)).Sum(Appr) }).Where(x => x.amount > 0)
        }).ToList();

        var since90 = now.AddDays(-90);
        var recentItems = all.Where(b => CreditorWorkflow.Locked.Contains(b.Status) && b.DirectorSignedAt >= since90).SelectMany(b => b.Items.Where(i => i.DecisionStatus == "Approved").Select(i => new { b.CompanyCode, b.PaymentType, i.SupplierName, i.Amount })).ToList();
        var spendByType = recentItems.GroupBy(i => i.PaymentType).Select(g => new { type = g.Key, title = CreditorChecksService.Label(g.Key), amount = g.Sum(i => i.Amount), count = g.Count() }).OrderByDescending(x => x.amount).ToList();
        var topSuppliers = recentItems.GroupBy(i => i.SupplierName.Trim(), StringComparer.OrdinalIgnoreCase).Select(g => new { supplier = g.Key, amount = g.Sum(i => i.Amount), payments = g.Count(), companies = g.Select(i => i.CompanyCode).Distinct().Count() }).OrderByDescending(x => x.amount).Take(10).ToList();

        var monthStart = new DateTime(now.Year, now.Month, 1);
        var nameIds = companies.SelectMany(c => new[] { c.DirectorUserId, c.AccountantUserId }).Where(i => i != null).Select(i => i!.Value).Distinct().ToList();
        var names = await _db.Users.AsNoTracking().Where(u => nameIds.Contains(u.UserId)).ToDictionaryAsync(u => u.UserId, u => (u.Name + " " + u.Surname).Trim());
        string? N(int? id) => id != null && names.TryGetValue(id.Value, out var n) ? n : null;
        var perCompany = companies.Select(c =>
        {
            var mine = all.Where(b => b.CompanyCode == c.Code).ToList();
            return new
            {
                c.Code, c.Name, c.Activity, directorName = N(c.DirectorUserId), accountantName = N(c.AccountantUserId),
                awaitingDirector = mine.Where(b => b.Status == CreditorWorkflow.AwaitingDirector).Sum(b => b.TotalAmount), awaitingDirectorCount = mine.Count(b => b.Status == CreditorWorkflow.AwaitingDirector),
                inPreparation = mine.Where(b => b.Status is CreditorWorkflow.Draft or CreditorWorkflow.ChecksFailed or CreditorWorkflow.AwaitingAccountant or CreditorWorkflow.QueriedByAccountant or CreditorWorkflow.QueriedByDirector).Sum(b => b.TotalAmount),
                onSchedule = mine.Where(b => b.Status is CreditorWorkflow.Approved or CreditorWorkflow.LoadedOnBank).Sum(Appr),
                paidThisMonth = mine.Where(b => b.PaidAt >= monthStart).Sum(Appr),
                paidLast90 = mine.Where(b => b.PaidAt >= since90).Sum(Appr),
                awaitingPop = mine.Where(b => b.Status == CreditorWorkflow.Paid).Sum(Appr),
            };
        }).ToList();

        return Ok(new
        {
            generatedAt = now, me = new { userId = UserId, isDirector, isAdmin = IsSystemAdmin },
            awaiting, awaitingForMe = awaiting.Count(a => a.forMe), awaitingAmount = awaiting.Sum(a => a.TotalAmount),
            pipeline, schedule, nextPayDay = CreditorWorkflow.NextPayDay(now), paidByMonth, spendByType, topSuppliers, perCompany,
            signedLast30 = all.Count(b => b.DirectorSignedAt >= now.AddDays(-30) && CreditorWorkflow.Locked.Contains(b.Status)),
            signedLast30Amount = all.Where(b => b.DirectorSignedAt >= now.AddDays(-30) && CreditorWorkflow.Locked.Contains(b.Status)).Sum(Appr),
            paidThisMonth = all.Where(b => b.PaidAt >= monthStart).Sum(Appr),
            awaitingPopAmount = all.Where(b => b.Status == CreditorWorkflow.Paid).Sum(Appr)
        });
    }

    // ───────────────────────── alerts (fraud & control) ─────────────────────────

    [HttpGet("alerts")]
    public async Task<IActionResult> Alerts()
    {
        var scope = await ScopeAsync();
        var open = (await _db.PaymentBatches.AsNoTracking()
            .Where(b => b.Status != CreditorWorkflow.Closed && b.Status != CreditorWorkflow.Rejected && b.ChecksJson != null)
            .Select(b => new { b.Id, b.BatchNumber, b.CompanyCode, b.Status, b.ChecksJson }).ToListAsync()).Where(b => scope.Allows(b.CompanyCode)).ToList();
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
        alerts.AddRange(stalePrepay.Where(p => scope.Allows(p.CompanyCode)));
        return Ok(alerts);
    }

    // ───────────────────────── detail DTO ─────────────────────────

    /// <summary>Loads a batch for editing; null when it doesn't exist OR belongs to a company outside the caller's scope.</summary>
    private async Task<PaymentBatch?> Load(int id)
    {
        var b = await _db.PaymentBatches.Include(b => b.Items).Include(b => b.Documents).Include(b => b.Events).AsSplitQuery().FirstOrDefaultAsync(b => b.Id == id);
        return b != null && await InScopeAsync(b.CompanyCode) ? b : null;
    }

    private async Task<object?> DetailAsync(int id)
    {
        var b = await _db.PaymentBatches.AsNoTracking().Include(x => x.Items).Include(x => x.Documents).Include(x => x.Events).FirstOrDefaultAsync(x => x.Id == id);
        if (b == null || !await InScopeAsync(b.CompanyCode)) return null;
        var c = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == b.CompanyCode);
        var sigs = await _sign.GetForEntityAsync("PaymentBatch", b.Id);
        var closing = CreditorWorkflow.Locked.Contains(b.Status);

        bool Filled(string dt, int? itemId) => b.Documents.Any(d => d.DocType == dt && d.ItemId == itemId && (d.IsNotApplicable || d.StoragePath != null));
        var batchReq = CreditorDocRules.RequiredForBatch(b.PaymentType).Select(dt => new { docType = dt, title = CreditorChecksService.Label(dt), filled = Filled(dt, null) }).ToList();
        bool HasRecon(int itemId) => b.Documents.Any(d => d.ItemId == itemId && d.DocType == CreditorDocTypes.SupplierRecon && d.StoragePath != null);
        var itemReq = b.Items.ToDictionary(i => i.Id, i => CreditorDocRules.RequiredForItem(b.PaymentType, i.StockReturned, closing, HasRecon(i.Id)).Select(dt => new { docType = dt, title = CreditorChecksService.Label(dt), filled = Filled(dt, i.Id) }).ToList());
        var itemRec = b.Items.ToDictionary(i => i.Id, i => CreditorDocRules.RecommendedForItem(b.PaymentType, i.StockReturned, closing, HasRecon(i.Id), i.PayoutMethod).Select(dt => new { docType = dt, title = CreditorChecksService.Label(dt), filled = Filled(dt, i.Id) }).ToList());
        var allFilled = batchReq.All(r => r.filled) && itemReq.Values.All(l => l.All(r => r.filled)) && b.Items.Count > 0;

        var canPrepare = await CanPrepareAsync(b);
        var isAcc = await IsAccountantForAsync(b, c);
        var isDir = await IsDirectorForAsync(b, c);
        var isBank = await HasAsync(CreditorWorkflow.RoleBank);
        var editable = CreditorWorkflow.PreparerEditable.Contains(b.Status);
        var ap = await ApproversForAsync(b.CompanyCode);

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
            b.LockedAt, b.LockHash, b.BankExportedAt, b.PaidAt, b.ClosedAt, b.ReturnReason, b.ScheduledPayDate,
            requestedApproverIds = b.RequestedApproverIdList, b.RequestedApproverNames, requestedDirectorIds = b.RequestedDirectorIdList, b.RequestedDirectorNames,
            responsible = new
            {
                accountant = ap.Accountants.FirstOrDefault()?.UserId, backup = ap.Accountants.Skip(1).FirstOrDefault()?.UserId,
                director = ap.Directors.FirstOrDefault()?.UserId, delegateDirector = ap.Directors.Skip(1).FirstOrDefault()?.UserId,
                accountants = ap.Accountants.Select(x => new { userId = x.UserId, x.Name, x.Role }), directors = ap.Directors.Select(x => new { userId = x.UserId, x.Name, x.Role })
            },
            items = b.Items.OrderBy(i => i.SortOrder).Select(i => new
            {
                i.Id, i.SupplierName, i.SupplierVatNumber, i.InvoiceNumbers, i.Description, i.Amount, i.BankName, i.AccountNumber, i.BranchCode, i.AccountHolder, i.PaymentReference,
                i.StockReturned, i.IsUrgent, i.PaymentMode, paymentModeTitle = CreditorPaymentModes.Title(i.PaymentMode), i.PayoutMethod,
                i.ComplianceKind, i.ComplianceDetail, i.ComplianceTitle,
                i.DecisionStatus, i.DecisionComment, i.DecidedAt, i.PrepaymentOpen, i.PaidAt, i.SortOrder,
                i.QueryQuestion, i.QueryAskedByName, i.QueryAskedAt, i.QueryResponse, i.QueryRespondedByName, i.QueryRespondedAt, i.QueriedFromBatchNumber, i.ResubmittedAsBatchNumber,
                i.AccountantDecision, i.AccountantDecisionComment, i.AccountantDecidedAt,
                required = itemReq[i.Id],
                recommended = itemRec[i.Id],
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
                delete = canPrepare && CreditorWorkflow.Deletable.Contains(b.Status),
                submit = editable && canPrepare && allFilled,
                reopen = canPrepare && b.Status is CreditorWorkflow.ChecksFailed or CreditorWorkflow.QueriedByAccountant or CreditorWorkflow.QueriedByDirector or CreditorWorkflow.Rejected,
                accountant = b.Status == CreditorWorkflow.AwaitingAccountant && isAcc && (b.PreparedByUserId != UserId || IsSystemAdmin),
                reassign = b.Status == CreditorWorkflow.AwaitingAccountant && canPrepare,
                recall = b.Status == CreditorWorkflow.AwaitingAccountant && canPrepare,
                direct = b.Status == CreditorWorkflow.AwaitingDirector && isDir && DirectorConflict(b) == null,
                sign = b.Status == CreditorWorkflow.AwaitingDirector && isDir && DirectorConflict(b) == null && b.AccountantApprovedAt != null && b.Items.All(i => i.DecisionStatus != "Pending"),
                directorConflict = b.Status == CreditorWorkflow.AwaitingDirector && isDir ? DirectorConflict(b) : null,
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

    private string IntranetUrl()
    {
        var u = _cfg["Intranet:PublicUrl"] ?? _cfg["App:PublicUrl"];
        if (string.IsNullOrWhiteSpace(u)) u = Request.Headers.Origin.ToString();
        if (string.IsNullOrWhiteSpace(u)) u = $"{Request.Scheme}://{Request.Host}";
        return u.TrimEnd('/');
    }

    /// <summary>
    /// Emails each approver: "payment pack {no} created by {preparer} — you are requested to check and sign on the intranet".
    /// Failures are logged, never block the workflow.
    /// </summary>
    private async Task EmailApproversAsync(IEnumerable<Approver> people, PaymentBatch b, string ask, string step, string? approvedBy = null)
    {
        var list = people.Where(p => !string.IsNullOrWhiteSpace(p.Email)).ToList();
        if (list.Count == 0) return;
        var link = $"{IntranetUrl()}/finance?tab=creditors&batch={b.Id}";
        var execLink = ExecAuth.PublicUrl(_cfg) is { } pub ? $"{pub}/pack/{b.Id}" : null;
        var company = await _db.CreditorCompanies.AsNoTracking().Where(x => x.Code == b.CompanyCode).Select(x => x.Name).FirstOrDefaultAsync() ?? b.CompanyCode;
        var subject = $"[Intranet] Payment pack {b.BatchNumber} — {company} · R{b.TotalAmount:N2} — please {ask}";
        static string H(string? s) => System.Net.WebUtility.HtmlEncode(s ?? "");
        foreach (var p in list)
        {
            var html = $@"
<div style='font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937'>
  <div style='background:#4f46e5;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0'><h2 style='margin:0;font-size:18px'>Payment pack awaiting you</h2><div style='opacity:.85;font-size:13px'>{H(step)}</div></div>
  <div style='border:1px solid #e5e7eb;border-top:0;padding:22px 24px;border-radius:0 0 12px 12px'>
    <p style='margin:0 0 12px'>Hi {H(p.Name.Split(' ')[0])},</p>
    <p style='margin:0 0 14px'>Payment pack <b>{H(b.BatchNumber)}</b> was created by <b>{H(b.PreparedByName)}</b>{(approvedBy != null ? $" and approved by <b>{H(approvedBy)}</b>" : "")}. You are requested to <b>{H(ask)}</b> it on the intranet.</p>
    <table style='border-collapse:collapse;font-size:14px;margin:0 0 18px'>
      <tr><td style='padding:4px 14px 4px 0;color:#6b7280'>Paying company</td><td><b>{H(company)}</b> ({H(b.CompanyCode)})</td></tr>
      <tr><td style='padding:4px 14px 4px 0;color:#6b7280'>Type</td><td>{H(CreditorChecksService.Label(b.PaymentType))}</td></tr>
      <tr><td style='padding:4px 14px 4px 0;color:#6b7280'>Payments</td><td>{b.Items.Count} · <b>R {b.TotalAmount:N2}</b></td></tr>
      <tr><td style='padding:4px 14px 4px 0;color:#6b7280'>Dated</td><td>{b.BatchDate:dd MMM yyyy}</td></tr>
      {(string.IsNullOrWhiteSpace(b.Notes) ? "" : $"<tr><td style='padding:4px 14px 4px 0;color:#6b7280'>Note</td><td>{H(b.Notes)}</td></tr>")}
    </table>
    <a href='{link}' style='display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600'>Open the pack on the intranet</a>
    {(execLink != null ? $"<a href='{execLink}' style='display:inline-block;margin-left:8px;background:#fff;color:#4f46e5;border:1px solid #4f46e5;text-decoration:none;padding:9px 18px;border-radius:8px;font-weight:600'>Approve off-site (phone / home)</a>" : "")}
    <p style='margin:18px 0 0;font-size:12px;color:#6b7280'>Sent automatically by the intranet. If the buttons don't work, copy this link: {link}{(execLink != null ? $" — or, away from the office: {execLink}" : "")}</p>
  </div>
</div>";
            try { if (!await _email.SendEmailAsync(p.Email!, subject, html)) _log.LogWarning("Creditors email to {Email} failed: {Err}", p.Email, _email.LastError); }
            catch (Exception e) { _log.LogWarning(e, "Creditors email to {Email} failed", p.Email); }
        }
    }

    private string Abs(string rel) => Path.Combine(_root, rel.Replace('/', Path.DirectorySeparatorChar));
    private static void TryDelete(string p) { try { if (System.IO.File.Exists(p)) System.IO.File.Delete(p); } catch { } }
    private string? Ip() => HttpContext.Connection.RemoteIpAddress?.ToString();
    private string? Ua() => Request.Headers.UserAgent.ToString() is { Length: > 0 } s ? (s.Length > 500 ? s[..500] : s) : null;
    private static string Csv(string? s) => s == null ? "" : (s.Contains(',') || s.Contains('"') ? "\"" + s.Replace("\"", "\"\"") + "\"" : s);
}
