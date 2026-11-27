import type { CreateOrderResponse, PublicOrder, Quote, QuoteLine } from '@app/shared/api';
import {
  availablePaymentMethods,
  canTransition,
  codAvailability,
  computeTotals,
  ORDER_TRANSITIONS,
  priceForMarket,
  type Fulfillment,
  type OrderStatus,
  type PaymentMethod,
} from '@app/shared/commerce';
import type { ProductContent } from '@app/shared/content';
import { countryName } from '@app/shared/i18n';
import { normalizePhone, type CheckoutInput, type QuoteInput } from '@app/shared/schemas';
import { env } from '../../env.ts';
import { prisma, type Prisma, type Tx } from '../../db.ts';
import { badRequest, conflict, HttpError, notFound } from '../../lib/http.ts';
import { nextSequence, secretToken } from '../../lib/ids.ts';
import { logger } from '../../lib/logger.ts';
import { eventActor } from '../../lib/actor.ts';
import { codLimitReached, customerBlocked, isBlockedCustomer, OPEN_ORDER_STATUSES } from '../../lib/abuse.ts';
import { listEntries } from '../content/service.ts';
import { marketForCountry, publicMarket } from '../markets/service.ts';
import { sendMail } from '../notifications/mailer.ts';
import { newOrderAdminEmail, orderConfirmationEmail, orderStatusEmail, type OrderMailData } from '../notifications/templates.ts';
import { adapterFor, configuredProviders } from '../payments/registry.ts';
import type { PaymentResult } from '../payments/types.ts';
import { getCommerceSettings, getDefaultLocale, getPublicSettings, getSetting } from '../settings/service.ts';

type OrderFull = Prisma.OrderGetPayload<{ include: { items: true; pickupLocation: true; events: true } }>;

/* ───────────────────────────── Quote ───────────────────────────── */

export async function buildQuote(input: QuoteInput, locale: string): Promise<Quote & { _market: NonNullable<Awaited<ReturnType<typeof marketForCountry>>['market']> }> {
  const { market, defaultMarket } = await marketForCountry(input.country);
  if (!market) throw new HttpError(503, 'no_market', 'Ordering is not available right now');

  const ids = [...new Set(input.items.map((i) => i.productId))];
  const [entries, commerce, prices] = await Promise.all([
    listEntries<ProductContent>('product', locale),
    prisma.productCommerce.findMany({ where: { productId: { in: ids } } }),
    prisma.productPrice.findMany({ where: { productId: { in: ids } } }),
  ]);

  const lines: QuoteLine[] = [];
  for (const item of input.items) {
    const entry = entries.find((e) => e.id === item.productId);
    const c = commerce.find((x) => x.productId === item.productId);
    const price = entry ? priceForMarket(prices.filter((p) => p.productId === item.productId), market, defaultMarket) : null;
    const maxQuantity = Math.max(0, Math.min(c?.maxPerOrder ?? 24, c?.trackStock ? c.stock : Infinity));
    const available = Boolean(entry && c?.orderable && price && maxQuantity > 0);
    const quantity = Math.min(item.quantity, Math.max(maxQuantity, 0));
    lines.push({
      productId: item.productId,
      slug: entry?.slug ?? '',
      name: entry ? productDisplayName(entry.data, entry.slug) : 'Product',
      image: entry?.data.image?.url ?? null,
      unitPrice: price?.amount ?? 0,
      quantity: available ? quantity : 0,
      lineTotal: available ? (price?.amount ?? 0) * quantity : 0,
      available,
      maxQuantity,
    });
  }

  const fulfillment: Fulfillment = input.fulfillment ?? 'delivery';
  const billable = lines.filter((l) => l.available);
  const totals = computeTotals({ lines: billable, market, fulfillment, paymentMethod: input.paymentMethod });
  const totalsWithoutCod = computeTotals({ lines: billable, market, fulfillment, paymentMethod: null });
  const paymentMethods = availablePaymentMethods(market, configuredProviders(), totalsWithoutCod.total);
  return {
    country: input.country,
    market: publicMarket(market, totalsWithoutCod.total),
    lines,
    totals,
    paymentMethods,
    codUnavailableReason: codAvailability(market, totalsWithoutCod.total).reason,
    belowMinimum: market.minOrderAmount !== null && totals.subtotal < market.minOrderAmount,
    _market: market,
  };
}

/** Product name for receipts and the order history (SEO title, else the product title, else the slug). */
function productDisplayName(p: ProductContent, slug: string) {
  return (p.metaTitle?.split('|')[0]?.trim() || p.title?.replace(/\s*\n\s*/g, ' ') || slug).slice(0, 160);
}

