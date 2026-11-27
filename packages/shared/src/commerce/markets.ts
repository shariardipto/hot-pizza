import type { PriceRounding } from './money';
import { convertMinor } from './money';

export const PAYMENT_PROVIDERS = ['stripe', 'paypal', 'razorpay', 'sslcommerz'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentMethod = 'cod' | PaymentProvider;
export const PAYMENT_METHODS = ['cod', ...PAYMENT_PROVIDERS] as const satisfies readonly PaymentMethod[];

/**
 * Currencies PayPal accepts for checkout payments (https://developer.paypal.com/api/rest/reference/currency-codes/).
 * Not BDT; INR only works for India-registered PayPal accounts, so it is left out.
 */
export const PAYPAL_CURRENCIES = [
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'ILS', 'JPY', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'SEK', 'SGD', 'THB', 'TWD', 'USD',
] as const;

/** False when a gateway cannot take payments in this currency (it is then hidden at checkout). */
export function providerSupportsCurrency(provider: PaymentProvider, currency: string): boolean {
  if (provider === 'paypal') return (PAYPAL_CURRENCIES as readonly string[]).includes(currency.toUpperCase());
  return true;
}
export type Fulfillment = 'delivery' | 'pickup';

export const PAYMENT_PROVIDER_INFO: Record<PaymentProvider, { label: string; regions: string; description: string }> = {
  stripe: {
    label: 'Stripe',
    regions: 'US, UK, Canada, EU, Australia, Asia-Pacific and 40+ countries',
    description: 'Cards, Apple Pay, Google Pay and local methods via the Payment Element.',
  },
  paypal: {
    label: 'PayPal',
    regions: 'US, UK, Canada, EU, Australia and 200+ countries (not BDT or INR)',
    description: 'PayPal balance, Pay Later and cards, on PayPal’s secure page.',
  },
  razorpay: {
    label: 'Razorpay',
    regions: 'India',
    description: 'UPI, cards, net banking and wallets (INR).',
  },
  sslcommerz: {
    label: 'SSLCommerz',
    regions: 'Bangladesh',
    description: 'bKash, Nagad, Rocket, cards and internet banking (BDT).',
  },
};

/**
 * A market groups countries that share currency, pricing, taxes, shipping and payment rules.
 * Example: "Bangladesh" (BDT, COD on, SSLCommerz) vs "United States" (USD, COD off, Stripe).
 */
export interface Market {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  currency: string;
  /** ISO 3166-1 alpha-2 country codes. */
  countries: string[];
  /** Price list every other market converts from when it has no explicit price. */
  isDefault: boolean;
  /** Used for visitors from countries not assigned to any market ("Rest of world"). */
  isFallback: boolean;
  /** Multiplier from default-market currency to this market's currency. */
  exchangeRate: number;
  rounding: PriceRounding;
  /** Percent, e.g. 21 for 21 % VAT. */
  taxRate: number;
  taxInclusive: boolean;
  taxLabel: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  /** Flat delivery fee, minor units. */
  shippingFee: number;
  /** Free delivery from this subtotal (minor units). Null = never free. */
  freeShippingThreshold: number | null;
  /** Minimum order subtotal (minor units). */
  minOrderAmount: number | null;
  codEnabled: boolean;
  /** Extra fee for cash on delivery (minor units). */
  codFee: number;
  /** COD only for orders up to this total (minor units). Null = no limit. */
  codMaxAmount: number | null;
  /** Online payment providers enabled in this market. */
  paymentProviders: PaymentProvider[];
  sortOrder: number;
}

export function resolveMarket(markets: Market[], country?: string | null): Market | undefined {
  const enabled = markets.filter((m) => m.enabled);
  const cc = country?.toUpperCase();
  return (
    (cc ? enabled.find((m) => m.countries.includes(cc)) : undefined) ??
    enabled.find((m) => m.isFallback) ??
    enabled.find((m) => m.isDefault) ??
    enabled[0]
  );
}

export interface PriceRow {
  marketId: string;
  amount: number;
  compareAtAmount?: number | null;
}

/** Explicit market price, or converted from the default market's price. */
export function priceForMarket(
  prices: PriceRow[],
  market: Market,
  defaultMarket: Market | undefined,
): { amount: number; compareAtAmount: number | null } | null {
  const own = prices.find((p) => p.marketId === market.id);
  if (own) return { amount: own.amount, compareAtAmount: own.compareAtAmount ?? null };
  if (!defaultMarket || defaultMarket.id === market.id) return null;
  const base = prices.find((p) => p.marketId === defaultMarket.id);
  if (!base) return null;
  const conv = (v: number) => convertMinor(v, defaultMarket.currency, market.currency, market.exchangeRate, market.rounding);
  return { amount: conv(base.amount), compareAtAmount: base.compareAtAmount ? conv(base.compareAtAmount) : null };
}

export interface CartLine {
  unitPrice: number;
  quantity: number;
}

export interface Totals {
  currency: string;
  subtotal: number;
  shipping: number;
  codFee: number;
  tax: number;
  taxInclusive: boolean;
  total: number;
}

export function computeTotals(input: {
  lines: CartLine[];
  market: Market;
  fulfillment: Fulfillment;
  paymentMethod?: PaymentMethod | null;
}): Totals {
  const { market } = input;
  const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const shipping =
    input.fulfillment === 'pickup' || subtotal === 0
      ? 0
      : market.freeShippingThreshold !== null && subtotal >= market.freeShippingThreshold
        ? 0
        : market.shippingFee;
  const codFee = input.paymentMethod === 'cod' ? market.codFee : 0;
  const taxable = subtotal + shipping + codFee;
  const rate = market.taxRate / 100;
  let tax = 0;
  let total = taxable;
  if (rate > 0) {
    if (market.taxInclusive) tax = Math.round(taxable - taxable / (1 + rate));
    else {
      tax = Math.round(taxable * rate);
      total = taxable + tax;
    }
  }
  return { currency: market.currency, subtotal, shipping, codFee, tax, taxInclusive: market.taxInclusive, total };
}

export type CodUnavailableReason = 'market' | 'limit' | null;

export function codAvailability(market: Market, total: number): { available: boolean; reason: CodUnavailableReason } {
  if (!market.codEnabled) return { available: false, reason: 'market' };
  if (market.codMaxAmount !== null && total > market.codMaxAmount) return { available: false, reason: 'limit' };
  return { available: true, reason: null };
}

/**
 * Payment methods a visitor can choose. `configured` = providers that have server credentials.
 * Cash on delivery is offered only when the market allows it (e.g. BD/IN/Asia) and the order is under the COD limit.
 */
export function availablePaymentMethods(market: Market, configured: PaymentProvider[], total: number): PaymentMethod[] {
  const methods: PaymentMethod[] = market.paymentProviders.filter((p) => configured.includes(p) && providerSupportsCurrency(p, market.currency));
  if (codAvailability(market, total).available) methods.push('cod');
  return methods;
}
