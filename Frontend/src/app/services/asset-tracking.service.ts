import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** A registered barcode / QR tag. */
export interface AssetTag {
  id: number;
  code: string;
  symbology: string;
  tagType: string; // StockItem | Asset | Invoice | Load | Commodity | Custom
  itemCode?: string | null;
  assetItemId?: number | null;
  loadId?: number | null;
  importedInvoiceId?: number | null;
  commodityId?: number | null;
  label?: string | null;
  description?: string | null;
  serialNumber?: string | null;
  status: string;
  currentLocation?: string | null;
  sourceCompany?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateTagRequest {
  code?: string;
  symbology?: string;
  tagType: string;
  itemCode?: string;
  assetItemId?: number;
  loadId?: number;
  importedInvoiceId?: number;
  commodityId?: number;
  label?: string;
  description?: string;
  serialNumber?: string;
  currentLocation?: string;
  sourceCompany?: string;
}

export interface ScanRequest {
  code: string;
  action?: string; // Lookup | CheckIn | CheckOut | LoadOnVehicle | Offload | Deliver | Verify
  scanMethod?: string; // Camera | Manual
  loadId?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface ResolveResult {
  code: string;
  found: boolean;
  tag?: AssetTag | null;
  stockItem?: { itemCode: string } | null;
  inventory: any[];
  invoices: any[];
  tripSheets: any[];
  pods: any[];
  asset?: any | null;
  commodity?: any | null;
  recentScans: any[];
  message?: string | null;
}

export interface ScanEvent {
  id: number;
  scannedCode: string;
  assetTagId?: number | null;
  action: string;
  scanMethod: string;
  loadId?: number | null;
  location?: string | null;
  notes?: string | null;
  scannedByName?: string | null;
  scannedAt: string;
}

export interface ManifestLine {
  code: string;
  customerName: string;
  productCode: string;
  productDescription: string;
  quantity: number;
  deliveryCity?: string | null;
  loaded: boolean;
  loadedAt?: string | null;
  loadedBy?: string | null;
}

export interface ManifestResult {
  loadId: number;
  loadNumber: string;
  status: string;
  customerName?: string | null;
  driver?: string | null;
  vehicle?: string | null;
  totalLines: number;
  loadedLines: number;
  lines: ManifestLine[];
}

/**
 * Client for the electronic asset & consignment tracking API
 * (barcode / QR registry, code resolution and the scan trail).
 */
@Injectable({ providedIn: 'root' })
export class AssetTrackingService {
  private readonly apiUrl = `${environment.apiUrl}/logistics/AssetTag`;

  constructor(private http: HttpClient) {}

  /** Resolve a scanned/typed code into everything related to it. */
  resolve(code: string, logScan = false): Observable<ResolveResult> {
    const params = new HttpParams().set('logScan', logScan);
    return this.http.get<ResolveResult>(`${this.apiUrl}/resolve/${encodeURIComponent(code)}`, { params });
  }

  /** Record a scan event (movement / verification / delivery). */
  recordScan(req: ScanRequest): Observable<ScanEvent> {
    return this.http.post<ScanEvent>(`${this.apiUrl}/scan`, req);
  }

  /** Register / create a new tag. */
  createTag(req: CreateTagRequest): Observable<AssetTag> {
    return this.http.post<AssetTag>(this.apiUrl, req);
  }

  updateTag(id: number, req: CreateTagRequest): Observable<AssetTag> {
    return this.http.put<AssetTag>(`${this.apiUrl}/${id}`, req);
  }

  deleteTag(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getTags(opts: { search?: string; tagType?: string; status?: string; page?: number; pageSize?: number } = {}):
    Observable<{ items: AssetTag[]; totalCount: number; page: number; pageSize: number }> {
    let params = new HttpParams();
    if (opts.search) params = params.set('search', opts.search);
    if (opts.tagType) params = params.set('tagType', opts.tagType);
    if (opts.status) params = params.set('status', opts.status);
    if (opts.page) params = params.set('page', opts.page);
    if (opts.pageSize) params = params.set('pageSize', opts.pageSize);
    return this.http.get<{ items: AssetTag[]; totalCount: number; page: number; pageSize: number }>(this.apiUrl, { params });
  }

  getScans(opts: { code?: string; loadId?: number; page?: number; pageSize?: number } = {}):
    Observable<{ items: ScanEvent[]; totalCount: number; page: number; pageSize: number }> {
    let params = new HttpParams();
    if (opts.code) params = params.set('code', opts.code);
    if (opts.loadId) params = params.set('loadId', opts.loadId);
    if (opts.page) params = params.set('page', opts.page);
    if (opts.pageSize) params = params.set('pageSize', opts.pageSize);
    return this.http.get<{ items: ScanEvent[]; totalCount: number; page: number; pageSize: number }>(`${this.apiUrl}/scans`, { params });
  }

  getTagsForLoad(loadId: number): Observable<AssetTag[]> {
    return this.http.get<AssetTag[]>(`${this.apiUrl}/load/${loadId}`);
  }

  /** Get the load manifest (expected items + loaded state) for a load id. */
  getManifest(loadId: number): Observable<ManifestResult> {
    return this.http.get<ManifestResult>(`${this.apiUrl}/manifest/${loadId}`);
  }

  /** Resolve a scanned/typed code into a load manifest. */
  getManifestByCode(code: string): Observable<ManifestResult> {
    return this.http.get<ManifestResult>(`${this.apiUrl}/manifest/by-code/${encodeURIComponent(code)}`);
  }
}
