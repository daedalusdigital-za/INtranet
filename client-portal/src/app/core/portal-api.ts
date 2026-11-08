import { Observable } from 'rxjs';
import {
  Address, BookingRequest, BookingResult, ClientUser, DocumentKind, LoginResponse,
  NotificationPrefs, Page, ShipmentCounts, ShipmentDetail, ShipmentQuery, ShipmentSummary,
  SendSupportMessage, SupportMessage, SupportThread, ValidationResult,
} from './models';

/**
 * Everything the portal needs from the backend. Two implementations:
 * HttpPortalApi (real /api/portal endpoints) and MockPortalApi (demo data).
 * Endpoint for each method is noted alongside it.
 */
export abstract class PortalApi {
  /** POST /auth/login  {email, password} */
  abstract login(email: string, password: string): Observable<LoginResponse>;
  /** POST /auth/forgot-password  {email} — always 204, never reveals whether the email exists */
  abstract forgotPassword(email: string): Observable<void>;
  /** GET /me */
  abstract me(): Observable<ClientUser>;

  /** GET /shipments/counts */
  abstract counts(): Observable<ShipmentCounts>;
  /** GET /shipments?filter=&search=&from=&to=&page=&pageSize= */
  abstract shipments(q: ShipmentQuery): Observable<Page<ShipmentSummary>>;
  /** GET /shipments/{id} */
  abstract shipment(id: number): Observable<ShipmentDetail>;
  /** POST /shipments/{id}/cancel  {reason} — 409 if no longer cancellable */
  abstract cancelShipment(id: number, reason: string): Observable<ShipmentDetail>;

  /** POST /bookings/validate — same rules as ops booking, nothing saved */
  abstract validateBooking(req: BookingRequest): Observable<ValidationResult>;
  /** POST /bookings — 201 {bookingNo, shipmentIds}; 422 {problems} */
  abstract createBooking(req: BookingRequest): Observable<BookingResult>;

  /** GET /addresses */
  abstract addresses(): Observable<Address[]>;
  /** POST /addresses (new) or PUT /addresses/{id} */
  abstract saveAddress(a: Address): Observable<Address>;
  /** DELETE /addresses/{id} */
  abstract deleteAddress(id: number): Observable<void>;

  /** GET /settings/notifications */
  abstract notificationPrefs(): Observable<NotificationPrefs>;
  /** PUT /settings/notifications */
  abstract saveNotificationPrefs(p: NotificationPrefs): Observable<NotificationPrefs>;

  /** GET /shipments/{id}/documents/{kind} — PDF; the server returns a short-lived signed URL */
  abstract documentUrl(id: number, kind: DocumentKind): Observable<string>;

  /** GET /support/thread — the signed-in user's support conversation (created on first use) */
  abstract supportThread(): Observable<SupportThread>;
  /** POST /support/thread/messages  {text, shipmentId?} — returns the stored message */
  abstract sendSupportMessage(m: SendSupportMessage): Observable<SupportMessage>;
  /** GET /support/thread/messages?after={id} — new messages since the last one seen (polled) */
  abstract supportMessagesAfter(afterId: string | null): Observable<SupportMessage[]>;
}
