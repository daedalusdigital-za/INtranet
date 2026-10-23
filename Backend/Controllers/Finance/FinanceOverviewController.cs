using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

using ProjectTracker.API.Authorization;
namespace ProjectTracker.API.Controllers.Finance
{
    /// <summary>
    /// Roll-up endpoints for the split finance module:
    ///   • Creditors (Accounts Payable) — money the business owes: unpaid supplier
    ///     invoices, recurring commitments, logistics requisitions, pending expenses.
    ///   • Debtors (Accounts Receivable) — money owed to the business from sales,
    ///     aggregated per customer from the imported ERP sales transactions.
    /// These are read-only aggregations that sit on top of existing data.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/finance")]
    [RequireModule("finance", AlsoAllowRoles = "Finance")]
    public class FinanceOverviewController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FinanceOverviewController> _logger;

        public FinanceOverviewController(ApplicationDbContext context, ILogger<FinanceOverviewController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/finance/creditors/summary
        [HttpGet("creditors/summary")]
        public async Task<IActionResult> GetCreditorsSummary()
        {
            // Unpaid supplier invoices (Books) — exclude Draft/Archived, same rule as the invoice summary.
            var invoices = await _context.BookInvoices
                .Select(b => new { b.Status, b.Total, b.PaymentDate })
                .ToListAsync();

            var unpaidInvoices = invoices.Where(b =>
                b.Status != "Paid" && !b.PaymentDate.HasValue &&
                b.Status != "Draft" && b.Status != "Archived").ToList();

            // Active recurring commitments — normalise to a monthly figure.
            var commitments = await _context.RecurringPayments
                .Where(r => r.IsActive)
                .Select(r => new { r.Amount, r.Frequency })
                .ToListAsync();
            decimal MonthlyEq(string freq, decimal amt) => freq switch
            {
                "Annually" => amt / 12m,
                "Quarterly" => amt / 3m,
                _ => amt
            };
            var commitmentsMonthly = commitments.Sum(c => MonthlyEq(c.Frequency, c.Amount));

            // Logistics requisitions (petty cash / e-wallet) still active.
            var requisitions = await _context.Requisitions
                .Where(r => r.Status == "Active")
                .Select(r => new { r.AmountEwallet, r.DieselAmount })
                .ToListAsync();
            var requisitionsTotal = requisitions.Sum(r => r.AmountEwallet + r.DieselAmount);

            // Pending expenses awaiting payment.
            var pendingExpenses = await _context.Expenses
                .Where(e => e.Status == "Pending" || e.Status == "Approved")
                .Select(e => e.TotalAmount)
                .ToListAsync();
            var pendingExpensesTotal = pendingExpenses.Sum();

            var totalPayable =
                unpaidInvoices.Sum(b => b.Total) +
                commitmentsMonthly +
                requisitionsTotal +
                pendingExpensesTotal;

            return Ok(new
            {
                totalPayable,
                unpaidInvoices = new { count = unpaidInvoices.Count, amount = unpaidInvoices.Sum(b => b.Total) },
                commitments = new { count = commitments.Count, monthlyAmount = commitmentsMonthly },
                requisitions = new { count = requisitions.Count, amount = requisitionsTotal },
                pendingExpenses = new { count = pendingExpenses.Count, amount = pendingExpensesTotal }
            });
        }

        // GET: api/finance/creditors/requisitions?year=&month=
        // The logistics requisitions surfaced inside finance as payables.
        [HttpGet("creditors/requisitions")]
        public async Task<IActionResult> GetRequisitions([FromQuery] int? year, [FromQuery] int? month, [FromQuery] string? status)
        {
            var query = _context.Requisitions.AsNoTracking().AsQueryable();
            if (year.HasValue) query = query.Where(r => r.PeriodYear == year.Value);
            if (month.HasValue) query = query.Where(r => r.PeriodMonth == month.Value);
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(r => r.Status == status);

            var items = await query
                .OrderByDescending(r => r.Date)
                .Select(r => new
                {
                    id = r.Id,
                    rfNumber = r.RfNumber,
                    date = r.Date,
                    paidTo = r.PaidTo,
                    amountEwallet = r.AmountEwallet,
                    dieselAmount = r.DieselAmount,
                    total = r.AmountEwallet + r.DieselAmount,
                    reason = r.Reason,
                    paymentMethod = r.PaymentMethod,
                    status = r.Status,
                    periodYear = r.PeriodYear,
                    periodMonth = r.PeriodMonth
                })
                .ToListAsync();

            return Ok(new
            {
                count = items.Count,
                total = items.Sum(i => i.total),
                items
            });
        }

        // ============================================================================
        // Requisitions payment workflow (Requested / Paid / Rejected) — surfaced on
        // the main finance dashboard. Sources requisitions from Logistics and any
        // other department that raises them, excluding logistics-cancelled forms.
        // ============================================================================

        // GET: api/finance/requisitions/summary
        [HttpGet("requisitions/summary")]
        public async Task<IActionResult> GetRequisitionsSummary()
        {
            var rows = await _context.Requisitions.AsNoTracking()
                .Where(r => r.Status != "Cancelled")
                .Select(r => new { r.FinanceStatus, Total = r.AmountEwallet + r.DieselAmount })
                .ToListAsync();

            decimal AmtFor(string s) => rows.Where(r => r.FinanceStatus == s).Sum(r => r.Total);
            int CntFor(string s) => rows.Count(r => r.FinanceStatus == s);

            return Ok(new
            {
                requested = CntFor("Requested"),
                paid = CntFor("Paid"),
                rejected = CntFor("Rejected"),
                total = rows.Count,
                requestedAmount = AmtFor("Requested"),
                paidAmount = AmtFor("Paid"),
                rejectedAmount = AmtFor("Rejected")
            });
        }

        // GET: api/finance/requisitions?status=Requested|Paid|Rejected|all
        [HttpGet("requisitions")]
        public async Task<IActionResult> GetFinanceRequisitions([FromQuery] string? status)
        {
            var query = _context.Requisitions.AsNoTracking()
                .Where(r => r.Status != "Cancelled");

            if (!string.IsNullOrWhiteSpace(status) && status != "all")
                query = query.Where(r => r.FinanceStatus == status);

            var items = await query
                .OrderByDescending(r => r.Date)
                .Select(r => new
                {
                    id = r.Id,
                    rfNumber = r.RfNumber,
                    date = r.Date,
                    paidTo = r.PaidTo,
                    department = r.Department ?? "Logistics",
                    amountEwallet = r.AmountEwallet,
                    dieselAmount = r.DieselAmount,
                    total = r.AmountEwallet + r.DieselAmount,
                    reason = r.Reason,
                    paymentMethod = r.PaymentMethod,
                    financeStatus = r.FinanceStatus,
                    paidDate = r.PaidDate,
                    financeNotes = r.FinanceNotes,
                    periodYear = r.PeriodYear,
                    periodMonth = r.PeriodMonth
                })
                .Take(500)
                .ToListAsync();

            return Ok(items);
        }

        // PUT: api/finance/requisitions/{id}/status
        [HttpPut("requisitions/{id}/status")]
        public async Task<IActionResult> UpdateRequisitionStatus(int id, [FromBody] RequisitionStatusDto dto)
        {
            var req = await _context.Requisitions.FindAsync(id);
            if (req == null) return NotFound();

            var status = dto?.Status?.Trim();
            if (status != "Requested" && status != "Paid" && status != "Rejected")
                return BadRequest(new { error = "Status must be Requested, Paid or Rejected." });

            req.FinanceStatus = status;
            req.PaidDate = status == "Paid" ? (dto?.PaidDate ?? DateTime.UtcNow) : null;
            if (dto?.Notes != null) req.FinanceNotes = dto.Notes;
            req.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Requisition marked {status}." });
        }


        private static readonly Dictionary<string, string> CompanyNames = new()
        {
            ["PMT"] = "ProMed Technologies",
            ["ACM"] = "Access Medical",
            ["PHT"] = "Promed Pharmatech",
            ["SBT"] = "Sebenzani Trading"
        };

        private static string CompanyLabel(string? code) =>
            !string.IsNullOrWhiteSpace(code) && CompanyNames.TryGetValue(code, out var n) ? n : (code ?? "Unassigned");

        // GET: api/finance/creditors/by-company
        // Unpaid supplier invoices broken down by owning company.
        [HttpGet("creditors/by-company")]
        public async Task<IActionResult> GetCreditorsByCompany()
        {
            var invoices = await _context.BookInvoices
                .Where(b => b.Status != "Paid" && b.PaymentDate == null &&
                            b.Status != "Draft" && b.Status != "Archived")
                .Select(b => new { b.CompanyName, b.Total })
                .ToListAsync();

            var groups = invoices
                .GroupBy(b => string.IsNullOrWhiteSpace(b.CompanyName) ? "Unassigned" : b.CompanyName!)
                .Select(g => new { company = g.Key, count = g.Count(), amount = g.Sum(x => x.Total) })
                .OrderByDescending(g => g.amount)
                .ToList();

            return Ok(new { total = invoices.Sum(i => i.Total), groups });
        }

        // GET: api/finance/creditors/by-department
        // Unpaid supplier invoices broken down by department.
        [HttpGet("creditors/by-department")]
        public async Task<IActionResult> GetCreditorsByDepartment()
        {
            var invoices = await _context.BookInvoices
                .Where(b => b.Status != "Paid" && b.PaymentDate == null &&
                            b.Status != "Draft" && b.Status != "Archived")
                .Select(b => new { b.DepartmentId, b.Total })
                .ToListAsync();

            var deptNames = await _context.Departments
                .ToDictionaryAsync(d => d.DepartmentId, d => d.Name);

            var groups = invoices
                .GroupBy(b => b.DepartmentId)
                .Select(g => new
                {
                    departmentId = g.Key,
                    department = deptNames.TryGetValue(g.Key, out var n) ? n : "Unassigned",
                    count = g.Count(),
                    amount = g.Sum(x => x.Total)
                })
                .OrderByDescending(g => g.amount)
                .ToList();

            return Ok(new { total = invoices.Sum(i => i.Total), groups });
        }

        // GET: api/finance/debtors/summary?company=&year=&month=
        // Money owed to us from sales, aggregated from imported ERP sales transactions,
        // net of any collections recorded against each customer.
        [HttpGet("debtors/summary")]
        public async Task<IActionResult> GetDebtorsSummary([FromQuery] string? company, [FromQuery] int? year, [FromQuery] int? month)
        {
            var query = _context.ImportedInvoices.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(company)) query = query.Where(i => i.SourceCompany == company);
            if (year.HasValue) query = query.Where(i => i.Year == year.Value);
            if (month.HasValue) query = query.Where(i => i.TransactionDate.Month == month.Value);

            // Net sales = SalesAmount - SalesReturns. This is the receivable value from sales.
            var rows = await query
                .Select(i => new { i.CustomerNumber, i.CustomerName, i.SourceCompany, Net = i.SalesAmount - i.SalesReturns })
                .ToListAsync();

            // Collections recorded against these customers (optionally scoped to company).
            var payQuery = _context.DebtorPayments.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(company)) payQuery = payQuery.Where(p => p.SourceCompany == company);
            var payments = await payQuery
                .Select(p => new { p.CustomerNumber, p.SourceCompany, p.Amount })
                .ToListAsync();

