using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance;

namespace ProjectTracker.API.Controllers.Finance
{
    /// <summary>
    /// Credit notes â€” everything the group has ever credited, built from three sources that are stitched together
    /// on the Sage CN number:
    ///   1. ImportedInvoices (Sage sales history): every CN line ever posted â€” customer, product, qty, value.
    ///      This is the master list ("what was credited").
    ///   2. ArAgingItems (latest aging per company): a CR row means the credit is still UNAPPLIED on the debtor's
    ///      account; absent from the aging means it has been applied against an invoice / refunded.
    ///   3. CreditNoteDocuments: the signed PDF a manager uploaded authorising the credit. A credit without a
    ///      signed copy is a control gap and is flagged.
    /// Each credit is also matched back to the invoice(s) it most likely reverses (same customer, same products,
    /// invoiced before the credit) so Sales and Finance can see credits per invoice and per customer.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/finance/credit-notes")]
    [RequireModule("finance", AlsoAllowRoles = "Finance,Sales,Manager,Admin")]
    public class FinanceCreditNotesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly string _root;
        private static readonly Regex CnRx = new(@"\bCN\d{4,}\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Dictionary<string, string> CompanyNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["PMT"] = "Promed Technologies", ["ACM"] = "Access Medical", ["PHT"] = "Promed Pharatech", ["SBT"] = "Sebenzani Trading"
        };

        public FinanceCreditNotesController(ApplicationDbContext db, IConfiguration cfg)
        {
            _db = db;
            _root = cfg.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        }

        private int UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
        private string UserName => User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name ?? "";

        private static string CompanyName(string? code) => code != null && CompanyNames.TryGetValue(code, out var n) ? n : (code ?? "Unknown");
        private static string? CompanyCode(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return null;
            if (CompanyNames.ContainsKey(name)) return name.ToUpperInvariant();
            var hit = CompanyNames.FirstOrDefault(kv => string.Equals(kv.Value, name, StringComparison.OrdinalIgnoreCase));
            return hit.Key;
        }

