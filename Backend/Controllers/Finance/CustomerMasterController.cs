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
    /// Customer master: one record per real customer, with aliases for each Sage account (company + code).
    /// Auto-mapping groups accounts whose normalised names match across companies; Finance/Sales can then
    /// merge or split by hand. The 360 endpoint rolls everything the group knows about a customer into one
    /// call: sales, open invoices (aging), credits, remittances, PODs, backorders and loads.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/customers/master")]
    [RequireModule("finance", AlsoAllowRoles = "Finance,Sales,Manager,Admin")]
    public class CustomerMasterController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public CustomerMasterController(ApplicationDbContext db) { _db = db; }

        private static readonly Dictionary<string, string> CompanyNames = new(StringComparer.OrdinalIgnoreCase)
        { ["PMT"] = "Promed Technologies", ["ACM"] = "Access Medical", ["PHT"] = "Promed Pharmatech", ["SBT"] = "Sebenzani Trading" };
        private static string CompanyName(string? code) => code != null && CompanyNames.TryGetValue(code, out var n) ? n : (code ?? "Unknown");
        private static string? CodeForName(string name) => CompanyNames.FirstOrDefault(kv => kv.Value.Equals(name, StringComparison.OrdinalIgnoreCase)).Key;

        private static readonly Regex Suffixes = new(@"\b(PTY|LTD|LIMITED|CC|INC|T/A|TA|PROPRIETARY|THE|\(PTY\)|NPC|SOC)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex NonAlnum = new(@"[^A-Z0-9 ]", RegexOptions.Compiled);
        private static readonly Regex Spaces = new(@"\s+", RegexOptions.Compiled);
        /// <summary>"St Mary's Hospital (Pty) Ltd" → "ST MARYS HOSPITAL"</summary>
        public static string Normalize(string? name)
        {
            var s = (name ?? "").ToUpperInvariant().Replace("&", " AND ");
            s = Suffixes.Replace(s, " ");
            s = NonAlnum.Replace(s, " ");
            return Spaces.Replace(s, " ").Trim();
        }

        // ───────────────────────────────────────────────────────────────── auto-map
        /// <summary>
        /// POST api/customers/master/auto-map — create masters + aliases for every Sage account not yet mapped.
        /// Accounts with the same normalised name (within or across companies) share a master. Safe to re-run.
        /// </summary>
        [HttpPost("auto-map")]
        public async Task<IActionResult> AutoMap()
        {
            var accounts = await DistinctAccountsAsync();
            var existing = await _db.CustomerAliases.Select(a => new { a.Company, a.CustomerCode }).ToListAsync();
            var have = existing.Select(a => $"{a.Company}|{a.CustomerCode}").ToHashSet(StringComparer.OrdinalIgnoreCase);
            var todo = accounts.Where(a => !have.Contains($"{a.company}|{a.code}")).ToList();
            if (todo.Count == 0) return Ok(new { created = 0, aliases = 0, message = "Every account is already mapped." });

            var masters = await _db.CustomerMasters.ToListAsync();
            var byNorm = masters.GroupBy(m => m.NormalizedName).ToDictionary(g => g.Key, g => g.First());
            int created = 0, aliases = 0;
            foreach (var grp in todo.GroupBy(a => Normalize(a.name)).Where(g => g.Key.Length > 0))
            {
                if (!byNorm.TryGetValue(grp.Key, out var master))
                {
                    var bestName = grp.GroupBy(a => a.name.Trim()).OrderByDescending(g => g.Sum(x => x.weight)).First().Key;
                    master = new CustomerMaster { Name = TitleCase(bestName), NormalizedName = grp.Key, Type = GuessType(grp.Key) };
                    _db.CustomerMasters.Add(master); byNorm[grp.Key] = master; created++;
                }
                foreach (var a in grp)
                {
                    master.Aliases.Add(new CustomerAlias { Company = a.company, CustomerCode = a.code, CustomerName = a.name.Trim(), Source = "Auto" });
                    aliases++;
                }
            }
            await _db.SaveChangesAsync();
            return Ok(new { created, aliases, totalMasters = await _db.CustomerMasters.CountAsync(), totalAliases = await _db.CustomerAliases.CountAsync() });
        }

        private record Account(string company, string code, string name, int weight);
        private async Task<List<Account>> DistinctAccountsAsync()
        {
            var inv = await _db.ImportedInvoices.AsNoTracking().Where(i => i.SourceCompany != null && i.CustomerNumber != "")
                .GroupBy(i => new { i.SourceCompany, i.CustomerNumber, i.CustomerName }).Select(g => new { g.Key.SourceCompany, g.Key.CustomerNumber, g.Key.CustomerName, n = g.Count() }).ToListAsync();
            var list = inv.Select(x => new Account(x.SourceCompany!, x.CustomerNumber, x.CustomerName, x.n)).ToList();

            var latest = await _db.ArAgingSnapshots.AsNoTracking().GroupBy(s => s.Company).Select(g => g.OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id).First()).ToListAsync();
            var snapCo = latest.ToDictionary(s => s.Id, s => CodeForName(s.Company) ?? s.Company);
            var ag = await _db.ArAgingItems.AsNoTracking().Where(i => latest.Select(s => s.Id).Contains(i.SnapshotId))
                .Select(i => new { i.SnapshotId, i.CustomerCode, i.CustomerName }).Distinct().ToListAsync();
            list.AddRange(ag.Select(a => new Account(snapCo[a.SnapshotId], a.CustomerCode, a.CustomerName, 1)));

            var bo = await _db.ImportedBackorders.AsNoTracking().Where(b => b.CustomerNo != "").Select(b => new { b.SourceCompany, b.CustomerNo, b.CustomerName }).Distinct().ToListAsync();
            list.AddRange(bo.Select(b => new Account(b.SourceCompany, b.CustomerNo, b.CustomerName, 1)));

            // one row per company+code, best (most frequent) name wins
            return list.GroupBy(a => (a.company.ToUpperInvariant(), a.code.Trim()), StringTupleComparer.Instance)
                .Select(g => new Account(g.Key.Item1, g.Key.Item2, g.OrderByDescending(x => x.weight).First().name, g.Sum(x => x.weight))).ToList();
        }
        private sealed class StringTupleComparer : IEqualityComparer<(string, string)>
        {
            public static readonly StringTupleComparer Instance = new();
            public bool Equals((string, string) a, (string, string) b) => string.Equals(a.Item1, b.Item1, StringComparison.OrdinalIgnoreCase) && string.Equals(a.Item2, b.Item2, StringComparison.OrdinalIgnoreCase);
            public int GetHashCode((string, string) t) => HashCode.Combine(t.Item1.ToUpperInvariant(), t.Item2.ToUpperInvariant());
        }
        private static string TitleCase(string s) => string.Join(' ', s.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w is "cc" or "dr" or "kzn" or "gp" or "doh" ? w.ToUpperInvariant() : char.ToUpperInvariant(w[0]) + w[1..]));
        private static string? GuessType(string norm) =>
            norm.Contains("HOSPITAL") || norm.Contains("HOSP") ? "Hospital" : norm.Contains("DEPOT") ? "Depot" : norm.Contains("PHARMACY") || norm.Contains("PHARM") ? "Pharmacy"
            : norm.Contains("CLINIC") || norm.Contains("CHC") ? "Clinic" : norm.Contains("MEDICAL") || norm.Contains("HEALTH") ? "Medical" : null;

        // ───────────────────────────────────────────────────────────────── list / resolve / crud
        /// <summary>GET api/customers/master?search=&page=&pageSize= — masters with alias counts and latest-aging exposure.</summary>
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 200);
            var q = _db.CustomerMasters.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(m => m.Name.Contains(s) || (m.Group != null && m.Group.Contains(s)) || m.Aliases.Any(a => a.CustomerCode.Contains(s) || (a.CustomerName != null && a.CustomerName.Contains(s))));
            }
            var total = await q.CountAsync();
            var items = await q.OrderBy(m => m.Name).Skip((page - 1) * pageSize).Take(pageSize)
                .Select(m => new { m.Id, m.Name, m.Group, m.Type, m.Province, aliases = m.Aliases.Select(a => new { a.Company, a.CustomerCode, a.CustomerName, a.Source }) })
                .ToListAsync();
            return Ok(new { total, page, pageSize, items });
        }

        /// <summary>GET api/customers/master/resolve?company=PMT&code=01-INK-001 — master for a Sage account (auto-creates a single-alias master if unmapped).</summary>
        [HttpGet("resolve")]
        public async Task<IActionResult> Resolve([FromQuery] string company, [FromQuery] string code)
        {
            if (string.IsNullOrWhiteSpace(company) || string.IsNullOrWhiteSpace(code)) return BadRequest(new { error = "company and code are required" });
            var co = (CodeForName(company) ?? company).ToUpperInvariant(); code = code.Trim();
            var alias = await _db.CustomerAliases.AsNoTracking().Include(a => a.Master).FirstOrDefaultAsync(a => a.Company == co && a.CustomerCode == code);
            if (alias != null) return Ok(new { id = alias.CustomerMasterId, alias.Master.Name, created = false });

            var name = await _db.ImportedInvoices.AsNoTracking().Where(i => i.SourceCompany == co && i.CustomerNumber == code).Select(i => i.CustomerName).FirstOrDefaultAsync()
                    ?? await _db.ArAgingItems.AsNoTracking().Where(i => i.CustomerCode == code).Select(i => i.CustomerName).FirstOrDefaultAsync()
                    ?? code;
            var norm = Normalize(name);
            var master = await _db.CustomerMasters.FirstOrDefaultAsync(m => m.NormalizedName == norm)
                         ?? new CustomerMaster { Name = TitleCase(name), NormalizedName = norm, Type = GuessType(norm) };
            if (master.Id == 0) _db.CustomerMasters.Add(master);
            master.Aliases.Add(new CustomerAlias { Company = co, CustomerCode = code, CustomerName = name, Source = "Auto" });
            await _db.SaveChangesAsync();
            return Ok(new { id = master.Id, master.Name, created = true });
        }

        public class MasterUpdate { public string? Name { get; set; } public string? Group { get; set; } public string? Type { get; set; } public string? Province { get; set; } public string? Notes { get; set; } public int? LogisticsCustomerId { get; set; } }
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] MasterUpdate u)
        {
            var m = await _db.CustomerMasters.FindAsync(id);
            if (m == null) return NotFound();
            if (!string.IsNullOrWhiteSpace(u.Name)) { m.Name = u.Name.Trim(); m.NormalizedName = Normalize(u.Name); }
            if (u.Group != null) m.Group = u.Group.Trim().Length == 0 ? null : u.Group.Trim();
            if (u.Type != null) m.Type = u.Type.Trim().Length == 0 ? null : u.Type.Trim();
            if (u.Province != null) m.Province = u.Province.Trim().Length == 0 ? null : u.Province.Trim();
            if (u.Notes != null) m.Notes = u.Notes.Trim();
            if (u.LogisticsCustomerId.HasValue) m.LogisticsCustomerId = u.LogisticsCustomerId == 0 ? null : u.LogisticsCustomerId;
            m.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { m.Id, m.Name, m.Group, m.Type, m.Province, m.Notes, m.LogisticsCustomerId });
        }

        /// <summary>POST api/customers/master/{id}/merge { fromIds: [..] } — fold other masters (and their aliases) into this one.</summary>
        public class MergeReq { public List<int> FromIds { get; set; } = new(); }
        [HttpPost("{id:int}/merge")]
        public async Task<IActionResult> Merge(int id, [FromBody] MergeReq req)
        {
            var target = await _db.CustomerMasters.FindAsync(id);
            if (target == null) return NotFound();
            var from = req.FromIds.Where(f => f != id).Distinct().ToList();
            var aliases = await _db.CustomerAliases.Where(a => from.Contains(a.CustomerMasterId)).ToListAsync();
            foreach (var a in aliases) { a.CustomerMasterId = id; a.Source = "Manual"; }
            var olds = await _db.CustomerMasters.Where(m => from.Contains(m.Id)).ToListAsync();
            _db.CustomerMasters.RemoveRange(olds);
            target.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { merged = olds.Count, aliasesMoved = aliases.Count });
        }

        /// <summary>POST api/customers/master/{id}/aliases { company, code } — move a Sage account onto this master (splitting it off wherever it was).</summary>
        public class AliasReq { public string Company { get; set; } = ""; public string Code { get; set; } = ""; }
        [HttpPost("{id:int}/aliases")]
        public async Task<IActionResult> MoveAlias(int id, [FromBody] AliasReq req)
        {
            if (!await _db.CustomerMasters.AnyAsync(m => m.Id == id)) return NotFound();
            var co = (CodeForName(req.Company) ?? req.Company).ToUpperInvariant(); var code = req.Code.Trim();
            var a = await _db.CustomerAliases.FirstOrDefaultAsync(x => x.Company == co && x.CustomerCode == code);
            int? oldMaster = a?.CustomerMasterId;
            if (a == null)
            {
                var name = await _db.ImportedInvoices.AsNoTracking().Where(i => i.SourceCompany == co && i.CustomerNumber == code).Select(i => i.CustomerName).FirstOrDefaultAsync() ?? code;
                a = new CustomerAlias { Company = co, CustomerCode = code, CustomerName = name };
                _db.CustomerAliases.Add(a);
            }
            a.CustomerMasterId = id; a.Source = "Manual";
            await _db.SaveChangesAsync();
            // Drop the old master if it's now empty
            if (oldMaster != null && oldMaster != id && !await _db.CustomerAliases.AnyAsync(x => x.CustomerMasterId == oldMaster))
            { var m = await _db.CustomerMasters.FindAsync(oldMaster.Value); if (m != null) { _db.CustomerMasters.Remove(m); await _db.SaveChangesAsync(); } }
            return Ok(new { a.Id, a.Company, a.CustomerCode, a.CustomerName, a.CustomerMasterId });
        }

        /// <summary>POST api/customers/master/split { company, code } — give one Sage account its own master (undo a wrong auto-match).</summary>
        [HttpPost("split")]
        public async Task<IActionResult> Split([FromBody] AliasReq req)
        {
            var co = (CodeForName(req.Company) ?? req.Company).ToUpperInvariant(); var code = req.Code.Trim();
            var a = await _db.CustomerAliases.FirstOrDefaultAsync(x => x.Company == co && x.CustomerCode == code);
            if (a == null) return NotFound(new { error = "That account isn't mapped." });
            var oldMaster = a.CustomerMasterId;
            var name = a.CustomerName ?? code;
            var master = new CustomerMaster { Name = TitleCase(name), NormalizedName = Normalize(name) + " #" + code, Type = GuessType(Normalize(name)) };
            _db.CustomerMasters.Add(master);
            await _db.SaveChangesAsync();
            a.CustomerMasterId = master.Id; a.Source = "Manual";
            await _db.SaveChangesAsync();
            if (!await _db.CustomerAliases.AnyAsync(x => x.CustomerMasterId == oldMaster))
            { var m = await _db.CustomerMasters.FindAsync(oldMaster); if (m != null) { _db.CustomerMasters.Remove(m); await _db.SaveChangesAsync(); } }
            return Ok(new { id = master.Id, master.Name });
        }

        // ───────────────────────────────────────────────────────────────── 360
        /// <summary>GET api/customers/master/{id}/360 — everything about one customer across all four companies.</summary>
        [HttpGet("{id:int}/360")]
        public async Task<IActionResult> View360(int id)
        {
            var m = await _db.CustomerMasters.AsNoTracking().Include(x => x.Aliases).FirstOrDefaultAsync(x => x.Id == id);
            if (m == null) return NotFound();
            var codes = m.Aliases.Select(a => a.CustomerCode).Distinct().ToList();
            var pairs = m.Aliases.Select(a => $"{a.Company}|{a.CustomerCode}").ToHashSet(StringComparer.OrdinalIgnoreCase);
            var today = DateTime.UtcNow.Date;

            // ── Sales (Sage history) ──
            var tx = await _db.ImportedInvoices.AsNoTracking().Where(i => codes.Contains(i.CustomerNumber) && i.SourceCompany != null)
                .Select(i => new { i.SourceCompany, i.CustomerNumber, i.TransactionNumber, i.TransactionDate, i.SalesAmount, i.CostOfSales, i.Quantity, i.ProductCode, i.ProductDescription, i.LoadId })
                .ToListAsync();
            tx = tx.Where(t => pairs.Contains($"{t.SourceCompany}|{t.CustomerNumber}")).ToList();
            var invTx = tx.Where(t => t.TransactionNumber.StartsWith("IN", StringComparison.OrdinalIgnoreCase)).ToList();
            var cnTx = tx.Where(t => t.TransactionNumber.StartsWith("CN", StringComparison.OrdinalIgnoreCase)).ToList();
            var m12 = new DateTime(today.Year, today.Month, 1).AddMonths(-11);
            var salesTrend = invTx.Where(t => t.TransactionDate >= m12).GroupBy(t => new { t.TransactionDate.Year, t.TransactionDate.Month })
                .Select(g => new { month = $"{g.Key.Year}-{g.Key.Month:00}", value = g.Sum(x => x.SalesAmount), cost = g.Sum(x => x.CostOfSales), invoices = g.Select(x => x.TransactionNumber).Distinct().Count(), credits = cnTx.Where(c => c.TransactionDate.Year == g.Key.Year && c.TransactionDate.Month == g.Key.Month).Sum(c => -c.SalesAmount) })
                .OrderBy(x => x.month).ToList();
            var lifetimeSales = invTx.Sum(t => t.SalesAmount);
            var lifetimeCredits = cnTx.Sum(t => -t.SalesAmount);
            var last12Sales = invTx.Where(t => t.TransactionDate >= m12).Sum(t => t.SalesAmount);
            var topProducts = invTx.Where(t => t.TransactionDate >= today.AddMonths(-12)).GroupBy(t => new { t.ProductCode, t.ProductDescription })
                .Select(g => new { g.Key.ProductCode, g.Key.ProductDescription, qty = g.Sum(x => x.Quantity), value = g.Sum(x => x.SalesAmount) })
                .OrderByDescending(x => x.value).Take(10).ToList();
            var recentInvoices = invTx.GroupBy(t => new { t.TransactionNumber, t.SourceCompany })
                .Select(g => new { number = g.Key.TransactionNumber, company = g.Key.SourceCompany, date = g.Min(x => x.TransactionDate), value = g.Sum(x => x.SalesAmount), lines = g.Count(), loadId = g.Select(x => x.LoadId).FirstOrDefault(x => x != null) })
                .OrderByDescending(x => x.date).Take(15).ToList();

            // ── Open invoices (latest aging per company) ──
            var latest = await _db.ArAgingSnapshots.AsNoTracking().GroupBy(s => s.Company).Select(g => g.OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id).First()).ToListAsync();
            var snapCo = latest.ToDictionary(s => s.Id, s => (code: CodeForName(s.Company) ?? s.Company, name: s.Company, asOf: s.AsOfDate));
            var aging = await _db.ArAgingItems.AsNoTracking().Where(i => latest.Select(s => s.Id).Contains(i.SnapshotId) && codes.Contains(i.CustomerCode))
                .Select(i => new { i.SnapshotId, i.CustomerCode, i.DocumentNumber, i.DocumentType, i.DocumentDate, i.DueDate, i.Balance, i.AgeDays, i.Bucket, i.PoNumber, i.OrderNumber })
                .ToListAsync();
            aging = aging.Where(a => pairs.Contains($"{snapCo[a.SnapshotId].code}|{a.CustomerCode}")).ToList();
            var openInvNos = aging.Where(a => a.DocumentType == "IN").Select(a => a.DocumentNumber).Distinct().ToList();
            var podSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (openInvNos.Count > 0)
            {
                var l1 = await _db.PodDocumentInvoiceLinks.AsNoTracking().Where(l => (l.InvoiceNumber != null && openInvNos.Contains(l.InvoiceNumber)) || (l.Invoice != null && openInvNos.Contains(l.Invoice.TransactionNumber))).Select(l => l.InvoiceNumber ?? l.Invoice!.TransactionNumber).ToListAsync();
                var l2 = await _db.ImportedInvoices.AsNoTracking().Where(i => openInvNos.Contains(i.TransactionNumber) && i.LoadId != null && _db.ProofOfDeliveries.Any(p => p.LoadId == i.LoadId)).Select(i => i.TransactionNumber).Distinct().ToListAsync();
                foreach (var n in l1.Concat(l2)) podSet.Add(n);
            }
            var podStart = await FinanceAlertsController.PodStartAsync(_db);
            var openInvoices = aging.Where(a => a.DocumentType == "IN" && a.Balance != 0).Select(a => new
            {
                company = snapCo[a.SnapshotId].name, companyCode = snapCo[a.SnapshotId].code, a.DocumentNumber, a.DocumentDate, a.DueDate, a.Balance, a.AgeDays, a.Bucket, a.PoNumber, a.OrderNumber,
                hasPod = podSet.Contains(a.DocumentNumber), disputeRisk = a.AgeDays >= FinanceAlertsController.NoPodAfterDays && !podSet.Contains(a.DocumentNumber) && a.DocumentDate >= podStart
            }).OrderByDescending(a => a.AgeDays).ToList();
            var openCredits = aging.Where(a => a.DocumentType == "CR" || a.DocumentType == "CN").Select(a => new { company = snapCo[a.SnapshotId].name, a.DocumentNumber, a.DocumentDate, balance = -a.Balance, a.AgeDays }).ToList();
            var unapplied = aging.Where(a => a.DocumentType is "PY" or "PI" or "UC").Select(a => new { company = snapCo[a.SnapshotId].name, a.DocumentNumber, a.DocumentType, a.DocumentDate, balance = -a.Balance }).ToList();
            var buckets = new decimal[5];
            foreach (var a in aging) buckets[Math.Min(4, (int)a.Bucket)] += a.Balance;

            // ── Credits ──
            var cnNums = cnTx.Select(c => c.TransactionNumber).Distinct().ToList();
            var signed = (await _db.CreditNoteDocuments.AsNoTracking().Where(d => cnNums.Contains(d.CreditNoteNumber)).Select(d => new { d.Company, d.CreditNoteNumber, d.Reason }).ToListAsync())
                .ToDictionary(d => $"{d.Company}|{d.CreditNoteNumber}", d => d.Reason, StringComparer.OrdinalIgnoreCase);
            var returns = await _db.StockReturns.AsNoTracking().Where(r => cnNums.Contains(r.CreditNoteNumber)).Select(r => new { r.Company, r.CreditNoteNumber, r.Status, r.ReturnType }).ToListAsync();
            var credits = cnTx.GroupBy(t => new { t.TransactionNumber, t.SourceCompany }).Select(g => new
            {
                number = g.Key.TransactionNumber, company = g.Key.SourceCompany, date = g.Min(x => x.TransactionDate), value = -g.Sum(x => x.SalesAmount), lines = g.Count(),
                hasSignedCopy = signed.ContainsKey($"{g.Key.SourceCompany}|{g.Key.TransactionNumber}"),
                reason = signed.TryGetValue($"{g.Key.SourceCompany}|{g.Key.TransactionNumber}", out var r) ? r : null,
                stockReturn = returns.FirstOrDefault(x => x.Company == g.Key.SourceCompany && x.CreditNoteNumber == g.Key.TransactionNumber)
            }).OrderByDescending(x => x.date).Take(25).ToList();
            var creditReasons = signed.Values.Where(v => !string.IsNullOrEmpty(v)).GroupBy(v => v!).Select(g => new { reason = g.Key, count = g.Count() }).OrderByDescending(x => x.count).ToList();

            // ── Remittances ──
            var names = m.Aliases.Select(a => a.CustomerName).Where(n => !string.IsNullOrEmpty(n)).Distinct().ToList();
            var remits = await _db.RemittanceEmails.AsNoTracking()
                .Where(r => (r.CustomerCode != null && codes.Contains(r.CustomerCode)) || (r.CustomerName != null && names.Contains(r.CustomerName)))
                .OrderByDescending(r => r.ReceivedAt).Take(15)
                .Select(r => new { r.Id, r.Subject, r.FromEmail, r.ReceivedAt, r.TotalAmount, r.MatchedBalance, r.InvoiceCount, r.MatchedCount, r.Status })
                .ToListAsync();

            // ── PODs (last 12 months of this customer's invoices) ──
            var recentInvNos = invTx.Where(t => t.TransactionDate >= today.AddMonths(-12)).Select(t => t.TransactionNumber).Distinct().ToList();
            var podLinks = recentInvNos.Count == 0 ? new() : await _db.PodDocumentInvoiceLinks.AsNoTracking()
                .Where(l => (l.InvoiceNumber != null && recentInvNos.Contains(l.InvoiceNumber)) || (l.Invoice != null && recentInvNos.Contains(l.Invoice.TransactionNumber)))
                .Select(l => new { invoice = l.InvoiceNumber ?? l.Invoice!.TransactionNumber, l.PodDocumentId, l.LinkedAt, driver = l.PodDocument!.DriverName, deliveryDate = l.PodDocument.DeliveryDate })
                .OrderByDescending(l => l.LinkedAt).Take(20).ToListAsync();
            var podCoverage = recentInvNos.Count == 0 ? 0 : Math.Round(100.0 * podLinks.Select(p => p.invoice).Distinct().Count() / recentInvNos.Count, 0);

            // ── Backorders ──
            var backorders = (await _db.ImportedBackorders.AsNoTracking().Where(b => codes.Contains(b.CustomerNo))
                .Select(b => new { b.SourceCompany, b.CustomerNo, b.OrderNumber, b.OrderDate, b.PoNo, b.ItemDesc, b.QtyBackOrder, b.UnitPrice, b.ExtPrice, b.Location, b.ImportedAt }).ToListAsync())
                .Where(b => pairs.Contains($"{b.SourceCompany}|{b.CustomerNo}")).ToList();

            // ── Loads ──
            var loadIds = tx.Where(t => t.LoadId != null).Select(t => t.LoadId!.Value).Distinct().ToList();
            var loadQ = _db.Loads.AsNoTracking().Where(l => loadIds.Contains(l.Id) || (m.LogisticsCustomerId != null && l.CustomerId == m.LogisticsCustomerId));
            var loads = await loadQ.OrderByDescending(l => l.ScheduledPickupDate ?? l.CreatedAt).Take(15)
                .Select(l => new { l.Id, l.LoadNumber, l.Status, l.ScheduledPickupDate, l.ActualDeliveryDate, l.DeliveryLocation, hasPod = _db.ProofOfDeliveries.Any(p => p.LoadId == l.Id), invoices = _db.ImportedInvoices.Where(i => i.LoadId == l.Id).Select(i => i.TransactionNumber).Distinct().Count() })
                .ToListAsync();

            return Ok(new
            {
                master = new { m.Id, m.Name, m.Group, m.Type, m.Province, m.Notes, m.LogisticsCustomerId, aliases = m.Aliases.Select(a => new { a.Id, company = a.Company, companyName = CompanyName(a.Company), a.CustomerCode, a.CustomerName, a.Source }) },
                sales = new { lifetime = lifetimeSales, last12 = last12Sales, lifetimeCredits, creditPct = lifetimeSales == 0 ? 0 : Math.Round(lifetimeCredits / lifetimeSales * 100, 2), firstInvoice = invTx.Count == 0 ? (DateTime?)null : invTx.Min(t => t.TransactionDate), lastInvoice = invTx.Count == 0 ? (DateTime?)null : invTx.Max(t => t.TransactionDate), invoiceCount = invTx.Select(t => t.TransactionNumber).Distinct().Count(), trend = salesTrend, topProducts, recentInvoices,
                    byCompany = invTx.GroupBy(t => t.SourceCompany).Select(g => new { code = g.Key, company = CompanyName(g.Key), value = g.Sum(x => x.SalesAmount), invoices = g.Select(x => x.TransactionNumber).Distinct().Count() }) },
                exposure = new { total = aging.Sum(a => a.Balance), current = buckets[0], d30 = buckets[1], d60 = buckets[2], d90 = buckets[3], d120 = buckets[4], openInvoices, openCredits, unapplied, agingAsOf = snapCo.Values.Select(v => (DateTime?)v.asOf).DefaultIfEmpty(null).Min(), disputeRisk = openInvoices.Count(o => o.disputeRisk), disputeRiskValue = openInvoices.Where(o => o.disputeRisk).Sum(o => o.Balance) },
                credits = new { count = cnNums.Count, value = lifetimeCredits, unsigned = credits.Count(c => !c.hasSignedCopy), reasons = creditReasons, items = credits },
                remittances = remits,
                pods = new { coveragePct = podCoverage, invoicesLast12 = recentInvNos.Count, linked = podLinks },
                backorders = new { count = backorders.Count, value = backorders.Sum(b => b.ExtPrice), items = backorders.OrderByDescending(b => b.OrderDate).Take(25) },
                loads
            });
        }
    }
}
