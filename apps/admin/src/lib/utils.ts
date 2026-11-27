import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatMoney } from '@app/shared/commerce';

export function cn(...v: ClassValue[]) {
  return twMerge(clsx(v));
}

export const money = (minor: number | null | undefined, currency: string) => (minor === null || minor === undefined ? '—' : formatMoney(minor, currency, 'en'));

export function dateTime(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', opts).format(new Date(d));
}

export function relative(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diff) < 60) return rtf.format(-Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
}

/** major-unit string ⇄ minor units for money inputs. */
export function toMinorInput(v: string, currency: string) {
  const exp = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10 ** exp) : 0;
}
export function fromMinorInput(v: number | null | undefined, currency: string) {
  if (v === null || v === undefined) return '';
  const exp = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return (v / 10 ** exp).toFixed(exp);
}
