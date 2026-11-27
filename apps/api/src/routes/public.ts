import { Router } from 'express';
import { z } from 'zod';
import { checkoutSchema, quoteSchema, reservationSchema, availabilityQuerySchema } from '@app/shared/schemas';
import type { MarketResolution, PublicLocation } from '@app/shared/api';
import { PAYMENT_METHODS } from '@app/shared/commerce';
import { prisma } from '../db.ts';
import { env } from '../env.ts';
import { handler, parse } from '../lib/http.ts';
import { captchaConfigured, verifyCaptcha, type CaptchaAction } from '../lib/captcha.ts';
import { logger } from '../lib/logger.ts';
import { limiter } from '../lib/rate-limit.ts';
import { getCatalog } from '../modules/catalog/service.ts';
import { getEntryBySlug, getSingleton, listEntries, requireType } from '../modules/content/service.ts';
import { marketForCountry, publicMarket } from '../modules/markets/service.ts';
import { buildQuote, createOrder, getPublicOrder, lookupOrder, retryPayment } from '../modules/orders/service.ts';
import { verifyCheckoutSignature } from '../modules/payments/razorpay.ts';
import { applyPaymentResult } from '../modules/orders/service.ts';
import { cancelByGuest, createReservation, getAvailability, getPublicReservation } from '../modules/reservations/service.ts';
import { getDefaultLocale, getPublicSettings, getSetting } from '../modules/settings/service.ts';
import type { Location } from '../db.ts';

export const publicRouter = Router();

const writeLimiter = limiter('write', { windowMs: 60_000, limit: 15 });
const lookupLimiter = limiter('lookup', { windowMs: 15 * 60_000, limit: 10 });

/** Returns the bot check for this request (header `X-Captcha-Token`), or undefined when it is not active. */
async function humanCheck(req: { header(name: string): string | undefined; ip?: string }, action: CaptchaAction) {
  if (!captchaConfigured() || !(await getSetting('security')).captcha) return undefined;
  const token = req.header('x-captcha-token');
  return () => verifyCaptcha(token, action, req.ip);
}

const cacheShort = (res: any) => res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');

async function localeOf(q: unknown) {
  const v = typeof q === 'string' && q ? q : undefined;
  if (v) {
    const exists = await prisma.locale.findFirst({ where: { code: v, enabled: true } });
    if (exists) return v;
  }
  return getDefaultLocale();
}

export function toPublicLocation(l: Location): PublicLocation {
  return {
    id: l.id,
    name: l.name,
    slug: l.slug,
    addressLine1: l.addressLine1,
    addressLine2: l.addressLine2,
    city: l.city,
    region: l.region,
    postalCode: l.postalCode,
    country: l.country,
    phone: l.phone,
    email: l.email,
    timezone: l.timezone,
    acceptsReservations: l.acceptsReservations,
    acceptsPickup: l.acceptsPickup,
    openingHours: l.openingHours as PublicLocation['openingHours'],
    minPartySize: l.minPartySize,
    maxPartySize: l.maxPartySize,
    maxAdvanceDays: l.maxAdvanceDays,
  };
}

/* ─────────────── Settings & content ─────────────── */

publicRouter.get(
  '/settings',
  handler(async (_req, res) => {
    cacheShort(res);
    res.json(await getPublicSettings());
  }),
);

publicRouter.get(
  '/content/:type',
  handler<{ type: string }>(async (req, res) => {
    const def = requireType(req.params.type);
    const locale = await localeOf(req.query.locale);
    cacheShort(res);
    if (def.kind === 'collection') return res.json(await listEntries(def.key, locale));
    res.json(await getSingleton(def.key, locale));
  }),
);

publicRouter.get(
  '/content/:type/entries',
  handler<{ type: string }>(async (req, res) => {
    cacheShort(res);
    res.json(await listEntries(req.params.type, await localeOf(req.query.locale)));
  }),
);

publicRouter.get(
  '/content/:type/entries/:slug',
  handler<{ type: string; slug: string }>(async (req, res) => {
    cacheShort(res);
    res.json(await getEntryBySlug(req.params.type, req.params.slug, await localeOf(req.query.locale)));
  }),
);

publicRouter.get(
  '/catalog',
  handler(async (req, res) => {
    cacheShort(res);
    const country = typeof req.query.country === 'string' ? req.query.country : undefined;
    res.json(await getCatalog(await localeOf(req.query.locale), country));
  }),
);

/* ─────────────── Markets & checkout ─────────────── */

publicRouter.get(
  '/markets/resolve',
  handler(async (req, res) => {
    let country = typeof req.query.country === 'string' ? req.query.country.toUpperCase().slice(0, 2) : '';
    // Unknown visitor country → suggest the default market's first country.
    if (!country) {
      const { defaultMarket } = await marketForCountry(null);
      country = defaultMarket?.countries[0] ?? '';
    }
    const { market } = await marketForCountry(country);
    if (!market) return res.status(503).json({ error: { code: 'no_market', message: 'No market configured' } });
    const pickup = market.pickupEnabled
      ? await prisma.location.findMany({ where: { isActive: true, acceptsPickup: true }, orderBy: { sortOrder: 'asc' } })
      : [];
    const body: MarketResolution = {
      country: country || market.countries[0] || '',
      market: publicMarket(market),
      pickupLocations: pickup.map(toPublicLocation),
      stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || null,
    };
    res.json(body);
  }),
);

