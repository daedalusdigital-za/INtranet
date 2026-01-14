import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SystemLog {
  id: number;
  action: string;
  category: 'user' | 'announcement' | 'settings' | 'security' | 'system' | 'document' | 'crm' | 'attendance' | 'meeting';
  description: string;
  userId?: number;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  timestamp: Date;
  details?: string;
  entityType?: string;
  entityId?: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isSuccess: boolean;
  errorMessage?: string;
}

export interface SystemLogFilter {
  category?: string;
  action?: string;
  entityType?: string;
  userId?: number;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}

export interface SystemLogPagedResult {
  logs: SystemLog[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SystemLogStats {
  totalLogs: number;
  todayLogs: number;
  securityEvents: number;
  errorCount: number;
  categoryBreakdown: { [key: string]: number };
  actionBreakdown: { [key: string]: number };
  mostActiveUsers: { userId: number; userName: string; actionCount: number }[];
}

export interface CreateLogDto {
  action: string;
  category: string;
  entityType: string;
  entityId?: number;
  description: string;
  details?: string;
  severity?: string;
  isSuccess?: boolean;
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SystemLogsService {
  private apiUrl = `${environment.apiUrl}/auditlogs`;
  
  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getLogs(filter?: SystemLogFilter): Observable<SystemLog[]> {
    let params = new HttpParams();
    
    if (filter) {
      if (filter.category && filter.category !== 'all') params = params.set('category', filter.category);
      if (filter.action) params = params.set('action', filter.action);
      if (filter.severity && filter.severity !== 'all') params = params.set('severity', filter.severity);
      if (filter.searchTerm) params = params.set('searchTerm', filter.searchTerm);
      if (filter.startDate) params = params.set('startDate', filter.startDate.toISOString());
      if (filter.endDate) params = params.set('endDate', filter.endDate.toISOString());
      if (filter.page) params = params.set('page', filter.page.toString());
      if (filter.pageSize) params = params.set('pageSize', filter.pageSize.toString());
    }

    return this.http.get<SystemLogPagedResult>(this.apiUrl, { 
      headers: this.getHeaders(),
      params 
    }).pipe(
      map(result => result.logs),
      catchError(error => {
        console.error('Error fetching logs:', error);
        return of([]);
      })
    );
  }

  getLogsPaged(filter?: SystemLogFilter): Observable<SystemLogPagedResult> {
    let params = new HttpParams();
    
    if (filter) {
      if (filter.category && filter.category !== 'all') params = params.set('category', filter.category);
      if (filter.action) params = params.set('action', filter.action);
      if (filter.severity && filter.severity !== 'all') params = params.set('severity', filter.severity);
      if (filter.searchTerm) params = params.set('searchTerm', filter.searchTerm);
      if (filter.startDate) params = params.set('startDate', filter.startDate.toISOString());
      if (filter.endDate) params = params.set('endDate', filter.endDate.toISOString());
      if (filter.page) params = params.set('page', filter.page.toString());
      if (filter.pageSize) params = params.set('pageSize', filter.pageSize.toString());
    }

    return this.http.get<SystemLogPagedResult>(this.apiUrl, { 
      headers: this.getHeaders(),
      params 
    }).pipe(
      catchError(error => {
        console.error('Error fetching logs:', error);
        return of({ logs: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 });
      })
    );
  }

  getRecentLogs(count: number = 100): Observable<SystemLog[]> {
    return this.http.get<SystemLog[]>(`${this.apiUrl}/recent?count=${count}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error fetching recent logs:', error);
        return of([]);
      })
    );
  }

  getStats(): Observable<SystemLogStats> {
    return this.http.get<SystemLogStats>(`${this.apiUrl}/stats`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error fetching stats:', error);
        return of({
          totalLogs: 0,
          todayLogs: 0,
          securityEvents: 0,
          errorCount: 0,
          categoryBreakdown: {},
          actionBreakdown: {},
          mostActiveUsers: []
        });
      })
    );
  }

  getUserActivity(userId: number, count: number = 50): Observable<SystemLog[]> {
    return this.http.get<SystemLog[]>(`${this.apiUrl}/user/${userId}?count=${count}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error fetching user activity:', error);
        return of([]);
      })
    );
  }

  addLog(log: CreateLogDto): Observable<void> {
    return this.http.post<void>(this.apiUrl, log, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error creating log:', error);
        return of(void 0);
      })
    );
  }

  exportLogs(filter?: SystemLogFilter): Observable<SystemLog[]> {
    let params = new HttpParams();
    
    if (filter) {
      if (filter.category && filter.category !== 'all') params = params.set('category', filter.category);
      if (filter.startDate) params = params.set('startDate', filter.startDate.toISOString());
      if (filter.endDate) params = params.set('endDate', filter.endDate.toISOString());
    }

    return this.http.get<SystemLog[]>(`${this.apiUrl}/export`, { 
      headers: this.getHeaders(),
      params 
    }).pipe(
      catchError(error => {
        console.error('Error exporting logs:', error);
        return of([]);
      })
    );
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/categories`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(() => of(['security', 'user', 'announcement', 'settings', 'system', 'document', 'crm', 'attendance', 'meeting']))
    );
  }

  // Helper method to format timestamp
  formatTimestamp(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return d.toLocaleDateString('en-ZA', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Helper to get category icon
  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'security': 'security',
      'user': 'person',
      'announcement': 'campaign',
      'settings': 'settings',
      'system': 'computer',
      'document': 'description',
      'crm': 'business',
      'attendance': 'access_time',
      'meeting': 'event'
    };
    return icons[category] || 'info';
  }

  // Helper to get severity color
  getSeverityColor(severity: string): string {
    const colors: { [key: string]: string } = {
      'info': '#2196f3',
      'warning': '#ff9800',
      'error': '#f44336',
      'critical': '#9c27b0'
    };
    return colors[severity] || '#2196f3';
  }

  // Helper to get category color
  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      'security': '#f44336',
      'user': '#2196f3',
      'announcement': '#ff9800',
      'settings': '#9e9e9e',
      'system': '#607d8b',
      'document': '#4caf50',
      'crm': '#9c27b0',
      'attendance': '#00bcd4',
      'meeting': '#e91e63'
    };
    return colors[category] || '#2196f3';
  }
}
