using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class SalesHistoryController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SalesHistoryController> _logger;

        public SalesHistoryController(ApplicationDbContext context, ILogger<SalesHistoryController> logger)
        {
            _context = context;
            _logger = logger;
        }

        public class SalesHistoryRow
        {
            public int Id { get; set; }
            public string CustomerName { get; set; } = string.Empty;
            public string? CustomerNumber { get; set; }
            public string InvoiceNumber { get; set; } = string.Empty;
            public string? ShipmentNumber { get; set; }
            public string? OrderNumber { get; set; }
            public DateTime InvoiceDate { get; set; }
            public string? Location { get; set; }
            public decimal SalesAmount { get; set; }
            public decimal? TotalCost { get; set; }
            public decimal? GrossProfit { get; set; }
            public decimal? MarginPercent { get; set; }
            public bool HasLineDetail { get; set; }
            public string? SourceCompany { get; set; }
            public bool IsReconciled { get; set; }
        }

        public class SalesHistoryListResponse
        {
            public List<SalesHistoryRow> Items { get; set; } = new();
            public int TotalCount { get; set; }
            public decimal TotalAmount { get; set; }
            public decimal TotalGrossProfit { get; set; }
            public decimal? AvgMarginPercent { get; set; }
            public int DetailedCount { get; set; }
            public int CustomerCount { get; set; }
            public int InvoiceCount { get; set; }
            public DateTime? DateMin { get; set; }
            public DateTime? DateMax { get; set; }
            public int Page { get; set; }
            public int PageSize { get; set; }
        }

        /// <summary>
        /// Paged sales history with filters plus aggregate summary over the full filtered set.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<SalesHistoryListResponse>> GetSalesHistory(
            [FromQuery] string? search,
            [FromQuery] string? company,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] bool? detailedOnly,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 500) pageSize = 50;

            var query = _context.SalesHistoryRecords.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(company))
                query = query.Where(r => r.SourceCompany == company);

            if (detailedOnly == true)
                query = query.Where(r => r.HasLineDetail);

            if (fromDate.HasValue)
                query = query.Where(r => r.InvoiceDate >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(r => r.InvoiceDate <= toDate.Value);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(r =>
                    r.CustomerName.ToLower().Contains(s) ||
                    r.InvoiceNumber.ToLower().Contains(s) ||
                    (r.OrderNumber != null && r.OrderNumber.ToLower().Contains(s)) ||
                    (r.ShipmentNumber != null && r.ShipmentNumber.ToLower().Contains(s)));
            }

            var totalCount = await query.CountAsync();
            var totalAmount = totalCount == 0 ? 0m : await query.SumAsync(r => r.SalesAmount);
            var totalGrossProfit = totalCount == 0 ? 0m : await query.SumAsync(r => r.GrossProfit ?? 0m);
            var detailedCount = totalCount == 0 ? 0 : await query.CountAsync(r => r.HasLineDetail);
            decimal? avgMargin = detailedCount == 0 ? null : await query.Where(r => r.MarginPercent != null).AverageAsync(r => r.MarginPercent);
            var customerCount = totalCount == 0 ? 0 : await query.Select(r => r.CustomerName).Distinct().CountAsync();
            var invoiceCount = totalCount == 0 ? 0 : await query.Select(r => r.InvoiceNumber).Distinct().CountAsync();
            DateTime? dateMin = totalCount == 0 ? null : await query.MinAsync(r => (DateTime?)r.InvoiceDate);
            DateTime? dateMax = totalCount == 0 ? null : await query.MaxAsync(r => (DateTime?)r.InvoiceDate);

            var items = await query
                .OrderByDescending(r => r.InvoiceDate)
                .ThenByDescending(r => r.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new SalesHistoryRow
                {
                    Id = r.Id,
                    CustomerName = r.CustomerName,
                    CustomerNumber = r.CustomerNumber,
                    InvoiceNumber = r.InvoiceNumber,
                    ShipmentNumber = r.ShipmentNumber,
                    OrderNumber = r.OrderNumber,
                    InvoiceDate = r.InvoiceDate,
                    Location = r.Location,
                    SalesAmount = r.SalesAmount,
                    TotalCost = r.TotalCost,
                    GrossProfit = r.GrossProfit,
                    MarginPercent = r.MarginPercent,
                    HasLineDetail = r.HasLineDetail,
                    SourceCompany = r.SourceCompany,
                    IsReconciled = r.IsReconciled
                })
                .ToListAsync();

            return Ok(new SalesHistoryListResponse
            {
                Items = items,
                TotalCount = totalCount,
                TotalAmount = totalAmount,
                TotalGrossProfit = totalGrossProfit,
                AvgMarginPercent = avgMargin,
                DetailedCount = detailedCount,
                CustomerCount = customerCount,
                InvoiceCount = invoiceCount,
                DateMin = dateMin,
                DateMax = dateMax,
                Page = page,
                PageSize = pageSize
            });
        }

        /// <summary>
        /// Monthly rollup for charts, optionally filtered by company.
        /// </summary>
        [HttpGet("monthly")]
        public async Task<ActionResult<object>> GetMonthly([FromQuery] string? company)
        {
            var query = _context.SalesHistoryRecords.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(company))
                query = query.Where(r => r.SourceCompany == company);

            var monthly = await query
                .GroupBy(r => new { r.InvoiceDate.Year, r.InvoiceDate.Month })
                .Select(g => new
                {
                    g.Key.Year,
                    g.Key.Month,
                    Total = g.Sum(x => x.SalesAmount),
                    Count = g.Count()
                })
                .OrderBy(x => x.Year).ThenBy(x => x.Month)
                .ToListAsync();

            return Ok(monthly);
        }

        /// <summary>
        /// Product line-item detail for a single historical invoice (from the detailed report).
        /// </summary>
        [HttpGet("{id:int}/lines")]
        public async Task<ActionResult<object>> GetLines(int id)
        {
            var header = await _context.SalesHistoryRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == id);
            if (header == null) return NotFound();

            var lines = await _context.SalesHistoryLineItems.AsNoTracking()
                .Where(l => l.InvoiceNumber == header.InvoiceNumber
                            && l.SourceCompany == header.SourceCompany)
                .OrderByDescending(l => l.SalesAmount)
                .Select(l => new
                {
                    l.Id,
                    l.ItemCode,
                    l.Description,
                    l.Quantity,
                    l.UnitPrice,
                    l.SalesAmount,
                    l.UnitCost,
                    l.ExtCost,
                    GrossProfit = l.SalesAmount - l.ExtCost,
                    MarginPercent = l.SalesAmount != 0
                        ? Math.Round((l.SalesAmount - l.ExtCost) / l.SalesAmount * 100, 2)
                        : (decimal?)null,
                    l.ItemCategory,
                    Source = l.ImportBatchId == "LIVE_SALES" ? "Live Sales" : "Detail Report"
                })
                .ToListAsync();

            return Ok(lines);
        }

        /// <summary>
        /// Reconcile history against live ImportedInvoices by invoice number and
        /// report which historical days/invoices are missing from the live sales set.
        /// </summary>
        [HttpGet("reconcile")]
        public async Task<ActionResult<object>> Reconcile([FromQuery] string? company)
        {
            var histQuery = _context.SalesHistoryRecords.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(company))
                histQuery = histQuery.Where(r => r.SourceCompany == company);

            var liveNumbers = await _context.ImportedInvoices
                .AsNoTracking()
                .Select(i => i.TransactionNumber)
                .Distinct()
                .ToListAsync();
            var liveSet = new HashSet<string>(liveNumbers, StringComparer.OrdinalIgnoreCase);

            var hist = await histQuery
                .Select(r => new { r.InvoiceNumber, r.InvoiceDate, r.SalesAmount })
                .ToListAsync();

            var matched = hist.Count(h => liveSet.Contains(h.InvoiceNumber));
            var missing = hist.Where(h => !liveSet.Contains(h.InvoiceNumber)).ToList();

            var missingByMonth = missing
                .GroupBy(m => new { m.InvoiceDate.Year, m.InvoiceDate.Month })
                .Select(g => new
                {
                    g.Key.Year,
                    g.Key.Month,
                    MissingCount = g.Count(),
                    MissingAmount = g.Sum(x => x.SalesAmount)
                })
                .OrderBy(x => x.Year).ThenBy(x => x.Month)
                .ToList();

            return Ok(new
            {
                HistoryCount = hist.Count,
                MatchedCount = matched,
                MissingCount = missing.Count,
                MissingAmount = missing.Sum(m => m.SalesAmount),
                MissingByMonth = missingByMonth
            });
        }
    }
}
