using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance;
using System.Security.Claims;

using ProjectTracker.API.Authorization;
namespace ProjectTracker.API.Controllers.Finance
{
    /// <summary>
    /// Recurring monthly financial commitments / debit orders (fibre, VoIP airtime,
    /// insurance, rent, subscriptions). A living list finance keeps so nothing is
    /// forgotten and monthly cash-flow is predictable.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/finance/recurring-payments")]
    [RequireModule("finance", AlsoAllowRoles = "Finance")]
    public class RecurringPaymentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<RecurringPaymentsController> _logger;

        public RecurringPaymentsController(ApplicationDbContext context, ILogger<RecurringPaymentsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int? CurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("UserId")?.Value;
            return int.TryParse(claim, out var id) ? id : (int?)null;
        }

        private string? CurrentUserName() =>
            User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value;

        // GET: api/finance/recurring-payments?category=Fibre&departmentId=3&activeOnly=true
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetAll(
            [FromQuery] string? category = null,
            [FromQuery] int? departmentId = null,
            [FromQuery] bool activeOnly = false,
            [FromQuery] string? search = null)
        {
            var query = _context.RecurringPayments.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(category)) query = query.Where(r => r.Category == category);
            if (departmentId.HasValue) query = query.Where(r => r.DepartmentId == departmentId.Value);
            if (activeOnly) query = query.Where(r => r.IsActive);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                query = query.Where(r =>
                    r.Name.ToLower().Contains(s) ||
                    (r.Supplier != null && r.Supplier.ToLower().Contains(s)) ||
                    (r.Notes != null && r.Notes.ToLower().Contains(s)));
            }

            var items = await query
                .OrderByDescending(r => r.IsActive)
                .ThenBy(r => r.Category)
                .ThenBy(r => r.Name)
                .Select(r => ToDto(r))
                .ToListAsync();

            return Ok(items);
        }

        // GET: api/finance/recurring-payments/summary
        // Totals for the commitments dashboard.
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary()
        {
            var all = await _context.RecurringPayments.AsNoTracking().ToListAsync();
            var active = all.Where(r => r.IsActive).ToList();

            // Normalise to a monthly figure for a comparable total.
            decimal MonthlyEquivalent(RecurringPayment r) => r.Frequency switch
            {
                "Annually" => r.Amount / 12m,
                "Quarterly" => r.Amount / 3m,
                _ => r.Amount
            };

            var byCategory = active
                .GroupBy(r => r.Category)
                .Select(g => new
                {
                    category = g.Key,
                    count = g.Count(),
                    monthlyTotal = g.Sum(MonthlyEquivalent)
                })
                .OrderByDescending(x => x.monthlyTotal)
                .ToList();

            return Ok(new
            {
                totalCount = all.Count,
                activeCount = active.Count,
                inactiveCount = all.Count - active.Count,
                monthlyTotal = active.Sum(MonthlyEquivalent),
                annualTotal = active.Sum(MonthlyEquivalent) * 12m,
                byCategory
            });
        }

        // GET: api/finance/recurring-payments/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetOne(int id)
        {
            var r = await _context.RecurringPayments.FindAsync(id);
            if (r == null) return NotFound(new { error = "Commitment not found" });
            return Ok(ToDto(r));
        }

        // POST: api/finance/recurring-payments
        [HttpPost]
        public async Task<ActionResult<object>> Create([FromBody] RecurringPaymentUpsertDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { error = "Name is required" });

            var r = new RecurringPayment
            {
                CreatedByUserId = CurrentUserId(),
                CreatedByName = CurrentUserName(),
                CreatedAt = DateTime.UtcNow
            };
            Apply(r, dto);

            _context.RecurringPayments.Add(r);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Created recurring payment {Id} ({Name})", r.Id, r.Name);
            return CreatedAtAction(nameof(GetOne), new { id = r.Id }, ToDto(r));
        }

        // PUT: api/finance/recurring-payments/{id}
        [HttpPut("{id}")]
        public async Task<ActionResult<object>> Update(int id, [FromBody] RecurringPaymentUpsertDto dto)
        {
            var r = await _context.RecurringPayments.FindAsync(id);
            if (r == null) return NotFound(new { error = "Commitment not found" });

            Apply(r, dto);
            r.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(ToDto(r));
        }

        // PUT: api/finance/recurring-payments/{id}/toggle
        [HttpPut("{id}/toggle")]
        public async Task<ActionResult<object>> Toggle(int id)
        {
            var r = await _context.RecurringPayments.FindAsync(id);
            if (r == null) return NotFound(new { error = "Commitment not found" });

            r.IsActive = !r.IsActive;
            r.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(ToDto(r));
        }

        // DELETE: api/finance/recurring-payments/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var r = await _context.RecurringPayments.FindAsync(id);
            if (r == null) return NotFound(new { error = "Commitment not found" });

            _context.RecurringPayments.Remove(r);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Commitment deleted", id });
        }

        private static void Apply(RecurringPayment r, RecurringPaymentUpsertDto dto)
        {
            r.Name = dto.Name.Trim();
            r.Supplier = dto.Supplier?.Trim();
            r.Category = string.IsNullOrWhiteSpace(dto.Category) ? "Other" : dto.Category.Trim();
            r.Amount = dto.Amount;
            r.Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "ZAR" : dto.Currency;
            r.Frequency = string.IsNullOrWhiteSpace(dto.Frequency) ? "Monthly" : dto.Frequency;
            r.DayOfMonth = dto.DayOfMonth;
            r.DepartmentId = dto.DepartmentId;
            r.CompanyName = dto.CompanyName?.Trim();
            r.PaymentMethod = dto.PaymentMethod?.Trim();
            r.AccountReference = dto.AccountReference?.Trim();
            r.IsActive = dto.IsActive ?? r.IsActive;
            if (dto.StartDate.HasValue) r.StartDate = dto.StartDate.Value;
            r.EndDate = dto.EndDate;
            r.Notes = dto.Notes?.Trim();
        }

        private static object ToDto(RecurringPayment r) => new
        {
            id = r.Id,
            name = r.Name,
            supplier = r.Supplier,
            category = r.Category,
            amount = r.Amount,
            currency = r.Currency,
            frequency = r.Frequency,
            dayOfMonth = r.DayOfMonth,
            departmentId = r.DepartmentId,
            companyName = r.CompanyName,
            paymentMethod = r.PaymentMethod,
            accountReference = r.AccountReference,
            isActive = r.IsActive,
            startDate = r.StartDate,
            endDate = r.EndDate,
            notes = r.Notes,
            createdByName = r.CreatedByName,
            createdAt = r.CreatedAt,
            updatedAt = r.UpdatedAt
        };
    }

    public class RecurringPaymentUpsertDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Supplier { get; set; }
        public string? Category { get; set; }
        public decimal Amount { get; set; }
        public string? Currency { get; set; }
        public string? Frequency { get; set; }
        public int? DayOfMonth { get; set; }
        public int? DepartmentId { get; set; }
        public string? CompanyName { get; set; }
        public string? PaymentMethod { get; set; }
        public string? AccountReference { get; set; }
        public bool? IsActive { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? Notes { get; set; }
    }
}
