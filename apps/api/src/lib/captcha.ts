import { env } from '../env.ts';
import { HttpError } from './http.ts';
import { logger } from './logger.ts';

/**
 * Cloudflare Turnstile — privacy-friendly bot check (no cookies, no puzzles for most visitors).
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Local testing keys (always pass): site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type CaptchaAction = 'checkout' | 'reservation';

export const captchaConfigured = () => Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);

interface SiteverifyResponse {
  success: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export const captchaFailed = () =>
  new HttpError(400, 'captcha_failed', 'We could not confirm you are human. Please try again.');

/**
 * Throws `captcha_failed` when the token is missing, expired, already used or for another action.
 * If Cloudflare itself cannot be reached the request is let through (and logged): tokens are single-use and the
 * rate limits still apply, so an outage on their side does not stop real customers from ordering.
 */
export async function verifyCaptcha(token: string | undefined, action: CaptchaAction, ip?: string): Promise<void> {
  if (!token || token.length > 2048) throw captchaFailed();

  let result: SiteverifyResponse;
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
    result = (await res.json()) as SiteverifyResponse;
  } catch (err) {
    logger.error({ err, action }, 'Turnstile verification unavailable — request allowed');
    return;
  }

  if (!result.success) {
    logger.info({ action, codes: result['error-codes'] }, 'Bot check rejected');
    throw captchaFailed();
  }
  // Test keys return an empty action; real widgets always send the one we rendered.
  if (result.action && result.action !== action) {
    logger.warn({ expected: action, got: result.action }, 'Bot check token used for another action');
    throw captchaFailed();
  }
}
