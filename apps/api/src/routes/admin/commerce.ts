import { Router } from 'express';
import { z } from 'zod';
import { ORDER_STATUSES, PAYMENT_PROVIDER_INFO, PAYMENT_PROVIDERS, RESERVATION_STATUSES } from '@app/shared/commerce';
import { isCountryCode } from '@app/shared/i18n';
import { hhmm, isoDate, openingHoursSchema, reservationSchema } from '@app/shared/schemas';
import { prisma } from '../../db.ts';
import { env } from '../../env.ts';
import { audit } from '../../lib/audit.ts';
import { badRequest, handler, notFound, parse } from '../../lib/http.ts';
import { revalidate } from '../../lib/revalidate.ts';
import { isValidTimeZone } from '../../lib/time.ts';
import { actor, requirePermission } from '../../middleware/auth.ts';
import { invalidateMarkets } from '../../modules/markets/service.ts';
import {
  addOrderNote,
  getAdminOrder,
  listAdminOrders,
  refundOrder,
  setPaymentStatus,
  updateOrderStatus,
} from '../../modules/orders/service.ts';
import { adapters } from '../../modules/payments/registry.ts';
import {
  createReservation,
  getAdminReservation,
  getAvailability,
  listAdminReservations,
  reservationCalendar,
  updateReservationDetails,
  updateReservationStatus,
} from '../../modules/reservations/service.ts';

export const commerceAdmin = Router();

const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(25) };

/* ─────────────── Markets ─────────────── */

const marketBody = z.object({
  code: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().min(1).max(80),
  enabled: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  countries: z.array(z.string().length(2).transform((c) => c.toUpperCase())).refine((a) => a.every(isCountryCode), 'Unknown country code'),
  isDefault: z.boolean(),
  isFallback: z.boolean(),
  exchangeRate: z.number().positive(),
  rounding: z.enum(['none', 'whole', 'x99']),
  taxRate: z.number().min(0).max(100),
  taxInclusive: z.boolean(),
  taxLabel: z.string().max(40),
  deliveryEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  shippingFee: z.number().int().min(0),
  freeShippingThreshold: z.number().int().min(0).nullable(),
  minOrderAmount: z.number().int().min(0).nullable(),
  codEnabled: z.boolean(),
  codFee: z.number().int().min(0),
  codMaxAmount: z.number().int().min(0).nullable(),
  paymentProviders: z.array(z.enum(PAYMENT_PROVIDERS)),
  sortOrder: z.number().int().default(0),
});

async function saveMarket(id: string | null, data: z.infer<typeof marketBody>) {
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.market.updateMany({ where: id ? { id: { not: id } } : {}, data: { isDefault: false } });
    if (data.isFallback) await tx.market.updateMany({ where: id ? { id: { not: id } } : {}, data: { isFallback: false } });
    // A country can only belong to one market.
    const others = await tx.market.findMany({ where: id ? { id: { not: id } } : {} });
    const clash = others.flatMap((m) => m.countries.filter((c) => data.countries.includes(c)).map((c) => `${c} (${m.name})`));
    if (clash.length) throw badRequest(`Already assigned to another market: ${clash.join(', ')}`, 'country_conflict');
    return id ? tx.market.update({ where: { id }, data }) : tx.market.create({ data });
  });
}

commerceAdmin.get('/markets', requirePermission('markets.manage'), handler(async (_req, res) => {
  res.json(await prisma.market.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { orders: true, prices: true } } } }));
}));

commerceAdmin.post('/markets', requirePermission('markets.manage'), handler(async (req, res) => {
  const m = await saveMarket(null, parse(marketBody, req.body));
  invalidateMarkets();
  revalidate('catalog', 'markets');
  await audit(req, 'market.create', 'market', m.id, { code: m.code });
  res.status(201).json(m);
}));

commerceAdmin.put('/markets/:id', requirePermission('markets.manage'), handler<{ id: string }>(async (req, res) => {
  const m = await saveMarket(req.params.id, parse(marketBody, req.body));
  invalidateMarkets();
  revalidate('catalog', 'markets');
  await audit(req, 'market.update', 'market', m.id, req.body);
  res.json(m);
}));

commerceAdmin.delete('/markets/:id', requirePermission('markets.manage'), handler<{ id: string }>(async (req, res) => {
  const orders = await prisma.order.count({ where: { marketId: req.params.id } });
  if (orders) throw badRequest('Markets with orders cannot be deleted — disable it instead', 'in_use');
  await prisma.market.delete({ where: { id: req.params.id } });
  invalidateMarkets();
  revalidate('catalog', 'markets');
  await audit(req, 'market.delete', 'market', req.params.id);
  res.status(204).end();
}));

commerceAdmin.get('/payment-providers', requirePermission('markets.manage'), (_req, res) => {
  res.json(
    PAYMENT_PROVIDERS.map((id) => ({
      id,
      ...PAYMENT_PROVIDER_INFO[id],
      configured: adapters[id].isConfigured(),
      webhookUrl: `${env.API_URL}/api/v1/payments${adapters[id].webhook.path}`,
      webhookConfigured: adapters[id].webhook.configured(),
      mode: adapters[id].mode(),
    })),
  );
});

