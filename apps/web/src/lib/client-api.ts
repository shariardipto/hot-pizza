'use client';

import { ApiError, createApiClient } from '@app/shared/api';

/** Browser API client — same-origin (`/api/v1/*` is proxied to the API by next.config rewrites). */
export const clientApi = createApiClient({ baseUrl: '', init: () => ({ cache: 'no-store' }) });

export function newIdempotencyKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** API error codes that have their own (translatable) interface text; everything else shows the API message. */
const ERROR_TEXTS: Record<string, [key: string, fallback: string]> = {
  captcha_failed: ['errorCaptcha', 'We could not confirm you are human. Please try again.'],
  cod_limit: ['errorCodLimit', 'You already have open cash-on-delivery orders. Please wait until they are delivered, pay online or contact us.'],
  reservation_limit: ['errorReservationLimit', 'You already have several upcoming reservations. Please contact us to book more.'],
  customer_blocked: ['errorBlocked', 'We cannot accept this request online. Please contact us directly.'],
};

export function apiErrorText(err: unknown, t: (key: string, fallback?: string) => string): string {
  if (err instanceof ApiError) {
    const known = ERROR_TEXTS[err.code];
    return known ? t(known[0], known[1]) : err.message;
  }
  return t('errorGeneric', 'Something went wrong');
}
