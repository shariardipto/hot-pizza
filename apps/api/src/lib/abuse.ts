import { HttpError } from './http.ts';

/**
 * Fraud guards for guest checkout and bookings — mostly relevant for cash on delivery, where a fake order costs a
 * delivery run. Combined with the bot check, per-IP rate limits and staff confirmation of COD orders.
 */

/** Matches a customer against Settings → Orders → blocked customers (phone numbers in any format, or e-mails). */
export function isBlockedCustomer(list: readonly string[], who: { phone?: string | null; email?: string | null }): boolean {
  if (!list.length) return false;
  const email = who.email?.trim().toLowerCase() || null;
  const phone = who.phone?.replace(/\D/g, '') || null;
  return list.some((raw) => {
    const entry = raw.trim().toLowerCase();
    if (entry.includes('@')) return email === entry;
    // "+880 1712-345678", "8801712345678" and the national "01712345678" all match +8801712345678.
    const national = entry.replace(/\D/g, '').replace(/^0+/, '');
    return Boolean(phone && national.length >= 7 && phone.endsWith(national));
  });
}

export const customerBlocked = () =>
  new HttpError(403, 'customer_blocked', 'We cannot accept this request online. Please contact us directly.');

export const codLimitReached = () =>
  new HttpError(429, 'cod_limit', 'You already have open cash-on-delivery orders. Please wait until they are delivered, pay online, or contact us.');

export const reservationLimitReached = () =>
  new HttpError(429, 'reservation_limit', 'You already have several upcoming reservations. Please contact us to book more.');

/** Order statuses that still need a delivery (count towards the open COD limit). */
export const OPEN_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'shipped'] as const;
