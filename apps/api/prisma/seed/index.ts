/**
 * Seeds a fresh database with the default "PIZZA" restaurant demo:
 *  - English (add more languages in Admin → Languages)
 *  - every page, interface text and legal page, 4 menu categories × 2 pizzas, flavors and their colors
 *  - the media library (demo photos from Pexels, stored as WebP — see assets/media/SOURCES.md)
 *  - markets (EU, UK, US, CA, BD, IN, Asia, rest of world) with COD rules and demo prices
 *  - three restaurants (reservations + pick-up) and the first admin user
 *
 * Re-running is safe: existing content is left untouched unless `--force` is passed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { contentTypes, newItemId, splitContent, type Doc } from '@app/shared/content';
import { defaultCommerce, defaultFeatures, defaultSite, defaultTheme } from '@app/shared/theme';
import { toMinor } from '@app/shared/commerce';
import { auth } from '../../src/auth.ts';
import { prisma } from '../../src/db.ts';
import { toWebp } from '../../src/modules/media/image.ts';
import { UPLOADS_DIR } from '../../src/modules/media/storage.ts';
import { ABOUT, CATEGORIES, CONTACT, FLAVORS, GLOBALS, HOME, LOCATIONS, LOCATIONS_PAGE, PRODUCTS, PRODUCTS_PAGE, type Img } from './demo.ts';
import { LEGAL } from './legal.ts';
import { UI_EN } from './ui.ts';

const FORCE = process.argv.includes('--force');
const MEDIA = path.join(import.meta.dirname, 'assets', 'media');
const LOCALE = 'en';
const log = (...a: unknown[]) => console.log('🌱', ...a);

/* ───────────────────────────── Media ───────────────────────────── */

const media = new Map<string, { url: string; width?: number; height?: number }>();

async function importMedia() {
  const files = (await fs.readdir(MEDIA)).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));
  await fs.mkdir(path.join(UPLOADS_DIR, 'cms'), { recursive: true });
  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    const key = `cms/${name}.webp`;
    const target = path.join(UPLOADS_DIR, key);
    const existing = await fs.readFile(target).catch(() => null);
    // --force also refreshes demo images whose file changed; identical files are left alone (keeps the resize cache).
    if (!existing || FORCE) {
      const ext = path.extname(file).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const { buffer } = await toWebp(await fs.readFile(path.join(MEDIA, file)), mime);
      if (!existing || !existing.equals(buffer)) await fs.writeFile(target, buffer);
    }
    const stored = await fs.readFile(target);
    const meta = await sharp(stored).metadata();
    const url = `/uploads/${key}`;
    await prisma.media.upsert({
      where: { storageKey: key },
      create: { storageKey: key, url, filename: `${name}.webp`, mimeType: 'image/webp', size: stored.length, width: meta.width, height: meta.height, folder: 'cms' },
      update: { url, size: stored.length, width: meta.width, height: meta.height },
    });
    media.set(name, { url, width: meta.width, height: meta.height });
  }
  log(`media: ${files.length} images`);
}

/** Demo image → content image value. */
function img(i: Img | null | undefined) {
  if (!i) return null;
  const m = media.get(i.file);
  if (!m) throw new Error(`Missing demo image ${i.file}`);
  return { url: m.url, width: m.width, height: m.height, alt: i.alt };
}
const file = (name: string) => img({ file: name, alt: '' });

/* ───────────────────────────── Entry writer ───────────────────────────── */

async function writeEntry(type: string, slug: string, doc: Doc, opts: { sortOrder?: number } = {}) {
  const def = contentTypes[type]!;
  const existing = await prisma.contentEntry.findUnique({ where: { type_slug: { type, slug } } });
  if (existing && !FORCE) return existing;
  const { shared, localized } = splitContent(def.fields, doc);
  const entry = await prisma.contentEntry.upsert({
    where: { type_slug: { type, slug } },
    create: { type, slug, data: shared as any, sortOrder: opts.sortOrder ?? 0, status: 'published' },
    update: { data: shared as any, sortOrder: opts.sortOrder ?? 0, status: 'published' },
  });
  await prisma.contentTranslation.upsert({
    where: { entryId_locale: { entryId: entry.id, locale: LOCALE } },
    create: { entryId: entry.id, locale: LOCALE, data: localized as any },
    update: { data: localized as any },
  });
  return entry;
}

/** Stable `_id`s for list items. */
const withIds = <T extends Doc>(items: T[]) => items.map((i) => ({ ...i, _id: newItemId() }));
const SINGLETON = 'singleton';

/* ───────────────────────────── Content ───────────────────────────── */