publicRouter.post(
  '/checkout/quote',
  handler(async (req, res) => {
    const input = parse(quoteSchema, req.body);
    const { _market, ...quote } = await buildQuote(input, await localeOf(req.query.locale));
    res.json(quote);
  }),
);

publicRouter.post(
  '/orders',
  writeLimiter,
  handler(async (req, res) => {
    const input = parse(checkoutSchema, req.body);
    const key = req.header('Idempotency-Key')?.slice(0, 100);
    res.status(201).json(
      await createOrder(input, { idempotencyKey: key, ip: req.ip, userAgent: req.header('user-agent'), verifyHuman: await humanCheck(req, 'checkout') }),
    );
  }),
);

publicRouter.post(
  '/orders/lookup',
  lookupLimiter,
  handler(async (req, res) => {
    const { number, phone } = parse(z.object({ number: z.string().min(3).max(40), phone: z.string().min(5).max(32) }), req.body);
    res.json(await lookupOrder(number, phone));
  }),
);

publicRouter.get(
  '/orders/:number',
  handler<{ number: string }>(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getPublicOrder(req.params.number, String(req.query.token ?? '')));
  }),
);

publicRouter.post(
  '/orders/:number/pay',
  writeLimiter,
  handler<{ number: string }>(async (req, res) => {
    const { paymentMethod } = parse(z.object({ paymentMethod: z.enum(PAYMENT_METHODS) }), req.body);
    res.json(await retryPayment(req.params.number, String(req.query.token ?? ''), paymentMethod));
  }),
);

publicRouter.post(
  '/orders/:number/razorpay/verify',
  writeLimiter,
  handler<{ number: string }>(async (req, res) => {
    const body = parse(
      z.object({ razorpay_payment_id: z.string(), razorpay_order_id: z.string(), razorpay_signature: z.string() }),
      req.body,
    );
    const order = await prisma.order.findFirst({ where: { number: req.params.number, token: String(req.query.token ?? '') } });
    if (!order) return res.status(404).json({ error: { code: 'not_found', message: 'Order not found' } });
    if (order.paymentRef !== body.razorpay_order_id || !verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      return res.status(400).json({ error: { code: 'invalid_signature', message: 'Payment could not be verified' } });
    }
    await applyPaymentResult(order.id, 'razorpay', {
      status: 'succeeded',
      providerRef: body.razorpay_order_id,
      amount: order.total,
      currency: order.currency,
      raw: { payment_id: body.razorpay_payment_id },
    });
    res.json(await getPublicOrder(order.number, order.token));
  }),
);

/* ─────────────── Locations & reservations ─────────────── */

publicRouter.get(
  '/locations',
  handler(async (req, res) => {
    const purpose = req.query.purpose;
    const rows = await prisma.location.findMany({
      where: {
        isActive: true,
        ...(purpose === 'reservations' ? { acceptsReservations: true } : {}),
        ...(purpose === 'pickup' ? { acceptsPickup: true } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    cacheShort(res);
    res.json(rows.map(toPublicLocation));
  }),
);

publicRouter.get(
  '/reservations/availability',
  handler(async (req, res) => {
    const q = parse(availabilityQuerySchema, req.query);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getAvailability(q.locationId, q.date, q.partySize));
  }),
);

publicRouter.post(
  '/reservations',
  writeLimiter,
  handler(async (req, res) => {
    const input = parse(reservationSchema, req.body);
    res.status(201).json(
      await createReservation(input, {
        idempotencyKey: req.header('Idempotency-Key')?.slice(0, 100),
        ip: req.ip,
        verifyHuman: await humanCheck(req, 'reservation'),
      }),
    );
  }),
);

publicRouter.get(
  '/reservations/:code',
  handler<{ code: string }>(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getPublicReservation(req.params.code, String(req.query.token ?? '')));
  }),
);

publicRouter.post(
  '/reservations/:code/cancel',
  writeLimiter,
  handler<{ code: string }>(async (req, res) => {
    res.json(await cancelByGuest(req.params.code, String(req.query.token ?? '')));
  }),
);

/* ─────────────── Security reports ─────────────── */

const reportLimiter = limiter('csp', { windowMs: 60_000, limit: 30, standardHeaders: false });

/**
 * Content-Security-Policy violation reports from the website (`report-uri` / Reporting API).
 * Logged (not stored) so a policy change can be checked in report-only mode before enforcing it.
 */
publicRouter.post('/csp-report', reportLimiter, (req, res) => {
  const body = req.body as any;
  const reports: any[] = Array.isArray(body) ? body.map((r) => r?.body ?? r) : body?.['csp-report'] ? [body['csp-report']] : [];
  for (const r of reports.slice(0, 10)) {
    const s = (v: unknown) => (typeof v === 'string' ? v.slice(0, 300) : undefined);
    logger.warn(
      {
        csp: {
          directive: s(r?.effectiveDirective ?? r?.['effective-directive'] ?? r?.['violated-directive']),
          blocked: s(r?.blockedURL ?? r?.['blocked-uri']),
          page: s(r?.documentURL ?? r?.['document-uri']),
          source: s(r?.sourceFile ?? r?.['source-file']),
          disposition: s(r?.disposition),
        },
      },
      'CSP violation',
    );
  }
  res.status(204).end();
});
