import { prisma, type Prisma } from '../../db.ts';
import { badRequest } from '../../lib/http.ts';
import { getSetting } from '../settings/service.ts';

/**
 * Privacy / GDPR tooling.
 * - Retention (runs in the background): removes customer details from finished orders and past bookings after
 *   Settings → Security → "Keep customer details for", and deletes IP addresses after "Keep IP addresses for".
 * - Customer requests (Settings → Security → Customer data): export everything stored about a phone number or
 *   e-mail (right of access) and remove it (right to erasure).
 * Order totals, items and dates are kept: they are accounting records, and without the personal fields they no
 * longer identify anyone.
 */

export const REMOVED = 'Removed (privacy)';
const FINISHED_ORDER = ['delivered', 'completed', 'cancelled', 'refunded'] as const;
const OPEN_BOOKING = ['pending', 'confirmed'] as const;

const orderErasure = (now: Date): Prisma.OrderUpdateManyMutationInput => ({
  customerName: REMOVED,
  customerPhone: '',
  customerEmail: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  notes: null,
  internalNote: null,
  ipAddress: null,
  userAgent: null,
  anonymizedAt: now,
});

const reservationErasure = (now: Date): Prisma.ReservationUpdateManyMutationInput => ({
  name: REMOVED,
  phone: '',
  email: null,
  notes: null,
  internalNote: null,
  ipAddress: null,
  anonymizedAt: now,
});

async function eraseOrders(ids: string[], now: Date) {
  if (!ids.length) return 0;
  const [res] = await prisma.$transaction([
    prisma.order.updateMany({ where: { id: { in: ids } }, data: orderErasure(now) }),
    // Staff notes on the timeline can mention the customer.
    prisma.orderEvent.updateMany({ where: { orderId: { in: ids }, type: 'note' }, data: { message: REMOVED } }),
  ]);
  return res.count;
}

async function eraseReservations(ids: string[], now: Date) {
  if (!ids.length) return 0;
  return (await prisma.reservation.updateMany({ where: { id: { in: ids } }, data: reservationErasure(now) })).count;
}

/** Background job. Safe to run on several API instances (advisory lock). */
export async function applyRetention(now = new Date()) {
  const rows = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(42002) AS locked`;
  if (!rows[0]?.locked) return null;
  try {
    const { customerDataRetentionMonths: months, ipRetentionDays: days } = await getSetting('security');
    const result = { orders: 0, reservations: 0, ipAddresses: 0, sessions: 0 };
    if (months > 0) {
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - months);
      const orders = await prisma.order.findMany({ where: { anonymizedAt: null, status: { in: [...FINISHED_ORDER] }, createdAt: { lt: cutoff } }, select: { id: true } });
      result.orders = await eraseOrders(orders.map((o) => o.id), now);
      const bookings = await prisma.reservation.findMany({ where: { anonymizedAt: null, startsAt: { lt: cutoff } }, select: { id: true } });
      result.reservations = await eraseReservations(bookings.map((r) => r.id), now);
    }
    const ipCutoff = new Date(now.getTime() - days * 86_400_000);
    const [o, r, a] = await prisma.$transaction([
      prisma.order.updateMany({ where: { createdAt: { lt: ipCutoff }, OR: [{ ipAddress: { not: null } }, { userAgent: { not: null } }] }, data: { ipAddress: null, userAgent: null } }),
      prisma.reservation.updateMany({ where: { createdAt: { lt: ipCutoff }, ipAddress: { not: null } }, data: { ipAddress: null } }),
      prisma.auditLog.updateMany({ where: { createdAt: { lt: ipCutoff }, ipAddress: { not: null } }, data: { ipAddress: null } }),
    ]);
    result.ipAddresses = o.count + r.count + a.count;
    // Expired dashboard sign-ins (they also hold an IP address and browser).
    result.sessions = (await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } })).count;
    return result;
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(42002)`;
  }
}

/* ─────────────── Customer requests ─────────────── */

/** "fraud@example.com" → e-mail; "+880 1712-345678" / "01712345678" → phone (matched on the national digits). */
function parseQuery(q: string) {
  const value = q.trim();
  if (value.includes('@')) return { email: value.toLowerCase() };
  const national = value.replace(/\D/g, '').replace(/^0+/, '');
  if (national.length < 7) throw badRequest('Enter a full phone number or an e-mail address', 'invalid_query');
  return { national };
}

async function matchIds(q: string) {
  const who = parseQuery(q);
  if (who.email) {
    const [orders, reservations] = await Promise.all([
      prisma.order.findMany({ where: { customerEmail: { equals: who.email, mode: 'insensitive' } }, select: { id: true } }),
      prisma.reservation.findMany({ where: { email: { equals: who.email, mode: 'insensitive' } }, select: { id: true } }),
    ]);
    return { orderIds: orders.map((x) => x.id), reservationIds: reservations.map((x) => x.id) };
  }
  const like = `%${who.national}`;
  const [orders, reservations] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "order" WHERE regexp_replace("customerPhone", '\D', '', 'g') LIKE ${like}`,
    prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "reservation" WHERE regexp_replace("phone", '\D', '', 'g') LIKE ${like}`,
  ]);
  return { orderIds: orders.map((x) => x.id), reservationIds: reservations.map((x) => x.id) };
}

/** Everything stored about a customer (for the overview and the JSON download). */
export async function findCustomerData(q: string) {
  const { orderIds, reservationIds } = await matchIds(q);
  const [orders, reservations] = await Promise.all([
    prisma.order.findMany({
      where: { id: { in: orderIds } },
      orderBy: { createdAt: 'desc' },
      include: { items: { select: { name: true, sku: true, quantity: true, unitPrice: true, lineTotal: true } }, events: { select: { type: true, toValue: true, message: true, createdAt: true }, orderBy: { createdAt: 'asc' } } },
    }),
    prisma.reservation.findMany({ where: { id: { in: reservationIds } }, orderBy: { startsAt: 'desc' }, include: { location: { select: { name: true } } } }),
  ]);
  return { query: q, generatedAt: new Date().toISOString(), orders, reservations };
}

/** Removes the customer's personal data. Refuses while orders or bookings are still open (they are needed to deliver). */
export async function eraseCustomerData(q: string) {
  const { orderIds, reservationIds } = await matchIds(q);
  const now = new Date();
  const [openOrders, upcoming] = await Promise.all([
    prisma.order.findMany({ where: { id: { in: orderIds }, status: { notIn: [...FINISHED_ORDER] } }, select: { number: true } }),
    prisma.reservation.findMany({ where: { id: { in: reservationIds }, status: { in: [...OPEN_BOOKING] }, startsAt: { gte: now } }, select: { code: true } }),
  ]);
  if (openOrders.length || upcoming.length) {
    const list = [...openOrders.map((o) => o.number), ...upcoming.map((r) => r.code)].join(', ');
    throw badRequest(`Finish or cancel these first: ${list}`, 'still_open');
  }
  return { orders: await eraseOrders(orderIds, now), reservations: await eraseReservations(reservationIds, now) };
}