/* ───────────────────────────── Create ───────────────────────────── */

export async function createOrder(
  input: CheckoutInput,
  meta: {
    idempotencyKey?: string;
    ip?: string;
    userAgent?: string;
    /** Bot check — runs after the idempotency lookup so a retried request is answered without a fresh token. */
    verifyHuman?: () => Promise<void>;
  },
): Promise<CreateOrderResponse> {
  const features = await getSetting('features');
  if (!features.ordering) throw new HttpError(403, 'ordering_disabled', 'Online ordering is currently closed');

  if (meta.idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey: meta.idempotencyKey }, include: { items: true } });
    if (existing) return responseFor(existing, await paymentActionFor(existing));
  }
  await meta.verifyHuman?.();

  const commerceSettings = await getCommerceSettings();
  const quote = await buildQuote(input, input.locale);
  const market = quote._market;

  const unavailable = quote.lines.filter((l) => !l.available || l.quantity < (input.items.find((i) => i.productId === l.productId)?.quantity ?? 0));
  if (unavailable.length) {
    throw new HttpError(409, 'items_unavailable', 'Some items are no longer available in the requested quantity', unavailable.map((l) => ({ path: ['items', l.productId], message: 'unavailable' })));
  }
  if (quote.belowMinimum) throw badRequest('The order is below the minimum amount for your region', 'below_minimum');
  if (input.fulfillment === 'delivery' && !market.deliveryEnabled) throw badRequest('Delivery is not available in your region', 'delivery_unavailable');
  if (input.fulfillment === 'pickup' && !market.pickupEnabled) throw badRequest('Pick-up is not available in your region', 'pickup_unavailable');

  // COD and gateway availability are enforced here, never trusted from the client.
  const method = input.paymentMethod as PaymentMethod;
  if (!quote.paymentMethods.includes(method)) {
    throw badRequest(
      method === 'cod' ? 'Cash on delivery is not available for this order' : 'This payment method is not available in your region',
      'payment_method_unavailable',
    );
  }
  if (method !== 'cod' && commerceSettings.requireEmailForOnlinePayment && !input.customer.email) {
    throw new HttpError(422, 'validation_error', 'E-mail is required for online payment', [{ path: ['customer', 'email'], message: 'required' }]);
  }

  let pickupLocationId: string | null = null;
  if (input.fulfillment === 'pickup') {
    const loc = await prisma.location.findFirst({ where: { id: input.pickupLocationId, isActive: true, acceptsPickup: true } });
    if (!loc) throw badRequest('Choose a valid pick-up location', 'invalid_location');
    pickupLocationId = loc.id;
  }

  const phone = normalizePhone(input.customer.phone, input.address?.country ?? input.country);
  if (!phone) throw new HttpError(422, 'validation_error', 'Invalid phone number', [{ path: ['customer', 'phone'], message: 'phone' }]);

  if (isBlockedCustomer(commerceSettings.blockedCustomers, { phone, email: input.customer.email })) {
    logger.info({ phone, ip: meta.ip }, 'Order refused: blocked customer');
    throw customerBlocked();
  }
  if (method === 'cod' && commerceSettings.codMaxOpenOrdersPerPhone > 0) {
    const open = await prisma.order.count({
      where: { customerPhone: phone, paymentMethod: 'cod', status: { in: [...OPEN_ORDER_STATUSES] } },
    });
    if (open >= commerceSettings.codMaxOpenOrdersPerPhone) throw codLimitReached();
  }

  const totals = computeTotals({ lines: quote.lines, market, fulfillment: input.fulfillment, paymentMethod: method });
  const prefix = commerceSettings.orderPrefix;

  const order = await prisma.$transaction(async (tx) => {
    for (const line of quote.lines) {
      const c = await tx.productCommerce.findUnique({ where: { productId: line.productId } });
      if (c?.trackStock) {
        const updated = await tx.productCommerce.updateMany({
          where: { productId: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count === 0) throw conflict(`${line.name} just sold out`, 'out_of_stock');
      }
    }
    const seq = await nextSequence('order', 10001, tx);
    return tx.order.create({
      data: {
        number: prefix ? `${prefix}-${seq}` : String(seq),
        token: secretToken(),
        status: 'pending',
        paymentStatus: method === 'cod' ? 'unpaid' : 'pending',
        paymentMethod: method,
        fulfillment: input.fulfillment,
        marketId: market.id,
        country: input.country,
        currency: market.currency,
        locale: input.locale,
        customerName: input.customer.name,
        customerPhone: phone,
        customerEmail: input.customer.email ?? null,
        ...(input.fulfillment === 'delivery' && input.address
          ? {
              addressLine1: input.address.line1,
              addressLine2: input.address.line2 || null,
              city: input.address.city,
              region: input.address.region || null,
              postalCode: input.address.postalCode?.toUpperCase() || null,
              addressCountry: input.address.country,
            }
          : {}),
        pickupLocationId,
        notes: input.notes || null,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        codFee: totals.codFee,
        tax: totals.tax,
        taxInclusive: totals.taxInclusive,
        total: totals.total,
        idempotencyKey: meta.idempotencyKey ?? null,
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        items: {
          create: quote.lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            image: l.image,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.unitPrice * l.quantity,
          })),
        },
        events: { create: { type: 'created', toValue: 'pending', message: `Order placed (${method.toUpperCase()})` } },
      },
      include: { items: true },
    });
  });

  if (method === 'cod') {
    void notifyNewOrder(order.id);
    return responseFor(order, { type: 'none' });
  }

  try {
    const action = await startPayment(order);
    return responseFor(order, action);
  } catch (err) {
    logger.error({ err, order: order.number }, 'Payment initialisation failed');
    await cancelOrder(order.id, 'Payment could not be started', null);
    throw new HttpError(502, 'payment_unavailable', 'The payment provider is not responding. Please try again or choose another method.');
  }
}

