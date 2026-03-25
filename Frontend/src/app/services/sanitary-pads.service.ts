import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PadsDashboard {
  totalReceived: number;
  totalDelivered: number;
  currentBalance: number;
  totalValue: number;
  systemStock: number;
  physicalStock: number;
  damagedStock: number;
  stockDifference: number;
  grnCount: number;
  quarters: QuarterSummary[];
  byVendor: VendorSummary[];
  byMonth: MonthSummary[];
  warehouseBreakdown: WarehouseBreakdown[];
  creditNotes: CreditNote[];
  invoicesProcessed: InvoiceProcessed[];
}

export interface QuarterSummary {
  quarter: number;
  stockIn: number;
  stockDelivered: number;
  balance: number;
  value: number;
}

export interface VendorSummary {
  vendor: string;
  totalQty: number;
  totalValue: number;
  grnCount: number;
}

export interface MonthSummary {
  year: number;
  month: number;
  monthName: string;
  qty: number;
  value: number;
}

export interface WarehouseBreakdown {
  warehouse: string;
  stockType: string;
  quantity: number;
  damaged: number;
}

export interface StockReceived {
  id: number;
  vendorName: string;
  grnNumber: string;
  itemCode?: string;
  itemDescription: string;
  reference?: string;
  invoiceNumber?: string;
  location?: string;
  invoiceDate: string;
  uom: string;
  quantityReceived: number;
  unitCost: number;
  subTotal: number;
  quarter?: number;
  notes?: string;
}

export interface StockDelivered {
  id: number;
  deliveryReference?: string;
  invoiceNumber?: string;
  quantityDelivered: number;
  uom: string;
  quarter: number;
  deliveryDate: string;
  notes?: string;
}

export interface CreditNote {
  id: number;
  creditNoteNumber: string;
  creditDate: string;
  description?: string;
  amount?: number;
}

export interface InvoiceProcessed {
  id: number;
  invoiceReference: string;
  invoiceDate: string;
  description?: string;
  amount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SanitaryPadsService {
  private apiUrl = `${environment.apiUrl}/SanitaryPads`;

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<PadsDashboard> {
    return this.http.get<PadsDashboard>(`${this.apiUrl}/dashboard`);
  }

  getStockReceived(params?: { quarter?: number; vendor?: string; sortBy?: string; sortDir?: string }): Observable<{ items: StockReceived[]; totalCount: number }> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) httpParams = httpParams.set(key, value.toString());
      });
    }
    return this.http.get<{ items: StockReceived[]; totalCount: number }>(`${this.apiUrl}/stock-received`, { params: httpParams });
  }

  addStockReceived(data: Partial<StockReceived>): Observable<any> {
    return this.http.post(`${this.apiUrl}/stock-received`, data);
  }

  updateStockReceived(id: number, data: Partial<StockReceived>): Observable<any> {
    return this.http.put(`${this.apiUrl}/stock-received/${id}`, data);
  }

  deleteStockReceived(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/stock-received/${id}`);
  }

  getStockDelivered(quarter?: number): Observable<{ items: StockDelivered[]; totalCount: number }> {
    let params = new HttpParams();
    if (quarter) params = params.set('quarter', quarter.toString());
    return this.http.get<{ items: StockDelivered[]; totalCount: number }>(`${this.apiUrl}/stock-delivered`, { params });
  }

  addStockDelivered(data: Partial<StockDelivered>): Observable<any> {
    return this.http.post(`${this.apiUrl}/stock-delivered`, data);
  }

  deleteStockDelivered(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/stock-delivered/${id}`);
  }

  getWarehouseStock(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/warehouse-stock`);
  }

  addWarehouseStock(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/warehouse-stock`, data);
  }

  getCreditNotes(): Observable<CreditNote[]> {
    return this.http.get<CreditNote[]>(`${this.apiUrl}/credit-notes`);
  }

  addCreditNote(data: Partial<CreditNote>): Observable<any> {
    return this.http.post(`${this.apiUrl}/credit-notes`, data);
  }

  getInvoicesProcessed(): Observable<InvoiceProcessed[]> {
    return this.http.get<InvoiceProcessed[]>(`${this.apiUrl}/invoices-processed`);
  }

  addInvoiceProcessed(data: Partial<InvoiceProcessed>): Observable<any> {
    return this.http.post(`${this.apiUrl}/invoices-processed`, data);
  }
}
