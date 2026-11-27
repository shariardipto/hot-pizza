import { env } from '../env.ts';
import { logger } from './logger.ts';

/**
 * Tells the website to drop cached pages after admin changes (Next.js `revalidateTag`).
 * Calls are debounced so a burst of saves results in a single request.
 */
const pending = new Set<string>();
let timer: NodeJS.Timeout | null = null;

export function revalidate(...tags: string[]) {
  if (!env.REVALIDATE_SECRET) return;
  for (const t of tags) pending.add(t);
  if (timer) return;
  timer = setTimeout(flush, 400);
}

async function flush() {
  timer = null;
  const tags = [...pending];
  pending.clear();
  try {
    const res = await fetch(`${env.WEB_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': env.REVALIDATE_SECRET },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) logger.warn({ status: res.status, tags }, 'Website revalidation failed');
    else logger.debug({ tags }, 'Website revalidated');
  } catch (err) {
    logger.warn({ err: (err as Error).message, tags }, 'Website not reachable for revalidation');
  }
}
