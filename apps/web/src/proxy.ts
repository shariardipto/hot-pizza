import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@app/shared/security';
import type { PublicSettings } from '@app/shared/theme';

/**
 * 1. Locale routing: the default language has no URL prefix (`/about`), other languages do (`/es/about`).
 * 2. Content-Security-Policy with a fresh nonce per request (Next.js reads it from the request header and adds it to
 *    its own scripts; the layout adds it to the analytics snippet).
 * Languages and security options come from the admin, so they are read from the API (cached for 60 s).
 */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const DEV = process.env.NODE_ENV !== 'production';
const MEDIA_ORIGINS = [process.env.MEDIA_PUBLIC_URL, process.env.S3_PUBLIC_URL].filter((v): v is string => Boolean(v));
const UPGRADE = (process.env.WEB_URL ?? '').startsWith('https://');

interface SiteConfig {
  at: number;
  codes: string[];
  def: string;
  security: PublicSettings['security'];
}
let cache: SiteConfig | null = null;

async function siteConfig(): Promise<SiteConfig> {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  try {
    const res = await fetch(`${API_URL}/api/v1/settings`, { signal: AbortSignal.timeout(3000) });
    const s = (await res.json()) as PublicSettings;
    cache = {
      at: Date.now(),
      codes: s.locales.map((l) => l.code),
      def: s.defaultLocale,
      security: s.security ?? { cspMode: 'enforce', cspAllowedOrigins: [] },
    };
  } catch {
    // API unreachable: keep the last known values, or safe defaults (enforced CSP).
    cache = cache ?? { at: Date.now(), codes: ['en'], def: 'en', security: { cspMode: 'enforce', cspAllowedOrigins: [] } };
  }
  return cache;
}

function withCsp(req: NextRequest, security: SiteConfig['security'], build: (headers: Headers) => NextResponse) {
  if (security.cspMode === 'off') return build(new Headers(req.headers));
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    dev: DEV,
    mediaOrigins: MEDIA_ORIGINS,
    allowedOrigins: security.cspAllowedOrigins,
    reportUri: '/api/v1/csp-report',
    upgradeInsecureRequests: UPGRADE,
  });
  const header = security.cspMode === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set(header, csp);
  const res = build(headers);
  res.headers.set(header, csp);
  res.headers.set('Reporting-Endpoints', 'csp="/api/v1/csp-report"');
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const { codes, def, security } = await siteConfig();
  const first = pathname.split('/')[1] ?? '';

  // /en/about → /about (the default language is never prefixed)
  if (first === def) {
    const rest = pathname.slice(def.length + 1) || '/';
    return NextResponse.redirect(new URL(`${rest}${search}`, req.url), 308);
  }
  if (codes.includes(first)) return withCsp(req, security, (headers) => NextResponse.next({ request: { headers } }));

  // /about → internally /en/about
  const url = req.nextUrl.clone();
  url.pathname = `/${def}${pathname === '/' ? '' : pathname}`;
  return withCsp(req, security, (headers) => NextResponse.rewrite(url, { request: { headers } }));
}

export const config = {
  matcher: ['/((?!api|_next|uploads|fonts|icons|favicon|social-card|manifest|robots|sitemap|.*\\..*).*)'],
};