            var collectedByCustomer = payments
                .GroupBy(p => p.CustomerNumber)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

            var byCustomer = rows
                .GroupBy(r => new { r.CustomerNumber, r.CustomerName })
                .Select(g =>
                {
                    var net = g.Sum(x => x.Net);
                    var collected = collectedByCustomer.TryGetValue(g.Key.CustomerNumber, out var c) ? c : 0m;
                    return new
                    {
                        customerNumber = g.Key.CustomerNumber,
                        customerName = g.Key.CustomerName,
                        company = g.Select(x => x.SourceCompany).FirstOrDefault(),
                        transactionCount = g.Count(),
                        netSales = net,
                        collected,
                        outstanding = net - collected
                    };
                })
                .OrderByDescending(x => x.outstanding)
                .ToList();

            // Per-company rollup.
            var byCompany = rows
                .GroupBy(r => r.SourceCompany)
                .Select(g =>
                {
                    var custNums = g.Select(x => x.CustomerNumber).Distinct().ToHashSet();
                    var net = g.Sum(x => x.Net);
                    var collected = payments.Where(p => p.SourceCompany == g.Key).Sum(p => p.Amount);
                    return new
                    {
                        code = g.Key,
                        company = CompanyLabel(g.Key),
                        customerCount = custNums.Count,
                        transactionCount = g.Count(),
                        netSales = net,
                        collected,
                        outstanding = net - collected
                    };
                })
                .OrderByDescending(x => x.outstanding)
                .ToList();

