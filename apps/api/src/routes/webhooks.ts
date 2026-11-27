import express, { Router, type Request, type Response } from 'express';
import type Stripe from 'stripe';
import { toMinor } from '@app/shared/commerce';
import { prisma } from '../db.ts';
import { env } from '../env.ts';
import { handler } from '../lib/http.ts';
import { logger } from '../lib/logger.ts';
import { applyPaymentResult } from '../modules/orders/service.ts';
import { capturePaypalOrder, captureResult, getPaypalCapture, verifyPaypalWebhook } from '../modules/payments/paypal.ts';
import { verifyWebhookSignature } from '../modules/payments/razorpay.ts';
import { sslcommerzAttemptsFailed, validateSslcommerz } from '../modules/payments/sslcommerz.ts';
import { constructStripeEvent, stripeIntentResult } from '../modules/payments/stripe.ts';
import { getDefaultLocale, getSetting } from '../modules/settings/service.ts';

/** Mounted BEFORE the JSON body parser: signature checks need the raw body. */
export const webhookRouter = Router();

/** Records the event id; returns false if it was already processed (provider retry). */
async function firstDelivery(id: string, provider: string, type: string, payload: unknown): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({ data: { id: `${provider}:${id}`, provider, type, payload: payload as any } });
    return true;
  } catch {
    return false;
  }
}

async function markProcessed(id: string, provider: string) {
  await prisma.webhookEvent.update({ where: { id: `${provider}:${id}` }, data: { processedAt: new Date() } }).catch(() => undefined);
}

/* ─────────────── Stripe ─────────────── */

webhookRouter.post(
  '/stripe/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  handler(async (req: Request, res: Response) => {
    if (!env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: { code: 'not_configured', message: 'Stripe webhook secret missing' } });
    let event: Stripe.Event;
    try {
      event = constructStripeEvent(req.body as Buffer, String(req.header('stripe-signature') ?? ''));
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Invalid Stripe signature');
      return res.status(400).json({ error: { code: 'invalid_signature', message: 'Invalid signature' } });
    }
    if (!(await firstDelivery(event.id, 'stripe', event.type, { id: event.id, type: event.type }))) return res.json({ received: true, duplicate: true });

    if (event.type.startsWith('payment_intent.')) {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.orderId;
      if (orderId) await applyPaymentResult(orderId, 'stripe', stripeIntentResult(pi));
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const order = await prisma.order.findFirst({ where: { paymentRef: String(charge.payment_intent) } });
      if (order) {
        await applyPaymentResult(order.id, 'stripe', {
          status: 'refunded',
          providerRef: String(charge.payment_intent),
          amount: charge.amount_refunded,
          currency: charge.currency.toUpperCase(),
        });
      }
    }
    await markProcessed(event.id, 'stripe');
    res.json({ received: true });
  }),
);

/* ─────────────── Razorpay ─────────────── */

webhookRouter.post(
  '/razorpay/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  handler(async (req: Request, res: Response) => {
    const raw = req.body as Buffer;
    if (!verifyWebhookSignature(raw, String(req.header('x-razorpay-signature') ?? ''))) {
      return res.status(400).json({ error: { code: 'invalid_signature', message: 'Invalid signature' } });
    }
    const event = JSON.parse(raw.toString('utf8')) as {
      event: string;
      payload: { payment?: { entity: { id: string; order_id: string; amount: number; currency: string; status: string } } };
    };
    const eventId = String(req.header('x-razorpay-event-id') ?? `${event.event}:${event.payload.payment?.entity.id}`);
    if (!(await firstDelivery(eventId, 'razorpay', event.event, { event: event.event }))) return res.json({ received: true, duplicate: true });
    const p = event.payload.payment?.entity;
    if (p) {
      const order = await prisma.order.findFirst({ where: { paymentRef: p.order_id } });
      if (order) {
        const status = event.event === 'payment.captured' || event.event === 'order.paid' ? 'succeeded' : event.event === 'payment.failed' ? 'failed' : null;
        if (status) await applyPaymentResult(order.id, 'razorpay', { status, providerRef: p.order_id, amount: p.amount, currency: p.currency, raw: { payment_id: p.id } });
      }
    }
    await markProcessed(eventId, 'razorpay');
    res.json({ received: true });
  }),
);

/* ─────────────── PayPal ─────────────── */

const paypalOrderFor = (paypalOrderId: string) =>
  paypalOrderId ? prisma.order.findFirst({ where: { paymentRef: paypalOrderId, paymentMethod: 'paypal' } }) : Promise.resolve(null);

/** The customer approved the payment on PayPal and is sent back here: capture it, then show the order page. */
webhookRouter.get(
  '/paypal/return',
  handler(async (req, res) => {
    const paypalOrderId = String(req.query.token ?? '');
    const order = await paypalOrderFor(paypalOrderId);
    let state = 'success';
    if (order && order.paymentStatus !== 'paid') {
      try {
        const result = await capturePaypalOrder(paypalOrderId);
        await applyPaymentResult(order.id, 'paypal', result);
        state = result.status === 'succeeded' ? 'success' : result.status === 'failed' ? 'failed' : 'pending';
      } catch (err) {
        // Temporary PayPal error: the order page keeps checking (sync) and the webhook can still capture it.
        logger.warn({ err: (err as Error).message, order: order.number }, 'PayPal capture failed on return');
        state = 'pending';
      }
    }
    res.redirect(303, await trackingUrl(order, order ? state : 'failed'));
  }),
);

