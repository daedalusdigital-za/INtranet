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
    [Route("api/[controller]")]
    public class CrmController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CrmController> _logger;

        public CrmController(ApplicationDbContext context, ILogger<CrmController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out var id) ? id : 1;
        }

        private bool IsAdmin()
        {
            var roleClaim = User.FindFirst(ClaimTypes.Role)?.Value;
            return roleClaim == "Admin" || roleClaim == "Super Admin";
        }

        // GET: api/crm/operating-companies
        [HttpGet("operating-companies")]
        public async Task<ActionResult<List<OperatingCompanyDto>>> GetUserOperatingCompanies()
        {
            var userId = GetCurrentUserId();

            // Admin users get access to ALL companies
            if (IsAdmin())
            {
                var allCompanies = await _context.OperatingCompanies
                    .Where(oc => oc.IsActive)
                    .OrderBy(oc => oc.Name)
                    .Select(oc => new OperatingCompanyDto
                    {
                        OperatingCompanyId = oc.OperatingCompanyId,
                        Name = oc.Name,
                        Code = oc.Code,
                        Description = oc.Description,
                        LogoUrl = oc.LogoUrl,
                        PrimaryColor = oc.PrimaryColor,
                        IsActive = oc.IsActive,
                        UserRole = "Admin",
                        IsPrimaryCompany = false
                    })
                    .ToListAsync();

                // Set first company as primary for admin
                if (allCompanies.Any())
                    allCompanies[0].IsPrimaryCompany = true;

                return Ok(allCompanies);
            }

            var companies = await _context.StaffOperatingCompanies
                .Include(soc => soc.OperatingCompany)
                .Where(soc => soc.StaffMemberId == userId && soc.IsActive && soc.OperatingCompany!.IsActive)
                .OrderBy(soc => soc.OperatingCompany!.Name)
                .Select(soc => new OperatingCompanyDto
                {
                    OperatingCompanyId = soc.OperatingCompanyId,
                    Name = soc.OperatingCompany!.Name,
                    Code = soc.OperatingCompany.Code,
                    Description = soc.OperatingCompany.Description,
                    LogoUrl = soc.OperatingCompany.LogoUrl,
                    PrimaryColor = soc.OperatingCompany.PrimaryColor,
                    IsActive = soc.OperatingCompany.IsActive,
                    UserRole = soc.CompanyRole,
                    IsPrimaryCompany = soc.IsPrimaryCompany
                })
                .ToListAsync();

            return Ok(companies);
        }

        // GET: api/crm/all-companies - Returns all companies for user management dropdown
        [HttpGet("all-companies")]
        public async Task<ActionResult<List<OperatingCompanyDto>>> GetAllOperatingCompanies()
        {
            var companies = await _context.OperatingCompanies
                .Where(oc => oc.IsActive)
                .OrderBy(oc => oc.Name)
                .Select(oc => new OperatingCompanyDto
                {
                    OperatingCompanyId = oc.OperatingCompanyId,
                    Name = oc.Name,
                    Code = oc.Code,
                    Description = oc.Description,
                    LogoUrl = oc.LogoUrl,
                    PrimaryColor = oc.PrimaryColor,
                    IsActive = oc.IsActive
                })
                .ToListAsync();

            return Ok(companies);
        }

        // GET: api/crm/operating-companies/{id}
        [HttpGet("operating-companies/{id}")]
        public async Task<ActionResult<OperatingCompanyDto>> GetOperatingCompany(int id)
        {
            var userId = GetCurrentUserId();

            var soc = await _context.StaffOperatingCompanies
                .Include(s => s.OperatingCompany)
                .FirstOrDefaultAsync(s => s.StaffMemberId == userId && 
                                          s.OperatingCompanyId == id && 
                                          s.IsActive);

            if (soc == null)
                return Forbid();

            return Ok(new OperatingCompanyDto
            {
                OperatingCompanyId = soc.OperatingCompanyId,
                Name = soc.OperatingCompany!.Name,
                Code = soc.OperatingCompany.Code,
                Description = soc.OperatingCompany.Description,
                LogoUrl = soc.OperatingCompany.LogoUrl,
                PrimaryColor = soc.OperatingCompany.PrimaryColor,
                IsActive = soc.OperatingCompany.IsActive,
                UserRole = soc.CompanyRole,
                IsPrimaryCompany = soc.IsPrimaryCompany
            });
        }

        // GET: api/crm/dashboard
        [HttpGet("dashboard")]
        public async Task<ActionResult<CrmDashboardDto>> GetDashboard([FromQuery] int? operatingCompanyId)
        {
            var userId = GetCurrentUserId();

            var userCompanyIds = await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && soc.IsActive)
                .Select(soc => soc.OperatingCompanyId)
                .ToListAsync();

            if (!userCompanyIds.Any())
                return Ok(new CrmDashboardDto());

            var targetCompanyIds = operatingCompanyId.HasValue && userCompanyIds.Contains(operatingCompanyId.Value)
                ? new List<int> { operatingCompanyId.Value }
                : userCompanyIds;

            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);
            var now = DateTime.UtcNow;

            // Get lead counts
            var totalLeads = await _context.Leads
                .Where(l => targetCompanyIds.Contains(l.OperatingCompanyId) && !l.IsDeleted)
                .CountAsync();

            var unassignedLeads = await _context.Leads
                .Where(l => targetCompanyIds.Contains(l.OperatingCompanyId) && 
                           !l.IsDeleted && 
                           l.AssignedAgentId == null)
                .CountAsync();

            var callbacksDueToday = await _context.Leads
                .Where(l => targetCompanyIds.Contains(l.OperatingCompanyId) && 
                           !l.IsDeleted && 
                           l.NextCallbackAt >= today && 
                           l.NextCallbackAt < tomorrow)
                .CountAsync();

            var overdueCallbacks = await _context.Leads
                .Where(l => targetCompanyIds.Contains(l.OperatingCompanyId) && 
                           !l.IsDeleted && 
                           l.NextCallbackAt < now && 
                           l.NextCallbackAt != null)
                .CountAsync();

            var hotLeads = await _context.Leads
                .Where(l => targetCompanyIds.Contains(l.OperatingCompanyId) && 
                           !l.IsDeleted && 
                           l.IsHot)
                .CountAsync();

            var newLeadsToday = await _context.Leads
                .Where(l => targetCompanyIds.Contains(l.OperatingCompanyId) && 
                           !l.IsDeleted && 
                           l.CreatedAt >= today)
                .CountAsync();

            // Get calls made today
            var callsMadeToday = await _context.LeadLogs
                .Where(ll => targetCompanyIds.Contains(ll.OperatingCompanyId) && 
                            ll.LogDateTime >= today &&
                            ll.LogType == "Call")
                .CountAsync();

            // Get active campaigns count
            var activeCampaigns = await _context.Campaigns
                .Where(c => targetCompanyIds.Contains(c.OperatingCompanyId) && 
                           c.Status == "Active")
                .CountAsync();

            // Get pipeline breakdown
            var pipeline = await _context.Leads
                .Where(l => targetCompanyIds.Contains(l.OperatingCompanyId) && 
                           !l.IsDeleted && 
                           l.LeadStatusId != null)
                .GroupBy(l => new { l.LeadStatusId, l.LeadStatus!.Name, l.LeadStatus.Color, l.LeadStatus.SortOrder })
                .Select(g => new PipelineStageDto
                {
                    StatusId = g.Key.LeadStatusId!.Value,
                    StatusName = g.Key.Name,
                    StatusColor = g.Key.Color,
                    LeadCount = g.Count(),
                    TotalValue = g.Sum(l => l.EstimatedValue ?? 0),
                    SortOrder = g.Key.SortOrder
                })
                .OrderBy(p => p.SortOrder)
                .ToListAsync();

            // Get agent performance (for managers)
            var agentPerformance = new List<AgentPerformanceDto>();
            
            if (operatingCompanyId.HasValue)
            {
                var userRole = await _context.StaffOperatingCompanies
                    .Where(soc => soc.StaffMemberId == userId && 
                                  soc.OperatingCompanyId == operatingCompanyId.Value)
                    .Select(soc => soc.CompanyRole)
                    .FirstOrDefaultAsync();

                if (userRole == "SalesManager")
                {
                    agentPerformance = await _context.StaffOperatingCompanies
                        .Include(soc => soc.StaffMember)
                        .Where(soc => soc.OperatingCompanyId == operatingCompanyId.Value && soc.IsActive)
                        .Select(soc => new AgentPerformanceDto
                        {
                            AgentId = soc.StaffMemberId,
                            AgentName = soc.StaffMember!.Name,
                            Role = soc.CompanyRole,
                            TotalLeadsAssigned = _context.Leads.Count(l => l.AssignedAgentId == soc.StaffMemberId && 
                                                                            l.OperatingCompanyId == operatingCompanyId.Value && 
                                                                            !l.IsDeleted),
                            CallsMadeToday = _context.LeadLogs.Count(ll => ll.AgentId == soc.StaffMemberId && 
                                                                            ll.OperatingCompanyId == operatingCompanyId.Value && 
                                                                            ll.LogDateTime >= today && 
                                                                            ll.LogType == "Call"),
                            PositiveOutcomesToday = _context.LeadLogs.Count(ll => ll.AgentId == soc.StaffMemberId && 
                                                                                   ll.OperatingCompanyId == operatingCompanyId.Value && 
                                                                                   ll.LogDateTime >= today && 
                                                                                   ll.IsPositiveOutcome),
                            CallbacksDue = _context.Leads.Count(l => l.AssignedAgentId == soc.StaffMemberId && 
                                                                      l.OperatingCompanyId == operatingCompanyId.Value && 
                                                                      !l.IsDeleted && 
                                                                      l.NextCallbackAt < tomorrow && 
                                                                      l.NextCallbackAt >= today)
                        })
                        .ToListAsync();
                }
            }

            return Ok(new CrmDashboardDto
            {
                TotalLeads = totalLeads,
                UnassignedLeads = unassignedLeads,
                CallbacksDueToday = callbacksDueToday,
                OverdueCallbacks = overdueCallbacks,
                HotLeads = hotLeads,
                NewLeadsToday = newLeadsToday,
                CallsMadeToday = callsMadeToday,
                ActiveCampaigns = activeCampaigns,
                PipelineBreakdown = pipeline,
                AgentPerformance = agentPerformance
            });
        }

        // GET: api/crm/statuses
        [HttpGet("statuses")]
        public async Task<ActionResult<List<LeadStatusDto>>> GetLeadStatuses([FromQuery] int? operatingCompanyId)
        {
            var userId = GetCurrentUserId();
            var userCompanyIds = await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && soc.IsActive)
                .Select(soc => soc.OperatingCompanyId)
                .ToListAsync();

            var query = _context.LeadStatuses.Where(ls => ls.IsActive);

            if (operatingCompanyId.HasValue && userCompanyIds.Contains(operatingCompanyId.Value))
            {
                query = query.Where(ls => ls.OperatingCompanyId == operatingCompanyId.Value);
            }
            else
            {
                query = query.Where(ls => userCompanyIds.Contains(ls.OperatingCompanyId));
            }

            var statuses = await query
                .OrderBy(ls => ls.OperatingCompanyId)
                .ThenBy(ls => ls.SortOrder)
                .Select(ls => new LeadStatusDto
                {
                    LeadStatusId = ls.LeadStatusId,
                    OperatingCompanyId = ls.OperatingCompanyId,
                    Name = ls.Name,
                    Color = ls.Color,
                    Icon = ls.Icon,
                    SortOrder = ls.SortOrder,
                    IsDefault = ls.IsDefault,
                    IsFinal = ls.IsFinal
                })
                .ToListAsync();

            return Ok(statuses);
        }

        // GET: api/crm/dispositions
        [HttpGet("dispositions")]
        public async Task<ActionResult<List<DispositionDto>>> GetDispositions([FromQuery] int? operatingCompanyId)
        {
            var userId = GetCurrentUserId();
            var userCompanyIds = await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && soc.IsActive)
                .Select(soc => soc.OperatingCompanyId)
                .ToListAsync();

            var query = _context.Dispositions.Where(d => d.IsActive);

            if (operatingCompanyId.HasValue && userCompanyIds.Contains(operatingCompanyId.Value))
            {
                query = query.Where(d => d.OperatingCompanyId == operatingCompanyId.Value);
            }
            else
            {
                query = query.Where(d => userCompanyIds.Contains(d.OperatingCompanyId));
            }

            var dispositions = await query
                .OrderBy(d => d.OperatingCompanyId)
                .ThenBy(d => d.SortOrder)
                .Select(d => new DispositionDto
                {
                    DispositionId = d.DispositionId,
                    OperatingCompanyId = d.OperatingCompanyId,
                    Name = d.Name,
                    Description = d.Description,
                    Color = d.Color,
                    Icon = d.Icon,
                    SortOrder = d.SortOrder,
                    RequiresCallback = d.RequiresCallback,
                    RequiresNotes = d.RequiresNotes,
                    IsFinal = d.IsFinal,
                    IsPositive = d.IsPositive,
                    IsDoNotCall = d.IsDoNotCall
                })
                .ToListAsync();

            return Ok(dispositions);
        }

        // GET: api/crm/agents
        [HttpGet("agents")]
        public async Task<ActionResult<List<AgentDto>>> GetAgents([FromQuery] int operatingCompanyId)
        {
            var userId = GetCurrentUserId();
            
            // Verify user has access to this company
            var hasAccess = await _context.StaffOperatingCompanies
                .AnyAsync(soc => soc.StaffMemberId == userId && 
                                 soc.OperatingCompanyId == operatingCompanyId && 
                                 soc.IsActive);

            if (!hasAccess)
                return Forbid();

            var agents = await _context.StaffOperatingCompanies
                .Include(soc => soc.StaffMember)
                .Where(soc => soc.OperatingCompanyId == operatingCompanyId && soc.IsActive)
                .Select(soc => new AgentDto
                {
                    StaffMemberId = soc.StaffMemberId,
                    Name = soc.StaffMember!.Name,
                    Email = soc.StaffMember.Email,
                    Role = soc.CompanyRole,
                    IsActive = soc.IsActive
                })
                .OrderBy(a => a.Name)
                .ToListAsync();

            return Ok(agents);
        }

        // POST: api/crm/staff-access
        [HttpPost("staff-access")]
        public async Task<IActionResult> GrantStaffAccess([FromBody] StaffOperatingCompanyDto dto)
        {
            var userId = GetCurrentUserId();

            // Only managers can grant access
            var userRole = await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && 
                              soc.OperatingCompanyId == dto.OperatingCompanyId && 
                              soc.IsActive)
                .Select(soc => soc.CompanyRole)
                .FirstOrDefaultAsync();

            if (userRole != "SalesManager")
                return Forbid();

            var existing = await _context.StaffOperatingCompanies
                .FirstOrDefaultAsync(soc => soc.StaffMemberId == dto.StaffMemberId && 
                                            soc.OperatingCompanyId == dto.OperatingCompanyId);

            if (existing != null)
            {
                existing.CompanyRole = dto.CompanyRole;
                existing.IsActive = true;
                existing.IsPrimaryCompany = dto.IsPrimaryCompany;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _context.StaffOperatingCompanies.Add(new StaffOperatingCompany
                {
                    StaffMemberId = dto.StaffMemberId,
                    OperatingCompanyId = dto.OperatingCompanyId,
                    CompanyRole = dto.CompanyRole,
                    IsPrimaryCompany = dto.IsPrimaryCompany,
                    IsActive = true
                });
            }

            await _context.SaveChangesAsync();

            return Ok();
        }

        // DELETE: api/crm/staff-access/{staffMemberId}/{operatingCompanyId}
        [HttpDelete("staff-access/{staffMemberId}/{operatingCompanyId}")]
        public async Task<IActionResult> RevokeStaffAccess(int staffMemberId, int operatingCompanyId)
        {
            var userId = GetCurrentUserId();

            // Only managers can revoke access
            var userRole = await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && 
                              soc.OperatingCompanyId == operatingCompanyId && 
                              soc.IsActive)
                .Select(soc => soc.CompanyRole)
                .FirstOrDefaultAsync();

            if (userRole != "SalesManager")
                return Forbid();

            var mapping = await _context.StaffOperatingCompanies
                .FirstOrDefaultAsync(soc => soc.StaffMemberId == staffMemberId && 
                                            soc.OperatingCompanyId == operatingCompanyId);

            if (mapping != null)
            {
                mapping.IsActive = false;
                mapping.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }
    }
}
