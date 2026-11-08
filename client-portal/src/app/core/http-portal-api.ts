import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Address, BookingRequest, BookingResult, ClientUser, DocumentKind, LoginResponse,
  NotificationPrefs, Page, ShipmentCounts, ShipmentDetail, ShipmentQuery, ShipmentSummary,
  SendSupportMessage, SupportMessage, SupportThread, ValidationResult,
} from './models';
import { PortalApi } from './portal-api';

@Injectable()
export class HttpPortalApi extends PortalApi {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, { email, password });
  }
  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/forgot-password`, { email });
  }
  me(): Observable<ClientUser> {
    return this.http.get<ClientUser>(`${this.base}/me`);
  }
  counts(): Observable<ShipmentCounts> {
    return this.http.get<ShipmentCounts>(`${this.base}/shipments/counts`);
  }
  shipments(q: ShipmentQuery): Observable<Page<ShipmentSummary>> {
    let params = new HttpParams().set('filter', q.filter).set('page', q.page).set('pageSize', q.pageSize);
    if (q.search) params = params.set('search', q.search);
    if (q.from) params = params.set('from', q.from);
    if (q.to) params = params.set('to', q.to);
    return this.http.get<Page<ShipmentSummary>>(`${this.base}/shipments`, { params });
  }
  shipment(id: number): Observable<ShipmentDetail> {
    return this.http.get<ShipmentDetail>(`${this.base}/shipments/${id}`);
  }
  cancelShipment(id: number, reason: string): Observable<ShipmentDetail> {
    return this.http.post<ShipmentDetail>(`${this.base}/shipments/${id}/cancel`, { reason });
  }
  validateBooking(req: BookingRequest): Observable<ValidationResult> {
    return this.http.post<ValidationResult>(`${this.base}/bookings/validate`, req);
  }
  createBooking(req: BookingRequest): Observable<BookingResult> {
    return this.http.post<BookingResult>(`${this.base}/bookings`, req);
  }
  addresses(): Observable<Address[]> {
    return this.http.get<Address[]>(`${this.base}/addresses`);
  }
  saveAddress(a: Address): Observable<Address> {
    return a.id
      ? this.http.put<Address>(`${this.base}/addresses/${a.id}`, a)
      : this.http.post<Address>(`${this.base}/addresses`, a);
  }
  deleteAddress(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/addresses/${id}`);
  }
  notificationPrefs(): Observable<NotificationPrefs> {
    return this.http.get<NotificationPrefs>(`${this.base}/settings/notifications`);
  }
  saveNotificationPrefs(p: NotificationPrefs): Observable<NotificationPrefs> {
    return this.http.put<NotificationPrefs>(`${this.base}/settings/notifications`, p);
  }
  documentUrl(id: number, kind: DocumentKind): Observable<string> {
    return this.http
      .get<{ url: string }>(`${this.base}/shipments/${id}/documents/${kind}`)
      .pipe(map(r => r.url));
  }

  supportThread(): Observable<SupportThread> {
    return this.http.get<SupportThread>(`${this.base}/support/thread`);
  }
  sendSupportMessage(m: SendSupportMessage): Observable<SupportMessage> {
    return this.http.post<SupportMessage>(`${this.base}/support/thread/messages`, m);
  }
  supportMessagesAfter(afterId: string | null): Observable<SupportMessage[]> {
    const params = afterId ? new HttpParams().set('after', afterId) : undefined;
    return this.http.get<SupportMessage[]>(`${this.base}/support/thread/messages`, { params });
  }
}
