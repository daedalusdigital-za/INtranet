import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { checkBooking, isoDate } from './booking-rules';
import {
  Address, BookingRequest, BookingResult, CargoLine, ClientUser, DocumentKind, LoginResponse,
  NotificationPrefs, Page, ShipmentCounts, ShipmentDetail, ShipmentEventView, ShipmentQuery,
  ShipmentStatus, ShipmentSummary, ValidationResult,
  SendSupportMessage, SupportMessage, SupportThread,
} from './models';
import { PortalApi } from './portal-api';
import { FILTER_STATUSES, STATUS_LABEL } from './status';

/** Demo data so the portal runs without a backend. Not used in production builds. */

const USER: ClientUser = {
  id: 7, name: 'Thandi Mokoena', email: 'thandi@mzansihome.co.za', phone: '082 555 0107',
  role: 'admin', customerName: 'Mzansi Home Goods (Pty) Ltd',
};
const DEMO_USER: ClientUser = { ...USER, id: 8, email: 'weclome@rocketfreight.co.za' };
const DEMO_PASSWORD = '1234';

const BOOK: Address[] = [
  { id: 1, label: 'Midrand DC', street: '12 Main Rd', suburb: 'Halfway House', city: 'Midrand', province: 'Gauteng', postalCode: '1685', contactName: 'Sipho Ndlovu', contactPhone: '082 555 0141', lat: -25.99, lng: 28.13 },
  { id: 2, label: 'Durban Point store', street: '45 Mahatma Gandhi Rd', suburb: 'Point', city: 'Durban', province: 'KwaZulu-Natal', postalCode: '4001', contactName: 'Priya Naidoo', contactPhone: '083 555 0192', lat: -29.862, lng: 31.04 },
  { id: 3, label: 'Pinetown warehouse', street: '8 Old Main Rd', suburb: 'Pinetown', city: 'Pinetown', province: 'KwaZulu-Natal', postalCode: '3610', contactName: 'Bongani Zulu', contactPhone: '072 555 0133', lat: -29.815, lng: 30.86 },
  { id: 4, label: 'Cape Town store', street: '22 Bofors Circle', suburb: 'Epping Industria', city: 'Cape Town', province: 'Western Cape', postalCode: '7460', contactName: 'Lauren Adams', contactPhone: '084 555 0177', lat: -33.93, lng: 18.53 },
  { id: 5, label: 'Polokwane store', street: '17 Landdros Mare St', suburb: 'Polokwane Central', city: 'Polokwane', province: 'Limpopo', postalCode: '0699', contactName: 'Pieter Botha', contactPhone: '076 555 0158', lat: -23.9, lng: 29.45 },
  { id: 6, label: 'Gqeberha store', street: '3 Uitenhage Rd', suburb: 'North End', city: 'Gqeberha', province: 'Eastern Cape', postalCode: '6001', contactName: 'Ayanda Jacobs', contactPhone: '079 555 0116', lat: -33.93, lng: 25.58 },
];

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
const at = (n: number, hhmm: string) => `${day(n)}T${hhmm}:00+02:00`;
const minsFromNow = (m: number) => new Date(Date.now() + m * 60000).toISOString();

