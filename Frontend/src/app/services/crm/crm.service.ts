import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

// Interfaces
export interface OperatingCompany {
  operatingCompanyId: number;
  name: string;
  code: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  isActive: boolean;
  userRole?: string;
  isPrimaryCompany?: boolean;
}

export interface Lead {
  leadId: number;
  operatingCompanyId: number;
  operatingCompanyName?: string;
  firstName: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  city?: string;
  province?: string;
  leadStatusId?: number;
  leadStatusName?: string;
  leadStatusColor?: string;
  lastDispositionId?: number;
  lastDispositionName?: string;
  assignedAgentId?: number;
  assignedAgentName?: string;
  source?: string;
  campaignId?: number;
  campaignName?: string;
  nextCallbackAt?: Date;
  lastContactedAt?: Date;
  totalCallAttempts: number;
  doNotCall: boolean;
  isHot: boolean;
  leadScore?: number;
  estimatedValue?: number;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface LeadCreate {
  operatingCompanyId: number;
  firstName: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  source?: string;
  area?: string;
  campaignId?: number;
  assignedAgentId?: number;
  notes?: string;
}

export interface LeadUpdate {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  source?: string;
  area?: string;
  leadStatusId?: number;
  campaignId?: number;
  isHot?: boolean;
  leadScore?: number;
  estimatedValue?: number;
  notes?: string;
}

export interface LeadFilter {
  operatingCompanyId?: number;
  operatingCompanyIds?: number[];
  assignedAgentId?: number;
  leadStatusId?: number;
  campaignId?: number;
  isHot?: boolean;
  doNotCall?: boolean;
  hasCallbackToday?: boolean;
  hasOverdueCallback?: boolean;
  unassigned?: boolean;
  searchTerm?: string;
  source?: string;
  createdFrom?: Date;
  createdTo?: Date;
  sortBy?: string;
  sortDescending?: boolean;
  page?: number;
  pageSize?: number;
}

export interface LeadLog {
  leadLogId: number;
  leadId: number;
  agentId: number;
  agentName?: string;
  logType: string;
  logDateTime: Date;
  durationSeconds?: number;
  dispositionId?: number;
  dispositionName?: string;
  dispositionColor?: string;
  scheduledCallbackAt?: Date;
  notes?: string;
  wasContacted: boolean;
  isPositiveOutcome: boolean;
  promotionId?: number;
  promotionName?: string;
}

export interface LeadLogCreate {
  logType: string;
  durationSeconds?: number;
  dispositionId?: number;
  scheduledCallbackAt?: Date;
  notes?: string;
  wasContacted: boolean;
  newLeadStatusId?: number;
  promotionId?: number;
}

export interface LeadStatus {
  leadStatusId: number;
  operatingCompanyId: number;
  name: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isDefault: boolean;
  isFinal: boolean;
}

export interface Disposition {
  dispositionId: number;
  operatingCompanyId: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  category?: string;
  sortOrder: number;
  requiresCallback: boolean;
  requiresNotes: boolean;
  isFinal: boolean;
  isPositive: boolean;
  isDoNotCall: boolean;
}

export interface Campaign {
  campaignId: number;
  operatingCompanyId: number;
  operatingCompanyName?: string;
  name: string;
  description?: string;
  campaignType: string;
  channel?: string;
  status: string;
  startDate?: Date;
  endDate?: Date;
  targetLeads?: number;
  budget?: number;
  script?: string;
  createdByName?: string;
  createdAt: Date;
  totalLeads?: number;
  assignedAgents?: number;
  assignedAgentsList?: Agent[];
}

export interface CampaignCreate {
  operatingCompanyId: number;
  name: string;
  description?: string;
  campaignType: string;
  channel?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  targetLeads?: number;
  budget?: number;
  script?: string;
}

export interface Promotion {
  promotionId: number;
  operatingCompanyId: number;
  operatingCompanyName?: string;
  name: string;
  description?: string;
  promoCode?: string;
  discountType?: string;
  discountValue?: number;
  startDate: Date;
  endDate?: Date;
  terms?: string;
  agentScript?: string;
  isActive: boolean;
  usageCount: number;
  maxUsages?: number;
  createdAt: Date;
}

export interface PromotionCreate {
  operatingCompanyId: number;
  name: string;
  description?: string;
  promoCode?: string;
  discountType?: string;
  discountValue?: number;
  startDate: Date;
  endDate?: Date;
  terms?: string;
  agentScript?: string;
  maxUsages?: number;
}

export interface Agent {
  staffMemberId: number;
  name: string;
  email: string;
  role?: string;
  isActive: boolean;
}

export interface CrmDashboard {
  totalLeads: number;
  unassignedLeads: number;
  callbacksDueToday: number;
  overdueCallbacks: number;
  hotLeads: number;
  newLeadsToday: number;
  callsMadeToday: number;
  activeCampaigns: number;
  pipelineBreakdown: PipelineStage[];
  agentPerformance: AgentPerformance[];
}

export interface PipelineStage {
  statusId: number;
  statusName: string;
  statusColor?: string;
  leadCount: number;
  totalValue: number;
  sortOrder: number;
}

export interface AgentPerformance {
  agentId: number;
  agentName: string;
  role?: string;
  totalLeadsAssigned: number;
  callsMadeToday: number;
  positiveOutcomesToday: number;
  callbacksDue: number;
}

export interface LeadAssignmentHistory {
  leadAssignmentHistoryId: number;
  previousAgentName?: string;
  newAgentName?: string;
  reason?: string;
  changedByName: string;
  changedAt: Date;
  notes?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  // Reactive state for current operating company
  private _currentCompany = new BehaviorSubject<OperatingCompany | null>(null);
  currentCompany$ = this._currentCompany.asObservable();

