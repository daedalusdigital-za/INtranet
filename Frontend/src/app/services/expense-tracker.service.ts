import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ExpenseItem {
  id: number;
  departmentId: number;
  categoryId?: number;
  month: number;
  year: number;
  itemType: string;          // 'PurchaseOrder' | 'Service'
  company: string;
  servicesRendered: string;
  invoicedTo: string;
  amount: number;
  paidBy?: string;
  invoiceNumber?: string;
  itemDate: Date;
  status: string;            // 'Pending' | 'Paid' | 'Cancelled'
  bookInvoiceId?: number;
  bookInvoiceSupplier?: string;
  bookInvoiceFile?: string;
  notes?: string;
  vatAmount?: number;
  currency: string;
  createdAt: Date;
  createdBy?: string;
}

export interface ExpenseCategory {
  id: number;
  departmentId: number;
  name: string;
  color: string;
  isActive: boolean;
}

export interface ExpenseSummary {
  totalAmount: number;
  totalCount: number;
  paidAmount: number;
  pendingAmount: number;
  byMonth: { year: number; month: number; total: number; count: number; paid: number; pending: number }[];
  byCategory: { categoryId?: number; total: number; count: number }[];
  byType: { type: string; total: number; count: number }[];
}

export interface ExpenseListResponse {
  items: ExpenseItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: ExpenseSummary;
}

@Injectable({ providedIn: 'root' })
export class ExpenseTrackerService {
  private apiUrl = `${environment.apiUrl}/ExpenseTracker`;

  constructor(private http: HttpClient) {}

  getItems(params: {
    departmentId: number;
    year?: number;
    month?: number;
    search?: string;
    itemType?: string;
    status?: string;
    categoryId?: number;
    sortBy?: string;
    sortDir?: string;
    page?: number;
    pageSize?: number;
  }): Observable<ExpenseListResponse> {
    let p = new HttpParams().set('departmentId', params.departmentId.toString());
    if (params.year)       p = p.set('year', params.year.toString());
    if (params.month)      p = p.set('month', params.month.toString());
    if (params.search)     p = p.set('search', params.search);
    if (params.itemType)   p = p.set('itemType', params.itemType);
    if (params.status)     p = p.set('status', params.status);
    if (params.categoryId) p = p.set('categoryId', params.categoryId.toString());
    if (params.sortBy)     p = p.set('sortBy', params.sortBy);
    if (params.sortDir)    p = p.set('sortDir', params.sortDir);
    if (params.page)       p = p.set('page', params.page.toString());
    if (params.pageSize)   p = p.set('pageSize', params.pageSize.toString());
    return this.http.get<ExpenseListResponse>(this.apiUrl, { params: p });
  }

  getSummary(departmentId: number, year?: number, month?: number): Observable<ExpenseSummary> {
    let p = new HttpParams().set('departmentId', departmentId.toString());
    if (year)  p = p.set('year', year.toString());
    if (month) p = p.set('month', month.toString());
    return this.http.get<ExpenseSummary>(`${this.apiUrl}/summary`, { params: p });
  }

  create(item: Partial<ExpenseItem>): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(this.apiUrl, item);
  }

  update(id: number, item: Partial<ExpenseItem>): Observable<{ id: number }> {
    return this.http.put<{ id: number }>(`${this.apiUrl}/${id}`, item);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Categories
  getCategories(departmentId: number): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${this.apiUrl}/categories`, {
      params: new HttpParams().set('departmentId', departmentId.toString())
    });
  }

  createCategory(cat: { departmentId: number; name: string; color?: string }): Observable<ExpenseCategory> {
    return this.http.post<ExpenseCategory>(`${this.apiUrl}/categories`, cat);
  }

  updateCategory(id: number, cat: { departmentId: number; name: string; color?: string }): Observable<ExpenseCategory> {
    return this.http.put<ExpenseCategory>(`${this.apiUrl}/categories/${id}`, cat);
  }

  deleteCategory(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`);
  }

  // Excel upload
  uploadExcel(file: File, departmentId: number, year: number, month: number): Observable<{ imported: number; skipped: number; errors: string[] }> {
    const fd = new FormData();
    fd.append('file', file);
    const p = new HttpParams()
      .set('departmentId', departmentId.toString())
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.post<any>(`${this.apiUrl}/upload-excel`, fd, { params: p });
  }

  // Excel export
  exportExcel(departmentId: number, year?: number, month?: number): Observable<Blob> {
    let p = new HttpParams().set('departmentId', departmentId.toString());
    if (year)  p = p.set('year', year.toString());
    if (month) p = p.set('month', month.toString());
    return this.http.get(`${this.apiUrl}/export-excel`, { params: p, responseType: 'blob' });
  }
}