webhookRouter.get(
  '/paypal/cancel',
  handler(async (req, res) => {
    res.redirect(303, await trackingUrl(await paypalOrderFor(String(req.query.token ?? '')), 'cancelled'));
  }),
);

webhookRouter.post(
  '/paypal/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  handler(async (req: Request, res: Response) => {
    if (!env.PAYPAL_WEBHOOK_ID) return res.status(503).json({ error: { code: 'not_configured', message: 'PayPal webhook id missing' } });
    const raw = req.body as Buffer;
    if (!(await verifyPaypalWebhook(req.headers, raw))) {
      logger.warn('Invalid PayPal webhook signature');
      return res.status(400).json({ error: { code: 'invalid_signature', message: 'Invalid signature' } });
    }
    const event = JSON.parse(raw.toString('utf8')) as {
      id: string;
      event_type: string;
      resource: { id: string; status?: string; amount?: { currency_code: string; value: string }; supplementary_data?: { related_ids?: { order_id?: string } }; links?: { href: string; rel: string }[] };
    };
    if (!(await firstDelivery(event.id, 'paypal', event.event_type, { id: event.id, type: event.event_type }))) return res.json({ received: true, duplicate: true });

    const r = event.resource;
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      // Customer approved but may never reach the return page.
      const order = await paypalOrderFor(r.id);
      if (order && order.paymentStatus !== 'paid') await applyPaymentResult(order.id, 'paypal', await capturePaypalOrder(r.id));
    } else if (/^PAYMENT\.CAPTURE\.(COMPLETED|DENIED|DECLINED|PENDING)$/.test(event.event_type)) {
      const paypalOrderId = r.supplementary_data?.related_ids?.order_id ?? '';
      const order = await paypalOrderFor(paypalOrderId);
      if (order && r.amount && r.status) {
        await applyPaymentResult(order.id, 'paypal', captureResult(paypalOrderId, { id: r.id, status: r.status, amount: r.amount }));
      }
    } else if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED' && r.amount) {
      // Refund made in the PayPal dashboard: find our order through the refunded capture.
      const captureUrl = r.links?.find((l) => l.rel === 'up')?.href;
      const capture = captureUrl ? await getPaypalCapture(captureUrl) : null;
      const paypalOrderId = capture?.supplementary_data?.related_ids?.order_id ?? '';
      const order = await paypalOrderFor(paypalOrderId);
      if (order && order.paymentStatus !== 'refunded') {
        await applyPaymentResult(order.id, 'paypal', {
          status: 'refunded',
          providerRef: paypalOrderId,
          amount: toMinor(Number(r.amount.value), r.amount.currency_code),
          currency: r.amount.currency_code,
          raw: { refund: r.id },
        });
      }
    }
    await markProcessed(event.id, 'paypal');
    res.json({ received: true });
  }),
);

/* ─────────────── SSLCommerz (form posts) ─────────────── */

const form = express.urlencoded({ extended: false, limit: '200kb' });

async function sslcommerzSettle(body: Record<string, string>) {
  const tranId = body.tran_id;
  const order = tranId ? await prisma.order.findUnique({ where: { number: tranId } }) : null;
  if (!order) return null;
  if (body.val_id) {
    const result = await validateSslcommerz(body.val_id);
    if (result.tranId === order.number) await applyPaymentResult(order.id, 'sslcommerz', result);
  }
  return order;
}

async function trackingUrl(order: { number: string; token: string; locale: string } | null, state: string) {
  const site = await getSetting('site');
  const base = (site.url || env.WEB_URL).replace(/\/$/, '');
  if (!order) return `${base}/`;
  const def = await getDefaultLocale();
  const prefix = order.locale === def ? '' : `/${order.locale}`;
  return `${base}${prefix}/order/${order.number}?token=${order.token}&payment=${state}`;
}

webhookRouter.post(
  '/sslcommerz/success',
  form,
  handler(async (req, res) => {
    const order = await sslcommerzSettle(req.body);
    res.redirect(303, await trackingUrl(order, 'success'));
  }),
);

webhookRouter.post(
  '/sslcommerz/fail',
  form,
  handler(async (req, res) => {
    const order = req.body.tran_id ? await prisma.order.findUnique({ where: { number: req.body.tran_id } }) : null;
    // This request comes through the customer's browser: only record the failure once SSLCommerz confirms it.
    if (order && order.paymentMethod === 'sslcommerz' && order.paymentStatus !== 'paid') {
      const confirmed = await sslcommerzAttemptsFailed(order.number).catch((err) => {
        logger.warn({ err: (err as Error).message, order: order.number }, 'SSLCommerz status check failed');
        return false;
      });
      if (confirmed) await applyPaymentResult(order.id, 'sslcommerz', { status: 'failed', providerRef: order.number, amount: 0, currency: order.currency });
    }
    res.redirect(303, await trackingUrl(order, 'failed'));
  }),
);

webhookRouter.post(
  '/sslcommerz/cancel',
  form,
  handler(async (req, res) => {
    const order = req.body.tran_id ? await prisma.order.findUnique({ where: { number: req.body.tran_id } }) : null;
    res.redirect(303, await trackingUrl(order, 'cancelled'));
  }),
);

webhookRouter.post(
  '/sslcommerz/ipn',
  form,
  handler(async (req, res) => {
    const id = String(req.body.val_id ?? req.body.tran_id ?? Date.now());
    if (await firstDelivery(id, 'sslcommerz', String(req.body.status ?? 'ipn'), { tran_id: req.body.tran_id, status: req.body.status })) {
      await sslcommerzSettle(req.body);
      await markProcessed(id, 'sslcommerz');
    }
    res.json({ received: true });
  }),
);
