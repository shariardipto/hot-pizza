import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_SIDE, toWebp } from './image.ts';

const blank = (width: number, height: number, channels: 3 | 4 = 3) =>
  sharp({ create: { width, height, channels, background: channels === 4 ? { r: 255, g: 0, b: 0, alpha: 0.5 } : '#3366cc' } });

describe('toWebp', () => {
  it('converts PNG to WebP and keeps transparency', async () => {
    const out = await toWebp(await blank(200, 100, 4).png().toBuffer(), 'image/png');
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.hasAlpha).toBe(true);
    expect([out.width, out.height]).toEqual([200, 100]);
  });

  it('turns phone photos upright and strips camera metadata', async () => {
    const jpg = await blank(300, 100).jpeg().withMetadata({ orientation: 6, exif: { IFD0: { Make: 'TestCam' } } }).toBuffer();
    const out = await toWebp(jpg, 'image/jpeg');
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect([out.width, out.height]).toEqual([100, 300]);
    expect(meta.exif).toBeUndefined();
  });

  it('keeps a clean WebP upload byte-for-byte', async () => {
    const webp = await blank(120, 80).webp({ quality: 70 }).toBuffer();
    expect((await toWebp(webp, 'image/webp')).buffer.equals(webp)).toBe(true);
  });

  it('shrinks very large images to the size limit', async () => {
    const out = await toWebp(await blank(5000, 2500).jpeg().toBuffer(), 'image/jpeg');
    expect([out.width, out.height]).toEqual([MAX_IMAGE_SIDE, MAX_IMAGE_SIDE / 2]);
  });

  it('rejects files that are not images', async () => {
    await expect(toWebp(Buffer.from('not an image'), 'image/png')).rejects.toThrow();
  });
});
