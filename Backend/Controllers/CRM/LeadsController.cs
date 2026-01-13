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
    public class LeadsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<LeadsController> _logger;

        public LeadsController(ApplicationDbContext context, ILogger<LeadsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out var id) ? id : 1;
        }

        private async Task<List<int>> GetUserOperatingCompanyIds(int userId)
        {
            return await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && soc.IsActive)
                .Select(soc => soc.OperatingCompanyId)
                .ToListAsync();
        }

        private async Task<bool> UserHasAccessToCompany(int userId, int operatingCompanyId)
        {
            return await _context.StaffOperatingCompanies
                .AnyAsync(soc => soc.StaffMemberId == userId && 
                                 soc.OperatingCompanyId == operatingCompanyId && 
                                 soc.IsActive);
        }

        private async Task<string?> GetUserRoleInCompany(int userId, int operatingCompanyId)
        {
            return await _context.StaffOperatingCompanies
                .Where(soc => soc.StaffMemberId == userId && 
                              soc.OperatingCompanyId == operatingCompanyId && 
                              soc.IsActive)
                .Select(soc => soc.CompanyRole)
                .FirstOrDefaultAsync();
        }

        // GET: api/crm/leads
        [HttpGet]
        public async Task<ActionResult<PagedResult<LeadDto>>> GetLeads([FromQuery] LeadFilterDto filter)
        {
            var userId = GetCurrentUserId();
            var userCompanyIds = await GetUserOperatingCompanyIds(userId);

            if (!userCompanyIds.Any())
                return Ok(new PagedResult<LeadDto>());

            var query = _context.Leads
                .Include(l => l.OperatingCompany)
                .Include(l => l.LeadStatus)
                .Include(l => l.LastDisposition)
                .Include(l => l.AssignedAgent)
                .Include(l => l.Campaign)
                .Where(l => !l.IsDeleted)
                .AsQueryable();

            // Filter by operating company
            if (filter.OperatingCompanyId.HasValue)
            {
                if (!userCompanyIds.Contains(filter.OperatingCompanyId.Value))
                    return Forbid();
                query = query.Where(l => l.OperatingCompanyId == filter.OperatingCompanyId.Value);
            }
            else if (filter.OperatingCompanyIds?.Any() == true)
            {
                var allowedIds = filter.OperatingCompanyIds.Where(id => userCompanyIds.Contains(id)).ToList();
                query = query.Where(l => allowedIds.Contains(l.OperatingCompanyId));
            }
            else
            {
                query = query.Where(l => userCompanyIds.Contains(l.OperatingCompanyId));
            }

            // Check if user is agent (limited view) or manager (full view)
            var primaryCompanyId = filter.OperatingCompanyId ?? userCompanyIds.First();
            var userRole = await GetUserRoleInCompany(userId, primaryCompanyId);
            
            if (userRole == "SalesAgent")
            {
                // Agents can only see their assigned leads or unassigned if allowed
                if (filter.Unassigned == true)
                {
                    query = query.Where(l => l.AssignedAgentId == null);
                }
                else
                {
                    query = query.Where(l => l.AssignedAgentId == userId);
                }
            }

            // Apply other filters
            if (filter.AssignedAgentId.HasValue)
                query = query.Where(l => l.AssignedAgentId == filter.AssignedAgentId);

            if (filter.LeadStatusId.HasValue)
                query = query.Where(l => l.LeadStatusId == filter.LeadStatusId);

            if (filter.CampaignId.HasValue)
                query = query.Where(l => l.CampaignId == filter.CampaignId);

            if (filter.IsHot.HasValue)
                query = query.Where(l => l.IsHot == filter.IsHot);

            if (filter.DoNotCall.HasValue)
                query = query.Where(l => l.DoNotCall == filter.DoNotCall);

            if (filter.HasCallbackToday == true)
            {
                var today = DateTime.UtcNow.Date;
                var tomorrow = today.AddDays(1);
                query = query.Where(l => l.NextCallbackAt >= today && l.NextCallbackAt < tomorrow);
            }

            if (filter.HasOverdueCallback == true)
            {
                var now = DateTime.UtcNow;
                query = query.Where(l => l.NextCallbackAt < now && l.NextCallbackAt != null);
            }

            if (!string.IsNullOrEmpty(filter.SearchTerm))
            {
                var term = filter.SearchTerm.ToLower();
                query = query.Where(l => 
                    l.FirstName.ToLower().Contains(term) ||
                    (l.LastName != null && l.LastName.ToLower().Contains(term)) ||
                    (l.CompanyName != null && l.CompanyName.ToLower().Contains(term)) ||
                    (l.Email != null && l.Email.ToLower().Contains(term)) ||
                    (l.Phone != null && l.Phone.Contains(term)));
            }

            if (!string.IsNullOrEmpty(filter.Source))
                query = query.Where(l => l.Source == filter.Source);

            if (filter.CreatedFrom.HasValue)
                query = query.Where(l => l.CreatedAt >= filter.CreatedFrom.Value);

            if (filter.CreatedTo.HasValue)
                query = query.Where(l => l.CreatedAt <= filter.CreatedTo.Value);

            // Sorting
            query = filter.SortBy?.ToLower() switch
            {
                "name" => filter.SortDescending ? query.OrderByDescending(l => l.FirstName) : query.OrderBy(l => l.FirstName),
                "company" => filter.SortDescending ? query.OrderByDescending(l => l.CompanyName) : query.OrderBy(l => l.CompanyName),
                "status" => filter.SortDescending ? query.OrderByDescending(l => l.LeadStatus!.Name) : query.OrderBy(l => l.LeadStatus!.Name),
                "callback" => filter.SortDescending ? query.OrderByDescending(l => l.NextCallbackAt) : query.OrderBy(l => l.NextCallbackAt),
                "created" => filter.SortDescending ? query.OrderByDescending(l => l.CreatedAt) : query.OrderBy(l => l.CreatedAt),
                _ => query.OrderByDescending(l => l.CreatedAt)
            };

            var totalCount = await query.CountAsync();

            var leads = await query
                .Skip((filter.Page - 1) * filter.PageSize)
                .Take(filter.PageSize)
                .Select(l => new LeadDto
                {
                    LeadId = l.LeadId,
                    OperatingCompanyId = l.OperatingCompanyId,
                    OperatingCompanyName = l.OperatingCompany!.Name,
                    FirstName = l.FirstName,
                    LastName = l.LastName,
                    CompanyName = l.CompanyName,
                    JobTitle = l.JobTitle,
                    Email = l.Email,
                    Phone = l.Phone,
                    MobilePhone = l.MobilePhone,
                    City = l.City,
                    Province = l.Province,
                    LeadStatusId = l.LeadStatusId,
                    LeadStatusName = l.LeadStatus != null ? l.LeadStatus.Name : null,
                    LeadStatusColor = l.LeadStatus != null ? l.LeadStatus.Color : null,
                    LastDispositionId = l.LastDispositionId,
                    LastDispositionName = l.LastDisposition != null ? l.LastDisposition.Name : null,
                    AssignedAgentId = l.AssignedAgentId,
                    AssignedAgentName = l.AssignedAgent != null ? l.AssignedAgent.Name : null,
                    Source = l.Source,
                    CampaignId = l.CampaignId,
                    CampaignName = l.Campaign != null ? l.Campaign.Name : null,
                    NextCallbackAt = l.NextCallbackAt,
                    LastContactedAt = l.LastContactedAt,
                    TotalCallAttempts = l.TotalCallAttempts,
                    DoNotCall = l.DoNotCall,
                    IsHot = l.IsHot,
                    LeadScore = l.LeadScore,
                    EstimatedValue = l.EstimatedValue,
                    Notes = l.Notes,
                    CreatedAt = l.CreatedAt,
                    UpdatedAt = l.UpdatedAt
                })
                .ToListAsync();

            return Ok(new PagedResult<LeadDto>
            {
                Items = leads,
                TotalCount = totalCount,
                Page = filter.Page,
                PageSize = filter.PageSize
            });
        }

        // GET: api/crm/leads/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<LeadDto>> GetLead(int id)
        {
            var userId = GetCurrentUserId();
            var lead = await _context.Leads
                .Include(l => l.OperatingCompany)
                .Include(l => l.LeadStatus)
                .Include(l => l.LastDisposition)
                .Include(l => l.AssignedAgent)
                .Include(l => l.Campaign)
                .FirstOrDefaultAsync(l => l.LeadId == id && !l.IsDeleted);

            if (lead == null)
                return NotFound();

            // Check access
            if (!await UserHasAccessToCompany(userId, lead.OperatingCompanyId))
                return Forbid();

            // Check if agent can view this lead
            var userRole = await GetUserRoleInCompany(userId, lead.OperatingCompanyId);
            if (userRole == "SalesAgent" && lead.AssignedAgentId != userId)
                return Forbid();

            return Ok(new LeadDto
            {
                LeadId = lead.LeadId,
                OperatingCompanyId = lead.OperatingCompanyId,
                OperatingCompanyName = lead.OperatingCompany!.Name,
                FirstName = lead.FirstName,
                LastName = lead.LastName,
                CompanyName = lead.CompanyName,
                JobTitle = lead.JobTitle,
                Email = lead.Email,
                Phone = lead.Phone,
                MobilePhone = lead.MobilePhone,
                City = lead.City,
                Province = lead.Province,
                LeadStatusId = lead.LeadStatusId,
                LeadStatusName = lead.LeadStatus?.Name,
                LeadStatusColor = lead.LeadStatus?.Color,
                LastDispositionId = lead.LastDispositionId,
                LastDispositionName = lead.LastDisposition?.Name,
                AssignedAgentId = lead.AssignedAgentId,
                AssignedAgentName = lead.AssignedAgent?.Name,
                Source = lead.Source,
                CampaignId = lead.CampaignId,
                CampaignName = lead.Campaign?.Name,
                NextCallbackAt = lead.NextCallbackAt,
                LastContactedAt = lead.LastContactedAt,
                TotalCallAttempts = lead.TotalCallAttempts,
                DoNotCall = lead.DoNotCall,
                IsHot = lead.IsHot,
                LeadScore = lead.LeadScore,
                EstimatedValue = lead.EstimatedValue,
                Notes = lead.Notes,
                CreatedAt = lead.CreatedAt,
                UpdatedAt = lead.UpdatedAt
            });
        }

        // POST: api/crm/leads
        [HttpPost]
        public async Task<ActionResult<LeadDto>> CreateLead([FromBody] LeadCreateDto dto)
        {
            var userId = GetCurrentUserId();

            if (!await UserHasAccessToCompany(userId, dto.OperatingCompanyId))
                return Forbid();

            // Get default status for this company
            var defaultStatus = await _context.LeadStatuses
                .FirstOrDefaultAsync(ls => ls.OperatingCompanyId == dto.OperatingCompanyId && ls.IsDefault);

            var lead = new Lead
            {
                OperatingCompanyId = dto.OperatingCompanyId,
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                CompanyName = dto.CompanyName,
                JobTitle = dto.JobTitle,
                Email = dto.Email,
                Phone = dto.Phone,
                MobilePhone = dto.MobilePhone,
                AlternatePhone = dto.AlternatePhone,
                Address = dto.Address,
                City = dto.City,
                Province = dto.Province,
                PostalCode = dto.PostalCode,
                Source = dto.Source,
                Area = dto.Area,
                CampaignId = dto.CampaignId,
                AssignedAgentId = dto.AssignedAgentId,
                LeadStatusId = defaultStatus?.LeadStatusId,
                Notes = dto.Notes,
                CreatedAt = DateTime.UtcNow,
                CreatedById = userId
            };

            _context.Leads.Add(lead);
            await _context.SaveChangesAsync();

            // Create assignment history if assigned
            if (lead.AssignedAgentId.HasValue)
            {
                _context.LeadAssignmentHistories.Add(new LeadAssignmentHistory
                {
                    LeadId = lead.LeadId,
                    OperatingCompanyId = lead.OperatingCompanyId,
                    NewAgentId = lead.AssignedAgentId,
                    Reason = "Initial Assignment",
                    ChangedById = userId
                });
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction(nameof(GetLead), new { id = lead.LeadId }, lead);
        }

        // PUT: api/crm/leads/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateLead(int id, [FromBody] LeadUpdateDto dto)
        {
            var userId = GetCurrentUserId();
            var lead = await _context.Leads.FindAsync(id);

            if (lead == null || lead.IsDeleted)
                return NotFound();

            if (!await UserHasAccessToCompany(userId, lead.OperatingCompanyId))
                return Forbid();

            // Update fields
            if (dto.FirstName != null) lead.FirstName = dto.FirstName;
            if (dto.LastName != null) lead.LastName = dto.LastName;
            if (dto.CompanyName != null) lead.CompanyName = dto.CompanyName;
            if (dto.JobTitle != null) lead.JobTitle = dto.JobTitle;
            if (dto.Email != null) lead.Email = dto.Email;
            if (dto.Phone != null) lead.Phone = dto.Phone;
            if (dto.MobilePhone != null) lead.MobilePhone = dto.MobilePhone;
            if (dto.AlternatePhone != null) lead.AlternatePhone = dto.AlternatePhone;
            if (dto.Address != null) lead.Address = dto.Address;
            if (dto.City != null) lead.City = dto.City;
            if (dto.Province != null) lead.Province = dto.Province;
            if (dto.PostalCode != null) lead.PostalCode = dto.PostalCode;
            if (dto.Source != null) lead.Source = dto.Source;
            if (dto.Area != null) lead.Area = dto.Area;
            if (dto.LeadStatusId.HasValue) lead.LeadStatusId = dto.LeadStatusId;
            if (dto.CampaignId.HasValue) lead.CampaignId = dto.CampaignId;
            if (dto.IsHot.HasValue) lead.IsHot = dto.IsHot.Value;
            if (dto.LeadScore.HasValue) lead.LeadScore = dto.LeadScore;
            if (dto.EstimatedValue.HasValue) lead.EstimatedValue = dto.EstimatedValue;
            if (dto.Notes != null) lead.Notes = dto.Notes;

            lead.UpdatedAt = DateTime.UtcNow;
            lead.UpdatedById = userId;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/crm/leads/{id}/assign
        [HttpPost("{id}/assign")]
        public async Task<IActionResult> AssignLead(int id, [FromBody] LeadAssignDto dto)
        {
            var userId = GetCurrentUserId();
            var lead = await _context.Leads.FindAsync(id);

            if (lead == null || lead.IsDeleted)
                return NotFound();

            if (!await UserHasAccessToCompany(userId, lead.OperatingCompanyId))
                return Forbid();

            // Only managers can reassign
            var userRole = await GetUserRoleInCompany(userId, lead.OperatingCompanyId);
            if (userRole != "SalesManager")
                return Forbid();

            var previousAgentId = lead.AssignedAgentId;
            lead.AssignedAgentId = dto.AssignedAgentId;
            lead.UpdatedAt = DateTime.UtcNow;
            lead.UpdatedById = userId;

            // Create assignment history
            _context.LeadAssignmentHistories.Add(new LeadAssignmentHistory
            {
                LeadId = lead.LeadId,
                OperatingCompanyId = lead.OperatingCompanyId,
                PreviousAgentId = previousAgentId,
                NewAgentId = dto.AssignedAgentId,
                Reason = dto.Reason,
                ChangedById = userId
            });

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/crm/leads/bulk-assign
        [HttpPost("bulk-assign")]
        public async Task<IActionResult> BulkAssignLeads([FromBody] BulkLeadAssignDto dto)
        {
            var userId = GetCurrentUserId();

            var leads = await _context.Leads
                .Where(l => dto.LeadIds.Contains(l.LeadId) && !l.IsDeleted)
                .ToListAsync();

            foreach (var lead in leads)
            {
                if (!await UserHasAccessToCompany(userId, lead.OperatingCompanyId))
                    continue;

                var userRole = await GetUserRoleInCompany(userId, lead.OperatingCompanyId);
                if (userRole != "SalesManager")
                    continue;

                var previousAgentId = lead.AssignedAgentId;
                lead.AssignedAgentId = dto.AssignedAgentId;
                lead.UpdatedAt = DateTime.UtcNow;
                lead.UpdatedById = userId;

                _context.LeadAssignmentHistories.Add(new LeadAssignmentHistory
                {
                    LeadId = lead.LeadId,
                    OperatingCompanyId = lead.OperatingCompanyId,
                    PreviousAgentId = previousAgentId,
                    NewAgentId = dto.AssignedAgentId,
                    Reason = dto.Reason,
                    ChangedById = userId
                });
            }

            await _context.SaveChangesAsync();

            return Ok(new { assigned = leads.Count });
        }

        // POST: api/crm/leads/{id}/log
        [HttpPost("{id}/log")]
        public async Task<ActionResult<LeadLogDto>> LogCall(int id, [FromBody] LeadLogCreateDto dto)
        {
            var userId = GetCurrentUserId();
            var lead = await _context.Leads.FindAsync(id);

            if (lead == null || lead.IsDeleted)
                return NotFound();

            if (!await UserHasAccessToCompany(userId, lead.OperatingCompanyId))
                return Forbid();

            var disposition = await _context.Dispositions.FindAsync(dto.DispositionId);

            var log = new LeadLog
            {
                LeadId = id,
                OperatingCompanyId = lead.OperatingCompanyId,
                AgentId = userId,
                LogType = dto.LogType,
                DurationSeconds = dto.DurationSeconds,
                DispositionId = dto.DispositionId,
                ScheduledCallbackAt = dto.ScheduledCallbackAt,
                Notes = dto.Notes,
                WasContacted = dto.WasContacted,
                IsPositiveOutcome = disposition?.IsPositive ?? false,
                NewLeadStatusId = dto.NewLeadStatusId,
                PromotionId = dto.PromotionId,
                CreatedAt = DateTime.UtcNow
            };

            _context.LeadLogs.Add(log);

            // Update lead
            lead.LastDispositionId = dto.DispositionId;
            lead.LastContactedAt = DateTime.UtcNow;
            lead.TotalCallAttempts++;
            lead.UpdatedAt = DateTime.UtcNow;
            lead.UpdatedById = userId;

            if (dto.ScheduledCallbackAt.HasValue)
                lead.NextCallbackAt = dto.ScheduledCallbackAt;

            if (dto.NewLeadStatusId.HasValue)
                lead.LeadStatusId = dto.NewLeadStatusId;

            // Handle DNC
            if (disposition?.IsDoNotCall == true)
            {
                lead.DoNotCall = true;
                lead.DoNotCallReason = "Marked DNC via call disposition";
                lead.DoNotCallSetAt = DateTime.UtcNow;
                lead.DoNotCallSetById = userId;
            }

            await _context.SaveChangesAsync();

            return Ok(new LeadLogDto
            {
                LeadLogId = log.LeadLogId,
                LeadId = log.LeadId,
                AgentId = log.AgentId,
                LogType = log.LogType,
                LogDateTime = log.LogDateTime,
                DurationSeconds = log.DurationSeconds,
                DispositionId = log.DispositionId,
                DispositionName = disposition?.Name,
                ScheduledCallbackAt = log.ScheduledCallbackAt,
                Notes = log.Notes,
                WasContacted = log.WasContacted,
                IsPositiveOutcome = log.IsPositiveOutcome
            });
        }

        // GET: api/crm/leads/{id}/logs
        [HttpGet("{id}/logs")]
        public async Task<ActionResult<List<LeadLogDto>>> GetLeadLogs(int id)
        {
            var userId = GetCurrentUserId();
            var lead = await _context.Leads.FindAsync(id);

            if (lead == null)
                return NotFound();

            if (!await UserHasAccessToCompany(userId, lead.OperatingCompanyId))
                return Forbid();

            var logs = await _context.LeadLogs
                .Include(ll => ll.Agent)
                .Include(ll => ll.Disposition)
                .Include(ll => ll.Promotion)
                .Where(ll => ll.LeadId == id)
                .OrderByDescending(ll => ll.LogDateTime)
                .Select(ll => new LeadLogDto
                {
                    LeadLogId = ll.LeadLogId,
                    LeadId = ll.LeadId,
                    AgentId = ll.AgentId,
                    AgentName = ll.Agent != null ? ll.Agent.Name : "",
                    LogType = ll.LogType,
                    LogDateTime = ll.LogDateTime,
                    DurationSeconds = ll.DurationSeconds,
                    DispositionId = ll.DispositionId,
                    DispositionName = ll.Disposition != null ? ll.Disposition.Name : null,
                    DispositionColor = ll.Disposition != null ? ll.Disposition.Color : null,
                    ScheduledCallbackAt = ll.ScheduledCallbackAt,
                    Notes = ll.Notes,
                    WasContacted = ll.WasContacted,
                    IsPositiveOutcome = ll.IsPositiveOutcome,
                    PromotionId = ll.PromotionId,
                    PromotionName = ll.Promotion != null ? ll.Promotion.Name : null
                })
                .ToListAsync();

            return Ok(logs);
        }

        // GET: api/crm/leads/{id}/assignment-history
        [HttpGet("{id}/assignment-history")]
        public async Task<ActionResult<List<LeadAssignmentHistoryDto>>> GetAssignmentHistory(int id)
        {
            var userId = GetCurrentUserId();
            var lead = await _context.Leads.FindAsync(id);

            if (lead == null)
                return NotFound();

            if (!await UserHasAccessToCompany(userId, lead.OperatingCompanyId))
                return Forbid();

            var history = await _context.LeadAssignmentHistories
                .Include(h => h.PreviousAgent)
                .Include(h => h.NewAgent)
                .Include(h => h.ChangedBy)
                .Where(h => h.LeadId == id)
                .OrderByDescending(h => h.ChangedAt)
                .Select(h => new LeadAssignmentHistoryDto
                {
                    LeadAssignmentHistoryId = h.LeadAssignmentHistoryId,
                    PreviousAgentName = h.PreviousAgent != null ? h.PreviousAgent.Name : null,
                    NewAgentName = h.NewAgent != null ? h.NewAgent.Name : null,
                    Reason = h.Reason,
                    ChangedByName = h.ChangedBy != null ? h.ChangedBy.Name : "",
                    ChangedAt = h.ChangedAt,
                    Notes = h.Notes
                })
                .ToListAsync();

            return Ok(history);
        }

        // DELETE: api/crm/leads/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLead(int id)
        {
            var userId = GetCurrentUserId();
            var lead = await _context.Leads.FindAsync(id);

            if (lead == null)
                return NotFound();

            if (!await UserHasAccessToCompany(userId, lead.OperatingCompanyId))
                return Forbid();

            // Only managers can delete
            var userRole = await GetUserRoleInCompany(userId, lead.OperatingCompanyId);
            if (userRole != "SalesManager")
                return Forbid();

            lead.IsDeleted = true;
            lead.DeletedAt = DateTime.UtcNow;
            lead.DeletedById = userId;

            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
