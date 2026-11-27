import fs from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../../env.ts';

/** `STORAGE_DIR` overrides; default `apps/api/storage` (scripts run with the package as working directory). */
export const STORAGE_ROOT = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : path.resolve(process.cwd(), 'storage');
export const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');
export const CACHE_DIR = path.join(STORAGE_ROOT, 'cache');

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Files on disk, served by the API at /uploads/* (with on-the-fly resizing). */
const local: StorageDriver = {
  async put(key, body) {
    const file = path.join(UPLOADS_DIR, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return `${env.MEDIA_PUBLIC_URL}/uploads/${key}`;
  },
  async get(key) {
    return fs.readFile(path.join(UPLOADS_DIR, key));
  },
  async delete(key) {
    await fs.rm(path.join(UPLOADS_DIR, key), { force: true });
  },
};

let s3: S3Client | null = null;
const s3Client = () =>
  (s3 ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  }));
const s3Driver: StorageDriver = {
  async put(key, body, contentType) {
    await s3Client().send(
      new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }),
    );
    return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  },
  async get(key) {
    const res = await s3Client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  },
  async delete(key) {
    await s3Client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  },
};

export const storage: StorageDriver = env.STORAGE_DRIVER === 's3' ? s3Driver : local;
