using System.Globalization;
using System.Security.Claims;
using System.Text;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance;

namespace ProjectTracker.API.Controllers.Finance
{
    /// <summary>
    /// Debtors' age analysis. Finance uploads the Sage "Customer Transaction" aging workbook for a
    /// company; we keep every open document as a snapshot and present it as a readable aging:
    /// one row per customer with Current / 30 / 60 / 90 / 120+ buckets, drill-down to the documents,
    /// and intranet enrichment (does the invoice have a POD on file?).
    /// Buckets are aged on document date, 30-day periods, like the Sage Aged Trial Balance.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/finance/aging")]
    [RequireModule("finance", AlsoAllowRoles = "Finance")]
    public class FinanceAgingController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<FinanceAgingController> _logger;
        public FinanceAgingController(ApplicationDbContext db, ILogger<FinanceAgingController> logger) { _db = db; _logger = logger; }

        private int UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

        public static readonly string[] Companies = { "Access Medical", "Promed Technologies", "Promed Pharmatech", "Sebenzani Trading" };
        private static readonly string[] BucketLabels = { "Current", "30 days", "60 days", "90 days", "120+ days" };

        // ------------------------------------------------------------------ snapshots

        /// <summary>GET api/finance/aging/snapshots → all uploaded snapshots, newest first, plus the company list.</summary>
        [HttpGet("snapshots")]
        public async Task<IActionResult> Snapshots()
        {
            var rows = await _db.ArAgingSnapshots.AsNoTracking()
                .OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.Id)
                .Select(s => new { s.Id, s.Company, s.AsOfDate, s.SourceFileName, s.UploadedAt, s.UploadedBy, s.CustomerCount, s.DocumentCount, s.TotalBalance, s.Notes })
                .ToListAsync();
            var ids = rows.Select(r => r.UploadedBy).Distinct().ToList();
            var users = await _db.Users.AsNoTracking().Where(u => ids.Contains(u.UserId)).Select(u => new { Id = u.UserId, u.Name, u.Surname }).ToListAsync();
            return Ok(new
            {
                companies = Companies,
                snapshots = rows.Select(r => new
                {
                    r.Id, r.Company, r.AsOfDate, r.SourceFileName, r.UploadedAt, r.CustomerCount, r.DocumentCount, r.TotalBalance, r.Notes,
                    uploadedBy = users.Where(u => u.Id == r.UploadedBy).Select(u => (u.Name + " " + u.Surname).Trim()).FirstOrDefault()
                })
            });
        }

        /// <summary>DELETE api/finance/aging/snapshots/{id}</summary>
        [HttpDelete("snapshots/{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var s = await _db.ArAgingSnapshots.FindAsync(id);
            if (s == null) return NotFound();
            _db.ArAgingSnapshots.Remove(s);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ------------------------------------------------------------------ import

        /// <summary>
        /// POST api/finance/aging/import (multipart: file, company, asOfDate?) → parses the Sage
        /// "Customer Transaction" sheet. asOfDate defaults to the latest document date in the file.
        /// </summary>
        [HttpPost("import")]
        [RequestSizeLimit(60_000_000)]
        public async Task<IActionResult> Import([FromForm] IFormFile file, [FromForm] string company, [FromForm] DateTime? asOfDate, [FromForm] string? notes)
        {
            if (file == null || file.Length == 0) return BadRequest(new { message = "Choose the aging workbook (.xlsx) exported from Sage." });
            if (string.IsNullOrWhiteSpace(company)) return BadRequest(new { message = "Choose which company this aging is for." });
            if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Only .xlsx workbooks are supported." });

            List<ArAgingItem> items;
            try
            {
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                ms.Position = 0;
                items = ParseCustomerTransactions(ms);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Aging import failed to parse {File}", file.FileName);
                return BadRequest(new { message = "Couldn't read this workbook as a Sage aging report: " + ex.Message });
            }
            if (items.Count == 0) return BadRequest(new { message = "No customer documents were found. The workbook needs the 'Customer Transaction' sheet with Document Number/Type, Doc date, Due date, Days over, Transaction amount and Balance columns." });

            var dated = items.Where(i => i.DocumentDate.HasValue).ToList();
            if (asOfDate == null && dated.Count == 0) return BadRequest(new { message = "Documents were found but none had a readable document date. Check the Doc. Date column format, or supply the as-of date." });
            var asOf = (asOfDate ?? dated.Max(i => i.DocumentDate!.Value)).Date;
            foreach (var i in items)
            {
                var basis = i.DocumentDate ?? asOf;
                i.AgeDays = Math.Max(0, (asOf - basis.Date).Days);
                i.Bucket = BucketFor(i.AgeDays);
            }

            var snap = new ArAgingSnapshot
            {
                Company = company.Trim(), AsOfDate = asOf, SourceFileName = file.FileName, UploadedBy = UserId, UploadedAt = DateTime.UtcNow,
                CustomerCount = items.Select(i => i.CustomerCode).Distinct().Count(), DocumentCount = items.Count, TotalBalance = items.Sum(i => i.Balance),
                Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim()
            };
            snap.Items = items;
            _db.ArAgingSnapshots.Add(snap);
            await _db.SaveChangesAsync();
            _logger.LogInformation("Aging snapshot {Id} imported for {Company}: {Docs} docs, {Cust} customers, R{Total}", snap.Id, snap.Company, snap.DocumentCount, snap.CustomerCount, snap.TotalBalance);
            return Ok(new { snap.Id, snap.Company, snap.AsOfDate, snap.CustomerCount, snap.DocumentCount, snap.TotalBalance });
        }

        private static byte BucketFor(int ageDays) => ageDays <= 30 ? (byte)0 : ageDays <= 60 ? (byte)1 : ageDays <= 90 ? (byte)2 : ageDays <= 120 ? (byte)3 : (byte)4;

        /// <summary>
        /// Reads the "Customer Transaction" sheet: a header row, then blocks of
        /// [CustomerCode, CustomerName] followed by document rows and a "Customer Total:" row.
        /// Column order: Doc no | Type | Order | PO | Doc date | Due date (or receipt ref) | Batch | Days over | Amount | Balance.
        /// Tolerant of header position and of the type legend / report total at the end.
        /// </summary>
        internal static List<ArAgingItem> ParseCustomerTransactions(Stream xlsx)
        {
            using var wb = new XLWorkbook(xlsx);
            var ws = wb.Worksheets.FirstOrDefault(w => w.Name.Trim().StartsWith("Customer", StringComparison.OrdinalIgnoreCase))
                     ?? wb.Worksheets.First();

            var items = new List<ArAgingItem>();
            string? custCode = null, custName = null;
            var knownTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "IN", "CR", "DB", "IT", "PI", "UC", "MC", "AD", "CF", "CT", "DF", "DT", "ED", "GL", "PY", "WO", "RD", "RF" };

            foreach (var row in ws.RowsUsed())
            {
                var c = new string?[11];
                for (var i = 1; i <= 10; i++) c[i] = CellText(row.Cell(i));
                var first = c[1]?.Trim();
                if (string.IsNullOrEmpty(first)) continue;
                if (first.StartsWith("Document Number", StringComparison.OrdinalIgnoreCase)) continue;
                if (first.StartsWith("Customer Total", StringComparison.OrdinalIgnoreCase) || first.StartsWith("Report Total", StringComparison.OrdinalIgnoreCase)) continue;
                if (first.Contains("customers printed", StringComparison.OrdinalIgnoreCase) || first.StartsWith("CR:", StringComparison.Ordinal)) continue;

                var type = c[2]?.Trim();
                if (!string.IsNullOrEmpty(type) && knownTypes.Contains(type) && custCode != null)
                {
                    var isDoc = type.Equals("IN", StringComparison.OrdinalIgnoreCase) || type.Equals("CR", StringComparison.OrdinalIgnoreCase) || type.Equals("DB", StringComparison.OrdinalIgnoreCase) || type.Equals("IT", StringComparison.OrdinalIgnoreCase);
                    var due = ParseDate(c[6]);
                    items.Add(new ArAgingItem
                    {
                        CustomerCode = custCode, CustomerName = custName ?? custCode,
                        DocumentNumber = first, DocumentType = type.ToUpperInvariant(),
                        OrderNumber = Trunc(c[3], 50), PoNumber = Trunc(c[4], 100),
                        DocumentDate = ParseDate(c[5]),
                        DueDate = isDoc ? due : null,
                        Reference = isDoc ? null : Trunc(c[6], 100),
                        BatchEntry = Trunc(c[7], 50),
                        DaysOver = int.TryParse(c[8], NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : (int?)null,
                        Amount = ParseMoney(c[9]), Balance = ParseMoney(c[10])
                    });
                    continue;
                }

                // Customer header: code in col 1 (e.g. 01-ADD-001), name in col 2, nothing else.
                if (!string.IsNullOrWhiteSpace(c[2]) && string.IsNullOrWhiteSpace(c[5]) && string.IsNullOrWhiteSpace(c[9]) && string.IsNullOrWhiteSpace(c[10]))
                {
                    custCode = Trunc(first, 50)!; custName = Trunc(c[2]!.Trim(), 255);
                }
            }
            return items;
        }

        private static string? CellText(IXLCell cell)
        {
            if (cell.IsEmpty()) return null;
            if (cell.DataType == XLDataType.DateTime) return cell.GetDateTime().ToString("dd/MM/yyyy");
            if (cell.DataType == XLDataType.Number) return cell.GetDouble().ToString(CultureInfo.InvariantCulture);
            return cell.GetString();
        }
        private static string? Trunc(string? s, int n) { s = s?.Trim(); return string.IsNullOrEmpty(s) ? null : (s.Length > n ? s[..n] : s); }
        private static DateTime? ParseDate(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            s = s.Trim();
            if (DateTime.TryParseExact(s, new[] { "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yyyy HH:mm:ss", "yyyy/MM/dd", "yyyy/M/d", "yyyy-MM-dd HH:mm:ss", "yyyy/MM/dd HH:mm:ss" }, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return d.Date;
            // Excel serial stored as text/number (e.g. "46175")
            if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var serial) && serial > 20000 && serial < 80000) return DateTime.FromOADate(serial).Date;
            return null;
        }
        private static decimal ParseMoney(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0m;
            s = s.Replace("R", "").Replace(",", "").Replace(" ", "").Trim();
            if (s.StartsWith("(") && s.EndsWith(")")) s = "-" + s[1..^1];
            return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? Math.Round(v, 2) : 0m;
        }

        // ------------------------------------------------------------------ the aging

        /// <summary>
        /// GET api/finance/aging/snapshots/{id} → the aging: totals per bucket, one row per customer,
        /// customers sorted by balance. ?search= filters customers; ?minBucket=3 only customers with 90+/120+ exposure.
        /// </summary>
        [HttpGet("snapshots/{id:int}")]
        public async Task<IActionResult> Aging(int id, [FromQuery] string? search, [FromQuery] int? minBucket)
        {
            var snap = await _db.ArAgingSnapshots.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
            if (snap == null) return NotFound();

            var q = _db.ArAgingItems.AsNoTracking().Where(i => i.SnapshotId == id);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(i => i.CustomerName.Contains(s) || i.CustomerCode.Contains(s) || i.DocumentNumber.Contains(s) || (i.PoNumber != null && i.PoNumber.Contains(s)) || (i.OrderNumber != null && i.OrderNumber.Contains(s)));
            }
            var items = await q.Select(i => new { i.CustomerCode, i.CustomerName, i.DocumentType, i.DocumentNumber, i.Bucket, i.Balance, i.DaysOver, i.DueDate }).ToListAsync();

            // Province per customer: delivery province on their invoices → logistics customer record → customer master.
            var codes = items.Select(i => i.CustomerCode).Distinct().ToList();
            var provByCode = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var coCode = snap.Company switch { "Promed Technologies" => "PMT", "Access Medical" => "ACM", "Promed Pharmatech" => "PHT", "Sebenzani Trading" => "SBT", _ => snap.Company };
            foreach (var x in await _db.ImportedInvoices.AsNoTracking()
                .Where(i => codes.Contains(i.CustomerNumber) && i.DeliveryProvince != null && i.DeliveryProvince != "Unclassified" && (i.SourceCompany == coCode || i.SourceCompany == null))
                .GroupBy(i => i.CustomerNumber).Select(g => new { g.Key, P = g.Max(i => i.DeliveryProvince) }).ToListAsync())
                provByCode[x.Key] = x.P!;
            foreach (var x in await _db.LogisticsCustomers.AsNoTracking()
                .Where(c => c.CustomerCode != null && codes.Contains(c.CustomerCode) && (c.DeliveryProvince ?? c.Province) != null)
                .Select(c => new { Code = c.CustomerCode!, P = c.DeliveryProvince ?? c.Province }).ToListAsync())
                provByCode.TryAdd(x.Code, x.P!);
            foreach (var x in await _db.CustomerAliases.AsNoTracking()
                .Where(a => a.Company == coCode && codes.Contains(a.CustomerCode) && a.Master != null && a.Master.Province != null)
                .Select(a => new { a.CustomerCode, P = a.Master!.Province }).ToListAsync())
                provByCode.TryAdd(x.CustomerCode, x.P!);

            var customers = items.GroupBy(i => i.CustomerCode).Select(g =>
            {
                var b = new decimal[5];
                foreach (var i in g) b[i.Bucket] += i.Balance;
                var invoices = g.Where(i => i.DocumentType == "IN").ToList();
                return new
                {
                    code = g.Key,
                    name = g.First().CustomerName,
                    province = provByCode.TryGetValue(g.Key, out var pv) ? pv : null,
                    current = b[0], d30 = b[1], d60 = b[2], d90 = b[3], d120 = b[4],
                    balance = b.Sum(),
                    overdue = invoices.Where(i => (i.DaysOver ?? 0) > 0).Sum(i => i.Balance),
                    maxDaysOver = invoices.Count == 0 ? 0 : invoices.Max(i => i.DaysOver ?? 0),
                    documents = g.Count(),
                    invoices = invoices.Count,
                    credits = g.Count(i => i.DocumentType != "IN" && i.Balance < 0),
                    oldestBucket = g.Where(i => i.Balance > 0).Select(i => (int)i.Bucket).DefaultIfEmpty(0).Max()
                };
            })
            .Where(c => !minBucket.HasValue || c.oldestBucket >= minBucket.Value)
            .OrderByDescending(c => c.balance).ToList();

            var totals = new decimal[5];
            foreach (var c in customers) { totals[0] += c.current; totals[1] += c.d30; totals[2] += c.d60; totals[3] += c.d90; totals[4] += c.d120; }
            var grand = totals.Sum();

            return Ok(new
            {
                snapshot = new { snap.Id, snap.Company, snap.AsOfDate, snap.SourceFileName, snap.UploadedAt, snap.CustomerCount, snap.DocumentCount, snap.TotalBalance, snap.Notes },
                buckets = BucketLabels.Select((l, i) => new { index = i, label = l, amount = totals[i], pct = grand == 0 ? 0 : Math.Round(totals[i] / grand * 100, 1) }),
                total = grand,
                overdue = customers.Sum(c => c.overdue),
                provinces = customers.Select(c => c.province).Where(p => p != null).Distinct().OrderBy(p => p).ToList(),
                customers
            });
        }

        /// <summary>GET api/finance/aging/snapshots/{id}/customers/{code} → the open documents for one customer, with POD-on-file flag for invoices.</summary>
        [HttpGet("snapshots/{id:int}/customers/{code}")]
        public async Task<IActionResult> Customer(int id, string code)
        {
            var items = await _db.ArAgingItems.AsNoTracking().Where(i => i.SnapshotId == id && i.CustomerCode == code)
                .OrderBy(i => i.DocumentDate).ThenBy(i => i.DocumentNumber).ToListAsync();
            if (items.Count == 0) return NotFound();

            var invNos = items.Where(i => i.DocumentType == "IN").Select(i => i.DocumentNumber).Distinct().ToList();
            var podNos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (invNos.Count > 0)
            {
                var viaLinks = await _db.PodDocumentInvoiceLinks.AsNoTracking()
                    .Where(l => (l.InvoiceNumber != null && invNos.Contains(l.InvoiceNumber)) || (l.Invoice != null && invNos.Contains(l.Invoice.TransactionNumber)))
                    .Select(l => l.InvoiceNumber ?? l.Invoice!.TransactionNumber).ToListAsync();
                foreach (var n in viaLinks) podNos.Add(n);
                var viaPods = await _db.PodDocuments.AsNoTracking().Where(p => p.Invoice != null && invNos.Contains(p.Invoice.TransactionNumber)).Select(p => p.Invoice!.TransactionNumber).ToListAsync();
                foreach (var n in viaPods) podNos.Add(n);
            }
            var importedIds = invNos.Count == 0 ? new Dictionary<string, int>() :
                await _db.ImportedInvoices.AsNoTracking().Where(x => invNos.Contains(x.TransactionNumber)).GroupBy(x => x.TransactionNumber).Select(g => new { g.Key, Id = g.Min(x => x.Id) }).ToDictionaryAsync(x => x.Key, x => x.Id);

            var b = new decimal[5];
            foreach (var i in items) b[i.Bucket] += i.Balance;
            return Ok(new
            {
                code, name = items[0].CustomerName,
                buckets = BucketLabels.Select((l, i) => new { index = i, label = l, amount = b[i] }),
                balance = b.Sum(),
                items = items.Select(i => new
                {
                    i.Id, i.DocumentNumber, i.DocumentType, typeLabel = TypeLabel(i.DocumentType), i.OrderNumber, i.PoNumber, i.DocumentDate, i.DueDate, i.Reference, i.BatchEntry,
                    i.DaysOver, i.Amount, i.Balance, i.AgeDays, i.Bucket, bucketLabel = BucketLabels[i.Bucket],
                    hasPod = i.DocumentType == "IN" && podNos.Contains(i.DocumentNumber),
                    importedInvoiceId = importedIds.TryGetValue(i.DocumentNumber, out var iid) ? iid : (int?)null
                })
            });
        }

        /// <summary>
        /// GET api/finance/aging/invoice/{number}?company= → everything we know about one invoice for the pop-up:
        /// Sage lines (products, qty, value), trip sheet / load, PODs, credit notes against it, and the aging row.
        /// </summary>
        [HttpGet("invoice/{number}")]
        public async Task<IActionResult> Invoice(string number, [FromQuery] string? company, [FromQuery] int? snapshotId)
        {
            var coCode = company switch { "Promed Technologies" => "PMT", "Access Medical" => "ACM", "Promed Pharmatech" => "PHT", "Sebenzani Trading" => "SBT", _ => company };
            var allLines = await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionNumber == number)
                .OrderBy(i => i.Id)
                .Select(i => new { i.Id, i.SourceCompany, i.CustomerNumber, i.CustomerName, i.TransactionDate, i.ProductCode, i.ProductDescription, i.Brand, i.Quantity, i.SalesAmount, i.CostOfSales, i.LoadId, i.Status, i.DeliveryAddress, i.DeliveryCity, i.DeliveryProvince, i.ContactPerson, i.ContactPhone, i.DeliveredQuantity, i.LastDeliveryDate })
                .ToListAsync();
            // Prefer the requested company, but fall back to whichever company Sage filed it under
            // (invoices do occasionally sit on one company's aging while captured under another).
            var lines = coCode != null && allLines.Any(l => l.SourceCompany == coCode)
                ? allLines.Where(l => l.SourceCompany == coCode).ToList()
                : allLines;

            var head = lines.FirstOrDefault();
            var loadId = lines.Select(l => l.LoadId).FirstOrDefault(l => l != null);
            var load = loadId == null ? null : await _db.Loads.AsNoTracking().Where(l => l.Id == loadId)
                .Select(l => new { l.Id, l.LoadNumber, l.Status, l.ScheduledPickupDate, l.ActualPickupDate, l.ScheduledDeliveryDate, l.ActualDeliveryDate }).FirstOrDefaultAsync();
            var driverPods = loadId == null ? new() : await _db.ProofOfDeliveries.AsNoTracking().Where(p => p.LoadId == loadId)
                .Select(p => new { p.Id, p.DeliveredAt, p.FileName }).ToListAsync();
            var scanPods = await _db.PodDocumentInvoiceLinks.AsNoTracking()
                .Where(l => l.PodDocument != null && ((l.Invoice != null && l.Invoice.TransactionNumber == number) || l.InvoiceNumber == number))
                .Select(l => new { l.PodDocumentId, l.PodDocument!.DeliveryDate, l.PodDocument.FileName, l.LinkedAt }).Distinct().ToListAsync();

            // Credit notes: same company+customer, dated on/after, sharing a product
            var products = lines.Select(l => l.ProductCode).ToHashSet();
            var credits = head == null ? new() : (await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionType == "CR" && i.SourceCompany == head.SourceCompany && i.CustomerNumber == head.CustomerNumber && i.TransactionDate >= head.TransactionDate)
                .Select(i => new { i.TransactionNumber, i.TransactionDate, i.ProductCode, i.SalesAmount, i.SalesReturns }).ToListAsync())
                .GroupBy(c => c.TransactionNumber).Where(g => g.Any(c => products.Contains(c.ProductCode)))
                .Select(g => new { number = g.Key, date = g.Min(c => c.TransactionDate), value = g.Sum(c => c.SalesReturns != 0 ? c.SalesReturns : Math.Abs(c.SalesAmount)) }).ToList();

            var agingQ = _db.ArAgingItems.AsNoTracking().Where(a => a.DocumentNumber == number)
                .OrderByDescending(a => a.SnapshotId)
                .Select(a => new { a.SnapshotId, a.CustomerCode, a.CustomerName, a.DocumentDate, a.DueDate, a.Amount, a.Balance, a.AgeDays, a.DaysOver, a.Bucket, a.PoNumber, a.OrderNumber, a.Reference });
            var aging = snapshotId.HasValue ? await agingQ.Where(a => a.SnapshotId == snapshotId.Value).FirstOrDefaultAsync() : null;
            aging ??= await agingQ.FirstOrDefaultAsync();

            if (head == null && aging == null) return NotFound();
            return Ok(new
            {
                number,
                company = head?.SourceCompany ?? coCode,
                customerNumber = head?.CustomerNumber ?? aging?.CustomerCode,
                customerName = head?.CustomerName ?? aging?.CustomerName,
                date = head?.TransactionDate ?? aging?.DocumentDate,
                total = lines.Sum(l => l.SalesAmount),
                cost = lines.Sum(l => l.CostOfSales),
                quantity = lines.Sum(l => l.Quantity),
                status = head?.Status,
                delivery = head == null ? null : new { head.DeliveryAddress, head.DeliveryCity, head.DeliveryProvince, head.ContactPerson, head.ContactPhone },
                lines = lines.Select(l => new { l.ProductCode, l.ProductDescription, l.Brand, l.Quantity, l.SalesAmount, l.CostOfSales, l.DeliveredQuantity }),
                load, driverPods, scanPods, credits,
                aging = aging == null ? null : new { aging.SnapshotId, aging.DocumentDate, aging.DueDate, aging.Amount, aging.Balance, aging.AgeDays, aging.DaysOver, aging.Bucket, bucketLabel = BucketLabels[aging.Bucket], aging.PoNumber, aging.OrderNumber, aging.Reference },
                inSage = head != null
            });
        }

        private static string TypeLabel(string t) => t switch
        {
            "IN" => "Invoice", "CR" => "Credit note", "DB" => "Debit note", "IT" => "Interest", "PI" => "Prepayment", "UC" => "Unapplied cash",
            "MC" => "Misc. receipt", "AD" => "Adjustment", "PY" => "Receipt", "WO" => "Write-off", "RF" => "Refund", "ED" => "Discount", "RD" => "Rounding", _ => t
        };

        /// <summary>GET api/finance/aging/snapshots/{id}/export → CSV of the customer aging (opens in Excel).</summary>
        [HttpGet("snapshots/{id:int}/export")]
        public async Task<IActionResult> Export(int id)
        {
            var snap = await _db.ArAgingSnapshots.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
            if (snap == null) return NotFound();
            var items = await _db.ArAgingItems.AsNoTracking().Where(i => i.SnapshotId == id).ToListAsync();
            var sb = new StringBuilder();
            sb.AppendLine($"{snap.Company} - Debtors age analysis as at {snap.AsOfDate:dd MMM yyyy}");
            sb.AppendLine("Code,Customer,Current,30 days,60 days,90 days,120+ days,Balance,Overdue,Max days over");
            foreach (var g in items.GroupBy(i => i.CustomerCode).OrderBy(g => g.First().CustomerName))
            {
                var b = new decimal[5]; foreach (var i in g) b[i.Bucket] += i.Balance;
                var over = g.Where(i => i.DocumentType == "IN" && (i.DaysOver ?? 0) > 0).Sum(i => i.Balance);
                var max = g.Where(i => i.DocumentType == "IN").Select(i => i.DaysOver ?? 0).DefaultIfEmpty(0).Max();
                sb.AppendLine($"{Csv(g.Key)},{Csv(g.First().CustomerName)},{b[0]:F2},{b[1]:F2},{b[2]:F2},{b[3]:F2},{b[4]:F2},{b.Sum():F2},{over:F2},{max}");
            }
            var t = new decimal[5]; foreach (var i in items) t[i.Bucket] += i.Balance;
            sb.AppendLine($",TOTAL,{t[0]:F2},{t[1]:F2},{t[2]:F2},{t[3]:F2},{t[4]:F2},{t.Sum():F2},,");
            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray(), "text/csv", $"Aging-{snap.Company.Replace(' ', '_')}-{snap.AsOfDate:yyyyMMdd}.csv");
        }
        private static string Csv(string? s) => s == null ? "" : "\"" + s.Replace("\"", "\"\"") + "\"";
    }
}
