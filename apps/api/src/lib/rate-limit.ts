import rateLimit, { type ClientRateLimitInfo, type Options, type Store } from 'express-rate-limit';
import { createClient } from 'redis';
import { env } from '../env.ts';
import { logger } from './logger.ts';

/**
 * Rate limits. Counters live in memory by default, which is right for a single API server. With several API servers
 * behind a load balancer set REDIS_URL so they share one count (otherwise each server allows the full limit).
 * If Redis is unreachable, requests are let through rather than blocking checkout; the outage is logged once and
 * limits apply again as soon as Redis is back.
 */

// disableOfflineQueue: while Redis is down, commands fail at once instead of waiting for a reconnect.
export const redis = env.REDIS_URL ? createClient({ url: env.REDIS_URL, disableOfflineQueue: true }) : null;
if (redis) {
  let down = false;
  redis.on('error', (err: Error & { code?: string }) => {
    if (down) return; // reconnect attempts repeat the same error every few seconds
    down = true;
    logger.error({ err: err.code ?? err.message }, 'Redis unreachable — rate limits are not applied until it is back');
  });
  redis.on('ready', () => {
    if (down) logger.info('Redis is back — rate limits applied again');
    down = false;
  });
  redis.connect().then(
    () => logger.info('Rate limits shared through Redis'),
    () => undefined, // reported by the error handler above
  );
}

// Counts one hit in a fixed window. INCR + PEXPIRE run as one step, so simultaneous requests cannot slip through.
const HIT = `local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { n, redis.call('PTTL', KEYS[1]) }`;

/** Returns [hits in the current window, ms until it resets], or null when Redis is unavailable. */
async function hit(key: string, windowMs: number): Promise<[number, number] | null> {
  if (!redis?.isReady) return null;
  try {
    return (await redis.eval(HIT, { keys: [key], arguments: [String(windowMs)] })) as [number, number];
  } catch {
    return null;
  }
}

/** express-rate-limit store on Redis. */
class SharedStore implements Store {
  readonly localKeys = false;
  private windowMs = 60_000;
  constructor(readonly prefix: string) {}
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  async increment(key: string): Promise<ClientRateLimitInfo> {
    const r = await hit(this.prefix + key, this.windowMs);
    // Redis unavailable: report a first hit, which lets the request through.
    const [hits, ttl] = r ?? [1, this.windowMs];
    return { totalHits: hits, resetTime: new Date(Date.now() + Math.max(ttl, 0)) };
  }
  async decrement(key: string) {
    await redis?.decr(this.prefix + key).catch(() => undefined);
  }
  async resetKey(key: string) {
    await redis?.del(this.prefix + key).catch(() => undefined);
  }
}

/** Express rate limiter for one group of routes (`name` keeps the groups' counters apart in Redis). */
export function limiter(name: string, options: Partial<Options>) {
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...options,
    ...(redis ? { store: new SharedStore(`rl:${name}:`) } : {}),
  });
}

/** Better Auth (sign-in, password reset…) rate-limit storage on Redis; undefined = Better Auth's own memory store. */
export const authRateLimitStorage = redis
  ? {
      async consume(key: string, rule: { window: number; max: number }) {
        const r = await hit(`rl:auth:${key}`, rule.window * 1000);
        if (!r || r[0] <= rule.max) return { allowed: true, retryAfter: null };
        return { allowed: false, retryAfter: Math.max(Math.ceil(r[1] / 1000), 1) };
      },
    }
  : undefined;
