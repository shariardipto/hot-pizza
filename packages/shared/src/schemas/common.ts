import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { z } from 'zod';

/** Validation error codes — the UI maps them to localized strings (`ui.error*`). */
export type ErrorCode = 'required' | 'phone' | 'email' | 'postal' | 'invalid';

export const countryCode = z
  .string()
  .length(2)
  .transform((v) => v.toUpperCase());

export const localeCode = z.string().min(2).max(12);

export function isValidPhone(phone: string, country?: string): boolean {
  try {
    return isValidPhoneNumber(phone, country?.toUpperCase() as CountryCode | undefined);
  } catch {
    return false;
  }
}

/** E.164 (+8801712345678) or null when invalid. */
export function normalizePhone(phone: string, country?: string): string | null {
  const parsed = parsePhoneNumberFromString(phone, country?.toUpperCase() as CountryCode | undefined);
  return parsed?.isValid() ? parsed.number : null;
}

export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

export const optionalEmail = z
  .union([z.literal(''), z.email({ message: 'email' }).max(200)])
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined));

export const personName = z.string().trim().min(2, { message: 'required' }).max(120);
export const phoneInput = z.string().trim().min(5, { message: 'phone' }).max(32);
