import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { CACHE_DIR, UPLOADS_DIR } from './storage.ts';

// Uploaded images are stored as WebP; .jpg/.png only exist on installs not yet migrated (pnpm --filter @app/api media:webp).
const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};
const RESIZABLE = new Set(['.webp', '.jpg', '.jpeg', '.png']);
const MAX_WIDTH = 3200;

/**
 * GET /uploads/<key>[?w=1000&blur=20&q=80&fm=webp]
 * Mirrors the imgix-style parameters the original site used (`width`, `w`, `blur`, `auto=format`).
 * `fm=png` / `fm=jpeg` give a copy for places that may not read WebP (favicon, social share images).
 */
export async function serveUpload(req: Request, res: Response) {
  const rel = decodeURIComponent(req.path.replace(/^\/+/, ''));
  const file = path.resolve(UPLOADS_DIR, rel);
  if (!file.startsWith(UPLOADS_DIR + path.sep)) return res.status(403).end();
  const ext = path.extname(file).toLowerCase();

  let stat;
  try {
    stat = await fs.stat(file);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    return res.status(404).json({ error: { code: 'not_found', message: 'File not found' } });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; sandbox");
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  const q = req.query as Record<string, string | undefined>;
  const width = Math.min(Number(q.w ?? q.width) || 0, MAX_WIDTH);
  const blur = Math.min(Number(q.blur) || 0, 250);
  const quality = Math.min(Math.max(Number(q.q) || 78, 30), 95);
  const accept = String(req.headers.accept ?? '');
  // auto=format → WebP (what uploads are stored as). AVIF is not offered: encoding it on the fly took 4–14 s per large
  // image and, at this quality, gave bigger files than WebP.
  const wantsFormat = q.fm ?? (String(q.auto ?? '').includes('format') && accept.includes('image/webp') ? 'webp' : '');
  const transform = RESIZABLE.has(ext) && (width > 0 || blur > 0 || wantsFormat);

  if (!transform) {
    res.type(TYPES[ext] ?? 'application/octet-stream');
    return res.sendFile(file);
  }

  const format = (['webp', 'jpeg', 'png'].includes(String(wantsFormat)) ? wantsFormat : ext === '.png' ? 'png' : ext === '.webp' ? 'webp' : 'jpeg') as 'webp' | 'jpeg' | 'png';
  const key = crypto.createHash('sha1').update(`${rel}|${stat.mtimeMs}|${width}|${blur}|${quality}|${format}`).digest('hex');
  const cached = path.join(CACHE_DIR, key.slice(0, 2), `${key}.${format}`);
  res.setHeader('Vary', 'Accept');
  res.type(`image/${format}`);
  try {
    await fs.access(cached);
    return res.sendFile(cached);
  } catch {
    /* not cached yet */
  }
  // Read into memory rather than letting libvips open the path: libvips keeps recently used files open, and on Windows
  // an open file cannot be deleted or replaced (deleting the image in the Media library then failed with a 500).
  let img = sharp(await fs.readFile(file), { failOn: 'none' }).rotate();
  if (width) img = img.resize({ width, withoutEnlargement: true });
  // Blur sigma ≈ imgix blur/10 (imgix uses 0–2000).
  if (blur) img = img.blur(Math.max(0.3, blur / 10));
  // JPEG has no transparency: put transparent images on white rather than black.
  if (format === 'jpeg') img = img.flatten({ background: '#ffffff' });
  img = format === 'png' ? img.png({ compressionLevel: 9 }) : img.toFormat(format, { quality });
  const out = await img.toBuffer();
  await fs.mkdir(path.dirname(cached), { recursive: true });
  await fs.writeFile(cached, out).catch(() => undefined);
  res.end(out);
}
