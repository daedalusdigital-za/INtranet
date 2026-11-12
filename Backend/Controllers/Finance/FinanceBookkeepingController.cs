using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers.Finance
{
    /// <summary>
    /// Book Keeping register — one row per sales invoice (Sage IN document), showing what we invoiced,
    /// whether it went out on a trip sheet (load), whether a POD has come back, and any credit note
    /// raised against it. This is the collection worklist: an invoice that was dispatched but has no
    /// POD is one Finance must chase before the customer disputes it.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/finance/bookkeeping")]
    [RequireModule("finance", AlsoAllowRoles = "Finance,Sales,Manager,Admin")]
    public class FinanceBookkeepingController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public FinanceBookkeepingController(ApplicationDbContext db) { _db = db; }

        private static string CompanyName(string? code) => code switch
        {
            "PMT" => "Promed Technologies", "ACM" => "Access Medical", "PHT" => "Promed Pharmatech", "SBT" => "Sebenzani Trading", _ => code ?? ""
        };

        /// <summary>
        /// status: all | needs-pod (dispatched, no POD) | has-pod | not-dispatched | credited
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> List(
            [FromQuery] string? company, [FromQuery] string? status, [FromQuery] string? search,
            [FromQuery] string? province, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 500);
            status = (status ?? "all").ToLowerInvariant();

            // ── Invoice headers (group IN lines by company + number) ───────────────────
            var lines = _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionType == "IN");
            if (!string.IsNullOrWhiteSpace(company)) lines = lines.Where(i => i.SourceCompany == company);
            if (from.HasValue) lines = lines.Where(i => i.TransactionDate >= from.Value.Date);
            if (to.HasValue) { var t = to.Value.Date.AddDays(1); lines = lines.Where(i => i.TransactionDate < t); }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                lines = lines.Where(i => i.TransactionNumber.Contains(s) || i.CustomerNumber.Contains(s) || i.CustomerName.Contains(s));
            }
            if (!string.IsNullOrWhiteSpace(province))
                lines = lines.Where(i => i.DeliveryProvince == province || (i.DeliveryProvince == null && i.Customer != null && i.Customer.Province == province));

            var headers = lines
                .GroupBy(i => new { i.SourceCompany, i.TransactionNumber })
                .Select(g => new
                {
                    g.Key.SourceCompany,
                    g.Key.TransactionNumber,
                    Date = g.Min(x => x.TransactionDate),
                    CustomerNumber = g.Min(x => x.CustomerNumber),
                    CustomerName = g.Min(x => x.CustomerName),
                    Province = g.Min(x => x.DeliveryProvince ?? (x.Customer != null ? x.Customer.Province : null)),
                    Amount = g.Sum(x => x.SalesAmount),
                    Lines = g.Count(),
                    LoadId = g.Max(x => x.LoadId),
                    InvoiceStatus = g.Max(x => x.Status),
                    FirstLineId = g.Min(x => x.Id),
                    PodLinked = g.Any(x => x.PodDocumentLinks.Any())
                });

            // Status filters that can be pushed to SQL
            switch (status)
            {
                case "not-dispatched": headers = headers.Where(h => h.LoadId == null); break;
                case "has-pod": headers = headers.Where(h => h.PodLinked); break;
                case "needs-pod": headers = headers.Where(h => h.LoadId != null && !h.PodLinked); break;
            }

            var total = await headers.CountAsync();
            var pageRows = await headers.OrderByDescending(h => h.Date).ThenByDescending(h => h.TransactionNumber)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            // ── Enrich: loads, PODs, credit notes ──────────────────────────────────────
            var loadIds = pageRows.Where(r => r.LoadId.HasValue).Select(r => r.LoadId!.Value).Distinct().ToList();
            var loads = await _db.Loads.AsNoTracking().Where(l => loadIds.Contains(l.Id))
                .Select(l => new { l.Id, l.LoadNumber, l.Status, l.ActualPickupDate, l.ScheduledPickupDate, l.ActualDeliveryDate })
                .ToDictionaryAsync(l => l.Id);
            var driverPods = await _db.ProofOfDeliveries.AsNoTracking().Where(p => loadIds.Contains(p.LoadId))
                .GroupBy(p => p.LoadId).Select(g => new { LoadId = g.Key, Date = g.Min(p => p.DeliveredAt) })
                .ToDictionaryAsync(x => x.LoadId, x => x.Date);

            var invNos = pageRows.Select(r => r.TransactionNumber).Distinct().ToList();
            var docPods = await _db.PodDocumentInvoiceLinks.AsNoTracking()
                .Where(l => l.PodDocument != null && (
                    (l.InvoiceId != null && l.Invoice != null && invNos.Contains(l.Invoice.TransactionNumber)) ||
                    (l.InvoiceId == null && l.InvoiceNumber != null && invNos.Contains(l.InvoiceNumber))))
                .Select(l => new
                {
                    Number = l.Invoice != null ? l.Invoice.TransactionNumber : l.InvoiceNumber!,
                    Company = l.Invoice != null ? l.Invoice.SourceCompany : null,
                    l.PodDocumentId, l.PodDocument!.DeliveryDate, l.PodDocument.FileName
                }).ToListAsync();

            // Credit notes: CR docs for same company+customer dated on/after the invoice (product overlap decides the link)
            var custKeys = pageRows.Select(r => new { r.SourceCompany, r.CustomerNumber }).Distinct().ToList();
            var custNos = custKeys.Select(k => k.CustomerNumber).Distinct().ToList();

            // Province fallback: other invoices for the same account, then the logistics customer record, then the master
            var missingProv = pageRows.Where(r => string.IsNullOrWhiteSpace(r.Province)).Select(r => r.CustomerNumber).Distinct().ToList();
            var provByCust = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (missingProv.Count > 0)
            {
                foreach (var x in await _db.ImportedInvoices.AsNoTracking()
                    .Where(i => missingProv.Contains(i.CustomerNumber) && i.DeliveryProvince != null && i.DeliveryProvince != "Unclassified")
                    .GroupBy(i => i.CustomerNumber).Select(g => new { g.Key, P = g.Max(i => i.DeliveryProvince) }).ToListAsync())
                    provByCust[x.Key] = x.P!;
                foreach (var x in await _db.LogisticsCustomers.AsNoTracking()
                    .Where(c => c.CustomerCode != null && missingProv.Contains(c.CustomerCode) && (c.DeliveryProvince ?? c.Province) != null)
                    .Select(c => new { Code = c.CustomerCode!, P = c.DeliveryProvince ?? c.Province }).ToListAsync())
                    provByCust.TryAdd(x.Code, x.P!);
                foreach (var x in await _db.CustomerAliases.AsNoTracking()
                    .Where(a => missingProv.Contains(a.CustomerCode) && a.Master != null && a.Master.Province != null)
                    .Select(a => new { a.CustomerCode, P = a.Master!.Province }).ToListAsync())
                    provByCust.TryAdd(x.CustomerCode, x.P!);
            }
            var minDate = pageRows.Count == 0 ? DateTime.UtcNow : pageRows.Min(r => r.Date);
            var crLines = await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionType == "CR" && custNos.Contains(i.CustomerNumber) && i.TransactionDate >= minDate)
                .Select(i => new { i.SourceCompany, i.CustomerNumber, i.TransactionNumber, i.TransactionDate, i.ProductCode, i.SalesAmount, i.SalesReturns })
                .ToListAsync();
            var invProducts = pageRows.Count == 0 ? new() : await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionType == "IN" && invNos.Contains(i.TransactionNumber))
                .Select(i => new { i.SourceCompany, i.TransactionNumber, i.ProductCode })
                .ToListAsync();
            var productsByInv = invProducts.GroupBy(x => (x.SourceCompany, x.TransactionNumber))
                .ToDictionary(g => g.Key, g => g.Select(x => x.ProductCode).ToHashSet());
            var crByCust = crLines.GroupBy(x => (x.SourceCompany, x.CustomerNumber))
                .ToDictionary(g => g.Key, g => g.GroupBy(c => c.TransactionNumber).Select(cg => new
                {
                    Number = cg.Key,
                    Date = cg.Min(c => c.TransactionDate),
                    Products = cg.Select(c => c.ProductCode).ToHashSet(),
                    Amount = cg.Sum(c => c.SalesReturns != 0 ? c.SalesReturns : Math.Abs(c.SalesAmount))
                }).ToList());

            var today = DateTime.UtcNow.Date;
            var rows = pageRows.Select(r =>
            {
                loads.TryGetValue(r.LoadId ?? -1, out var load);
                var pod = docPods.Where(p => p.Number == r.TransactionNumber && (p.Company == null || p.Company == r.SourceCompany))
                    .OrderBy(p => p.DeliveryDate).FirstOrDefault();
                DateTime? podDate = pod?.DeliveryDate;
                string podSource = pod != null ? "Scan" : "";
                if (podDate == null && r.LoadId.HasValue && driverPods.TryGetValue(r.LoadId.Value, out var dp)) { podDate = dp; podSource = "Driver"; }

                var prods = productsByInv.TryGetValue((r.SourceCompany, r.TransactionNumber), out var ps) ? ps : new HashSet<string>();
                var credits = crByCust.TryGetValue((r.SourceCompany, r.CustomerNumber), out var crs)
                    ? crs.Where(c => c.Date >= r.Date && c.Products.Overlaps(prods)).Select(c => new { c.Number, c.Date, c.Amount }).ToList()
                    : new();

                var dispatched = load?.ActualPickupDate ?? (load != null && load.Status != "Available" ? load.ScheduledPickupDate : null);
                var state = podDate != null ? "POD received"
                          : load != null ? "Needs POD"
                          : "Not dispatched";
                return new
                {
                    company = r.SourceCompany, companyName = CompanyName(r.SourceCompany),
                    date = r.Date, invoiceNumber = r.TransactionNumber, invoiceId = r.FirstLineId,
                    customerNumber = r.CustomerNumber, customerName = r.CustomerName,
                    province = !string.IsNullOrWhiteSpace(r.Province) ? r.Province : (provByCust.TryGetValue(r.CustomerNumber, out var pv) ? pv : null),
                    amount = r.Amount, lines = r.Lines,
                    loadId = r.LoadId, loadNumber = load?.LoadNumber, loadStatus = load?.Status, dispatchedAt = dispatched,
                    deliveredAt = load?.ActualDeliveryDate,
                    podDate, podSource, podDocumentId = pod?.PodDocumentId, podFileName = pod?.FileName,
                    creditNotes = credits, creditNoteNumbers = string.Join(", ", credits.Select(c => c.Number)),
                    creditTotal = credits.Sum(c => c.Amount),
                    state,
                    daysWaitingPod = state == "Needs POD" ? (today - (dispatched ?? r.Date).Date).Days : (int?)null
                };
            }).ToList();

            if (status == "credited") rows = rows.Where(r => r.creditNotes.Count > 0).ToList();

            return Ok(new { total, page, pageSize, rows });
        }

        /// <summary>Headline counts for the tab (per company) — what we invoiced, what went out, what still needs a POD.</summary>
        [HttpGet("summary")]
        public async Task<IActionResult> Summary([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var lines = _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionType == "IN");
            if (from.HasValue) lines = lines.Where(i => i.TransactionDate >= from.Value.Date);
            if (to.HasValue) { var t = to.Value.Date.AddDays(1); lines = lines.Where(i => i.TransactionDate < t); }

            var heads = await lines.GroupBy(i => new { i.SourceCompany, i.TransactionNumber })
                .Select(g => new
                {
                    g.Key.SourceCompany,
                    Amount = g.Sum(x => x.SalesAmount),
                    HasLoad = g.Max(x => x.LoadId) != null,
                    PodLinked = g.Any(x => x.PodDocumentLinks.Any()),
                    LoadId = g.Max(x => x.LoadId)
                }).ToListAsync();

            var loadIds = heads.Where(h => h.LoadId.HasValue).Select(h => h.LoadId!.Value).Distinct().ToList();
            var loadsWithDriverPod = (await _db.ProofOfDeliveries.AsNoTracking().Where(p => loadIds.Contains(p.LoadId)).Select(p => p.LoadId).Distinct().ToListAsync()).ToHashSet();

            var byCompany = heads.Where(h => !string.IsNullOrEmpty(h.SourceCompany)).GroupBy(h => h.SourceCompany!).Select(g =>
            {
                var hasPod = g.Count(h => h.PodLinked || (h.LoadId.HasValue && loadsWithDriverPod.Contains(h.LoadId.Value)));
                var dispatched = g.Count(h => h.HasLoad);
                return new
                {
                    company = g.Key, companyName = CompanyName(g.Key),
                    invoices = g.Count(), amount = g.Sum(h => h.Amount),
                    dispatched, notDispatched = g.Count(h => !h.HasLoad),
                    hasPod, needsPod = g.Count(h => h.HasLoad && !(h.PodLinked || (h.LoadId.HasValue && loadsWithDriverPod.Contains(h.LoadId.Value)))),
                    needsPodAmount = g.Where(h => h.HasLoad && !(h.PodLinked || (h.LoadId.HasValue && loadsWithDriverPod.Contains(h.LoadId.Value)))).Sum(h => h.Amount)
                };
            }).OrderBy(x => x.company).ToList();

            var provinces = await _db.ImportedInvoices.AsNoTracking().Where(i => i.DeliveryProvince != null)
                .Select(i => i.DeliveryProvince!).Distinct().OrderBy(p => p).ToListAsync();

            return Ok(new
            {
                invoices = byCompany.Sum(c => c.invoices), amount = byCompany.Sum(c => c.amount),
                dispatched = byCompany.Sum(c => c.dispatched), notDispatched = byCompany.Sum(c => c.notDispatched),
                hasPod = byCompany.Sum(c => c.hasPod), needsPod = byCompany.Sum(c => c.needsPod), needsPodAmount = byCompany.Sum(c => c.needsPodAmount),
                byCompany, provinces
            });
        }
    }
}
