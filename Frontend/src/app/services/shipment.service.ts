import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ShipmentStatus =
  | 'BOOKED' | 'CONFIRMED' | 'REJECTED' | 'PLANNED' | 'WAYBILL_ISSUED' | 'COLLECTED' | 'COLLECTION_FAILED'
  | 'IN_TRANSIT' | 'ARRIVING' | 'DELIVERED' | 'DELIVERY_FAILED' | 'CANCELLED';

export interface ShipmentAddress {
  id?: number; label?: string | null; line1: string; line2?: string | null; suburb?: string | null; city?: string | null;
  province?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null;
  contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null; oneLine?: string;
}
export interface ShipmentItem {
  id?: number; type: 'parcel' | 'pallet'; qty: number; weightKg: number; lengthCm?: number | null; widthCm?: number | null;
  heightCm?: number | null; description?: string | null; itemBarcode?: string | null;
}
export interface ShipmentSummary {
  id: number; bookingId: number; bookingNo: string; clientReference?: string | null; customerId: number; customerName?: string;
  status: ShipmentStatus; collectionDate: string; collectionWindowFrom?: string | null; collectionWindowTo?: string | null;
  requestedDeliveryDate: string; loadId?: number | null; loadNumber?: string | null; eta?: string | null;
  waybillNo?: string | null; trackingToken?: string | null; fragile: boolean; hazardous: boolean; hazardClass?: string | null;
  temperatureRange?: string | null; damagedFlag: boolean; shortFlag: boolean; specialInstructions?: string | null;
  totalWeightKg: number; totalPallets: number; totalParcels: number; collectedAt?: string | null; deliveredAt?: string | null;
  createdAt: string; pickup: ShipmentAddress; delivery: ShipmentAddress; items: ShipmentItem[];
}
export interface ShipmentEvent {
  id: number; fromStatus?: string | null; toStatus: string; source: string; userName?: string | null;
  latitude?: number | null; longitude?: number | null; scannedCode?: string | null; note?: string | null; occurredAt: string;
}
export interface ShipmentDetail {
  shipment: ShipmentSummary; events: ShipmentEvent[]; allowedTransitions: string[];
  pod?: { receiverName?: string; signaturePath?: string; photos: string[]; latitude?: number; longitude?: number; deliveredAt: string; note?: string } | null;
  exceptions: { id: number; type: string; reasonCode?: string; note?: string; photos: string[]; createdAt: string; resolution?: string; resolvedAt?: string }[];
  notifications: { channel: string; recipient: string; template: string; status: string; error?: string; sentAt?: string; createdAt: string }[];
}
export interface BookingRow {
  id: number; bookingNo: string; customerId: number; customerName?: string; source: string; clientReference?: string | null;
  status: string; requestedByName?: string; requestedByEmail?: string; createdAt: string; confirmedAt?: string | null;
  rejectionReason?: string | null; shipmentCount: number; totalWeightKg: number; firstCollection?: string | null; statuses: string[];
}
export interface ShipmentCounts {
  bookingQueue: number; unplanned: number; onTheRoad: number; exceptions: number; dueToday: number; deliveredToday: number;
  byStatus: { status: string; count: number }[];
}
export interface Paged<T> { total: number; page: number; pageSize: number; items: T[]; }

