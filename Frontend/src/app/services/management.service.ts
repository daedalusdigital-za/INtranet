import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ---- Overview shapes -------------------------------------------------------
export interface SalesSummary {
  ytdNetSales: number;
  monthNetSales: number;
  transactionCount: number;
  byCompany: { code: string; netSales: number; count: number }[];
}

export interface TendersSummary {
  active: number;
  closingThisWeek: number;
  awardedYtd: number;
  lostYtd: number;
  valueSubmitted: number;
  valueAwarded: number;
}

export interface LogisticsSummary {
  total: number;
  available: number;
  assigned: number;
  inTransit: number;
  delivered: number;
  cancelled: number;
  pendingDeliveryRequests: number;
}

export interface FinanceSummary {
  requisitions: {
    requested: number; requestedAmount: number;
    paid: number; paidAmount: number;
    rejected: number;
  };
  payments: {
    pending: number; pendingAmount: number;
    completed: number; completedAmount: number;
  };
  bookInvoices: number;
}

export interface PaperlessSummary {
  total: number;
  completed: number;
  inProgress: number;
  orgPendingApprovals: number;
  myPendingApprovals: number;
}

export interface ManagementOverview {
  generatedAt: string;
  sales: SalesSummary;
  tenders: TendersSummary;
  logistics: LogisticsSummary;
  finance: FinanceSummary;
  paperless: PaperlessSummary;
}

// ---- Approvals -------------------------------------------------------------
export interface ApprovalItem {
  id: string;
  name: string;
  mime: string;
  status: string;
  progress: number;
  routing: string;
  myRole: string | null;
  myState: string;
  createdBy: string | null;
  updatedAt: string;
}

export interface ApprovalsResponse {
  pending: ApprovalItem[];
  actioned: ApprovalItem[];
}

@Injectable({ providedIn: 'root' })
export class ManagementService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/management`;

  getOverview(): Observable<ManagementOverview> {
    return this.http.get<ManagementOverview>(`${this.apiUrl}/overview`);
  }

  getApprovals(): Observable<ApprovalsResponse> {
    return this.http.get<ApprovalsResponse>(`${this.apiUrl}/approvals`);
  }
}