        /// <summary>
        /// Sage numbers CNs per company, so the same CN number exists in both Promed Technologies and Access Medical
        /// for different customers. Everything is therefore keyed on company + number.
        /// </summary>
        private static string Key(string? company, string number) => $"{(CompanyCode(company) ?? company ?? "").ToUpperInvariant()}|{number.Trim().ToUpperInvariant()}";

        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        //  Shared: open (unapplied) credit notes from the latest aging snapshot per company
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        private async Task<Dictionary<string, (decimal balance, string company, DateTime asOf, string? orderNo, int ageDays)>> OpenCreditsAsync()
        {
            var latest = await _db.ArAgingSnapshots.AsNoTracking()
                .GroupBy(s => s.Company).Select(g => g.OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id).First())
                .ToListAsync();
            var ids = latest.Select(s => s.Id).ToList();
            var asOf = latest.ToDictionary(s => s.Id, s => (s.Company, s.AsOfDate));
            var rows = await _db.ArAgingItems.AsNoTracking()
                .Where(i => ids.Contains(i.SnapshotId) && (i.DocumentType == "CR" || i.DocumentType == "CN"))
                .Select(i => new { i.SnapshotId, i.DocumentNumber, i.Balance, i.OrderNumber, i.AgeDays })
                .ToListAsync();
            var d = new Dictionary<string, (decimal, string, DateTime, string?, int)>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in rows)
            {
                var (co, dt) = asOf[r.SnapshotId];
                d[Key(co, r.DocumentNumber)] = (r.Balance, co, dt, r.OrderNumber, r.AgeDays);
            }
            return d;
        }

        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        //  GET api/finance/credit-notes/summary
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [HttpGet("summary")]
        public async Task<IActionResult> Summary()
        {
            var cn = _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber.StartsWith("CN"));
            var byCompany = await cn.GroupBy(i => i.SourceCompany)
                .Select(g => new { company = g.Key, docs = g.Select(x => x.SourceCompany + "|" + x.TransactionNumber).Distinct().Count(), lines = g.Count(), value = -g.Sum(x => x.SalesAmount), first = g.Min(x => x.TransactionDate), last = g.Max(x => x.TransactionDate) })
                .ToListAsync();

            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
            var thisMonth = await cn.Where(i => i.TransactionDate >= monthStart).GroupBy(_ => 1)
                .Select(g => new { docs = g.Select(x => x.SourceCompany + "|" + x.TransactionNumber).Distinct().Count(), value = -g.Sum(x => x.SalesAmount) }).FirstOrDefaultAsync();
            var last30 = await cn.Where(i => i.TransactionDate >= DateTime.UtcNow.AddDays(-30)).GroupBy(_ => 1)
                .Select(g => new { docs = g.Select(x => x.SourceCompany + "|" + x.TransactionNumber).Distinct().Count(), value = -g.Sum(x => x.SalesAmount) }).FirstOrDefaultAsync();

            var allKeys = (await cn.Select(i => new { i.SourceCompany, i.TransactionNumber }).Distinct().ToListAsync()).Select(x => Key(x.SourceCompany, x.TransactionNumber)).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var docRows = await _db.CreditNoteDocuments.AsNoTracking().Select(d => new { d.Company, d.CreditNoteNumber }).Distinct().ToListAsync();
            var signedSet = docRows.Select(d => Key(d.Company, d.CreditNoteNumber)).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var signed = allKeys.Count(k => signedSet.Contains(k));

            var open = await OpenCreditsAsync();
            var openValue = open.Values.Sum(v => -v.balance);

            // Credit as % of sales per company (how much of what we invoice we end up reversing)
            var sales = await _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber.StartsWith("IN"))
                .GroupBy(i => i.SourceCompany).Select(g => new { company = g.Key, value = g.Sum(x => x.SalesAmount) }).ToListAsync();

            var topCustomers = await cn.GroupBy(i => new { i.CustomerNumber, i.CustomerName, i.SourceCompany })
                .Select(g => new { g.Key.CustomerNumber, g.Key.CustomerName, company = g.Key.SourceCompany, docs = g.Select(x => x.SourceCompany + "|" + x.TransactionNumber).Distinct().Count(), value = -g.Sum(x => x.SalesAmount) })
                .OrderByDescending(x => x.value).Take(10).ToListAsync();

            var topProducts = await cn.Where(i => i.ProductCode != null && i.ProductCode != "")
                .GroupBy(i => new { i.ProductCode, i.ProductDescription })
                .Select(g => new { g.Key.ProductCode, g.Key.ProductDescription, qty = -g.Sum(x => x.Quantity), value = -g.Sum(x => x.SalesAmount), docs = g.Select(x => x.SourceCompany + "|" + x.TransactionNumber).Distinct().Count() })
                .OrderByDescending(x => x.value).Take(10).ToListAsync();

            // Monthly trend (last 12 months)
            var from = monthStart.AddMonths(-11);
            var trend = await cn.Where(i => i.TransactionDate >= from)
                .GroupBy(i => new { i.TransactionDate.Year, i.TransactionDate.Month })
                .Select(g => new { g.Key.Year, g.Key.Month, docs = g.Select(x => x.SourceCompany + "|" + x.TransactionNumber).Distinct().Count(), value = -g.Sum(x => x.SalesAmount) })
                .OrderBy(x => x.Year).ThenBy(x => x.Month).ToListAsync();

            return Ok(new
            {
                totalDocs = allKeys.Count,
                totalValue = byCompany.Sum(c => c.value),
                thisMonth = new { docs = thisMonth?.docs ?? 0, value = thisMonth?.value ?? 0 },
                last30 = new { docs = last30?.docs ?? 0, value = last30?.value ?? 0 },
                signedDocs = signed,
                unsignedDocs = allKeys.Count - signed,
                uploadedDocuments = docRows.Count,
                open = new { docs = open.Count, value = openValue },
                byCompany = byCompany.Select(c => new
                {
                    code = c.company, name = CompanyName(c.company), c.docs, c.lines, c.value, c.first, c.last,
                    salesValue = sales.FirstOrDefault(s => s.company == c.company)?.value ?? 0,
                    creditPct = (sales.FirstOrDefault(s => s.company == c.company)?.value ?? 0) == 0 ? 0 : Math.Round(c.value / sales.First(s => s.company == c.company).value * 100, 2),
                    open = open.Values.Where(v => CompanyCode(v.company) == c.company).Count(),
                    openValue = open.Values.Where(v => CompanyCode(v.company) == c.company).Sum(v => -v.balance)
                }).OrderByDescending(c => c.value),
                topCustomers = topCustomers.Select(t => new { t.CustomerNumber, t.CustomerName, company = CompanyName(t.company), t.docs, t.value }),
                topProducts,
                trend = trend.Select(t => new { month = $"{t.Year}-{t.Month:00}", t.docs, t.value })
            });
        }

        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        //  GET api/finance/credit-notes?company=PMT&search=&from=&to=&status=open|applied|unsigned|signed&page=1&pageSize=50
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? company, [FromQuery] string? search, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
                                              [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 500);
            var q = _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber.StartsWith("CN"));
            if (!string.IsNullOrWhiteSpace(company) && company != "ALL") { var code = CompanyCode(company) ?? company; q = q.Where(i => i.SourceCompany == code); }
            if (from.HasValue) q = q.Where(i => i.TransactionDate >= from.Value.Date);
            if (to.HasValue) { var t = to.Value.Date.AddDays(1); q = q.Where(i => i.TransactionDate < t); }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(i => i.TransactionNumber.Contains(s) || i.CustomerName.Contains(s) || i.CustomerNumber.Contains(s)
                              || (i.ProductCode != null && i.ProductCode.Contains(s)) || (i.ProductDescription != null && i.ProductDescription.Contains(s)));
            }

            // One row per credit note
            var grouped = await q.GroupBy(i => new { i.TransactionNumber, i.SourceCompany, i.CustomerNumber, i.CustomerName })
                .Select(g => new
                {
                    number = g.Key.TransactionNumber, company = g.Key.SourceCompany, g.Key.CustomerNumber, g.Key.CustomerName,
                    date = g.Min(x => x.TransactionDate), lines = g.Count(), value = -g.Sum(x => x.SalesAmount), qty = -g.Sum(x => x.Quantity),
                    products = g.Select(x => x.ProductCode).Distinct().Count()
                })
                .OrderByDescending(x => x.date).ThenByDescending(x => x.number)
                .ToListAsync();

            var open = await OpenCreditsAsync();
            var docs = await _db.CreditNoteDocuments.AsNoTracking()
                .GroupBy(d => new { d.Company, d.CreditNoteNumber }).Select(g => new { company = g.Key.Company, number = g.Key.CreditNoteNumber, n = g.Count(), signedBy = g.Max(d => d.SignedBy), reason = g.Max(d => d.Reason), lastAt = g.Max(d => d.UploadedAt) })
                .ToListAsync();
            var docMap = docs.GroupBy(d => Key(d.company, d.number), StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            var enriched = grouped.Select(g =>
            {
                var isOpen = open.TryGetValue(Key(g.company, g.number), out var o);
                docMap.TryGetValue(Key(g.company, g.number), out var d);
                return new
                {
                    g.number, companyCode = g.company, company = CompanyName(g.company), customerNumber = g.CustomerNumber, customerName = g.CustomerName,
                    g.date, g.lines, g.products, g.qty, g.value,
                    status = isOpen ? "Open" : "Applied",
                    openBalance = isOpen ? -o.balance : 0m,
                    openAgeDays = isOpen ? o.ageDays : (int?)null,
                    orderNumber = isOpen ? o.orderNo : null,
                    hasSignedCopy = d != null,
                    documents = d?.n ?? 0, signedBy = d?.signedBy, reason = d?.reason
                };
            });

            enriched = (status ?? "").ToLowerInvariant() switch
            {
                "open" => enriched.Where(e => e.status == "Open"),
                "applied" => enriched.Where(e => e.status == "Applied"),
                "unsigned" => enriched.Where(e => !e.hasSignedCopy),
                "signed" => enriched.Where(e => e.hasSignedCopy),
                _ => enriched
            };
            var list = enriched.ToList();
            var pageItems = list.Skip((page - 1) * pageSize).Take(pageSize).ToList();

            // Likely original invoices for the page (same customer, overlapping products, invoiced before the credit)
            var matches = await MatchInvoicesAsync(pageItems.Select(p => (p.companyCode, p.number)).ToList());

            return Ok(new
            {
                total = list.Count,
                totalValue = list.Sum(x => x.value),
                page, pageSize,
                items = pageItems.Select(p => new
                {
                    p.number, p.companyCode, p.company, p.customerNumber, p.customerName, p.date, p.lines, p.products, p.qty, p.value,
                    p.status, p.openBalance, p.openAgeDays, p.orderNumber, p.hasSignedCopy, p.documents, p.signedBy, p.reason,
                    invoices = matches.TryGetValue(Key(p.companyCode, p.number), out var m) ? m : new List<object>()
                })
            });
        }

        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        //  GET api/finance/credit-notes/CN103513 â€” full context
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [HttpGet("{number}")]
        public async Task<IActionResult> Get(string number, [FromQuery] string? company)
        {
            number = number.Trim();
            var code = CompanyCode(company) ?? (string.IsNullOrWhiteSpace(company) ? null : company.ToUpperInvariant());
            var lq = _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber == number);
            if (code != null) lq = lq.Where(i => i.SourceCompany == code);
            var lines = await lq.OrderBy(i => i.ProductCode)
                .Select(i => new { i.Id, i.ProductCode, i.ProductDescription, i.Brand, qty = -i.Quantity, value = -i.SalesAmount, cost = -i.CostOfSales, i.TransactionDate, i.CustomerNumber, i.CustomerName, i.SourceCompany })
                .ToListAsync();
            // Same CN number can exist in two companies â€” without a company hint, take the most recent one
            var companiesHit = lines.Select(l => l.SourceCompany).Distinct().ToList();
            if (companiesHit.Count > 1)
            {
                var pick = lines.OrderByDescending(l => l.TransactionDate).First().SourceCompany;
                lines = lines.Where(l => l.SourceCompany == pick).ToList();
            }
            var head = lines.FirstOrDefault();
            code ??= head?.SourceCompany;

            var dq = _db.CreditNoteDocuments.AsNoTracking().Where(d => d.CreditNoteNumber == number);
            if (code != null) dq = dq.Where(d => d.Company == null || d.Company == code);
            var docs = await dq.OrderByDescending(d => d.UploadedAt).ToListAsync();
            if (lines.Count == 0 && docs.Count == 0) return NotFound(new { message = $"No credit note {number} in the sales history or uploads." });

            var open = await OpenCreditsAsync();
            var isOpen = open.TryGetValue(Key(code, number), out var o);

            var matches = head == null ? new() : await MatchInvoicesAsync(new List<(string, string)> { (head.SourceCompany, number) }, includeLines: true);

            // Remittances that mention this credit note (customer deducting it from a payment)
            var remits = await _db.RemittanceEmails.AsNoTracking()
                .Where(r => (r.ExtractedJson != null && r.ExtractedJson.Contains(number)) || (r.BodyText != null && r.BodyText.Contains(number)) || (r.Subject != null && r.Subject.Contains(number)))
                .OrderByDescending(r => r.ReceivedAt).Take(10)
                .Select(r => new { r.Id, r.Subject, r.FromEmail, r.ReceivedAt, r.CustomerName, r.TotalAmount, r.Status })
                .ToListAsync();

            // Other credits for the same customer (pattern spotting)
            var customerHistory = head == null ? null : await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.CustomerNumber == head.CustomerNumber && i.SourceCompany == head.SourceCompany && i.TransactionNumber.StartsWith("CN") && i.TransactionNumber != number)
                .GroupBy(i => i.TransactionNumber).Select(g => new { number = g.Key, date = g.Min(x => x.TransactionDate), value = -g.Sum(x => x.SalesAmount), lines = g.Count() })
                .OrderByDescending(x => x.date).Take(12).ToListAsync();

            return Ok(new
            {
                number,
                companyCode = head?.SourceCompany ?? docs.FirstOrDefault()?.Company,
                company = CompanyName(head?.SourceCompany ?? docs.FirstOrDefault()?.Company),
                customerNumber = head?.CustomerNumber ?? docs.FirstOrDefault()?.CustomerNumber,
                customerName = head?.CustomerName ?? docs.FirstOrDefault()?.CustomerName,
                date = head?.TransactionDate,
                value = lines.Sum(l => l.value),
                cost = lines.Sum(l => l.cost),
                status = isOpen ? "Open" : lines.Count == 0 ? "Not in sales history" : "Applied",
                openBalance = isOpen ? -o.balance : 0m,
                openAgeDays = isOpen ? o.ageDays : (int?)null,
                orderNumber = isOpen ? o.orderNo : null,
                agingAsOf = isOpen ? o.asOf : (DateTime?)null,
                hasSignedCopy = docs.Count > 0,
                otherCompanies = companiesHit.Count > 1 ? companiesHit.Where(c => c != head!.SourceCompany).Select(CompanyName).ToList() : null,
                lines,
                invoices = matches.TryGetValue(Key(code, number), out var m) ? m : new List<object>(),
                documents = docs.Select(DocDto),
                remittances = remits,
                customerHistory
            });
        }

        /// <summary>
        /// Find the invoice(s) a credit most likely reverses: same customer + company, invoiced on/before the credit
        /// date (within 18 months), ranked by product overlap and then by how closely the quantities match.
        /// </summary>
        private async Task<Dictionary<string, List<object>>> MatchInvoicesAsync(List<(string company, string number)> keys, bool includeLines = false)
        {
            var result = new Dictionary<string, List<object>>(StringComparer.OrdinalIgnoreCase);
            if (keys.Count == 0) return result;

            var numbers = keys.Select(k => k.number).Distinct().ToList();
            var wanted = keys.Select(k => Key(k.company, k.number)).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var cnLines = (await _db.ImportedInvoices.AsNoTracking().Where(i => numbers.Contains(i.TransactionNumber))
                .Select(i => new { i.TransactionNumber, i.SourceCompany, i.CustomerNumber, i.ProductCode, i.Quantity, i.SalesAmount, i.TransactionDate })
                .ToListAsync())
                .Where(l => wanted.Contains(Key(l.SourceCompany, l.TransactionNumber))).ToList();
            if (cnLines.Count == 0) return result;

            var customers = cnLines.Select(l => l.CustomerNumber).Distinct().ToList();
            var products = cnLines.Where(l => l.ProductCode != null).Select(l => l.ProductCode!).Distinct().ToList();
            var minDate = cnLines.Min(l => l.TransactionDate).AddMonths(-18);
            var maxDate = cnLines.Max(l => l.TransactionDate);

            var invLines = await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionNumber.StartsWith("IN") && customers.Contains(i.CustomerNumber) && i.TransactionDate >= minDate && i.TransactionDate <= maxDate
                            && i.ProductCode != null && products.Contains(i.ProductCode))
                .Select(i => new { i.TransactionNumber, i.SourceCompany, i.CustomerNumber, i.ProductCode, i.ProductDescription, i.Quantity, i.SalesAmount, i.TransactionDate, i.LoadId, i.Status })
                .ToListAsync();

            // Invoice totals (all lines, not only overlapping) for the ones we end up showing
            var invNumbers = invLines.Select(i => i.TransactionNumber).Distinct().ToList();
            var invTotals = invNumbers.Count == 0 ? new() : await _db.ImportedInvoices.AsNoTracking().Where(i => invNumbers.Contains(i.TransactionNumber))
                .GroupBy(i => i.TransactionNumber).Select(g => new { number = g.Key, total = g.Sum(x => x.SalesAmount), lines = g.Count() })
                .ToDictionaryAsync(x => x.number, x => x);

            // Which invoices are still open / have PODs
            var open = await OpenInvoicesAsync(invNumbers);
            var pods = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (invNumbers.Count > 0)
            {
                var viaLinks = await _db.PodDocumentInvoiceLinks.AsNoTracking()
                    .Where(l => (l.InvoiceNumber != null && invNumbers.Contains(l.InvoiceNumber)) || (l.Invoice != null && invNumbers.Contains(l.Invoice.TransactionNumber)))
                    .Select(l => l.InvoiceNumber ?? l.Invoice!.TransactionNumber).ToListAsync();
                foreach (var n in viaLinks) pods.Add(n);
            }

            foreach (var grp in cnLines.GroupBy(l => Key(l.SourceCompany, l.TransactionNumber), StringComparer.OrdinalIgnoreCase))
            {
                var cust = grp.First().CustomerNumber; var co = grp.First().SourceCompany; var cnDate = grp.Max(l => l.TransactionDate);
                var cnProducts = grp.Where(l => l.ProductCode != null).GroupBy(l => l.ProductCode!).ToDictionary(g => g.Key, g => -g.Sum(x => x.Quantity));
                var cnValue = -grp.Sum(l => l.SalesAmount);

                var candidates = invLines.Where(i => i.CustomerNumber == cust && i.SourceCompany == co && i.TransactionDate <= cnDate)
                    .GroupBy(i => i.TransactionNumber)
                    .Select(g =>
                    {
                        var overlap = g.Select(x => x.ProductCode!).Distinct().Count(p => cnProducts.ContainsKey(p));
                        var qtyScore = g.Where(x => cnProducts.ContainsKey(x.ProductCode!)).Sum(x => Math.Min(x.Quantity, cnProducts[x.ProductCode!]));
                        var overlapValue = g.Where(x => cnProducts.ContainsKey(x.ProductCode!)).Sum(x => x.SalesAmount);
                        var days = (cnDate - g.Max(x => x.TransactionDate)).Days;
                        invTotals.TryGetValue(g.Key, out var tot);
                        return new
                        {
                            number = g.Key, date = g.Max(x => x.TransactionDate), daysBefore = days,
                            overlapProducts = overlap, totalProductsOnCredit = cnProducts.Count,
                            confidence = Math.Round(Math.Min(1.0, (double)overlap / Math.Max(1, cnProducts.Count)) * (days <= 120 ? 1.0 : days <= 365 ? 0.8 : 0.6), 2),
                            total = tot?.total ?? overlapValue, lines = tot?.lines ?? g.Count(),
                            overlapValue,
                            stillOpen = open.TryGetValue(g.Key, out var ob) ? ob : (decimal?)null,
                            hasPod = pods.Contains(g.Key),
                            loadId = g.Select(x => x.LoadId).FirstOrDefault(x => x != null),
                            lines_ = includeLines ? g.Select(x => new { x.ProductCode, x.ProductDescription, x.Quantity, x.SalesAmount, credited = cnProducts.ContainsKey(x.ProductCode!) }).ToList() : null,
                            _qty = qtyScore
                        };
                    })
                    .Where(c => c.overlapProducts > 0)
                    .OrderByDescending(c => c.confidence).ThenByDescending(c => c._qty).ThenByDescending(c => c.date)
                    .Take(5)
                    .Select(c => (object)new { c.number, c.date, c.daysBefore, c.overlapProducts, c.totalProductsOnCredit, c.confidence, c.total, c.lines, c.overlapValue, c.stillOpen, c.hasPod, c.loadId, lines_ = c.lines_ })
                    .ToList();
                result[grp.Key] = candidates;
            }
            return result;
        }

        private async Task<Dictionary<string, decimal>> OpenInvoicesAsync(List<string> invNumbers)
        {
            if (invNumbers.Count == 0) return new();
            var latestIds = await _db.ArAgingSnapshots.AsNoTracking().GroupBy(s => s.Company).Select(g => g.OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id).First().Id).ToListAsync();
            var rows = await _db.ArAgingItems.AsNoTracking().Where(i => latestIds.Contains(i.SnapshotId) && i.DocumentType == "IN" && invNumbers.Contains(i.DocumentNumber))
                .Select(i => new { i.DocumentNumber, i.Balance }).ToListAsync();
            return rows.GroupBy(r => r.DocumentNumber, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.Sum(x => x.Balance), StringComparer.OrdinalIgnoreCase);
        }

        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        //  Cross-module lookups (Sales / invoices)
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        /// <summary>GET api/finance/credit-notes/by-invoice/IN148387 â€” credits that reverse (part of) this invoice.</summary>
        [HttpGet("by-invoice/{invoiceNumber}")]
        public async Task<IActionResult> ByInvoice(string invoiceNumber)
        {
            var inv = await _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber == invoiceNumber)
                .Select(i => new { i.CustomerNumber, i.SourceCompany, i.ProductCode, i.Quantity, i.SalesAmount, i.TransactionDate }).ToListAsync();
            if (inv.Count == 0) return Ok(new { invoiceNumber, credits = Array.Empty<object>(), creditedValue = 0m });
            var cust = inv[0].CustomerNumber; var co = inv[0].SourceCompany; var invDate = inv.Max(i => i.TransactionDate);
            var prods = inv.Where(i => i.ProductCode != null).Select(i => i.ProductCode!).Distinct().ToList();

            var cns = await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionNumber.StartsWith("CN") && i.CustomerNumber == cust && i.SourceCompany == co && i.TransactionDate >= invDate && i.TransactionDate <= invDate.AddMonths(18)
                            && i.ProductCode != null && prods.Contains(i.ProductCode))
                .GroupBy(i => i.TransactionNumber)
                .Select(g => new { number = g.Key, date = g.Min(x => x.TransactionDate), value = -g.Sum(x => x.SalesAmount), products = g.Select(x => x.ProductCode).Distinct().Count() })
                .OrderBy(x => x.date).ToListAsync();

            var docNums = cns.Select(c => c.number).ToList();
            var signed = (await _db.CreditNoteDocuments.AsNoTracking().Where(d => docNums.Contains(d.CreditNoteNumber) && (d.Company == null || d.Company == co)).Select(d => d.CreditNoteNumber).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var invoiceTotal = inv.Sum(i => i.SalesAmount);
            return Ok(new
            {
                invoiceNumber, invoiceTotal, customerNumber = cust, company = CompanyName(co),
                credits = cns.Select(c => new { c.number, c.date, c.value, c.products, hasSignedCopy = signed.Contains(c.number), confidence = Math.Round((double)c.products / Math.Max(1, prods.Count), 2) }),
                creditedValue = cns.Sum(c => c.value),
                creditedPct = invoiceTotal == 0 ? 0 : Math.Round(cns.Sum(c => c.value) / invoiceTotal * 100, 1)
            });
        }

        /// <summary>GET api/finance/credit-notes/by-customer/01-INK-001?company=ACM â€” credit history for a debtor.</summary>
        [HttpGet("by-customer/{customerNumber}")]
        public async Task<IActionResult> ByCustomer(string customerNumber, [FromQuery] string? company)
        {
            var q = _db.ImportedInvoices.AsNoTracking().Where(i => i.CustomerNumber == customerNumber);
            if (!string.IsNullOrWhiteSpace(company)) { var code = CompanyCode(company) ?? company; q = q.Where(i => i.SourceCompany == code); }
            var sales = await q.Where(i => i.TransactionNumber.StartsWith("IN")).SumAsync(i => (decimal?)i.SalesAmount) ?? 0;
            var cns = await q.Where(i => i.TransactionNumber.StartsWith("CN")).GroupBy(i => new { i.TransactionNumber, i.SourceCompany })
                .Select(g => new { number = g.Key.TransactionNumber, company = g.Key.SourceCompany, date = g.Min(x => x.TransactionDate), value = -g.Sum(x => x.SalesAmount), lines = g.Count() })
                .OrderByDescending(x => x.date).ToListAsync();
            var open = await OpenCreditsAsync();
            return Ok(new
            {
                customerNumber, sales, credited = cns.Sum(c => c.value), creditPct = sales == 0 ? 0 : Math.Round(cns.Sum(c => c.value) / sales * 100, 2),
                count = cns.Count, openCount = cns.Count(c => open.ContainsKey(Key(c.company, c.number))),
                credits = cns.Select(c => new { c.number, companyCode = c.company, company = CompanyName(c.company), c.date, c.value, c.lines, status = open.ContainsKey(Key(c.company, c.number)) ? "Open" : "Applied" })
            });
        }

        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        //  Signed documents
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        /// <summary>GET api/finance/credit-notes/documents?search=&unmatched=true</summary>
        [HttpGet("documents")]
        public async Task<IActionResult> Documents([FromQuery] string? search, [FromQuery] bool unmatched = false)
        {
            var q = _db.CreditNoteDocuments.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(d => d.CreditNoteNumber.Contains(s) || (d.CustomerName != null && d.CustomerName.Contains(s)) || (d.SignedBy != null && d.SignedBy.Contains(s)) || (d.InvoiceNumbers != null && d.InvoiceNumbers.Contains(s)) || (d.OriginalFileName != null && d.OriginalFileName.Contains(s)));
            }
            var docs = await q.OrderByDescending(d => d.UploadedAt).Take(1000).ToListAsync();
            var nums = docs.Select(d => d.CreditNoteNumber).Distinct().ToList();
            var knownRows = await _db.ImportedInvoices.AsNoTracking().Where(i => nums.Contains(i.TransactionNumber)).GroupBy(i => new { i.TransactionNumber, i.SourceCompany })
                .Select(g => new { number = g.Key.TransactionNumber, company = g.Key.SourceCompany, value = -g.Sum(x => x.SalesAmount), customer = g.Max(x => x.CustomerName), date = g.Min(x => x.TransactionDate) }).ToListAsync();
            var known = knownRows.ToDictionary(x => Key(x.company, x.number), x => x, StringComparer.OrdinalIgnoreCase);
            var items = docs.Select(d =>
            {
                // Documents uploaded without a company fall back to the only Sage match for that number (if unambiguous)
                if (!known.TryGetValue(Key(d.Company, d.CreditNoteNumber), out var k) && d.Company == null)
                {
                    var hits = knownRows.Where(r => string.Equals(r.number, d.CreditNoteNumber, StringComparison.OrdinalIgnoreCase)).ToList();
                    if (hits.Count == 1) k = hits[0];
                }
                return new
                {
                    doc = DocDto(d), inSage = k != null, sageValue = k?.value, sageCustomer = k?.customer, sageCompany = CompanyName(k?.company), sageDate = k?.date,
                    amountMismatch = k != null && d.Amount.HasValue && Math.Abs(k.value - d.Amount.Value) > 0.5m
                };
            });
            if (unmatched) items = items.Where(i => !i.inSage);
            return Ok(items.ToList());
        }

        public class UploadForm
        {
            public IFormFile File { get; set; } = null!;
            public string CreditNoteNumber { get; set; } = string.Empty;
            public string? Company { get; set; }
            public string? CustomerNumber { get; set; }
            public string? CustomerName { get; set; }
            public string? InvoiceNumbers { get; set; }
            public decimal? Amount { get; set; }
            public string? Reason { get; set; }
            public string? Notes { get; set; }
            public string? SignedBy { get; set; }
            public DateTime? SignedOn { get; set; }
        }

        /// <summary>POST api/finance/credit-notes/documents (multipart) â€” upload a signed credit note PDF/image.</summary>
        [HttpPost("documents")]
        [RequestSizeLimit(30_000_000)]
        public async Task<IActionResult> Upload([FromForm] UploadForm form)
        {
            if (form.File == null || form.File.Length == 0) return BadRequest(new { error = "Choose the signed credit note file." });
            var ext = Path.GetExtension(form.File.FileName).ToLowerInvariant();
            if (ext is not (".pdf" or ".jpg" or ".jpeg" or ".png")) return BadRequest(new { error = "Only PDF, JPG or PNG files are accepted." });

            var number = (form.CreditNoteNumber ?? "").Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(number))
            {
                // Try to read it off the file name (e.g. "CN103513 signed.pdf")
                var m = CnRx.Match(form.File.FileName);
                if (m.Success) number = m.Value.ToUpperInvariant();
            }
            if (string.IsNullOrEmpty(number)) return BadRequest(new { error = "Enter the credit note number (e.g. CN103513)." });
            if (Regex.IsMatch(number, @"^\d+$")) number = "CN" + number;

            // Fill customer / company / amount from the sales history when the uploader didn't
            var formCode = CompanyCode(form.Company) ?? (string.IsNullOrWhiteSpace(form.Company) ? null : form.Company.ToUpperInvariant());
            var sageHits = await _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber == number).GroupBy(i => i.SourceCompany)
                .Select(g => new { customerNo = g.Max(x => x.CustomerNumber), customer = g.Max(x => x.CustomerName), company = g.Key, value = -g.Sum(x => x.SalesAmount) })
                .ToListAsync();
            if (formCode != null) sageHits = sageHits.Where(h => h.company == formCode).ToList();
            if (sageHits.Count > 1)
                return BadRequest(new { error = $"{number} exists in more than one company ({string.Join(", ", sageHits.Select(h => $"{CompanyName(h.company)} â€” {h.customer}"))}). Choose the company.", companies = sageHits.Select(h => new { code = h.company, name = CompanyName(h.company), h.customer, h.value }) });
            var sage = sageHits.FirstOrDefault();

            var dir = Path.Combine(_root, "finance", "credit-notes", DateTime.UtcNow.ToString("yyyy"));
            Directory.CreateDirectory(dir);
            var stored = $"{number}_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}"[..Math.Min(80, number.Length + 48)] + ext;
            var full = Path.Combine(dir, stored);
            await using (var fs = System.IO.File.Create(full)) await form.File.CopyToAsync(fs);

            var doc = new CreditNoteDocument
            {
                CreditNoteNumber = number,
                Company = formCode ?? sage?.company,
                CustomerNumber = string.IsNullOrWhiteSpace(form.CustomerNumber) ? sage?.customerNo : form.CustomerNumber.Trim(),
                CustomerName = string.IsNullOrWhiteSpace(form.CustomerName) ? sage?.customer : form.CustomerName.Trim(),
                InvoiceNumbers = string.IsNullOrWhiteSpace(form.InvoiceNumbers) ? null : form.InvoiceNumbers.Trim(),
                Amount = form.Amount ?? sage?.value,
                Reason = string.IsNullOrWhiteSpace(form.Reason) ? null : form.Reason.Trim(),
                Notes = string.IsNullOrWhiteSpace(form.Notes) ? null : form.Notes.Trim(),
                SignedBy = string.IsNullOrWhiteSpace(form.SignedBy) ? null : form.SignedBy.Trim(),
                SignedOn = form.SignedOn,
                FileName = stored,
                OriginalFileName = Path.GetFileName(form.File.FileName),
                ContentType = form.File.ContentType,
                Size = form.File.Length,
                StoragePath = Path.GetRelativePath(_root, full).Replace('\\', '/'),
                UploadedBy = UserId,
                UploadedByName = UserName
            };
            _db.CreditNoteDocuments.Add(doc);
            await _db.SaveChangesAsync();
            return Ok(new { doc = DocDto(doc), inSage = sage != null, sageValue = sage?.value, warning = sage == null ? $"{number} is not in the Sage sales history yet â€” it will link automatically once the next sales import includes it." : null });
        }

        [HttpGet("documents/{id:int}/file")]
        public async Task<IActionResult> File(int id, [FromQuery] bool download = false)
        {
            var d = await _db.CreditNoteDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            var full = Path.Combine(_root, d.StoragePath.Replace('/', Path.DirectorySeparatorChar));
            if (!System.IO.File.Exists(full)) return NotFound(new { error = "File is missing from storage." });
            var ct = d.ContentType ?? "application/octet-stream";
            if (download) return PhysicalFile(full, ct, d.OriginalFileName ?? d.FileName);
            Response.Headers.ContentDisposition = $"inline; filename=\"{d.OriginalFileName ?? d.FileName}\"";
            return PhysicalFile(full, ct);
        }

        public class DocUpdate { public string? Reason { get; set; } public string? Notes { get; set; } public string? SignedBy { get; set; } public DateTime? SignedOn { get; set; } public string? InvoiceNumbers { get; set; } public decimal? Amount { get; set; } }

        [HttpPut("documents/{id:int}")]
        public async Task<IActionResult> UpdateDoc(int id, [FromBody] DocUpdate u)
        {
            var d = await _db.CreditNoteDocuments.FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            if (u.Reason != null) d.Reason = u.Reason.Trim();
            if (u.Notes != null) d.Notes = u.Notes.Trim();
            if (u.SignedBy != null) d.SignedBy = u.SignedBy.Trim();
            if (u.SignedOn.HasValue) d.SignedOn = u.SignedOn;
            if (u.InvoiceNumbers != null) d.InvoiceNumbers = u.InvoiceNumbers.Trim();
            if (u.Amount.HasValue) d.Amount = u.Amount;
            await _db.SaveChangesAsync();
            return Ok(DocDto(d));
        }

        [HttpDelete("documents/{id:int}")]
        [RequireModule("finance", AlsoAllowRoles = "Finance,Admin")]
        public async Task<IActionResult> DeleteDoc(int id)
        {
            var d = await _db.CreditNoteDocuments.FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            var full = Path.Combine(_root, d.StoragePath.Replace('/', Path.DirectorySeparatorChar));
            try { if (System.IO.File.Exists(full)) System.IO.File.Delete(full); } catch { /* keep the row delete going */ }
            _db.CreditNoteDocuments.Remove(d);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private static object DocDto(CreditNoteDocument d) => new
        {
            d.Id, d.CreditNoteNumber, d.Company, companyName = CompanyName(d.Company), d.CustomerNumber, d.CustomerName, d.InvoiceNumbers, d.Amount, d.Reason, d.Notes,
            d.SignedBy, d.SignedOn, d.OriginalFileName, d.ContentType, d.Size, d.UploadedBy, d.UploadedByName, d.UploadedAt,
            isPdf = (d.ContentType ?? "").Contains("pdf", StringComparison.OrdinalIgnoreCase) || d.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
        };
    }
}
