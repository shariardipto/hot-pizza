import 'server-only';
import { createApiClient } from '@app/shared/api';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const REVALIDATE = Number(process.env.CONTENT_REVALIDATE_SECONDS ?? (process.env.NODE_ENV === 'production' ? 300 : 5));

/** Tags used for on-demand revalidation (the API pings /api/revalidate after admin edits). */
function tagsFor(path: string): string[] {
  if (path.startsWith('/settings')) return ['settings'];
  if (path.startsWith('/catalog')) return ['catalog', 'content'];
  const m = path.match(/^\/content\/([^/?]+)(?:\/entries\/([^/?]+))?/);
  if (m) return ['content', `content:${m[1]}`, ...(m[2] ? [`content:${m[1]}:${decodeURIComponent(m[2])}`] : [])];
  if (path.startsWith('/locations')) return ['locations'];
  if (path.startsWith('/markets')) return ['markets'];
  return [];
}

/** Server-side API client with Next.js data cache + tags. */
export const api = createApiClient({
  baseUrl: API_URL,
  init: (path) => ({ next: { revalidate: REVALIDATE, tags: tagsFor(path) } }),
});

export const apiNoStore = createApiClient({ baseUrl: API_URL, init: () => ({ cache: 'no-store' }) });
