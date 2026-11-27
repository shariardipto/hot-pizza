import crypto from 'node:crypto';
import path from 'node:path';
import { prisma } from '../../db.ts';
import { badRequest, notFound } from '../../lib/http.ts';
import { toWebp, UPLOAD_IMAGE_TYPES } from './image.ts';
import { storage } from './storage.ts';

/** Fonts (custom fonts in Appearance) are stored as uploaded. Images are handled by UPLOAD_IMAGE_TYPES. */
const FONT_TYPES: Record<string, string> = {
  'font/woff': '.woff',
  'font/woff2': '.woff2',
  'application/font-woff': '.woff',
  'application/font-woff2': '.woff2',
  'font/ttf': '.ttf',
  'font/otf': '.otf',
};

function slugifyName(name: string) {
  const base = path.basename(name, path.extname(name));
  return (
    base
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file'
  );
}

function sniffMime(buf: Buffer, declared: string): string {
  // Trust magic bytes over the browser-declared type for the common formats.
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 4).toString() === 'wOF2') return 'font/woff2';
  if (buf.subarray(0, 4).toString() === 'wOFF') return 'font/woff';
  if (buf.subarray(0, 4).toString() === 'OTTO') return 'font/otf';
  if (buf.subarray(0, 4).equals(Buffer.from([0x00, 0x01, 0x00, 0x00]))) return 'font/ttf';
  return declared;
}

/**
 * Stores an uploaded file. Images must be PNG, JPG or WebP and are always saved as WebP (see toWebp);
 * fonts are saved as uploaded; anything else is rejected.
 */
export async function saveUpload(
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  opts: { folder?: string; alt?: string; userId?: string } = {},
) {
  const mime = sniffMime(file.buffer, file.mimetype);
  let body = file.buffer;
  let ext: string;
  let storedMime = mime;
  let width: number | undefined;
  let height: number | undefined;
  if (UPLOAD_IMAGE_TYPES.has(mime)) {
    try {
      const img = await toWebp(file.buffer, mime);
      ({ buffer: body, width, height } = img);
    } catch {
      throw badRequest(`${file.originalname} is not a readable image`, 'invalid_image');
    }
    ext = '.webp';
    storedMime = 'image/webp';
  } else if (FONT_TYPES[mime]) {
    ext = FONT_TYPES[mime];
  } else {
    throw badRequest(`${file.originalname}: only PNG, JPG and WebP images (and font files) can be uploaded`, 'unsupported_type');
  }
  const folder = (opts.folder ?? '').replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '');
  const name = slugifyName(file.originalname);
  const key = `${folder ? `${folder}/` : ''}${name}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const url = await storage.put(key, body, storedMime);
  return prisma.media.create({
    data: { storageKey: key, url, filename: `${name}${ext}`, mimeType: storedMime, size: body.length, width, height, alt: opts.alt, folder, createdById: opts.userId },
  });
}

export async function listMedia(f: { q?: string; folder?: string; type?: string; page: number; pageSize: number }) {
  const where = {
    ...(f.folder !== undefined && f.folder !== '' ? { folder: f.folder } : {}),
    ...(f.type ? { mimeType: { startsWith: f.type } } : {}),
    ...(f.q ? { OR: [{ filename: { contains: f.q, mode: 'insensitive' as const } }, { alt: { contains: f.q, mode: 'insensitive' as const } }] } : {}),
  };
  const [items, total, folders] = await Promise.all([
    prisma.media.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    prisma.media.count({ where }),
    prisma.media.groupBy({ by: ['folder'], _count: { _all: true } }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize, folders: folders.map((x) => ({ folder: x.folder, count: x._count._all })) };
}

export async function deleteMedia(id: string) {
  const m = await prisma.media.findUnique({ where: { id } });
  if (!m) throw notFound('File');
  await storage.delete(m.storageKey);
  await prisma.media.delete({ where: { id } });
}
