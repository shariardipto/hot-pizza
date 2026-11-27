import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { themeToCss } from '@app/shared/theme';
import { AppShell } from '@/components/layout/AppShell';
import { getCatalog, getCountry, getGlobals, getLocale, getSettings, getUi } from '@/lib/data';
import { faviconUrl, shareImageUrl } from '@/lib/img';
import { siteOrigin } from '@/lib/seo';
import { SiteProvider } from '@/lib/site';
import '@/styles/tailwind.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const settings = await getSettings();
  const base = siteOrigin(settings.site.url);
  const favicon = settings.theme.favicon?.url ? faviconUrl(settings.theme.favicon.url) : '/favicon.png';
  return {
    metadataBase: new URL(base),
    title: { default: settings.site.name, template: `%s` },
    description: settings.site.defaultDescription,
    applicationName: settings.site.name,
    icons: { icon: favicon, shortcut: favicon, apple: '/icons/icon_512x512.00e55d.png' },
    manifest: '/manifest.webmanifest',
    openGraph: {
      type: 'website',
      siteName: settings.site.name,
      locale,
      images: settings.site.defaultShareImage ? [shareImageUrl(settings.site.defaultShareImage.url)] : ['/social-card.png'],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#d70321' };

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: segment } = await params;
  const { settings, locale, dir } = await getLocale(segment);
  const country = await getCountry(settings);
  const [globals, uiStrings, catalog] = await Promise.all([getGlobals(locale), getUi(locale), getCatalog(locale, country)]);
  const { theme } = settings;
  // Per-request CSP nonce set by proxy.ts (Next adds it to its own scripts automatically).
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang={locale} dir={dir}>
      <head>
        {[theme.fonts.display.woff2, theme.fonts.regular.woff2].filter(Boolean).map((href) => (
          <link key={href} rel="preload" href={href!} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
        <style id="theme-vars" dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
        {theme.customCss ? <style id="theme-custom" dangerouslySetInnerHTML={{ __html: theme.customCss }} /> : null}
        {settings.site.analyticsHead ? <script nonce={nonce} dangerouslySetInnerHTML={{ __html: settings.site.analyticsHead }} /> : null}
      </head>
      {/* Page defaults (were element styles on <body> in the original CSS) */}
      <body className="overflow-x-hidden overscroll-x-contain bg-bg font-base text-base text-accent selection:bg-secondary selection:text-accent [&::-webkit-scrollbar]:hidden">
        <SiteProvider
          value={{
            locale,
            settings,
            globals,
            ui: uiStrings,
            country,
            products: catalog.products.map((p) => ({ id: p.id, slug: p.slug, data: p.data, typeEntry: p.typeEntry, flavorEntry: p.flavorEntry })),
          }}
        >
          <AppShell>{children}</AppShell>
        </SiteProvider>
      </body>
    </html>
  );
}