const SIGNATURE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><path d="M14 58c18-40 30 10 46-14s20-30 34 4 22 16 38-12 24-8 34 10 18-6 30-14 14 2 26 6" fill="none" stroke="#1d2a35" stroke-width="2.5" stroke-linecap="round"/></svg>`);

interface Seed {
  id: number; bk: string; wb?: string; ref: string; from: number; to: number; status: ShipmentStatus;
  coll: number; by: number; cargo: CargoLine[]; progress?: number; km?: number; etaMin?: number;
  problem?: string; damaged?: boolean; note?: string; instructions?: string; fragile?: boolean;
}

const pallets = (qty: number, kg: number, d: string): CargoLine =>
  ({ type: 'pallet', qty, weightKg: kg, lengthCm: 120, widthCm: 100, heightCm: 140, description: d });
const parcels = (qty: number, kg: number, d: string): CargoLine =>
  ({ type: 'parcel', qty, weightKg: kg, lengthCm: 60, widthCm: 40, heightCm: 40, description: d });

const SEEDS: Seed[] = [
  { id: 1041, bk: 'BK-2026-000231', wb: 'WB-2026-000123', ref: 'PO-55821', from: 1, to: 2, status: 'IN_TRANSIT', coll: 0, by: 0, cargo: [pallets(4, 300, 'Boxed kettles and toasters')], progress: 0.78, km: 62, etaMin: 48, fragile: true, instructions: 'Receiving bay at the back, use the Point Rd gate.' },
  { id: 1042, bk: 'BK-2026-000231', wb: 'WB-2026-000124', ref: 'PO-55821', from: 1, to: 3, status: 'ARRIVING', coll: 0, by: 0, cargo: [pallets(2, 280, 'Bedding sets'), parcels(6, 12, 'Cushions')], progress: 0.96, km: 3, etaMin: 9 },
  { id: 1043, bk: 'BK-2026-000233', wb: 'WB-2026-000131', ref: 'PO-55840', from: 1, to: 5, status: 'COLLECTED', coll: 0, by: 1, cargo: [pallets(3, 410, 'Garden furniture, flat-packed')], progress: 0.04, km: 274, etaMin: 230 },
  { id: 1044, bk: 'BK-2026-000236', ref: 'PO-55902', from: 1, to: 4, status: 'BOOKED', coll: 2, by: 5, cargo: [pallets(6, 350, 'Kitchenware, mixed')] },
  { id: 1045, bk: 'BK-2026-000234', wb: 'WB-2026-000140', ref: 'PO-55870', from: 1, to: 6, status: 'WAYBILL_ISSUED', coll: 1, by: 3, cargo: [pallets(2, 260, 'Bathroom accessories')] },
  { id: 1046, bk: 'BK-2026-000235', ref: 'PO-55881', from: 2, to: 1, status: 'CONFIRMED', coll: 1, by: 2, cargo: [parcels(14, 9, 'Customer returns')] },
  { id: 1047, bk: 'BK-2026-000228', wb: 'WB-2026-000109', ref: 'PO-55790', from: 1, to: 2, status: 'DELIVERY_FAILED', coll: -1, by: 0, cargo: [pallets(1, 320, 'Mirrors')], fragile: true, problem: 'The delivery site was closed when the driver arrived. We will schedule a new attempt and let you know the new date.' },
  { id: 1048, bk: 'BK-2026-000226', wb: 'WB-2026-000101', ref: 'PO-55761', from: 1, to: 4, status: 'DELIVERED', coll: -4, by: -1, cargo: [pallets(5, 330, 'Lamps and shades')] },
  { id: 1049, bk: 'BK-2026-000226', wb: 'WB-2026-000102', ref: 'PO-55761', from: 1, to: 6, status: 'DELIVERED', coll: -4, by: -2, cargo: [pallets(2, 300, 'Dinner sets')], damaged: true, note: 'One carton crushed on the top layer; receiver signed with remark.' },
  { id: 1050, bk: 'BK-2026-000224', wb: 'WB-2026-000097', ref: 'PO-55744', from: 3, to: 1, status: 'DELIVERED', coll: -5, by: -3, cargo: [parcels(20, 8, 'Stock transfer')] },
  { id: 1051, bk: 'BK-2026-000222', ref: 'PO-55730', from: 1, to: 5, status: 'CANCELLED', coll: -2, by: 0, cargo: [pallets(1, 200, 'Display stands')] },
  { id: 1052, bk: 'BK-2026-000237', ref: 'PO-55915', from: 1, to: 2, status: 'BOOKED', coll: 3, by: 4, cargo: [pallets(8, 310, 'Seasonal stock')] },
];

const CHAIN: ShipmentStatus[] = ['BOOKED', 'CONFIRMED', 'WAYBILL_ISSUED', 'COLLECTED', 'IN_TRANSIT', 'ARRIVING', 'DELIVERED'];
const EVENT_TEXT: Partial<Record<ShipmentStatus, string>> = {
  BOOKED: 'Booking received', CONFIRMED: 'Booking confirmed', WAYBILL_ISSUED: 'Scheduled for collection, waybill issued',
  COLLECTED: 'Collected by driver', IN_TRANSIT: 'On the road', ARRIVING: 'Truck is close to the delivery address',
  DELIVERED: 'Delivered and signed for', DELIVERY_FAILED: 'Delivery attempt failed', CANCELLED: 'Shipment cancelled',
};

function eventsFor(s: Seed): ShipmentEventView[] {
  const ev = (status: ShipmentStatus, when: string): ShipmentEventView => ({ status, at: when, text: EVENT_TEXT[status] ?? status });
  const out: ShipmentEventView[] = [];
  const target = s.status === 'DELIVERY_FAILED' ? 'IN_TRANSIT' : s.status === 'CANCELLED' ? 'CONFIRMED' : s.status;
  const end = CHAIN.indexOf(target);
  const times = [at(s.coll - 2, '10:12'), at(s.coll - 2, '13:40'), at(s.coll - 1, '15:05'), at(s.coll, '08:40'), at(s.coll, '09:15'), at(s.by, '13:50'), at(s.by, '14:31')];
  for (let i = 0; i <= end; i++) out.push(ev(CHAIN[i], times[i]));
  if (s.status === 'DELIVERY_FAILED') out.push(ev('DELIVERY_FAILED', at(s.by, '11:20')));
  if (s.status === 'CANCELLED') out.push(ev('CANCELLED', at(s.coll - 1, '09:02')));
  return out.reverse();
}

@Injectable()
export class MockPortalApi extends PortalApi {
  private book = [...BOOK];
  private seeds = [...SEEDS];
  private nextBk = 238;
  private nextShipment = 1060;
  private extra = new Map<number, { pickup: Address; delivery: Address; windowFrom: string; windowTo: string; hazardous: boolean; hazardClass?: string; tempRange?: string }>();
  private prefs: NotificationPrefs = {
    rules: [
      { event: 'BOOKED', email: true, sms: false, smsAvailable: false },
      { event: 'CONFIRMED', email: true, sms: false, smsAvailable: false },
      { event: 'REJECTED', email: true, sms: false, smsAvailable: false },
      { event: 'COLLECTED', email: true, sms: false, smsAvailable: true },
      { event: 'ARRIVING', email: false, sms: true, smsAvailable: true },
      { event: 'DELIVERED', email: true, sms: false, smsAvailable: true },
      { event: 'PROBLEM', email: true, sms: true, smsAvailable: true },
      { event: 'CANCELLED', email: true, sms: false, smsAvailable: false },
    ],
    extraEmails: ['dispatch@mzansihome.co.za'],
    smsNumber: '082 555 0107',
    smsOptIn: true,
  };

  private wait<T>(v: T): Observable<T> { return of(structuredClone(v)).pipe(delay(220)); }

  login(email: string, password: string): Observable<LoginResponse> {
    if (!email || !password) return throwError(() => ({ status: 401 }));
    const isDemoUser = email.trim().toLowerCase() === DEMO_USER.email;
    if (isDemoUser && password !== DEMO_PASSWORD) return throwError(() => ({ status: 401 }));
    return this.wait({ token: 'demo-token', expiresAt: minsFromNow(30), user: isDemoUser ? DEMO_USER : { ...USER, email } });
  }
  forgotPassword(): Observable<void> { return this.wait(undefined as void); }
  me(): Observable<ClientUser> { return this.wait(USER); }

  counts(): Observable<ShipmentCounts> {
    const n = (f: keyof typeof FILTER_STATUSES) => this.seeds.filter(s => FILTER_STATUSES[f]!.includes(s.status)).length;
    return this.wait({ active: n('active'), awaiting: n('awaiting'), scheduled: n('scheduled'), onTheRoad: n('onTheRoad'), attention: n('attention'), delivered: n('delivered') });
  }

  shipments(q: ShipmentQuery): Observable<Page<ShipmentSummary>> {
    const allowed = FILTER_STATUSES[q.filter];
    const term = (q.search ?? '').trim().toLowerCase();
    let rows = this.seeds
      .filter(s => !allowed || allowed.includes(s.status))
      .map(s => this.summary(s))
      .filter(s => !term || [s.waybillNo, s.bookingNo, s.clientReference, s.from.city, s.to.city, s.from.suburb, s.to.suburb]
        .some(v => v?.toLowerCase().includes(term)))
      .filter(s => (!q.from || s.collectionDate >= q.from) && (!q.to || s.collectionDate <= q.to));
    rows = rows.sort((a, b) => b.collectionDate.localeCompare(a.collectionDate) || b.id - a.id);
    const start = (q.page - 1) * q.pageSize;
    return this.wait({ items: rows.slice(start, start + q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize });
  }

  shipment(id: number): Observable<ShipmentDetail> {
    const s = this.seeds.find(x => x.id === id);
    return s ? this.wait(this.detail(s)) : throwError(() => ({ status: 404 }));
  }

  cancelShipment(id: number): Observable<ShipmentDetail> {
    const s = this.seeds.find(x => x.id === id);
    if (!s || !['BOOKED', 'CONFIRMED'].includes(s.status)) return throwError(() => ({ status: 409 }));
    s.status = 'CANCELLED';
    return this.wait(this.detail(s));
  }

  validateBooking(req: BookingRequest): Observable<ValidationResult> {
    const problems = checkBooking(req);
    return this.wait({ ok: problems.length === 0, problems });
  }

  createBooking(req: BookingRequest): Observable<BookingResult> {
    const problems = checkBooking(req);
    if (problems.length) return throwError(() => ({ status: 422, error: { problems } }));
    const bk = `BK-2026-${String(this.nextBk++).padStart(6, '0')}`;
    const ids: number[] = [];
    for (const d of req.shipments) {
      const pickup = this.resolve(d.pickup);
      const delivery = this.resolve(d.delivery);
      const id = this.nextShipment++;
      ids.push(id);
      this.seeds.unshift({
        id, bk, ref: req.clientReference ?? '', from: pickup.id!, to: delivery.id!, status: 'BOOKED',
        coll: daysFromToday(d.collectionDate), by: daysFromToday(d.deliverBy), cargo: d.cargo,
        fragile: d.fragile, instructions: d.instructions,
      });
      this.extra.set(id, { pickup, delivery, windowFrom: d.windowFrom, windowTo: d.windowTo, hazardous: d.hazardous, hazardClass: d.hazardClass, tempRange: d.tempRange });
    }
    return this.wait({ bookingNo: bk, shipmentIds: ids });
  }

  addresses(): Observable<Address[]> { return this.wait(this.book); }
  saveAddress(a: Address): Observable<Address> {
    if (a.id) { this.book = this.book.map(x => (x.id === a.id ? a : x)); return this.wait(a); }
    const saved = { ...a, id: Math.max(0, ...this.book.map(x => x.id!)) + 1 };
    this.book = [...this.book, saved];
    return this.wait(saved);
  }
  deleteAddress(id: number): Observable<void> {
    this.book = this.book.filter(x => x.id !== id);
    return this.wait(undefined as void);
  }

  notificationPrefs(): Observable<NotificationPrefs> { return this.wait(this.prefs); }
  saveNotificationPrefs(p: NotificationPrefs): Observable<NotificationPrefs> { this.prefs = structuredClone(p); return this.wait(p); }

  /** The demo has no PDFs; an empty URL tells the page to say so. */
  documentUrl(_id: number, _kind: DocumentKind): Observable<string> { return this.wait(''); }

  private resolve(input: { addressId?: number; address?: Address; saveToBook?: boolean }): Address {
    if (input.addressId) return this.book.find(a => a.id === input.addressId)!;
    const a = { ...input.address!, id: 100 + this.nextShipment };
    if (input.saveToBook) this.book = [...this.book, { ...a, id: Math.max(...this.book.map(x => x.id!)) + 1 }];
    return a;
  }

  private addr(id: number, shipmentId: number, which: 'pickup' | 'delivery'): Address {
    return this.extra.get(shipmentId)?.[which] ?? this.book.find(a => a.id === id) ?? BOOK.find(a => a.id === id)!;
  }

  private summary(s: Seed): ShipmentSummary {
    const from = this.addr(s.from, s.id, 'pickup');
    const to = this.addr(s.to, s.id, 'delivery');
    return {
      id: s.id, bookingNo: s.bk, waybillNo: s.wb, clientReference: s.ref, status: s.status,
      from: { suburb: from.suburb, city: from.city }, to: { suburb: to.suburb, city: to.city },
      collectionDate: day(s.coll), deliverBy: day(s.by),
      pieces: s.cargo.reduce((n, c) => n + c.qty, 0),
      totalKg: s.cargo.reduce((n, c) => n + c.qty * c.weightKg, 0),
      eta: s.etaMin !== undefined ? minsFromNow(s.etaMin) : undefined,
      deliveredAt: s.status === 'DELIVERED' ? at(s.by, '14:31') : undefined,
    };
  }

  private detail(s: Seed): ShipmentDetail {
    const x = this.extra.get(s.id);
    const moving = ['COLLECTED', 'IN_TRANSIT', 'ARRIVING'].includes(s.status);
    const sum = this.summary(s);
    return {
      ...sum,
      pickup: this.addr(s.from, s.id, 'pickup'),
      delivery: this.addr(s.to, s.id, 'delivery'),
      windowFrom: x?.windowFrom ?? '08:00', windowTo: x?.windowTo ?? '12:00',
      cargo: s.cargo.map((c, i) => ({ ...c, itemBarcode: s.wb ? `${s.wb}-${String(i + 1).padStart(2, '0')}` : undefined })),
      fragile: !!s.fragile, hazardous: x?.hazardous ?? false, hazardClass: x?.hazardClass, tempRange: x?.tempRange,
      instructions: s.instructions,
      events: s.id >= 1060 ? [{ status: 'BOOKED', at: new Date().toISOString(), text: 'Booking received' }] : eventsFor(s),
      tracking: moving ? { lat: -29.6, lng: 30.4, updatedAt: minsFromNow(-2), eta: sum.eta, kmRemaining: s.km, progress: s.progress ?? 0 } : undefined,
      pod: s.status === 'DELIVERED' ? {
        receiverName: this.addr(s.to, s.id, 'delivery').contactName, deliveredAt: sum.deliveredAt!,
        signatureUrl: SIGNATURE, photoUrls: [], damaged: !!s.damaged, short: false, note: s.note,
      } : undefined,
      problem: s.problem,
      trackingUrl: s.wb ? `https://track.example.co.za/t/${s.wb.slice(-6)}k3v9QpLx` : undefined,
      canCancel: ['BOOKED', 'CONFIRMED'].includes(s.status),
    };
  }

  /* ---------- Support chat (demo: canned replies from "Lerato") ---------- */
  private chat: SupportMessage[] = [];
  private chatQueue: SupportMessage[] = [];
  private chatN = 0;

  supportThread(): Observable<SupportThread> {
    if (!this.chat.length) {
      this.chat.push({ id: 'm' + (++this.chatN), from: 'agent', authorName: 'Lerato', at: new Date().toISOString(),
        text: `Hi ${USER.name.split(' ')[0]}, you’re through to the Rocket Freight support desk. Ask us anything about a booking, a shipment or your documents.` });
    }
    return this.wait({ id: 'demo-thread', messages: this.chat, hours: 'Mon–Fri 07:00–18:00, Sat 08:00–13:00', online: true });
  }

  sendSupportMessage(m: SendSupportMessage): Observable<SupportMessage> {
    const seed = m.shipmentId ? this.seeds.find(x => x.id === m.shipmentId) : undefined;
    const ref = seed ? (seed.wb ?? seed.bk) : undefined;
    const msg: SupportMessage = { id: 'm' + (++this.chatN), from: 'client', authorName: USER.name, text: m.text, at: new Date().toISOString(), shipmentRef: ref };
    this.chat.push(msg);
    const reply: SupportMessage = { id: 'm' + (++this.chatN), from: 'agent', authorName: 'Lerato', text: this.cannedReply(m.text, seed), at: new Date(Date.now() + 2600).toISOString() };
    this.chatQueue.push(reply);
    return this.wait(msg);
  }

  supportMessagesAfter(afterId: string | null): Observable<SupportMessage[]> {
    const now = Date.now();
    const due = this.chatQueue.filter(r => Date.parse(r.at) <= now);
    this.chatQueue = this.chatQueue.filter(r => Date.parse(r.at) > now);
    this.chat.push(...due);
    const i = afterId ? this.chat.findIndex(x => x.id === afterId) : -1;
    return this.wait(this.chat.slice(i + 1));
  }

  private cannedReply(text: string, seed?: Seed): string {
    const t = text.toLowerCase();
    const ref = seed ? (seed.wb ?? seed.bk) : '';
    if (seed && /(where|eta|track|late|arriv|when)/.test(t))
      return `I’ve checked ${ref}: it’s ${STATUS_LABEL[seed.status].toLowerCase()}${seed.etaMin ? `, expected in about ${seed.etaMin} minutes` : ''}. The shipment page shows the latest time and position, and I’ll message you here if anything changes.`;
    if (/(where|eta|track|late|arriv)/.test(t))
      return 'Happy to check. Which waybill or booking number is it? You can also open the shipment and chat from there so I can see it straight away.';
    if (/(cancel|change|amend|edit|date)/.test(t))
      return 'You can cancel in the portal while it’s waiting for confirmation or confirmed. To change a date, address or the goods, tell me what should change and I’ll update the booking for you.';
    if (/(label|qr|barcode|print|waybill|scan)/.test(t))
      return 'Labels and the waybill are on the shipment page once it’s scheduled for collection. Reprints keep the same numbers, so they scan exactly like the originals.';
    if (/(pod|proof|sign|damage|short)/.test(t))
      return 'The signed proof of delivery is on the shipment page under Proof of delivery. If something arrived damaged or short, send me the waybill number and a photo and I’ll open a claim.';
    return 'Thanks, I’m on it. I’ll reply here shortly; you can carry on using the portal and I’ll let you know when there’s an answer.';
  }
}