/* ─────────────── Product commerce (SKU, stock, prices) ─────────────── */

commerceAdmin.get('/products/:id/commerce', requirePermission('catalog.edit'), handler<{ id: string }>(async (req, res) => {
  const product = await prisma.contentEntry.findFirst({ where: { id: req.params.id, type: 'product' } });
  if (!product) throw notFound('Product');
  const [commerce, prices, markets] = await Promise.all([
    prisma.productCommerce.upsert({ where: { productId: product.id }, create: { productId: product.id }, update: {} }),
    prisma.productPrice.findMany({ where: { productId: product.id } }),
    prisma.market.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  res.json({ commerce, prices, markets });
}));

commerceAdmin.put('/products/:id/commerce', requirePermission('catalog.edit'), handler<{ id: string }>(async (req, res) => {
  const body = parse(
    z.object({
      sku: z.string().max(64).nullable(),
      orderable: z.boolean(),
      trackStock: z.boolean(),
      stock: z.number().int().min(0),
      maxPerOrder: z.number().int().min(1).max(999),
      prices: z.array(z.object({ marketId: z.string(), amount: z.number().int().min(0), compareAtAmount: z.number().int().min(0).nullable().optional() })),
    }),
    req.body,
  );
  const { prices, ...commerce } = body;
  await prisma.$transaction([
    prisma.productCommerce.upsert({ where: { productId: req.params.id }, create: { productId: req.params.id, ...commerce, sku: commerce.sku || null }, update: { ...commerce, sku: commerce.sku || null } }),
    prisma.productPrice.deleteMany({ where: { productId: req.params.id } }),
    prisma.productPrice.createMany({ data: prices.map((p) => ({ productId: req.params.id, marketId: p.marketId, amount: p.amount, compareAtAmount: p.compareAtAmount ?? null })) }),
  ]);
  revalidate('catalog');
  await audit(req, 'product.commerce', 'product', req.params.id, body);
  res.json({ ok: true });
}));

/* ─────────────── Orders ─────────────── */

commerceAdmin.get('/orders', requirePermission('orders.view'), handler(async (req, res) => {
  const q = parse(
    z.object({ status: z.string().optional(), paymentStatus: z.string().optional(), paymentMethod: z.string().optional(), q: z.string().optional(), from: isoDate.optional(), to: isoDate.optional(), ...page }),
    req.query,
  );
  res.json(await listAdminOrders(q));
}));

commerceAdmin.get('/orders/export.csv', requirePermission('orders.view'), handler(async (req, res) => {
  const q = parse(z.object({ status: z.string().optional(), from: isoDate.optional(), to: isoDate.optional() }), req.query);
  const { items } = await listAdminOrders({ ...q, page: 1, pageSize: 10000 });
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['number', 'created_at', 'status', 'payment_status', 'payment_method', 'fulfillment', 'market', 'currency', 'subtotal', 'shipping', 'cod_fee', 'tax', 'total', 'customer', 'phone', 'email', 'country'];
  const rows = items.map((o) =>
    [o.number, o.createdAt.toISOString(), o.status, o.paymentStatus, o.paymentMethod, o.fulfillment, o.market.name, o.currency, o.subtotal, o.shipping, o.codFee, o.tax, o.total, o.customerName, o.customerPhone, o.customerEmail, o.country].map(cell).join(','),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${header.join(',')}\n${rows.join('\n')}`);
}));

commerceAdmin.get('/orders/:id', requirePermission('orders.view'), handler<{ id: string }>(async (req, res) => res.json(await getAdminOrder(req.params.id))));

commerceAdmin.post('/orders/:id/status', requirePermission('orders.manage'), handler<{ id: string }>(async (req, res) => {
  const body = parse(z.object({ status: z.enum(ORDER_STATUSES), note: z.string().max(500).optional(), notifyCustomer: z.boolean().default(true) }), req.body);
  const o = await updateOrderStatus(req.params.id, body.status, body.note, actor(req), body.notifyCustomer);
  await audit(req, 'order.status', 'order', req.params.id, body);
  res.json(o);
}));

commerceAdmin.post('/orders/:id/payment-status', requirePermission('orders.manage'), handler<{ id: string }>(async (req, res) => {
  const body = parse(z.object({ status: z.enum(['paid', 'unpaid', 'refunded']), note: z.string().max(500).optional() }), req.body);
  const o = await setPaymentStatus(req.params.id, body.status, body.note, actor(req));
  await audit(req, 'order.payment', 'order', req.params.id, body);
  res.json(o);
}));

commerceAdmin.post('/orders/:id/refund', requirePermission('orders.manage'), handler<{ id: string }>(async (req, res) => {
  const body = parse(z.object({ amount: z.number().int().positive().optional() }), req.body);
  const o = await refundOrder(req.params.id, body.amount, actor(req));
  await audit(req, 'order.refund', 'order', req.params.id, body);
  res.json(o);
}));

commerceAdmin.post('/orders/:id/notes', requirePermission('orders.manage'), handler<{ id: string }>(async (req, res) => {
  const { message } = parse(z.object({ message: z.string().min(1).max(2000) }), req.body);
  res.json(await addOrderNote(req.params.id, message, actor(req)));
}));

commerceAdmin.patch('/orders/:id', requirePermission('orders.manage'), handler<{ id: string }>(async (req, res) => {
  const body = parse(z.object({ internalNote: z.string().max(5000).nullable() }), req.body);
  await prisma.order.update({ where: { id: req.params.id }, data: body });
  res.json(await getAdminOrder(req.params.id));
}));

/* ─────────────── Locations ─────────────── */

const locationBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  name: z.string().min(1).max(120),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().min(1).max(120),
  region: z.string().max(120).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  country: z.string().length(2).transform((c) => c.toUpperCase()),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  timezone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  isActive: z.boolean(),
  acceptsReservations: z.boolean(),
  acceptsPickup: z.boolean(),
  openingHours: openingHoursSchema,
  slotInterval: z.number().int().min(5).max(240),
  reservationDuration: z.number().int().min(15).max(600),
  maxCovers: z.number().int().min(1).max(10000),
  minPartySize: z.number().int().min(1),
  maxPartySize: z.number().int().min(1).max(500),
  leadTimeMinutes: z.number().int().min(0).max(10080),
  maxAdvanceDays: z.number().int().min(1).max(730),
  autoConfirm: z.boolean(),
  closedDates: z.array(isoDate).max(500),
  sortOrder: z.number().int().default(0),
});

commerceAdmin.get('/locations', requirePermission('reservations.view'), handler(async (_req, res) => {
  res.json(await prisma.location.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }));
}));

commerceAdmin.post('/locations', requirePermission('locations.manage'), handler(async (req, res) => {
  const l = await prisma.location.create({ data: parse(locationBody, req.body) });
  revalidate('locations');
  await audit(req, 'location.create', 'location', l.id);
  res.status(201).json(l);
}));

commerceAdmin.put('/locations/:id', requirePermission('locations.manage'), handler<{ id: string }>(async (req, res) => {
  const l = await prisma.location.update({ where: { id: req.params.id }, data: parse(locationBody, req.body) });
  revalidate('locations');
  await audit(req, 'location.update', 'location', l.id);
  res.json(l);
}));

commerceAdmin.delete('/locations/:id', requirePermission('locations.manage'), handler<{ id: string }>(async (req, res) => {
  const used = await prisma.reservation.count({ where: { locationId: req.params.id } });
  if (used) throw badRequest('Locations with reservations cannot be deleted — deactivate it instead', 'in_use');
  await prisma.location.delete({ where: { id: req.params.id } });
  revalidate('locations');
  await audit(req, 'location.delete', 'location', req.params.id);
  res.status(204).end();
}));

/* ─────────────── Reservations ─────────────── */

commerceAdmin.get('/reservations', requirePermission('reservations.view'), handler(async (req, res) => {
  const q = parse(z.object({ locationId: z.string().optional(), from: isoDate.optional(), to: isoDate.optional(), status: z.string().optional(), q: z.string().optional(), ...page }), req.query);
  res.json(await listAdminReservations(q));
}));

commerceAdmin.get('/reservations/calendar', requirePermission('reservations.view'), handler(async (req, res) => {
  const q = parse(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), locationId: z.string().optional() }), req.query);
  res.json(await reservationCalendar(q.locationId, q.month));
}));

commerceAdmin.post('/reservations', requirePermission('reservations.manage'), handler(async (req, res) => {
  const body = parse(reservationSchema.and(z.object({ source: z.enum(['admin', 'phone']).default('phone'), force: z.boolean().default(false) })), req.body);
  const created = await createReservation(body, { source: body.source, actor: actor(req), skipChecks: body.force });
  await audit(req, 'reservation.create', 'reservation', created.reservation.code);
  res.status(201).json(created);
}));

commerceAdmin.get('/reservations/:id', requirePermission('reservations.view'), handler<{ id: string }>(async (req, res) => res.json(await getAdminReservation(req.params.id))));

commerceAdmin.post('/reservations/:id/status', requirePermission('reservations.manage'), handler<{ id: string }>(async (req, res) => {
  const body = parse(z.object({ status: z.enum(RESERVATION_STATUSES), note: z.string().max(500).optional() }), req.body);
  const r = await updateReservationStatus(req.params.id, body.status, body.note, actor(req));
  await audit(req, 'reservation.status', 'reservation', req.params.id, body);
  res.json(r);
}));

commerceAdmin.patch('/reservations/:id', requirePermission('reservations.manage'), handler<{ id: string }>(async (req, res) => {
  const body = parse(
    z.object({
      date: isoDate.optional(),
      time: hhmm.optional(),
      partySize: z.number().int().min(1).max(500).optional(),
      locationId: z.string().optional(),
      notes: z.string().max(1000).nullable().optional(),
      internalNote: z.string().max(5000).nullable().optional(),
      force: z.boolean().optional(),
    }),
    req.body,
  );
  const r = await updateReservationDetails(req.params.id, body, actor(req));
  await audit(req, 'reservation.update', 'reservation', req.params.id, body);
  res.json(r);
}));
