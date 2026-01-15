import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Announcement {
  announcementId: number;
  title: string;
  content: string;
  createdByUserId: number;
  createdByName: string;
  createdByProfilePicture?: string;
  createdAt: Date;
  expiresAt?: Date;
  priority: string;
  isActive: boolean;
  category?: string;
  readCount: number;
  isRead: boolean;
}

export interface AnnouncementListItem {
  announcementId: number;
  title: string;
  content: string;
  createdByName: string;
  createdAt: Date;
  priority: string;
  category?: string;
  isRead: boolean;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  expiresAt?: Date;
  priority: string;
  category?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private baseUrl = `${environment.apiUrl}/announcements`;
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {
    this.refreshUnreadCount();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getAnnouncements(activeOnly: boolean = true, limit: number = 50): Observable<AnnouncementListItem[]> {
    return this.http.get<AnnouncementListItem[]>(
      `${this.baseUrl}?activeOnly=${activeOnly}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
  }

  getAnnouncement(id: number): Observable<Announcement> {
    return this.http.get<Announcement>(
      `${this.baseUrl}/${id}`,
      { headers: this.getHeaders() }
    );
  }

  createAnnouncement(announcement: CreateAnnouncementDto): Observable<Announcement> {
    return this.http.post<Announcement>(
      this.baseUrl,
      announcement,
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => this.refreshUnreadCount())
    );
  }

  updateAnnouncement(id: number, announcement: Partial<CreateAnnouncementDto>): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/${id}`,
      announcement,
      { headers: this.getHeaders() }
    );
  }

  deleteAnnouncement(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${id}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => this.refreshUnreadCount())
    );
  }

  markAsRead(id: number): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/${id}/mark-read`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => this.refreshUnreadCount())
    );
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<number>(
      `${this.baseUrl}/unread-count`,
      { headers: this.getHeaders() }
    );
  }

  refreshUnreadCount(): void {
    this.getUnreadCount().subscribe({
      next: (count) => this.unreadCountSubject.next(count),
      error: (err) => console.error('Error refreshing unread count:', err)
    });
  }
}
