import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';

// Rendered on request: built without the API it would keep localhost defaults.
export const dynamic = 'force-dynamic';

/** Installable web app manifest (icons from the original PWA set). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await api.settings().catch(() => null);
  const sizes = [64, 120, 144, 152, 192, 384, 512];
  return {
    name: settings?.site.name ?? 'PIZZA',
    short_name: settings?.site.name ?? 'PIZZA',
    description: settings?.site.defaultDescription,
    start_url: '/?standalone=true',
    display: 'standalone',
    background_color: settings?.theme.colors.bg ?? '#fbf5e7',
    theme_color: settings?.theme.colors.accent ?? '#d70321',
    icons: sizes.map((s) => ({ src: `/icons/icon_${s}x${s}.00e55d.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' })),
  };
}
