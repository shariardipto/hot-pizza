/**
 * Content-Security-Policy for the public website.
 *
 * Strict, nonce-based policy (the approach recommended by Google / OWASP):
 *  - scripts run only with the per-request nonce; `'strict-dynamic'` lets those trusted scripts load their own
 *    dependencies (Stripe.js, Razorpay checkout, Cloudflare Turnstile, a tag manager);
 *  - the host lists after the nonce are only a fallback for old browsers that ignore `'strict-dynamic'`;
 *  - styles allow inline `<style>` (theme variables, custom CSS) — style injection cannot run code;
 *  - images, fonts and video only from this site, the media CDN and the origins an admin explicitly allows.
 */

/** Third parties the checkout needs. Kept in one place so a new gateway only touches this map. */
export const CSP_VENDORS = {
  stripe: {
    script: ['https://js.stripe.com', 'https://*.js.stripe.com'],
    frame: ['https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com'],
    connect: ['https://api.stripe.com'],
    img: ['https://*.stripe.com'],
  },
  razorpay: {
    script: ['https://checkout.razorpay.com'],
    frame: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
    connect: ['https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
    img: ['https://*.razorpay.com'],
  },
  turnstile: {
    script: ['https://challenges.cloudflare.com'],
    frame: ['https://challenges.cloudflare.com'],
    connect: [],
    img: [],
  },
} as const;

export interface CspOptions {
  /** Base64 nonce, new for every request. */
  nonce: string;
  /** Development: allow eval (React dev tools / fast refresh) and the HMR websocket. */
  dev?: boolean;
  /** Origins of uploaded media when served from a CDN / S3 instead of this site. */
  mediaOrigins?: string[];
  /** Extra origins from Admin → Settings → Security (analytics, embeds…). */
  allowedOrigins?: string[];
  /** Where browsers POST violation reports. */
  reportUri?: string;
  /** Upgrade http:// sub-resources to https:// (production on https). */
  upgradeInsecureRequests?: boolean;
}

const uniq = (list: (string | false | null | undefined)[]) => [...new Set(list.filter((v): v is string => Boolean(v)))];

/** `https://cdn.example.com/media/` → `https://cdn.example.com`; invalid / relative values are dropped. */
export function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

export function buildCsp(o: CspOptions): string {
  const v = Object.values(CSP_VENDORS);
  const media = uniq((o.mediaOrigins ?? []).map(originOf));
  const extra = o.allowedOrigins ?? [];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': uniq([
      "'self'",
      `'nonce-${o.nonce}'`,
      "'strict-dynamic'",
      ...v.flatMap((x) => x.script),
      ...extra,
      o.dev && "'unsafe-eval'",
    ]),
    'style-src': uniq(["'self'", "'unsafe-inline'", ...media, ...extra]),
    'img-src': uniq(["'self'", 'data:', 'blob:', ...media, ...v.flatMap((x) => x.img), ...extra]),
    'font-src': uniq(["'self'", 'data:', ...media, ...extra]),
    'media-src': uniq(["'self'", 'blob:', ...media, ...extra]),
    'connect-src': uniq(["'self'", ...media, ...v.flatMap((x) => x.connect), ...extra, o.dev && 'ws:']),
    'frame-src': uniq(["'self'", ...v.flatMap((x) => x.frame), ...extra]),
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
  };

  const parts = Object.entries(directives).map(([k, list]) => `${k} ${list.join(' ')}`);
  if (o.upgradeInsecureRequests) parts.push('upgrade-insecure-requests');
  if (o.reportUri) parts.push(`report-uri ${o.reportUri}`, 'report-to csp');
  return parts.join('; ');
}
