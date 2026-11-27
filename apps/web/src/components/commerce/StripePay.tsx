'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useMemo, useState } from 'react';
import { useSite, useT } from '@/lib/site';
import { cx } from '@/lib/cx';
import { ctaChevron, fieldset, stripeBox } from './ui';

const cache = new Map<string, Promise<Stripe | null>>();
const getStripe = (key: string) => {
  if (!cache.has(key)) cache.set(key, loadStripe(key));
  return cache.get(key)!;
};

function PayForm({ returnUrl, onError }: { returnUrl: string; onError: (m: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={fieldset}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setBusy(true);
        const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
        // Only reached on immediate errors (card declined, validation) — success redirects.
        if (error) onError(error.message ?? t('errorGeneric', 'Payment failed'));
        setBusy(false);
      }}
    >
      <div className={stripeBox}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      <button className={cx(ctaChevron, 'text-35 uppercase')} disabled={!stripe || busy}>
        <span>{busy ? t('processing', 'Processing…') : t('payNow', 'Pay now')}</span>
      </button>
    </form>
  );
}

/** Stripe Payment Element (cards, Apple Pay, Google Pay, local methods) styled with the theme colors. */
export function StripePay({ clientSecret, publishableKey, returnUrl, onError }: { clientSecret: string; publishableKey: string; returnUrl: string; onError: (m: string) => void }) {
  const { settings, locale } = useSite();
  const c = settings.theme.colors;
  const stripePromise = useMemo(() => getStripe(publishableKey), [publishableKey]);
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        locale: locale as any,
        appearance: { theme: 'stripe', variables: { colorPrimary: c.accent, colorText: '#222', borderRadius: '12px', fontFamily: 'Helvetica, Arial, sans-serif' } },
      }}
    >
      <PayForm returnUrl={returnUrl} onError={onError} />
    </Elements>
  );
}
