import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ---- Overview shapes -------------------------------------------------------
export interface MonthPoint { year: number; month: number; label: string; value: number; secondary: number | null; }
export interface NamedCount { name: string; count: number; }
export interface NamedAmount { name: string; amount: number; count: number; }

export interface SalesSummary {
  ytdNetSales: number;
  monthNetSales: number;
  prevMonthNetSales: number;
  ytdReturns: number;
  ytdGrossProfit: number;
  ytdMarginPercent: number;
  transactionCount: number;
  customerCount: number;
  byCompany: NamedAmount[];
  monthly: MonthPoint[];
  topCustomers: NamedAmount[];
}

export interface UpcomingTender {
  id: number; tenderNumber: string; title: string; issuingDepartment: string; companyCode: string;
  status: string; priority: string; closingDate: string; daysLeft: number;
}
export interface ComplianceAtRisk { id: number; companyCode: string; documentType: string; expiryDate: string; daysLeft: number; }

export interface TendersSummary {
  active: number;
  closingThisWeek: number;
  overdue: number;
  awardedYtd: number;
  lostYtd: number;
  winRatePercent: number;
  valueSubmitted: number;
  valueAwarded: number;
  pipelineValue: number;
  byStatus: NamedCount[];
  byCompany: NamedCount[];
  upcomingClosings: UpcomingTender[];
  complianceExpiring45d: number;
  complianceExpired: number;
  complianceAtRisk: ComplianceAtRisk[];
}

export interface LogisticsSummary {
  total: number;
  available: number;
  assigned: number;
  inTransit: number;
  delivered: number;
  cancelled: number;
  deliveredThisMonth: number;
  podsThisMonth: number;
  pendingDeliveryRequests: number;
  monthlyDeliveries: MonthPoint[];
  bookingsAwaitingReview: number;
  shipmentsActive: number;
  shipmentsDeliveredThisMonth: number;
  shipmentsFailed: number;
  shipmentsByStatus: NamedCount[];
  backorderLines: number;
  backorderValue: number;
  backorderAsOf: string | null;
  backordersByCompany: NamedAmount[];
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
  expenses: {
    count: number; ytdTotal: number; monthTotal: number;
    pendingApproval: number; pendingApprovalAmount: number;
  };
  bookInvoices: number;
  monthlyExpenses: MonthPoint[];
  expensesByDepartment: NamedAmount[];
}

export interface PaperlessSummary {
  total: number;
  completed: number;
  inProgress: number;
  orgPendingApprovals: number;
  myPendingApprovals: number;
}

export interface StockWarehouseBreakdown {
  warehouse: string;
  skuCount: number;
  totalQuantity: number;
  lowStock: number;
  outOfStock: number;
}

export interface StockSummary {
  totalSkus: number;
  totalQuantityOnHand: number;
  lowStock: number;
  outOfStock: number;
  warehouses: number;
  byWarehouse: StockWarehouseBreakdown[];
}

export interface AttendancePoint { date: string; label: string; present: number; }
export interface ExpiringContract { id: number; name: string; site: string; jobTitle: string | null; contractEndDate: string; daysLeft: number; }

export interface HrSummary {
  headcount: number;
  inactive: number;
  biometricRegistered: number;
  presentToday: number;
  attendanceRatePercent: number;
  lastClockDate: string | null;
  contractsExpiring90d: number;
  leavePending: number;
  leaveApprovedUpcoming: number;
  onLeaveToday: number;
  disciplinaryOpen: number;
  newHires90d: number;
  bySite: NamedCount[];
  byDepartment: NamedCount[];
  byEmploymentType: NamedCount[];
  attendanceTrend: AttendancePoint[];
  expiringContracts: ExpiringContract[];
}

export interface OverdueMaintenance { id: number; registration: string; maintenanceType: string; priority: string | null; scheduledDate: string; daysOverdue: number; }

export interface FleetSummary {
  vehicles: number;
  operational: number;
  inMaintenance: number;
  retired: number;
  byStatus: NamedCount[];
  byProvince: NamedCount[];
  maintenanceScheduled: number;
  maintenanceOverdue: number;
  maintenanceCostYtd: number;
  fuelSpendYtd: number;
  fuelSpendMonth: number;
  fuelLitresMonth: number;
  monthlyFuel: MonthPoint[];
  incidents30d: number;
  highIncidents30d: number;
  incidents7d: number;
  incidentsByType30d: NamedCount[];
  driversActive: number;
  licencesExpiring60d: number;
  licencesExpired: number;
  overdueMaintenance: OverdueMaintenance[];
}

export interface ProjectsSummary {
  boards: number; activeBoards: number; cards: number; openCards: number; doneCards: number;
  overdueCards: number; dueThisWeek: number; cardsByStatus: NamedCount[];
}

export interface SupportSummary {
  open: number; inProgress: number; resolvedThisMonth: number; highPriorityOpen: number;
  avgResolutionHours: number | null; openByCategory: NamedCount[];
}

export interface DepartmentRow {
  departmentId: number; name: string; manager: string | null; users: number; hrHeadcount: number;
  boards: number; openCards: number; overdueCards: number; leavePending: number; onLeaveToday: number; expensesYtd: number;
}

export interface AlertItem { severity: 'danger' | 'warn' | 'info'; module: string; text: string; route: string; }

export interface ManagementOverview {
  generatedAt: string;
  sales: SalesSummary;
  tenders: TendersSummary;
  logistics: LogisticsSummary;
  stock: StockSummary;
  finance: FinanceSummary;
  paperless: PaperlessSummary;
  hr: HrSummary;
  fleet: FleetSummary;
  projects: ProjectsSummary;
  support: SupportSummary;
  departments: DepartmentRow[];
  alerts: AlertItem[];
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
