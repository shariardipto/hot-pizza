import Stripe from 'stripe';
import { env } from '../../env.ts';
import type { OrderForPayment, PaymentAdapter, PaymentResult } from './types.ts';

let client: Stripe | null = null;
export function stripeClient(): Stripe {
  client ??= new Stripe(env.STRIPE_SECRET_KEY, { appInfo: { name: 'resturant-app' } });
  return client;
}

function toResult(pi: Stripe.PaymentIntent): PaymentResult {
  const status =
    pi.status === 'succeeded'
      ? 'succeeded'
      : pi.status === 'canceled' || pi.last_payment_error
        ? 'failed'
        : 'pending';
  return { status, providerRef: pi.id, amount: pi.amount_received || pi.amount, currency: pi.currency.toUpperCase(), raw: { id: pi.id, status: pi.status } };
}

export const stripeAdapter: PaymentAdapter = {
  id: 'stripe',
  label: 'Stripe',
  isConfigured: () => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY),
  mode: () => (env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live' : 'test'),
  webhook: { path: '/stripe/webhook', configured: () => Boolean(env.STRIPE_WEBHOOK_SECRET) },

  async createPayment(order: OrderForPayment) {
    const stripe = stripeClient();
    // Reuse an open intent when the customer retries payment.
    if (order.paymentRef?.startsWith('pi_')) {
      const existing = await stripe.paymentIntents.retrieve(order.paymentRef);
      if (existing.status !== 'canceled' && existing.status !== 'succeeded' && existing.amount === order.total) {
        return {
          action: { type: 'stripe', clientSecret: existing.client_secret!, publishableKey: env.STRIPE_PUBLISHABLE_KEY },
          providerRef: existing.id,
        };
      }
    }
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.total,
        currency: order.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        description: `Order ${order.number}`,
        receipt_email: order.customerEmail ?? undefined,
        metadata: { orderId: order.id, orderNumber: order.number },
        shipping:
          order.fulfillment === 'delivery' && order.addressLine1
            ? {
                name: order.customerName,
                phone: order.customerPhone,
                address: {
                  line1: order.addressLine1,
                  line2: order.addressLine2 ?? undefined,
                  city: order.city ?? undefined,
                  state: order.region ?? undefined,
                  postal_code: order.postalCode ?? undefined,
                  country: order.addressCountry ?? undefined,
                },
              }
            : undefined,
      },
      { idempotencyKey: `order_${order.id}_${order.total}` },
    );
    return {
      action: { type: 'stripe', clientSecret: intent.client_secret!, publishableKey: env.STRIPE_PUBLISHABLE_KEY },
      providerRef: intent.id,
    };
  },

  async sync(order) {
    if (!order.paymentRef?.startsWith('pi_')) return null;
    return toResult(await stripeClient().paymentIntents.retrieve(order.paymentRef));
  },

  async refund(order, amount) {
    if (!order.paymentRef) throw new Error('No Stripe payment to refund');
    const r = await stripeClient().refunds.create({ payment_intent: order.paymentRef, amount });
    return { status: 'refunded', providerRef: order.paymentRef, amount: r.amount, currency: r.currency.toUpperCase(), raw: { refund: r.id } };
  },
};

export function constructStripeEvent(rawBody: Buffer, signature: string): Stripe.Event {
  return stripeClient().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

export { toResult as stripeIntentResult };
