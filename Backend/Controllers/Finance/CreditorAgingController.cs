using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using ExcelDataReader;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance.Creditors;

namespace ProjectTracker.API.Controllers.Finance;

/// <summary>
/// Creditors' age analysis per paying company. Finance uploads the Sage 300
/// "A/P Aged Payables by Due Date" (APAPAYSY) summary (.xls or .xlsx); each upload is kept as a dated
/// snapshot: one row per vendor with Current / 1–30 / 31–60 / 61–90 / Over 90, overdue and total.
/// The newest snapshot per company also feeds the supplier picker on payment packs.
/// </summary>
[Authorize]
[ApiController]
[Route("api/finance/creditors/aging")]
[RequireModule("finance", AlsoAllowRoles = "Finance,Manager,Admin")]
public class CreditorAgingController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<CreditorAgingController> _log;
    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;
    public CreditorAgingController(ApplicationDbContext db, ILogger<CreditorAgingController> log, Microsoft.Extensions.Caching.Memory.IMemoryCache cache) { _db = db; _log = log; _cache = cache; }

    private CompanyScope? _scope;
    private async Task<CompanyScope> ScopeAsync() => _scope ??= await CompanyAccess.ForUserAsync(_db, User, _cache);
    private ObjectResult NotYourCompany() => StatusCode(403, new { message = "You are not assigned to that company." });

    private int UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
    private string UserName
    {
        get
        {
            var p = _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => new { u.Name, u.Surname }).FirstOrDefault();
            var full = ($"{p?.Name} {p?.Surname}").Trim();
            return full.Length > 0 ? full : (User.FindFirst(ClaimTypes.Name)?.Value ?? "");
        }
    }

    private static readonly string[] BucketLabels = { "Current", "1–30 days", "31–60 days", "61–90 days", "Over 90" };

    // ───────────────────────── snapshots ─────────────────────────

    /// <summary>All paying companies with their snapshots (newest first) so the picker can show "as at" and staleness.</summary>
    [HttpGet("snapshots")]
    public async Task<IActionResult> Snapshots()
    {
        var scope = await ScopeAsync();
        var companies = (await _db.CreditorCompanies.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new { c.Code, c.Name }).ToListAsync()).Where(c => scope.Allows(c.Code)).ToList();
        var snaps = (await _db.ApAgingSnapshots.AsNoTracking().OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id)
            .Select(s => new { s.Id, s.CompanyCode, s.ReportCompany, s.AsOfDate, s.SourceFileName, s.UploadedAt, s.UploadedByName, s.VendorCount, s.ActiveVendorCount, s.TotalCurrent, s.TotalOverdue, s.TotalPayables, s.Notes, s.HasDetail, s.DocumentCount })
            .ToListAsync()).Where(s => scope.Allows(s.CompanyCode)).ToList();
        return Ok(new { companies, snapshots = snaps });
    }

    [HttpDelete("snapshots/{id:int}")]
    [Authorize(Roles = "Super Admin,Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var s = await _db.ApAgingSnapshots.FindAsync(id); if (s == null) return NotFound();
        if (!(await ScopeAsync()).Allows(s.CompanyCode)) return NotYourCompany();
        _db.ApAgingSnapshots.Remove(s);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>The aging for one snapshot: bucket totals and one row per vendor (zero rows included — ?activeOnly=true hides them).</summary>
    [HttpGet("snapshots/{id:int}")]
    public async Task<IActionResult> Aging(int id, [FromQuery] string? search, [FromQuery] bool activeOnly = true)
    {
        var snap = await _db.ApAgingSnapshots.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (snap == null) return NotFound();
        if (!(await ScopeAsync()).Allows(snap.CompanyCode)) return NotYourCompany();
        var q = _db.ApAgingVendors.AsNoTracking().Where(v => v.SnapshotId == id);
        if (activeOnly) q = q.Where(v => v.Total != 0 || v.Overdue != 0 || v.Current != 0);
        if (!string.IsNullOrWhiteSpace(search)) { var s = search.Trim(); q = q.Where(v => v.VendorName.Contains(s) || v.VendorCode.Contains(s)); }
        var vendors = await q.OrderByDescending(v => v.Total).ThenBy(v => v.VendorName)
            .Select(v => new { v.Id, code = v.VendorCode, name = v.VendorName, v.Currency, v.Current, d30 = v.Days30, d60 = v.Days60, d90 = v.Days90, v.Over90, v.Overdue, v.Total,
                oldestBucket = v.Over90 > 0 ? 4 : v.Days90 > 0 ? 3 : v.Days60 > 0 ? 2 : v.Days30 > 0 ? 1 : 0 })
            .ToListAsync();

        // Payment packs in flight for these vendors (so finance can see what is already being paid).
        var names = vendors.Select(v => Key(v.name)).ToHashSet();
        var inFlight = (await _db.PaymentBatchItems.AsNoTracking()
            .Where(i => i.Batch!.CompanyCode == snap.CompanyCode && i.DecisionStatus != "Rejected" && i.Batch.Status != CreditorWorkflow.Paid && i.Batch.Status != CreditorWorkflow.Closed && i.Batch.Status != CreditorWorkflow.Rejected)
            .Select(i => new { i.SupplierName, i.Amount, i.Batch!.BatchNumber, i.Batch.Status, i.BatchId }).ToListAsync())
            .Where(i => names.Contains(Key(i.SupplierName)))
            .GroupBy(i => Key(i.SupplierName))
            .ToDictionary(g => g.Key, g => new { amount = g.Sum(x => x.Amount), batches = g.Select(x => new { x.BatchId, x.BatchNumber, x.Status }).Distinct().ToList() });

        var t = new decimal[5];
        foreach (var v in vendors) { t[0] += v.Current; t[1] += v.d30; t[2] += v.d60; t[3] += v.d90; t[4] += v.Over90; }
        var grand = t.Sum();
        var docCounts = snap.HasDetail
            ? await _db.ApAgingDocuments.AsNoTracking().Where(d => d.SnapshotId == id).GroupBy(d => d.VendorCode).Select(g => new { g.Key, n = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.n)
            : new Dictionary<string, int>();
        return Ok(new
        {
            snapshot = new { snap.Id, snap.CompanyCode, snap.ReportCompany, snap.AsOfDate, snap.SourceFileName, snap.UploadedAt, snap.UploadedByName, snap.VendorCount, snap.ActiveVendorCount, snap.TotalCurrent, snap.TotalOverdue, snap.TotalPayables, snap.Notes, snap.HasDetail, snap.DocumentCount },
            buckets = BucketLabels.Select((l, i) => new { index = i, label = l, amount = t[i], pct = grand == 0 ? 0 : Math.Round(t[i] / grand * 100, 1) }),
            total = grand,
            overdue = vendors.Sum(v => v.Overdue),
            vendors = vendors.Select(v => new
            {
                v.Id, v.code, v.name, v.Currency, v.Current, v.d30, v.d60, v.d90, v.Over90, v.Overdue, v.Total, v.oldestBucket,
                inPacks = inFlight.TryGetValue(Key(v.name), out var f) ? f.amount : 0m,
                packs = inFlight.TryGetValue(Key(v.name), out var f2) ? f2.batches : null,
                docCount = docCounts.TryGetValue(v.code, out var dc) ? dc : 0
            })
        });
    }

    /// <summary>
    /// The open documents behind one vendor's balance (Detail uploads only): invoices, credit notes,
    /// prepayments… oldest first. Also flags documents already sitting in a payment pack for that company.
    /// </summary>
    [HttpGet("snapshots/{id:int}/vendors/{code}/documents")]
    public async Task<IActionResult> VendorDocuments(int id, string code)
    {
        var snap = await _db.ApAgingSnapshots.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (snap == null) return NotFound();
        if (!(await ScopeAsync()).Allows(snap.CompanyCode)) return NotYourCompany();
        var docs = await _db.ApAgingDocuments.AsNoTracking().Where(d => d.SnapshotId == id && d.VendorCode == code)
            .OrderBy(d => d.DueDate ?? d.DocDate).ThenBy(d => d.DocDate).ThenBy(d => d.Id)
            .Select(d => new { d.Id, d.DocType, d.DocNumber, d.DocDate, d.DueDate, d.Current, d30 = d.Days30, d60 = d.Days60, d90 = d.Days90, d.Over90, d.Overdue, d.Total, d.Bucket })
            .ToListAsync();
        var numbers = docs.Select(d => d.DocNumber.ToUpperInvariant()).ToHashSet();
        var inPacks = (await _db.PaymentBatchItems.AsNoTracking()
            .Where(i => i.Batch!.CompanyCode == snap.CompanyCode && i.DecisionStatus != "Rejected" && i.Batch.Status != CreditorWorkflow.Rejected && i.InvoiceNumbers != null && i.InvoiceNumbers != "")
            .Select(i => new { i.InvoiceNumbers, i.Batch!.BatchNumber, i.Batch.Status, i.BatchId }).ToListAsync())
            .SelectMany(i => Regex.Split(i.InvoiceNumbers!, @"[,;/\s]+").Select(n => n.Trim().ToUpperInvariant()).Where(n => n.Length > 0).Select(n => new { n, i.BatchNumber, i.Status, i.BatchId }))
            .Where(x => numbers.Contains(x.n))
            .GroupBy(x => x.n)
            .ToDictionary(g => g.Key, g => g.Select(x => new { x.BatchId, x.BatchNumber, x.Status }).Distinct().ToList());
        var asOf = snap.AsOfDate;
        return Ok(new
        {
            snapshot = new { snap.Id, snap.CompanyCode, snap.AsOfDate, snap.HasDetail },
            documents = docs.Select(d => new
            {
                d.Id, d.DocType, typeLabel = DocTypeLabel(d.DocType), d.DocNumber, d.DocDate, d.DueDate, d.Current, d.d30, d.d60, d.d90, d.Over90, d.Overdue, d.Total, d.Bucket,
                daysOverdue = d.DueDate.HasValue && d.DueDate.Value < asOf ? (int)(asOf - d.DueDate.Value).TotalDays : 0,
                packs = inPacks.TryGetValue(d.DocNumber.ToUpperInvariant(), out var p) ? p : null
            }),
            totals = new { current = docs.Sum(d => d.Current), d30 = docs.Sum(d => d.d30), d60 = docs.Sum(d => d.d60), d90 = docs.Sum(d => d.d90), over90 = docs.Sum(d => d.Over90), overdue = docs.Sum(d => d.Overdue), total = docs.Sum(d => d.Total) }
        });
    }

    /// <summary>All documents in a snapshot (Detail uploads), filterable by bucket / type / search. Used for the "all open invoices" view and export.</summary>
    [HttpGet("snapshots/{id:int}/documents")]
    public async Task<IActionResult> Documents(int id, [FromQuery] int? bucket, [FromQuery] string? type, [FromQuery] string? search, [FromQuery] int take = 2000)
    {
        var snap = await _db.ApAgingSnapshots.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (snap == null) return NotFound();
        if (!(await ScopeAsync()).Allows(snap.CompanyCode)) return NotYourCompany();
        var q = _db.ApAgingDocuments.AsNoTracking().Where(d => d.SnapshotId == id);
        if (bucket is >= 0 and <= 4) q = q.Where(d => d.Bucket == bucket);
        if (!string.IsNullOrWhiteSpace(type)) { var ty = type.Trim().ToUpperInvariant(); q = q.Where(d => d.DocType == ty); }
        if (!string.IsNullOrWhiteSpace(search)) { var s = search.Trim(); q = q.Where(d => d.DocNumber.Contains(s) || d.VendorName.Contains(s) || d.VendorCode.Contains(s)); }
        var docs = await q.OrderBy(d => d.DueDate ?? d.DocDate).ThenBy(d => d.VendorName).Take(Math.Clamp(take, 1, 10000))
            .Select(d => new { d.Id, d.VendorCode, d.VendorName, d.DocType, d.DocNumber, d.DocDate, d.DueDate, d.Current, d30 = d.Days30, d60 = d.Days60, d90 = d.Days90, d.Over90, d.Overdue, d.Total, d.Bucket })
            .ToListAsync();
        var asOf = snap.AsOfDate;
        return Ok(docs.Select(d => new { d.Id, d.VendorCode, d.VendorName, d.DocType, typeLabel = DocTypeLabel(d.DocType), d.DocNumber, d.DocDate, d.DueDate, d.Current, d.d30, d.d60, d.d90, d.Over90, d.Overdue, d.Total, d.Bucket,
            daysOverdue = d.DueDate.HasValue && d.DueDate.Value < asOf ? (int)(asOf - d.DueDate.Value).TotalDays : 0 }));
    }

    private static string DocTypeLabel(string t) => t.ToUpperInvariant() switch
    {
        "IN" => "Invoice", "CR" => "Credit note", "DB" => "Debit note", "PI" => "Prepayment", "AD" => "Adjustment", "IT" => "Interest",
        "PY" => "Payment", "MC" => "Misc. payment", "ED" => "Discount taken", "GL" => "FX gain/loss", "RD" => "Rounding",
        "CF" => "Applied credit (from)", "CT" => "Applied credit (to)", "DF" => "Applied debit (from)", "DT" => "Applied debit (to)", _ => t
    };

    /// <summary>One vendor across every snapshot of its company — how the balance moved.</summary>
    [HttpGet("vendors/{company}/{code}/history")]
    public async Task<IActionResult> History(string company, string code) =>
        !(await ScopeAsync()).Allows(company) ? NotYourCompany() :
        Ok(await _db.ApAgingVendors.AsNoTracking().Where(v => v.VendorCode == code && v.Snapshot!.CompanyCode == company)
            .OrderByDescending(v => v.Snapshot!.AsOfDate)
            .Select(v => new { v.Snapshot!.AsOfDate, v.Snapshot.Id, v.Current, d30 = v.Days30, d60 = v.Days60, d90 = v.Days90, v.Over90, v.Overdue, v.Total }).Take(24).ToListAsync());

    /// <summary>
    /// Vendors from the latest aging of a company, for the payment-pack supplier picker.
    /// Non-zero balances first, then alphabetical. ?q= filters by name or code.
    /// </summary>
    [HttpGet("vendors")]
    public async Task<IActionResult> Vendors([FromQuery] string company, [FromQuery] string? q, [FromQuery] int take = 20)
    {
        if (!(await ScopeAsync()).Allows(company)) return NotYourCompany();
        var snapId = await _db.ApAgingSnapshots.AsNoTracking().Where(s => s.CompanyCode == company).OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id).Select(s => (int?)s.Id).FirstOrDefaultAsync();
        if (snapId == null) return Ok(Array.Empty<object>());
        var s = (q ?? "").Trim();
        var list = await _db.ApAgingVendors.AsNoTracking().Where(v => v.SnapshotId == snapId && (s == "" || v.VendorName.Contains(s) || v.VendorCode.Contains(s)))
            .OrderByDescending(v => v.Total != 0).ThenByDescending(v => v.Total).ThenBy(v => v.VendorName).Take(Math.Clamp(take, 1, 100))
            .Select(v => new { code = v.VendorCode, name = v.VendorName, v.Current, v.Overdue, v.Total }).ToListAsync();
        return Ok(list);
    }

    // ───────────────────────── import ─────────────────────────

    /// <summary>
    /// Upload the APAPAYSY summary (.xls / .xlsx). Company is detected from the report header when not supplied.
    /// Replaces an existing snapshot for the same company + as-at date.
    /// </summary>
    [HttpPost("import")]
    [Authorize(Roles = "Super Admin,Admin")]
    [RequestSizeLimit(60_000_000)]
    public async Task<IActionResult> Import([FromForm] IFormFile file, [FromForm] string? company, [FromForm] string? notes, [FromForm] bool replace = true)
    {
        if (file == null || file.Length == 0) return BadRequest(new { message = "Choose the aged payables report exported from Sage (.xls or .xlsx)." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".xls" or ".xlsx")) return BadRequest(new { message = "Only .xls / .xlsx workbooks are supported." });

        ParsedAging parsed;
        try
        {
            using var ms = new MemoryStream(); await file.CopyToAsync(ms); ms.Position = 0;
            parsed = Parse(ms);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "AP aging import failed to parse {File}", file.FileName);
            return BadRequest(new { message = "Couldn't read this file as a Sage aged payables report: " + ex.Message });
        }
        if (parsed.Vendors.Count == 0) return BadRequest(new { message = "No vendor rows were found. Upload the Sage 'A/P Aged Payables by Due Date' report — either the Summary (one row per vendor) or Detail by Document Date (one row per invoice)." });

        var companies = await _db.CreditorCompanies.AsNoTracking().ToListAsync();
        var code = (company ?? "").Trim().ToUpperInvariant();
        if (code == "") code = DetectCompany(parsed.ReportCompany, companies) ?? "";
        if (code == "" || companies.All(c => c.Code != code))
            return BadRequest(new { message = $"Couldn't tell which company this report is for (header says \"{parsed.ReportCompany}\"). Pick the company and upload again.", reportCompany = parsed.ReportCompany });
        if (!(await ScopeAsync()).Allows(code)) return NotYourCompany();

        var asOf = parsed.AsOf ?? DateTime.UtcNow.Date;
        if (replace)
        {
            var dup = await _db.ApAgingSnapshots.Where(s => s.CompanyCode == code && s.AsOfDate == asOf).ToListAsync();
            // A Summary upload must never wipe out a Detail snapshot for the same day — detail is the richer set.
            if (!parsed.IsDetail && dup.Any(d => d.HasDetail))
                return Conflict(new { message = $"A detailed aging for {code} as at {asOf:dd MMM yyyy} is already loaded. Upload the Detail report to replace it, or delete that snapshot first." });
            if (dup.Count > 0) _db.ApAgingSnapshots.RemoveRange(dup);
        }

        var snap = new ApAgingSnapshot
        {
            CompanyCode = code, ReportCompany = Trunc(parsed.ReportCompany, 120), AsOfDate = asOf, SourceFileName = Trunc(file.FileName, 255),
            UploadedByUserId = UserId, UploadedByName = UserName, UploadedAt = DateTime.UtcNow,
            VendorCount = parsed.Vendors.Count, ActiveVendorCount = parsed.Vendors.Count(v => v.Total != 0 || v.Overdue != 0 || v.Current != 0),
            TotalCurrent = parsed.Vendors.Sum(v => v.Current), TotalOverdue = parsed.Vendors.Sum(v => v.Overdue), TotalPayables = parsed.Vendors.Sum(v => v.Total),
            Notes = Trunc(notes, 500), Vendors = parsed.Vendors,
            HasDetail = parsed.IsDetail, DocumentCount = parsed.Documents.Count, Documents = parsed.Documents
        };
        _db.ApAgingSnapshots.Add(snap);
        await _db.SaveChangesAsync();
        _log.LogInformation("AP aging snapshot {Id} for {Co} as at {AsOf}: {N} vendors, {D} documents, R{Total}", snap.Id, code, asOf, snap.VendorCount, snap.DocumentCount, snap.TotalPayables);
        return Ok(new { snap.Id, snap.CompanyCode, snap.ReportCompany, snap.AsOfDate, snap.VendorCount, snap.ActiveVendorCount, snap.TotalPayables, snap.TotalOverdue, snap.HasDetail, snap.DocumentCount });
    }

    internal sealed class ParsedAging { public string? ReportCompany; public DateTime? AsOf; public bool IsDetail; public List<ApAgingVendor> Vendors = new(); public List<ApAgingDocument> Documents = new(); }

    /// <summary>
    /// APAPAYSY layout: company name on row 1, "Age Transactions As Of [dd/MM/yyyy]" near the top, then a header row with
    /// "Vendor No." … "Vendor Name" … (optional "Cur.") "Current" | "Days" ×4 | "Overdue" | "Payables". Vendor rows follow until
    /// "Report Total:". Column positions are taken from the header row, so wider/narrower exports still read.
    /// </summary>
    internal static ParsedAging Parse(Stream file)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var rows = new List<object?[]>();
        using (var reader = ExcelReaderFactory.CreateReader(file))
        {
            do
            {
                while (reader.Read())
                {
                    var r = new object?[reader.FieldCount];
                    for (var i = 0; i < reader.FieldCount; i++) r[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    rows.Add(r);
                }
                if (rows.Count > 0) break; // first sheet with content
            } while (reader.NextResult());
        }

        var p = new ParsedAging();
        // Row 1: a date serial in A and the company name somewhere on the row.
        if (rows.Count > 0) p.ReportCompany = rows[0].Skip(1).Select(S).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s) && !s.StartsWith("Page", StringComparison.OrdinalIgnoreCase))?.Trim();
        foreach (var r in rows.Take(20))
        {
            var a = S(r.ElementAtOrDefault(0));
            if (a != null && a.StartsWith("Age Transactions As Of", StringComparison.OrdinalIgnoreCase))
            {
                var txt = string.Join(" ", r.Skip(1).Select(S).Where(x => x != null));
                var m = Regex.Match(txt, @"(\d{1,2})/(\d{1,2})/(\d{4})");
                if (m.Success) p.AsOf = new DateTime(int.Parse(m.Groups[3].Value), int.Parse(m.Groups[2].Value), int.Parse(m.Groups[1].Value));
            }
        }

        // Detail by Document Date? Header has "Doc. Date" / "Doc. Type/Doc. Number" and vendors appear as "Vendor No.:" label rows.
        if (rows.Any(r => r.Any(c => (S(c) ?? "").Trim().StartsWith("Doc. Type", StringComparison.OrdinalIgnoreCase))))
        {
            ParseDetail(rows, p);
            return p;
        }

        // Header row → column indexes
        int hdr = -1, cNo = -1, cName = -1, cCur = -1, cCurrent = -1, cOverdue = -1, cTotal = -1; var cDays = new List<int>();
        for (var i = 0; i < rows.Count && hdr < 0; i++)
        {
            var r = rows[i];
            for (var c = 0; c < r.Length; c++)
            {
                var s = S(r[c])?.Trim(); if (s == null) continue;
                if (s.StartsWith("Vendor No", StringComparison.OrdinalIgnoreCase)) cNo = c;
                else if (s.StartsWith("Vendor Name", StringComparison.OrdinalIgnoreCase)) cName = c;
                else if (s.Equals("Cur.", StringComparison.OrdinalIgnoreCase)) cCur = c;
                else if (s.Equals("Current", StringComparison.OrdinalIgnoreCase)) cCurrent = c;
                else if (s.Equals("Days", StringComparison.OrdinalIgnoreCase)) cDays.Add(c);
                else if (s.Equals("Overdue", StringComparison.OrdinalIgnoreCase)) cOverdue = c;
                else if (s.Equals("Payables", StringComparison.OrdinalIgnoreCase)) cTotal = c;
            }
            if (cNo >= 0 && cName >= 0 && cCurrent >= 0 && cTotal >= 0) hdr = i; else { cNo = cName = cCur = cCurrent = cOverdue = cTotal = -1; cDays.Clear(); }
        }
        if (hdr < 0) throw new InvalidOperationException("header row with Vendor No. / Vendor Name / Current / Payables not found");
        while (cDays.Count < 4) cDays.Add(-1);

        for (var i = hdr + 1; i < rows.Count; i++)
        {
            var r = rows[i];
            var name = S(r.ElementAtOrDefault(cName))?.Trim();
            var no = S(r.ElementAtOrDefault(cNo))?.Trim();
            if (name != null && name.StartsWith("Report Total", StringComparison.OrdinalIgnoreCase)) break;
            if (string.IsNullOrEmpty(no) || string.IsNullOrEmpty(name)) continue;
            if (no.Contains("vendors printed", StringComparison.OrdinalIgnoreCase)) break;
            p.Vendors.Add(new ApAgingVendor
            {
                VendorCode = Trunc(no, 50)!, VendorName = Trunc(name, 255)!, Currency = Trunc(cCur >= 0 ? S(r.ElementAtOrDefault(cCur)) : null, 5),
                Current = M(r.ElementAtOrDefault(cCurrent)), Days30 = M(r.ElementAtOrDefault(cDays[0])), Days60 = M(r.ElementAtOrDefault(cDays[1])),
                Days90 = M(r.ElementAtOrDefault(cDays[2])), Over90 = M(r.ElementAtOrDefault(cDays[3])),
                Overdue = cOverdue >= 0 ? M(r.ElementAtOrDefault(cOverdue)) : 0, Total = M(r.ElementAtOrDefault(cTotal))
            });
        }
        foreach (var v in p.Vendors) { if (v.Overdue == 0 && cOverdue < 0) v.Overdue = v.Days30 + v.Days60 + v.Days90 + v.Over90; }
        return p;
    }

    private static string? S(object? o) => o switch { null => null, string s => s, double d => d.ToString(CultureInfo.InvariantCulture), DateTime dt => dt.ToString("dd/MM/yyyy"), _ => o.ToString() };

    /// <summary>
    /// APAPAYSY — Detail by Document Date. Two header rows: row A has "Doc. Date" | "Doc. Type/Doc. Number" | "Due Date" |
    /// "1 to 30" | "31 to 60" | "61 to 90" | "Over 90" | "Total" | "Total"; row B beneath has "Current" | "Days"×4 | "Overdue" | "Payables".
    /// Then per vendor: a "Vendor No.:" row (code a few cells right, "Vendor Name:" label then the name), document rows
    /// (date serial | type | number | due date | amount in exactly one bucket | overdue | total), and a "Vendor Total:" row.
    /// Ends at "Report Total:". The vendor summary rows are rebuilt from the documents so the rest of the app works unchanged.
    /// </summary>
    private static void ParseDetail(List<object?[]> rows, ParsedAging p)
    {
        p.IsDetail = true;
        int cDate = -1, cType = -1, cDue = -1, cCurrent = -1, cOverdue = -1, cTotal = -1, hdrB = -1; var cDays = new List<int>();
        for (var i = 0; i < rows.Count && hdrB < 0; i++)
        {
            var r = rows[i];
            for (var c = 0; c < r.Length; c++)
            {
                var s = S(r[c])?.Trim(); if (s == null) continue;
                if (s.StartsWith("Doc. Date", StringComparison.OrdinalIgnoreCase)) cDate = c;
                else if (s.StartsWith("Doc. Type", StringComparison.OrdinalIgnoreCase)) cType = c;
                else if (s.StartsWith("Due Date", StringComparison.OrdinalIgnoreCase)) cDue = c;
            }
            if (cDate < 0 || cType < 0) continue;
            // the next non-empty row carries Current / Days / Overdue / Payables
            for (var j = i + 1; j < Math.Min(rows.Count, i + 3); j++)
            {
                var r2 = rows[j];
                for (var c = 0; c < r2.Length; c++)
                {
                    var s = S(r2[c])?.Trim(); if (s == null) continue;
                    if (s.Equals("Current", StringComparison.OrdinalIgnoreCase)) cCurrent = c;
                    else if (s.Equals("Days", StringComparison.OrdinalIgnoreCase)) cDays.Add(c);
                    else if (s.Equals("Overdue", StringComparison.OrdinalIgnoreCase)) cOverdue = c;
                    else if (s.Equals("Payables", StringComparison.OrdinalIgnoreCase)) cTotal = c;
                }
                if (cCurrent >= 0 && cTotal >= 0) { hdrB = j; break; }
            }
        }
        if (hdrB < 0) throw new InvalidOperationException("detail header (Doc. Date / Current / Payables) not found");
        while (cDays.Count < 4) cDays.Add(-1);

        string? vCode = null, vName = null;
        var byVendor = new Dictionary<string, ApAgingVendor>(StringComparer.OrdinalIgnoreCase);
        for (var i = hdrB + 1; i < rows.Count; i++)
        {
            var r = rows[i];
            var cells = r.Select(S).ToArray();
            var joined = string.Join(" ", cells.Where(x => !string.IsNullOrWhiteSpace(x)));
            if (joined.StartsWith("Report Total", StringComparison.OrdinalIgnoreCase) || joined.Contains("vendors printed", StringComparison.OrdinalIgnoreCase)) break;

            var a0 = cells.ElementAtOrDefault(0)?.Trim();
            if (a0 != null && a0.StartsWith("Vendor No", StringComparison.OrdinalIgnoreCase))
            {
                // code = first non-empty cell after the label; name = first non-empty cell after "Vendor Name:"
                vCode = null; vName = null; var seenNameLbl = false;
                for (var c = 1; c < cells.Length; c++)
                {
                    var s = cells[c]?.Trim(); if (string.IsNullOrEmpty(s)) continue;
                    if (s.StartsWith("Vendor Name", StringComparison.OrdinalIgnoreCase)) { seenNameLbl = true; continue; }
                    if (!seenNameLbl && vCode == null) vCode = s;
                    else if (seenNameLbl && vName == null) { vName = s; break; }
                }
                if (vCode != null && !byVendor.ContainsKey(vCode))
                    byVendor[vCode] = new ApAgingVendor { VendorCode = Trunc(vCode, 50)!, VendorName = Trunc(vName ?? vCode, 255)! };
                continue;
            }
            if (vCode == null) continue;
            if (joined.Contains("Vendor Total", StringComparison.OrdinalIgnoreCase))
            {
                // Sage prints the currency just before the figures ("ZAR"); keep it on the vendor.
                var cur = cells.Skip(cType + 1).Select(x => x?.Trim()).FirstOrDefault(x => x != null && x.Length == 3 && x.All(char.IsLetter));
                if (cur != null && byVendor.TryGetValue(vCode, out var vv)) vv.Currency = cur;
                continue;
            }

            // Document row: a date in the Doc. Date column and a type code in the type column.
            var docDate = D(r.ElementAtOrDefault(cDate));
            var type = cells.ElementAtOrDefault(cType)?.Trim();
            if (docDate == null || string.IsNullOrEmpty(type) || type.Length > 3) continue; // applied-detail / blank rows
            var number = cells.Skip(cType + 1).Take(Math.Max(1, (cDue > 0 ? cDue : cType + 6) - cType - 1)).Select(x => x?.Trim()).FirstOrDefault(x => !string.IsNullOrEmpty(x)) ?? "";
            var doc = new ApAgingDocument
            {
                VendorCode = Trunc(vCode, 50)!, VendorName = Trunc(vName ?? vCode, 255)!,
                DocDate = docDate, DocType = Trunc(type.ToUpperInvariant(), 5)!, DocNumber = Trunc(number, 60) ?? "", DueDate = cDue >= 0 ? D(r.ElementAtOrDefault(cDue)) : null,
                Current = M(r.ElementAtOrDefault(cCurrent)), Days30 = M(r.ElementAtOrDefault(cDays[0])), Days60 = M(r.ElementAtOrDefault(cDays[1])),
                Days90 = M(r.ElementAtOrDefault(cDays[2])), Over90 = M(r.ElementAtOrDefault(cDays[3])),
                Overdue = cOverdue >= 0 ? M(r.ElementAtOrDefault(cOverdue)) : 0, Total = M(r.ElementAtOrDefault(cTotal))
            };
            if (doc.DocNumber == "") doc.DocNumber = $"{doc.DocType}-{docDate:yyyyMMdd}";
            if (doc.Total == 0 && doc.Current == 0 && doc.Days30 == 0 && doc.Days60 == 0 && doc.Days90 == 0 && doc.Over90 == 0) continue; // e.g. AD rows with no balance
            if (cOverdue < 0) doc.Overdue = doc.Days30 + doc.Days60 + doc.Days90 + doc.Over90;
            doc.Bucket = doc.Over90 != 0 ? 4 : doc.Days90 != 0 ? 3 : doc.Days60 != 0 ? 2 : doc.Days30 != 0 ? 1 : 0;
            p.Documents.Add(doc);

            var v = byVendor[vCode];
            v.Current += doc.Current; v.Days30 += doc.Days30; v.Days60 += doc.Days60; v.Days90 += doc.Days90; v.Over90 += doc.Over90; v.Overdue += doc.Overdue; v.Total += doc.Total;
        }
        p.Vendors = byVendor.Values.ToList();
    }

    private static DateTime? D(object? o)
    {
        switch (o)
        {
            case null: return null;
            case DateTime dt: return dt.Date;
            case double d when d > 20000 && d < 80000: return DateTime.FromOADate(d).Date;
            default:
                var s = o.ToString()?.Trim();
                if (string.IsNullOrEmpty(s)) return null;
                if (DateTime.TryParseExact(s, new[] { "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd" }, CultureInfo.InvariantCulture, DateTimeStyles.None, out var r)) return r.Date;
                if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var n) && n > 20000 && n < 80000) return DateTime.FromOADate(n).Date;
                return null;
        }
    }
    private static decimal M(object? o)
    {
        if (o == null) return 0m;
        if (o is double d) return Math.Round((decimal)d, 2);
        if (o is decimal m) return Math.Round(m, 2);
        var s = (o.ToString() ?? "").Replace(",", "").Replace(" ", "").Trim();
        if (s.StartsWith("(") && s.EndsWith(")")) s = "-" + s[1..^1];
        return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? Math.Round(v, 2) : 0m;
    }
    private static string? Trunc(string? s, int n) { s = s?.Trim(); return string.IsNullOrEmpty(s) ? null : (s.Length > n ? s[..n] : s); }
    internal static string Key(string n) => Regex.Replace(n.ToUpperInvariant(), @"\b(PTY|LTD|CC|T/A|THE)\b|[^A-Z0-9]", "");

    /// <summary>Map the report header ("Promed Pharmatech", "Access", "KOG Trading Enterprise (PTY) LTD"…) to a company code.</summary>
    private static string? DetectCompany(string? report, List<CreditorCompany> companies)
    {
        if (string.IsNullOrWhiteSpace(report)) return null;
        var r = report.ToUpperInvariant();
        if (r.Contains("PHARMATECH") || r.Contains("PHARMACARE")) return "PHC";
        if (r.Contains("PROMED")) return "PMT";
        if (r.Contains("ACCESS")) return "ACM";
        if (r.Contains("KOG")) return "KOG";
        if (r.Contains("SEBENZANI")) return "SBT";
        if (r.Contains("ROCKET")) return "RFT";
        if (r.Contains("WELLNESS")) return "SAW";
        if (r.Contains("SHARP")) return "SEY";
        if (r.Contains("SHAKA")) return "SHK";
        if (r.Contains("NEW AGE")) return "NAT";
        return companies.FirstOrDefault(c => r.Contains(c.Name.ToUpperInvariant()) || r.Contains(c.Code))?.Code;
    }

    // ───────────────────────── export ─────────────────────────

    [HttpGet("snapshots/{id:int}/export")]
    public async Task<IActionResult> Export(int id, [FromQuery] bool activeOnly = true)
    {
        var snap = await _db.ApAgingSnapshots.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id); if (snap == null) return NotFound();
        if (!(await ScopeAsync()).Allows(snap.CompanyCode)) return NotYourCompany();
        var co = await _db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(c => c.Code == snap.CompanyCode);
        var q = _db.ApAgingVendors.AsNoTracking().Where(v => v.SnapshotId == id);
        if (activeOnly) q = q.Where(v => v.Total != 0 || v.Overdue != 0 || v.Current != 0);
        var vendors = await q.OrderByDescending(v => v.Total).ThenBy(v => v.VendorName).ToListAsync();

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Creditors aging");
        ws.Cell(1, 1).Value = $"{co?.Name ?? snap.CompanyCode} — Creditors age analysis"; ws.Cell(1, 1).Style.Font.Bold = true; ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Cell(2, 1).Value = $"As at {snap.AsOfDate:dd MMM yyyy} · source {snap.SourceFileName} · uploaded {snap.UploadedAt:dd MMM yyyy HH:mm}"; ws.Cell(2, 1).Style.Font.Italic = true;
        string[] cols = { "Vendor No.", "Vendor Name", "Cur.", "Current", "1–30 days", "31–60 days", "61–90 days", "Over 90", "Total overdue", "Total payables" };
        for (var c = 0; c < cols.Length; c++) ws.Cell(4, c + 1).Value = cols[c];
        var h = ws.Range(4, 1, 4, cols.Length); h.Style.Font.Bold = true; h.Style.Fill.BackgroundColor = XLColor.FromHtml("#E8EEF7"); h.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        var r = 4;
        foreach (var v in vendors)
        {
            r++;
            ws.Cell(r, 1).Value = v.VendorCode; ws.Cell(r, 2).Value = v.VendorName; ws.Cell(r, 3).Value = v.Currency ?? "";
            ws.Cell(r, 4).Value = v.Current; ws.Cell(r, 5).Value = v.Days30; ws.Cell(r, 6).Value = v.Days60; ws.Cell(r, 7).Value = v.Days90; ws.Cell(r, 8).Value = v.Over90; ws.Cell(r, 9).Value = v.Overdue; ws.Cell(r, 10).Value = v.Total;
        }
        r++;
        ws.Cell(r, 2).Value = "Report total"; ws.Cell(r, 2).Style.Font.Bold = true;
        for (var c = 4; c <= 10; c++) { ws.Cell(r, c).FormulaA1 = $"SUM({(char)('A' + c - 1)}5:{(char)('A' + c - 1)}{r - 1})"; ws.Cell(r, c).Style.Font.Bold = true; }
        ws.Range(r, 1, r, cols.Length).Style.Border.TopBorder = XLBorderStyleValues.Double;
        ws.Range(5, 4, r, 10).Style.NumberFormat.Format = "#,##0.00;[Red]-#,##0.00";
        ws.Columns().AdjustToContents(); ws.Column(2).Width = Math.Min(Math.Max(ws.Column(2).Width, 30), 50); ws.SheetView.FreezeRows(4);

        if (snap.HasDetail)
        {
            var docs = await _db.ApAgingDocuments.AsNoTracking().Where(d => d.SnapshotId == id)
                .OrderBy(d => d.VendorName).ThenBy(d => d.DueDate ?? d.DocDate).ToListAsync();
            var wd = wb.Worksheets.Add("Open documents");
            wd.Cell(1, 1).Value = $"{co?.Name ?? snap.CompanyCode} — open documents as at {snap.AsOfDate:dd MMM yyyy}"; wd.Cell(1, 1).Style.Font.Bold = true; wd.Cell(1, 1).Style.Font.FontSize = 14;
            string[] dcols = { "Vendor No.", "Vendor Name", "Type", "Document", "Doc date", "Due date", "Days overdue", "Current", "1–30 days", "31–60 days", "61–90 days", "Over 90", "Total overdue", "Total" };
            for (var c = 0; c < dcols.Length; c++) wd.Cell(3, c + 1).Value = dcols[c];
            var dh = wd.Range(3, 1, 3, dcols.Length); dh.Style.Font.Bold = true; dh.Style.Fill.BackgroundColor = XLColor.FromHtml("#E8EEF7"); dh.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
            var rr = 3;
            foreach (var d in docs)
            {
                rr++;
                wd.Cell(rr, 1).Value = d.VendorCode; wd.Cell(rr, 2).Value = d.VendorName; wd.Cell(rr, 3).Value = DocTypeLabel(d.DocType); wd.Cell(rr, 4).Value = d.DocNumber;
                if (d.DocDate.HasValue) wd.Cell(rr, 5).Value = d.DocDate.Value; if (d.DueDate.HasValue) wd.Cell(rr, 6).Value = d.DueDate.Value;
                wd.Cell(rr, 7).Value = d.DueDate.HasValue && d.DueDate.Value < snap.AsOfDate ? (int)(snap.AsOfDate - d.DueDate.Value).TotalDays : 0;
                wd.Cell(rr, 8).Value = d.Current; wd.Cell(rr, 9).Value = d.Days30; wd.Cell(rr, 10).Value = d.Days60; wd.Cell(rr, 11).Value = d.Days90; wd.Cell(rr, 12).Value = d.Over90; wd.Cell(rr, 13).Value = d.Overdue; wd.Cell(rr, 14).Value = d.Total;
            }
            if (rr > 3)
            {
                wd.Range(4, 5, rr, 6).Style.DateFormat.Format = "dd MMM yyyy";
                wd.Range(4, 8, rr, 14).Style.NumberFormat.Format = "#,##0.00;[Red]-#,##0.00";
                wd.RangeUsed()!.SetAutoFilter();
            }
            wd.Columns().AdjustToContents(); wd.Column(2).Width = Math.Min(Math.Max(wd.Column(2).Width, 30), 50); wd.SheetView.FreezeRows(3);
        }
        using var ms = new MemoryStream(); wb.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Creditors-aging-{snap.CompanyCode}-{snap.AsOfDate:yyyyMMdd}.xlsx");
    }
}