            var totalNet = rows.Sum(r => r.Net);
            var totalCollected = payments.Sum(p => p.Amount);

            return Ok(new
            {
                totalReceivable = totalNet,
                totalCollected,
                totalOutstanding = totalNet - totalCollected,
                customerCount = byCustomer.Count,
                transactionCount = rows.Count,
                byCompany,
                topCustomers = byCustomer.Take(10),
                byCustomer
            });
        }

        // GET: api/finance/debtors/customer/{customerNumber}
        // Drill-down: all sales transactions + collection history for one customer.
        [HttpGet("debtors/customer/{customerNumber}")]
        public async Task<IActionResult> GetDebtorCustomer(string customerNumber, [FromQuery] int? year)
        {
            var query = _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.CustomerNumber == customerNumber);
            if (year.HasValue) query = query.Where(i => i.Year == year.Value);

            var items = await query
                .OrderByDescending(i => i.TransactionDate)
                .Select(i => new
                {
                    id = i.Id,
                    transactionNumber = i.TransactionNumber,
                    transactionDate = i.TransactionDate,
                    transactionType = i.TransactionType,
                    company = i.SourceCompany,
                    productCode = i.ProductCode,
                    productDescription = i.ProductDescription,
                    quantity = i.Quantity,
                    netSales = i.SalesAmount - i.SalesReturns,
                    status = i.Status
                })
                .Take(500)
                .ToListAsync();

            var payments = await _context.DebtorPayments.AsNoTracking()
                .Where(p => p.CustomerNumber == customerNumber)
                .OrderByDescending(p => p.PaymentDate)
                .Select(p => new
                {
                    id = p.Id,
                    amount = p.Amount,
                    paymentDate = p.PaymentDate,
                    paymentMethod = p.PaymentMethod,
                    paymentReference = p.PaymentReference,
                    company = p.SourceCompany,
                    notes = p.Notes,
                    recordedByName = p.RecordedByName
                })
                .ToListAsync();

            var net = items.Sum(i => i.netSales);
            var collected = payments.Sum(p => p.amount);

            return Ok(new
            {
                customerNumber,
                customerName = items.Count > 0
                    ? await query.Select(i => i.CustomerName).FirstOrDefaultAsync()
                    : null,
                transactionCount = items.Count,
                netSales = net,
                collected,
                outstanding = net - collected,
                items,
                payments
            });
        }

        // POST: api/finance/debtors/collect
        // Record a collection/receipt against a customer's receivable balance.
        [HttpPost("debtors/collect")]
        public async Task<IActionResult> RecordCollection([FromBody] DebtorCollectionDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.CustomerNumber))
                return BadRequest(new { error = "CustomerNumber is required." });
            if (dto.Amount <= 0)
                return BadRequest(new { error = "Amount must be greater than zero." });

            // Fill in the customer name / company from sales data if not supplied.
            var sample = await _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.CustomerNumber == dto.CustomerNumber)
                .Select(i => new { i.CustomerName, i.SourceCompany })
                .FirstOrDefaultAsync();

            var payment = new Models.Finance.DebtorPayment
            {
                CustomerNumber = dto.CustomerNumber,
                CustomerName = dto.CustomerName ?? sample?.CustomerName,
                SourceCompany = dto.Company ?? sample?.SourceCompany,
                Amount = dto.Amount,
                PaymentDate = dto.PaymentDate ?? DateTime.UtcNow,
                PaymentMethod = dto.PaymentMethod,
                PaymentReference = dto.PaymentReference,
                Notes = dto.Notes,
                RecordedByName = dto.RecordedByName,
                CreatedAt = DateTime.UtcNow
            };

            _context.DebtorPayments.Add(payment);
            await _context.SaveChangesAsync();

            return Ok(new { id = payment.Id, message = "Collection recorded." });
        }

        // GET: api/finance/debtors/payments?company=&customerNumber=
        [HttpGet("debtors/payments")]
        public async Task<IActionResult> GetCollections([FromQuery] string? company, [FromQuery] string? customerNumber)
        {
            var q = _context.DebtorPayments.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(company)) q = q.Where(p => p.SourceCompany == company);
            if (!string.IsNullOrWhiteSpace(customerNumber)) q = q.Where(p => p.CustomerNumber == customerNumber);

            var items = await q
                .OrderByDescending(p => p.PaymentDate)
                .Select(p => new
                {
                    id = p.Id,
                    customerNumber = p.CustomerNumber,
                    customerName = p.CustomerName,
                    company = p.SourceCompany,
                    amount = p.Amount,
                    paymentDate = p.PaymentDate,
                    paymentMethod = p.PaymentMethod,
                    paymentReference = p.PaymentReference,
                    notes = p.Notes,
                    recordedByName = p.RecordedByName
                })
                .Take(500)
                .ToListAsync();

            return Ok(new { count = items.Count, total = items.Sum(i => i.amount), items });
        }

        // DELETE: api/finance/debtors/payments/{id}
        [HttpDelete("debtors/payments/{id}")]
        public async Task<IActionResult> DeleteCollection(int id)
        {
            var p = await _context.DebtorPayments.FindAsync(id);
            if (p == null) return NotFound();
            _context.DebtorPayments.Remove(p);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Collection removed." });
        }
    }

    public class DebtorCollectionDto
    {
        public string CustomerNumber { get; set; } = string.Empty;
        public string? CustomerName { get; set; }
        public string? Company { get; set; }
        public decimal Amount { get; set; }
        public DateTime? PaymentDate { get; set; }
        public string? PaymentMethod { get; set; }
        public string? PaymentReference { get; set; }
        public string? Notes { get; set; }
        public string? RecordedByName { get; set; }
    }

    public class RequisitionStatusDto
    {
        public string? Status { get; set; }
        public DateTime? PaidDate { get; set; }
        public string? Notes { get; set; }
    }
}