async function startPayment(order: Prisma.OrderGetPayload<{ include: { items: true } }>) {
  const adapter = adapterFor(order.paymentMethod);
  if (!adapter || !adapter.isConfigured()) throw new Error(`Payment provider ${order.paymentMethod} not configured`);
  const { action, providerRef } = await adapter.createPayment(order);
  await prisma.order.update({ where: { id: order.id }, data: { paymentRef: providerRef, paymentStatus: 'pending' } });
  if (providerRef) {
    await prisma.payment.upsert({
      where: { provider_providerRef: { provider: adapter.id, providerRef } },
      create: { orderId: order.id, provider: adapter.id, providerRef, amount: order.total, currency: order.currency, status: 'pending' },
      update: { amount: order.total },
    });
  }
  return action;
}

async function paymentActionFor(order: Prisma.OrderGetPayload<{ include: { items: true } }>) {
  if (order.paymentMethod === 'cod' || order.paymentStatus === 'paid' || order.status === 'cancelled') return { type: 'none' as const };
  try {
    return await startPayment(order);
  } catch {
    return { type: 'none' as const };
  }
}

async function localePath(locale: string, path: string) {
  const def = await getDefaultLocale();
  return locale === def ? path : `/${locale}${path}`;
}

async function responseFor(order: { number: string; token: string; status: any; paymentStatus: any; total: number; currency: string; locale: string }, payment: CreateOrderResponse['payment']): Promise<CreateOrderResponse> {
  return {
    order: { number: order.number, token: order.token, status: order.status, paymentStatus: order.paymentStatus, total: order.total, currency: order.currency },
    payment,
    trackingPath: await localePath(order.locale, `/order/${order.number}?token=${order.token}`),
  };
}

export async function retryPayment(number: string, token: string, method: PaymentMethod) {
  const order = await prisma.order.findFirst({ where: { number, token }, include: { items: true } });
  if (!order) throw notFound('Order');
  if (order.status !== 'pending' || order.paymentStatus === 'paid') throw badRequest('This order cannot be paid again', 'not_payable');
  const quote = await buildQuote(
    { country: order.country, items: order.items.filter((i) => i.productId).map((i) => ({ productId: i.productId!, quantity: i.quantity })), fulfillment: order.fulfillment as Fulfillment },
    order.locale,
  );
  if (!quote.paymentMethods.includes(method)) throw badRequest('This payment method is not available', 'payment_method_unavailable');

  if (method === 'cod') {
    const market = quote._market;
    const totals = computeTotals({ lines: order.items, market, fulfillment: order.fulfillment as Fulfillment, paymentMethod: 'cod' });
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: 'cod', paymentStatus: 'unpaid', codFee: totals.codFee, tax: totals.tax, total: totals.total, events: { create: { type: 'payment', toValue: 'cod', message: 'Switched to cash on delivery' } } },
      include: { items: true },
    });
    void notifyNewOrder(order.id);
    return responseFor(updated, { type: 'none' });
  }
  const updated = order.paymentMethod === method ? order : await prisma.order.update({ where: { id: order.id }, data: { paymentMethod: method, paymentRef: null }, include: { items: true } });
  return responseFor(updated, await startPayment(updated));
}

