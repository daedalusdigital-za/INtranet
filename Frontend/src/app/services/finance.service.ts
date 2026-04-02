import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  FinanceCategory,
  CreateFinanceCategoryDto,
  UpdateFinanceCategoryDto,
  Budget,
  CreateBudgetDto,
  UpdateBudgetDto,
  Expense,
  CreateExpenseDto,
  UpdateExpenseDto,
  PurchaseOrder,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  Payment,
  CreatePaymentDto,
  UpdatePaymentDto
} from '../models/finance.model';

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private apiUrl = `${environment.apiUrl}/finance`;

  constructor(private http: HttpClient) {}

  // ============================================================================
  // FINANCE CATEGORIES
  // ============================================================================

  getCategories(type?: string, activeOnly: boolean = true): Observable<FinanceCategory[]> {
    let params = new HttpParams().set('activeOnly', activeOnly.toString());
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<FinanceCategory[]>(`${this.apiUrl}/categories`, { params });
  }

  getCategory(id: number): Observable<FinanceCategory> {
    return this.http.get<FinanceCategory>(`${this.apiUrl}/categories/${id}`);
  }

  createCategory(dto: CreateFinanceCategoryDto): Observable<FinanceCategory> {
    return this.http.post<FinanceCategory>(`${this.apiUrl}/categories`, dto);
  }

  updateCategory(id: number, dto: UpdateFinanceCategoryDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/categories/${id}`, dto);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categories/${id}`);
  }

  // ============================================================================
  // BUDGETS
  // ============================================================================

  getBudgets(fiscalYear?: string, department?: string, status?: string): Observable<Budget[]> {
    let params = new HttpParams();
    if (fiscalYear) params = params.set('fiscalYear', fiscalYear);
    if (department) params = params.set('department', department);
    if (status) params = params.set('status', status);
    return this.http.get<Budget[]>(`${this.apiUrl}/budgets`, { params });
  }

  getBudget(id: number): Observable<Budget> {
    return this.http.get<Budget>(`${this.apiUrl}/budgets/${id}`);
  }

  createBudget(dto: CreateBudgetDto): Observable<Budget> {
    return this.http.post<Budget>(`${this.apiUrl}/budgets`, dto);
  }

  updateBudget(id: number, dto: UpdateBudgetDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/budgets/${id}`, dto);
  }

  deleteBudget(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/budgets/${id}`);
  }

  // ============================================================================
  // EXPENSES
  // ============================================================================

  getExpenses(status?: string, department?: string, fromDate?: Date, toDate?: Date): Observable<Expense[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (department) params = params.set('department', department);
    if (fromDate) params = params.set('fromDate', fromDate.toISOString());
    if (toDate) params = params.set('toDate', toDate.toISOString());
    return this.http.get<Expense[]>(`${this.apiUrl}/expenses`, { params });
  }

  getExpense(id: number): Observable<Expense> {
    return this.http.get<Expense>(`${this.apiUrl}/expenses/${id}`);
  }

  createExpense(dto: CreateExpenseDto): Observable<Expense> {
    return this.http.post<Expense>(`${this.apiUrl}/expenses`, dto);
  }

  updateExpense(id: number, dto: UpdateExpenseDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/expenses/${id}`, dto);
  }

  deleteExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/expenses/${id}`);
  }

  // ============================================================================
  // PURCHASE ORDERS
  // ============================================================================

  getPurchaseOrders(status?: string, department?: string): Observable<PurchaseOrder[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (department) params = params.set('department', department);
    return this.http.get<PurchaseOrder[]>(`${this.apiUrl}/purchase-orders`, { params });
  }

  getPurchaseOrder(id: number): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${this.apiUrl}/purchase-orders/${id}`);
  }

  createPurchaseOrder(dto: CreatePurchaseOrderDto): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.apiUrl}/purchase-orders`, dto);
  }

  updatePurchaseOrder(id: number, dto: UpdatePurchaseOrderDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/purchase-orders/${id}`, dto);
  }

  deletePurchaseOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/purchase-orders/${id}`);
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  getPayments(status?: string, fromDate?: Date, toDate?: Date): Observable<Payment[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (fromDate) params = params.set('fromDate', fromDate.toISOString());
    if (toDate) params = params.set('toDate', toDate.toISOString());
    return this.http.get<Payment[]>(`${this.apiUrl}/payments`, { params });
  }

  getPayment(id: number): Observable<Payment> {
    return this.http.get<Payment>(`${this.apiUrl}/payments/${id}`);
  }

  createPayment(dto: CreatePaymentDto): Observable<Payment> {
    return this.http.post<Payment>(`${this.apiUrl}/payments`, dto);
  }

  updatePayment(id: number, dto: UpdatePaymentDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/payments/${id}`, dto);
  }

  deletePayment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/payments/${id}`);
  }
}
