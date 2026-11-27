/** Money is always handled as integer minor units (cents, paisa, …) + ISO 4217 currency code. */

const exponentCache = new Map<string, number>();

/** Number of decimals a currency uses (EUR → 2, JPY → 0, BHD → 3). */
export function currencyExponent(currency: string): number {
  const code = currency.toUpperCase();
  let exp = exponentCache.get(code);
  if (exp === undefined) {
    try {
      exp = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      exp = 2;
    }
    exponentCache.set(code, exp);
  }
  return exp;
}

export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyExponent(currency));
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** currencyExponent(currency);
}

/** Always shows the currency's decimals (€19.00, not €19) so amounts line up in totals. */
export function formatMoney(minor: number, currency: string, locale = 'en'): string {
  const exp = currencyExponent(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(fromMinor(minor, currency));
  } catch {
    return `${fromMinor(minor, currency).toFixed(exp)} ${currency}`;
  }
}

export type PriceRounding = 'none' | 'whole' | 'x99';

/** Convert an amount between currencies with an explicit rate and apply a pricing rounding rule. */
export function convertMinor(
  minor: number,
  from: string,
  to: string,
  rate: number,
  rounding: PriceRounding = 'none',
): number {
  const major = fromMinor(minor, from) * rate;
  const exp = currencyExponent(to);
  let rounded: number;
  switch (rounding) {
    case 'whole':
      rounded = Math.round(major);
      break;
    case 'x99':
      rounded = exp > 0 ? Math.max(Math.ceil(major) - 1 / 10 ** exp, 0) : Math.round(major);
      break;
    default:
      rounded = major;
  }
  return toMinor(rounded, to);
}
