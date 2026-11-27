import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { siteOrigin } from '@/lib/seo';

// Rendered on request: built without the API it would keep localhost defaults.
export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await api.settings().catch(() => null);
  const base = siteOrigin(settings?.site.url);
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/checkout', '/order', '/reservations/', '/api/'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
