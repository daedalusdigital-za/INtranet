import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ---------------------------------------------------------------------------
// Types returned by our intranet proxy (/api/schooldelivery)
// ---------------------------------------------------------------------------
export interface SdmStatus {
  regionCode: string;
  regionName: string;
  baseUrl: string;
  configured: boolean;
  reachable: boolean;
  authenticated: boolean;
  message?: string;
}

// The proxy wraps upstream payloads as { region, regionName, data }
export interface SdmProxyResult<T = any> {
  region: string;
  regionName: string;
  data: T;
}

// Aggregated statistics entry (one per region)
export interface SdmRegionData<T = any> {
  region: string;
  regionName: string;
  success: boolean;
  error?: string;
  data: T | null;
}

// Province presentation metadata (theme + headline figures)
export interface ProvinceTheme {
  code: string;
  name: string;
  shortName: string;
  primary: string;
  accent: string;
  gradient: string;
  icon: string;
  districts: number;
  schools: number;
  girlsPerMonth: number;
}

@Injectable({ providedIn: 'root' })
export class SchoolDeliveryService {
  private apiUrl = `${environment.apiUrl}/schooldelivery`;

  // Static province presentation data (mirrors the official SDM theming)
  readonly provinces: ProvinceTheme[] = [
    {
      code: 'WC', name: 'Western Cape', shortName: 'W. Cape',
      primary: '#1e3a8a', accent: '#3b82f6',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      icon: 'account_balance', districts: 8, schools: 850, girlsPerMonth: 45000
    },
    {
      code: 'EC', name: 'Eastern Cape', shortName: 'E. Cape',
      primary: '#14532d', accent: '#dc2626',
      gradient: 'linear-gradient(135deg, #14532d 0%, #dc2626 100%)',
      icon: 'forest', districts: 2, schools: 320, girlsPerMonth: 91849
    },
    {
      code: 'KZN', name: 'KwaZulu-Natal', shortName: 'KZN',
      primary: '#14532d', accent: '#ca8a04',
      gradient: 'linear-gradient(135deg, #14532d 0%, #ca8a04 100%)',
      icon: 'landscape', districts: 12, schools: 6999, girlsPerMonth: 1042005
    }
  ];

  constructor(private http: HttpClient) {}

  getProvince(code: string): ProvinceTheme | undefined {
    return this.provinces.find(p => p.code === code);
  }

  // Connection status for all regions
  getStatus(): Observable<SdmStatus[]> {
    return this.http.get<SdmStatus[]>(`${this.apiUrl}/status`);
  }

  getRegionStatus(region: string): Observable<SdmStatus> {
    return this.http.get<SdmStatus>(`${this.apiUrl}/status/${region}`);
  }

  // Authenticate to a region with user-supplied credentials
  login(region: string, email: string, password: string): Observable<{ success: boolean; region?: string; error?: string }> {
    return this.http.post<{ success: boolean; region?: string; error?: string }>(`${this.apiUrl}/${region}/login`, { email, password });
  }

  logout(region: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/${region}/logout`, {});
  }

  // Delivery statistics for a single region
  getStatistics(region: string): Observable<SdmProxyResult> {
    return this.http.get<SdmProxyResult>(`${this.apiUrl}/${region}/statistics`);
  }

  // Aggregated statistics across all regions
  getAllStatistics(): Observable<SdmRegionData[]> {
    return this.http.get<SdmRegionData[]>(`${this.apiUrl}/statistics`);
  }

  getSchoolStatistics(region: string): Observable<SdmProxyResult> {
    return this.http.get<SdmProxyResult>(`${this.apiUrl}/${region}/schools/statistics`);
  }

  // Schools list
  getSchools(region: string, filters?: { province?: string; district?: string; status?: string }): Observable<SdmProxyResult> {
    let params = new HttpParams();
    if (filters?.province) params = params.set('province', filters.province);
    if (filters?.district) params = params.set('district', filters.district);
    if (filters?.status) params = params.set('status', filters.status);
    return this.http.get<SdmProxyResult>(`${this.apiUrl}/${region}/schools`, { params });
  }

  // Deliveries list
  getDeliveries(region: string, filters?: { status?: string; district?: string; priority?: string }): Observable<SdmProxyResult> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.district) params = params.set('district', filters.district);
    if (filters?.priority) params = params.set('priority', filters.priority);
    return this.http.get<SdmProxyResult>(`${this.apiUrl}/${region}/deliveries`, { params });
  }

  getTripSheetsToday(region: string): Observable<SdmProxyResult> {
    return this.http.get<SdmProxyResult>(`${this.apiUrl}/${region}/tripsheets/today`);
  }

  getBulkOrders(region: string, filters?: { status?: string; quarter?: string }): Observable<SdmProxyResult> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.quarter) params = params.set('quarter', filters.quarter);
    return this.http.get<SdmProxyResult>(`${this.apiUrl}/${region}/bulkorders`, { params });
  }

  // Best-effort numeric extraction from an upstream payload that may nest data differently
  pickNumber(obj: any, keys: string[]): number {
    if (obj == null) return 0;
    for (const k of keys) {
      const found = this.deepFind(obj, k.toLowerCase());
      if (typeof found === 'number') return found;
      if (typeof found === 'string' && !isNaN(Number(found))) return Number(found);
    }
    return 0;
  }

  private deepFind(obj: any, keyLower: string): any {
    if (obj == null || typeof obj !== 'object') return undefined;
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === keyLower) return obj[k];
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object') {
        const nested = this.deepFind(v, keyLower);
        if (nested !== undefined) return nested;
      }
    }
    return undefined;
  }

  // Normalise an upstream list payload (could be an array, or { items: [] }, or { data: [] })
  asArray(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.results)) return payload.results;
    return [];
  }
}
