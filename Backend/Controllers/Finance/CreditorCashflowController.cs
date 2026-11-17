using System.Security.Claims;
using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance.Creditors;

namespace ProjectTracker.API.Controllers.Finance;

/// <summary>
/// Group cashflow for the paying companies, built like the treasurer's "CASHFLOW TEMPLATE.xlsx":
/// per company <c>Balance − Payments − Debit orders − Monthly payments = Closing balance</c>.
/// Balance is captured by the treasurer; Payments come from the open payment packs; debit orders
/// and monthly payments are standing lines kept here. Export reproduces the workbook (SUMMARY +
/// one sheet per company).
/// </summary>
[Authorize]
[ApiController]
[Route("api/finance/creditors/cashflow")]
[RequireModule("finance", AlsoAllowRoles = "Finance,Manager,Admin")]
public class CreditorCashflowController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public CreditorCashflowController(ApplicationDbContext db) { _db = db; }

    /// <summary>Batches counted as cash going out: anything committed that has not been paid, closed or rejected.</summary>
    private static readonly string[] OutflowStatuses =
    {
        CreditorWorkflow.Draft, CreditorWorkflow.ChecksFailed, CreditorWorkflow.AwaitingAccountant, CreditorWorkflow.QueriedByAccountant,
        CreditorWorkflow.AwaitingDirector, CreditorWorkflow.QueriedByDirector, CreditorWorkflow.Approved, CreditorWorkflow.LoadedOnBank
    };
    private static readonly string[] ApprovedStatuses = { CreditorWorkflow.Approved, CreditorWorkflow.LoadedOnBank };

    // ───────── identity ─────────
    private int UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
    private bool IsSystemAdmin => (User.FindFirst(ClaimTypes.Role)?.Value ?? "") is "Admin" or "Super Admin";
    private string UserName
    {
        get
        {
            var p = _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => new { u.Name, u.Surname }).FirstOrDefault();
            var full = ($"{p?.Name} {p?.Surname}").Trim();
            return full.Length > 0 ? full : (User.FindFirst(ClaimTypes.Name)?.Value ?? "");
        }
    }
    private async Task<bool> CanEditAsync()
    {
        if (IsSystemAdmin) return true;
        var raw = await _db.Users.AsNoTracking().Where(u => u.UserId == UserId).Select(u => u.Permissions).FirstOrDefaultAsync() ?? "";
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (raw.TrimStart().StartsWith("[")) { try { foreach (var s in JsonSerializer.Deserialize<string[]>(raw) ?? Array.Empty<string>()) set.Add(s); } catch { } }
        else foreach (var s in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) set.Add(s);
        return set.Contains("*") || set.Contains(CreditorWorkflow.RoleAdmin) || set.Contains(CreditorWorkflow.RoleClerk) || set.Contains(CreditorWorkflow.RoleAccountant) || set.Contains(CreditorWorkflow.RoleBank);
    }

    // ───────── model ─────────
    public record BatchRef(int Id, string BatchNumber, string Status, string PaymentType, DateTime BatchDate, decimal Amount, bool Approved);
    public record PaymentLine(int No, string Supplier, DateTime? InvoiceDate, string DocumentNumber, string? Description, DateTime PayableBy, decimal Amount, string BatchNumber, string Status);
    public record CompanyRow(string Code, string Name, decimal? Balance, DateTime? BalanceAsAt, string? BalanceNote,
        decimal Payments, decimal PaymentsApproved, int BatchCount, decimal DebitOrders, decimal Monthly, decimal Closing,
        List<BatchRef> Batches, List<PaymentLine> PaymentLines, List<CreditorCashflowLine> Lines);
    public record Totals(decimal Balance, decimal Payments, decimal PaymentsApproved, decimal DebitOrders, decimal Monthly, decimal Closing);
    public record Cashflow(DateTime AsAt, DateTime GeneratedAt, List<CompanyRow> Companies, Totals Totals, bool CanEdit);

    private async Task<Cashflow> BuildAsync(DateTime asAt)
    {
        var companies = await _db.CreditorCompanies.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync();
        var balances = await _db.CreditorCashflowBalances.AsNoTracking().Where(b => b.AsAt <= asAt).OrderByDescending(b => b.AsAt).ThenByDescending(b => b.Id).ToListAsync();
        var lines = await _db.CreditorCashflowLines.AsNoTracking().Where(l => l.IsActive).OrderBy(l => l.SortOrder).ThenBy(l => l.Payee).ToListAsync();
        var batches = await _db.PaymentBatches.AsNoTracking().Include(b => b.Items)
            .Where(b => OutflowStatuses.Contains(b.Status)).OrderBy(b => b.BatchDate).ThenBy(b => b.Id).ToListAsync();
        var invDocs = await _db.PaymentBatchDocuments.AsNoTracking()
            .Where(d => d.ItemId != null && d.DocType == CreditorDocTypes.TaxInvoice && !d.IsNotApplicable && d.DocumentDate != null)
            .GroupBy(d => d.ItemId!.Value).Select(g => new { ItemId = g.Key, Date = g.Max(x => x.DocumentDate) }).ToDictionaryAsync(x => x.ItemId, x => x.Date);

        var rows = new List<CompanyRow>();
        foreach (var c in companies)
        {
            var bal = balances.FirstOrDefault(b => b.CompanyCode == c.Code);
            var cb = batches.Where(b => b.CompanyCode == c.Code).ToList();
            var refs = cb.Select(b => new BatchRef(b.Id, b.BatchNumber, b.Status, b.PaymentType, b.BatchDate,
                b.Items.Where(i => i.DecisionStatus != "Rejected").Sum(i => i.Amount), ApprovedStatuses.Contains(b.Status))).ToList();
            var plines = new List<PaymentLine>(); var n = 0;
            foreach (var b in cb)
                foreach (var i in b.Items.Where(i => i.DecisionStatus != "Rejected").OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    plines.Add(new PaymentLine(++n, i.SupplierName, invDocs.TryGetValue(i.Id, out var d) ? d : null, i.InvoiceNumbers?.Trim() ?? "", i.Description, b.BatchDate, i.Amount, b.BatchNumber, b.Status));
            var cl = lines.Where(l => l.CompanyCode == c.Code).ToList();
            var pay = refs.Sum(r => r.Amount); var payOk = refs.Where(r => r.Approved).Sum(r => r.Amount);
            var dos = cl.Where(l => l.Section == CreditorCashflowSections.DebitOrder).Sum(l => l.Amount);
            var mon = cl.Where(l => l.Section == CreditorCashflowSections.Monthly).Sum(l => l.Amount);
            rows.Add(new CompanyRow(c.Code, c.Name, bal?.Balance, bal?.AsAt, bal?.Note, pay, payOk, refs.Count, dos, mon, (bal?.Balance ?? 0) - pay - dos - mon, refs, plines, cl));
        }
        var totals = new Totals(rows.Sum(r => r.Balance ?? 0), rows.Sum(r => r.Payments), rows.Sum(r => r.PaymentsApproved), rows.Sum(r => r.DebitOrders), rows.Sum(r => r.Monthly), rows.Sum(r => r.Closing));
        return new Cashflow(asAt, DateTime.UtcNow, rows, totals, await CanEditAsync());
    }

    private static DateTime ParseAsAt(string? asAt) => DateTime.TryParse(asAt, out var d) ? d.Date.AddDays(1).AddTicks(-1) : DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? asAt = null) => Ok(await BuildAsync(ParseAsAt(asAt)));

    // ───────── balances ─────────
    public class BalanceDto { public string CompanyCode { get; set; } = ""; public DateTime AsAt { get; set; } = DateTime.UtcNow.Date; public decimal Balance { get; set; } public string? Note { get; set; } }

    [HttpPut("balance")]
    public async Task<IActionResult> SetBalance([FromBody] BalanceDto dto)
    {
        if (!await CanEditAsync()) return Forbid();
        if (!await _db.CreditorCompanies.AnyAsync(c => c.Code == dto.CompanyCode)) return BadRequest(new { message = "Unknown company." });
        var day = dto.AsAt.Date;
        var existing = await _db.CreditorCashflowBalances.FirstOrDefaultAsync(b => b.CompanyCode == dto.CompanyCode && b.AsAt == day);
        if (existing == null) { existing = new CreditorCashflowBalance { CompanyCode = dto.CompanyCode, AsAt = day }; _db.CreditorCashflowBalances.Add(existing); }
        existing.Balance = dto.Balance; existing.Note = dto.Note?.Trim(); existing.UpdatedByUserId = UserId; existing.UpdatedByName = UserName; existing.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await BuildAsync(ParseAsAt(null)));
    }

    [HttpGet("balance/{code}/history")]
    public async Task<IActionResult> BalanceHistory(string code) =>
        Ok(await _db.CreditorCashflowBalances.AsNoTracking().Where(b => b.CompanyCode == code).OrderByDescending(b => b.AsAt).Take(60).ToListAsync());

    // ───────── standing lines ─────────
    public class LineDto
    {
        public string CompanyCode { get; set; } = ""; public string Section { get; set; } = CreditorCashflowSections.DebitOrder;
        public string Payee { get; set; } = ""; public string? Reference { get; set; } public string? Description { get; set; }
        public string? Frequency { get; set; } public int? DueDay { get; set; } public decimal Amount { get; set; } public bool IsActive { get; set; } = true;
    }

    private static string? Validate(LineDto d)
    {
        if (string.IsNullOrWhiteSpace(d.Payee)) return "Payee is required.";
        if (!CreditorCashflowSections.All.Contains(d.Section)) return "Section must be DebitOrder or Monthly.";
        if (d.Amount < 0) return "Amount cannot be negative.";
        if (d.DueDay is < 1 or > 31) return "Due day must be between 1 and 31.";
        return null;
    }

    private static void Apply(CreditorCashflowLine l, LineDto d, string who)
    {
        l.Section = d.Section; l.Payee = d.Payee.Trim(); l.Reference = d.Reference?.Trim(); l.Description = d.Description?.Trim();
        l.Frequency = d.Frequency?.Trim(); l.DueDay = d.DueDay; l.Amount = d.Amount; l.IsActive = d.IsActive; l.UpdatedAt = DateTime.UtcNow; l.UpdatedByName = who;
    }

    [HttpPost("lines")]
    public async Task<IActionResult> AddLine([FromBody] LineDto dto)
    {
        if (!await CanEditAsync()) return Forbid();
        if (Validate(dto) is { } err) return BadRequest(new { message = err });
        if (!await _db.CreditorCompanies.AnyAsync(c => c.Code == dto.CompanyCode)) return BadRequest(new { message = "Unknown company." });
        var l = new CreditorCashflowLine { CompanyCode = dto.CompanyCode };
        Apply(l, dto, UserName);
        l.SortOrder = (await _db.CreditorCashflowLines.Where(x => x.CompanyCode == dto.CompanyCode && x.Section == dto.Section).MaxAsync(x => (int?)x.SortOrder) ?? 0) + 1;
        _db.CreditorCashflowLines.Add(l);
        await _db.SaveChangesAsync();
        return Ok(await BuildAsync(ParseAsAt(null)));
    }

    [HttpPut("lines/{id:int}")]
    public async Task<IActionResult> UpdateLine(int id, [FromBody] LineDto dto)
    {
        if (!await CanEditAsync()) return Forbid();
        if (Validate(dto) is { } err) return BadRequest(new { message = err });
        var l = await _db.CreditorCashflowLines.FindAsync(id); if (l == null) return NotFound();
        Apply(l, dto, UserName);
        await _db.SaveChangesAsync();
        return Ok(await BuildAsync(ParseAsAt(null)));
    }

    [HttpDelete("lines/{id:int}")]
    public async Task<IActionResult> DeleteLine(int id)
    {
        if (!await CanEditAsync()) return Forbid();
        var l = await _db.CreditorCashflowLines.FindAsync(id); if (l == null) return NotFound();
        _db.CreditorCashflowLines.Remove(l);
        await _db.SaveChangesAsync();
        return Ok(await BuildAsync(ParseAsAt(null)));
    }

    // ───────── Excel (same shape as the template) ─────────
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string? asAt = null)
    {
        var cf = await BuildAsync(ParseAsAt(asAt));
        using var wb = new XLWorkbook();
        var money = "#,##0.00;[Red]-#,##0.00";
        var head = XLColor.FromHtml("#E8EEF7");

        // SUMMARY
        var s = wb.Worksheets.Add("SUMMARY");
        s.Range(1, 1, 1, 8).Merge().Value = "GROUP CASHFLOW"; s.Cell(1, 1).Style.Font.Bold = true; s.Cell(1, 1).Style.Font.FontSize = 16; s.Cell(1, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        s.Cell(2, 1).Value = $"As at {cf.AsAt:dd MMM yyyy} · generated {cf.GeneratedAt:dd MMM yyyy HH:mm}"; s.Range(2, 1, 2, 8).Merge().Style.Font.Italic = true;
        string[] cols = { "#", "COMPANY", "BALANCE", "BALANCE DATE", "PAYMENTS", "DEBIT ORDERS", "MONTHLY", "CLOSING BALANCE" };
        for (var c = 0; c < cols.Length; c++) s.Cell(4, c + 1).Value = cols[c];
        s.Range(4, 1, 4, cols.Length).Style.Font.Bold = true; s.Range(4, 1, 4, cols.Length).Style.Fill.BackgroundColor = head; s.Range(4, 1, 4, cols.Length).Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        var r = 5; var first = r;
        foreach (var co in cf.Companies)
        {
            s.Cell(r, 1).Value = r - first + 1; s.Cell(r, 2).Value = co.Name.ToUpperInvariant();
            if (co.Balance.HasValue) s.Cell(r, 3).Value = co.Balance.Value;
            if (co.BalanceAsAt.HasValue) { s.Cell(r, 4).Value = co.BalanceAsAt.Value; s.Cell(r, 4).Style.DateFormat.Format = "dd/MM/yyyy"; }
            // E..G (payments / debit orders / monthly) are linked to the company sheet totals below, once those rows are known.
            s.Cell(r, 8).FormulaA1 = $"C{r}-E{r}-F{r}-G{r}";
            r++;
        }
        var last = r - 1; r++;
        s.Cell(r, 2).Value = "TOTAL"; s.Cell(r, 2).Style.Font.Bold = true;
        foreach (var c in new[] { 3, 5, 6, 7, 8 }) { s.Cell(r, c).FormulaA1 = $"SUM({(char)('A' + c - 1)}{first}:{(char)('A' + c - 1)}{last})"; s.Cell(r, c).Style.Font.Bold = true; }
        s.Range(r, 1, r, cols.Length).Style.Border.TopBorder = XLBorderStyleValues.Double;
        s.Range(first, 3, r, 8).Style.NumberFormat.Format = money;
        s.Columns().AdjustToContents(); s.Column(2).Width = Math.Max(s.Column(2).Width, 28); s.SheetView.FreezeRows(4);

        // One sheet per company — payment schedule, debit orders, monthly payments.
        foreach (var co in cf.Companies)
        {
            var ws = wb.Worksheets.Add(Sheet(co.Code));
            ws.Range(1, 2, 1, 10).Merge().Value = co.Name.ToUpperInvariant(); ws.Cell(1, 2).Style.Font.Bold = true; ws.Cell(1, 2).Style.Font.FontSize = 14;
            ws.Range(2, 2, 2, 10).Merge().Value = "Payment Schedule"; ws.Cell(2, 2).Style.Font.Bold = true;
            ws.Range(3, 2, 3, 10).Merge().Value = $"Date : {cf.AsAt:dd/MM/yyyy}";
            ws.Cell(1, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center; ws.Cell(2, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center; ws.Cell(3, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            // Payments (from packs)
            var rr = 5;
            string[] ph = { "No.", "Supplier Name", "Date", "Document Number", "Description", "PAYABLE BY", "Payment Amount", "Batch", "Status" };
            for (var c = 0; c < ph.Length; c++) ws.Cell(rr, c + 2).Value = ph[c];
            Hdr(ws.Range(rr, 2, rr, ph.Length + 1), head);
            var pStart = rr + 1;
            foreach (var l in co.PaymentLines)
            {
                rr++;
                ws.Cell(rr, 2).Value = l.No; ws.Cell(rr, 3).Value = l.Supplier;
                if (l.InvoiceDate.HasValue) { ws.Cell(rr, 4).Value = l.InvoiceDate.Value; ws.Cell(rr, 4).Style.DateFormat.Format = "dd.MM.yyyy"; }
                ws.Cell(rr, 5).Value = l.DocumentNumber; ws.Cell(rr, 6).Value = l.Description ?? "";
                ws.Cell(rr, 7).Value = l.PayableBy; ws.Cell(rr, 7).Style.DateFormat.Format = "dd.MM.yyyy";
                ws.Cell(rr, 8).Value = l.Amount; ws.Cell(rr, 9).Value = l.BatchNumber; ws.Cell(rr, 10).Value = CreditorWorkflow.Title(l.Status);
            }
            if (co.PaymentLines.Count == 0) rr++;
            rr++;
            ws.Cell(rr, 7).Value = "Total Payable:"; ws.Cell(rr, 7).Style.Font.Bold = true;
            ws.Cell(rr, 8).FormulaA1 = $"SUM(H{pStart}:H{rr - 1})"; ws.Cell(rr, 8).Style.Font.Bold = true;
            var payTotal = $"H{rr}";

            // Debit orders
            rr += 3;
            ws.Cell(rr, 3).Value = "Debit orders"; ws.Cell(rr, 3).Style.Font.Bold = true; rr++;
            string[] dh = { "No.", "Payee", "Reference / Account", "Frequency", "Description", "Due", "Amount (R)" };
            for (var c = 0; c < dh.Length; c++) ws.Cell(rr, c + 2).Value = dh[c];
            Hdr(ws.Range(rr, 2, rr, dh.Length + 1), head);
            var dStart = rr + 1; var n = 0;
            foreach (var l in co.Lines.Where(x => x.Section == CreditorCashflowSections.DebitOrder))
            {
                rr++; ws.Cell(rr, 2).Value = ++n; ws.Cell(rr, 3).Value = l.Payee; ws.Cell(rr, 4).Value = l.Reference ?? ""; ws.Cell(rr, 4).Style.NumberFormat.Format = "@";
                ws.Cell(rr, 5).Value = l.Frequency ?? ""; ws.Cell(rr, 6).Value = l.Description ?? ""; ws.Cell(rr, 7).Value = l.DueDay.HasValue ? $"Day {l.DueDay}" : ""; ws.Cell(rr, 8).Value = l.Amount;
            }
            if (n == 0) rr++;
            rr++; ws.Cell(rr, 7).Value = "TOTAL"; ws.Cell(rr, 7).Style.Font.Bold = true; ws.Cell(rr, 8).FormulaA1 = $"SUM(H{dStart}:H{rr - 1})"; ws.Cell(rr, 8).Style.Font.Bold = true;
            var doTotal = $"H{rr}";

            // Monthly payments
            rr += 3;
            ws.Cell(rr, 3).Value = "MONTHLY PAYMENTS"; ws.Cell(rr, 3).Style.Font.Bold = true; rr++;
            for (var c = 0; c < dh.Length; c++) ws.Cell(rr, c + 2).Value = dh[c];
            Hdr(ws.Range(rr, 2, rr, dh.Length + 1), head);
            var mStart = rr + 1; n = 0;
            foreach (var l in co.Lines.Where(x => x.Section == CreditorCashflowSections.Monthly))
            {
                rr++; ws.Cell(rr, 2).Value = ++n; ws.Cell(rr, 3).Value = l.Payee; ws.Cell(rr, 4).Value = l.Reference ?? ""; ws.Cell(rr, 4).Style.NumberFormat.Format = "@";
                ws.Cell(rr, 5).Value = l.Frequency ?? ""; ws.Cell(rr, 6).Value = l.Description ?? ""; ws.Cell(rr, 7).Value = l.DueDay.HasValue ? $"Day {l.DueDay}" : ""; ws.Cell(rr, 8).Value = l.Amount;
            }
            if (n == 0) rr++;
            rr++; ws.Cell(rr, 7).Value = "TOTAL"; ws.Cell(rr, 7).Style.Font.Bold = true; ws.Cell(rr, 8).FormulaA1 = $"SUM(H{mStart}:H{rr - 1})"; ws.Cell(rr, 8).Style.Font.Bold = true;
            var monTotal = $"H{rr}";

            ws.Column(8).Style.NumberFormat.Format = money;
            ws.Columns().AdjustToContents(); ws.Column(3).Width = Math.Max(ws.Column(3).Width, 28); ws.Column(6).Width = Math.Min(Math.Max(ws.Column(6).Width, 20), 50);

            // Patch the SUMMARY formulas with the actual total cells for this sheet.
            var sr = first + cf.Companies.IndexOf(co);
            s.Cell(sr, 5).FormulaA1 = $"'{Sheet(co.Code)}'!{payTotal}"; s.Cell(sr, 6).FormulaA1 = $"'{Sheet(co.Code)}'!{doTotal}"; s.Cell(sr, 7).FormulaA1 = $"'{Sheet(co.Code)}'!{monTotal}";
        }

        using var ms = new MemoryStream(); wb.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Group-cashflow-{cf.AsAt:yyyy-MM-dd}.xlsx");
    }

    private static string Sheet(string code) => code.Length > 31 ? code[..31] : code;
    private static void Hdr(IXLRange rg, XLColor bg) { rg.Style.Font.Bold = true; rg.Style.Fill.BackgroundColor = bg; rg.Style.Border.BottomBorder = XLBorderStyleValues.Thin; }
}
