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
            .Select(s => new { s.Id, s.CompanyCode, s.ReportCompany, s.AsOfDate, s.SourceFileName, s.UploadedAt, s.UploadedByName, s.VendorCount, s.ActiveVendorCount, s.TotalCurrent, s.TotalOverdue, s.TotalPayables, s.Notes })
            .ToListAsync()).Where(s => scope.Allows(s.CompanyCode)).ToList();
        return Ok(new { companies, snapshots = snaps });
    }

    [HttpDelete("snapshots/{id:int}")]
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
        return Ok(new
        {
            snapshot = new { snap.Id, snap.CompanyCode, snap.ReportCompany, snap.AsOfDate, snap.SourceFileName, snap.UploadedAt, snap.UploadedByName, snap.VendorCount, snap.ActiveVendorCount, snap.TotalCurrent, snap.TotalOverdue, snap.TotalPayables, snap.Notes },
            buckets = BucketLabels.Select((l, i) => new { index = i, label = l, amount = t[i], pct = grand == 0 ? 0 : Math.Round(t[i] / grand * 100, 1) }),
            total = grand,
            overdue = vendors.Sum(v => v.Overdue),
            vendors = vendors.Select(v => new
            {
                v.Id, v.code, v.name, v.Currency, v.Current, v.d30, v.d60, v.d90, v.Over90, v.Overdue, v.Total, v.oldestBucket,
                inPacks = inFlight.TryGetValue(Key(v.name), out var f) ? f.amount : 0m,
                packs = inFlight.TryGetValue(Key(v.name), out var f2) ? f2.batches : null
            })
        });
    }

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
        if (parsed.Vendors.Count == 0) return BadRequest(new { message = "No vendor rows were found. The report needs the 'Vendor No. / Vendor Name / Current / Days / Total Overdue / Total Payables' columns (A/P Aged Payables by Due Date, Summary)." });

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
            if (dup.Count > 0) _db.ApAgingSnapshots.RemoveRange(dup);
        }

        var snap = new ApAgingSnapshot
        {
            CompanyCode = code, ReportCompany = Trunc(parsed.ReportCompany, 120), AsOfDate = asOf, SourceFileName = Trunc(file.FileName, 255),
            UploadedByUserId = UserId, UploadedByName = UserName, UploadedAt = DateTime.UtcNow,
            VendorCount = parsed.Vendors.Count, ActiveVendorCount = parsed.Vendors.Count(v => v.Total != 0 || v.Overdue != 0 || v.Current != 0),
            TotalCurrent = parsed.Vendors.Sum(v => v.Current), TotalOverdue = parsed.Vendors.Sum(v => v.Overdue), TotalPayables = parsed.Vendors.Sum(v => v.Total),
            Notes = Trunc(notes, 500), Vendors = parsed.Vendors
        };
        _db.ApAgingSnapshots.Add(snap);
        await _db.SaveChangesAsync();
        _log.LogInformation("AP aging snapshot {Id} for {Co} as at {AsOf}: {N} vendors, R{Total}", snap.Id, code, asOf, snap.VendorCount, snap.TotalPayables);
        return Ok(new { snap.Id, snap.CompanyCode, snap.ReportCompany, snap.AsOfDate, snap.VendorCount, snap.ActiveVendorCount, snap.TotalPayables, snap.TotalOverdue });
    }

    internal sealed class ParsedAging { public string? ReportCompany; public DateTime? AsOf; public List<ApAgingVendor> Vendors = new(); }

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
        using var ms = new MemoryStream(); wb.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Creditors-aging-{snap.CompanyCode}-{snap.AsOfDate:yyyyMMdd}.xlsx");
    }
}