async function seedContent() {
  await writeEntry('home', SINGLETON, {
    ...HOME,
    heroImage: img(HOME.heroImage),
    imageLeft: img(HOME.imageLeft),
    imageCenter: img(HOME.imageCenter),
    imageRight: img(HOME.imageRight),
    bigSectionImage: img(HOME.bigSectionImage),
    awardImage: img(HOME.awardImage),
    metaImage: null,
  });
  await writeEntry('about', SINGLETON, {
    ...ABOUT,
    heroImage: img(ABOUT.heroImage),
    chapters: withIds(ABOUT.chapters.map((c) => ('image' in c ? { _type: 'image', image: img(c.image) } : c))),
    metaImage: null,
  });
  await writeEntry('productsPage', SINGLETON, { ...PRODUCTS_PAGE, image: img(PRODUCTS_PAGE.image), metaImage: null });
  await writeEntry('contact', SINGLETON, { ...CONTACT, image: img(CONTACT.image), metaImage: null });
  await writeEntry('locationsPage', SINGLETON, { ...LOCATIONS_PAGE, image: img(LOCATIONS_PAGE.image), metaImage: null });
  await writeEntry('globals', SINGLETON, {
    ...GLOBALS,
    email: withIds(GLOBALS.email),
    instagram: withIds(GLOBALS.instagram),
    youtube: withIds(GLOBALS.youtube),
    facebook: withIds(GLOBALS.facebook),
  });
  await writeEntry('ui', SINGLETON, UI_EN);

  let order = 0;
  for (const l of LEGAL) {
    await writeEntry('legal', l.slug, { title: l.title, subtitle: l.subtitle, content: l.content, metaTitle: l.metaTitle, metaDescription: null, metaImage: null }, { sortOrder: ++order });
  }

  const categoryIds = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const { slug, ...doc } = c;
    const e = await writeEntry('productType', slug, { ...doc, image: img(c.image) }, { sortOrder: i + 1 });
    categoryIds.set(slug, e.id);
  }
  const flavorIds = new Map<string, string>();
  for (const [i, f] of FLAVORS.entries()) {
    const { slug, ...doc } = f;
    const e = await writeEntry('flavor', slug, doc, { sortOrder: i + 1 });
    flavorIds.set(slug, e.id);
  }
  const productIds = new Map<string, { id: string; price: number }>();
  for (const [i, p] of PRODUCTS.entries()) {
    const { slug, category, flavor, gallery, price, ...doc } = p;
    const e = await writeEntry(
      'product',
      slug,
      {
        ...doc,
        type: categoryIds.get(category),
        flavor: flavorIds.get(flavor),
        image: img(p.image),
        gallery: withIds(gallery.map((g) => ({ image: file(g) }))),
        metaImage: null,
      },
      { sortOrder: i + 1 },
    );
    productIds.set(slug, { id: e.id, price });
  }
  log(`content: ${await prisma.contentEntry.count()} entries`);
  return productIds;
}

/* ───────────────────────────── Commerce ───────────────────────────── */

const EU = ['ES', 'PT', 'FR', 'DE', 'IT', 'NL', 'BE', 'LU', 'IE', 'AT', 'FI', 'SE', 'DK', 'PL', 'CZ', 'SK', 'SI', 'HR', 'HU', 'RO', 'BG', 'GR', 'CY', 'MT', 'EE', 'LV', 'LT', 'AD', 'MC'];
const ASIA = ['PK', 'NP', 'LK', 'BT', 'MV', 'MY', 'SG', 'ID', 'PH', 'TH', 'VN', 'KH', 'LA', 'MM', 'BN', 'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JP', 'KR', 'CN', 'HK', 'MO', 'TW'];

