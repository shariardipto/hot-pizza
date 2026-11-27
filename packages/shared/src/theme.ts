import { z } from 'zod';
import { hexColorSchema, imageValueSchema } from './content/zod';

/* Theme = everything visual the admin can change without touching code. Defaults reproduce the original design. */

/** Home page sections in their original order. */
export const HOME_SECTIONS = ['hero', 'intro', 'cards', 'description', 'banners', 'sticky', 'showcase', 'award'] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number];

const font = z.object({
  family: z.string().min(1).max(80),
  woff2: z.string().max(2048).nullable(),
  woff: z.string().max(2048).nullable(),
  fallback: z.string().max(200),
  /** CSS size-adjust in % — scales the font so it fills the same space as the design's original font. */
  sizeAdjust: z.number().min(50).max(200).optional(),
});

export const themeSchema = z.object({
  colors: z.object({
    bg: hexColorSchema,
    textAlt: hexColorSchema,
    accent: hexColorSchema,
    secondary: hexColorSchema,
    accentDark: hexColorSchema,
    /** Color of the text logo. */
    logo: hexColorSchema,
    /** Links at the bottom of every page: social links, page links and legal links (text + underline). */
    footerLinks: hexColorSchema,
    /** Desktop top navigation: Home, Our pizzas, Our story, Contact (+ language switcher and cart link there). */
    navLinks: hexColorSchema,
    /** Links in the full-screen menu (☰ button; the only navigation on phones). */
    menuLinks: hexColorSchema,
  }),
  fonts: z.object({ display: font, regular: font }),
  /** Corner radius of cards/images in rem. */
  radius: z.number().min(0).max(8),
  /** Content width per breakpoint, in vw (mobile < 960px, tablet < 1280px, desktop). */
  grid: z.object({
    mobileWidth: z.number().min(70).max(100),
    tabletWidth: z.number().min(70).max(100),
    desktopWidth: z.number().min(70).max(100),
  }),
  logo: z.object({
    /**
     * `text` = the name typed below, in the display font; collapses into its letter mark.
     * `image` = uploaded logo, cross-fades to the compact mark.
     */
    mode: z.enum(['text', 'image']),
    image: imageValueSchema.nullable(),
    /** Optional compact mark shown when the header collapses (falls back to `image`). */
    compactImage: imageValueSchema.nullable(),
    /** Text logo: up to 3 lines (one per line break). Empty = the site name. */
    text: z.string().max(60),
    /** Text logo: 1–2 characters shown when the header collapses. Empty = the first letter of the text. */
    mark: z.string().max(2),
  }),
  favicon: imageValueSchema.nullable(),
  layout: z.object({
    /** Desktop top navigation (Home · Our pizzas … Our story · Contact). */
    showTopNav: z.boolean(),
    localeSwitcherPosition: z.enum(['top-left', 'top-right', 'hidden']),
    /** Where the cart opener lives: floating pill (bottom-right) or in the desktop top navigation. */
    cartButtonPosition: z.enum(['bottom-right', 'top-right']),
    /** Home page sections — order and visibility. */
    homeSections: z
      .array(z.object({ key: z.enum(HOME_SECTIONS), visible: z.boolean() }))
      .max(HOME_SECTIONS.length),
  }),
  motion: z.object({
    smoothScroll: z.boolean(),
    smoothScrollDuration: z.number().min(0.2).max(3),
    customCursor: z.boolean(),
    intro: z.boolean(),
    pageTransitions: z.boolean(),
    /** Respect the OS "reduce motion" setting (disables heavy motion). */
    respectReducedMotion: z.boolean(),
  }),
  /** Raw CSS appended after the theme (advanced). */
  customCss: z.string().max(50000),
});
export type Theme = z.infer<typeof themeSchema>;

export const defaultTheme: Theme = {
  colors: {
    bg: '#fbf5e7',
    textAlt: '#fbf5e7',
    accent: '#d70321',
    secondary: '#cba058',
    accentDark: '#9f0005',
    logo: '#cb9f57',
    footerLinks: '#cba058',
    navLinks: '#cba058',
    menuLinks: '#cba058',
  },
  fonts: {
    // Oswald (SIL Open Font License), scaled to the proportions of the design's original condensed fonts.
    display: { family: 'oswald-600', woff2: '/fonts/oswald-600.woff2', woff: '/fonts/oswald-600.woff', fallback: 'Helvetica, sans-serif', sizeAdjust: 89 },
    regular: { family: 'oswald-300', woff2: '/fonts/oswald-300.woff2', woff: '/fonts/oswald-300.woff', fallback: 'Helvetica, sans-serif', sizeAdjust: 86 },
  },
  radius: 2,
  grid: { mobileWidth: 90, tabletWidth: 95, desktopWidth: 96 },
  logo: { mode: 'text', image: null, compactImage: null, text: 'PIZZA', mark: 'P' },
  favicon: null,
  layout: {
    showTopNav: true,
    localeSwitcherPosition: 'top-left',
    cartButtonPosition: 'bottom-right',
    homeSections: HOME_SECTIONS.map((key) => ({ key, visible: true })),
  },
  motion: {
    smoothScroll: true,
    smoothScrollDuration: 1.2,
    customCursor: true,
    intro: true,
    pageTransitions: true,
    respectReducedMotion: true,
  },
  customCss: '',
};

