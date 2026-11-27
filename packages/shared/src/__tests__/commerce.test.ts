import { describe, expect, it } from 'vitest';
import { availablePaymentMethods, providerSupportsCurrency, codAvailability, computeTotals, convertMinor, currencyExponent, formatMoney, priceForMarket, resolveMarket, toMinor, type Market } from '../commerce';
import { addressFormat } from '../i18n/address';
import { checkoutSchema } from '../schemas/checkout';

const base: Market = {
  id: 'eu',
  code: 'eu',
  name: 'EU',
  enabled: true,
  currency: 'EUR',
  countries: ['ES', 'FR'],
  isDefault: true,
  isFallback: false,
  exchangeRate: 1,
  rounding: 'none',
  taxRate: 10,
  taxInclusive: true,
  taxLabel: 'VAT',
  deliveryEnabled: true,
  pickupEnabled: true,
  shippingFee: 495,
  freeShippingThreshold: 4000,
  minOrderAmount: null,
  codEnabled: false,
  codFee: 0,
  codMaxAmount: null,
  paymentProviders: ['stripe'],
  sortOrder: 1,
};
const bd: Market = { ...base, id: 'bd', code: 'bd', currency: 'BDT', countries: ['BD'], isDefault: false, exchangeRate: 130, rounding: 'whole', taxRate: 0, shippingFee: 12000, freeShippingThreshold: 500000, codEnabled: true, codFee: 0, codMaxAmount: 2000000, paymentProviders: ['sslcommerz'] };
const us: Market = { ...base, id: 'us', code: 'us', currency: 'USD', countries: ['US'], isDefault: false, exchangeRate: 1.08, rounding: 'x99', taxRate: 8, taxInclusive: false, shippingFee: 995, freeShippingThreshold: 6000 };
const world: Market = { ...base, id: 'world', code: 'world', currency: 'USD', countries: [], isDefault: false, isFallback: true, exchangeRate: 1.08 };
const markets = [base, bd, us, world];

describe('money', () => {
  it('knows currency decimals', () => {
    expect(currencyExponent('EUR')).toBe(2);
    expect(currencyExponent('JPY')).toBe(0);
    expect(toMinor(6.95, 'EUR')).toBe(695);
    expect(toMinor(1500, 'JPY')).toBe(1500);
  });
  it('converts with rounding rules', () => {
    expect(convertMinor(695, 'EUR', 'BDT', 130, 'whole')).toBe(90400); // ৳903.5 → ৳904
    expect(convertMinor(695, 'EUR', 'USD', 1.08, 'x99')).toBe(799); // $7.506 → $7.99
    expect(convertMinor(695, 'EUR', 'USD', 1.08, 'none')).toBe(751);
  });
  it('formats', () => {
    expect(formatMoney(695, 'EUR', 'en')).toContain('6.95');
    expect(formatMoney(90400, 'BDT', 'en')).toContain('904');
  });
});

describe('markets', () => {
  it('resolves by country with fallback', () => {
    expect(resolveMarket(markets, 'BD')?.id).toBe('bd');
    expect(resolveMarket(markets, 'es')?.id).toBe('eu');
    expect(resolveMarket(markets, 'JP')?.id).toBe('world');
  });
  it('uses explicit prices, else converts from the default market', () => {
    const prices = [{ marketId: 'eu', amount: 695 }];
    expect(priceForMarket(prices, base, base)?.amount).toBe(695);
    expect(priceForMarket(prices, bd, base)?.amount).toBe(90400);
    expect(priceForMarket([...prices, { marketId: 'bd', amount: 85000 }], bd, base)?.amount).toBe(85000);
    expect(priceForMarket([], bd, base)).toBeNull();
  });
});

describe('cash on delivery rules', () => {
  it('is never offered in markets without COD (US/UK/CA)', () => {
    expect(codAvailability(us, 1000).available).toBe(false);
    expect(availablePaymentMethods(us, ['stripe'], 1000)).toEqual(['stripe']);
  });
  it('is offered in BD up to the limit', () => {
    expect(availablePaymentMethods(bd, ['sslcommerz'], 100000)).toEqual(['sslcommerz', 'cod']);
    expect(codAvailability(bd, 3000000)).toEqual({ available: false, reason: 'limit' });
  });
  it('hides gateways without credentials', () => {
    expect(availablePaymentMethods(bd, [], 100000)).toEqual(['cod']);
  });
});

