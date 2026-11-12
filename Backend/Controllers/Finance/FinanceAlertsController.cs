using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers.Finance
{
    /// <summary>
    /// Control-gap alerts for Finance and Sales. Everything here is derived — nothing is stored — so the
    /// alert disappears the moment the underlying gap is closed (aging re-imported, PDF uploaded, POD linked,
    /// return confirmed).
    ///   • Stale aging: a company's latest debtors snapshot is older than 7 days (amber) / 14 days (red) or missing.
    ///   • Unsigned credits: a CN posted in Sage more than 5 days ago with no signed authorisation uploaded.
    ///   • Disputed-pattern invoices: open on the aging for 60+ days and no POD linked — the classic
    ///     "we never received it" collection dispute, where a POD is the only thing that wins the argument.
    ///   • Pending stock returns raised from Return/Damaged credits that the branch hasn't confirmed.
    ///   • Unmapped customers: Sage accounts not yet rolled up to a master customer.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/finance/alerts")]
    [RequireModule("finance", AlsoAllowRoles = "Finance,Sales,Manager,Admin")]
    public class FinanceAlertsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public FinanceAlertsController(ApplicationDbContext db) { _db = db; }

        public const int StaleAmberDays = 7, StaleRedDays = 14, UnsignedAfterDays = 5, NoPodAfterDays = 60;
        private static readonly string[] Companies = { "Promed Technologies", "Access Medical", "Promed Pharmatech", "Sebenzani Trading" };
        private static string Code(string company) => company switch
        {
            "Promed Technologies" => "PMT", "Access Medical" => "ACM", "Promed Pharmatech" => "PHT", "Sebenzani Trading" => "SBT", _ => company
        };

        /// <summary>Date POD capture started (earliest POD scan or driver POD). Invoices before this can't be expected to have one.</summary>
        public static async Task<DateTime> PodStartAsync(ApplicationDbContext db)
        {
            var a = await db.PodDocuments.AsNoTracking().MinAsync(p => (DateTime?)p.DeliveryDate);
            var b = await db.ProofOfDeliveries.AsNoTracking().MinAsync(p => (DateTime?)p.DeliveredAt);
            var d = new[] { a, b }.Where(x => x.HasValue).Select(x => x!.Value).DefaultIfEmpty(DateTime.UtcNow.AddYears(-1)).Min();
            return d.Date;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] int top = 15)
        {
            top = Math.Clamp(top, 5, 100);
            var today = DateTime.UtcNow.Date;

            // ── 1. Aging staleness per company ───────────────────────────────────────────
            var latest = await _db.ArAgingSnapshots.AsNoTracking()
                .GroupBy(s => s.Company).Select(g => g.OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id).First())
                .ToListAsync();
            var staleness = Companies.Select(c =>
            {
                var s = latest.FirstOrDefault(x => x.Company == c);
                var days = s == null ? (int?)null : (today - s.AsOfDate.Date).Days;
                return new
                {
                    company = c, code = Code(c), snapshotId = s?.Id, asOf = s?.AsOfDate, uploadedAt = s?.UploadedAt, days,
                    level = s == null ? "missing" : days > StaleRedDays ? "red" : days > StaleAmberDays ? "amber" : "ok",
                    totalBalance = s?.TotalBalance ?? 0m
                };
            }).ToList();

            // ── 2. Credit notes >5 days old with no signed copy ──────────────────────────
            var cutoff = today.AddDays(-UnsignedAfterDays);
            var lookback = today.AddDays(-365); // older than a year is history, not an action item
            var recentCns = await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionNumber.StartsWith("CN") && i.TransactionDate >= lookback && i.TransactionDate < cutoff)
                .GroupBy(i => new { i.TransactionNumber, i.SourceCompany, i.CustomerNumber, i.CustomerName })
                .Select(g => new { number = g.Key.TransactionNumber, company = g.Key.SourceCompany, g.Key.CustomerNumber, g.Key.CustomerName, date = g.Min(x => x.TransactionDate), value = -g.Sum(x => x.SalesAmount) })
                .ToListAsync();
            var signedKeys = (await _db.CreditNoteDocuments.AsNoTracking().Select(d => new { d.Company, d.CreditNoteNumber }).ToListAsync())
                .Select(d => $"{d.Company}|{d.CreditNoteNumber}").ToHashSet(StringComparer.OrdinalIgnoreCase);
            var unsigned = recentCns.Where(c => !signedKeys.Contains($"{c.company}|{c.number}") && c.value > 0)
                .OrderByDescending(c => c.value).ToList();

            // ── 3. Invoices 60+ days on the aging with no POD ────────────────────────────
            // Only invoices dated after POD capture started count — older ones never had the chance to get one.
            var podStart = await PodStartAsync(_db);
            var latestIds = latest.Select(s => s.Id).ToList();
            var snapCompany = latest.ToDictionary(s => s.Id, s => s.Company);
            var oldOpen = await _db.ArAgingItems.AsNoTracking()
                .Where(i => latestIds.Contains(i.SnapshotId) && i.DocumentType == "IN" && i.Balance > 0 && i.AgeDays >= NoPodAfterDays && i.DocumentDate != null && i.DocumentDate >= podStart)
                .Select(i => new { i.SnapshotId, i.CustomerCode, i.CustomerName, i.DocumentNumber, i.DocumentDate, i.Balance, i.AgeDays, i.PoNumber })
                .ToListAsync();
            var invNos = oldOpen.Select(i => i.DocumentNumber).Distinct().ToList();
            var withPod = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (invNos.Count > 0)
            {
                // Linked POD scans
                var viaLinks = await _db.PodDocumentInvoiceLinks.AsNoTracking()
                    .Where(l => (l.InvoiceNumber != null && invNos.Contains(l.InvoiceNumber)) || (l.Invoice != null && invNos.Contains(l.Invoice.TransactionNumber)))
                    .Select(l => l.InvoiceNumber ?? l.Invoice!.TransactionNumber).ToListAsync();
                foreach (var n in viaLinks) withPod.Add(n);
                // Driver POD captured on the load the invoice went out on
                var viaLoad = await _db.ImportedInvoices.AsNoTracking()
                    .Where(i => invNos.Contains(i.TransactionNumber) && i.LoadId != null && _db.ProofOfDeliveries.Any(p => p.LoadId == i.LoadId))
                    .Select(i => i.TransactionNumber).Distinct().ToListAsync();
                foreach (var n in viaLoad) withPod.Add(n);
            }
            var noPod = oldOpen.Where(i => !withPod.Contains(i.DocumentNumber))
                .Select(i => new { company = snapCompany[i.SnapshotId], code = Code(snapCompany[i.SnapshotId]), i.CustomerCode, i.CustomerName, i.DocumentNumber, i.DocumentDate, i.Balance, i.AgeDays, i.PoNumber })
                .OrderByDescending(i => i.Balance).ToList();

            // ── 4. Pending stock returns ─────────────────────────────────────────────────
            var pendingReturns = await _db.StockReturns.AsNoTracking().Where(r => r.Status == "Pending")
                .Select(r => new { r.Id, r.CreditNoteNumber, r.Company, r.CustomerName, r.ReturnType, r.CreatedAt, lines = r.Lines.Count, qty = r.Lines.Sum(l => l.Quantity) })
                .OrderBy(r => r.CreatedAt).ToListAsync();

            // ── 5. Unmapped Sage accounts ────────────────────────────────────────────────
            var mapped = await _db.CustomerAliases.AsNoTracking().Select(a => a.Company + "|" + a.CustomerCode).ToListAsync();
            var mappedSet = mapped.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var allAccounts = await _db.ImportedInvoices.AsNoTracking().Where(i => i.SourceCompany != null)
                .Select(i => new { i.SourceCompany, i.CustomerNumber }).Distinct().ToListAsync();
            var unmapped = allAccounts.Count(a => !mappedSet.Contains($"{a.SourceCompany}|{a.CustomerNumber}"));

            var staleCount = staleness.Count(s => s.level != "ok");
            return Ok(new
            {
                generatedAt = DateTime.UtcNow,
                thresholds = new { staleAmberDays = StaleAmberDays, staleRedDays = StaleRedDays, unsignedAfterDays = UnsignedAfterDays, noPodAfterDays = NoPodAfterDays, podCaptureSince = podStart },
                total = staleCount + unsigned.Count + noPod.Count + pendingReturns.Count,
                aging = new { stale = staleCount, companies = staleness },
                unsignedCredits = new { count = unsigned.Count, value = unsigned.Sum(u => u.value), items = unsigned.Take(top) },
                noPodInvoices = new
                {
                    count = noPod.Count, value = noPod.Sum(i => i.Balance),
                    byCompany = noPod.GroupBy(i => i.company).Select(g => new { company = g.Key, count = g.Count(), value = g.Sum(x => x.Balance) }),
                    items = noPod.Take(top)
                },
                pendingReturns = new { count = pendingReturns.Count, items = pendingReturns.Take(top) },
                customers = new { total = allAccounts.Count, unmapped, masters = await _db.CustomerMasters.CountAsync() }
            });
        }
    }
}
