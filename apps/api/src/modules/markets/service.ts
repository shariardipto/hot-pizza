import {
  availablePaymentMethods,
  PAYMENT_PROVIDERS,
  resolveMarket,
  type Market,
  type PaymentProvider,
  type PriceRounding,
} from '@app/shared/commerce';
import type { PublicMarket } from '@app/shared/api';
import { prisma, type Market as MarketRow } from '../../db.ts';
import { configuredProviders } from '../payments/registry.ts';

export function toMarket(m: MarketRow): Market {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    enabled: m.enabled,
    currency: m.currency,
    countries: m.countries,
    isDefault: m.isDefault,
    isFallback: m.isFallback,
    exchangeRate: m.exchangeRate,
    rounding: (m.rounding as PriceRounding) ?? 'none',
    taxRate: m.taxRate,
    taxInclusive: m.taxInclusive,
    taxLabel: m.taxLabel,
    deliveryEnabled: m.deliveryEnabled,
    pickupEnabled: m.pickupEnabled,
    shippingFee: m.shippingFee,
    freeShippingThreshold: m.freeShippingThreshold,
    minOrderAmount: m.minOrderAmount,
    codEnabled: m.codEnabled,
    codFee: m.codFee,
    codMaxAmount: m.codMaxAmount,
    paymentProviders: m.paymentProviders.filter((p): p is PaymentProvider => (PAYMENT_PROVIDERS as readonly string[]).includes(p)),
    sortOrder: m.sortOrder,
  };
}

let cache: { at: number; markets: Market[] } | null = null;

export async function listMarkets(): Promise<Market[]> {
  if (cache && Date.now() - cache.at < 15_000) return cache.markets;
  const rows = await prisma.market.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  cache = { at: Date.now(), markets: rows.map(toMarket) };
  return cache.markets;
}

export function invalidateMarkets() {
  cache = null;
}

export async function marketForCountry(country?: string | null) {
  const markets = await listMarkets();
  const market = resolveMarket(markets, country);
  const defaultMarket = markets.find((m) => m.isDefault && m.enabled) ?? markets.find((m) => m.isDefault);
  return { market, defaultMarket, markets };
}

export function publicMarket(m: Market, total = 0): PublicMarket {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    currency: m.currency,
    countries: m.countries,
    taxRate: m.taxRate,
    taxInclusive: m.taxInclusive,
    taxLabel: m.taxLabel,
    deliveryEnabled: m.deliveryEnabled,
    pickupEnabled: m.pickupEnabled,
    shippingFee: m.shippingFee,
    freeShippingThreshold: m.freeShippingThreshold,
    minOrderAmount: m.minOrderAmount,
    codEnabled: m.codEnabled,
    codFee: m.codFee,
    codMaxAmount: m.codMaxAmount,
    paymentMethods: availablePaymentMethods(m, configuredProviders(), total),
  };
}
