import sharp, { type OutputInfo } from 'sharp';

/** Image types accepted for upload. Every image is stored as WebP. */
export const UPLOAD_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Longest side kept on upload. The site never displays images wider than 3200px (see serve.ts). */
export const MAX_IMAGE_SIDE = 4096;

export interface WebpImage {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Converts a JPEG, PNG or WebP image to WebP.
 * - Turns the image upright (EXIF rotation) and strips metadata such as camera data and GPS location.
 * - Shrinks anything larger than MAX_IMAGE_SIDE.
 * - Photos (JPEG): lossy, quality 80, visually the same as the original and usually smaller.
 * - Graphics (PNG): encodes high-quality lossy and near-lossless versions and keeps the smaller one,
 *   so logos keep crisp edges and cut-outs keep their transparency.
 * - WebP files are kept as uploaded when they are already upright, metadata-free and within the size limit.
 * Throws when the file is not a readable image.
 */
export async function toWebp(input: Buffer, mime: string): Promise<WebpImage> {
  const meta = await sharp(input, { failOn: 'error' }).metadata();
  if (!meta.width || !meta.height) throw new Error('Unreadable image');
  const animated = mime === 'image/webp' && (meta.pages ?? 1) > 1;
  const upright = !meta.orientation || meta.orientation === 1;
  const tooBig = Math.max(meta.width, meta.height) > MAX_IMAGE_SIDE;

  if (mime === 'image/webp' && upright && !tooBig && !meta.exif && !meta.xmp && !meta.iptc) {
    return { buffer: input, width: meta.width, height: meta.pageHeight ?? meta.height };
  }

  const base = () => {
    let img = sharp(input, { failOn: 'error', animated }).rotate();
    if (tooBig) img = img.resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true });
    return img;
  };
  let out: { data: Buffer; info: OutputInfo };
  if (mime === 'image/png') {
    const [lossy, nearLossless] = await Promise.all([
      base().webp({ quality: 90, alphaQuality: 100, smartSubsample: true, effort: 5 }).toBuffer({ resolveWithObject: true }),
      base().webp({ nearLossless: true, quality: 60, effort: 5 }).toBuffer({ resolveWithObject: true }),
    ]);
    out = nearLossless.data.length <= lossy.data.length ? nearLossless : lossy;
  } else {
    out = await base().webp({ quality: 80, smartSubsample: true, effort: 5 }).toBuffer({ resolveWithObject: true });
  }
  return { buffer: out.data, width: out.info.width, height: out.info.pageHeight ?? out.info.height };
}
