export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RESERVATION_STATUSES = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Allowed manual transitions in the admin (payment webhooks may move pending → confirmed automatically). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'ready', 'shipped', 'cancelled'],
  preparing: ['ready', 'shipped', 'cancelled'],
  ready: ['shipped', 'completed', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  shipped: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
};

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export function canTransition<T extends string>(map: Record<T, T[]>, from: T, to: T): boolean {
  return map[from]?.includes(to) ?? false;
}
