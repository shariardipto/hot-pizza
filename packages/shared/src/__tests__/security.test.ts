import { describe, expect, it } from 'vitest';
import { buildCsp, originOf } from '../security';
import { cspOriginSchema, securitySchema, defaultSecurity, commerceSchema, defaultCommerce } from '../theme';

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `))?.split(' ').slice(1) ?? [];

describe('buildCsp', () => {
  it('is nonce-based with strict-dynamic and no unsafe script sources in production', () => {
    const csp = buildCsp({ nonce: 'abc123==' });
    const script = directive(csp, 'script-src');
    expect(script).toContain("'nonce-abc123=='");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'none'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'self'"]);
  });

  it('allows the payment gateways and the bot check', () => {
    const csp = buildCsp({ nonce: 'n' });
    expect(directive(csp, 'frame-src')).toEqual(expect.arrayContaining(['https://js.stripe.com', 'https://api.razorpay.com', 'https://challenges.cloudflare.com']));
    expect(directive(csp, 'connect-src')).toEqual(expect.arrayContaining(['https://api.stripe.com', 'https://api.razorpay.com']));
  });

  it('adds media CDN origins, admin-allowed origins, dev relaxations and reporting', () => {
    const csp = buildCsp({
      nonce: 'n',
      dev: true,
      mediaOrigins: ['https://cdn.example.com/media/', 'not a url', ''],
      allowedOrigins: ['https://www.googletagmanager.com'],
      reportUri: '/api/v1/csp-report',
      upgradeInsecureRequests: true,
    });
    expect(directive(csp, 'img-src')).toEqual(expect.arrayContaining(['https://cdn.example.com', 'https://www.googletagmanager.com']));
    expect(directive(csp, 'img-src')).not.toContain('not a url');
    expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(csp, 'connect-src')).toContain('ws:');
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toContain('report-uri /api/v1/csp-report');
  });

  it('extracts origins', () => {
    expect(originOf('https://cdn.example.com/a/b?c')).toBe('https://cdn.example.com');
    expect(originOf('/uploads/x.png')).toBeNull();
    expect(originOf('javascript:alert(1)')).toBeNull();
  });
});

describe('security settings', () => {
  it('only accepts plain https origins (no CSP injection)', () => {
    expect(cspOriginSchema.safeParse('https://www.google-analytics.com').success).toBe(true);
    expect(cspOriginSchema.safeParse('https://*.hotjar.com').success).toBe(true);
    expect(cspOriginSchema.safeParse('https://example.com:8443').success).toBe(true);
    for (const bad of ['http://example.com', 'https://example.com; script-src *', "'unsafe-inline'", '*', 'https://example.com/path', 'https://localhost']) {
      expect(cspOriginSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('defaults are valid', () => {
    expect(securitySchema.parse(defaultSecurity)).toEqual(defaultSecurity);
    expect(commerceSchema.parse(defaultCommerce)).toEqual(defaultCommerce);
  });
});

describe('theme CSS', () => {
  it('exposes the footer links color (falls back to secondary for older saved themes)', async () => {
    const { themeToCss, defaultTheme } = await import('../theme');
    expect(themeToCss({ ...defaultTheme, colors: { ...defaultTheme.colors, footerLinks: '#000000' } })).toContain('--c-footer-links:#000000');
    expect(themeToCss({ ...defaultTheme, colors: { ...defaultTheme.colors, footerLinks: '' } })).toContain(`--c-footer-links:${defaultTheme.colors.secondary}`);
  });

  it('exposes the top navigation and menu link colors (falling back to secondary)', async () => {
    const { themeToCss, defaultTheme } = await import('../theme');
    const css = themeToCss({ ...defaultTheme, colors: { ...defaultTheme.colors, navLinks: '#111111', menuLinks: '#222222' } });
    expect(css).toContain('--c-nav-links:#111111');
    expect(css).toContain('--c-menu-links:#222222');
    expect(themeToCss({ ...defaultTheme, colors: { ...defaultTheme.colors, navLinks: '', menuLinks: '' } })).toContain(`--c-nav-links:${defaultTheme.colors.secondary};--c-menu-links:${defaultTheme.colors.secondary}`);
  });
});
