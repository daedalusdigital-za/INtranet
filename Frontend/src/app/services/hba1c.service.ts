import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ─── HBA1C TypeScript Interfaces (matching actual API schemas) ──────────────

export interface HBA1CMonthlyTrainingStats {
  month: string;
  sessions: number;
  participants: number;
}

export interface HBA1CProvinceTrainingStats {
  province: string;
  sessions: number;
  participants: number;
  trainers: number;
}

export interface HBA1CTrainingStats {
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  totalParticipants: number;
  completionRate: number;
  monthlyStats: HBA1CMonthlyTrainingStats[] | null;
  provinceStats: HBA1CProvinceTrainingStats[] | null;
}

export interface HBA1CProvinceBreakdown {
  province: string;
  sessions: number;
  participants: number;
  trainers: number;
  revenue: number;
  deliveries: number;
}

export interface HBA1CNationalTotals {
  totalTrainingSessions: number;
  totalTrainers: number;
  totalParticipants: number;
  completionRate: number;
  totalSales: number;
  totalRevenue: number;
  totalDeliveries: number;
}

export interface HBA1CProvinceDistribution {
  province: string;
  ordered: number;
  delivered: number;
  percentage: number;
}

export interface HBA1CItemBreakdown {
  itemType: string;
  quantity: number;
  value: number;
}

export interface HBA1CEquipmentDistribution {
  equipmentType: string;
  totalOrdered: number;
  totalDelivered: number;
  deliveryRate: number;
  provinceDistribution: HBA1CProvinceDistribution[] | null;
  itemBreakdown: HBA1CItemBreakdown[] | null;
}

export interface HBA1CSalesStats {
  totalSales: number;
  monthlyRevenue: number;
  totalRevenue: number;
  averageOrderValue: number;
  pendingOrders: number;
  completedOrders: number;
}

export interface HBA1CTrainer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialization: string;
  experience: number | null;
  certification: string;
  isActive: boolean;
  isDeleted: boolean;
  provinceId: number | null;
  dateCreated: string;
}

export interface HBA1CTrainingSession {
  id: number | null;
  trainingName: string;
  trainingType: string;
  startDate: string;
  provinceId: number;
  provinceName: string;
  venue: string;
  trainerId: number;
  trainer: HBA1CTrainer | null;
  targetAudience: string;
  numberOfParticipants: number;
  status: number;
  statusText: string;
  dateCreated: string;
  lastUpdated: string | null;
  createdByUserName: string;
}

export interface HBA1CCategoryStats {
  category: number;
  categoryName: string;
  itemCount: number;
  totalValue: number;
}

export interface HBA1CInventoryItem {
  id: number | null;
  name: string;
  description: string;
  category: number;
  categoryText: string;
  sku: string;
  unitOfMeasure: string;
  unitPrice: number;
  stockAvailable: number;
  reorderLevel: number;
  supplier: string;
  expiryDate: string | null;
  batchNumber: string;
  status: number;
  statusText: string;
  dateCreated: string;
  lastUpdated: string | null;
  createdByUserName: string;
}

export interface HBA1CInventoryStats {
  totalItems: number;
  inStockItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  categoryStats: HBA1CCategoryStats[] | null;
}

