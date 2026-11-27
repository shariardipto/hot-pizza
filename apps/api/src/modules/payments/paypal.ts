import crypto from 'node:crypto';
import { currencyExponent, fromMinor, providerSupportsCurrency, toMinor } from '@app/shared/commerce';
import { env } from '../../env.ts';
import { getSetting } from '../settings/service.ts';
import type { OrderForPayment, PaymentAdapter, PaymentResult } from './types.ts';

/**
 * PayPal Checkout (Orders API v2), redirect flow:
 *   1. createPayment → PayPal order → customer is sent to PayPal's approval page
 *   2. PayPal sends the customer back to /api/v1/payments/paypal/return?token=<PayPal order id>
 *   3. we capture the payment server-side and check the amount before marking the order paid
 * The webhook (CHECKOUT.ORDER.APPROVED / PAYMENT.CAPTURE.*) covers customers who close the browser before step 2,
 * and `sync` covers installs without a webhook.
 */

const base = () => env.PAYPAL_API_URL || (env.PAYPAL_SANDBOX ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com');

export class PaypalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issue: string | undefined,
  ) {
    super(message);
  }
}

let token: { value: string; expires: number } | null = null;
async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now()) return token.value;
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new PaypalError(`PayPal: ${json.error_description ?? 'authentication failed'}`, res.status, 'AUTH');
  token = { value: json.access_token, expires: Date.now() + ((json.expires_in ?? 300) - 60) * 1000 };
  return token.value;
}

async function call<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    body: typeof body === 'string' ? body : body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as any;
  if (!res.ok) {
    const issue = json?.details?.[0]?.issue ?? json?.name;
    throw new PaypalError(`PayPal: ${json?.details?.[0]?.description ?? json?.message ?? res.statusText}`, res.status, issue);
  }
  return json as T;
}

type Money = { currency_code: string; value: string };
type Capture = { id: string; status: string; amount: Money; supplementary_data?: { related_ids?: { order_id?: string } } };
export type PaypalOrder = {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  purchase_units?: { custom_id?: string; amount?: Money; payments?: { captures?: Capture[] } }[];
  links?: { href: string; rel: string }[];
};

/** PayPal wants major units as a string with the currency's number of decimals ("12.50", "1200" for JPY). */
const money = (minor: number, currency: string): Money => ({
  currency_code: currency,
  value: fromMinor(minor, currency).toFixed(currencyExponent(currency)),
});

/** Maps a PayPal capture to our payment result (amount in minor units). */
export function captureResult(paypalOrderId: string, capture: Capture): PaymentResult {
  const status =
    capture.status === 'COMPLETED' ? 'succeeded' : capture.status === 'DECLINED' || capture.status === 'FAILED' ? 'failed' : capture.status === 'REFUNDED' ? 'refunded' : 'pending';
  return {
    status,
    providerRef: paypalOrderId,
    amount: toMinor(Number(capture.amount.value), capture.amount.currency_code),
    currency: capture.amount.currency_code,
    raw: { captureId: capture.id, status: capture.status },
  };
}

function orderResult(o: PaypalOrder): PaymentResult | null {
  const capture = o.purchase_units?.[0]?.payments?.captures?.[0];
  if (capture) return captureResult(o.id, capture);
  if (o.status === 'VOIDED') return { status: 'failed', providerRef: o.id, amount: 0, currency: o.purchase_units?.[0]?.amount?.currency_code ?? '', raw: { status: o.status } };
  return null;
}

export const getPaypalOrder = (id: string) => call<PaypalOrder>('GET', `/v2/checkout/orders/${encodeURIComponent(id)}`);

/**
 * Captures an approved PayPal order. Safe to call twice (return page + webhook): the same request id
 * returns the first result, and an order captured elsewhere is read back instead.
 */
