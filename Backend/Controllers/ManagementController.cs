using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Executive / management oversight module. Aggregates high-level status and
    /// summaries across Sales, Tenders, Logistics, Finance and Paperless so that
    /// Directors and the General Manager get a single command-centre view and can
    /// action the approvals (paperless sign-off + finance payments) assigned to them.
    ///
    /// Intended for senior staff only — guarded on the frontend by the
    /// <c>management</c> module permission.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/management")]
    public class ManagementController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ManagementController> _logger;

        public ManagementController(ApplicationDbContext context, ILogger<ManagementController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------
        private (int userId, string? email) GetCurrentUser()
        {
            var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("userId")
                ?? User.FindFirstValue("sub");
            int.TryParse(idStr, out var uid);
            var email = User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue("email");
            return (uid, email);
        }

        private class RecipInfo
        {
            public string? id { get; set; }
            public string? name { get; set; }
            public string? email { get; set; }
            public string? role { get; set; }   // signer | approver | viewer
            public string? state { get; set; }  // "" pending | signed | approved | declined
        }

        private static List<RecipInfo> ParseRecipients(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new List<RecipInfo>();
            try
            {
                return JsonSerializer.Deserialize<List<RecipInfo>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<RecipInfo>();
            }
            catch { return new List<RecipInfo>(); }
        }

        private static List<int> ParseAccess(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new List<int>();
            try { return JsonSerializer.Deserialize<List<int>>(json) ?? new List<int>(); }
            catch { return new List<int>(); }
        }

        private static bool IsPending(string? state) =>
            string.IsNullOrWhiteSpace(state) || state == "pending";

        // ==================================================================
        // GET: api/management/overview
        // One consolidated snapshot of every module a director cares about.
        // ==================================================================
        [HttpGet("overview")]
        public async Task<IActionResult> GetOverview()
        {
            var (uid, email) = GetCurrentUser();
            var emailLc = (email ?? string.Empty).Trim().ToLowerInvariant();
            var now = DateTime.UtcNow;
            var startOfYear = new DateTime(now.Year, 1, 1);
            var endOfWeek = now.AddDays(7);

            // Sequential on purpose: DbContext is not thread-safe.
            var sales = await BuildSalesSummary(now, startOfYear);
            var tenders = await BuildTendersSummary(now, startOfYear, endOfWeek);
            var logistics = await BuildLogisticsSummary(now);
            var stock = await BuildStockSummary();
            var finance = await BuildFinanceSummary(now, startOfYear);
            var paperless = await BuildPaperlessSummary(uid, emailLc);
            var hr = await BuildHrSummary(now);
            var fleet = await BuildFleetSummary(now, startOfYear);
            var projects = await BuildProjectsSummary(now);
            var support = await BuildSupportSummary(now);
            var departments = await BuildDepartmentsSummary(now);
            var alerts = BuildAlerts(now, tenders, stock, hr, fleet, projects, support, logistics, finance, paperless);

            return Ok(new
            {
                generatedAt = now.ToString("o"),
                sales,
                tenders,
                logistics,
                stock,
                finance,
                paperless,
                hr,
                fleet,
                projects,
                support,
                departments,
                alerts
            });
        }

        // ------------------------------------------------------------------
        // Typed summary records (so the alert builder can read them safely)
        // ------------------------------------------------------------------
        public record MonthPoint(int year, int month, string label, decimal value, decimal? secondary = null);
        public record NamedCount(string name, int count);
        public record NamedAmount(string name, decimal amount, int count);

        private static string MonthLabel(int year, int month) =>
            new DateTime(year, month, 1).ToString("MMM yy");

        private static List<MonthPoint> LastTwelveMonths(DateTime now, Func<int, int, (decimal, decimal?)> pick)
        {
            var list = new List<MonthPoint>();
            for (var i = 11; i >= 0; i--)
            {
                var d = new DateTime(now.Year, now.Month, 1).AddMonths(-i);
                var (v, s) = pick(d.Year, d.Month);
                list.Add(new MonthPoint(d.Year, d.Month, MonthLabel(d.Year, d.Month), v, s));
            }
            return list;
        }

        private async Task<List<T>> ReadRowsAsync<T>(string sql, Func<System.Data.Common.DbDataReader, T> map)
        {
            var results = new List<T>();
            var conn = _context.Database.GetDbConnection();
            var opened = false;
            if (conn.State != System.Data.ConnectionState.Open) { await conn.OpenAsync(); opened = true; }
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) results.Add(map(reader));
            }
            finally { if (opened) await conn.CloseAsync(); }
            return results;
        }

        public class SalesSummary
        {
            public decimal YtdNetSales { get; set; }
            public decimal MonthNetSales { get; set; }
            public decimal PrevMonthNetSales { get; set; }
            public decimal YtdReturns { get; set; }
            public decimal YtdGrossProfit { get; set; }
            public decimal YtdMarginPercent { get; set; }
            public int TransactionCount { get; set; }
            public int CustomerCount { get; set; }
            public List<NamedAmount> ByCompany { get; set; } = new();
            public List<MonthPoint> Monthly { get; set; } = new();
            public List<NamedAmount> TopCustomers { get; set; } = new();
        }

        private async Task<SalesSummary> BuildSalesSummary(DateTime now, DateTime startOfYear)
        {
            var s = new SalesSummary();
            try
            {
                // Net sales = SalesAmount - SalesReturns (same convention as Sales / Finance modules).
                // Window: the last 12 calendar months so the trend chart is continuous across year end.
                var from = new DateTime(now.Year, now.Month, 1).AddMonths(-11);
                var rows = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.TransactionDate >= from)
                    .Select(i => new
                    {
                        i.TransactionDate,
                        Net = i.SalesAmount - i.SalesReturns,
                        i.SalesReturns,
                        i.CostOfSales,
                        i.SourceCompany,
                        i.CustomerNumber,
                        i.CustomerName
                    })
                    .ToListAsync();

                var ytd = rows.Where(r => r.TransactionDate >= startOfYear).ToList();
                var prevMonth = new DateTime(now.Year, now.Month, 1).AddMonths(-1);

                s.YtdNetSales = ytd.Sum(r => r.Net);
                s.MonthNetSales = ytd.Where(r => r.TransactionDate.Month == now.Month && r.TransactionDate.Year == now.Year).Sum(r => r.Net);
                s.PrevMonthNetSales = rows.Where(r => r.TransactionDate.Month == prevMonth.Month && r.TransactionDate.Year == prevMonth.Year).Sum(r => r.Net);
                s.YtdReturns = ytd.Sum(r => r.SalesReturns);
                s.YtdGrossProfit = ytd.Sum(r => r.Net - r.CostOfSales);
                s.YtdMarginPercent = s.YtdNetSales == 0 ? 0 : Math.Round(s.YtdGrossProfit / s.YtdNetSales * 100, 1);
                s.TransactionCount = ytd.Count;
                s.CustomerCount = ytd.Select(r => r.CustomerNumber).Distinct().Count();
                s.ByCompany = ytd
                    .GroupBy(r => string.IsNullOrWhiteSpace(r.SourceCompany) ? "Unassigned" : r.SourceCompany!)
                    .Select(g => new NamedAmount(g.Key, g.Sum(x => x.Net), g.Count()))
                    .OrderByDescending(x => x.amount)
                    .ToList();
                s.Monthly = LastTwelveMonths(now, (y, m) =>
                {
                    var mr = rows.Where(r => r.TransactionDate.Year == y && r.TransactionDate.Month == m).ToList();
                    return (mr.Sum(r => r.Net), mr.Sum(r => r.Net - r.CostOfSales));
                });
                s.TopCustomers = ytd
                    .GroupBy(r => r.CustomerNumber)
                    .Select(g => new NamedAmount(g.First().CustomerName ?? g.Key, g.Sum(x => x.Net), g.Count()))
                    .OrderByDescending(x => x.amount)
                    .Take(8)
                    .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: sales summary failed");
            }
            return s;
        }

        public class TendersSummary
        {
            public int Active { get; set; }
            public int ClosingThisWeek { get; set; }
            public int Overdue { get; set; }
            public int AwardedYtd { get; set; }
            public int LostYtd { get; set; }
            public decimal WinRatePercent { get; set; }
            public decimal ValueSubmitted { get; set; }
            public decimal ValueAwarded { get; set; }
            public decimal PipelineValue { get; set; }
            public List<NamedCount> ByStatus { get; set; } = new();
            public List<NamedCount> ByCompany { get; set; } = new();
            public List<object> UpcomingClosings { get; set; } = new();
            public int ComplianceExpiring45d { get; set; }
            public int ComplianceExpired { get; set; }
            public List<object> ComplianceAtRisk { get; set; } = new();
        }

        private async Task<TendersSummary> BuildTendersSummary(DateTime now, DateTime startOfYear, DateTime endOfWeek)
        {
            var s = new TendersSummary();
            try
            {
                var tenders = await _context.Tenders.AsNoTracking()
                    .Select(t => new { t.Id, t.TenderNumber, t.Title, t.IssuingDepartment, t.CompanyCode, t.Status, t.Priority, t.ClosingDate, t.AwardDate, t.EstimatedValue, t.AwardedValue, t.UpdatedAt })
                    .ToListAsync();

                bool Open(string st) => st != "Awarded" && st != "Lost" && st != "Cancelled";
                var open = tenders.Where(t => Open(t.Status)).ToList();

                s.Active = open.Count;
                s.ClosingThisWeek = open.Count(t => t.ClosingDate >= now && t.ClosingDate <= endOfWeek);
                s.Overdue = open.Count(t => t.ClosingDate < now && (t.Status == "Draft" || t.Status == "Clarification"));
                s.AwardedYtd = tenders.Count(t => t.Status == "Awarded" && t.AwardDate >= startOfYear);
                s.LostYtd = tenders.Count(t => t.Status == "Lost" && t.UpdatedAt >= startOfYear);
                var decided = s.AwardedYtd + s.LostYtd;
                s.WinRatePercent = decided == 0 ? 0 : Math.Round((decimal)s.AwardedYtd / decided * 100, 1);
                s.ValueSubmitted = tenders.Where(t => t.Status == "Submitted" || t.Status == "Evaluation" || t.Status == "Awarded" || t.Status == "Lost").Sum(t => t.EstimatedValue ?? 0);
                s.ValueAwarded = tenders.Where(t => t.Status == "Awarded").Sum(t => t.AwardedValue ?? t.EstimatedValue ?? 0);
                s.PipelineValue = open.Sum(t => t.EstimatedValue ?? 0);
                s.ByStatus = tenders.GroupBy(t => t.Status).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();
                s.ByCompany = open.GroupBy(t => t.CompanyCode).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();
                s.UpcomingClosings = open
                    .Where(t => t.ClosingDate >= now.Date)
                    .OrderBy(t => t.ClosingDate)
                    .Take(8)
                    .Select(t => (object)new
                    {
                        t.Id,
                        t.TenderNumber,
                        t.Title,
                        t.IssuingDepartment,
                        t.CompanyCode,
                        t.Status,
                        t.Priority,
                        closingDate = t.ClosingDate.ToString("o"),
                        daysLeft = (int)Math.Ceiling((t.ClosingDate - now).TotalDays)
                    })
                    .ToList();

                var compliance = await _context.ComplianceDocuments.AsNoTracking()
                    .Select(c => new { c.Id, c.CompanyCode, c.DocumentType, c.ExpiryDate })
                    .ToListAsync();
                s.ComplianceExpired = compliance.Count(c => c.ExpiryDate < now.Date);
                s.ComplianceExpiring45d = compliance.Count(c => c.ExpiryDate >= now.Date && c.ExpiryDate <= now.Date.AddDays(45));
                s.ComplianceAtRisk = compliance
                    .Where(c => c.ExpiryDate <= now.Date.AddDays(45))
                    .OrderBy(c => c.ExpiryDate)
                    .Take(8)
                    .Select(c => (object)new { c.Id, c.CompanyCode, c.DocumentType, expiryDate = c.ExpiryDate.ToString("o"), daysLeft = (int)(c.ExpiryDate.Date - now.Date).TotalDays })
                    .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: tenders summary failed");
            }
            return s;
        }

        public class LogisticsSummary
        {
            public int Total { get; set; }
            public int Available { get; set; }
            public int Assigned { get; set; }
            public int InTransit { get; set; }
            public int Delivered { get; set; }
            public int Cancelled { get; set; }
            public int DeliveredThisMonth { get; set; }
            public int PodsThisMonth { get; set; }
            public int PendingDeliveryRequests { get; set; }
            public List<MonthPoint> MonthlyDeliveries { get; set; } = new();
            // Client bookings / tracked shipments
            public int BookingsAwaitingReview { get; set; }
            public int ShipmentsActive { get; set; }
            public int ShipmentsDeliveredThisMonth { get; set; }
            public int ShipmentsFailed { get; set; }
            public List<NamedCount> ShipmentsByStatus { get; set; } = new();
            // Backorders (latest Sage import)
            public int BackorderLines { get; set; }
            public decimal BackorderValue { get; set; }
            public string? BackorderAsOf { get; set; }
            public List<NamedAmount> BackordersByCompany { get; set; } = new();
        }

        private async Task<LogisticsSummary> BuildLogisticsSummary(DateTime now)
        {
            var s = new LogisticsSummary();
            var monthStart = new DateTime(now.Year, now.Month, 1);
            try
            {
                var loads = await _context.Loads.AsNoTracking()
                    .Select(l => new { l.Status, l.ActualDeliveryDate, l.UpdatedAt, l.CreatedAt })
                    .ToListAsync();

                int Cnt(string st) => loads.Count(x => x.Status == st);
                s.Total = loads.Count;
                s.Available = Cnt("Available");
                s.Assigned = Cnt("Assigned");
                s.InTransit = Cnt("InTransit") + Cnt("In Transit");
                s.Delivered = Cnt("Delivered");
                s.Cancelled = Cnt("Cancelled");

                // Delivered date: ActualDeliveryDate when captured, else the last update of a Delivered load.
                var delivered = loads.Where(l => l.Status == "Delivered")
                    .Select(l => l.ActualDeliveryDate ?? l.UpdatedAt ?? l.CreatedAt).ToList();
                s.DeliveredThisMonth = delivered.Count(d => d >= monthStart);
                s.MonthlyDeliveries = LastTwelveMonths(now, (y, m) => (delivered.Count(d => d.Year == y && d.Month == m), null));

                try { s.PodsThisMonth = await _context.ProofOfDeliveries.CountAsync(p => p.DeliveredAt >= monthStart); } catch { }

                try
                {
                    s.PendingDeliveryRequests = await _context.CondomDeliveryRequests
                        .CountAsync(r => r.Status == "Pending" || r.Status == "Approved" || r.Status == "In Transit");
                }
                catch { /* delivery requests optional */ }

                try
                {
                    s.BookingsAwaitingReview = await _context.ClientBookings.CountAsync(b => b.Status == "BOOKED");
                    var ships = await _context.Shipments.AsNoTracking().Select(x => new { x.Status, x.DeliveredAt, x.UpdatedAt }).ToListAsync();
                    var terminal = new[] { "DELIVERED", "CANCELLED", "REJECTED" };
                    s.ShipmentsActive = ships.Count(x => !terminal.Contains(x.Status));
                    s.ShipmentsDeliveredThisMonth = ships.Count(x => x.Status == "DELIVERED" && (x.DeliveredAt ?? x.UpdatedAt) >= monthStart);
                    s.ShipmentsFailed = ships.Count(x => x.Status == "DELIVERY_FAILED" || x.Status == "COLLECTION_FAILED");
                    s.ShipmentsByStatus = ships.GroupBy(x => x.Status).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Management: shipments not available"); }

                try
                {
                    // Only the most recent import batch reflects the live backorder book.
                    var latest = await _context.ImportedBackorders.AsNoTracking()
                        .OrderByDescending(b => b.ImportedAt).Select(b => new { b.ImportBatchId, b.ImportedAt }).FirstOrDefaultAsync();
                    if (latest != null)
                    {
                        var bo = await _context.ImportedBackorders.AsNoTracking()
                            .Where(b => b.ImportBatchId == latest.ImportBatchId)
                            .GroupBy(b => b.SourceCompany)
                            .Select(g => new { company = g.Key, count = g.Count(), value = g.Sum(x => x.ExtPrice) })
                            .ToListAsync();
                        s.BackorderLines = bo.Sum(x => x.count);
                        s.BackorderValue = bo.Sum(x => x.value);
                        s.BackorderAsOf = latest.ImportedAt.ToString("o");
                        s.BackordersByCompany = bo.Select(x => new NamedAmount(x.company, x.value, x.count)).OrderByDescending(x => x.amount).ToList();
                    }
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Management: backorders not available"); }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: logistics summary failed");
            }
            return s;
        }

        public class StockWarehouseRow
        {
            public string Warehouse { get; set; } = "";
            public int SkuCount { get; set; }
            public decimal TotalQuantity { get; set; }
            public int LowStock { get; set; }
            public int OutOfStock { get; set; }
        }
        public class StockSummary
        {
            public int TotalSkus { get; set; }
            public decimal TotalQuantityOnHand { get; set; }
            public int LowStock { get; set; }
            public int OutOfStock { get; set; }
            public int Warehouses { get; set; }
            public List<StockWarehouseRow> ByWarehouse { get; set; } = new();
        }

        private async Task<StockSummary> BuildStockSummary()
        {
            var s = new StockSummary();
            try
            {
                // Live warehouse inventory: quantity on hand per SKU per warehouse,
                // with reorder levels used to flag low / out-of-stock items.
                var rows = await _context.WarehouseInventory.AsNoTracking()
                    .Select(wi => new
                    {
                        wi.WarehouseId,
                        WarehouseName = wi.Warehouse != null ? wi.Warehouse.Name : "Unknown",
                        wi.QuantityOnHand,
                        wi.ReorderLevel
                    })
                    .ToListAsync();

                bool IsOut(decimal qty) => qty <= 0;
                bool IsLow(decimal qty, decimal? reorder) =>
                    reorder.HasValue && reorder.Value > 0 && qty > 0 && qty <= reorder.Value;

                s.ByWarehouse = rows
                    .GroupBy(r => new { r.WarehouseId, r.WarehouseName })
                    .Select(g => new StockWarehouseRow
                    {
                        Warehouse = g.Key.WarehouseName,
                        SkuCount = g.Count(),
                        TotalQuantity = g.Sum(x => x.QuantityOnHand),
                        LowStock = g.Count(x => IsLow(x.QuantityOnHand, x.ReorderLevel)),
                        OutOfStock = g.Count(x => IsOut(x.QuantityOnHand))
                    })
                    .OrderByDescending(x => x.TotalQuantity)
                    .ToList();

                s.TotalSkus = rows.Count;
                s.TotalQuantityOnHand = rows.Sum(r => r.QuantityOnHand);
                s.LowStock = rows.Count(r => IsLow(r.QuantityOnHand, r.ReorderLevel));
                s.OutOfStock = rows.Count(r => IsOut(r.QuantityOnHand));
                s.Warehouses = s.ByWarehouse.Count;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: stock summary failed");
            }
            return s;
        }

        public class FinanceSummary
        {
            public class ReqBlock { public int Requested { get; set; } public decimal RequestedAmount { get; set; } public int Paid { get; set; } public decimal PaidAmount { get; set; } public int Rejected { get; set; } }
            public class PayBlock { public int Pending { get; set; } public decimal PendingAmount { get; set; } public int Completed { get; set; } public decimal CompletedAmount { get; set; } }
            public class ExpBlock { public int Count { get; set; } public decimal YtdTotal { get; set; } public decimal MonthTotal { get; set; } public int PendingApproval { get; set; } public decimal PendingApprovalAmount { get; set; } }
            public ReqBlock Requisitions { get; set; } = new();
            public PayBlock Payments { get; set; } = new();
            public ExpBlock Expenses { get; set; } = new();
            public int BookInvoices { get; set; }
            public List<MonthPoint> MonthlyExpenses { get; set; } = new();
            public List<NamedAmount> ExpensesByDepartment { get; set; } = new();
        }

        private async Task<FinanceSummary> BuildFinanceSummary(DateTime now, DateTime startOfYear)
        {
            var s = new FinanceSummary();
            var monthStart = new DateTime(now.Year, now.Month, 1);
            try
            {
                var reqs = await _context.Requisitions.AsNoTracking()
                    .Where(r => r.Status != "Cancelled")
                    .Select(r => new { r.FinanceStatus, Total = r.AmountEwallet + r.DieselAmount })
                    .ToListAsync();

                var payments = await _context.Payments.AsNoTracking()
                    .Select(p => new { p.Status, p.Amount })
                    .ToListAsync();

                try { s.BookInvoices = await _context.BookInvoices.CountAsync(); } catch { }

                s.Requisitions = new FinanceSummary.ReqBlock
                {
                    Requested = reqs.Count(r => r.FinanceStatus == "Requested"),
                    RequestedAmount = reqs.Where(r => r.FinanceStatus == "Requested").Sum(r => r.Total),
                    Paid = reqs.Count(r => r.FinanceStatus == "Paid"),
                    PaidAmount = reqs.Where(r => r.FinanceStatus == "Paid").Sum(r => r.Total),
                    Rejected = reqs.Count(r => r.FinanceStatus == "Rejected")
                };
                s.Payments = new FinanceSummary.PayBlock
                {
                    Pending = payments.Count(p => p.Status == "Pending" || p.Status == "Processing"),
                    PendingAmount = payments.Where(p => p.Status == "Pending" || p.Status == "Processing").Sum(p => p.Amount),
                    Completed = payments.Count(p => p.Status == "Completed"),
                    CompletedAmount = payments.Where(p => p.Status == "Completed").Sum(p => p.Amount)
                };

                try
                {
                    var from = monthStart.AddMonths(-11);
                    var exp = await _context.Expenses.AsNoTracking()
                        .Where(e => e.ExpenseDate >= from && e.Status != "Cancelled" && e.Status != "Rejected")
                        .Select(e => new { e.ExpenseDate, e.TotalAmount, e.Status, e.Department })
                        .ToListAsync();
                    var ytd = exp.Where(e => e.ExpenseDate >= startOfYear).ToList();
                    s.Expenses = new FinanceSummary.ExpBlock
                    {
                        Count = ytd.Count,
                        YtdTotal = ytd.Sum(e => e.TotalAmount),
                        MonthTotal = ytd.Where(e => e.ExpenseDate >= monthStart).Sum(e => e.TotalAmount),
                        PendingApproval = exp.Count(e => e.Status == "Pending" || e.Status == "Submitted"),
                        PendingApprovalAmount = exp.Where(e => e.Status == "Pending" || e.Status == "Submitted").Sum(e => e.TotalAmount)
                    };
                    s.MonthlyExpenses = LastTwelveMonths(now, (y, m) => (exp.Where(e => e.ExpenseDate.Year == y && e.ExpenseDate.Month == m).Sum(e => e.TotalAmount), null));
                    s.ExpensesByDepartment = ytd
                        .GroupBy(e => string.IsNullOrWhiteSpace(e.Department) ? "Unallocated" : e.Department!)
                        .Select(g => new NamedAmount(g.Key, g.Sum(x => x.TotalAmount), g.Count()))
                        .OrderByDescending(x => x.amount).Take(8).ToList();
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Management: expenses not available"); }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: finance summary failed");
            }
            return s;
        }

        public class PaperlessSummary
        {
            public int Total { get; set; }
            public int Completed { get; set; }
            public int InProgress { get; set; }
            public int OrgPendingApprovals { get; set; }
            public int MyPendingApprovals { get; set; }
        }

        private async Task<PaperlessSummary> BuildPaperlessSummary(int uid, string emailLc)
        {
            var s = new PaperlessSummary();
            try
            {
                var docs = await _context.PaperlessDocuments.AsNoTracking()
                    .Where(d => d.ParentId == null)
                    .Select(d => new { d.Status, d.Progress, d.RecipientsJson })
                    .ToListAsync();

                var completed = docs.Count(d => d.Status == "completed" || d.Progress >= 100);
                var inProgress = docs.Count(d => d.Status != "completed" && d.Progress < 100);

                var orgPendingApprovals = 0;
                var myPendingApprovals = 0;
                foreach (var d in docs)
                {
                    var recips = ParseRecipients(d.RecipientsJson);
                    foreach (var r in recips)
                    {
                        if (r.role == "approver" && IsPending(r.state))
                        {
                            orgPendingApprovals++;
                            if (!string.IsNullOrWhiteSpace(r.email) &&
                                r.email!.Trim().ToLowerInvariant() == emailLc)
                                myPendingApprovals++;
                        }
                    }
                }

                s.Total = docs.Count;
                s.Completed = completed;
                s.InProgress = inProgress;
                s.OrgPendingApprovals = orgPendingApprovals;
                s.MyPendingApprovals = myPendingApprovals;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: paperless summary failed");
            }
            return s;
        }

        // ==================================================================
        // HR: headcount, attendance (biometric), leave, disciplinary, contracts
        // ==================================================================
        public class HrSummary
        {
            public int Headcount { get; set; }
            public int Inactive { get; set; }
            public int BiometricRegistered { get; set; }
            public int PresentToday { get; set; }
            public decimal AttendanceRatePercent { get; set; }
            public string? LastClockDate { get; set; }
            public int ContractsExpiring90d { get; set; }
            public int LeavePending { get; set; }
            public int LeaveApprovedUpcoming { get; set; }
            public int OnLeaveToday { get; set; }
            public int DisciplinaryOpen { get; set; }
            public int NewHires90d { get; set; }
            public List<NamedCount> BySite { get; set; } = new();
            public List<NamedCount> ByDepartment { get; set; } = new();
            public List<NamedCount> ByEmploymentType { get; set; } = new();
            public List<object> AttendanceTrend { get; set; } = new();
            public List<object> ExpiringContracts { get; set; } = new();
        }

        private async Task<HrSummary> BuildHrSummary(DateTime now)
        {
            var s = new HrSummary();
            var today = DateTime.Now.Date; // clock-in dates are stored in local (SAST) time
            try
            {
                var emps = await _context.HrEmployees.AsNoTracking()
                    .Select(e => new { e.Id, e.FirstName, e.LastName, e.Site, e.Department, e.EmploymentType, e.Status, e.HireDate, e.ContractEndDate, e.JobTitle })
                    .ToListAsync();
                var active = emps.Where(e => e.Status == "Active").ToList();

                s.Headcount = active.Count;
                s.Inactive = emps.Count - active.Count;
                s.NewHires90d = active.Count(e => e.HireDate.HasValue && e.HireDate.Value >= now.AddDays(-90));
                s.BySite = active.GroupBy(e => string.IsNullOrWhiteSpace(e.Site) ? "Unassigned" : e.Site).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();
                s.ByDepartment = active.GroupBy(e => string.IsNullOrWhiteSpace(e.Department) ? "Unassigned" : e.Department!).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).Take(12).ToList();
                s.ByEmploymentType = active.GroupBy(e => string.IsNullOrWhiteSpace(e.EmploymentType) ? "Unspecified" : e.EmploymentType).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();

                var expiring = active.Where(e => e.ContractEndDate.HasValue && e.ContractEndDate.Value.Date >= today && e.ContractEndDate.Value.Date <= today.AddDays(90)).OrderBy(e => e.ContractEndDate).ToList();
                s.ContractsExpiring90d = expiring.Count;
                s.ExpiringContracts = expiring.Take(8).Select(e => (object)new { e.Id, name = $"{e.FirstName} {e.LastName}".Trim(), e.Site, e.JobTitle, contractEndDate = e.ContractEndDate!.Value.ToString("o"), daysLeft = (int)(e.ContractEndDate.Value.Date - today).TotalDays }).ToList();

                try { s.DisciplinaryOpen = await _context.HrDisciplinaryCases.CountAsync(c => c.Status == "Open" || c.Status == "Active" || c.Status == "Pending" || c.Status == "In Progress"); } catch { }

                // Biometric attendance (clock-in machine writes to `attendance`).
                try
                {
                    s.BiometricRegistered = await _context.EmpRegistrations.CountAsync();
                    var since = today.AddDays(-20);
                    var att = await _context.AttendanceRecords.AsNoTracking()
                        .Where(a => a.Date != null && a.Date >= since && a.TimeIn != null)
                        .Select(a => new { a.EmpID, a.Date })
                        .ToListAsync();
                    var perDay = att.GroupBy(a => a.Date!.Value.Date)
                        .Select(g => new { day = g.Key, present = g.Select(x => x.EmpID).Distinct().Count() })
                        .OrderBy(x => x.day).ToList();
                    s.PresentToday = perDay.FirstOrDefault(x => x.day == today)?.present ?? 0;
                    s.LastClockDate = perDay.LastOrDefault()?.day.ToString("yyyy-MM-dd");
                    s.AttendanceRatePercent = s.BiometricRegistered == 0 ? 0 : Math.Round((decimal)s.PresentToday / s.BiometricRegistered * 100, 1);
                    // Working-day trend (Mon–Fri) for the last 14 working days, zero-filled.
                    var days = new List<DateTime>();
                    for (var d = today; days.Count < 14; d = d.AddDays(-1))
                        if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday) days.Add(d);
                    days.Reverse();
                    s.AttendanceTrend = days.Select(d => (object)new { date = d.ToString("yyyy-MM-dd"), label = d.ToString("dd MMM"), present = perDay.FirstOrDefault(x => x.day == d)?.present ?? 0 }).ToList();
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Management: attendance not available"); }

                // Leave requests live in a raw table (no EF entity).
                try
                {
                    var rows = await ReadRowsAsync(@"
                        SELECT
                          SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END),
                          SUM(CASE WHEN Status = 'Approved' AND StartDate >= CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END),
                          SUM(CASE WHEN Status = 'Approved' AND CAST(GETDATE() AS DATE) BETWEEN StartDate AND EndDate THEN 1 ELSE 0 END)
                        FROM LeaveRequests",
                        r => new { pending = r.IsDBNull(0) ? 0 : r.GetInt32(0), upcoming = r.IsDBNull(1) ? 0 : r.GetInt32(1), today = r.IsDBNull(2) ? 0 : r.GetInt32(2) });
                    var lr = rows.FirstOrDefault();
                    if (lr != null) { s.LeavePending = lr.pending; s.LeaveApprovedUpcoming = lr.upcoming; s.OnLeaveToday = lr.today; }
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Management: leave requests not available"); }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: HR summary failed");
            }
            return s;
        }

        // ==================================================================
        // Fleet: vehicles, maintenance, fuel, incidents, drivers
        // ==================================================================
        public class FleetSummary
        {
            public int Vehicles { get; set; }
            public int Operational { get; set; }
            public int InMaintenance { get; set; }
            public int Retired { get; set; }
            public List<NamedCount> ByStatus { get; set; } = new();
            public List<NamedCount> ByProvince { get; set; } = new();
            public int MaintenanceScheduled { get; set; }
            public int MaintenanceOverdue { get; set; }
            public decimal MaintenanceCostYtd { get; set; }
            public decimal FuelSpendYtd { get; set; }
            public decimal FuelSpendMonth { get; set; }
            public decimal FuelLitresMonth { get; set; }
            public List<MonthPoint> MonthlyFuel { get; set; } = new();
            public int Incidents30d { get; set; }
            public int HighIncidents30d { get; set; }
            public int Incidents7d { get; set; }
            public List<NamedCount> IncidentsByType30d { get; set; } = new();
            public int DriversActive { get; set; }
            public int LicencesExpiring60d { get; set; }
            public int LicencesExpired { get; set; }
            public List<object> OverdueMaintenance { get; set; } = new();
        }

        private async Task<FleetSummary> BuildFleetSummary(DateTime now, DateTime startOfYear)
        {
            var s = new FleetSummary();
            var today = now.Date;
            try
            {
                var vehicles = await _context.Vehicles.AsNoTracking().Select(v => new { v.Id, v.RegistrationNumber, v.Status, v.Province }).ToListAsync();
                var retired = new[] { "Decommissioned", "Written Off", "Sold", "Stolen", "Scrapped" };
                s.Vehicles = vehicles.Count;
                s.Retired = vehicles.Count(v => retired.Contains(v.Status));
                s.InMaintenance = vehicles.Count(v => v.Status == "Maintenance" || v.Status == "In Maintenance");
                s.Operational = vehicles.Count - s.Retired - s.InMaintenance;
                s.ByStatus = vehicles.GroupBy(v => v.Status).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();
                s.ByProvince = vehicles.Where(v => !retired.Contains(v.Status)).GroupBy(v => string.IsNullOrWhiteSpace(v.Province) ? "Unassigned" : v.Province!).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();

                var maint = await _context.VehicleMaintenance.AsNoTracking()
                    .Select(m => new { m.Id, m.VehicleId, m.MaintenanceType, m.Status, m.ScheduledDate, m.CompletedDate, m.Cost, m.Priority })
                    .ToListAsync();
                bool Done(string st) => st.Equals("Completed", StringComparison.OrdinalIgnoreCase) || st.Equals("Cancelled", StringComparison.OrdinalIgnoreCase);
                var openMaint = maint.Where(m => !Done(m.Status)).ToList();
                s.MaintenanceScheduled = openMaint.Count;
                var overdue = openMaint.Where(m => m.ScheduledDate.Date < today).OrderBy(m => m.ScheduledDate).ToList();
                s.MaintenanceOverdue = overdue.Count;
                s.MaintenanceCostYtd = maint.Where(m => Done(m.Status) && m.CompletedDate >= startOfYear).Sum(m => m.Cost ?? 0);
                var regs = vehicles.ToDictionary(v => v.Id, v => v.RegistrationNumber);
                s.OverdueMaintenance = overdue.Take(8).Select(m => (object)new { m.Id, registration = regs.TryGetValue(m.VehicleId, out var r) ? r : $"#{m.VehicleId}", m.MaintenanceType, m.Priority, scheduledDate = m.ScheduledDate.ToString("o"), daysOverdue = (int)(today - m.ScheduledDate.Date).TotalDays }).ToList();

                var fuelFrom = new DateTime(now.Year, now.Month, 1).AddMonths(-11);
                var fuel = await _context.FuelTransactions.AsNoTracking()
                    .Where(f => f.TransactionDate >= fuelFrom)
                    .Select(f => new { f.TransactionDate, f.AmountSpent, f.LitresUsed })
                    .ToListAsync();
                s.FuelSpendYtd = fuel.Where(f => f.TransactionDate >= startOfYear).Sum(f => f.AmountSpent);
                s.FuelSpendMonth = fuel.Where(f => f.TransactionDate.Year == now.Year && f.TransactionDate.Month == now.Month).Sum(f => f.AmountSpent);
                s.FuelLitresMonth = fuel.Where(f => f.TransactionDate.Year == now.Year && f.TransactionDate.Month == now.Month).Sum(f => f.LitresUsed);
                s.MonthlyFuel = LastTwelveMonths(now, (y, m) =>
                {
                    var mf = fuel.Where(f => f.TransactionDate.Year == y && f.TransactionDate.Month == m).ToList();
                    return (mf.Sum(f => f.AmountSpent), mf.Sum(f => f.LitresUsed));
                });

                var inc = await _context.LogisticsIncidents.AsNoTracking()
                    .Where(i => i.IncidentDate >= today.AddDays(-30))
                    .Select(i => new { i.Type, i.Severity, i.IncidentDate })
                    .ToListAsync();
                s.Incidents30d = inc.Count;
                s.Incidents7d = inc.Count(i => i.IncidentDate >= today.AddDays(-7));
                s.HighIncidents30d = inc.Count(i => i.Severity == "High" || i.Severity == "Critical");
                s.IncidentsByType30d = inc.GroupBy(i => i.Type).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).Take(6).ToList();

                var drivers = await _context.Drivers.AsNoTracking().Select(d => new { d.Status, d.LicenseExpiryDate }).ToListAsync();
                var activeDrivers = drivers.Where(d => d.Status == "Active").ToList();
                s.DriversActive = activeDrivers.Count;
                s.LicencesExpired = activeDrivers.Count(d => d.LicenseExpiryDate.HasValue && d.LicenseExpiryDate.Value.Date < today);
                s.LicencesExpiring60d = activeDrivers.Count(d => d.LicenseExpiryDate.HasValue && d.LicenseExpiryDate.Value.Date >= today && d.LicenseExpiryDate.Value.Date <= today.AddDays(60));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: fleet summary failed");
            }
            return s;
        }

        // ==================================================================
        // Projects (boards / cards) and Support tickets
        // ==================================================================
        public class ProjectsSummary
        {
            public int Boards { get; set; }
            public int ActiveBoards { get; set; }
            public int Cards { get; set; }
            public int OpenCards { get; set; }
            public int DoneCards { get; set; }
            public int OverdueCards { get; set; }
            public int DueThisWeek { get; set; }
            public List<NamedCount> CardsByStatus { get; set; } = new();
        }

        private async Task<ProjectsSummary> BuildProjectsSummary(DateTime now)
        {
            var s = new ProjectsSummary();
            try
            {
                var boards = await _context.Boards.AsNoTracking().Select(b => new { b.Status }).ToListAsync();
                s.Boards = boards.Count;
                s.ActiveBoards = boards.Count(b => b.Status == "Active");
                var cards = await _context.Cards.AsNoTracking().Select(c => new { c.Status, c.DueDate }).ToListAsync();
                bool Closed(string st) => st == "Done" || st == "Completed" || st == "Closed" || st == "Archived";
                s.Cards = cards.Count;
                s.DoneCards = cards.Count(c => Closed(c.Status));
                s.OpenCards = s.Cards - s.DoneCards;
                s.OverdueCards = cards.Count(c => !Closed(c.Status) && c.DueDate.HasValue && c.DueDate.Value < now);
                s.DueThisWeek = cards.Count(c => !Closed(c.Status) && c.DueDate.HasValue && c.DueDate.Value >= now && c.DueDate.Value <= now.AddDays(7));
                s.CardsByStatus = cards.GroupBy(c => c.Status).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Management: projects summary failed"); }
            return s;
        }

        public class SupportSummary
        {
            public int Open { get; set; }
            public int InProgress { get; set; }
            public int ResolvedThisMonth { get; set; }
            public int HighPriorityOpen { get; set; }
            public double? AvgResolutionHours { get; set; }
            public List<NamedCount> OpenByCategory { get; set; } = new();
        }

        private async Task<SupportSummary> BuildSupportSummary(DateTime now)
        {
            var s = new SupportSummary();
            try
            {
                var monthStart = new DateTime(now.Year, now.Month, 1);
                var t = await _context.SupportTickets.AsNoTracking()
                    .Select(x => new { x.Status, x.Priority, x.Category, x.SubmittedDate, x.ResolvedDate })
                    .ToListAsync();
                bool IsOpen(string st) => st == "Open" || st == "New" || st == "Pending";
                s.Open = t.Count(x => IsOpen(x.Status));
                s.InProgress = t.Count(x => x.Status == "In Progress" || x.Status == "InProgress");
                s.ResolvedThisMonth = t.Count(x => x.ResolvedDate >= monthStart);
                s.HighPriorityOpen = t.Count(x => (IsOpen(x.Status) || x.Status == "In Progress") && (x.Priority == "High" || x.Priority == "Critical" || x.Priority == "Urgent"));
                var resolved = t.Where(x => x.ResolvedDate.HasValue && x.ResolvedDate >= now.AddDays(-90)).ToList();
                s.AvgResolutionHours = resolved.Count == 0 ? null : Math.Round(resolved.Average(x => (x.ResolvedDate!.Value - x.SubmittedDate).TotalHours), 1);
                s.OpenByCategory = t.Where(x => IsOpen(x.Status) || x.Status == "In Progress").GroupBy(x => x.Category).Select(g => new NamedCount(g.Key, g.Count())).OrderByDescending(x => x.count).ToList();
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Management: support summary failed"); }
            return s;
        }

        // ==================================================================
        // Departments: one row per intranet department with its people and work
        // ==================================================================
        public class DepartmentRow
        {
            public int DepartmentId { get; set; }
            public string Name { get; set; } = "";
            public string? Manager { get; set; }
            public int Users { get; set; }
            public int HrHeadcount { get; set; }
            public int Boards { get; set; }
            public int OpenCards { get; set; }
            public int OverdueCards { get; set; }
            public int LeavePending { get; set; }
            public int OnLeaveToday { get; set; }
            public decimal ExpensesYtd { get; set; }
        }

        private async Task<List<DepartmentRow>> BuildDepartmentsSummary(DateTime now)
        {
            var rows = new List<DepartmentRow>();
            try
            {
                var depts = await _context.Departments.AsNoTracking().Select(d => new { d.DepartmentId, d.Name, d.ManagerName }).ToListAsync();
                var userCounts = await _context.Users.AsNoTracking().Where(u => u.IsActive && u.DepartmentId != null)
                    .GroupBy(u => u.DepartmentId!.Value).Select(g => new { id = g.Key, n = g.Count() }).ToListAsync();
                var boardRows = await _context.Boards.AsNoTracking().Select(b => new { b.BoardId, b.DepartmentId }).ToListAsync();
                var cardRows = new List<(int deptId, string status, DateTime? due)>();
                try
                {
                    cardRows = (await _context.Cards.AsNoTracking()
                        .Select(c => new { deptId = c.List.Board.DepartmentId, c.Status, c.DueDate }).ToListAsync())
                        .Select(c => (c.deptId, c.Status, c.DueDate)).ToList();
                }
                catch { }

                var hrByDept = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                try
                {
                    foreach (var g in await _context.HrEmployees.AsNoTracking().Where(e => e.Status == "Active" && e.Department != null)
                        .GroupBy(e => e.Department!).Select(g => new { k = g.Key, n = g.Count() }).ToListAsync())
                        hrByDept[g.k] = g.n;
                }
                catch { }

                var leaveByDept = new Dictionary<string, (int pending, int today)>(StringComparer.OrdinalIgnoreCase);
                try
                {
                    foreach (var r in await ReadRowsAsync(@"
                        SELECT ISNULL(Department,''),
                               SUM(CASE WHEN Status='Pending' THEN 1 ELSE 0 END),
                               SUM(CASE WHEN Status='Approved' AND CAST(GETDATE() AS DATE) BETWEEN StartDate AND EndDate THEN 1 ELSE 0 END)
                        FROM LeaveRequests GROUP BY ISNULL(Department,'')",
                        r => new { d = r.GetString(0), p = r.IsDBNull(1) ? 0 : r.GetInt32(1), t = r.IsDBNull(2) ? 0 : r.GetInt32(2) }))
                        leaveByDept[r.d] = (r.p, r.t);
                }
                catch { }

                var expByDept = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                try
                {
                    var soy = new DateTime(now.Year, 1, 1);
                    foreach (var g in await _context.Expenses.AsNoTracking().Where(e => e.ExpenseDate >= soy && e.Department != null && e.Status != "Cancelled" && e.Status != "Rejected")
                        .GroupBy(e => e.Department!).Select(g => new { k = g.Key, v = g.Sum(x => x.TotalAmount) }).ToListAsync())
                        expByDept[g.k] = g.v;
                }
                catch { }

                static string Norm(string n) => n.Replace(" Department", "", StringComparison.OrdinalIgnoreCase).Trim();
                int Lookup(Dictionary<string, int> d, string name)
                {
                    if (d.TryGetValue(name, out var v)) return v;
                    var key = d.Keys.FirstOrDefault(k => Norm(k).Equals(Norm(name), StringComparison.OrdinalIgnoreCase));
                    return key != null ? d[key] : 0;
                }

                bool Closed(string st) => st == "Done" || st == "Completed" || st == "Closed" || st == "Archived";
                foreach (var d in depts)
                {
                    var cards = cardRows.Where(c => c.deptId == d.DepartmentId).ToList();
                    var leaveKey = leaveByDept.Keys.FirstOrDefault(k => Norm(k).Equals(Norm(d.Name), StringComparison.OrdinalIgnoreCase));
                    var expKey = expByDept.Keys.FirstOrDefault(k => Norm(k).Equals(Norm(d.Name), StringComparison.OrdinalIgnoreCase));
                    rows.Add(new DepartmentRow
                    {
                        DepartmentId = d.DepartmentId,
                        Name = d.Name,
                        Manager = d.ManagerName,
                        Users = userCounts.FirstOrDefault(u => u.id == d.DepartmentId)?.n ?? 0,
                        HrHeadcount = Lookup(hrByDept, d.Name),
                        Boards = boardRows.Count(b => b.DepartmentId == d.DepartmentId),
                        OpenCards = cards.Count(c => !Closed(c.status)),
                        OverdueCards = cards.Count(c => !Closed(c.status) && c.due.HasValue && c.due.Value < now),
                        LeavePending = leaveKey != null ? leaveByDept[leaveKey].pending : 0,
                        OnLeaveToday = leaveKey != null ? leaveByDept[leaveKey].today : 0,
                        ExpensesYtd = expKey != null ? expByDept[expKey] : 0
                    });
                }
                // Hide empty placeholder departments (e.g. test rows) that have nothing attached.
                rows = rows.Where(r => r.Users > 0 || r.HrHeadcount > 0 || r.Boards > 0 || r.LeavePending > 0 || r.ExpensesYtd > 0 || r.OnLeaveToday > 0)
                           .OrderByDescending(r => r.Users + r.HrHeadcount).ToList();
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Management: departments summary failed"); }
            return rows;
        }

        // ==================================================================
        // Alerts: things a director should look at today, derived from the above
        // ==================================================================
        public record AlertItem(string severity, string module, string text, string route);

        private static List<AlertItem> BuildAlerts(DateTime now, TendersSummary t, StockSummary st, HrSummary hr, FleetSummary f,
            ProjectsSummary p, SupportSummary su, LogisticsSummary lg, FinanceSummary fi, PaperlessSummary pl)
        {
            var a = new List<AlertItem>();
            void Add(string severity, string module, string text, string route) => a.Add(new AlertItem(severity, module, text, route));

            if (t.Overdue > 0) Add("danger", "Tenders", $"{t.Overdue} tender(s) past closing date still in Draft/Clarification", "/tenders");
            if (t.ClosingThisWeek > 0) Add("warn", "Tenders", $"{t.ClosingThisWeek} tender(s) close within 7 days", "/tenders");
            if (t.ComplianceExpired > 0) Add("danger", "Compliance", $"{t.ComplianceExpired} compliance document(s) have expired", "/tenders");
            if (t.ComplianceExpiring45d > 0) Add("warn", "Compliance", $"{t.ComplianceExpiring45d} compliance document(s) expire within 45 days", "/tenders");
            if (st.OutOfStock > 0) Add("warn", "Stock", $"{st.OutOfStock} SKU(s) out of stock", "/stock-management");
            if (st.LowStock > 0) Add("info", "Stock", $"{st.LowStock} SKU(s) at or below reorder level", "/stock-management");
            var isWeekday = DateTime.Now.DayOfWeek != DayOfWeek.Saturday && DateTime.Now.DayOfWeek != DayOfWeek.Sunday;
            if (isWeekday && DateTime.Now.Hour >= 9 && hr.PresentToday == 0 && hr.BiometricRegistered > 0)
                Add("danger", "HR", "No biometric clock-ins recorded today — check the clocking machine", "/hr");
            if (hr.LeavePending > 0) Add("info", "HR", $"{hr.LeavePending} leave request(s) awaiting approval", "/hr");
            if (hr.ContractsExpiring90d > 0) Add("warn", "HR", $"{hr.ContractsExpiring90d} employment contract(s) end within 90 days", "/hr");
            if (hr.DisciplinaryOpen > 0) Add("info", "HR", $"{hr.DisciplinaryOpen} open disciplinary case(s)", "/hr");
            if (f.MaintenanceOverdue > 0) Add("warn", "Fleet", $"{f.MaintenanceOverdue} vehicle maintenance job(s) overdue", "/logistics");
            if (f.LicencesExpired > 0) Add("danger", "Fleet", $"{f.LicencesExpired} active driver(s) with expired licences", "/logistics");
            if (f.LicencesExpiring60d > 0) Add("warn", "Fleet", $"{f.LicencesExpiring60d} driver licence(s) expire within 60 days", "/logistics");
            if (f.HighIncidents30d > 0) Add("warn", "Fleet", $"{f.HighIncidents30d} high-severity driving incident(s) in the last 30 days", "/logistics");
            if (lg.BookingsAwaitingReview > 0) Add("info", "Logistics", $"{lg.BookingsAwaitingReview} client booking(s) awaiting acceptance", "/logistics/shipments");
            if (lg.ShipmentsFailed > 0) Add("warn", "Logistics", $"{lg.ShipmentsFailed} shipment(s) with a failed collection/delivery", "/logistics/shipments");
            if (lg.BackorderLines > 0) Add("info", "Logistics", $"{lg.BackorderLines:N0} backorder lines worth R{lg.BackorderValue:N0}", "/logistics");
            if (p.OverdueCards > 0) Add("warn", "Projects", $"{p.OverdueCards} project task(s) overdue", "/departments");
            if (su.HighPriorityOpen > 0) Add("warn", "Support", $"{su.HighPriorityOpen} high-priority support ticket(s) open", "/support");
            if (fi.Payments.Pending > 0) Add("info", "Finance", $"{fi.Payments.Pending} payment(s) awaiting release · R{fi.Payments.PendingAmount:N0}", "/finance");
            if (fi.Requisitions.Requested > 0) Add("info", "Finance", $"{fi.Requisitions.Requested} requisition(s) awaiting finance · R{fi.Requisitions.RequestedAmount:N0}", "/finance");
            if (pl.MyPendingApprovals > 0) Add("warn", "Paperless", $"{pl.MyPendingApprovals} document(s) waiting for your approval", "/documents/paperless");

            var order = new Dictionary<string, int> { ["danger"] = 0, ["warn"] = 1, ["info"] = 2 };
            return a.OrderBy(x => order[x.severity]).ToList();
        }

        // ==================================================================
        // GET: api/management/approvals
        // Paperless documents awaiting the current director's sign-off/approval
        // (present) plus those they've already actioned (previous).
        // ==================================================================
        [HttpGet("approvals")]
        public async Task<IActionResult> GetApprovals()
        {
            var (uid, email) = GetCurrentUser();
            var emailLc = (email ?? string.Empty).Trim().ToLowerInvariant();

            var docs = await _context.PaperlessDocuments.AsNoTracking()
                .Where(d => d.ParentId == null)
                .OrderByDescending(d => d.UpdatedAt)
                .Select(d => new
                {
                    d.Id, d.Name, d.Mime, d.Status, d.Progress, d.Routing,
                    d.CreatedBy, d.UpdatedAt, d.RecipientsJson, d.AccessUserIdsJson
                })
                .ToListAsync();

            var pending = new List<object>();
            var actioned = new List<object>();

            foreach (var d in docs)
            {
                var recips = ParseRecipients(d.RecipientsJson);
                var mine = recips.FirstOrDefault(r =>
                    !string.IsNullOrWhiteSpace(r.email) &&
                    r.email!.Trim().ToLowerInvariant() == emailLc);
                if (mine == null) continue;

                var entry = new
                {
                    id = d.Id,
                    name = d.Name,
                    mime = d.Mime,
                    status = d.Status,
                    progress = d.Progress,
                    routing = d.Routing,
                    myRole = mine.role,
                    myState = string.IsNullOrWhiteSpace(mine.state) ? "pending" : mine.state,
                    createdBy = d.CreatedBy,
                    updatedAt = d.UpdatedAt.ToString("o")
                };

                if (IsPending(mine.state)) pending.Add(entry);
                else actioned.Add(entry);
            }

            return Ok(new { pending, actioned });
        }
    }
}
