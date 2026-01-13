namespace ProjectTracker.API.DTOs.CRM
{
    // ============== Operating Company DTOs ==============
    public class OperatingCompanyDto
    {
        public int OperatingCompanyId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? LogoUrl { get; set; }
        public string? PrimaryColor { get; set; }
        public bool IsActive { get; set; }
        public int LeadCount { get; set; }
        public int ActiveCampaignCount { get; set; }
        public int AgentCount { get; set; }
        public string? UserRole { get; set; }
        public bool IsPrimaryCompany { get; set; }
    }

    // ============== Lead DTOs ==============
    public class LeadDto
    {
        public int LeadId { get; set; }
        public int OperatingCompanyId { get; set; }
        public string OperatingCompanyName { get; set; } = string.Empty;
        
        // Contact
        public string FirstName { get; set; } = string.Empty;
        public string? LastName { get; set; }
        public string FullName => $"{FirstName} {LastName}".Trim();
        public string? CompanyName { get; set; }
        public string? JobTitle { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? MobilePhone { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        
        // Status
        public int? LeadStatusId { get; set; }
        public string? LeadStatusName { get; set; }
        public string? LeadStatusColor { get; set; }
        public int? LastDispositionId { get; set; }
        public string? LastDispositionName { get; set; }
        
        // Assignment
        public int? AssignedAgentId { get; set; }
        public string? AssignedAgentName { get; set; }
        
        // Tracking
        public string? Source { get; set; }
        public int? CampaignId { get; set; }
        public string? CampaignName { get; set; }
        public DateTime? NextCallbackAt { get; set; }
        public DateTime? LastContactedAt { get; set; }
        public int TotalCallAttempts { get; set; }
        public bool DoNotCall { get; set; }
        public bool IsHot { get; set; }
        public int? LeadScore { get; set; }
        public decimal? EstimatedValue { get; set; }
        public string? Notes { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class LeadCreateDto
    {
        public int OperatingCompanyId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string? LastName { get; set; }
        public string? CompanyName { get; set; }
        public string? JobTitle { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? MobilePhone { get; set; }
        public string? AlternatePhone { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public string? Source { get; set; }
        public string? Area { get; set; }
        public int? CampaignId { get; set; }
        public int? AssignedAgentId { get; set; }
        public string? Notes { get; set; }
    }

    public class LeadUpdateDto
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? CompanyName { get; set; }
        public string? JobTitle { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? MobilePhone { get; set; }
        public string? AlternatePhone { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public string? Source { get; set; }
        public string? Area { get; set; }
        public int? LeadStatusId { get; set; }
        public int? CampaignId { get; set; }
        public bool? IsHot { get; set; }
        public int? LeadScore { get; set; }
        public decimal? EstimatedValue { get; set; }
        public string? Notes { get; set; }
    }

    public class LeadAssignDto
    {
        public int? AssignedAgentId { get; set; }
        public string Reason { get; set; } = "Manual Assignment";
    }

    public class BulkLeadAssignDto
    {
        public List<int> LeadIds { get; set; } = new();
        public int? AssignedAgentId { get; set; }
        public string Reason { get; set; } = "Bulk Assignment";
    }

    public class LeadFilterDto
    {
        public int? OperatingCompanyId { get; set; }
        public List<int>? OperatingCompanyIds { get; set; }
        public int? AssignedAgentId { get; set; }
        public bool? Unassigned { get; set; }
        public int? LeadStatusId { get; set; }
        public int? CampaignId { get; set; }
        public bool? IsHot { get; set; }
        public bool? DoNotCall { get; set; }
        public bool? HasCallbackToday { get; set; }
        public bool? HasOverdueCallback { get; set; }
        public string? SearchTerm { get; set; }
        public string? Source { get; set; }
        public DateTime? CreatedFrom { get; set; }
        public DateTime? CreatedTo { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public string? SortBy { get; set; }
        public bool SortDescending { get; set; } = false;
    }

    // ============== Lead Log DTOs ==============
    public class LeadLogDto
    {
        public int LeadLogId { get; set; }
        public int LeadId { get; set; }
        public int AgentId { get; set; }
        public string AgentName { get; set; } = string.Empty;
        public string LogType { get; set; } = string.Empty;
        public DateTime LogDateTime { get; set; }
        public int? DurationSeconds { get; set; }
        public int? DispositionId { get; set; }
        public string? DispositionName { get; set; }
        public string? DispositionColor { get; set; }
        public DateTime? ScheduledCallbackAt { get; set; }
        public string Notes { get; set; } = string.Empty;
        public bool WasContacted { get; set; }
        public bool IsPositiveOutcome { get; set; }
        public int? PromotionId { get; set; }
        public string? PromotionName { get; set; }
    }

    public class LeadLogCreateDto
    {
        public int LeadId { get; set; }
        public string LogType { get; set; } = "Call";
        public int? DurationSeconds { get; set; }
        public int DispositionId { get; set; }
        public DateTime? ScheduledCallbackAt { get; set; }
        public string Notes { get; set; } = string.Empty;
        public bool WasContacted { get; set; }
        public int? NewLeadStatusId { get; set; }
        public int? PromotionId { get; set; }
    }

    // ============== Campaign DTOs ==============
    public class CampaignDto
    {
        public int CampaignId { get; set; }
        public int OperatingCompanyId { get; set; }
        public string OperatingCompanyName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? CampaignType { get; set; }
        public string? Channel { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? TargetLeads { get; set; }
        public int? TargetConversions { get; set; }
        public decimal? Budget { get; set; }
        public string? Script { get; set; }
        public string? Instructions { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? CreatedByName { get; set; }
        
        // Stats
        public int TotalLeads { get; set; }
        public int ContactedLeads { get; set; }
        public int ConvertedLeads { get; set; }
        public int AssignedAgentCount { get; set; }
        public List<CampaignAgentDto> AssignedAgents { get; set; } = new();
        public List<AgentDto> AssignedAgentsList { get; set; } = new();
    }

    public class CampaignCreateDto
    {
        public int OperatingCompanyId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? CampaignType { get; set; }
        public string? Channel { get; set; }
        public string Status { get; set; } = "Draft";
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? TargetLeads { get; set; }
        public int? TargetConversions { get; set; }
        public decimal? Budget { get; set; }
        public string? Script { get; set; }
        public string? Instructions { get; set; }
        public List<int>? AgentIds { get; set; }
    }

    public class CampaignUpdateDto
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? CampaignType { get; set; }
        public string? Channel { get; set; }
        public string? Status { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? TargetLeads { get; set; }
        public int? TargetConversions { get; set; }
        public decimal? Budget { get; set; }
        public string? Script { get; set; }
        public string? Instructions { get; set; }
    }

    public class CampaignAgentDto
    {
        public int AgentId { get; set; }
        public string AgentName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public bool IsActive { get; set; }
        public DateTime AssignedAt { get; set; }
    }

    // ============== Promotion DTOs ==============
    public class PromotionDto
    {
        public int PromotionId { get; set; }
        public int OperatingCompanyId { get; set; }
        public string OperatingCompanyName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? PromoCode { get; set; }
        public string? DiscountType { get; set; }
        public decimal? DiscountValue { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public bool IsActive { get; set; }
        public string? Terms { get; set; }
        public string? AgentScript { get; set; }
        public string? TargetProducts { get; set; }
        public int UsageCount { get; set; }
        public int? MaxUsages { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class PromotionCreateDto
    {
        public int OperatingCompanyId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? PromoCode { get; set; }
        public string? DiscountType { get; set; }
        public decimal? DiscountValue { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? Terms { get; set; }
        public string? AgentScript { get; set; }
        public string? TargetProducts { get; set; }
        public string? TargetAudience { get; set; }
        public int? MaxUsages { get; set; }
    }

    // ============== Lead Status & Disposition DTOs ==============
    public class LeadStatusDto
    {
        public int LeadStatusId { get; set; }
        public int OperatingCompanyId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Color { get; set; }
        public string? Icon { get; set; }
        public int SortOrder { get; set; }
        public bool IsDefault { get; set; }
        public bool IsFinal { get; set; }
        public bool IsActive { get; set; }
    }

    public class DispositionDto
    {
        public int DispositionId { get; set; }
        public int OperatingCompanyId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Color { get; set; }
        public string? Icon { get; set; }
        public string? Category { get; set; }
        public int SortOrder { get; set; }
        public bool RequiresCallback { get; set; }
        public bool RequiresNotes { get; set; }
        public bool IsFinal { get; set; }
        public bool IsPositive { get; set; }
        public bool IsDoNotCall { get; set; }
        public bool IsActive { get; set; }
    }

    // ============== Staff/Agent DTOs ==============
    public class StaffOperatingCompanyDto
    {
        public int StaffOperatingCompanyId { get; set; }
        public int StaffMemberId { get; set; }
        public string StaffMemberName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public int OperatingCompanyId { get; set; }
        public string OperatingCompanyName { get; set; } = string.Empty;
        public string? CompanyRole { get; set; }
        public bool IsPrimaryCompany { get; set; }
        public bool IsActive { get; set; }
    }

    public class AgentDto
    {
        public int UserId { get; set; }
        public int StaffMemberId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Role { get; set; }
        public bool IsActive { get; set; }
        public List<int> OperatingCompanyIds { get; set; } = new();
    }

    // ============== Dashboard/Stats DTOs ==============
    public class CrmDashboardDto
    {
        public int OperatingCompanyId { get; set; }
        public string OperatingCompanyName { get; set; } = string.Empty;
        
        // Lead counts
        public int TotalLeads { get; set; }
        public int NewLeadsToday { get; set; }
        public int LeadsContactedToday { get; set; }
        public int CallbacksToday { get; set; }
        public int CallbacksDueToday { get; set; }
        public int OverdueCallbacks { get; set; }
        public int HotLeads { get; set; }
        public int UnassignedLeads { get; set; }
        
        // Call stats
        public int CallsMadeToday { get; set; }
        
        // Campaign stats
        public int ActiveCampaigns { get; set; }
        public int ActivePromotions { get; set; }
        
        // Agent stats (for managers)
        public int TotalAgents { get; set; }
        public List<AgentPerformanceDto> AgentPerformance { get; set; } = new();
        
        // Pipeline
        public List<PipelineStageDto> Pipeline { get; set; } = new();
        public List<PipelineStageDto> PipelineBreakdown { get; set; } = new();
    }

    public class AgentPerformanceDto
    {
        public int AgentId { get; set; }
        public string AgentName { get; set; } = string.Empty;
        public string? Role { get; set; }
        public int LeadsAssigned { get; set; }
        public int TotalLeadsAssigned { get; set; }
        public int CallsMadeToday { get; set; }
        public int CallsMadeThisWeek { get; set; }
        public int ConversionsThisWeek { get; set; }
        public int PositiveOutcomesToday { get; set; }
        public int OverdueCallbacks { get; set; }
        public int CallbacksDue { get; set; }
        public int HotLeads { get; set; }
        public double? AvgCallDuration { get; set; }
        public double? ConversionRate { get; set; }
    }

    public class PipelineStageDto
    {
        public int StatusId { get; set; }
        public int LeadStatusId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? StatusName { get; set; }
        public string? Color { get; set; }
        public string? StatusColor { get; set; }
        public int Count { get; set; }
        public int LeadCount { get; set; }
        public int SortOrder { get; set; }
        public decimal? TotalValue { get; set; }
    }

    public class LeadAssignmentHistoryDto
    {
        public int LeadAssignmentHistoryId { get; set; }
        public string? PreviousAgentName { get; set; }
        public string? NewAgentName { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string ChangedByName { get; set; } = string.Empty;
        public DateTime ChangedAt { get; set; }
        public string? Notes { get; set; }
    }

    // ============== Pagination ==============
    public class PagedResult<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
        public bool HasPreviousPage => Page > 1;
        public bool HasNextPage => Page < TotalPages;
    }
}
