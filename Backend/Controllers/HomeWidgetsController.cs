using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Requisitions;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Small, pre-aggregated feeds for the business widgets on Home (payment tracker, currency,
    /// sales graph, sales vs stock). Each endpoint returns exactly what one widget paints so Home
    /// stays light no matter how many people add them.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/home/widgets")]
    public class HomeWidgetsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IHttpClientFactory _http;
        private readonly IMemoryCache _cache;
        private readonly ILogger<HomeWidgetsController> _log;

        public HomeWidgetsController(ApplicationDbContext db, IHttpClientFactory http, IMemoryCache cache, ILogger<HomeWidgetsController> log)
        {
            _db = db; _http = http; _cache = cache; _log = log;
        }

        private static DateTime SaNow()
        {
            try { return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("South Africa Standard Time")); }
            catch
            {
                try { return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Africa/Johannesburg")); }
                catch { return DateTime.UtcNow.AddHours(2); }
            }
        }

        // ── Payment tracker (creditors pipeline) ──────────────────────────────────────────────

        /// <summary>
        /// The creditors pipeline as a stepper: Received → Matched → Approval queue → Payment schedule → Paid.
        /// "Received" and "Matched" come from the Books uploads (every supplier invoice that lands); the
        /// approval and payment stages come from the requisition-invoice workflow. Matching is name-based:
        /// a supplier is "known" when it has a supplier account or has been seen on an earlier invoice.
        /// </summary>
        [HttpGet("payment-tracker")]
        [RequireModule("finance", AlsoAllowRoles = "Finance")]
        public async Task<IActionResult> PaymentTracker()
        {
            var now = SaNow();
            var monthStart = new DateTime(now.Year, now.Month, 1);
            var weekEnd = now.Date.AddDays(7);

            // Books: lightweight projection only.
            var books = await _db.BookInvoices.AsNoTracking()
                .Select(b => new { b.Id, b.SupplierName, b.SupplierAccount, b.Status, b.Total, b.InvoiceDate, b.CreatedAt, b.PaymentDate, b.CompanyName })
                .ToListAsync();

            // Supplier directory = every supplier we've seen, with how many invoices and whether it has an account.
            var directory = books
                .GroupBy(b => (b.SupplierName ?? "").Trim().ToLowerInvariant())
                .Where(g => g.Key.Length > 0)
                .ToDictionary(g => g.Key, g => new { Count = g.Count(), HasAccount = g.Any(x => !string.IsNullOrWhiteSpace(x.SupplierAccount)) });

            bool IsKnown(string? name)
            {
                var k = (name ?? "").Trim().ToLowerInvariant();
                if (k.Length == 0 || k.Contains("unknown") || k == "supplier" || k == "n/a") return false;   // placeholder from the uploader
                return directory.TryGetValue(k, out var d) && (d.HasAccount || d.Count > 1);
            }

            var received = books.Where(b => b.Status == "Draft" || b.Status == "Pending").ToList();
            var unmatched = received.Where(b => !IsKnown(b.SupplierName)).ToList();
            var matched = received.Where(b => IsKnown(b.SupplierName)).ToList();
            var booksRequested = books.Where(b => b.Status == "Payment Requested").ToList();

            // Requisition workflow.
            var reqs = await _db.RequisitionInvoices.AsNoTracking()
                .Where(r => r.State == "Active" || r.State == "OnHold" || r.State == "Returned" || r.State == "Paid")
                .Select(r => new { r.Id, r.ReferenceNumber, r.SupplierName, r.Amount, r.Stage, r.State, r.DueDate, r.PaidDate, r.StageEnteredAt, r.InvoiceNumber })
                .ToListAsync();

            var active = reqs.Where(r => r.State == "Active" || r.State == "OnHold" || r.State == "Returned").ToList();
            var approvalStages = new HashSet<string> { RequisitionWorkflow.AwaitingAccountantApproval, RequisitionWorkflow.AwaitingFinanceApproval, RequisitionWorkflow.AwaitingLeonaReview, RequisitionWorkflow.AwaitingDuranApproval };
            var scheduleStages = new HashSet<string> { RequisitionWorkflow.AwaitingPaymentPreparation, RequisitionWorkflow.AwaitingNashPayment };

            var reconciling = active.Where(r => r.Stage == RequisitionWorkflow.Draft || r.Stage == RequisitionWorkflow.AwaitingReconciliation).ToList();
            var inApproval = active.Where(r => approvalStages.Contains(r.Stage)).ToList();
            var scheduled = active.Where(r => scheduleStages.Contains(r.Stage)).ToList();
            var paidThisMonth = reqs.Where(r => r.State == "Paid" && r.PaidDate.HasValue && r.PaidDate.Value >= monthStart).ToList();
            var booksPaidThisMonth = books.Where(b => b.Status == "Archived" && b.PaymentDate.HasValue && b.PaymentDate.Value >= monthStart).ToList();

            var overdue = scheduled.Where(r => r.DueDate.HasValue && r.DueDate.Value.Date < now.Date).ToList();
            var dueThisWeek = scheduled.Where(r => r.DueDate.HasValue && r.DueDate.Value.Date >= now.Date && r.DueDate.Value.Date <= weekEnd).ToList();
            var onHold = active.Count(r => r.State == "OnHold");
            var returned = active.Count(r => r.State == "Returned");
            var stuck = inApproval.Where(r => (now - r.StageEnteredAt.AddHours(2)).TotalDays >= 3).ToList();

            static object Row(string reference, string? supplier, decimal amount, string? detail) => new { reference, supplier, amount, detail };
            static string Rand(decimal v) => "R" + Math.Round(v).ToString("N0", CultureInfo.InvariantCulture);

            var steps = new object[]
            {
                new
                {
                    key = "received", title = "Received", icon = "inbox",
                    count = received.Count, amount = received.Sum(b => b.Total),
                    detail = received.Count == 0 ? "Nothing waiting" : $"{received.Count(b => b.CreatedAt >= now.Date.AddDays(-1))} new since yesterday",
                    tone = "info", route = "/books",
                    items = received.OrderByDescending(b => b.CreatedAt).Take(5).Select(b => Row(b.InvoiceDate.ToString("d MMM"), b.SupplierName, b.Total, b.CompanyName)).ToList()
                },
                new
                {
                    key = "matched", title = "Auto-matched", icon = "join_inner",
                    count = matched.Count + reconciling.Count, amount = matched.Sum(b => b.Total) + reconciling.Sum(r => r.Amount),
                    detail = unmatched.Count > 0 ? $"{unmatched.Count} new supplier{(unmatched.Count == 1 ? "" : "s")} to confirm" : "All suppliers recognised",
                    tone = unmatched.Count > 0 ? "warn" : "ok", route = "/finance/creditors",
                    unmatched = unmatched.Count,
                    items = unmatched.OrderByDescending(b => b.CreatedAt).Take(5).Select(b => Row("New supplier", b.SupplierName, b.Total, b.InvoiceDate.ToString("d MMM"))).ToList()
                },
                new
                {
                    key = "approval", title = "Approval queue", icon = "approval",
                    count = inApproval.Count + booksRequested.Count, amount = inApproval.Sum(r => r.Amount) + booksRequested.Sum(b => b.Total),
                    detail = stuck.Count > 0 ? $"{stuck.Count} waiting 3+ days" : onHold + returned > 0 ? $"{onHold} on hold · {returned} returned" : "Moving",
                    tone = stuck.Count > 0 ? "danger" : onHold + returned > 0 ? "warn" : "ok", route = "/finance?tab=approvals&section=requisitions",
                    stuck = stuck.Count, onHold, returned,
                    byStage = approvalStages.Select(s => new { stage = s, title = RequisitionWorkflow.Stages.TryGetValue(s, out var d) ? d.Title : s, count = inApproval.Count(r => r.Stage == s) }).Where(x => x.count > 0).ToList(),
                    items = inApproval.OrderBy(r => r.StageEnteredAt).Take(5).Select(r => Row(r.ReferenceNumber ?? r.InvoiceNumber ?? $"#{r.Id}", r.SupplierName, r.Amount, RequisitionWorkflow.Stages.TryGetValue(r.Stage, out var d) ? d.Title : r.Stage)).ToList()
                },
                new
                {
                    key = "schedule", title = "Payment schedule", icon = "event_available",
                    count = scheduled.Count, amount = scheduled.Sum(r => r.Amount),
                    detail = overdue.Count > 0 ? $"{overdue.Count} overdue · {Rand(dueThisWeek.Sum(r => r.Amount))} due this week" : dueThisWeek.Count > 0 ? $"{Rand(dueThisWeek.Sum(r => r.Amount))} due this week" : "Nothing due this week",
                    tone = overdue.Count > 0 ? "danger" : "info", route = "/finance/payments",
                    overdue = overdue.Count, dueThisWeek = dueThisWeek.Count,
                    items = scheduled.OrderBy(r => r.DueDate ?? DateTime.MaxValue).Take(5).Select(r => Row(r.ReferenceNumber ?? $"#{r.Id}", r.SupplierName, r.Amount, r.DueDate.HasValue ? $"due {r.DueDate.Value:d MMM}" : "no due date")).ToList()
                },
                new
                {
                    key = "paid", title = "Paid this month", icon = "paid",
                    count = paidThisMonth.Count + booksPaidThisMonth.Count, amount = paidThisMonth.Sum(r => r.Amount) + booksPaidThisMonth.Sum(b => b.Total),
                    detail = now.ToString("MMMM"), tone = "ok", route = "/finance?tab=invoices",
                    items = paidThisMonth.OrderByDescending(r => r.PaidDate).Take(5).Select(r => Row(r.ReferenceNumber ?? $"#{r.Id}", r.SupplierName, r.Amount, r.PaidDate.HasValue ? $"paid {r.PaidDate.Value:d MMM}" : null)).ToList()
                }
            };

            return Ok(new { asOf = now, steps });
        }

        // ── Currency ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Rand against the major currencies, today vs the previous business day. Rates come from the
        /// ECB via frankfurter.app (free, no key) and are cached for an hour; if the internet is down the
        /// last good answer is served with <c>stale=true</c>.
        /// </summary>
        [HttpGet("currency")]
        public async Task<IActionResult> Currency([FromQuery] string? symbols)
        {
            var wanted = (symbols ?? "USD,EUR,GBP").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => s.ToUpperInvariant()).Where(s => s.Length == 3 && s != "ZAR").Distinct().Take(6).ToList();
            if (wanted.Count == 0) wanted = new List<string> { "USD", "EUR", "GBP" };
            var key = "home.currency." + string.Join(",", wanted);

            if (_cache.TryGetValue(key, out object? cached) && cached != null) return Ok(cached);

            try
            {
                var client = _http.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                var to = string.Join(",", wanted);
                // Latest and the day before (frankfurter rolls weekends/holidays back to the last published day).
                var latestJson = await client.GetStringAsync($"https://api.frankfurter.app/latest?from=ZAR&to={to}");
                using var latest = JsonDocument.Parse(latestJson);
                var latestDate = DateTime.Parse(latest.RootElement.GetProperty("date").GetString()!, CultureInfo.InvariantCulture);
                var prevJson = await client.GetStringAsync($"https://api.frankfurter.app/{latestDate.AddDays(-1):yyyy-MM-dd}?from=ZAR&to={to}");
                using var prev = JsonDocument.Parse(prevJson);
                var prevDate = DateTime.Parse(prev.RootElement.GetProperty("date").GetString()!, CultureInfo.InvariantCulture);

                var rates = wanted.Select(code =>
                {
                    var perRandNow = latest.RootElement.GetProperty("rates").TryGetProperty(code, out var a) ? a.GetDecimal() : 0m;
                    var perRandPrev = prev.RootElement.GetProperty("rates").TryGetProperty(code, out var b) ? b.GetDecimal() : 0m;
                    var now = perRandNow > 0 ? Math.Round(1 / perRandNow, 4) : 0m;   // rand per 1 unit of foreign currency
                    var before = perRandPrev > 0 ? Math.Round(1 / perRandPrev, 4) : 0m;
                    return new
                    {
                        code,
                        name = CurrencyName(code),
                        symbol = CurrencySymbol(code),
                        rand = now,
                        previous = before,
                        change = before > 0 ? Math.Round(now - before, 4) : 0m,
                        changePct = before > 0 ? Math.Round((double)((now - before) / before) * 100, 2) : 0d
                    };
                }).ToList();

                var result = new { @base = "ZAR", date = latestDate, previousDate = prevDate, fetchedAt = DateTime.UtcNow, stale = false, source = "European Central Bank (frankfurter.app)", rates };
                _cache.Set(key, result, TimeSpan.FromHours(1));
                _cache.Set(key + ".last", result, TimeSpan.FromDays(7));
                return Ok(result);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Currency feed unavailable");
                if (_cache.TryGetValue(key + ".last", out object? last) && last != null)
                {
                    var json = JsonSerializer.Serialize(last);
                    using var doc = JsonDocument.Parse(json);
                    var dict = doc.RootElement.EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value.Clone());
                    dict["stale"] = true;
                    return Ok(dict);
                }
                return StatusCode(503, new { message = "Exchange rates are not available right now." });
            }
        }

        private static string CurrencyName(string c) => c switch
        {
            "USD" => "US dollar", "EUR" => "Euro", "GBP" => "British pound", "AUD" => "Australian dollar", "CNY" => "Chinese yuan",
            "JPY" => "Japanese yen", "CHF" => "Swiss franc", "INR" => "Indian rupee", "CAD" => "Canadian dollar", _ => c
        };
        private static string CurrencySymbol(string c) => c switch
        {
            "USD" => "$", "EUR" => "€", "GBP" => "£", "AUD" => "A$", "CNY" => "¥", "JPY" => "¥", "CHF" => "Fr", "INR" => "₹", "CAD" => "C$", _ => c
        };

        // ── Sales ────────────────────────────────────────────────────────────────────────────

        private static readonly (string Code, string Name)[] Companies =
        {
            ("PMT", "Promed"), ("ACM", "Access"), ("PHT", "Pharmatech"), ("SBT", "Sebenzani")
        };

        /// <summary>Daily sales per company for the last N days (default 7), for the line graph.</summary>
        [HttpGet("sales-daily")]
        [RequireModule("sales")]
        public async Task<IActionResult> SalesDaily([FromQuery] int days = 7)
        {
            days = Math.Clamp(days, 2, 31);
            var today = SaNow().Date;
            var from = today.AddDays(-(days - 1));

            var rows = await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionDate >= from && i.TransactionDate < today.AddDays(1))
                .GroupBy(i => new { i.SourceCompany, Day = i.TransactionDate.Date })
                .Select(g => new { g.Key.SourceCompany, g.Key.Day, Sales = g.Sum(x => x.SalesAmount), Orders = g.Count() })
                .ToListAsync();

            var dates = Enumerable.Range(0, days).Select(i => from.AddDays(i)).ToList();
            var series = Companies.Select(c =>
            {
                var points = dates.Select(d =>
                {
                    var r = rows.FirstOrDefault(x => x.SourceCompany == c.Code && x.Day == d);
                    return new { date = d, sales = r?.Sales ?? 0m, orders = r?.Orders ?? 0 };
                }).ToList();
                return new { code = c.Code, name = c.Name, total = points.Sum(p => p.sales), points };
            }).ToList();

            return Ok(new { from, to = today, dates, series });
        }

        /// <summary>
        /// Sales vs stock: stock on hand (value) per warehouse against the last 30 days of sales, with
        /// stock cover in days (stock value ÷ average daily sales).
        /// </summary>
        [HttpGet("sales-vs-stock")]
        [RequireModule("sales")]
        public async Task<IActionResult> SalesVsStock()
        {
            var today = SaNow().Date;
            var from = today.AddDays(-29);

            var sales = await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionDate >= from && i.TransactionDate < today.AddDays(1))
                .GroupBy(i => i.SourceCompany)
                .Select(g => new { company = g.Key, sales = g.Sum(x => x.SalesAmount), cost = g.Sum(x => x.CostOfSales), orders = g.Count() })
                .ToListAsync();

            var stock = await _db.WarehouseInventory.AsNoTracking()
                .GroupBy(w => w.WarehouseId)
                .Select(g => new { warehouseId = g.Key, items = g.Count(), qty = g.Sum(x => x.QuantityOnHand), value = g.Sum(x => x.QuantityOnHand * (x.UnitPrice ?? 0)) })
                .ToListAsync();
            var names = await _db.Warehouses.AsNoTracking().Select(w => new { w.Id, w.Name, w.Code }).ToListAsync();

            var totalSales = sales.Sum(s => s.sales);
            var totalCost = sales.Sum(s => s.cost);
            var stockValue = stock.Sum(s => s.value);
            // Stock is valued at unit (selling) price, so compare it with the sales rate rather than cost of sales,
            // which the Sage imports only populate for some companies.
            var dailySales = totalSales / 30m;
            var coverDays = dailySales > 0 ? Math.Round(stockValue / dailySales, 0) : (decimal?)null;

            return Ok(new
            {
                from, to = today,
                sales30 = totalSales, cost30 = totalCost, orders30 = sales.Sum(s => s.orders),
                stockValue, stockItems = stock.Sum(s => s.items), coverDays,
                companies = Companies.Select(c => { var s = sales.FirstOrDefault(x => x.company == c.Code); return new { c.Code, c.Name, sales = s?.sales ?? 0m, cost = s?.cost ?? 0m, orders = s?.orders ?? 0 }; }).ToList(),
                warehouses = stock.Select(s => { var n = names.FirstOrDefault(x => x.Id == s.warehouseId); return new { s.warehouseId, name = n?.Name ?? $"Warehouse {s.warehouseId}", code = n?.Code, s.items, s.qty, s.value }; }).OrderByDescending(w => w.value).ToList()
            });
        }
    }
}