/* ───────────────────────────── Payment results ───────────────────────────── */

export async function applyPaymentResult(orderId: string, provider: string, result: PaymentResult) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;

  await prisma.payment.upsert({
    where: { provider_providerRef: { provider, providerRef: result.providerRef } },
    create: { orderId, provider, providerRef: result.providerRef, amount: result.amount, currency: result.currency, status: result.status, raw: result.raw as any },
    update: { status: result.status, amount: result.amount, raw: result.raw as any },
  });

  if (result.status === 'succeeded') {
    if (order.paymentStatus === 'paid') return;
    if (result.amount < order.total || result.currency.toUpperCase() !== order.currency) {
      logger.error({ order: order.number, result }, 'Payment amount/currency mismatch');
      await prisma.orderEvent.create({ data: { orderId, type: 'payment', toValue: 'mismatch', message: `Amount mismatch: received ${result.amount} ${result.currency}` } });
      return;
    }
    const wasCancelled = order.status === 'cancelled';
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        paidAt: new Date(),
        ...(order.status === 'pending' ? { status: 'confirmed' } : {}),
        events: {
          create: [
            { type: 'payment', fromValue: order.paymentStatus, toValue: 'paid', message: `Paid via ${provider}` },
            ...(order.status === 'pending' ? [{ type: 'status', fromValue: 'pending', toValue: 'confirmed', message: 'Confirmed automatically after payment' }] : []),
          ],
        },
      },
    });
    if (wasCancelled) logger.warn({ order: order.number }, 'Payment received for a cancelled order — refund manually');
    void notifyNewOrder(orderId);
  } else if (result.status === 'failed' && order.paymentStatus !== 'paid') {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'failed', events: { create: { type: 'payment', fromValue: order.paymentStatus, toValue: 'failed', message: `Payment failed (${provider})` } } },
    });
  } else if (result.status === 'refunded') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: result.amount >= order.total ? 'refunded' : 'partially_refunded',
        events: { create: { type: 'payment', toValue: 'refunded', message: `Refund of ${result.amount} ${result.currency} via ${provider}` } },
      },
    });
  }
}

/** Ask the provider for the status of a pending online payment (fallback when webhooks lag or are not set up). */
export async function syncPayment(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.paymentMethod === 'cod' || order.paymentStatus === 'paid') return;
  const adapter = adapterFor(order.paymentMethod);
  if (!adapter?.sync || !adapter.isConfigured()) return;
  try {
    const result = await adapter.sync(order);
    if (result && result.status !== 'pending') await applyPaymentResult(order.id, adapter.id, result);
  } catch (err) {
    logger.warn({ err, order: order.number }, 'Payment sync failed');
  }
}

/* ───────────────────────────── Public views ───────────────────────────── */

export async function getPublicOrder(number: string, token: string): Promise<PublicOrder> {
  let order = await prisma.order.findFirst({ where: { number, token } });
  if (!order) throw notFound('Order');
  if (order.paymentStatus === 'pending' && order.paymentMethod !== 'cod') {
    await syncPayment(order.id);
    order = (await prisma.order.findUnique({ where: { id: order.id } }))!;
  }
  const full = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: true, pickupLocation: true, events: { where: { type: { in: ['created', 'status'] } }, orderBy: { createdAt: 'asc' } } },
  });
  return toPublicOrder(full);
}