export interface HBA1CSaleItem {
  id: number | null;
  saleId: number;
  inventoryItemId: number;
  inventoryItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface HBA1CSale {
  id: number | null;
  saleNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  total: number;
  notes: string;
  saleItems: HBA1CSaleItem[] | null;
  dateCreated: string;
  hasCreditNote: boolean;
  creditedAmount: number | null;
}

export interface HBA1CProvincialSalesData {
  province: string;
  totalOrdered: number;
  totalDelivered: number;
  revenue: number;
  orderCount: number;
  deliveryRate: number;
}

export interface HBA1CTopProduct {
  productId: number;
  productName: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
}

export interface HBA1CCreditNote {
  id: number;
  creditNoteNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  customerId: number | null;
  customerName: string;
  originalAmount: number;
  creditAmount: number;
  reason: string;
  status: string;
  reverseStock: boolean;
  reverseSale: boolean;
  notes: string;
  createdDate: string;
  approvedDate: string | null;
  approvedBy: string;
}

export interface HBA1CProvince {
  id: number;
  name: string;
  code: string;
  population: number | null;
  healthFacilities: number | null;
}

export interface HBA1CClinic {
  id: number;
  name: string;
  code: string;
  provinceName: string;
  type: number;
  typeText: string;
  address: string;
  contactNumber: string;
  email: string;
  status: number;
  statusText: string;
}

// Combined dashboard response
export interface HBA1CProjectDashboard {
  trainingStats: HBA1CTrainingStats | null;
  nationalTotals: HBA1CNationalTotals | null;
  provinceStats: HBA1CProvinceBreakdown[] | null;
  equipmentStats: HBA1CEquipmentDistribution[] | null;
  salesStats: HBA1CSalesStats | null;
  recentSales: HBA1CSale[] | null;
  provincialData: HBA1CProvincialSalesData[] | null;
  topProducts: HBA1CTopProduct[] | null;
  inventoryStats: HBA1CInventoryStats | null;
  lowStockItems: HBA1CInventoryItem[] | null;
  recentTrainings: HBA1CTrainingSession[] | null;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class HBA1CService {
  private baseUrl = `${environment.apiUrl}/hba1c`;

  constructor(private http: HttpClient) {}

  // ── Dashboard (aggregated) ──
  getDashboard(): Observable<HBA1CProjectDashboard> {
    return this.http.get<HBA1CProjectDashboard>(`${this.baseUrl}/dashboard`);
  }

  // ── Health check ──
  checkHealth(): Observable<{ status: string; api: string; timestamp: string }> {
    return this.http.get<{ status: string; api: string; timestamp: string }>(`${this.baseUrl}/health`);
  }

  // ── Training ──
  getAllTraining(): Observable<HBA1CTrainingSession[]> {
    return this.http.get<HBA1CTrainingSession[]>(`${this.baseUrl}/training`);
  }

  getTraining(id: number): Observable<HBA1CTrainingSession> {
    return this.http.get<HBA1CTrainingSession>(`${this.baseUrl}/training/${id}`);
  }

  getTrainingStats(): Observable<HBA1CTrainingStats> {
    return this.http.get<HBA1CTrainingStats>(`${this.baseUrl}/training/stats`);
  }

  getTrainingByProvince(provinceName: string): Observable<HBA1CTrainingSession[]> {
    const params = new HttpParams().set('provinceName', provinceName);
    return this.http.get<HBA1CTrainingSession[]>(`${this.baseUrl}/training/by-province`, { params });
  }

  getTrainingByStatus(status: string): Observable<HBA1CTrainingSession[]> {
    const params = new HttpParams().set('status', status);
    return this.http.get<HBA1CTrainingSession[]>(`${this.baseUrl}/training/by-status`, { params });
  }

  // ── Inventory ──
  getAllInventory(): Observable<HBA1CInventoryItem[]> {
    return this.http.get<HBA1CInventoryItem[]>(`${this.baseUrl}/inventory`);
  }

  getInventoryItem(id: number): Observable<HBA1CInventoryItem> {
    return this.http.get<HBA1CInventoryItem>(`${this.baseUrl}/inventory/${id}`);
  }

  getInventoryStats(): Observable<HBA1CInventoryStats> {
    return this.http.get<HBA1CInventoryStats>(`${this.baseUrl}/inventory/stats`);
  }

  getLowStock(): Observable<HBA1CInventoryItem[]> {
    return this.http.get<HBA1CInventoryItem[]>(`${this.baseUrl}/inventory/low-stock`);
  }

  // ── Sales ──
  getAllSales(): Observable<HBA1CSale[]> {
    return this.http.get<HBA1CSale[]>(`${this.baseUrl}/sales`);
  }

  getSale(id: number): Observable<HBA1CSale> {
    return this.http.get<HBA1CSale>(`${this.baseUrl}/sales/${id}`);
  }

  getSalesStats(): Observable<HBA1CSalesStats> {
    return this.http.get<HBA1CSalesStats>(`${this.baseUrl}/sales/stats`);
  }

  getRecentSales(limit: number = 10): Observable<HBA1CSale[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<HBA1CSale[]>(`${this.baseUrl}/sales/recent`, { params });
  }

  getProvincialData(): Observable<HBA1CProvincialSalesData[]> {
    return this.http.get<HBA1CProvincialSalesData[]>(`${this.baseUrl}/sales/provincial`);
  }

  getTopProducts(limit: number = 10): Observable<HBA1CTopProduct[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<HBA1CTopProduct[]>(`${this.baseUrl}/sales/top-products`, { params });
  }

  getSalesByDateRange(startDate: string, endDate: string): Observable<HBA1CSale[]> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<HBA1CSale[]>(`${this.baseUrl}/sales/by-date-range`, { params });
  }

  // ── Credit Notes ──
  getCreditNotes(status?: string, dateFrom?: string, dateTo?: string): Observable<HBA1CCreditNote[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get<HBA1CCreditNote[]>(`${this.baseUrl}/credit-notes`, { params });
  }

  getCreditNote(id: number): Observable<HBA1CCreditNote> {
    return this.http.get<HBA1CCreditNote>(`${this.baseUrl}/credit-notes/${id}`);
  }

  // ── Locations ──
  getProvinces(): Observable<HBA1CProvince[]> {
    return this.http.get<HBA1CProvince[]>(`${this.baseUrl}/provinces`);
  }

  getClinics(province?: string): Observable<HBA1CClinic[]> {
    let params = new HttpParams();
    if (province) params = params.set('province', province);
    return this.http.get<HBA1CClinic[]>(`${this.baseUrl}/clinics`, { params });
  }

  // ── Trainers ──
  getTrainers(): Observable<HBA1CTrainer[]> {
    return this.http.get<HBA1CTrainer[]>(`${this.baseUrl}/trainers`);
  }
}
