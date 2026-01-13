using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.CRM;
using ProjectTracker.API.Models.CRM;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.CRM
{
    [ApiController]
    [Route("api/crm/[controller]")]
    public class PromotionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PromotionsController> _logger;

        public PromotionsController(ApplicationDbContext context, ILogger<PromotionsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out var id) ? id : 1;
        }

        private async Task<bool> UserHasAccessToCompany(int userId, int operatingCompanyId)
        {
            return await _context.StaffOperatingCompanies
                .AnyAsync(soc => soc.StaffMemberId == userId && 
                                 soc.OperatingCompanyId == operatingCompanyId && 
                                 soc.IsActive);
        }

        private async Task<bool> UserIsManagerInCompany(int userId, int operatingCompanyId)
        {
            return await _context.StaffOperatingCompanies
                .AnyAsync(soc => soc.StaffMemberId == userId && 
                                 soc.OperatingCompanyId == operatingCompanyId && 
                                 soc.IsActive && 
                                 soc.CompanyRole == "SalesManager");
        }

        // GET: api/crm/promotions
        [HttpGet]
        public async Task<ActionResult<List<PromotionDto>>> GetPromotions(
            [FromQuery] int? operatingCompanyId,
            [FromQuery] bool? activeOnly)
        {
            var userId = GetCurrentUserId();
            var userCompanyIds = await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && soc.IsActive)
                .Select(soc => soc.OperatingCompanyId)
                .ToListAsync();

            if (!userCompanyIds.Any())
                return Ok(new List<PromotionDto>());

            var query = _context.Promotions
                .Include(p => p.OperatingCompany)
                .AsQueryable();

            if (operatingCompanyId.HasValue && userCompanyIds.Contains(operatingCompanyId.Value))
            {
                query = query.Where(p => p.OperatingCompanyId == operatingCompanyId.Value);
            }
            else
            {
                query = query.Where(p => userCompanyIds.Contains(p.OperatingCompanyId));
            }

            if (activeOnly == true)
            {
                var now = DateTime.UtcNow;
                query = query.Where(p => p.IsActive && 
                                         p.StartDate <= now && 
                                         (p.EndDate == null || p.EndDate >= now));
            }

            var promotions = await query
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new PromotionDto
                {
                    PromotionId = p.PromotionId,
                    OperatingCompanyId = p.OperatingCompanyId,
                    OperatingCompanyName = p.OperatingCompany!.Name,
                    Name = p.Name,
                    Description = p.Description,
                    PromoCode = p.PromoCode,
                    DiscountType = p.DiscountType,
                    DiscountValue = p.DiscountValue,
                    StartDate = p.StartDate,
                    EndDate = p.EndDate,
                    Terms = p.Terms,
                    AgentScript = p.AgentScript,
                    IsActive = p.IsActive,
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            return Ok(promotions);
        }

        // GET: api/crm/promotions/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<PromotionDto>> GetPromotion(int id)
        {
            var userId = GetCurrentUserId();
            var promotion = await _context.Promotions
                .Include(p => p.OperatingCompany)
                .FirstOrDefaultAsync(p => p.PromotionId == id);

            if (promotion == null)
                return NotFound();

            if (!await UserHasAccessToCompany(userId, promotion.OperatingCompanyId))
                return Forbid();

            return Ok(new PromotionDto
            {
                PromotionId = promotion.PromotionId,
                OperatingCompanyId = promotion.OperatingCompanyId,
                OperatingCompanyName = promotion.OperatingCompany!.Name,
                Name = promotion.Name,
                Description = promotion.Description,
                PromoCode = promotion.PromoCode,
                DiscountType = promotion.DiscountType,
                DiscountValue = promotion.DiscountValue,
                StartDate = promotion.StartDate,
                EndDate = promotion.EndDate,
                Terms = promotion.Terms,
                AgentScript = promotion.AgentScript,
                IsActive = promotion.IsActive,
                CreatedAt = promotion.CreatedAt
            });
        }

        // POST: api/crm/promotions
        [HttpPost]
        public async Task<ActionResult<PromotionDto>> CreatePromotion([FromBody] PromotionCreateDto dto)
        {
            var userId = GetCurrentUserId();

            if (!await UserIsManagerInCompany(userId, dto.OperatingCompanyId))
                return Forbid();

            // Check for duplicate promo code within company
            if (!string.IsNullOrEmpty(dto.PromoCode))
            {
                var exists = await _context.Promotions
                    .AnyAsync(p => p.OperatingCompanyId == dto.OperatingCompanyId && 
                                  p.PromoCode == dto.PromoCode);
                if (exists)
                    return BadRequest("Promo code already exists for this company");
            }

            var promotion = new Promotion
            {
                OperatingCompanyId = dto.OperatingCompanyId,
                Name = dto.Name,
                Description = dto.Description,
                PromoCode = dto.PromoCode,
                DiscountType = dto.DiscountType,
                DiscountValue = dto.DiscountValue,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                Terms = dto.Terms,
                AgentScript = dto.AgentScript,
                IsActive = true,
                CreatedById = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Promotions.Add(promotion);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPromotion), new { id = promotion.PromotionId }, promotion);
        }

        // PUT: api/crm/promotions/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePromotion(int id, [FromBody] PromotionCreateDto dto)
        {
            var userId = GetCurrentUserId();
            var promotion = await _context.Promotions.FindAsync(id);

            if (promotion == null)
                return NotFound();

            if (!await UserIsManagerInCompany(userId, promotion.OperatingCompanyId))
                return Forbid();

            // Check for duplicate promo code
            if (!string.IsNullOrEmpty(dto.PromoCode) && dto.PromoCode != promotion.PromoCode)
            {
                var exists = await _context.Promotions
                    .AnyAsync(p => p.OperatingCompanyId == promotion.OperatingCompanyId && 
                                  p.PromoCode == dto.PromoCode && 
                                  p.PromotionId != id);
                if (exists)
                    return BadRequest("Promo code already exists for this company");
            }

            promotion.Name = dto.Name;
            promotion.Description = dto.Description;
            promotion.PromoCode = dto.PromoCode;
            promotion.DiscountType = dto.DiscountType;
            promotion.DiscountValue = dto.DiscountValue;
            promotion.StartDate = dto.StartDate;
            promotion.EndDate = dto.EndDate;
            promotion.Terms = dto.Terms;
            promotion.AgentScript = dto.AgentScript;
            promotion.UpdatedAt = DateTime.UtcNow;
            promotion.UpdatedById = userId;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/crm/promotions/{id}/toggle
        [HttpPut("{id}/toggle")]
        public async Task<IActionResult> TogglePromotion(int id)
        {
            var userId = GetCurrentUserId();
            var promotion = await _context.Promotions.FindAsync(id);

            if (promotion == null)
                return NotFound();

            if (!await UserIsManagerInCompany(userId, promotion.OperatingCompanyId))
                return Forbid();

            promotion.IsActive = !promotion.IsActive;
            promotion.UpdatedAt = DateTime.UtcNow;
            promotion.UpdatedById = userId;

            await _context.SaveChangesAsync();

            return Ok(new { isActive = promotion.IsActive });
        }

        // DELETE: api/crm/promotions/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePromotion(int id)
        {
            var userId = GetCurrentUserId();
            var promotion = await _context.Promotions.FindAsync(id);

            if (promotion == null)
                return NotFound();

            if (!await UserIsManagerInCompany(userId, promotion.OperatingCompanyId))
                return Forbid();

            _context.Promotions.Remove(promotion);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
