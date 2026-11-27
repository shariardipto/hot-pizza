import type { AvailabilityResponse, CreateReservationResponse, PublicReservation } from '@app/shared/api';
import { canTransition, RESERVATION_TRANSITIONS, type ReservationStatus } from '@app/shared/commerce';
import { normalizePhone, type OpeningHours, type ReservationInput, type TimeSlot } from '@app/shared/schemas';
import { env } from '../../env.ts';
import { prisma, type Location, type Prisma, type Tx } from '../../db.ts';
import { badRequest, conflict, HttpError, notFound } from '../../lib/http.ts';
import { secretToken, shortCode } from '../../lib/ids.ts';
import { logger } from '../../lib/logger.ts';
import { eventActor } from '../../lib/actor.ts';
import { customerBlocked, isBlockedCustomer, reservationLimitReached } from '../../lib/abuse.ts';
import { addDays, fromMinutes, todayIn, toMinutes, weekday, zonedToUtc } from '../../lib/time.ts';
import { sendMail } from '../notifications/mailer.ts';
import { newReservationAdminEmail, reservationEmail, type ReservationMailData } from '../notifications/templates.ts';
import { getCommerceSettings, getDefaultLocale, getPublicSettings, getSetting } from '../settings/service.ts';

const ACTIVE: ReservationStatus[] = ['pending', 'confirmed', 'seated'];

/** Candidate start times for a date, ignoring capacity. */
function slotTimes(location: Location, date: string): string[] {
  const hours = (location.openingHours ?? {}) as OpeningHours;
  const windows = hours[String(weekday(date)) as keyof OpeningHours] ?? [];
  const out: string[] = [];
  for (const w of windows) {
    const open = toMinutes(w.open);
    let close = toMinutes(w.close);
    if (close <= open) close += 24 * 60; // service past midnight
    const last = close - Math.min(location.reservationDuration, close - open);
    for (let t = open; t <= last; t += location.slotInterval) out.push(fromMinutes(t));
  }
  return [...new Set(out)];
}

function dateWindowError(location: Location, date: string): string | null {
  const today = todayIn(location.timezone);
  if (date < today) return 'past';
  if (date > addDays(today, location.maxAdvanceDays)) return 'too_far';
  if (location.closedDates.includes(date)) return 'closed';
  return null;
}

async function computeSlots(db: Tx | typeof prisma, location: Location, date: string, partySize: number, ignoreId?: string): Promise<TimeSlot[]> {
  const times = slotTimes(location, date);
  if (!times.length) return [];
  const dayStart = zonedToUtc(date, '00:00', location.timezone);
  const dayEnd = new Date(zonedToUtc(addDays(date, 1), '00:00', location.timezone).getTime() + 24 * 3600_000);
  const existing = await db.reservation.findMany({
    where: { locationId: location.id, status: { in: ACTIVE }, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart }, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    select: { startsAt: true, endsAt: true, partySize: true },
  });
  const earliest = Date.now() + location.leadTimeMinutes * 60_000;
  return times.map((time) => {
    const start = zonedToUtc(date, time, location.timezone).getTime();
    const end = start + location.reservationDuration * 60_000;
    const used = existing.filter((r) => r.startsAt.getTime() < end && r.endsAt.getTime() > start).reduce((s, r) => s + r.partySize, 0);
    const remaining = Math.max(0, location.maxCovers - used);
    return { time, remaining, available: start >= earliest && remaining >= partySize };
  });
}

export async function getAvailability(locationId: string, date: string, partySize: number): Promise<AvailabilityResponse> {
  const location = await prisma.location.findFirst({ where: { id: locationId, isActive: true, acceptsReservations: true } });
  if (!location) throw notFound('Location');
  const err = dateWindowError(location, date);
  if (err || partySize < location.minPartySize || partySize > location.maxPartySize) {
    return { date, timezone: location.timezone, closed: true, slots: [] };
  }
  const slots = await computeSlots(prisma, location, date, partySize);
  return { date, timezone: location.timezone, closed: slots.length === 0, slots };
}

