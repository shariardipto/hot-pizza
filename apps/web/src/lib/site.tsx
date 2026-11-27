'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CatalogProduct, GlobalsContent, UiStrings } from '@app/shared/content';
import type { PublicSettings } from '@app/shared/theme';

export interface SiteValue {
  locale: string;
  settings: PublicSettings;
  globals: GlobalsContent;
  ui: UiStrings;
  /** Products (id, slug, image, type) — used by the showcase, product pages and the cart. */
  products: Pick<CatalogProduct, 'id' | 'slug' | 'data' | 'typeEntry' | 'flavorEntry'>[];
  /** Visitor country (from CDN / IP headers or cookie). */
  country: string;
}

const SiteContext = createContext<SiteValue | null>(null);

export function SiteProvider({ value, children }: { value: SiteValue; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteValue {
  const v = useContext(SiteContext);
  if (!v) throw new Error('useSite must be used inside <SiteProvider>');
  return v;
}

/** Interface strings with graceful fallback to the key. */
export function useT() {
  const { ui } = useSite();
  return useMemo(() => (key: string, fallback?: string) => ui[key] || fallback || key, [ui]);
}

/** Prefix a path with the locale segment (the default language has no prefix). */
export function localizePath(path: string, locale: string, defaultLocale: string) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}

export function useLocalePath() {
  const { locale, settings } = useSite();
  return (path: string) => localizePath(path, locale, settings.defaultLocale);
}
