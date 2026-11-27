import type { Catalog, Entry } from '../content/models';
import type { CheckoutInput, QuoteInput } from '../schemas/checkout';
import type { ReservationInput } from '../schemas/reservation';
import type { PublicSettings } from '../theme';
import type {
  ApiErrorBody,
  AvailabilityResponse,
  CreateOrderResponse,
  CreateReservationResponse,
  MarketResolution,
  PublicLocation,
  PublicOrder,
  PublicReservation,
  Quote,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ApiErrorBody['error']['details'],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  /** e.g. `http://localhost:4000` (server) or `''` (browser, same-origin proxy). */
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  /** Extra options merged into every fetch (e.g. Next.js `{ next: { revalidate, tags } }`). */
  init?: (path: string) => RequestInit & Record<string, unknown>;
}

/**
 * Typed client for the public REST API (`/api/v1`). No authentication needed — works in browsers,
 * Next.js server components, and React Native / Expo.
 */
export function createApiClient(opts: ApiClientOptions) {
  const f = opts.fetch ?? fetch;

  async function request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await f(`${opts.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...(opts.init?.(path) ?? {}),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = (json as ApiErrorBody | undefined)?.error;
      throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? res.statusText, err?.details);
    }
    return json as T;
  }

  const q = (params: Record<string, string | number | undefined | null>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
    const str = s.toString();
    return str ? `?${str}` : '';
  };

  return {
    request,
    settings: () => request<PublicSettings>('GET', '/settings'),
    singleton: <T>(type: string, locale: string) => request<T>('GET', `/content/${type}${q({ locale })}`),
    collection: <T>(type: string, locale: string) => request<Entry<T>[]>('GET', `/content/${type}/entries${q({ locale })}`),
    entry: <T>(type: string, slug: string, locale: string) =>
      request<Entry<T>>('GET', `/content/${type}/entries/${encodeURIComponent(slug)}${q({ locale })}`),
    catalog: (locale: string, country?: string) => request<Catalog>('GET', `/catalog${q({ locale, country })}`),
    market: (country?: string) => request<MarketResolution>('GET', `/markets/resolve${q({ country })}`),
    quote: (input: QuoteInput) => request<Quote>('POST', '/checkout/quote', input),
    /** `captchaToken`: bot-check token when `settings.captcha` is set (Cloudflare Turnstile). */
    createOrder: (input: CheckoutInput, idempotencyKey: string, captchaToken?: string) =>
      request<CreateOrderResponse>('POST', '/orders', input, { 'Idempotency-Key': idempotencyKey, ...(captchaToken ? { 'X-Captcha-Token': captchaToken } : {}) }),
    order: (number: string, token: string) => request<PublicOrder>('GET', `/orders/${encodeURIComponent(number)}${q({ token })}`),
    lookupOrder: (number: string, phone: string) =>
      request<{ number: string; token: string }>('POST', '/orders/lookup', { number, phone }),
    verifyRazorpay: (number: string, token: string, payload: Record<string, string>) =>
      request<PublicOrder>('POST', `/orders/${encodeURIComponent(number)}/razorpay/verify${q({ token })}`, payload),
    retryPayment: (number: string, token: string, paymentMethod: string) =>
      request<CreateOrderResponse>('POST', `/orders/${encodeURIComponent(number)}/pay${q({ token })}`, { paymentMethod }),
    locations: (purpose?: 'reservations' | 'pickup') => request<PublicLocation[]>('GET', `/locations${q({ purpose })}`),
    availability: (locationId: string, date: string, partySize: number) =>
      request<AvailabilityResponse>('GET', `/reservations/availability${q({ locationId, date, partySize })}`),
    createReservation: (input: ReservationInput, idempotencyKey: string, captchaToken?: string) =>
      request<CreateReservationResponse>('POST', '/reservations', input, { 'Idempotency-Key': idempotencyKey, ...(captchaToken ? { 'X-Captcha-Token': captchaToken } : {}) }),
    reservation: (code: string, token: string) =>
      request<PublicReservation>('GET', `/reservations/${encodeURIComponent(code)}${q({ token })}`),
    cancelReservation: (code: string, token: string) =>
      request<PublicReservation>('POST', `/reservations/${encodeURIComponent(code)}/cancel${q({ token })}`),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