function daysFromToday(iso: string): number {
  const ms = new Date(iso + 'T12:00:00').getTime() - new Date(isoDate(new Date()) + 'T12:00:00').getTime();
  return Math.round(ms / 86400000);
}
import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { checkBooking, isoDate } from './booking-rules';
import {
  Address, BookingRequest, BookingResult, CargoLine, ClientUser, DocumentKind, LoginResponse,
  NotificationPrefs, Page, ShipmentCounts, ShipmentDetail, ShipmentEventView, ShipmentQuery,
  ShipmentStatus, ShipmentSummary, ValidationResult,
  SendSupportMessage, SupportMessage, SupportThread,
} from './models';
import { PortalApi } from './portal-api';
import { FILTER_STATUSES, STATUS_LABEL } from './status';

/** Demo data so the portal runs without a backend. Not used in production builds. */

const USER: ClientUser = {
  id: 7, name: 'Thandi Mokoena', email: 'thandi@mzansihome.co.za', phone: '082 555 0107',
  role: 'admin', customerName: 'Mzansi Home Goods (Pty) Ltd',
};
const DEMO_USER: ClientUser = { ...USER, id: 8, email: 'weclome@rocketfreight.co.za' };
const DEMO_PASSWORD = '1234';

const BOOK: Address[] = [
  { id: 1, label: 'Midrand DC', street: '12 Main Rd', suburb: 'Halfway House', city: 'Midrand', province: 'Gauteng', postalCode: '1685', contactName: 'Sipho Ndlovu', contactPhone: '082 555 0141', lat: -25.99, lng: 28.13 },
  { id: 2, label: 'Durban Point store', street: '45 Mahatma Gandhi Rd', suburb: 'Point', city: 'Durban', province: 'KwaZulu-Natal', postalCode: '4001', contactName: 'Priya Naidoo', contactPhone: '083 555 0192', lat: -29.862, lng: 31.04 },
  { id: 3, label: 'Pinetown warehouse', street: '8 Old Main Rd', suburb: 'Pinetown', city: 'Pinetown', province: 'KwaZulu-Natal', postalCode: '3610', contactName: 'Bongani Zulu', contactPhone: '072 555 0133', lat: -29.815, lng: 30.86 },
  { id: 4, label: 'Cape Town store', street: '22 Bofors Circle', suburb: 'Epping Industria', city: 'Cape Town', province: 'Western Cape', postalCode: '7460', contactName: 'Lauren Adams', contactPhone: '084 555 0177', lat: -33.93, lng: 18.53 },
  { id: 5, label: 'Polokwane store', street: '17 Landdros Mare St', suburb: 'Polokwane Central', city: 'Polokwane', province: 'Limpopo', postalCode: '0699', contactName: 'Pieter Botha', contactPhone: '076 555 0158', lat: -23.9, lng: 29.45 },
  { id: 6, label: 'Gqeberha store', street: '3 Uitenhage Rd', suburb: 'North End', city: 'Gqeberha', province: 'Eastern Cape', postalCode: '6001', contactName: 'Ayanda Jacobs', contactPhone: '079 555 0116', lat: -33.93, lng: 25.58 },
];

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
const at = (n: number, hhmm: string) => `${day(n)}T${hhmm}:00+02:00`;
const minsFromNow = (m: number) => new Date(Date.now() + m * 60000).toISOString();