async function seedMarkets() {
  if ((await prisma.market.count()) && !FORCE) return;
  const m = (major: number, cur: string) => toMinor(major, cur);
  const markets = [
    { code: 'eu', name: 'Spain & EU', currency: 'EUR', countries: EU, isDefault: true, exchangeRate: 1, rounding: 'none', taxRate: 10, taxInclusive: true, taxLabel: 'VAT', pickupEnabled: true, shippingFee: m(2.95, 'EUR'), freeShippingThreshold: m(30, 'EUR'), minOrderAmount: m(12, 'EUR'), codEnabled: false, codFee: 0, codMaxAmount: null, paymentProviders: ['stripe', 'paypal'] },
    { code: 'uk', name: 'United Kingdom', currency: 'GBP', countries: ['GB', 'IM', 'JE', 'GG'], exchangeRate: 0.86, rounding: 'x99', taxRate: 0, taxInclusive: true, taxLabel: 'VAT', shippingFee: m(2.95, 'GBP'), freeShippingThreshold: m(30, 'GBP'), codEnabled: false, paymentProviders: ['stripe', 'paypal'] },
    { code: 'us', name: 'United States', currency: 'USD', countries: ['US', 'PR'], exchangeRate: 1.08, rounding: 'x99', taxRate: 0, taxInclusive: false, taxLabel: 'Sales tax', shippingFee: m(3.99, 'USD'), freeShippingThreshold: m(35, 'USD'), codEnabled: false, paymentProviders: ['stripe', 'paypal'] },
    { code: 'ca', name: 'Canada', currency: 'CAD', countries: ['CA'], exchangeRate: 1.48, rounding: 'x99', taxRate: 5, taxInclusive: false, taxLabel: 'GST', shippingFee: m(4.99, 'CAD'), freeShippingThreshold: m(45, 'CAD'), codEnabled: false, paymentProviders: ['stripe', 'paypal'] },
    { code: 'bd', name: 'Bangladesh', currency: 'BDT', countries: ['BD'], exchangeRate: 130, rounding: 'whole', taxRate: 0, taxInclusive: true, taxLabel: 'VAT', shippingFee: m(80, 'BDT'), freeShippingThreshold: m(3000, 'BDT'), codEnabled: true, codFee: 0, codMaxAmount: m(20000, 'BDT'), paymentProviders: ['sslcommerz'] },
    { code: 'in', name: 'India', currency: 'INR', countries: ['IN'], exchangeRate: 90, rounding: 'whole', taxRate: 5, taxInclusive: true, taxLabel: 'GST', shippingFee: m(49, 'INR'), freeShippingThreshold: m(999, 'INR'), codEnabled: true, codFee: m(29, 'INR'), codMaxAmount: m(10000, 'INR'), paymentProviders: ['razorpay'] },
    { code: 'asia', name: 'Asia', currency: 'USD', countries: ASIA, exchangeRate: 1.08, rounding: 'x99', taxRate: 0, taxInclusive: true, taxLabel: 'Tax', shippingFee: m(3.99, 'USD'), freeShippingThreshold: m(40, 'USD'), codEnabled: true, codFee: m(1, 'USD'), codMaxAmount: m(300, 'USD'), paymentProviders: ['stripe', 'paypal'] },
    { code: 'world', name: 'Rest of the world', currency: 'USD', countries: [], isFallback: true, exchangeRate: 1.08, rounding: 'x99', taxRate: 0, taxInclusive: true, taxLabel: 'Tax', shippingFee: m(4.99, 'USD'), freeShippingThreshold: null, codEnabled: false, paymentProviders: ['stripe', 'paypal'] },
  ];
  let i = 0;
  for (const mk of markets) {
    await prisma.market.upsert({ where: { code: mk.code }, create: { ...mk, sortOrder: ++i }, update: { ...mk, sortOrder: i } });
  }
  log(`markets: ${markets.length} (COD in ${markets.filter((x) => x.codEnabled).map((x) => x.name).join(', ')})`);
}

async function seedCommerce(productIds: Map<string, { id: string; price: number }>) {
  const eu = await prisma.market.findUnique({ where: { code: 'eu' } });
  if (!eu) return;
  // Demo prices in EUR — edit them in Catalog → product → Prices & stock. Other markets convert automatically.
  for (const [slug, { id, price }] of productIds) {
    await prisma.productCommerce.upsert({
      where: { productId: id },
      create: { productId: id, sku: `PZ-${slug.toUpperCase()}`, orderable: true, trackStock: false, stock: 0, maxPerOrder: 20 },
      update: {},
    });
    const exists = await prisma.productPrice.findUnique({ where: { productId_marketId: { productId: id, marketId: eu.id } } });
    if (!exists) await prisma.productPrice.create({ data: { productId: id, marketId: eu.id, amount: toMinor(price, 'EUR') } });
  }
  log(`products: ${productIds.size} orderable (demo EUR prices)`);
}

async function seedLocations() {
  if ((await prisma.location.count()) && !FORCE) return;
  for (const [i, l] of LOCATIONS.entries()) {
    const data = {
      ...l,
      country: 'ES',
      timezone: 'Europe/Madrid',
      isActive: true,
      acceptsReservations: true,
      acceptsPickup: true,
      slotInterval: 30,
      reservationDuration: 90,
      minPartySize: 1,
      maxPartySize: 12,
      leadTimeMinutes: 60,
      maxAdvanceDays: 60,
      autoConfirm: false,
      closedDates: [],
      sortOrder: i,
    };
    await prisma.location.upsert({ where: { slug: l.slug }, create: data, update: data });
  }
  log(`locations: ${LOCATIONS.map((l) => l.name).join(', ')}`);
}

/* ───────────────────────────── Settings, languages, admin ───────────────────────────── */

async function seedBasics() {
  await prisma.locale.upsert({ where: { code: LOCALE }, create: { code: LOCALE, name: 'English', nativeName: 'English', isDefault: true, enabled: true, sortOrder: 0 }, update: {} });
  const settings = { site: defaultSite, theme: defaultTheme, features: defaultFeatures, commerce: defaultCommerce };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value: value as any }, update: FORCE ? { value: value as any } : {} });
  }
  await prisma.$executeRaw`INSERT INTO "counter" ("key","value") VALUES ('order', 10000) ON CONFLICT DO NOTHING`;
  log('language: en · settings: defaults');
}

async function seedAdmin() {
  if (await prisma.user.count()) return;
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  await auth.api.createUser({ body: { email, password, name: process.env.SEED_ADMIN_NAME || 'Site Admin', role: 'admin' as any } });
  log(`admin user: ${email} (change the password after first sign-in)`);
}

async function main() {
  await seedBasics();
  await importMedia();
  const productIds = await seedContent();
  await seedMarkets();
  await seedCommerce(productIds);
  await seedLocations();
  await seedAdmin();
  log('done ✔');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