type ReservationWithLocation = Prisma.ReservationGetPayload<{ include: { location: true } }>;

function toPublic(r: ReservationWithLocation): PublicReservation {
  return {
    code: r.code,
    status: r.status as ReservationStatus,
    date: r.date,
    time: r.time,
    partySize: r.partySize,
    name: r.name,
    location: { name: r.location.name, addressLine1: r.location.addressLine1, city: r.location.city, phone: r.location.phone },
    canCancel: (r.status === 'pending' || r.status === 'confirmed') && r.startsAt.getTime() > Date.now(),
  };
}

async function managePath(locale: string, code: string, token: string) {
  const def = await getDefaultLocale();
  const path = `/reservations/${code}?token=${token}`;
  return locale === def ? path : `/${locale}${path}`;
}

export async function createReservation(
  input: ReservationInput,
  meta: {
    idempotencyKey?: string;
    ip?: string;
    source?: 'web' | 'admin' | 'phone';
    actor?: { actorId: string | null; actorName: string | null };
    skipChecks?: boolean;
    /** Bot check for public bookings — runs after the idempotency lookup. */
    verifyHuman?: () => Promise<void>;
  },
): Promise<CreateReservationResponse> {
  if (meta.source !== 'admin' && meta.source !== 'phone') {
    const features = await getSetting('features');
    if (!features.reservations) throw new HttpError(403, 'reservations_disabled', 'Online reservations are currently closed');
  }
  if (meta.idempotencyKey) {
    const existing = await prisma.reservation.findUnique({ where: { idempotencyKey: meta.idempotencyKey }, include: { location: true } });
    if (existing) return { reservation: toPublic(existing), token: existing.token, managePath: await managePath(existing.locale, existing.code, existing.token) };
  }
  await meta.verifyHuman?.();
  const location = await prisma.location.findFirst({ where: { id: input.locationId, isActive: true, ...(meta.skipChecks ? {} : { acceptsReservations: true }) } });
  if (!location) throw badRequest('Choose a valid location', 'invalid_location');
  if (!meta.skipChecks) {
    const windowErr = dateWindowError(location, input.date);
    if (windowErr) throw badRequest('This date cannot be booked', `date_${windowErr}`);
    if (input.partySize < location.minPartySize || input.partySize > location.maxPartySize) {
      throw badRequest(`Online bookings are for ${location.minPartySize}–${location.maxPartySize} guests`, 'party_size');
    }
  }
  const phone = normalizePhone(input.phone, input.phoneCountry);
  if (!phone) throw new HttpError(422, 'validation_error', 'Invalid phone number', [{ path: ['phone'], message: 'phone' }]);

  const { reservationPrefix, blockedCustomers, maxUpcomingReservationsPerPhone } = await getCommerceSettings();
  const isGuest = meta.source !== 'admin' && meta.source !== 'phone';
  if (isGuest && isBlockedCustomer(blockedCustomers, { phone, email: input.email })) {
    logger.info({ phone, ip: meta.ip }, 'Reservation refused: blocked customer');
    throw customerBlocked();
  }
  if (isGuest && maxUpcomingReservationsPerPhone > 0) {
    const upcoming = await prisma.reservation.count({
      where: { phone, status: { in: ['pending', 'confirmed'] }, startsAt: { gte: new Date() } },
    });
    if (upcoming >= maxUpcomingReservationsPerPhone) throw reservationLimitReached();
  }
  const startsAt = zonedToUtc(input.date, input.time, location.timezone);
  const endsAt = new Date(startsAt.getTime() + location.reservationDuration * 60_000);

  const created = await prisma.$transaction(async (tx) => {
    // Serialize bookings per location/day so two guests can't take the last seats at once.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${location.id}:${input.date}`}))`;
    if (!meta.skipChecks) {
      const slots = await computeSlots(tx, location, input.date, input.partySize);
      const slot = slots.find((s) => s.time === input.time);
      if (!slot) throw badRequest('This time is not bookable', 'invalid_time');
      if (!slot.available) throw conflict('This time has just been fully booked — please pick another', 'slot_full');
    }
    let code = '';
    for (let i = 0; i < 5; i++) {
      code = reservationPrefix ? `${reservationPrefix}-${shortCode()}` : shortCode();
      if (!(await tx.reservation.findUnique({ where: { code } }))) break;
    }
    const status: ReservationStatus = location.autoConfirm || meta.source === 'admin' || meta.source === 'phone' ? 'confirmed' : 'pending';
    return tx.reservation.create({
      data: {
        code,
        token: secretToken(),
        locationId: location.id,
        status,
        date: input.date,
        time: input.time,
        startsAt,
        endsAt,
        partySize: input.partySize,
        name: input.name,
        phone,
        email: input.email ?? null,
        notes: input.notes || null,
        locale: input.locale,
        source: meta.source ?? 'web',
        idempotencyKey: meta.idempotencyKey ?? null,
        ipAddress: meta.ip ?? null,
        events: { create: { type: 'created', toValue: status, message: `Booked via ${meta.source ?? 'web'}`, ...eventActor(meta.actor) } },
      },
      include: { location: true },
    });
  });

  void notify(created.id, true);
  return { reservation: toPublic(created), token: created.token, managePath: await managePath(created.locale, created.code, created.token) };
}