describe('PayPal', () => {
  it('is offered where PayPal accepts the currency', () => {
    expect(availablePaymentMethods({ ...us, paymentProviders: ['stripe', 'paypal'] }, ['stripe', 'paypal'], 1000)).toEqual(['stripe', 'paypal']);
  });
  it('is hidden in BDT and INR markets even when switched on', () => {
    expect(providerSupportsCurrency('paypal', 'BDT')).toBe(false);
    expect(providerSupportsCurrency('paypal', 'INR')).toBe(false);
    expect(availablePaymentMethods({ ...bd, paymentProviders: ['sslcommerz', 'paypal'] }, ['sslcommerz', 'paypal'], 100000)).toEqual(['sslcommerz', 'cod']);
  });
});

describe('totals', () => {
  it('tax-inclusive market with free shipping threshold', () => {
    const t = computeTotals({ lines: [{ unitPrice: 695, quantity: 2 }], market: base, fulfillment: 'delivery' });
    expect(t.subtotal).toBe(1390);
    expect(t.shipping).toBe(495);
    expect(t.total).toBe(1885);
    expect(t.tax).toBe(Math.round(1885 - 1885 / 1.1));
    const free = computeTotals({ lines: [{ unitPrice: 695, quantity: 6 }], market: base, fulfillment: 'delivery' });
    expect(free.shipping).toBe(0);
  });
  it('tax-exclusive market adds tax on top', () => {
    const t = computeTotals({ lines: [{ unitPrice: 1000, quantity: 1 }], market: us, fulfillment: 'delivery' });
    expect(t.tax).toBe(Math.round((1000 + 995) * 0.08));
    expect(t.total).toBe(1000 + 995 + t.tax);
  });
  it('pick-up has no delivery fee; COD adds its fee', () => {
    expect(computeTotals({ lines: [{ unitPrice: 1000, quantity: 1 }], market: base, fulfillment: 'pickup' }).shipping).toBe(0);
    const t = computeTotals({ lines: [{ unitPrice: 1000, quantity: 1 }], market: { ...bd, codFee: 5000 }, fulfillment: 'delivery', paymentMethod: 'cod' });
    expect(t.codFee).toBe(5000);
  });
});

describe('international checkout validation', () => {
  const valid = {
    country: 'US',
    locale: 'en',
    items: [{ productId: 'p1', quantity: 1 }],
    customer: { name: 'Jane Doe', phone: '+1 212 555 0123' },
    fulfillment: 'delivery',
    address: { line1: '1 Main St', city: 'New York', region: 'NY', postalCode: '10001', country: 'US' },
    paymentMethod: 'stripe',
    acceptTerms: true,
  };
  it('accepts a valid US order', () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });
  it('requires the US state and a valid ZIP', () => {
    const r = checkoutSchema.safeParse({ ...valid, address: { ...valid.address, region: '', postalCode: 'ABC' } });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('address.region');
    expect(paths).toContain('address.postalCode');
  });
  it('validates local Bangladeshi numbers against the delivery country', () => {
    const bdOrder = { ...valid, country: 'BD', customer: { name: 'Rahim', phone: '01712345678' }, address: { line1: 'House 12, Road 5', city: 'Dhaka', region: 'Dhaka', postalCode: '1212', country: 'BD' }, paymentMethod: 'cod' };
    expect(checkoutSchema.safeParse(bdOrder).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...bdOrder, customer: { name: 'Rahim', phone: '12345' } }).success).toBe(false);
  });
  it('knows postal formats', () => {
    expect(addressFormat('GB').postalPattern!.test('SW1A 1AA')).toBe(true);
    expect(addressFormat('IN').postalPattern!.test('110001')).toBe(true);
    expect(addressFormat('CA').postalPattern!.test('K1A 0B1')).toBe(true);
    expect(addressFormat('AE').postal).toBeNull();
  });
});
