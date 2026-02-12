import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Tender {
  id: number;
  tenderNumber: string;
  title: string;
  description?: string;
  issuingDepartment: string;
  departmentCategory?: string;
  province?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  companyCode: string;
  estimatedValue?: number;
  evaluationCriteria?: string;
  publishedDate?: Date;
  compulsoryBriefingDate?: Date;
  briefingVenue?: string;
  siteVisitDate?: Date;
  clarificationDeadline?: Date;
  closingDate: Date;
  evaluationDate?: Date;
  status: string;
  workflowStatus: string;
  priority: string;
  riskScore?: number;
  riskNotes?: string;
  submittedAt?: Date;
  submissionMethod?: string;
  submissionReference?: string;
  awardDate?: Date;
  awardedValue?: number;
  lossReason?: string;
  resultNotes?: string;
  createdByUserId?: number;
  createdAt: Date;
  updatedAt?: Date;
  documents?: TenderDocument[];
  teamMembers?: TenderTeamMember[];
  activities?: TenderActivity[];
  boqItems?: TenderBOQItem[];
}

export interface TenderDocument {
  id: number;
  tenderId: number;
  fileName: string;
  filePath?: string;
  documentType: string;
  version: string;
  fileSize?: number;
  mimeType?: string;
  uploadedByUserId?: number;
  uploadedByUserName?: string;
  notes?: string;
  uploadedAt: Date;
}

export interface TenderTeamMember {
  id: number;
  tenderId: number;
  userId?: number;
  userName?: string;
  role: string;
  status: string;
  notes?: string;
  assignedAt: Date;
  completedAt?: Date;
}

export interface TenderActivity {
  id: number;
  tenderId: number;
  activityType: string;
  description: string;
  userId?: number;
  userName?: string;
  metadata?: string;
  createdAt: Date;
}

export interface TenderBOQItem {
  id: number;
  tenderId: number;
  lineNumber: number;
  itemCode?: string;
  description: string;
  unit?: string;
  quantity: number;
  unitCost?: number;
  unitPrice: number;
  totalPrice?: number;
  marginPercent?: number;
  isBelowCost: boolean;
  notes?: string;
}

export interface TenderStats {
  activeTenders: number;
  closingThisWeek: number;
  complianceExpiring: number;
  awardedYTD: number;
  lostYTD: number;
  totalValueSubmitted: number;
  totalValueAwarded: number;
  winRate: number;
  byProvince: { [key: string]: number };
  byDepartment: { [key: string]: number };
  byStatus: { [key: string]: number };
  byCompany: { [key: string]: number };
}

export interface CalendarEvent {
  id: string;
  tenderId: number;
  title: string;
  start: Date;
  type: string;
  companyCode: string;
  status?: string;
  venue?: string;
}

export interface ComplianceDocument {
  id: number;
  companyCode: string;
  documentType: string;
  documentNumber?: string;
  issueDate: Date;
  expiryDate: Date;
  issuingAuthority?: string;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  notes?: string;
  uploadedByUserId?: number;
  uploadedByUserName?: string;
  uploadedAt: Date;
  updatedAt?: Date;
  alert45DaysSent: boolean;
  alert30DaysSent: boolean;
  alert7DaysSent: boolean;
  daysLeft: number;
  computedStatus: string;
}

export interface ComplianceAlert {
  id: number;
  complianceDocumentId: number;
  alertType: string;
  message: string;
  daysRemaining: number;
  isAcknowledged: boolean;
  acknowledgedByUserId?: number;
  acknowledgedByUserName?: string;
  acknowledgedAt?: Date;
  acknowledgmentNotes?: string;
  createdAt: Date;
  complianceDocument?: ComplianceDocument;
}

export interface ComplianceSummary {
  total: number;
  valid: number;
  expiring: number;
  warning: number;
  expired: number;
  byCompany: { company: string; total: number; valid: number; expiring: number; expired: number }[];
  byType: { type: string; total: number; valid: number; expiring: number; expired: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class TenderService {
  private apiUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  // Tenders CRUD
  getTenders(filters?: {
    status?: string;
    province?: string;
    department?: string;
    companyCode?: string;
    fromDate?: Date;
    toDate?: Date;
    search?: string;
  }): Observable<Tender[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.status) params = params.set('status', filters.status);
      if (filters.province) params = params.set('province', filters.province);
      if (filters.department) params = params.set('department', filters.department);
      if (filters.companyCode) params = params.set('companyCode', filters.companyCode);
      if (filters.fromDate) params = params.set('fromDate', filters.fromDate.toISOString());
      if (filters.toDate) params = params.set('toDate', filters.toDate.toISOString());
      if (filters.search) params = params.set('search', filters.search);
    }
    return this.http.get<Tender[]>(`${this.apiUrl}/tenders`, { params });
  }

  getTender(id: number): Observable<Tender> {
    return this.http.get<Tender>(`${this.apiUrl}/tenders/${id}`);
  }

  getStats(): Observable<TenderStats> {
    return this.http.get<TenderStats>(`${this.apiUrl}/tenders/stats`);
  }

  getCalendarEvents(start?: Date, end?: Date): Observable<CalendarEvent[]> {
    let params = new HttpParams();
    if (start) params = params.set('start', start.toISOString());
    if (end) params = params.set('end', end.toISOString());
    return this.http.get<CalendarEvent[]>(`${this.apiUrl}/tenders/calendar`, { params });
  }

