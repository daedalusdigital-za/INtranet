import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  priority: 'low' | 'medium' | 'high';
  createdBy: number;
  createdByName: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  targetAudience: string;
  viewCount: number;
}

// API response interface (from backend)
interface ApiAnnouncement {
  announcementId: number;
  title: string;
  content: string;
  createdByUserId?: number;
  createdByName: string;
  createdAt: Date;
  expiresAt?: Date;
  priority: string;
  isActive: boolean;
  category?: string;
  readCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnnouncementHistoryService {
  private apiUrl = `${environment.apiUrl}/announcements`;
  private announcementsSubject = new BehaviorSubject<Announcement[]>([]);

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Map API response to local interface
  private mapApiToAnnouncement(api: ApiAnnouncement): Announcement {
    return {
      id: api.announcementId,
      title: api.title,
      message: api.content,
      type: this.mapPriorityToType(api.priority, api.category),
      priority: this.mapPriority(api.priority),
      createdBy: api.createdByUserId || 0,
      createdByName: api.createdByName || 'Unknown',
      createdAt: new Date(api.createdAt),
      expiresAt: api.expiresAt ? new Date(api.expiresAt) : undefined,
      isActive: api.isActive,
      targetAudience: api.category || 'All Users',
      viewCount: api.readCount || 0
    };
  }

  private mapPriorityToType(priority: string, category?: string): 'info' | 'warning' | 'success' | 'urgent' {
    if (priority?.toLowerCase() === 'high' || priority?.toLowerCase() === 'urgent') return 'urgent';
    if (category?.toLowerCase() === 'warning') return 'warning';
    if (category?.toLowerCase() === 'success') return 'success';
    return 'info';
  }

  private mapPriority(priority: string): 'low' | 'medium' | 'high' {
    const p = priority?.toLowerCase();
    if (p === 'high' || p === 'urgent') return 'high';
    if (p === 'low') return 'low';
    return 'medium';
  }

  getAnnouncements(filter?: { status?: string; type?: string }): Observable<Announcement[]> {
    const activeOnly = filter?.status === 'active' ? true : (filter?.status === 'inactive' ? false : undefined);
    let url = this.apiUrl;
    if (activeOnly !== undefined) {
      url += `?activeOnly=${activeOnly}`;
    } else {
      url += `?activeOnly=false`; // Get all announcements for admin view
    }
    
    return this.http.get<ApiAnnouncement[]>(url, { headers: this.getHeaders() }).pipe(
      map(apiAnnouncements => {
        let announcements = apiAnnouncements.map(a => this.mapApiToAnnouncement(a));
        
        // Apply status filter
        if (filter?.status === 'active') {
          announcements = announcements.filter(a => a.isActive);
        } else if (filter?.status === 'inactive') {
          announcements = announcements.filter(a => !a.isActive);
        }
        
        // Apply type filter
        if (filter?.type && filter.type !== 'all') {
          announcements = announcements.filter(a => a.type === filter.type);
        }
        
        return announcements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }),
      tap(announcements => this.announcementsSubject.next(announcements)),
      catchError(error => {
        console.error('Error fetching announcements:', error);
        return of([]);
      })
    );
  }

  getAnnouncementById(id: number): Observable<Announcement | undefined> {
    return this.http.get<ApiAnnouncement>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      map(api => this.mapApiToAnnouncement(api)),
      catchError(error => {
        console.error('Error fetching announcement:', error);
        return of(undefined);
      })
    );
  }

  createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt' | 'viewCount'>): Observable<Announcement> {
    const payload = {
      title: announcement.title,
      content: announcement.message,
      priority: announcement.priority,
      category: announcement.targetAudience,
      expiresAt: announcement.expiresAt
    };
    
    return this.http.post<ApiAnnouncement>(this.apiUrl, payload, { headers: this.getHeaders() }).pipe(
      map(api => this.mapApiToAnnouncement(api)),
      catchError(error => {
        console.error('Error creating announcement:', error);
        throw error;
      })
    );
  }

  updateAnnouncement(id: number, updates: Partial<Announcement>): Observable<Announcement | undefined> {
    const payload: any = {};
    if (updates.title) payload.title = updates.title;
    if (updates.message) payload.content = updates.message;
    if (updates.priority) payload.priority = updates.priority;
    if (updates.targetAudience) payload.category = updates.targetAudience;
    if (updates.expiresAt !== undefined) payload.expiresAt = updates.expiresAt;
    if (updates.isActive !== undefined) payload.isActive = updates.isActive;
    
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload, { headers: this.getHeaders() }).pipe(
      map(() => {
        // Return updated announcement
        const current = this.announcementsSubject.value.find(a => a.id === id);
        if (current) {
          return { ...current, ...updates };
        }
        return undefined;
      }),
      catchError(error => {
        console.error('Error updating announcement:', error);
        throw error;
      })
    );
  }

  deleteAnnouncement(id: number): Observable<boolean> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error deleting announcement:', error);
        return of(false);
      })
    );
  }

  toggleAnnouncementStatus(id: number): Observable<Announcement | undefined> {
    // First get current status, then update
    const current = this.announcementsSubject.value.find(a => a.id === id);
    const newStatus = current ? !current.isActive : true;
    
    return this.http.put<void>(`${this.apiUrl}/${id}`, { isActive: newStatus }, { headers: this.getHeaders() }).pipe(
      map(() => {
        if (current) {
          return { ...current, isActive: newStatus };
        }
        return undefined;
      }),
      catchError(error => {
        console.error('Error toggling announcement status:', error);
        return of(undefined);
      })
    );
  }

  getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'info': 'info',
      'warning': 'warning',
      'success': 'check_circle',
      'urgent': 'error'
    };
    return icons[type] || 'info';
  }

  getTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'info': '#2196f3',
      'warning': '#ff9800',
      'success': '#4caf50',
      'urgent': '#f44336'
    };
    return colors[type] || '#666';
  }
}
