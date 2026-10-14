using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class RequisitionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<RequisitionsController> _logger;

        public RequisitionsController(ApplicationDbContext context, ILogger<RequisitionsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int? CurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out var id) ? id : (int?)null;
        }

        /// <summary>
        /// List requisitions, optionally filtered by year, month, status or a free-text search.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<RequisitionDto>>> GetRequisitions(
            [FromQuery] int? year = null,
            [FromQuery] int? month = null,
            [FromQuery] string? status = null,
            [FromQuery] string? search = null)
        {
            var query = _context.Requisitions.AsQueryable();

            if (year.HasValue) query = query.Where(r => r.PeriodYear == year.Value);
            if (month.HasValue) query = query.Where(r => r.PeriodMonth == month.Value);
            if (!string.IsNullOrEmpty(status) && status != "all")
                query = query.Where(r => r.Status == status);

            if (!string.IsNullOrEmpty(search))
            {
                var s = search.ToLower();
                query = query.Where(r =>
                    (r.RfNumber != null && r.RfNumber.ToLower().Contains(s)) ||
                    (r.PaidTo != null && r.PaidTo.ToLower().Contains(s)) ||
                    (r.CellNumber != null && r.CellNumber.ToLower().Contains(s)) ||
                    (r.Reason != null && r.Reason.ToLower().Contains(s)));
            }

            var list = await query
                .OrderBy(r => r.PeriodYear).ThenBy(r => r.PeriodMonth)
                .ThenBy(r => r.Date).ThenBy(r => r.Id)
                .ToListAsync();

            var userIds = list.Where(r => r.CreatedByUserId.HasValue)
                .Select(r => r.CreatedByUserId!.Value).Distinct().ToList();
            var names = await _context.Users
                .Where(u => userIds.Contains(u.UserId))
                .ToDictionaryAsync(u => u.UserId, u => (u.Name + " " + u.Surname).Trim());

            return Ok(list.Select(r => ToDto(r,
                r.CreatedByUserId.HasValue && names.TryGetValue(r.CreatedByUserId.Value, out var n) ? n : null)));
        }

        /// <summary>
        /// Which months have data, most recent first — used to populate the period picker.
        /// </summary>
        [HttpGet("periods")]
        public async Task<ActionResult<IEnumerable<object>>> GetPeriods()
        {
            var periods = await _context.Requisitions
                .GroupBy(r => new { r.PeriodYear, r.PeriodMonth })
                .Select(g => new
                {
                    year = g.Key.PeriodYear,
                    month = g.Key.PeriodMonth,
                    count = g.Count(),
                    totalEwallet = g.Where(x => x.Status == "Active").Sum(x => x.AmountEwallet),
                    totalDiesel = g.Where(x => x.Status == "Active").Sum(x => x.DieselAmount)
                })
                .OrderByDescending(p => p.year).ThenByDescending(p => p.month)
                .ToListAsync();

            return Ok(periods);
        }

        /// <summary>
        /// Totals for a given month: e-wallet, diesel, non-diesel, counts, and a
        /// per-ISO-week breakdown (mirrors the weekly sub-totals on the paper form).
        /// </summary>
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary([FromQuery] int year, [FromQuery] int month)
        {
            var rows = await _context.Requisitions
                .Where(r => r.PeriodYear == year && r.PeriodMonth == month && r.Status == "Active")
                .ToListAsync();

            var totalEwallet = rows.Sum(r => r.AmountEwallet);
            var totalDiesel = rows.Sum(r => r.DieselAmount);

            var cal = System.Globalization.CultureInfo.InvariantCulture.Calendar;
            var weeks = rows
                .Where(r => r.Date.HasValue)
                .GroupBy(r => cal.GetWeekOfYear(r.Date!.Value,
                    System.Globalization.CalendarWeekRule.FirstFourDayWeek, DayOfWeek.Monday))
                .Select(g => new
                {
                    week = g.Key,
                    from = g.Min(x => x.Date),
                    to = g.Max(x => x.Date),
                    count = g.Count(),
                    ewallet = g.Sum(x => x.AmountEwallet),
                    diesel = g.Sum(x => x.DieselAmount)
                })
                .OrderBy(w => w.from)
                .ToList();

            return Ok(new
            {
                year,
                month,
                activeCount = rows.Count,
                cancelledCount = await _context.Requisitions.CountAsync(r =>
                    r.PeriodYear == year && r.PeriodMonth == month && r.Status == "Cancelled"),
                totalEwallet,
                totalDiesel,
                totalNonDiesel = totalEwallet - totalDiesel,
                weeks
            });
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<RequisitionDto>> GetRequisition(int id)
        {
            var r = await _context.Requisitions.FindAsync(id);
            if (r == null) return NotFound();
            return Ok(ToDto(r, await ResolveUserNameAsync(r.CreatedByUserId)));
        }

        private async Task<string?> ResolveUserNameAsync(int? userId)
        {
            if (!userId.HasValue) return null;
            return await _context.Users.Where(u => u.UserId == userId.Value)
                .Select(u => (u.Name + " " + u.Surname).Trim())
                .FirstOrDefaultAsync();
        }

        [HttpPost]
        public async Task<ActionResult<RequisitionDto>> CreateRequisition([FromBody] RequisitionUpsertDto dto)
        {
            var r = new Requisition();
            ApplyUpsert(r, dto);
            r.CreatedByUserId = CurrentUserId();
            r.CreatedAt = DateTime.UtcNow;

            _context.Requisitions.Add(r);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetRequisition), new { id = r.Id }, ToDto(r, await ResolveUserNameAsync(r.CreatedByUserId)));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<RequisitionDto>> UpdateRequisition(int id, [FromBody] RequisitionUpsertDto dto)
        {
            var r = await _context.Requisitions.FindAsync(id);
            if (r == null) return NotFound();

            ApplyUpsert(r, dto);
            r.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(ToDto(r, await ResolveUserNameAsync(r.CreatedByUserId)));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRequisition(int id)
        {
            var r = await _context.Requisitions.FindAsync(id);
            if (r == null) return NotFound();
            _context.Requisitions.Remove(r);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private static void ApplyUpsert(Requisition r, RequisitionUpsertDto dto)
        {
            r.RfNumber = dto.RfNumber?.Trim();
            r.Date = dto.Date;
            r.PaidTo = dto.PaidTo?.Trim();
            r.CellNumber = dto.CellNumber?.Trim();
            r.AmountEwallet = dto.AmountEwallet;
            r.Reason = dto.Reason?.Trim();
            r.DieselAmount = dto.DieselAmount;
            r.Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status.Trim();
            r.PaymentMethod = dto.PaymentMethod?.Trim();

            // Derive the period from the date; fall back to today for undated rows.
            var basis = dto.Date ?? DateTime.UtcNow;
            r.PeriodYear = dto.PeriodYear ?? basis.Year;
            r.PeriodMonth = dto.PeriodMonth ?? basis.Month;
        }

        private static RequisitionDto ToDto(Requisition r, string? createdByName = null) => new()
        {
            Id = r.Id,
            RfNumber = r.RfNumber,
            Date = r.Date,
            PaidTo = r.PaidTo,
            CellNumber = r.CellNumber,
            AmountEwallet = r.AmountEwallet,
            Reason = r.Reason,
            DieselAmount = r.DieselAmount,
            Status = r.Status,
            PaymentMethod = r.PaymentMethod,
            PeriodYear = r.PeriodYear,
            PeriodMonth = r.PeriodMonth,
            CreatedByUserId = r.CreatedByUserId,
            CreatedByName = createdByName,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt
        };
    }

    public class RequisitionDto
    {
        public int Id { get; set; }
        public string? RfNumber { get; set; }
        public DateTime? Date { get; set; }
        public string? PaidTo { get; set; }
        public string? CellNumber { get; set; }
        public decimal AmountEwallet { get; set; }
        public string? Reason { get; set; }
        public decimal DieselAmount { get; set; }
        public string Status { get; set; } = "Active";
        public string? PaymentMethod { get; set; }
        public int PeriodYear { get; set; }
        public int PeriodMonth { get; set; }
        public int? CreatedByUserId { get; set; }
        public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class RequisitionUpsertDto
    {
        public string? RfNumber { get; set; }
        public DateTime? Date { get; set; }
        public string? PaidTo { get; set; }
        public string? CellNumber { get; set; }
        public decimal AmountEwallet { get; set; }
        public string? Reason { get; set; }
        public decimal DieselAmount { get; set; }
        public string? Status { get; set; }
        public string? PaymentMethod { get; set; }
        public int? PeriodYear { get; set; }
        public int? PeriodMonth { get; set; }
    }
}