function toPublicOrder(o: OrderFull): PublicOrder {
  return {
    number: o.number,
    status: o.status as OrderStatus,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod as PaymentMethod,
    fulfillment: o.fulfillment as Fulfillment,
    currency: o.currency,
    subtotal: o.subtotal,
    shipping: o.shipping,
    codFee: o.codFee,
    tax: o.tax,
    taxInclusive: o.taxInclusive,
    total: o.total,
    customerName: o.customerName,
    items: o.items.map((i) => ({ name: i.name, image: i.image, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    address: o.addressLine1
      ? { line1: o.addressLine1, line2: o.addressLine2, city: o.city ?? '', region: o.region, postalCode: o.postalCode, country: o.addressCountry ?? o.country }
      : null,
    pickupLocation: o.pickupLocation ? { name: o.pickupLocation.name, addressLine1: o.pickupLocation.addressLine1, city: o.pickupLocation.city } : null,
    createdAt: o.createdAt.toISOString(),
    timeline: o.events.map((e) => ({ status: e.toValue ?? e.type, at: e.createdAt.toISOString() })),
  };
}

export async function lookupOrder(number: string, phone: string) {
  const order = await prisma.order.findUnique({ where: { number: number.trim().toUpperCase() } });
  if (!order) throw notFound('Order');
  const normalized = normalizePhone(phone, order.addressCountry ?? order.country);
  if (!normalized || normalized !== order.customerPhone) throw notFound('Order');
  return { number: order.number, token: order.token };
}

/* ───────────────────────────── Admin operations ───────────────────────────── */

async function restock(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const i of items) {
    if (!i.productId) continue;
    const c = await tx.productCommerce.findUnique({ where: { productId: i.productId } });
    if (c?.trackStock) await tx.productCommerce.update({ where: { productId: i.productId }, data: { stock: { increment: i.quantity } } });
  }
}

export async function cancelOrder(orderId: string, reason: string, actor: { actorId: string | null; actorName: string | null } | null) {
  await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (o.status === 'cancelled') return;
    await restock(tx, orderId);
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        events: { create: { type: 'status', fromValue: o.status, toValue: 'cancelled', message: reason, ...eventActor(actor) } },
      },
    });
  });
}

export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
  note: string | undefined,
  actor: { actorId: string | null; actorName: string | null },
  notifyCustomer = true,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Order');
  if (!canTransition(ORDER_TRANSITIONS, order.status as OrderStatus, to)) {
    throw badRequest(`Cannot change status from ${order.status} to ${to}`, 'invalid_transition');
  }
  if (to === 'cancelled') {
    await cancelOrder(orderId, note || 'Cancelled by staff', actor);
  } else {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: to,
        ...(to === 'completed' || to === 'delivered' ? { completedAt: new Date() } : {}),
        // Cash on delivery is collected on hand-over.
        ...((to === 'delivered' || to === 'completed') && order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid'
          ? { paymentStatus: 'paid', paidAt: new Date() }
          : {}),
        ...(to === 'refunded' ? { paymentStatus: order.paymentStatus === 'paid' ? 'refunded' : order.paymentStatus } : {}),
        events: { create: { type: 'status', fromValue: order.status, toValue: to, message: note || null, ...eventActor(actor) } },
      },
    });
  }
  const commerce = await getCommerceSettings();
  if (notifyCustomer && commerce.emailCustomerOnStatusChange && order.customerEmail) void notifyStatus(orderId);
  return getAdminOrder(orderId);
}

export async function setPaymentStatus(orderId: string, to: 'paid' | 'unpaid' | 'refunded', note: string | undefined, actor: { actorId: string | null; actorName: string | null }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Order');
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: to,
      ...(to === 'paid' ? { paidAt: new Date() } : {}),
      events: { create: { type: 'payment', fromValue: order.paymentStatus, toValue: to, message: note || 'Updated manually', ...eventActor(actor) } },
    },
  });
  return getAdminOrder(orderId);
}

export async function refundOrder(orderId: string, amount: number | undefined, actor: { actorId: string | null; actorName: string | null }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw notFound('Order');
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') throw badRequest('Only paid orders can be refunded');
  const adapter = adapterFor(order.paymentMethod);
  const value = Math.min(amount ?? order.total, order.total);
  if (adapter?.refund && adapter.isConfigured()) {
    const result = await adapter.refund(order, value);
    await applyPaymentResult(order.id, adapter.id, { ...result, amount: value });
  } else {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: value >= order.total ? 'refunded' : 'partially_refunded',
        events: { create: { type: 'payment', toValue: 'refunded', message: `Refund of ${value} recorded manually (${order.paymentMethod})`, ...eventActor(actor) } },
      },
    });
  }
  return getAdminOrder(orderId);
}

export async function addOrderNote(orderId: string, message: string, actor: { actorId: string | null; actorName: string | null }) {
  await prisma.orderEvent.create({ data: { orderId, type: 'note', message, ...eventActor(actor) } });
  return getAdminOrder(orderId);
}

