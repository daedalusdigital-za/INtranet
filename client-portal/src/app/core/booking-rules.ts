import { BookingRequest, ValidationProblem } from './models';

/**
 * Mirrors the server's booking rules so clients see problems before submitting.
 * The server stays the authority: POST /bookings/validate runs the same checks.
 */
export function checkBooking(req: BookingRequest, today = isoDate(new Date())): ValidationProblem[] {
  const p: ValidationProblem[] = [];
  const add = (path: string, message: string) => p.push({ path, message });

  if ((req.clientReference ?? '').length > 50) add('clientReference', 'Keep your reference to 50 characters or fewer.');
  if (!req.requestedBy.name.trim()) add('requestedBy.name', 'Enter the name of the person booking.');
  if (!/^\S+@\S+\.\S+$/.test(req.requestedBy.email)) add('requestedBy.email', 'Enter a valid email address for confirmations.');
  if (!req.shipments.length) add('shipments', 'Add at least one shipment.');
  if (req.shipments.length > 500) add('shipments', 'A booking can hold up to 500 shipments.');

  req.shipments.forEach((s, i) => {
    const at = `shipments[${i}]`;
    const n = `Shipment ${i + 1}`;
    if (!s.pickup.addressId && !s.pickup.address) add(`${at}.pickup`, `${n}: choose or enter a collection address.`);
    if (!s.delivery.addressId && !s.delivery.address) add(`${at}.delivery`, `${n}: choose or enter a delivery address.`);
    if (sameAddress(s.pickup, s.delivery)) add(`${at}.delivery`, `${n}: the delivery address must differ from the collection address.`);
    if (!s.collectionDate) add(`${at}.collectionDate`, `${n}: choose a collection date.`);
    else if (s.collectionDate < today) add(`${at}.collectionDate`, `${n}: the collection date can’t be in the past.`);
    if (!s.deliverBy) add(`${at}.deliverBy`, `${n}: choose a delivery date.`);
    else if (s.collectionDate && s.deliverBy < s.collectionDate) add(`${at}.deliverBy`, `${n}: delivery must be on or after the collection date.`);
    if (s.windowFrom && s.windowTo && s.windowFrom >= s.windowTo) add(`${at}.windowTo`, `${n}: the collection window must end after it starts.`);
    if (!s.cargo.length) add(`${at}.cargo`, `${n}: add at least one cargo line.`);
    s.cargo.forEach((c, j) => {
      const cl = `${at}.cargo[${j}]`;
      const ln = `${n}, line ${j + 1}`;
      if (!(c.qty > 0)) add(`${cl}.qty`, `${ln}: quantity must be more than 0.`);
      if (!(c.weightKg > 0)) add(`${cl}.weightKg`, `${ln}: weight must be more than 0 kg.`);
      if (!c.description?.trim()) add(`${cl}.description`, `${ln}: describe the goods.`);
    });
    if (s.hazardous && !s.hazardClass?.trim()) add(`${at}.hazardClass`, `${n}: enter the hazard class for hazardous goods.`);
  });
  return p;
}

function sameAddress(a: { addressId?: number; address?: { street: string; postalCode: string } },
                     b: { addressId?: number; address?: { street: string; postalCode: string } }): boolean {
  if (a.addressId && b.addressId) return a.addressId === b.addressId;
  if (a.address && b.address) {
    return a.address.street.trim().toLowerCase() === b.address.street.trim().toLowerCase()
      && a.address.postalCode.trim() === b.address.postalCode.trim()
      && !!a.address.street.trim();
  }
  return false;
}

export function isoDate(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
