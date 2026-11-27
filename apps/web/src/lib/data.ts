import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Catalog, GlobalsContent, UiStrings } from '@app/shared/content';
import type { PublicSettings } from '@app/shared/theme';
import { api } from './api';

export const getSettings = cache(() => api.settings());

/** Validates the [locale] segment against enabled languages. */
export const getLocale = cache(async (segment: string) => {
  const settings = await getSettings();
  const loc = settings.locales.find((l) => l.code === segment);
  if (!loc) notFound();
  return { settings, locale: loc.code, dir: loc.dir };
});

export const getGlobals = cache((locale: string) => api.singleton<GlobalsContent>('globals', locale));
export const getUi = cache((locale: string) => api.singleton<UiStrings>('ui', locale));

/** Visitor country: explicit choice (cookie) → CDN geo headers → Accept-Language region → default market. */
export const getCountry = cache(async (settings: PublicSettings): Promise<string> => {
  const c = (await cookies()).get('country')?.value;
  if (c && /^[A-Z]{2}$/.test(c)) return c;
  if (settings.features.geoDetection) {
    const h = await headers();
    const geo = h.get('x-vercel-ip-country') || h.get('cf-ipcountry') || h.get('cloudfront-viewer-country') || h.get('x-country-code');
    if (geo && /^[A-Z]{2}$/i.test(geo) && geo.toUpperCase() !== 'XX') return geo.toUpperCase();
    const al = h.get('accept-language')?.match(/[a-z]{2}-([A-Z]{2})/);
    if (al?.[1]) return al[1];
  }
  return '';
});

export const getCatalog = cache(async (locale: string, country: string): Promise<Catalog> => api.catalog(locale, country || undefined));
