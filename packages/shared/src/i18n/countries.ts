import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';

export interface CountryInfo {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
}

function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

const cache = new Map<string, CountryInfo[]>();

/** All countries, names localized with `Intl.DisplayNames`, sorted for the given locale. */
export function listCountries(locale = 'en'): CountryInfo[] {
  const hit = cache.get(locale);
  if (hit) return hit;
  let names: Intl.DisplayNames | undefined;
  try {
    names = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
  } catch {
    names = undefined;
  }
  const list = (getCountries() as string[])
    .map((code) => ({
      code,
      name: names?.of(code) ?? code,
      callingCode: `+${getCountryCallingCode(code as CountryCode)}`,
      flag: flagEmoji(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  cache.set(locale, list);
  return list;
}

export function countryName(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function isCountryCode(code: string): boolean {
  return (getCountries() as string[]).includes(code.toUpperCase());
}