/**
 * Ready-made color palettes (Admin → Appearance → Colors). "A" is the default; every palette keeps the contrast the
 * design needs (secondary text on accent panels, accent titles on the background).
 */
export const COLOR_PALETTES: { id: string; name: string; colors: Theme['colors'] }[] = [
  { id: 'A', name: 'Classic', colors: defaultTheme.colors },
  {
    id: 'B',
    name: 'Basil',
    colors: { bg: '#f5f1e4', textAlt: '#fdf8ee', accent: '#1f5c3a', secondary: '#f2c14e', accentDark: '#123b25', logo: '#f2c14e', footerLinks: '#1f5c3a', navLinks: '#f2c14e', menuLinks: '#f2c14e' },
  },
  {
    id: 'C',
    name: 'Wood oven',
    colors: { bg: '#f3ede4', textAlt: '#fff7ec', accent: '#1d1a18', secondary: '#ff6b2c', accentDark: '#3b2a21', logo: '#ff6b2c', footerLinks: '#1d1a18', navLinks: '#ff6b2c', menuLinks: '#ff6b2c' },
  },
  {
    id: 'D',
    name: 'Tomato',
    colors: { bg: '#fff3e6', textAlt: '#fff3e6', accent: '#e2452a', secondary: '#fde3c0', accentDark: '#9b2913', logo: '#fde3c0', footerLinks: '#e2452a', navLinks: '#fde3c0', menuLinks: '#fde3c0' },
  },
  {
    id: 'E',
    name: 'Napoli blue',
    colors: { bg: '#f6f4ef', textAlt: '#f6f4ef', accent: '#1c3f8f', secondary: '#f6c945', accentDark: '#0f2556', logo: '#f6c945', footerLinks: '#1c3f8f', navLinks: '#f6c945', menuLinks: '#f6c945' },
  },
  {
    id: 'F',
    name: 'Night',
    colors: { bg: '#1a1512', textAlt: '#f6eee0', accent: '#e3263c', secondary: '#f3d58c', accentDark: '#7d0a1c', logo: '#f3d58c', footerLinks: '#f3d58c', navLinks: '#f3d58c', menuLinks: '#f3d58c' },
  },
];

export const siteSchema = z.object({
  name: z.string().min(1).max(80),
  /** Appended to page titles: "Products — {titleSuffix}". */
  titleSuffix: z.string().max(80),
  defaultDescription: z.string().max(300),
  defaultShareImage: imageValueSchema.nullable(),
  /** Public site URL (for canonical links, sitemaps, e-mails). */
  url: z.string().max(300),
  /** Where order / reservation notifications go. */
  notificationEmail: z.string().max(200),
  timezone: z.string().max(64),
  analyticsHead: z.string().max(20000),
});
export type Site = z.infer<typeof siteSchema>;

export const defaultSite: Site = {
  name: 'PIZZA',
  titleSuffix: 'PIZZA',
  defaultDescription: 'Wood-fired pizza made with slow-rising dough and fresh ingredients. Order online or book a table.',
  defaultShareImage: null,
  /** Empty = WEB_URL from the server environment. */
  url: '',
  notificationEmail: 'hello@pizza.example',
  timezone: 'Europe/Madrid',
  analyticsHead: '',
};

export const featuresSchema = z.object({
  ordering: z.boolean(),
  reservations: z.boolean(),
  /** "Our locations" page listing the branches (Admin → Locations). */
  locationsPage: z.boolean(),
  languageSwitcher: z.boolean(),
  /** Detect the visitor's country from the CDN / IP headers to pre-select their market. */
  geoDetection: z.boolean(),
});
export type Features = z.infer<typeof featuresSchema>;

export const defaultFeatures: Features = {
  ordering: true,
  reservations: true,
  locationsPage: true,
  languageSwitcher: true,
  geoDetection: true,
};

export const commerceSchema = z.object({
  /** Order numbers look like `PZ-10001`. */
  orderPrefix: z.string().regex(/^[A-Z0-9]{0,6}$/),
  reservationPrefix: z.string().regex(/^[A-Z0-9]{0,6}$/),
  /** Ask for an e-mail address at checkout (always optional for cash on delivery). */
  requireEmailForOnlinePayment: z.boolean(),
  /** Minutes an unpaid online order keeps its stock reserved before it is cancelled automatically. */
  unpaidOrderTimeoutMinutes: z.number().int().min(10).max(1440),
  /** Notify customers by e-mail when an order changes status. */
  emailCustomerOnStatusChange: z.boolean(),
  /** Fraud guard: max open (not yet delivered/cancelled) cash-on-delivery orders per phone number. 0 = no limit. */
  codMaxOpenOrdersPerPhone: z.number().int().min(0).max(50),
  /** Max upcoming reservations per phone number. 0 = no limit. */
  maxUpcomingReservationsPerPhone: z.number().int().min(0).max(50),
  /** Phone numbers (any format) or e-mail addresses that cannot order or book online. */
  blockedCustomers: z.array(z.string().trim().min(3).max(200)).max(2000),
});
export type CommerceSettings = z.infer<typeof commerceSchema>;

