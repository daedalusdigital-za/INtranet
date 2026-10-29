/**
 * Client-side booking rules, ported from the Rocket Freight portal (core/booking-rules.ts) so
 * ops sees the same problems the client sees before submitting. The server remains the
 * authority: POST /logistics/bookings/validate runs the same checks.
 */
export interface BookingProblem { path: string; message: string; }

export interface RuleAddress { addressId?: number | null; line1?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null; }
export interface RuleItem { qty: number; weightKg: number | null; description: string; }
export interface RuleShipment {
  pickup: RuleAddress; delivery: RuleAddress; collectionDate: string; requestedDeliveryDate: string;
  collectionWindowFrom: string; collectionWindowTo: string; items: RuleItem[]; hazardous: boolean; hazardClass: string;
}
export interface RuleBooking {
  customerId: number | null; clientReference: string; requestedByName: string; requestedByEmail: string; shipments: RuleShipment[];
}

export function isoDate(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function checkBooking(req: RuleBooking, today = isoDate(new Date())): BookingProblem[] {
  const p: BookingProblem[] = [];
  const add = (path: string, message: string) => p.push({ path, message });

  if (!req.customerId) add('customerId', 'Choose the client this booking is for.');
  if ((req.clientReference ?? '').length > 50) add('clientReference', 'Keep the client reference to 50 characters or fewer.');
  if (!req.requestedByName.trim()) add('requestedBy.name', 'Enter the name of the person booking.');
  if (req.requestedByEmail && !/^\S+@\S+\.\S+$/.test(req.requestedByEmail)) add('requestedBy.email', 'Enter a valid email address for confirmations.');
  if (!req.shipments.length) add('shipments', 'Add at least one shipment.');
  if (req.shipments.length > 500) add('shipments', 'A booking can hold up to 500 shipments.');

  req.shipments.forEach((s, i) => {
    const at = `shipments[${i}]`;
    const n = `Shipment ${i + 1}`;
    if (!hasAddress(s.pickup)) add(`${at}.pickup`, `${n}: choose or enter a collection address.`);
    if (!hasAddress(s.delivery)) add(`${at}.delivery`, `${n}: choose or enter a delivery address.`);
    if (sameAddress(s.pickup, s.delivery)) add(`${at}.delivery`, `${n}: the delivery address must differ from the collection address.`);
    if (!s.collectionDate) add(`${at}.collectionDate`, `${n}: choose a collection date.`);
    else if (s.collectionDate < today) add(`${at}.collectionDate`, `${n}: the collection date can’t be in the past.`);
    if (!s.requestedDeliveryDate) add(`${at}.deliverBy`, `${n}: choose a delivery date.`);
    else if (s.collectionDate && s.requestedDeliveryDate < s.collectionDate) add(`${at}.deliverBy`, `${n}: delivery must be on or after the collection date.`);
    if (s.collectionWindowFrom && s.collectionWindowTo && s.collectionWindowFrom >= s.collectionWindowTo) add(`${at}.windowTo`, `${n}: the collection window must end after it starts.`);
    if (!s.items.length) add(`${at}.cargo`, `${n}: add at least one cargo line.`);
    s.items.forEach((c, j) => {
      const cl = `${at}.cargo[${j}]`;
      const ln = `${n}, line ${j + 1}`;
      if (!(c.qty > 0)) add(`${cl}.qty`, `${ln}: quantity must be more than 0.`);
      if (!((c.weightKg ?? 0) > 0)) add(`${cl}.weightKg`, `${ln}: weight must be more than 0 kg.`);
      if (!c.description?.trim()) add(`${cl}.description`, `${ln}: describe the goods.`);
    });
    if (s.hazardous && !s.hazardClass?.trim()) add(`${at}.hazardClass`, `${n}: enter the hazard class for hazardous goods.`);
  });
  return p;
}

function hasAddress(a: RuleAddress): boolean { return !!a.addressId || !!(a.line1 ?? '').trim(); }

function sameAddress(a: RuleAddress, b: RuleAddress): boolean {
  if (a.addressId && b.addressId) return a.addressId === b.addressId;
  const l1 = (a.line1 ?? '').trim().toLowerCase(), l2 = (b.line1 ?? '').trim().toLowerCase();
  return !!l1 && l1 === l2 && (a.postalCode ?? '').trim() === (b.postalCode ?? '').trim();
}
