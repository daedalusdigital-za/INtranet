import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BookInvoice {
  id: number;
  supplierName: string;
  supplierAccount?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  total: number;
  vatAmount?: number;
  subTotal?: number;
  currency: string;
  paymentDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  category?: string;
  companyName?: string;
  description?: string;
  notes?: string;
  fileName: string;
  originalFileName?: string;
  contentType: string;
  fileSize: number;
  extractedText?: string;
  status: string;
  uploadedByUserId?: number;
  uploadedByName?: string;
  confirmedByUserId?: number;
  createdAt: string;
  confirmedAt?: string;
  updatedAt?: string;
}

export interface BookInvoiceListResponse {
  items: BookInvoice[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface BooksSummary {
  totalInvoices: number;
  totalAmount: number;
  totalVat: number;
  draftCount: number;
  confirmedCount: number;
  paymentRequestedCount: number;
  archivedCount: number;
  byCategory: { category: string; count: number; total: number }[];
  bySupplier: { supplier: string; count: number; total: number }[];
  byMonth: { year: number; month: number; monthName: string; count: number; total: number }[];
  suppliers: string[];
  categories: string[];
  years: number[];
}

export interface UploadResponse {
  id: number;
  supplierName: string;
  invoiceNumber?: string;
  invoiceDate: string;
  total: number;
  vatAmount?: number;
  subTotal?: number;
  originalFileName: string;
  fileSize: number;
  extractedText?: string;
  status: string;
  message: string;
}

export interface ConfirmRequest {
  supplierName?: string;
  supplierAccount?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  total?: number;
  vatAmount?: number;
  subTotal?: number;
  currency?: string;
  paymentDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  category?: string;
  companyName?: string;
  description?: string;
  notes?: string;
}

export interface BookDepartment {
  departmentId: number;
  departmentName: string;
}

@Injectable({
  providedIn: 'root'
})
export class BooksService {
  private apiUrl = `${environment.apiUrl}/Books`;

  constructor(private http: HttpClient) {}

  getDepartments(): Observable<BookDepartment[]> {
    return this.http.get<BookDepartment[]>(`${this.apiUrl}/departments`);
  }

  verifyPassword(departmentId: number, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-password`, { departmentId, password });
  }

  getAll(departmentId: number, params: {
    search?: string;
    supplier?: string;
    category?: string;
    company?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    month?: string;
    year?: string;
    sortBy?: string;
    sortDir?: string;
    page?: number;
    pageSize?: number;
  }): Observable<BookInvoiceListResponse> {
    let httpParams = new HttpParams().set('departmentId', departmentId.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });
    return this.http.get<BookInvoiceListResponse>(this.apiUrl, { params: httpParams });
  }

  getById(id: number): Observable<BookInvoice> {
    return this.http.get<BookInvoice>(`${this.apiUrl}/${id}`);
  }

  getSummary(departmentId: number, year?: string): Observable<BooksSummary> {
    let params = new HttpParams().set('departmentId', departmentId.toString());
    if (year) params = params.set('year', year);
    return this.http.get<BooksSummary>(`${this.apiUrl}/summary`, { params });
  }

  upload(file: File, departmentId: number): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.apiUrl}/upload?departmentId=${departmentId}`, formData);
  }

  confirm(id: number, data: ConfirmRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/confirm`, data);
  }

  requestPayment(id: number, data: ConfirmRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/request-payment`, data);
  }

  update(id: number, data: ConfirmRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  archive(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/archive`, {});
  }

  restore(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/restore`, {});
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  viewPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/view`, { responseType: 'blob' });
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, { responseType: 'blob' });
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/categories`);
  }

  getSuppliers(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/suppliers`);
  }
}