/* ---- Rocket Freight client portal (ops side) ---- */
export interface PortalSummary {
  awaitingConfirmation: number; waybillsAwaiting: number; unplanned: number; onTripsheets: number; onTheRoad: number;
  deliveredToday: number; exceptions: number; unreadSupport: number; portalUsers: number;
}
export interface PortalPendingPlace { label?: string | null; suburb?: string | null; city?: string | null; province?: string | null; oneLine: string; contactName?: string | null; contactPhone?: string | null; }
export interface PortalPendingWaybill {
  id: number; status: ShipmentStatus; collectionDate: string; collectionWindowFrom?: string | null; collectionWindowTo?: string | null; requestedDeliveryDate: string;
  pickup: PortalPendingPlace; delivery: PortalPendingPlace; totalWeightKg: number; totalPallets: number; totalParcels: number;
  fragile: boolean; hazardous: boolean; hazardClass?: string | null; temperatureRange?: string | null; specialInstructions?: string | null;
  items: { type: string; qty: number; weightKg: number; description?: string | null }[];
}
export interface PortalPendingBooking {
  id: number; bookingNo: string; customerId: number; customerName?: string | null; clientReference?: string | null; status: string;
  requestedByName?: string | null; requestedByEmail?: string | null; requestedByPhone?: string | null; notes?: string | null; createdAt: string;
  waybills: PortalPendingWaybill[];
}
export interface PortalTripsheetWaybill {
  id: number; waybillNo?: string | null; trackingToken?: string | null; bookingNo: string; clientReference?: string | null; customerName?: string | null;
  status: ShipmentStatus; collectionDate: string; requestedDeliveryDate: string; eta?: string | null; collectedAt?: string | null; deliveredAt?: string | null;
  from?: string | null; to?: string | null; totalWeightKg: number; totalPallets: number; totalParcels: number; fragile: boolean; hazardous: boolean;
}
export interface PortalTripsheet {
  loadId: number; loadNumber: string; tripsheetNo: string; status: string; driverName?: string | null; vehicleReg?: string | null; warehouse?: string | null;
  date: string; scheduledDelivery?: string | null; totalStops: number; portalStops: number; distanceKm?: number | null; customers: string[]; totalKg: number;
  waybills: PortalTripsheetWaybill[];
}
export interface PortalUserRow {
  id: number; customerId: number; customerName?: string | null; name: string; email: string; phone?: string | null; role: string; isActive: boolean;
  mustChangePassword: boolean; lastLoginAt?: string | null; lockedUntil?: string | null; createdAt: string;
}
export interface PortalSupportThreadRow {
  portalUserId: number; unread: number; lastAt: string; last?: { from: string; text: string; shipmentRef?: string | null } | null;
  userName?: string | null; customerName?: string | null; email?: string | null;
}
export interface PortalSupportMessage { id: number; from: string; text: string; authorName?: string | null; shipmentId?: number | null; shipmentRef?: string | null; createdAt: string; }

/** Status words for the UI, in lifecycle order. */
export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  BOOKED: 'Booked', CONFIRMED: 'Confirmed', REJECTED: 'Rejected', PLANNED: 'Planned', WAYBILL_ISSUED: 'Waybill issued',
  COLLECTED: 'Collected', COLLECTION_FAILED: 'Collection failed', IN_TRANSIT: 'In transit', ARRIVING: 'Arriving',
  DELIVERED: 'Delivered', DELIVERY_FAILED: 'Delivery failed', CANCELLED: 'Cancelled'
};

