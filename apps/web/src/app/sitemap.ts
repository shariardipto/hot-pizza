import type { MetadataRoute } from 'next';
import type { Entry, LegalContent } from '@app/shared/content';
import { api } from '@/lib/api';
import { siteOrigin } from '@/lib/seo';

// Rendered on request (data cached by the API client), so building the site never needs the API to be running.
export const dynamic = 'force-dynamic';

/** Every public page in every enabled language, with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await api.settings();
  const base = siteOrigin(settings.site.url);
  const def = settings.defaultLocale;
  const [catalog, legal] = await Promise.all([api.catalog(def), api.collection<LegalContent>('legal', def)]);
  const f = settings.features;
  const paths = [
    '/',
    '/products',
    '/about',
    '/contact',
    ...(f.locationsPage ? ['/locations'] : []),
    ...(f.reservations ? ['/reservations'] : []),
    ...catalog.products.map((p) => `/products/${p.slug}`),
    ...(legal as Entry<LegalContent>[]).map((l) => `/legal/${l.slug}`),
  ];
  const url = (code: string, p: string) => `${base}${code === def ? '' : `/${code}`}${p === '/' ? '' : p}` || `${base}/`;
  return paths.map((p) => ({
    url: url(def, p),
    changeFrequency: 'weekly',
    priority: p === '/' ? 1 : p.split('/').length > 2 ? 0.6 : 0.8,
    alternates: { languages: Object.fromEntries(settings.locales.map((l) => [l.code, url(l.code, p)])) },
  }));
}