  createTender(tender: Partial<Tender>): Observable<Tender> {
    return this.http.post<Tender>(`${this.apiUrl}/tenders`, tender);
  }

  updateTender(id: number, tender: Partial<Tender>): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tenders/${id}`, tender);
  }

  updateStatus(id: number, status: string, extras?: {
    submissionMethod?: string;
    submissionReference?: string;
    awardedValue?: number;
    lossReason?: string;
    notes?: string;
    userId?: number;
    userName?: string;
  }): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tenders/${id}/status`, { status, ...extras });
  }

  updateWorkflow(id: number, workflowStatus: string, userId?: number, userName?: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tenders/${id}/workflow`, { workflowStatus, userId, userName });
  }

  deleteTender(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tenders/${id}`);
  }

  // Team Members
  addTeamMember(tenderId: number, member: Partial<TenderTeamMember> & { assignedByUserId?: number; assignedByUserName?: string }): Observable<TenderTeamMember> {
    return this.http.post<TenderTeamMember>(`${this.apiUrl}/tenders/${tenderId}/team`, member);
  }

  updateTeamMember(memberId: number, update: { status: string; notes?: string; updatedByUserId?: number; updatedByUserName?: string }): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tenders/team/${memberId}`, update);
  }

  // Documents
  uploadDocument(tenderId: number, file: File, documentType: string, uploadedByUserId: number, uploadedByUserName?: string, notes?: string): Observable<TenderDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    formData.append('uploadedByUserId', uploadedByUserId.toString());
    if (uploadedByUserName) formData.append('uploadedByUserName', uploadedByUserName);
    if (notes) formData.append('notes', notes);
    return this.http.post<TenderDocument>(`${this.apiUrl}/tenders/${tenderId}/documents`, formData);
  }

  downloadDocument(docId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/tenders/documents/${docId}/download`, { responseType: 'blob' });
  }

  deleteDocument(docId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tenders/documents/${docId}`);
  }

  // BOQ Items
  addBOQItem(tenderId: number, item: Partial<TenderBOQItem>): Observable<TenderBOQItem> {
    return this.http.post<TenderBOQItem>(`${this.apiUrl}/tenders/${tenderId}/boq`, item);
  }

  updateBOQItem(itemId: number, item: Partial<TenderBOQItem>): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tenders/boq/${itemId}`, item);
  }

  deleteBOQItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tenders/boq/${itemId}`);
  }

  // Compliance
  getComplianceDocuments(filters?: { companyCode?: string; documentType?: string; status?: string }): Observable<ComplianceDocument[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.companyCode) params = params.set('companyCode', filters.companyCode);
      if (filters.documentType) params = params.set('documentType', filters.documentType);
      if (filters.status) params = params.set('status', filters.status);
    }
    return this.http.get<ComplianceDocument[]>(`${this.apiUrl}/compliance`, { params });
  }

  getComplianceDocument(id: number): Observable<ComplianceDocument> {
    return this.http.get<ComplianceDocument>(`${this.apiUrl}/compliance/${id}`);
  }

  getExpiringDocuments(daysAhead?: number): Observable<ComplianceDocument[]> {
    let params = new HttpParams();
    if (daysAhead) params = params.set('daysAhead', daysAhead.toString());
    return this.http.get<ComplianceDocument[]>(`${this.apiUrl}/compliance/expiring`, { params });
  }

  getExpiredDocuments(): Observable<ComplianceDocument[]> {
    return this.http.get<ComplianceDocument[]>(`${this.apiUrl}/compliance/expired`);
  }

  getComplianceSummary(): Observable<ComplianceSummary> {
    return this.http.get<ComplianceSummary>(`${this.apiUrl}/compliance/summary`);
  }

  getComplianceAlerts(companyCode?: string, acknowledged?: boolean): Observable<ComplianceAlert[]> {
    let params = new HttpParams();
    if (companyCode) params = params.set('companyCode', companyCode);
    if (acknowledged !== undefined) params = params.set('acknowledged', acknowledged.toString());
    return this.http.get<ComplianceAlert[]>(`${this.apiUrl}/compliance/alerts`, { params });
  }

  createComplianceDocument(formData: FormData): Observable<ComplianceDocument> {
    return this.http.post<ComplianceDocument>(`${this.apiUrl}/compliance`, formData);
  }

  updateComplianceDocument(id: number, update: Partial<ComplianceDocument>): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/compliance/${id}`, update);
  }

  uploadComplianceFile(id: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<void>(`${this.apiUrl}/compliance/${id}/upload`, formData);
  }

  downloadComplianceDocument(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/compliance/${id}/download`, { responseType: 'blob' });
  }

  acknowledgeAlert(alertId: number, userId?: number, userName?: string, notes?: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/compliance/alerts/${alertId}/acknowledge`, { userId, userName, notes });
  }

  checkAndSendAlerts(): Observable<{ alertsCreated: number; alerts: { alertType: string; message: string }[] }> {
    return this.http.post<any>(`${this.apiUrl}/compliance/check-alerts`, {});
  }

  deleteComplianceDocument(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/compliance/${id}`);
  }
}