@Injectable({ providedIn: 'root' })
export class ShipmentService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/logistics`;

  // Bookings
  listBookings(q: { status?: string; customerId?: number; search?: string; page?: number; pageSize?: number } = {}): Observable<Paged<BookingRow>> {
    return this.http.get<Paged<BookingRow>>(`${this.base}/bookings`, { params: this.params(q) });
  }
  getBooking(no: string) { return this.http.get<any>(`${this.base}/bookings/${encodeURIComponent(no)}`); }
  createBooking(body: any) { return this.http.post<{ id: number; bookingNo: string; shipmentIds: number[] }>(`${this.base}/bookings`, body); }
  validateBooking(body: any) { return this.http.post<{ valid: boolean; errors: string[] }>(`${this.base}/bookings/validate`, body); }
  acceptBooking(no: string, note?: string) { return this.http.post(`${this.base}/bookings/${no}/accept`, { note }); }
  rejectBooking(no: string, reason: string) { return this.http.post(`${this.base}/bookings/${no}/reject`, { reason }); }
  cancelBooking(no: string, note?: string) { return this.http.post(`${this.base}/bookings/${no}/cancel`, { note }); }
  queueCount() { return this.http.get<{ count: number }>(`${this.base}/bookings/queue-count`); }
  clients(search?: string) { return this.http.get<any[]>(`${this.base}/bookings/clients`, { params: this.params({ search }) }); }
  addresses(customerId: number) { return this.http.get<ShipmentAddress[]>(`${this.base}/bookings/addresses`, { params: { customerId } }); }
  saveAddress(customerId: number, a: ShipmentAddress) { return this.http.post<ShipmentAddress>(`${this.base}/bookings/addresses`, a, { params: { customerId } }); }

  // Shipments
  counts() { return this.http.get<ShipmentCounts>(`${this.base}/shipments/counts`); }
  list(q: { status?: string; customerId?: number; loadId?: number; search?: string; from?: string; to?: string; active?: boolean; page?: number; pageSize?: number } = {}) {
    return this.http.get<Paged<ShipmentSummary>>(`${this.base}/shipments`, { params: this.params(q) });
  }
  unplanned(q: { collectionDate?: string; province?: string } = {}) { return this.http.get<ShipmentSummary[]>(`${this.base}/shipments/unplanned`, { params: this.params(q) }); }
  get(id: number) { return this.http.get<ShipmentDetail>(`${this.base}/shipments/${id}`); }
  resolve(code: string) { return this.http.get<ShipmentSummary>(`${this.base}/shipments/resolve`, { params: { code } }); }
  exceptions() { return this.http.get<{ shipment: ShipmentSummary; exception: any }[]>(`${this.base}/shipments/exceptions`); }
  replan(id: number, note?: string) { return this.http.post(`${this.base}/shipments/${id}/replan`, { note }); }
  cancel(id: number, note?: string) { return this.http.post(`${this.base}/shipments/${id}/cancel`, { note }); }
  transition(id: number, to: string, note?: string) { return this.http.post(`${this.base}/shipments/${id}/transition`, { note }, { params: { to } }); }
  planOntoLoad(loadId: number, shipmentIds: number[]) {
    return this.http.post<{ loadId: number; loadNumber: string; warnings: string[]; shipments: ShipmentSummary[] }>(`${this.base}/loads/${loadId}/shipments`, { shipmentIds, createStops: true });
  }
  forLoad(loadId: number) { return this.http.get<ShipmentSummary[]>(`${this.base}/loads/${loadId}/shipments`); }

  // Documents (blob, auth header added by interceptor)
  waybillPdf(no: string) { return this.http.get(`${this.base}/waybills/${no}/pdf`, { responseType: 'blob' }); }
  labelPdf(no: string) { return this.http.get(`${this.base}/waybills/${no}/label`, { responseType: 'blob' }); }
  podPdf(id: number) { return this.http.get(`${this.base}/shipments/${id}/pod/pdf`, { responseType: 'blob' }); }

  // Rocket Freight client portal (Overberg tripsheets page) – api/logistics/portal
  portalSummary() { return this.http.get<PortalSummary>(`${this.base}/portal/summary`); }
  portalPending(search?: string) { return this.http.get<PortalPendingBooking[]>(`${this.base}/portal/pending`, { params: this.params({ search }) }); }
  portalConfirmWaybill(shipmentId: number, note?: string) { return this.http.post<{ id: number; status: string; bookingStatus: string }>(`${this.base}/portal/waybills/${shipmentId}/confirm`, { note }); }
  portalRejectWaybill(shipmentId: number, reason: string) { return this.http.post<{ id: number; status: string; bookingStatus: string }>(`${this.base}/portal/waybills/${shipmentId}/reject`, { reason }); }
  portalTripsheets(q: { status?: string; search?: string; from?: string; to?: string } = {}) { return this.http.get<PortalTripsheet[]>(`${this.base}/portal/tripsheets`, { params: this.params(q) }); }
  portalUsers(customerId?: number) { return this.http.get<PortalUserRow[]>(`${this.base}/portal/users`, { params: this.params({ customerId }) }); }
  portalCreateUser(body: { customerId: number; name: string; email: string; phone?: string; role: string; password?: string; sendWelcomeEmail: boolean }) {
    return this.http.post<{ user: PortalUserRow; temporaryPassword?: string | null }>(`${this.base}/portal/users`, body);
  }
  portalUpdateUser(id: number, body: { name?: string; phone?: string; role?: string; isActive?: boolean }) { return this.http.put<PortalUserRow>(`${this.base}/portal/users/${id}`, body); }
  portalResetPassword(id: number, sendEmail = true) { return this.http.post<{ temporaryPassword?: string | null }>(`${this.base}/portal/users/${id}/reset-password`, {}, { params: { sendEmail } }); }
  portalSupportThreads() { return this.http.get<PortalSupportThreadRow[]>(`${this.base}/portal/support`); }
  portalSupportThread(portalUserId: number) { return this.http.get<PortalSupportMessage[]>(`${this.base}/portal/support/${portalUserId}`); }
  portalSupportReply(portalUserId: number, text: string) { return this.http.post<PortalSupportMessage>(`${this.base}/portal/support/${portalUserId}/reply`, { text }); }

  // Public tracking (no auth)
  track(token: string) { return this.http.get<any>(`${environment.apiUrl}/t/${token}`); }

  openBlob(blob: Blob, filename: string, download = false) {
    const url = URL.createObjectURL(blob);
    if (download) { const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); }
    else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private params(o: Record<string, any>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return p;
  }
}
