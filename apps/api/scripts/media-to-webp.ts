/**
 * Converts every PNG/JPG image in the media library to WebP and updates everything that points at it:
 * page content, translations, revision history, settings (logo, favicon, share image), order lines and user avatars.
 *
 *   pnpm --filter @app/api media:webp             convert
 *   pnpm --filter @app/api media:webp --dry-run   only list what would change
 *
 * Safe to re-run: WebP images are skipped. Order of work, so a failure never leaves broken links:
 *   1. write the WebP files next to the originals
 *   2. update the database in one transaction
 *   3. delete the original files
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { prisma } from '../src/db.ts';
import { env } from '../src/env.ts';
import { toWebp } from '../src/modules/media/image.ts';
import { storage } from '../src/modules/media/storage.ts';

const DRY = process.argv.includes('--dry-run');
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

type Converted = { id: string; oldKey: string; newKey: string; url: string; size: number; width: number; height: number; filename: string };

const legacy = await prisma.media.findMany({ where: { mimeType: { in: ['image/jpeg', 'image/png'] } }, orderBy: { createdAt: 'asc' } });
if (!legacy.length) {
  console.log('All images are already WebP. Nothing to do.');
  process.exit(0);
}
console.log(`${legacy.length} PNG/JPG image(s) to convert${DRY ? ' (dry run)' : ''}`);

// 1. Write the WebP files.
const done: Converted[] = [];
let before = 0;
let after = 0;
for (const m of legacy) {
  const stem = m.storageKey.replace(/\.(jpe?g|png)$/i, '');
  let newKey = `${stem}.webp`;
  const taken = await prisma.media.findUnique({ where: { storageKey: newKey }, select: { id: true } });
  if (taken && taken.id !== m.id) newKey = `${stem}-${crypto.randomBytes(3).toString('hex')}.webp`;
  try {
    const img = await toWebp(await storage.get(m.storageKey), m.mimeType);
    before += m.size;
    after += img.buffer.length;
    const url = DRY ? '' : await storage.put(newKey, img.buffer, 'image/webp');
    const filename = `${path.basename(m.filename, path.extname(m.filename))}.webp`;
    done.push({ id: m.id, oldKey: m.storageKey, newKey, url, size: img.buffer.length, width: img.width, height: img.height, filename });
    console.log(`  ${m.storageKey} → ${newKey}  (${Math.round(m.size / 1024)} KB → ${Math.round(img.buffer.length / 1024)} KB)`);
  } catch (err) {
    console.warn(`  ⚠ skipped ${m.storageKey}: ${(err as Error).message}`);
  }
}
console.log(`Size: ${mb(before)} → ${mb(after)}`);
if (DRY || !done.length) process.exit(0);

// 2. Point every reference at the new files.
const byOldPath = new Map(done.map((c) => [`/uploads/${c.oldKey}`, c]));
const pattern = new RegExp([...byOldPath.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

/** Rewrites upload URLs inside any JSON value; image values `{ url, width, height }` also get the new size. */
function rewrite(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(pattern, (old) => `/uploads/${byOldPath.get(old)!.newKey}`);
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object') {
    const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
    const url = (value as { url?: unknown }).url;
    if (typeof url === 'string' && typeof out.width === 'number' && typeof out.height === 'number') {
      const hit = [...byOldPath.entries()].find(([old]) => url.includes(old))?.[1];
      if (hit) Object.assign(out, { width: hit.width, height: hit.height });
    }
    return out;
  }
  return value;
}
const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
const has = { contains: '/uploads/' };
const counts: Record<string, number> = {};
const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

await prisma.$transaction(
  async (tx) => {
    for (const c of done) {
      await tx.media.update({
        where: { id: c.id },
        data: { storageKey: c.newKey, url: c.url, mimeType: 'image/webp', size: c.size, width: c.width, height: c.height, filename: c.filename },
      });
    }
    for (const e of await tx.contentEntry.findMany({ select: { id: true, data: true } })) {
      const data = rewrite(e.data);
      if (changed(data, e.data)) {
        await tx.contentEntry.update({ where: { id: e.id }, data: { data: data as object } });
        bump('content');
      }
    }
    for (const t of await tx.contentTranslation.findMany({ select: { entryId: true, locale: true, data: true } })) {
      const data = rewrite(t.data);
      if (changed(data, t.data)) {
        await tx.contentTranslation.update({ where: { entryId_locale: { entryId: t.entryId, locale: t.locale } }, data: { data: data as object } });
        bump('translations');
      }
    }
    for (const r of await tx.contentRevision.findMany({ select: { id: true, snapshot: true } })) {
      const snapshot = rewrite(r.snapshot);
      if (changed(snapshot, r.snapshot)) {
        await tx.contentRevision.update({ where: { id: r.id }, data: { snapshot: snapshot as object } });
        bump('revisions');
      }
    }
    for (const s of await tx.setting.findMany()) {
      const value = rewrite(s.value);
      if (changed(value, s.value)) {
        await tx.setting.update({ where: { key: s.key }, data: { value: value as object } });
        bump(`setting:${s.key}`);
      }
    }
    for (const i of await tx.orderItem.findMany({ where: { image: has }, select: { id: true, image: true } })) {
      const image = rewrite(i.image) as string;
      if (image !== i.image) {
        await tx.orderItem.update({ where: { id: i.id }, data: { image } });
        bump('order lines');
      }
    }
    for (const u of await tx.user.findMany({ where: { image: has }, select: { id: true, image: true } })) {
      const image = rewrite(u.image) as string;
      if (image !== u.image) {
        await tx.user.update({ where: { id: u.id }, data: { image } });
        bump('users');
      }
    }
  },
  { timeout: 120_000 },
);
console.log('Updated references:', counts);

// 3. Remove the originals.
for (const c of done) if (c.oldKey !== c.newKey) await storage.delete(c.oldKey).catch(() => undefined);

// Tell the website to drop cached pages.
if (env.REVALIDATE_SECRET) {
  await fetch(`${env.WEB_URL}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': env.REVALIDATE_SECRET },
    body: JSON.stringify({ tags: ['content', 'catalog', 'settings'] }),
    signal: AbortSignal.timeout(5000),
  })
    .then((r) => console.log(r.ok ? 'Website cache refreshed.' : `Website cache refresh failed (${r.status}).`))
    .catch(() => console.log('Website not reachable; its cache refreshes on its own within a few minutes.'));
}
console.log(`Done: ${done.length} image(s) converted.`);
await prisma.$disconnect();
