import { fromMinor } from '@app/shared/commerce';
import { env } from '../../env.ts';
import type { OrderForPayment, PaymentAdapter, PaymentResult } from './types.ts';

const base = () => (env.SSLCOMMERZ_SANDBOX ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com');

/**
 * SSLCommerz hosted payment page (Bangladesh: bKash, Nagad, Rocket, cards, net banking).
 * Flow: init session → redirect to GatewayPageURL → SSLCommerz POSTs back to our success/fail/cancel/IPN
 * endpoints → we validate the `val_id` server-side before marking the order paid.
 */
export const sslcommerzAdapter: PaymentAdapter = {
  id: 'sslcommerz',
  label: 'SSLCommerz',
  isConfigured: () => Boolean(env.SSLCOMMERZ_STORE_ID && env.SSLCOMMERZ_STORE_PASSWORD),
  mode: () => (env.SSLCOMMERZ_SANDBOX ? 'sandbox' : 'live'),
  // IPN calls are checked with SSLCommerz's validation API, so there is no secret to set.
  webhook: { path: '/sslcommerz/ipn', configured: () => true },

  async createPayment(order: OrderForPayment) {
    const cb = `${env.API_URL}/api/v1/payments/sslcommerz`;
    const form = new URLSearchParams({
      store_id: env.SSLCOMMERZ_STORE_ID,
      store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
      total_amount: fromMinor(order.total, order.currency).toFixed(2),
      currency: order.currency,
      tran_id: order.number,
      success_url: `${cb}/success`,
      fail_url: `${cb}/fail`,
      cancel_url: `${cb}/cancel`,
      ipn_url: `${cb}/ipn`,
      cus_name: order.customerName,
      cus_email: order.customerEmail ?? 'customer@example.com',
      cus_phone: order.customerPhone,
      cus_add1: order.addressLine1 ?? 'N/A',
      cus_city: order.city ?? 'N/A',
      cus_postcode: order.postalCode ?? '0000',
      cus_country: order.addressCountry ?? order.country,
      shipping_method: order.fulfillment === 'delivery' ? 'Courier' : 'NO',
      ship_name: order.customerName,
      ship_add1: order.addressLine1 ?? 'N/A',
      ship_city: order.city ?? 'N/A',
      ship_postcode: order.postalCode ?? '0000',
      ship_country: order.addressCountry ?? order.country,
      num_of_item: String(order.items.length),
      product_name: order.items.map((i) => i.name).join(', ').slice(0, 250),
      product_category: 'food',
      product_profile: 'physical-goods',
      value_a: order.id,
    });
    const res = await fetch(`${base()}/gwprocess/v4/api.php`, { method: 'POST', body: form, signal: AbortSignal.timeout(20000) });
    const json = (await res.json()) as { status: string; GatewayPageURL?: string; sessionkey?: string; failedreason?: string };
    if (json.status !== 'SUCCESS' || !json.GatewayPageURL) throw new Error(`SSLCommerz: ${json.failedreason ?? 'session failed'}`);
    return { action: { type: 'redirect', url: json.GatewayPageURL }, providerRef: order.number };
  },
};

/** Server-to-server validation of a completed SSLCommerz transaction. */
export async function validateSslcommerz(valId: string): Promise<PaymentResult & { tranId: string }> {
  const url = new URL(`${base()}/validator/api/validationserverAPI.php`);
  url.search = new URLSearchParams({
    val_id: valId,
    store_id: env.SSLCOMMERZ_STORE_ID,
    store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
    format: 'json',
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const j = (await res.json()) as { status: string; tran_id: string; amount: string; currency_type?: string; currency: string; bank_tran_id?: string };
  const ok = j.status === 'VALID' || j.status === 'VALIDATED';
  const currency = (j.currency_type ?? j.currency ?? 'BDT').toUpperCase();
  return {
    status: ok ? 'succeeded' : 'failed',
    providerRef: valId,
    tranId: j.tran_id,
    amount: Math.round(Number(j.amount) * 100),
    currency,
    raw: { status: j.status, bank_tran_id: j.bank_tran_id },
  };
}

/**
 * Asks SSLCommerz for every attempt made for an order (its tran_id). Used to confirm a "fail" callback,
 * which arrives through the customer's browser and could otherwise be faked.
 */
export async function sslcommerzAttemptsFailed(tranId: string): Promise<boolean> {
  const url = new URL(`${base()}/validator/api/merchantTransIDvalidationAPI.php`);
  url.search = new URLSearchParams({
    tran_id: tranId,
    store_id: env.SSLCOMMERZ_STORE_ID,
    store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
    format: 'json',
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const j = (await res.json()) as { APIConnect?: string; element?: { status?: string }[] };
  const statuses = (j.element ?? []).map((e) => String(e.status ?? '').toUpperCase());
  return j.APIConnect === 'DONE' && statuses.includes('FAILED') && !statuses.some((s) => s === 'VALID' || s === 'VALIDATED');
}
