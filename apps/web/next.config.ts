import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Monorepo: load the shared root .env (apps/web/.env* still take precedence via Next).
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const HTTPS = (process.env.WEB_URL ?? '').startsWith('https://');

const config: NextConfig = {
  reactStrictMode: true,
  // Docker images (NEXT_OUTPUT=standalone) ship only the files the server needs; traced from the monorepo root.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const, outputFileTracingRoot: path.resolve(process.cwd(), '../..') } : {}),
  poweredByHeader: false,
  transpilePackages: ['@app/shared'],
  async rewrites() {
    return [
      // Media + public API through the website origin (same-origin images, no CORS).
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
      { source: '/api/v1/:path*', destination: `${API_URL}/api/v1/:path*` },
    ];
  },
  async redirects() {
    return [
      { source: '/privacy', destination: '/legal/privacy-policy', permanent: true },
      { source: '/where-to-buy', destination: '/locations', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // The Content-Security-Policy is per request (nonce) — see src/proxy.ts.
          ...(HTTPS ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
        ],
      },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};

export default config;