export const defaultCommerce: CommerceSettings = {
  orderPrefix: 'PZ',
  reservationPrefix: 'R',
  requireEmailForOnlinePayment: true,
  unpaidOrderTimeoutMinutes: 60,
  emailCustomerOnStatusChange: true,
  codMaxOpenOrdersPerPhone: 3,
  maxUpcomingReservationsPerPhone: 3,
  blockedCustomers: [],
};

/** An https origin for the Content-Security-Policy, optionally with a wildcard subdomain: `https://*.example.com`. */
export const cspOriginSchema = z
  .string()
  .trim()
  .regex(/^https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?$/i, 'Use an https origin such as https://www.example.com');

export const securitySchema = z.object({
  /** Every dashboard user must set up an authenticator app before they can use the admin. */
  requireTwoFactor: z.boolean(),
  /** Bot check (Cloudflare Turnstile) on checkout and bookings — active when the keys are set in the API environment. */
  captcha: z.boolean(),
  /** Content-Security-Policy of the website. `report-only` logs violations without blocking (use it to test new scripts). */
  cspMode: z.enum(['enforce', 'report-only', 'off']),
  /** Extra third-party origins (analytics, tag manager, embeds) allowed by the CSP. */
  cspAllowedOrigins: z.array(cspOriginSchema).max(40),
  /**
   * Privacy (GDPR): months after which customer names, phone numbers, e-mails and addresses are removed from finished
   * orders and past bookings. Totals and items stay for accounting. 0 = keep.
   */
  customerDataRetentionMonths: z.number().int().min(0).max(120),
  /** Days after which IP addresses and browser details (kept for fraud checks) are deleted. */
  ipRetentionDays: z.number().int().min(7).max(730),
});
export type SecuritySettings = z.infer<typeof securitySchema>;

export const defaultSecurity: SecuritySettings = {
  requireTwoFactor: false,
  captcha: true,
  cspMode: 'enforce',
  cspAllowedOrigins: [],
  customerDataRetentionMonths: 0,
  ipRetentionDays: 90,
};

export interface PublicLocale {
  code: string;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  isDefault: boolean;
}

/** Everything the public site needs at boot (one request, cached). */
export interface PublicSettings {
  site: Site;
  theme: Theme;
  features: Features;
  locales: PublicLocale[];
  defaultLocale: string;
  /** Website security headers (the CSP is public anyway — it is sent with every page). */
  security: Pick<SecuritySettings, 'cspMode' | 'cspAllowedOrigins'>;
  /** Bot check widget for checkout & bookings; `null` when not configured or switched off. */
  captcha: { provider: 'turnstile'; siteKey: string } | null;
}

/** CSS custom properties for the theme. Injected in <head> by the website. */
export function themeToCss(theme: Theme): string {
  const c = theme.colors;
  const fontFace = (f: Theme['fonts']['display']) =>
    f.woff2 || f.woff
      ? `@font-face{font-display:swap;font-family:"${f.family}";font-style:normal;${f.sizeAdjust ? `size-adjust:${f.sizeAdjust}%;` : ''}src:${[
          f.woff2 && `url(${f.woff2}) format("woff2")`,
          f.woff && `url(${f.woff}) format("woff")`,
        ]
          .filter(Boolean)
          .join(',')}}`
      : '';
  return [
    fontFace(theme.fonts.display),
    fontFace(theme.fonts.regular),
    `html:root{--c-bg:${c.bg};--c-text-alt:${c.textAlt};--c-accent:${c.accent};--c-secondary:${c.secondary};--c-accent-dark:${c.accentDark};--radius:${theme.radius}rem;--width:${theme.grid.mobileWidth}vw;--ff-base:"${theme.fonts.display.family}",${theme.fonts.display.fallback};--ff-regular:"${theme.fonts.regular.family}",${theme.fonts.regular.fallback};--c-logo:${c.logo || '#cb9f57'};--c-footer-links:${c.footerLinks || c.secondary};--c-nav-links:${c.navLinks || c.secondary};--c-menu-links:${c.menuLinks || c.secondary}}`,
    `@media screen and (min-width:960px){html:root{--width:${theme.grid.tabletWidth}vw}}`,
    `@media screen and (min-width:1280px){html:root{--width:${theme.grid.desktopWidth}vw}}`,
  ].join('\n');
}
