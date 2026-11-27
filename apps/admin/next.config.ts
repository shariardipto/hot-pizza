import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

const rootEnv = path.resolve(process.cwd(), '../../.env');
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const DEV = process.env.NODE_ENV !== 'production';
const HTTPS = (process.env.ADMIN_URL ?? '').startsWith('https://');
const media = [process.env.MEDIA_PUBLIC_URL, process.env.S3_PUBLIC_URL]
  .map((u) => {
    try {
      return u ? new URL(u).origin : '';
    } catch {
      return '';
    }
  })
  .filter(Boolean)
  .join(' ');

/**
 * The dashboard loads no third-party code, so its policy is simply "this origin only".
 * (Pages are prerendered, so Next's inline bootstrap scripts need 'unsafe-inline' here; the strict nonce policy is
 * on the public website, which renders untrusted-ish content such as the analytics snippet.)
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${media}`.trim(),
  `media-src 'self' blob: ${media}`.trim(),
  `font-src 'self' data: ${media}`.trim(),
  `connect-src 'self'${DEV ? ' ws:' : ''}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(HTTPS ? ['upgrade-insecure-requests'] : []),
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  // Docker images (NEXT_OUTPUT=standalone) ship only the files the server needs; traced from the monorepo root.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const, outputFileTracingRoot: path.resolve(process.cwd(), '../..') } : {}),
  poweredByHeader: false,
  transpilePackages: ['@app/shared'],
  // The dashboard talks to the API through its own origin → first-party auth cookies, no CORS.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          ...(HTTPS ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
        ],
      },
    ];
  },
};

export default config;
