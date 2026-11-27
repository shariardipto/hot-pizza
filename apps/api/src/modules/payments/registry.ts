import { PAYMENT_PROVIDERS, type PaymentProvider } from '@app/shared/commerce';
import { paypalAdapter } from './paypal.ts';
import { razorpayAdapter } from './razorpay.ts';
import { sslcommerzAdapter } from './sslcommerz.ts';
import { stripeAdapter } from './stripe.ts';
import type { PaymentAdapter } from './types.ts';

export const adapters: Record<PaymentProvider, PaymentAdapter> = {
  stripe: stripeAdapter,
  paypal: paypalAdapter,
  razorpay: razorpayAdapter,
  sslcommerz: sslcommerzAdapter,
};

/** Providers with credentials in the environment. */
export function configuredProviders(): PaymentProvider[] {
  return PAYMENT_PROVIDERS.filter((p) => adapters[p].isConfigured());
}

export function adapterFor(method: string): PaymentAdapter | null {
  return (adapters as Record<string, PaymentAdapter>)[method] ?? null;
}