  // Signal-based state
  operatingCompanies = signal<OperatingCompany[]>([]);
  leadStatuses = signal<LeadStatus[]>([]);
  dispositions = signal<Disposition[]>([]);

  // Computed values
  currentCompanyId = computed(() => this._currentCompany.value?.operatingCompanyId);
  isManager = computed(() => this._currentCompany.value?.userRole === 'SalesManager');

  // ===== Operating Companies =====
  
  getOperatingCompanies(): Observable<OperatingCompany[]> {
    return this.http.get<OperatingCompany[]>(`${this.baseUrl}/crm/operating-companies`).pipe(
      tap(companies => {
        this.operatingCompanies.set(companies);
        // Auto-select primary company if none selected
        if (!this._currentCompany.value && companies.length > 0) {
          const primary = companies.find(c => c.isPrimaryCompany) || companies[0];
          this.setCurrentCompany(primary);
        }
      })
    );
  }

  setCurrentCompany(company: OperatingCompany) {
    this._currentCompany.next(company);
    // Reload company-specific data
    this.loadLeadStatuses(company.operatingCompanyId);
    this.loadDispositions(company.operatingCompanyId);
  }

  getCurrentCompany(): OperatingCompany | null {
    return this._currentCompany.value;
  }

  // ===== Lead Statuses & Dispositions =====

  loadLeadStatuses(operatingCompanyId?: number): void {
    const options = operatingCompanyId 
      ? { params: { operatingCompanyId: operatingCompanyId.toString() } }
      : {};
    this.http.get<LeadStatus[]>(`${this.baseUrl}/crm/statuses`, options).subscribe(
      statuses => this.leadStatuses.set(statuses)
    );
  }

  loadDispositions(operatingCompanyId?: number): void {
    const options = operatingCompanyId 
      ? { params: { operatingCompanyId: operatingCompanyId.toString() } }
      : {};
    this.http.get<Disposition[]>(`${this.baseUrl}/crm/dispositions`, options).subscribe(
      dispositions => this.dispositions.set(dispositions)
    );
  }

  getLeadStatuses(operatingCompanyId?: number): Observable<LeadStatus[]> {
    const options = operatingCompanyId 
      ? { params: { operatingCompanyId: operatingCompanyId.toString() } }
      : {};
    return this.http.get<LeadStatus[]>(`${this.baseUrl}/crm/statuses`, options);
  }

  getDispositions(operatingCompanyId?: number): Observable<Disposition[]> {
    const options = operatingCompanyId 
      ? { params: { operatingCompanyId: operatingCompanyId.toString() } }
      : {};
    return this.http.get<Disposition[]>(`${this.baseUrl}/crm/dispositions`, options);
  }

  // ===== Dashboard =====

  getDashboard(operatingCompanyId?: number): Observable<CrmDashboard> {
    const options = operatingCompanyId 
      ? { params: { operatingCompanyId: operatingCompanyId.toString() } }
      : {};
    return this.http.get<CrmDashboard>(`${this.baseUrl}/crm/dashboard`, options);
  }

  // ===== Leads =====

  getLeads(filter: LeadFilter = {}): Observable<PagedResult<Lead>> {
    let params = new HttpParams();
    
    if (filter.operatingCompanyId) params = params.set('operatingCompanyId', filter.operatingCompanyId.toString());
    if (filter.assignedAgentId) params = params.set('assignedAgentId', filter.assignedAgentId.toString());
    if (filter.leadStatusId) params = params.set('leadStatusId', filter.leadStatusId.toString());
    if (filter.campaignId) params = params.set('campaignId', filter.campaignId.toString());
    if (filter.isHot !== undefined) params = params.set('isHot', filter.isHot.toString());
    if (filter.doNotCall !== undefined) params = params.set('doNotCall', filter.doNotCall.toString());
    if (filter.hasCallbackToday) params = params.set('hasCallbackToday', 'true');
    if (filter.hasOverdueCallback) params = params.set('hasOverdueCallback', 'true');
    if (filter.unassigned) params = params.set('unassigned', 'true');
    if (filter.searchTerm) params = params.set('searchTerm', filter.searchTerm);
    if (filter.source) params = params.set('source', filter.source);
    if (filter.sortBy) params = params.set('sortBy', filter.sortBy);
    if (filter.sortDescending) params = params.set('sortDescending', 'true');
    if (filter.page) params = params.set('page', filter.page.toString());
    if (filter.pageSize) params = params.set('pageSize', filter.pageSize.toString());

    return this.http.get<PagedResult<Lead>>(`${this.baseUrl}/crm/leads`, { params });
  }

