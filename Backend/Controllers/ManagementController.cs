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

            var sales = await BuildSalesSummary(now, startOfYear);
            var tenders = await BuildTendersSummary(now, startOfYear, endOfWeek);
            var logistics = await BuildLogisticsSummary();
            var finance = await BuildFinanceSummary();
            var paperless = await BuildPaperlessSummary(uid, emailLc);

            return Ok(new
            {
                generatedAt = now.ToString("o"),
                sales,
                tenders,
                logistics,
                finance,
                paperless
            });
        }

        private async Task<object> BuildSalesSummary(DateTime now, DateTime startOfYear)
        {
            try
            {
                var rows = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.Year == now.Year)
                    .Select(i => new { i.TransactionDate, Net = i.SalesAmount - i.SalesReturns, i.SourceCompany })
                    .ToListAsync();

                var ytdNet = rows.Sum(r => r.Net);
                var monthNet = rows.Where(r => r.TransactionDate.Month == now.Month).Sum(r => r.Net);
                var byCompany = rows
                    .GroupBy(r => r.SourceCompany)
                    .Select(g => new { code = g.Key, netSales = g.Sum(x => x.Net), count = g.Count() })
                    .OrderByDescending(x => x.netSales)
                    .ToList();

                return new
                {
                    ytdNetSales = ytdNet,
                    monthNetSales = monthNet,
                    transactionCount = rows.Count,
                    byCompany
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: sales summary failed");
                return new { ytdNetSales = 0m, monthNetSales = 0m, transactionCount = 0, byCompany = Array.Empty<object>() };
            }
        }

        private async Task<object> BuildTendersSummary(DateTime now, DateTime startOfYear, DateTime endOfWeek)
        {
            try
            {
                var tenders = await _context.Tenders.AsNoTracking()
                    .Select(t => new { t.Status, t.ClosingDate, t.AwardDate, t.EstimatedValue, t.AwardedValue, t.UpdatedAt })
                    .ToListAsync();

                bool Open(string s) => s != "Awarded" && s != "Lost" && s != "Cancelled";

                return new
                {
                    active = tenders.Count(t => Open(t.Status)),
                    closingThisWeek = tenders.Count(t => Open(t.Status) && t.ClosingDate >= now && t.ClosingDate <= endOfWeek),
                    awardedYtd = tenders.Count(t => t.Status == "Awarded" && t.AwardDate >= startOfYear),
                    lostYtd = tenders.Count(t => t.Status == "Lost" && t.UpdatedAt >= startOfYear),
                    valueSubmitted = tenders.Where(t => t.Status == "Submitted" || t.Status == "Evaluation" || t.Status == "Awarded" || t.Status == "Lost").Sum(t => t.EstimatedValue ?? 0),
                    valueAwarded = tenders.Where(t => t.Status == "Awarded").Sum(t => t.AwardedValue ?? t.EstimatedValue ?? 0)
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: tenders summary failed");
                return new { active = 0, closingThisWeek = 0, awardedYtd = 0, lostYtd = 0, valueSubmitted = 0m, valueAwarded = 0m };
            }
        }

        private async Task<object> BuildLogisticsSummary()
        {
            try
            {
                var byStatus = await _context.Loads.AsNoTracking()
                    .GroupBy(l => l.Status)
                    .Select(g => new { status = g.Key, count = g.Count() })
                    .ToListAsync();

                int Cnt(string s) => byStatus.FirstOrDefault(x => x.status == s)?.count ?? 0;

                var pendingRequests = 0;
                try
                {
                    pendingRequests = await _context.CondomDeliveryRequests
                        .CountAsync(r => r.Status == "Pending" || r.Status == "Approved" || r.Status == "In Transit");
                }
                catch { /* delivery requests optional */ }

                return new
                {
                    total = byStatus.Sum(x => x.count),
                    available = Cnt("Available"),
                    assigned = Cnt("Assigned"),
                    inTransit = Cnt("InTransit"),
                    delivered = Cnt("Delivered"),
                    cancelled = Cnt("Cancelled"),
                    pendingDeliveryRequests = pendingRequests
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: logistics summary failed");
                return new { total = 0, available = 0, assigned = 0, inTransit = 0, delivered = 0, cancelled = 0, pendingDeliveryRequests = 0 };
            }
        }

        private async Task<object> BuildFinanceSummary()
        {
            try
            {
                var reqs = await _context.Requisitions.AsNoTracking()
                    .Where(r => r.Status != "Cancelled")
                    .Select(r => new { r.FinanceStatus, Total = r.AmountEwallet + r.DieselAmount })
                    .ToListAsync();

                var payments = await _context.Payments.AsNoTracking()
                    .Select(p => new { p.Status, p.Amount })
                    .ToListAsync();

                var bookInvoiceCount = 0;
                try { bookInvoiceCount = await _context.BookInvoices.CountAsync(); } catch { }

                return new
                {
                    requisitions = new
                    {
                        requested = reqs.Count(r => r.FinanceStatus == "Requested"),
                        requestedAmount = reqs.Where(r => r.FinanceStatus == "Requested").Sum(r => r.Total),
                        paid = reqs.Count(r => r.FinanceStatus == "Paid"),
                        paidAmount = reqs.Where(r => r.FinanceStatus == "Paid").Sum(r => r.Total),
                        rejected = reqs.Count(r => r.FinanceStatus == "Rejected")
                    },
                    payments = new
                    {
                        pending = payments.Count(p => p.Status == "Pending" || p.Status == "Processing"),
                        pendingAmount = payments.Where(p => p.Status == "Pending" || p.Status == "Processing").Sum(p => p.Amount),
                        completed = payments.Count(p => p.Status == "Completed"),
                        completedAmount = payments.Where(p => p.Status == "Completed").Sum(p => p.Amount)
                    },
                    bookInvoices = bookInvoiceCount
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: finance summary failed");
                return new
                {
                    requisitions = new { requested = 0, requestedAmount = 0m, paid = 0, paidAmount = 0m, rejected = 0 },
                    payments = new { pending = 0, pendingAmount = 0m, completed = 0, completedAmount = 0m },
                    bookInvoices = 0
                };
            }
        }

        private async Task<object> BuildPaperlessSummary(int uid, string emailLc)
        {
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

                return new
                {
                    total = docs.Count,
                    completed,
                    inProgress,
                    orgPendingApprovals,
                    myPendingApprovals
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Management: paperless summary failed");
                return new { total = 0, completed = 0, inProgress = 0, orgPendingApprovals = 0, myPendingApprovals = 0 };
            }
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
