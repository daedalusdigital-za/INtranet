/**
 * API contract for the client portal.
 * The backend's /api/portal endpoints return exactly these shapes (JSON, camelCase,
 * dates as ISO 8601 strings). The customer is always taken from the login token,
 * so no request carries a customerId.
 */

export type ShipmentStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'PLANNED'
  | 'WAYBILL_ISSUED'
  | 'COLLECTED'
  | 'IN_TRANSIT'
  | 'ARRIVING'
  | 'DELIVERED'
  | 'COLLECTION_FAILED'
  | 'DELIVERY_FAILED'
  | 'REJECTED'
  | 'CANCELLED';

export type Province =
  | 'Eastern Cape' | 'Free State' | 'Gauteng' | 'KwaZulu-Natal' | 'Limpopo'
  | 'Mpumalanga' | 'North West' | 'Northern Cape' | 'Western Cape';

export const PROVINCES: Province[] = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

export interface ClientUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  customerName: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: ClientUser;
}

export interface Address {
  id?: number;
  label?: string;            // e.g. "Midrand DC" (address book only)
  street: string;
  unit?: string;
  suburb: string;
  city: string;
  province: Province;
  postalCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  lat?: number;              // from Google Places; needed later for Cartrack geofences and ETA
  lng?: number;
  placeId?: string;
}

/** Either an address book id, or a new address (optionally saved to the book). */
export interface AddressInput {
  addressId?: number;
  address?: Address;
  saveToBook?: boolean;
}

export interface CargoLine {
  type: 'parcel' | 'pallet';
  qty: number;
  weightKg: number;          // per unit
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  description: string;
  itemBarcode?: string;      // returned once the waybill is issued
}

export interface ShipmentDraft {
  pickup: AddressInput;
  delivery: AddressInput;
  collectionDate: string;    // yyyy-MM-dd
  windowFrom: string;        // HH:mm
  windowTo: string;          // HH:mm
  deliverBy: string;         // yyyy-MM-dd
  cargo: CargoLine[];
  fragile: boolean;
  hazardous: boolean;
  hazardClass?: string;
  tempRange?: string;
  instructions?: string;
}

export interface BookingRequest {
  clientReference?: string;
  requestedBy: { name: string; email: string; phone: string };
  shipments: ShipmentDraft[];
}

/** path uses the form shown to the user, e.g. "shipments[0].cargo[1].weightKg" */
export interface ValidationProblem {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  problems: ValidationProblem[];
}

export interface BookingResult {
  bookingNo: string;
  shipmentIds: number[];
}

export interface Place {
  suburb: string;
  city: string;
}

export interface ShipmentSummary {
  id: number;
  bookingNo: string;
  waybillNo?: string;
  clientReference?: string;
  status: ShipmentStatus;
  from: Place;
  to: Place;
  collectionDate: string;
  deliverBy: string;
  pieces: number;
  totalKg: number;
  eta?: string;
  deliveredAt?: string;
}

export interface ShipmentEventView {
  status: ShipmentStatus;
  at: string;
  /** Client-safe text, e.g. "Collected by driver". Internal notes are never sent. */
  text: string;
}

export interface Tracking {
  lat: number;
  lng: number;
  updatedAt: string;
  eta?: string;
  kmRemaining?: number;
  /** 0..1 share of the route covered, for the route strip */
  progress: number;
}

export interface Pod {
  receiverName: string;
  deliveredAt: string;
  signatureUrl: string;
  photoUrls: string[];
  damaged: boolean;
  short: boolean;
  note?: string;
}

export interface ShipmentDetail extends ShipmentSummary {
  pickup: Address;
  delivery: Address;
  windowFrom: string;
  windowTo: string;
  cargo: CargoLine[];
  fragile: boolean;
  hazardous: boolean;
  hazardClass?: string;
  tempRange?: string;
  instructions?: string;
  events: ShipmentEventView[];
  tracking?: Tracking;       // only while COLLECTED, IN_TRANSIT or ARRIVING
  pod?: Pod;                 // only once DELIVERED
  /** Client-friendly reason when a collection or delivery failed */
  problem?: string;
  trackingUrl?: string;
  canCancel: boolean;        // server decides: BOOKED or CONFIRMED
}

export type ShipmentFilter =
  | 'active' | 'awaiting' | 'scheduled' | 'onTheRoad' | 'attention' | 'delivered' | 'closed' | 'all';

export interface ShipmentQuery {
  filter: ShipmentFilter;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ShipmentCounts = Record<Exclude<ShipmentFilter, 'all' | 'closed'>, number>;

export type NotificationEvent =
  | 'BOOKED' | 'CONFIRMED' | 'REJECTED' | 'COLLECTED' | 'ARRIVING'
  | 'DELIVERED' | 'PROBLEM' | 'CANCELLED';

export interface NotificationRule {
  event: NotificationEvent;
  email: boolean;
  sms: boolean;
  smsAvailable: boolean;
}

export interface NotificationPrefs {
  rules: NotificationRule[];
  extraEmails: string[];
  smsNumber?: string;
  smsOptIn: boolean;
}

export type DocumentKind = 'waybill' | 'labels' | 'pod';

/* ---------- Support chat ---------- */

export interface SupportMessage {
  id: string;
  from: 'client' | 'agent' | 'system';
  text: string;
  at: string;                 // ISO date-time
  authorName?: string;        // agent first name, or the client user's name
  shipmentRef?: string;       // waybill or booking number the message is about
}

export interface SupportThread {
  id: string;
  messages: SupportMessage[];
  /** Plain-text opening hours, e.g. "Mon–Fri 07:00–18:00, Sat 08:00–13:00" */
  hours: string;
  /** True when an agent is on duty now; outside hours the client is told when to expect a reply */
  online: boolean;
}

export interface SendSupportMessage {
  text: string;
  shipmentId?: number;
}
