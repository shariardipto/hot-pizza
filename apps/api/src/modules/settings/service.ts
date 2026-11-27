import {
  commerceSchema,
  defaultCommerce,
  defaultSecurity,
  securitySchema,
  defaultFeatures,
  defaultSite,
  defaultTheme,
  featuresSchema,
  siteSchema,
  themeSchema,
  type CommerceSettings,
  type Features,
  type PublicSettings,
  type SecuritySettings,
  type Site,
  type Theme,
} from '@app/shared/theme';
import type { z } from 'zod';
import { prisma } from '../../db.ts';
import { captchaConfigured } from '../../lib/captcha.ts';
import { env } from '../../env.ts';

export const SETTINGS = {
  site: { schema: siteSchema, defaults: defaultSite },
  theme: { schema: themeSchema, defaults: defaultTheme },
  features: { schema: featuresSchema, defaults: defaultFeatures },
  commerce: { schema: commerceSchema, defaults: defaultCommerce },
  security: { schema: securitySchema, defaults: defaultSecurity },
} as const;
export type SettingKey = keyof typeof SETTINGS;
type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]['schema']>;

let cache: { at: number; values: Partial<Record<SettingKey, unknown>> } | null = null;
const TTL = 30_000;

/** Deep-merge stored JSON over defaults so new settings fields get sensible values after upgrades. */
function withDefaults<T>(defaults: T, stored: unknown): T {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored) || defaults === null || typeof defaults !== 'object') {
    return (stored ?? defaults) as T;
  }
  const out: any = Array.isArray(defaults) ? [...(defaults as any)] : { ...(defaults as any) };
  for (const [k, v] of Object.entries(stored as object)) {
    const d = (defaults as any)[k];
    out[k] = d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' ? withDefaults(d, v) : v;
  }
  return out;
}

async function load() {
  if (cache && Date.now() - cache.at < TTL) return cache.values;
  const rows = await prisma.setting.findMany();
  const values: Partial<Record<SettingKey, unknown>> = {};
  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    const row = rows.find((r) => r.key === key);
    const merged = withDefaults(SETTINGS[key].defaults, row?.value);
    // Upgrade: themes saved before the footer/navigation/menu link colors existed keep their look — those links used
    // the secondary color.
    if (key === 'theme') {
      const saved = (row?.value as { colors?: Record<string, string | undefined> } | undefined)?.colors;
      const colors = (merged as { colors: Record<string, string> }).colors;
      for (const k of ['footerLinks', 'navLinks', 'menuLinks']) if (saved && !saved[k] && saved.secondary) colors[k] = saved.secondary;
    }
    // Parsing strips keys of removed options and validates older stored values.
    const parsed = SETTINGS[key].schema.safeParse(merged);
    values[key] = parsed.success ? parsed.data : merged;
  }
  cache = { at: Date.now(), values };
  return values;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  return (await load())[key] as SettingValue<K>;
}

export async function setSetting<K extends SettingKey>(key: K, value: unknown, userId?: string): Promise<SettingValue<K>> {
  const current = await getSetting(key);
  const merged = SETTINGS[key].schema.parse(withDefaults(current, value));
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: merged as any, updatedBy: userId },
    update: { value: merged as any, updatedBy: userId },
  });
  cache = null;
  return merged as SettingValue<K>;
}

export function invalidateSettings() {
  cache = null;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const [site, theme, features, security, locales] = await Promise.all([
    getSetting('site') as Promise<Site>,
    getSetting('theme') as Promise<Theme>,
    getSetting('features') as Promise<Features>,
    getSetting('security') as Promise<SecuritySettings>,
    prisma.locale.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
  ]);
  const defaultLocale = locales.find((l) => l.isDefault)?.code ?? locales[0]?.code ?? 'en';
  return {
    site,
    theme,
    features,
    defaultLocale,
    security: { cspMode: security.cspMode, cspAllowedOrigins: security.cspAllowedOrigins },
    captcha: security.captcha && captchaConfigured() ? { provider: 'turnstile', siteKey: env.TURNSTILE_SITE_KEY } : null,
    locales: locales.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      dir: l.dir === 'rtl' ? 'rtl' : 'ltr',
      isDefault: l.code === defaultLocale,
    })),
  };
}

export async function getCommerceSettings(): Promise<CommerceSettings> {
  return getSetting('commerce');
}

export async function getDefaultLocale(): Promise<string> {
  const l = await prisma.locale.findFirst({ where: { isDefault: true } });
  return l?.code ?? 'en';
}
