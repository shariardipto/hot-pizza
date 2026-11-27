'use client';

import type { PaymentAction } from '@app/shared/api';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (r: any) => void) => void };
  }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Razorpay could not be loaded'));
    document.head.appendChild(s);
  });
}

/** Opens Razorpay Checkout (UPI, cards, net banking, wallets) and resolves with the signed payment result. */
export async function openRazorpay(action: Extract<PaymentAction, { type: 'razorpay' }>, color: string): Promise<Record<string, string>> {
  await loadScript();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: action.keyId,
      order_id: action.orderId,
      amount: action.amount,
      currency: action.currency,
      name: action.name,
      prefill: action.prefill,
      theme: { color },
      handler: (resp: Record<string, string>) => resolve(resp),
      modal: { ondismiss: () => reject(new Error('dismissed')) },
    });
    rzp.on('payment.failed', (r: any) => reject(new Error(r?.error?.description ?? 'Payment failed')));
    rzp.open();
  });
}
