'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { listCountries } from '@app/shared/i18n';
import { cx } from '@/lib/cx';
import { field, fieldLabel, fieldSelect } from './ui';
import { useSite } from '@/lib/site';

const noop = () => () => {};
/** false during SSR and hydration, true afterwards. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/**
 * Localized country picker (names via Intl.DisplayNames).
 * Node and the browser ship different ICU data (e.g. "Falkland Islands" vs "Falkland Islands (Islas Malvinas)"),
 * so names and their sort order differ between server and client. The server renders only the selected option;
 * the full list is rendered in the browser after hydration — no mismatch, and ~250 fewer options in the HTML.
 */
export function CountrySelect({
  value,
  onChange,
  label,
  id = 'country',
  className,
  required,
  hideLabel,
}: {
  value: string;
  onChange: (c: string) => void;
  label: string;
  id?: string;
  className?: string;
  required?: boolean;
  hideLabel?: boolean;
}) {
  const { locale } = useSite();
  const hydrated = useHydrated();
  const all = useMemo(() => listCountries(locale), [locale]);
  const countries = hydrated ? all : all.filter((c) => c.code === value);
  return (
    <label className={cx(field(), className)} htmlFor={id}>
      <span className={cx(fieldLabel, 'text-20', hideLabel && 'sr-only')}>{label}</span>
      <select id={id} className={fieldSelect} value={value} required={required} onChange={(e) => onChange(e.target.value)} autoComplete="country">
        {!value && <option value="">—</option>}
        {countries.map((c) => (
          <option key={c.code} value={c.code} suppressHydrationWarning>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