export async function getPublicReservation(code: string, token: string) {
  const r = await prisma.reservation.findFirst({ where: { code, token }, include: { location: true } });
  if (!r) throw notFound('Reservation');
  return toPublic(r);
}

export async function cancelByGuest(code: string, token: string) {
  const r = await prisma.reservation.findFirst({ where: { code, token }, include: { location: true } });
  if (!r) throw notFound('Reservation');
  if (!toPublic(r).canCancel) throw badRequest('This reservation can no longer be cancelled online', 'not_cancellable');
  await prisma.reservation.update({
    where: { id: r.id },
    data: { status: 'cancelled', cancelledAt: new Date(), events: { create: { type: 'status', fromValue: r.status, toValue: 'cancelled', message: 'Cancelled by guest' } } },
  });
  void notify(r.id, false);
  return getPublicReservation(code, token);
}

/* ─────────────── Admin ─────────────── */

export async function listAdminReservations(f: { locationId?: string; from?: string; to?: string; status?: string; q?: string; page: number; pageSize: number }) {
  const where: Prisma.ReservationWhereInput = {
    ...(f.locationId ? { locationId: f.locationId } : {}),
    ...(f.status ? { status: { in: f.status.split(',') as any } } : {}),
    ...(f.from || f.to ? { date: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    ...(f.q
      ? {
          OR: [
            { code: { contains: f.q, mode: 'insensitive' } },
            { name: { contains: f.q, mode: 'insensitive' } },
            { email: { contains: f.q, mode: 'insensitive' } },
            { phone: { contains: f.q.replace(/[^\d+]/g, '') || f.q } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: [{ startsAt: 'asc' }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { location: { select: { name: true, timezone: true } } },
    }),
    prisma.reservation.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

export async function getAdminReservation(id: string) {
  const r = await prisma.reservation.findUnique({ where: { id }, include: { location: true, events: { orderBy: { createdAt: 'asc' } } } });
  if (!r) throw notFound('Reservation');
  return { ...r, allowedTransitions: RESERVATION_TRANSITIONS[r.status as ReservationStatus] };
}

export async function updateReservationStatus(id: string, to: ReservationStatus, note: string | undefined, actor: { actorId: string | null; actorName: string | null }) {
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r) throw notFound('Reservation');
  if (!canTransition(RESERVATION_TRANSITIONS, r.status as ReservationStatus, to)) throw badRequest(`Cannot change from ${r.status} to ${to}`, 'invalid_transition');
  await prisma.reservation.update({
    where: { id },
    data: {
      status: to,
      ...(to === 'cancelled' ? { cancelledAt: new Date() } : {}),
      events: { create: { type: 'status', fromValue: r.status, toValue: to, message: note || null, ...eventActor(actor) } },
    },
  });
  if (to === 'confirmed' || to === 'cancelled') void notify(id, false);
  return getAdminReservation(id);
}

export async function updateReservationDetails(
  id: string,
  patch: { date?: string; time?: string; partySize?: number; notes?: string | null; internalNote?: string | null; locationId?: string; force?: boolean },
  actor: { actorId: string | null; actorName: string | null },
) {
  const r = await prisma.reservation.findUnique({ where: { id }, include: { location: true } });
  if (!r) throw notFound('Reservation');
  const location = patch.locationId && patch.locationId !== r.locationId ? await prisma.location.findUnique({ where: { id: patch.locationId } }) : r.location;
  if (!location) throw badRequest('Invalid location');
  const date = patch.date ?? r.date;
  const time = patch.time ?? r.time;
  const partySize = patch.partySize ?? r.partySize;
  const moved = date !== r.date || time !== r.time || partySize !== r.partySize || location.id !== r.locationId;
  if (moved && !patch.force) {
    const slots = await computeSlots(prisma, location, date, partySize, r.id);
    const slot = slots.find((s) => s.time === time);
    if (!slot || slot.remaining < partySize) throw conflict('Not enough capacity at that time (use “force” to overbook)', 'slot_full');
  }
  const startsAt = zonedToUtc(date, time, location.timezone);
  await prisma.reservation.update({
    where: { id },
    data: {
      locationId: location.id,
      date,
      time,
      partySize,
      startsAt,
      endsAt: new Date(startsAt.getTime() + location.reservationDuration * 60_000),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.internalNote !== undefined ? { internalNote: patch.internalNote } : {}),
      events: moved ? { create: { type: 'updated', message: `Moved to ${date} ${time}, ${partySize} guests`, ...eventActor(actor) } } : undefined,
    },
  });
  return getAdminReservation(id);
}

/** Bookings per day for a month (calendar view). */
export async function reservationCalendar(locationId: string | undefined, month: string) {
  const from = `${month}-01`;
  const to = addDays(addDays(from, 31).slice(0, 7) + '-01', -1);
  const rows = await prisma.reservation.groupBy({
    by: ['date', 'status'],
    where: { date: { gte: from, lte: to }, ...(locationId ? { locationId } : {}) },
    _count: { _all: true },
    _sum: { partySize: true },
  });
  const days: Record<string, { bookings: number; guests: number; pending: number }> = {};
  for (const r of rows) {
    if (r.status === 'cancelled') continue;
    const d = (days[r.date] ??= { bookings: 0, guests: 0, pending: 0 });
    d.bookings += r._count._all;
    d.guests += r._sum.partySize ?? 0;
    if (r.status === 'pending') d.pending += r._count._all;
  }
  return days;
}

async function notify(id: string, isNew: boolean) {
  try {
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id }, include: { location: true } });
    const settings = await getPublicSettings();
    const base = (settings.site.url || env.WEB_URL).replace(/\/$/, '');
    const brand = { name: settings.site.name, accent: settings.theme.colors.accent, bg: settings.theme.colors.bg };
    const data: ReservationMailData = {
      code: r.code,
      locale: r.locale,
      status: r.status,
      name: r.name,
      phone: r.phone,
      email: r.email,
      date: r.date,
      time: r.time,
      partySize: r.partySize,
      locationName: r.location.name,
      locationAddress: [r.location.addressLine1, r.location.city].filter(Boolean).join(', '),
      notes: r.notes,
      manageUrl: `${base}${await managePath(r.locale, r.code, r.token)}`,
      adminUrl: `${env.ADMIN_URL}/reservations/${r.id}`,
    };
    if (r.email) await sendMail({ to: r.email, ...reservationEmail(brand, data) });
    const notifyTo = r.location.email || settings.site.notificationEmail;
    if (isNew && notifyTo) await sendMail({ to: notifyTo, ...newReservationAdminEmail(brand, data), replyTo: r.email ?? undefined });
  } catch (err) {
    logger.error({ err }, 'Reservation notification failed');
  }
}