const SIGNATURE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><path d="M14 58c18-40 30 10 46-14s20-30 34 4 22 16 38-12 24-8 34 10 18-6 30-14 14 2 26 6" fill="none" stroke="#1d2a35" stroke-width="2.5" stroke-linecap="round"/></svg>`);

interface Seed {
  id: number; bk: string; wb?: string; ref: string; from: number; to: number; status: ShipmentStatus;
  coll: number; by: number; cargo: CargoLine[]; progress?: number; km?: number; etaMin?: number;
  problem?: string; damaged?: boolean; note?: string; instructions?: string; fragile?: boolean;
}

const pallets = (qty: number, kg: number, d: string): CargoLine =>
  ({ type: 'pallet', qty, weightKg: kg, lengthCm: 120, widthCm: 100, heightCm: 140, description: d });
const parcels = (qty: number, kg: number, d: string): CargoLine =>
  ({ type: 'parcel', qty, weightKg: kg, lengthCm: 60, widthCm: 40, heightCm: 40, description: d });

const SEEDS: Seed[] = [
  { id: 1041, bk: 'BK-2026-000231', wb: 'WB-2026-000123', ref: 'PO-55821', from: 1, to: 2, status: 'IN_TRANSIT', coll: 0, by: 0, cargo: [pallets(4, 300, 'Boxed kettles and toasters')], progress: 0.78, km: 62, etaMin: 48, fragile: true, instructions: 'Receiving bay at the back, use the Point Rd gate.' },
  { id: 1042, bk: 'BK-2026-000231', wb: 'WB-2026-000124', ref: 'PO-55821', from: 1, to: 3, status: 'ARRIVING', coll: 0, by: 0, cargo: [pallets(2, 280, 'Bedding sets'), parcels(6, 12, 'Cushions')], progress: 0.96, km: 3, etaMin: 9 },
  { id: 1043, bk: 'BK-2026-000233', wb: 'WB-2026-000131', ref: 'PO-55840', from: 1, to: 5, status: 'COLLECTED', coll: 0, by: 1, cargo: [pallets(3, 410, 'Garden furniture, flat-packed')], progress: 0.04, km: 274, etaMin: 230 },
  { id: 1044, bk: 'BK-2026-000236', ref: 'PO-55902', from: 1, to: 4, status: 'BOOKED', coll: 2, by: 5, cargo: [pallets(6, 350, 'Kitchenware, mixed')] },
  { id: 1045, bk: 'BK-2026-000234', wb: 'WB-2026-000140', ref: 'PO-55870', from: 1, to: 6, status: 'WAYBILL_ISSUED', coll: 1, by: 3, cargo: [pallets(2, 260, 'Bathroom accessories')] },
  { id: 1046, bk: 'BK-2026-000235', ref: 'PO-55881', from: 2, to: 1, status: 'CONFIRMED', coll: 1, by: 2, cargo: [parcels(14, 9, 'Customer returns')] },
  { id: 1047, bk: 'BK-2026-000228', wb: 'WB-2026-000109', ref: 'PO-55790', from: 1, to: 2, status: 'DELIVERY_FAILED', coll: -1, by: 0, cargo: [pallets(1, 320, 'Mirrors')], fragile: true, problem: 'The delivery site was closed when the driver arrived. We will schedule a new attempt and let you know the new date.' },
  { id: 1048, bk: 'BK-2026-000226', wb: 'WB-2026-000101', ref: 'PO-55761', from: 1, to: 4, status: 'DELIVERED', coll: -4, by: -1, cargo: [pallets(5, 330, 'Lamps and shades')] },
  { id: 1049, bk: 'BK-2026-000226', wb: 'WB-2026-000102', ref: 'PO-55761', from: 1, to: 6, status: 'DELIVERED', coll: -4, by: -2, cargo: [pallets(2, 300, 'Dinner sets')], damaged: true, note: 'One carton crushed on the top layer; receiver signed with remark.' },
  { id: 1050, bk: 'BK-2026-000224', wb: 'WB-2026-000097', ref: 'PO-55744', from: 3, to: 1, status: 'DELIVERED', coll: -5, by: -3, cargo: [parcels(20, 8, 'Stock transfer')] },
  { id: 1051, bk: 'BK-2026-000222', ref: 'PO-55730', from: 1, to: 5, status: 'CANCELLED', coll: -2, by: 0, cargo: [pallets(1, 200, 'Display stands')] },
  { id: 1052, bk: 'BK-2026-000237', ref: 'PO-55915', from: 1, to: 2, status: 'BOOKED', coll: 3, by: 4, cargo: [pallets(8, 310, 'Seasonal stock')] },
];

const CHAIN: ShipmentStatus[] = ['BOOKED', 'CONFIRMED', 'WAYBILL_ISSUED', 'COLLECTED', 'IN_TRANSIT', 'ARRIVING', 'DELIVERED'];
const EVENT_TEXT: Partial<Record<ShipmentStatus, string>> = {
  BOOKED: 'Booking received', CONFIRMED: 'Booking confirmed', WAYBILL_ISSUED: 'Scheduled for collection, waybill issued',
  COLLECTED: 'Collected by driver', IN_TRANSIT: 'On the road', ARRIVING: 'Truck is close to the delivery address',
  DELIVERED: 'Delivered and signed for', DELIVERY_FAILED: 'Delivery attempt failed', CANCELLED: 'Shipment cancelled',
};

function eventsFor(s: Seed): ShipmentEventView[] {
  const ev = (status: ShipmentStatus, when: string): ShipmentEventView => ({ status, at: when, text: EVENT_TEXT[status] ?? status });
  const out: ShipmentEventView[] = [];
  const target = s.status === 'DELIVERY_FAILED' ? 'IN_TRANSIT' : s.status === 'CANCELLED' ? 'CONFIRMED' : s.status;
  const end = CHAIN.indexOf(target);
  const times = [at(s.coll - 2, '10:12'), at(s.coll - 2, '13:40'), at(s.coll - 1, '15:05'), at(s.coll, '08:40'), at(s.coll, '09:15'), at(s.by, '13:50'), at(s.by, '14:31')];
  for (let i = 0; i <= end; i++) out.push(ev(CHAIN[i], times[i]));
  if (s.status === 'DELIVERY_FAILED') out.push(ev('DELIVERY_FAILED', at(s.by, '11:20')));
  if (s.status === 'CANCELLED') out.push(ev('CANCELLED', at(s.coll - 1, '09:02')));
  return out.reverse();
}

@Injectable()
export class MockPortalApi extends PortalApi {
  private book = [...BOOK];
  private seeds = [...SEEDS];
  private nextBk = 238;
  private nextShipment = 1060;
  private extra = new Map<number, { pickup: Address; delivery: Address; windowFrom: string; windowTo: string; hazardous: boolean; hazardClass?: string; tempRange?: string }>();
  private prefs: NotificationPrefs = {
    rules: [
      { event: 'BOOKED', email: true, sms: false, smsAvailable: false },
      { event: 'CONFIRMED', email: true, sms: false, smsAvailable: false },
      { event: 'REJECTED', email: true, sms: false, smsAvailable: false },
      { event: 'COLLECTED', email: true, sms: false, smsAvailable: true },
      { event: 'ARRIVING', email: false, sms: true, smsAvailable: true },
      { event: 'DELIVERED', email: true, sms: false, smsAvailable: true },
      { event: 'PROBLEM', email: true, sms: true, smsAvailable: true },
      { event: 'CANCELLED', email: true, sms: false, smsAvailable: false },
    ],
    extraEmails: ['dispatch@mzansihome.co.za'],
    smsNumber: '082 555 0107',
    smsOptIn: true,
  };

  private wait<T>(v: T): Observable<T> { return of(structuredClone(v)).pipe(delay(220)); }

  login(email: string, password: string): Observable<LoginResponse> {
    if (!email || !password) return throwError(() => ({ status: 401 }));
    const isDemoUser = email.trim().toLowerCase() === DEMO_USER.email;
    if (isDemoUser && password !== DEMO_PASSWORD) return throwError(() => ({ status: 401 }));
    return this.wait({ token: 'demo-token', expiresAt: minsFromNow(30), user: isDemoUser ? DEMO_USER : { ...USER, email } });
  }
  forgotPassword(): Observable<void> { return this.wait(undefined as void); }
  me(): Observable<ClientUser> { return this.wait(USER); }

  counts(): Observable<ShipmentCounts> {
    const n = (f: keyof typeof FILTER_STATUSES) => this.seeds.filter(s => FILTER_STATUSES[f]!.includes(s.status)).length;
    return this.wait({ active: n('active'), awaiting: n('awaiting'), scheduled: n('scheduled'), onTheRoad: n('onTheRoad'), attention: n('attention'), delivered: n('delivered') });
  }

  shipments(q: ShipmentQuery): Observable<Page<ShipmentSummary>> {
    const allowed = FILTER_STATUSES[q.filter];
    const term = (q.search ?? '').trim().toLowerCase();
    let rows = this.seeds
      .filter(s => !allowed || allowed.includes(s.status))
      .map(s => this.summary(s))
      .filter(s => !term || [s.waybillNo, s.bookingNo, s.clientReference, s.from.city, s.to.city, s.from.suburb, s.to.suburb]
        .some(v => v?.toLowerCase().includes(term)))
      .filter(s => (!q.from || s.collectionDate >= q.from) && (!q.to || s.collectionDate <= q.to));
    rows = rows.sort((a, b) => b.collectionDate.localeCompare(a.collectionDate) || b.id - a.id);
    const start = (q.page - 1) * q.pageSize;
    return this.wait({ items: rows.slice(start, start + q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize });
  }

  shipment(id: number): Observable<ShipmentDetail> {
    const s = this.seeds.find(x => x.id === id);
    return s ? this.wait(this.detail(s)) : throwError(() => ({ status: 404 }));
  }

  cancelShipment(id: number): Observable<ShipmentDetail> {
    const s = this.seeds.find(x => x.id === id);
    if (!s || !['BOOKED', 'CONFIRMED'].includes(s.status)) return throwError(() => ({ status: 409 }));
    s.status = 'CANCELLED';
    return this.wait(this.detail(s));
  }

  validateBooking(req: BookingRequest): Observable<ValidationResult> {
    const problems = checkBooking(req);
    return this.wait({ ok: problems.length === 0, problems });
  }

  createBooking(req: BookingRequest): Observable<BookingResult> {
    const problems = checkBooking(req);
    if (problems.length) return throwError(() => ({ status: 422, error: { problems } }));
    const bk = `BK-2026-${String(this.nextBk++).padStart(6, '0')}`;
    const ids: number[] = [];
    for (const d of req.shipments) {
      const pickup = this.resolve(d.pickup);
      const delivery = this.resolve(d.delivery);
      const id = this.nextShipment++;
      ids.push(id);
      this.seeds.unshift({
        id, bk, ref: req.clientReference ?? '', from: pickup.id!, to: delivery.id!, status: 'BOOKED',
        coll: daysFromToday(d.collectionDate), by: daysFromToday(d.deliverBy), cargo: d.cargo,
        fragile: d.fragile, instructions: d.instructions,
      });
      this.extra.set(id, { pickup, delivery, windowFrom: d.windowFrom, windowTo: d.windowTo, hazardous: d.hazardous, hazardClass: d.hazardClass, tempRange: d.tempRange });
    }
    return this.wait({ bookingNo: bk, shipmentIds: ids });
  }

  addresses(): Observable<Address[]> { return this.wait(this.book); }
  saveAddress(a: Address): Observable<Address> {
    if (a.id) { this.book = this.book.map(x => (x.id === a.id ? a : x)); return this.wait(a); }
    const saved = { ...a, id: Math.max(0, ...this.book.map(x => x.id!)) + 1 };
    this.book = [...this.book, saved];
    return this.wait(saved);
  }
  deleteAddress(id: number): Observable<void> {
    this.book = this.book.filter(x => x.id !== id);
    return this.wait(undefined as void);
  }

  notificationPrefs(): Observable<NotificationPrefs> { return this.wait(this.prefs); }
  saveNotificationPrefs(p: NotificationPrefs): Observable<NotificationPrefs> { this.prefs = structuredClone(p); return this.wait(p); }

  /** The demo has no PDFs; an empty URL tells the page to say so. */
  documentUrl(_id: number, _kind: DocumentKind): Observable<string> { return this.wait(''); }

  private resolve(input: { addressId?: number; address?: Address; saveToBook?: boolean }): Address {
    if (input.addressId) return this.book.find(a => a.id === input.addressId)!;
    const a = { ...input.address!, id: 100 + this.nextShipment };
    if (input.saveToBook) this.book = [...this.book, { ...a, id: Math.max(...this.book.map(x => x.id!)) + 1 }];
    return a;
  }

  private addr(id: number, shipmentId: number, which: 'pickup' | 'delivery'): Address {
    return this.extra.get(shipmentId)?.[which] ?? this.book.find(a => a.id === id) ?? BOOK.find(a => a.id === id)!;
  }

  private summary(s: Seed): ShipmentSummary {
    const from = this.addr(s.from, s.id, 'pickup');
    const to = this.addr(s.to, s.id, 'delivery');
    return {
      id: s.id, bookingNo: s.bk, waybillNo: s.wb, clientReference: s.ref, status: s.status,
      from: { suburb: from.suburb, city: from.city }, to: { suburb: to.suburb, city: to.city },
      collectionDate: day(s.coll), deliverBy: day(s.by),
      pieces: s.cargo.reduce((n, c) => n + c.qty, 0),
      totalKg: s.cargo.reduce((n, c) => n + c.qty * c.weightKg, 0),
      eta: s.etaMin !== undefined ? minsFromNow(s.etaMin) : undefined,
      deliveredAt: s.status === 'DELIVERED' ? at(s.by, '14:31') : undefined,
    };
  }

  private detail(s: Seed): ShipmentDetail {
    const x = this.extra.get(s.id);
    const moving = ['COLLECTED', 'IN_TRANSIT', 'ARRIVING'].includes(s.status);
    const sum = this.summary(s);
    return {
      ...sum,
      pickup: this.addr(s.from, s.id, 'pickup'),
      delivery: this.addr(s.to, s.id, 'delivery'),
      windowFrom: x?.windowFrom ?? '08:00', windowTo: x?.windowTo ?? '12:00',
      cargo: s.cargo.map((c, i) => ({ ...c, itemBarcode: s.wb ? `${s.wb}-${String(i + 1).padStart(2, '0')}` : undefined })),
      fragile: !!s.fragile, hazardous: x?.hazardous ?? false, hazardClass: x?.hazardClass, tempRange: x?.tempRange,
      instructions: s.instructions,
      events: s.id >= 1060 ? [{ status: 'BOOKED', at: new Date().toISOString(), text: 'Booking received' }] : eventsFor(s),
      tracking: moving ? { lat: -29.6, lng: 30.4, updatedAt: minsFromNow(-2), eta: sum.eta, kmRemaining: s.km, progress: s.progress ?? 0 } : undefined,
      pod: s.status === 'DELIVERED' ? {
        receiverName: this.addr(s.to, s.id, 'delivery').contactName, deliveredAt: sum.deliveredAt!,
        signatureUrl: SIGNATURE, photoUrls: [], damaged: !!s.damaged, short: false, note: s.note,
      } : undefined,
      problem: s.problem,
      trackingUrl: s.wb ? `https://track.example.co.za/t/${s.wb.slice(-6)}k3v9QpLx` : undefined,
      canCancel: ['BOOKED', 'CONFIRMED'].includes(s.status),
    };
  }

  /* ---------- Support chat (demo: canned replies from "Lerato") ---------- */
  private chat: SupportMessage[] = [];
  private chatQueue: SupportMessage[] = [];
  private chatN = 0;

  supportThread(): Observable<SupportThread> {
    if (!this.chat.length) {
      this.chat.push({ id: 'm' + (++this.chatN), from: 'agent', authorName: 'Lerato', at: new Date().toISOString(),
        text: `Hi ${USER.name.split(' ')[0]}, you’re through to the Rocket Freight support desk. Ask us anything about a booking, a shipment or your documents.` });
    }
    return this.wait({ id: 'demo-thread', messages: this.chat, hours: 'Mon–Fri 07:00–18:00, Sat 08:00–13:00', online: true });
  }

  sendSupportMessage(m: SendSupportMessage): Observable<SupportMessage> {
    const seed = m.shipmentId ? this.seeds.find(x => x.id === m.shipmentId) : undefined;
    const ref = seed ? (seed.wb ?? seed.bk) : undefined;
    const msg: SupportMessage = { id: 'm' + (++this.chatN), from: 'client', authorName: USER.name, text: m.text, at: new Date().toISOString(), shipmentRef: ref };
    this.chat.push(msg);
    const reply: SupportMessage = { id: 'm' + (++this.chatN), from: 'agent', authorName: 'Lerato', text: this.cannedReply(m.text, seed), at: new Date(Date.now() + 2600).toISOString() };
    this.chatQueue.push(reply);
    return this.wait(msg);
  }

  supportMessagesAfter(afterId: string | null): Observable<SupportMessage[]> {
    const now = Date.now();
    const due = this.chatQueue.filter(r => Date.parse(r.at) <= now);
    this.chatQueue = this.chatQueue.filter(r => Date.parse(r.at) > now);
    this.chat.push(...due);
    const i = afterId ? this.chat.findIndex(x => x.id === afterId) : -1;
    return this.wait(this.chat.slice(i + 1));
  }

  private cannedReply(text: string, seed?: Seed): string {
    const t = text.toLowerCase();
    const ref = seed ? (seed.wb ?? seed.bk) : '';
    if (seed && /(where|eta|track|late|arriv|when)/.test(t))
      return `I’ve checked ${ref}: it’s ${STATUS_LABEL[seed.status].toLowerCase()}${seed.etaMin ? `, expected in about ${seed.etaMin} minutes` : ''}. The shipment page shows the latest time and position, and I’ll message you here if anything changes.`;
    if (/(where|eta|track|late|arriv)/.test(t))
      return 'Happy to check. Which waybill or booking number is it? You can also open the shipment and chat from there so I can see it straight away.';
    if (/(cancel|change|amend|edit|date)/.test(t))
      return 'You can cancel in the portal while it’s waiting for confirmation or confirmed. To change a date, address or the goods, tell me what should change and I’ll update the booking for you.';
    if (/(label|qr|barcode|print|waybill|scan)/.test(t))
      return 'Labels and the waybill are on the shipment page once it’s scheduled for collection. Reprints keep the same numbers, so they scan exactly like the originals.';
    if (/(pod|proof|sign|damage|short)/.test(t))
      return 'The signed proof of delivery is on the shipment page under Proof of delivery. If something arrived damaged or short, send me the waybill number and a photo and I’ll open a claim.';
    return 'Thanks, I’m on it. I’ll reply here shortly; you can carry on using the portal and I’ll let you know when there’s an answer.';
  }
}

function daysFromToday(iso: string): number {
  const ms = new Date(iso + 'T12:00:00').getTime() - new Date(isoDate(new Date()) + 'T12:00:00').getTime();
  return Math.round(ms / 86400000);
}
