import type { PaymentAction } from '@app/shared/api';
import type { PaymentProvider } from '@app/shared/commerce';
import type { Prisma } from '../../db.ts';

export type OrderForPayment = Prisma.OrderGetPayload<{ include: { items: true } }>;

export interface PaymentResult {
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  providerRef: string;
  amount: number;
  currency: string;
  raw?: unknown;
}

export interface PaymentAdapter {
  id: PaymentProvider;
  label: string;
  isConfigured(): boolean;
  /** 'live' or a test mode, shown in Markets & payments. */
  mode(): 'live' | 'test' | 'sandbox';
  /** Notification endpoint (path under /api/v1/payments) and whether its secret is set, shown in Markets & payments. */
  webhook: { path: string; configured(): boolean };
  /** Create a payment session for the order and tell the client what to do next. */
  createPayment(order: OrderForPayment): Promise<{ action: PaymentAction; providerRef: string | null }>;
  /** Ask the provider for the current status (used when webhooks are delayed or not configured). */
  sync?(order: OrderForPayment): Promise<PaymentResult | null>;
  refund?(order: OrderForPayment, amount: number): Promise<PaymentResult>;
}
