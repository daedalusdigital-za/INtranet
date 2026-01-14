import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Meeting {
  id: number;
  title: string;
  description?: string;
  meetingDate: Date;
  startTime: string;
  endTime?: string;
  location: string;
  meetingLink?: string;
  organizerId: number;
  organizerName: string;
  status: string;
  createdAt: Date;
  attendees: MeetingAttendee[];
}

export interface MeetingAttendee {
  id: number;
  userId: number;
  name: string;
  email: string;
  profilePictureUrl?: string;
  responseStatus: string;
  respondedAt?: Date;
}

export interface MeetingNotification {
  id: number;
  meetingId: number;
  meetingTitle: string;
  meetingDate: Date;
  startTime: string;
  location: string;
  organizerName: string;
  message: string;
  notificationType: string;
  isRead: boolean;
  createdAt: Date;
}

export interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  location: string;
  status: string;
  responseStatus: string;
  isOrganizer: boolean;
  color: string;
}

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Meetings
  getMeetings(): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(`${environment.apiUrl}/meetings`, { headers: this.getHeaders() });
  }

  getMeeting(id: number): Observable<Meeting> {
    return this.http.get<Meeting>(`${environment.apiUrl}/meetings/${id}`, { headers: this.getHeaders() });
  }

  createMeeting(meeting: any): Observable<Meeting> {
    return this.http.post<Meeting>(`${environment.apiUrl}/meetings`, meeting, { headers: this.getHeaders() });
  }

  updateMeeting(id: number, meeting: any): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/meetings/${id}`, meeting, { headers: this.getHeaders() });
  }

  cancelMeeting(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/meetings/${id}`, { headers: this.getHeaders() });
  }

  respondToMeeting(id: number, response: 'Accepted' | 'Declined'): Observable<any> {
    return this.http.post(`${environment.apiUrl}/meetings/${id}/respond`, 
      { responseStatus: response }, 
      { headers: this.getHeaders() }
    );
  }

  // Calendar
  getCalendarEvents(startDate?: Date, endDate?: Date): Observable<CalendarEvent[]> {
    let url = `${environment.apiUrl}/meetings/calendar`;
    const params: string[] = [];
    
    if (startDate) params.push(`startDate=${startDate.toISOString()}`);
    if (endDate) params.push(`endDate=${endDate.toISOString()}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    return this.http.get<CalendarEvent[]>(url, { headers: this.getHeaders() });
  }

  // Notifications
  getNotifications(unreadOnly: boolean = false): Observable<MeetingNotification[]> {
    return this.http.get<MeetingNotification[]>(
      `${environment.apiUrl}/meetings/notifications?unreadOnly=${unreadOnly}`, 
      { headers: this.getHeaders() }
    );
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      `${environment.apiUrl}/meetings/notifications/count`, 
      { headers: this.getHeaders() }
    );
  }

  markNotificationRead(id: number): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/meetings/notifications/${id}/read`, 
      {}, 
      { headers: this.getHeaders() }
    );
  }

  markAllNotificationsRead(): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/meetings/notifications/read-all`, 
      {}, 
      { headers: this.getHeaders() }
    );
  }

  refreshUnreadCount(): void {
    this.getUnreadCount().subscribe({
      next: (result) => {
        this.unreadCountSubject.next(result.count);
      },
      error: (err) => {
        console.error('Failed to fetch unread count:', err);
      }
    });
  }
}
