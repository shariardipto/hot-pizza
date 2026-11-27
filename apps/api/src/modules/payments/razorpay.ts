import crypto from 'node:crypto';
import { env } from '../../env.ts';
import type { OrderForPayment, PaymentAdapter, PaymentResult } from './types.ts';

const API = 'https://api.razorpay.com/v1';

function authHeader() {
  return `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`Razorpay: ${json?.error?.description ?? res.statusText}`);
  return json as T;
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Verifies the signature returned by Razorpay Checkout to the browser. */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

export const razorpayAdapter: PaymentAdapter = {
  id: 'razorpay',
  label: 'Razorpay',
  isConfigured: () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  mode: () => (env.RAZORPAY_KEY_ID.startsWith('rzp_live') ? 'live' : 'test'),
  webhook: { path: '/razorpay/webhook', configured: () => Boolean(env.RAZORPAY_WEBHOOK_SECRET) },

  async createPayment(order: OrderForPayment) {
    let rzpOrderId = order.paymentRef?.startsWith('order_') ? order.paymentRef : null;
    if (!rzpOrderId) {
      const created = await call<{ id: string }>('POST', '/orders', {
        amount: order.total,
        currency: order.currency,
        receipt: order.number,
        notes: { orderId: order.id, orderNumber: order.number },
      });
      rzpOrderId = created.id;
    }
    return {
      providerRef: rzpOrderId,
      action: {
        type: 'razorpay',
        keyId: env.RAZORPAY_KEY_ID,
        orderId: rzpOrderId,
        amount: order.total,
        currency: order.currency,
        name: `Order ${order.number}`,
        prefill: { name: order.customerName, contact: order.customerPhone, email: order.customerEmail ?? undefined },
      },
    };
  },

  async sync(order): Promise<PaymentResult | null> {
    if (!order.paymentRef?.startsWith('order_')) return null;
    const o = await call<{ id: string; status: string; amount_paid: number; currency: string }>('GET', `/orders/${order.paymentRef}`);
    return {
      status: o.status === 'paid' ? 'succeeded' : 'pending',
      providerRef: o.id,
      amount: o.amount_paid,
      currency: o.currency,
      raw: { status: o.status },
    };
  },
};

