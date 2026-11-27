import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/** Called by the API after admin changes: `{ tags: ["content:home", "catalog"] }`. */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { tags?: unknown };
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string').slice(0, 50) : [];
  // Every content change also refreshes generic "content" consumers (layout, footer…).
  const all = new Set([...tags, ...(tags.some((t) => t.startsWith('content')) ? ['content'] : [])]);
  for (const tag of all) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: [...all] });
}