export async function getAdminOrder(id: string) {
  const o = await prisma.order.findUnique({
    where: { id },
    include: { items: true, pickupLocation: true, market: true, payments: { orderBy: { createdAt: 'asc' } }, events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!o) throw notFound('Order');
  return { ...o, allowedTransitions: ORDER_TRANSITIONS[o.status as OrderStatus] };
}

export async function listAdminOrders(f: {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  q?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.OrderWhereInput = {
    ...(f.status ? { status: { in: f.status.split(',') as any } } : {}),
    ...(f.paymentStatus ? { paymentStatus: { in: f.paymentStatus.split(',') as any } } : {}),
    ...(f.paymentMethod ? { paymentMethod: f.paymentMethod } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999Z`) } : {}) } } : {}),
    ...(f.q
      ? {
          OR: [
            { number: { contains: f.q, mode: 'insensitive' } },
            { customerName: { contains: f.q, mode: 'insensitive' } },
            { customerEmail: { contains: f.q, mode: 'insensitive' } },
            { customerPhone: { contains: f.q.replace(/[^\d+]/g, '') || f.q } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { _count: { select: { items: true } }, market: { select: { name: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

/** Cancels online orders that were never paid and returns their stock. Safe to run on several instances. */
export async function expireUnpaidOrders() {
  const rows = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(42001) AS locked`;
  if (!rows[0]?.locked) return 0;
  try {
    const { unpaidOrderTimeoutMinutes } = await getCommerceSettings();
    const cutoff = new Date(Date.now() - unpaidOrderTimeoutMinutes * 60_000);
    const stale = await prisma.order.findMany({
      where: { status: 'pending', paymentMethod: { not: 'cod' }, paymentStatus: { in: ['pending', 'failed'] }, createdAt: { lt: cutoff } },
      select: { id: true },
    });
    for (const o of stale) {
      await syncPayment(o.id);
      const fresh = await prisma.order.findUnique({ where: { id: o.id } });
      if (fresh?.paymentStatus !== 'paid') await cancelOrder(o.id, 'Payment not completed in time', null);
    }
    return stale.length;
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(42001)`;
  }
}

/* ───────────────────────────── Notifications ───────────────────────────── */

async function mailData(orderId: string): Promise<{ data: OrderMailData; brand: { name: string; accent: string; bg: string }; notify: string }> {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, pickupLocation: true } });
  const settings = await getPublicSettings();
  const base = (settings.site.url || env.WEB_URL).replace(/\/$/, '');
  return {
    brand: { name: settings.site.name, accent: settings.theme.colors.accent, bg: settings.theme.colors.bg },
    notify: settings.site.notificationEmail,
    data: {
      number: o.number,
      locale: o.locale,
      status: o.status as OrderStatus,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerEmail: o.customerEmail,
      currency: o.currency,
      subtotal: o.subtotal,
      shipping: o.shipping,
      codFee: o.codFee,
      tax: o.tax,
      taxInclusive: o.taxInclusive,
      total: o.total,
      paymentMethod: o.paymentMethod,
      fulfillment: o.fulfillment,
      address: o.addressLine1
        ? [o.addressLine1, o.addressLine2, [o.postalCode, o.city].filter(Boolean).join(' '), o.region, countryName(o.addressCountry ?? o.country, o.locale)].filter(Boolean).join(', ')
        : null,
      pickupLocation: o.pickupLocation ? `${o.pickupLocation.name}, ${o.pickupLocation.addressLine1}, ${o.pickupLocation.city}` : null,
      notes: o.notes,
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, lineTotal: i.lineTotal })),
      trackingUrl: `${base}${await localePath(o.locale, `/order/${o.number}?token=${o.token}`)}`,
      adminUrl: `${env.ADMIN_URL}/orders/${o.id}`,
    },
  };
}

async function notifyNewOrder(orderId: string) {
  try {
    const { data, brand, notify } = await mailData(orderId);
    if (data.customerEmail) {
      const sent = await sendMail({ to: data.customerEmail, ...orderConfirmationEmail(brand, data) });
      if (sent) await prisma.orderEvent.create({ data: { orderId, type: 'notification', message: `Confirmation e-mail sent to ${data.customerEmail}` } });
    }
    if (notify) await sendMail({ to: notify, ...newOrderAdminEmail(brand, data), replyTo: data.customerEmail ?? undefined });
  } catch (err) {
    logger.error({ err }, 'Order notification failed');
  }
}

async function notifyStatus(orderId: string) {
  try {
    const { data, brand } = await mailData(orderId);
    if (!data.customerEmail) return;
    const sent = await sendMail({ to: data.customerEmail, ...orderStatusEmail(brand, data) });
    if (sent) await prisma.orderEvent.create({ data: { orderId, type: 'notification', message: `Status e-mail (${data.status}) sent` } });
  } catch (err) {
    logger.error({ err }, 'Status notification failed');
  }
}
