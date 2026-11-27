import { customAlphabet } from 'nanoid';
import { prisma, type Tx } from '../db.ts';

/** URL-safe secret for guest links (order tracking, reservation management). */
export const secretToken = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', 32);

/** Short, unambiguous, human-friendly code (no 0/O/1/I). */
export const shortCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);

/** Atomically increments a named counter and returns the new value. */
export async function nextSequence(key: string, start: number, tx: Tx = prisma): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "counter" ("key", "value") VALUES (${key}, ${start})
    ON CONFLICT ("key") DO UPDATE SET "value" = "counter"."value" + 1
    RETURNING "value"`;
  return Number(rows[0]!.value);
}