  getLead(id: number): Observable<Lead> {
    return this.http.get<Lead>(`${this.baseUrl}/crm/leads/${id}`);
  }

  createLead(lead: LeadCreate): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/crm/leads`, lead);
  }

  updateLead(id: number, lead: LeadUpdate): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/crm/leads/${id}`, lead);
  }

  assignLead(id: number, assignedAgentId: number, reason?: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/crm/leads/${id}/assign`, { assignedAgentId, reason });
  }

  bulkAssignLeads(leadIds: number[], assignedAgentId: number, reason?: string): Observable<{ assigned: number }> {
    return this.http.post<{ assigned: number }>(`${this.baseUrl}/crm/leads/bulk-assign`, { 
      leadIds, 
      assignedAgentId, 
      reason 
    });
  }

  deleteLead(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/crm/leads/${id}`);
  }

  // ===== Lead Logs =====

  getLeadLogs(leadId: number): Observable<LeadLog[]> {
    return this.http.get<LeadLog[]>(`${this.baseUrl}/crm/leads/${leadId}/logs`);
  }

  logCall(leadId: number, log: LeadLogCreate): Observable<LeadLog> {
    return this.http.post<LeadLog>(`${this.baseUrl}/crm/leads/${leadId}/log`, log);
  }

  getLeadAssignmentHistory(leadId: number): Observable<LeadAssignmentHistory[]> {
    return this.http.get<LeadAssignmentHistory[]>(`${this.baseUrl}/crm/leads/${leadId}/assignment-history`);
  }

  // ===== Campaigns =====

  getCampaigns(operatingCompanyId?: number, status?: string, page = 1, pageSize = 20): Observable<PagedResult<Campaign>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    
    if (operatingCompanyId) params = params.set('operatingCompanyId', operatingCompanyId.toString());
    if (status) params = params.set('status', status);

    return this.http.get<PagedResult<Campaign>>(`${this.baseUrl}/crm/campaigns`, { params });
  }

  getCampaign(id: number): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.baseUrl}/crm/campaigns/${id}`);
  }

  createCampaign(campaign: CampaignCreate): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.baseUrl}/crm/campaigns`, campaign);
  }

  updateCampaign(id: number, campaign: CampaignCreate): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/crm/campaigns/${id}`, campaign);
  }

  updateCampaignStatus(id: number, status: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/crm/campaigns/${id}/status`, JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  assignCampaignAgents(campaignId: number, agentIds: number[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/crm/campaigns/${campaignId}/agents`, agentIds);
  }

  deleteCampaign(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/crm/campaigns/${id}`);
  }

  // ===== Promotions =====

  getPromotions(operatingCompanyId?: number, activeOnly = false): Observable<Promotion[]> {
    let params = new HttpParams();
    if (operatingCompanyId) params = params.set('operatingCompanyId', operatingCompanyId.toString());
    if (activeOnly) params = params.set('activeOnly', 'true');

    return this.http.get<Promotion[]>(`${this.baseUrl}/crm/promotions`, { params });
  }

  getPromotion(id: number): Observable<Promotion> {
    return this.http.get<Promotion>(`${this.baseUrl}/crm/promotions/${id}`);
  }

  createPromotion(promotion: PromotionCreate): Observable<Promotion> {
    return this.http.post<Promotion>(`${this.baseUrl}/crm/promotions`, promotion);
  }

  updatePromotion(id: number, promotion: PromotionCreate): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/crm/promotions/${id}`, promotion);
  }

  togglePromotion(id: number): Observable<{ isActive: boolean }> {
    return this.http.put<{ isActive: boolean }>(`${this.baseUrl}/crm/promotions/${id}/toggle`, {});
  }

  deletePromotion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/crm/promotions/${id}`);
  }

  // ===== Agents =====

  getAgents(operatingCompanyId: number): Observable<Agent[]> {
    return this.http.get<Agent[]>(`${this.baseUrl}/crm/agents`, { 
      params: { operatingCompanyId: operatingCompanyId.toString() } 
    });
  }

  grantStaffAccess(staffMemberId: number, operatingCompanyId: number, companyRole: string, isPrimaryCompany = false): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/crm/staff-access`, {
      staffMemberId,
      operatingCompanyId,
      companyRole,
      isPrimaryCompany
    });
  }

  revokeStaffAccess(staffMemberId: number, operatingCompanyId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/crm/staff-access/${staffMemberId}/${operatingCompanyId}`);
  }
}