export async function capturePaypalOrder(id: string): Promise<PaymentResult> {
  try {
    const o = await call<PaypalOrder>('POST', `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, `capture-${id}`);
    return orderResult(o) ?? { status: 'pending', providerRef: id, amount: 0, currency: '', raw: { status: o.status } };
  } catch (err) {
    if (err instanceof PaypalError && err.issue === 'ORDER_ALREADY_CAPTURED') {
      const o = await getPaypalOrder(id);
      return orderResult(o) ?? { status: 'pending', providerRef: id, amount: 0, currency: '', raw: { status: o.status } };
    }
    // Card or bank refused: the customer can pay again from the order page.
    if (err instanceof PaypalError && (err.issue === 'INSTRUMENT_DECLINED' || err.issue === 'TRANSACTION_REFUSED')) {
      return { status: 'failed', providerRef: id, amount: 0, currency: '', raw: { issue: err.issue } };
    }
    throw err;
  }
}

/** Checks a webhook with PayPal's verification API. The raw body is passed through untouched. */
export async function verifyPaypalWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): Promise<boolean> {
  if (!env.PAYPAL_WEBHOOK_ID) return false;
  const h = (k: string) => String(headers[k] ?? '');
  const meta = {
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
  };
  if (!meta.transmission_id || !meta.transmission_sig) return false;
  const body = `${JSON.stringify(meta).slice(0, -1)},"webhook_event":${rawBody.toString('utf8')}}`;
  try {
    const r = await call<{ verification_status: string }>('POST', '/v1/notifications/verify-webhook-signature', body);
    return r.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}

function approveUrl(o: PaypalOrder): string | null {
  return o.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href ?? null;
}

export const paypalAdapter: PaymentAdapter = {
  id: 'paypal',
  label: 'PayPal',
  isConfigured: () => Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
  mode: () => (env.PAYPAL_SANDBOX ? 'sandbox' : 'live'),
  webhook: { path: '/paypal/webhook', configured: () => Boolean(env.PAYPAL_WEBHOOK_ID) },

  async createPayment(order: OrderForPayment) {
    if (!providerSupportsCurrency('paypal', order.currency)) throw new Error(`PayPal does not accept ${order.currency}`);
    const amount = money(order.total, order.currency);

    // Customer pays again: reuse the PayPal order if it is still open and the total has not changed.
    if (order.paymentRef) {
      const existing = await getPaypalOrder(order.paymentRef).catch(() => null);
      const unit = existing?.purchase_units?.[0];
      const url = existing && approveUrl(existing);
      if (url && (existing.status === 'CREATED' || existing.status === 'PAYER_ACTION_REQUIRED') && unit?.amount?.value === amount.value && unit.amount.currency_code === amount.currency_code) {
        return { action: { type: 'redirect', url }, providerRef: existing.id };
      }
    }

    const site = await getSetting('site');
    const callback = `${env.API_URL}/api/v1/payments/paypal`;
    const created = await call<PaypalOrder>(
      'POST',
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [{ reference_id: order.number, custom_id: order.id, description: `Order ${order.number}`, amount }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: site.name.slice(0, 127),
              // The address is already on the order: don't ask for it again on PayPal.
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: `${callback}/return`,
              cancel_url: `${callback}/cancel`,
            },
          },
        },
      },
      crypto.randomUUID(),
    );
    const url = approveUrl(created);
    if (!url) throw new Error('PayPal: no approval link returned');
    return { action: { type: 'redirect', url }, providerRef: created.id };
  },

  async sync(order) {
    if (!order.paymentRef) return null;
    const o = await getPaypalOrder(order.paymentRef);
    // Approved but never captured (customer closed the tab before coming back): capture now.
    if (o.status === 'APPROVED') return capturePaypalOrder(o.id);
    return orderResult(o);
  },

  async refund(order, amount) {
    if (!order.paymentRef) throw new Error('No PayPal payment to refund');
    const capture = (await getPaypalOrder(order.paymentRef)).purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture) throw new Error('This PayPal payment was never captured');
    const r = await call<{ id: string; status: string }>(
      'POST',
      `/v2/payments/captures/${encodeURIComponent(capture.id)}/refund`,
      { amount: money(amount, order.currency), note_to_payer: `Refund for order ${order.number}` },
      crypto.randomUUID(),
    );
    return { status: 'refunded', providerRef: order.paymentRef, amount, currency: order.currency, raw: { refund: r.id, status: r.status } };
  },
};

/** Reads a capture from a link in a webhook event (only the capture id is taken from the link). */
export async function getPaypalCapture(href: string): Promise<Capture | null> {
  const id = href.match(/\/v2\/payments\/captures\/([A-Za-z0-9-]+)/)?.[1];
  return id ? call<Capture>('GET', `/v2/payments/captures/${id}`) : null;
}
