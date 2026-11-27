import 'server-only';
import type { Metadata } from 'next';
import type { Seo } from '@app/shared/content';
import { getSettings } from './data';
import { shareImageUrl } from './img';

/** Public origin of the website: Settings → Site → Public website URL, else WEB_URL from the environment. */
export const siteOrigin = (configured?: string | null) => (configured || process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Builds page metadata with canonical + hreflang alternates for every enabled language. */
export async function buildMetadata(locale: string, path: string, seo: Partial<Seo> | null | undefined, fallbackTitle?: string): Promise<Metadata> {
  const settings = await getSettings();
  const prefix = (code: string) => (code === settings.defaultLocale ? '' : `/${code}`);
  const clean = path === '/' ? '' : path;
  const languages: Record<string, string> = {};
  for (const l of settings.locales) languages[l.code] = `${prefix(l.code)}${clean}` || '/';
  languages['x-default'] = clean || '/';
  const title = seo?.metaTitle || (fallbackTitle ? `${fallbackTitle} — ${settings.site.titleSuffix}` : settings.site.name);
  const description = seo?.metaDescription || settings.site.defaultDescription;
  const uploaded = seo?.metaImage?.url || settings.site.defaultShareImage?.url;
  const image = uploaded ? shareImageUrl(uploaded) : '/social-card.png';
  return {
    title,
    description,
    alternates: { canonical: `${prefix(locale)}${clean}` || '/', languages },
    openGraph: { title, description, images: [image], locale },
  };
}
