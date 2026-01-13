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
    public class CampaignsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CampaignsController> _logger;

        public CampaignsController(ApplicationDbContext context, ILogger<CampaignsController> logger)
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

        // GET: api/crm/campaigns
        [HttpGet]
        public async Task<ActionResult<PagedResult<CampaignDto>>> GetCampaigns(
            [FromQuery] int? operatingCompanyId,
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var userId = GetCurrentUserId();
            var userCompanyIds = await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && soc.IsActive)
                .Select(soc => soc.OperatingCompanyId)
                .ToListAsync();

            if (!userCompanyIds.Any())
                return Ok(new PagedResult<CampaignDto>());

            var query = _context.Campaigns
                .Include(c => c.OperatingCompany)
                .Where(c => !c.IsDeleted);

            if (operatingCompanyId.HasValue && userCompanyIds.Contains(operatingCompanyId.Value))
            {
                query = query.Where(c => c.OperatingCompanyId == operatingCompanyId.Value);
            }
            else
            {
                query = query.Where(c => userCompanyIds.Contains(c.OperatingCompanyId));
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(c => c.Status == status);
            }

            var totalCount = await query.CountAsync();

            var campaigns = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new CampaignDto
                {
                    CampaignId = c.CampaignId,
                    OperatingCompanyId = c.OperatingCompanyId,
                    OperatingCompanyName = c.OperatingCompany!.Name,
                    Name = c.Name,
                    Description = c.Description,
                    CampaignType = c.CampaignType,
                    Channel = c.Channel,
                    Status = c.Status,
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    TargetLeads = c.TargetLeads,
                    Budget = c.Budget,
                    CreatedAt = c.CreatedAt,
                    TotalLeads = _context.Leads.Count(l => l.CampaignId == c.CampaignId && !l.IsDeleted),
                    AssignedAgentCount = _context.CampaignAgents.Count(ca => ca.CampaignId == c.CampaignId && ca.IsActive)
                })
                .ToListAsync();

            return Ok(new PagedResult<CampaignDto>
            {
                Items = campaigns,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            });
        }

        // GET: api/crm/campaigns/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<CampaignDto>> GetCampaign(int id)
        {
            var userId = GetCurrentUserId();
            var campaign = await _context.Campaigns
                .Include(c => c.OperatingCompany)
                .FirstOrDefaultAsync(c => c.CampaignId == id && !c.IsDeleted);

            if (campaign == null)
                return NotFound();

            if (!await UserHasAccessToCompany(userId, campaign.OperatingCompanyId))
                return Forbid();

            var assignedAgents = await _context.CampaignAgents
                .Include(ca => ca.Agent)
                .Where(ca => ca.CampaignId == id && ca.IsActive)
                .Select(ca => new AgentDto
                {
                    StaffMemberId = ca.AgentId,
                    Name = ca.Agent!.Name,
                    Email = ca.Agent.Email,
                    IsActive = ca.IsActive
                })
                .ToListAsync();

            return Ok(new CampaignDto
            {
                CampaignId = campaign.CampaignId,
                OperatingCompanyId = campaign.OperatingCompanyId,
                OperatingCompanyName = campaign.OperatingCompany!.Name,
                Name = campaign.Name,
                Description = campaign.Description,
                CampaignType = campaign.CampaignType,
                Channel = campaign.Channel,
                Status = campaign.Status,
                StartDate = campaign.StartDate,
                EndDate = campaign.EndDate,
                TargetLeads = campaign.TargetLeads,
                Budget = campaign.Budget,
                Script = campaign.Script,
                CreatedAt = campaign.CreatedAt,
                TotalLeads = await _context.Leads.CountAsync(l => l.CampaignId == id && !l.IsDeleted),
                AssignedAgentsList = assignedAgents
            });
        }

        // POST: api/crm/campaigns
        [HttpPost]
        public async Task<ActionResult<CampaignDto>> CreateCampaign([FromBody] CampaignCreateDto dto)
        {
            var userId = GetCurrentUserId();

            if (!await UserIsManagerInCompany(userId, dto.OperatingCompanyId))
                return Forbid();

            var campaign = new Campaign
            {
                OperatingCompanyId = dto.OperatingCompanyId,
                Name = dto.Name,
                Description = dto.Description,
                CampaignType = dto.CampaignType,
                Channel = dto.Channel,
                Status = dto.Status ?? "Draft",
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                TargetLeads = dto.TargetLeads,
                Budget = dto.Budget,
                Script = dto.Script,
                CreatedById = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Campaigns.Add(campaign);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCampaign), new { id = campaign.CampaignId }, campaign);
        }

        // PUT: api/crm/campaigns/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCampaign(int id, [FromBody] CampaignCreateDto dto)
        {
            var userId = GetCurrentUserId();
            var campaign = await _context.Campaigns.FindAsync(id);

            if (campaign == null || campaign.IsDeleted)
                return NotFound();

            if (!await UserIsManagerInCompany(userId, campaign.OperatingCompanyId))
                return Forbid();

            campaign.Name = dto.Name;
            campaign.Description = dto.Description;
            campaign.CampaignType = dto.CampaignType;
            campaign.Channel = dto.Channel;
            campaign.Status = dto.Status ?? campaign.Status;
            campaign.StartDate = dto.StartDate;
            campaign.EndDate = dto.EndDate;
            campaign.TargetLeads = dto.TargetLeads;
            campaign.Budget = dto.Budget;
            campaign.Script = dto.Script;
            campaign.UpdatedAt = DateTime.UtcNow;
            campaign.UpdatedById = userId;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/crm/campaigns/{id}/agents
        [HttpPost("{id}/agents")]
        public async Task<IActionResult> AssignAgents(int id, [FromBody] List<int> agentIds)
        {
            var userId = GetCurrentUserId();
            var campaign = await _context.Campaigns.FindAsync(id);

            if (campaign == null || campaign.IsDeleted)
                return NotFound();

            if (!await UserIsManagerInCompany(userId, campaign.OperatingCompanyId))
                return Forbid();

            // Deactivate existing assignments not in new list
            var existingAssignments = await _context.CampaignAgents
                .Where(ca => ca.CampaignId == id)
                .ToListAsync();

            foreach (var assignment in existingAssignments)
            {
                if (!agentIds.Contains(assignment.AgentId))
                {
                    assignment.IsActive = false;
                    assignment.RemovedAt = DateTime.UtcNow;
                }
            }

            // Add new assignments
            foreach (var agentId in agentIds)
            {
                var existing = existingAssignments.FirstOrDefault(ea => ea.AgentId == agentId);
                if (existing != null)
                {
                    existing.IsActive = true;
                    existing.RemovedAt = null;
                }
                else
                {
                    _context.CampaignAgents.Add(new CampaignAgent
                    {
                        CampaignId = id,
                        AgentId = agentId,
                        AssignedById = userId,
                        IsActive = true
                    });
                }
            }

            await _context.SaveChangesAsync();

            return Ok();
        }

        // PUT: api/crm/campaigns/{id}/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] string status)
        {
            var userId = GetCurrentUserId();
            var campaign = await _context.Campaigns.FindAsync(id);

            if (campaign == null || campaign.IsDeleted)
                return NotFound();

            if (!await UserIsManagerInCompany(userId, campaign.OperatingCompanyId))
                return Forbid();

            campaign.Status = status;
            campaign.UpdatedAt = DateTime.UtcNow;
            campaign.UpdatedById = userId;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/crm/campaigns/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCampaign(int id)
        {
            var userId = GetCurrentUserId();
            var campaign = await _context.Campaigns.FindAsync(id);

            if (campaign == null)
                return NotFound();

            if (!await UserIsManagerInCompany(userId, campaign.OperatingCompanyId))
                return Forbid();

            campaign.IsDeleted = true;
            campaign.UpdatedAt = DateTime.UtcNow;
            campaign.UpdatedById = userId;

            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
