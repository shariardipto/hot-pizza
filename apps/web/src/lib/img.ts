/**
 * Image URL helper. Our media server understands the same parameters the original used with imgix
 * (`auto=format`, `width`/`w`, `blur`), so the markup can stay identical.
 */
export function imgUrl(url: string | null | undefined, params: Record<string, string | number> = {}): string {
  if (!url) return '';
  const own = url.startsWith('/uploads/') || url.includes('/uploads/');
  if (!own) return url;
  const [base, query] = url.split('?');
  const sp = new URLSearchParams(query);
  if (!sp.has('auto')) sp.set('auto', 'format');
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));
  return `${base}?${sp.toString().replace(/%2C/g, ',')}`;
}

/** Uploaded images are stored as WebP, which not every social network reads: share previews get a 1200px JPEG copy. */
export const shareImageUrl = (url: string) => imgUrl(url, { w: 1200, fm: 'jpeg' });

/** Favicons are served as PNG, which every browser accepts. */
export const faviconUrl = (url: string) => imgUrl(url, { w: 192, fm: 'png' });
