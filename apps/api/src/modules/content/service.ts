import {
  collectionTypes,
  contentSchema,
  getContentType,
  isContainer,
  mergeContent,
  splitContent,
  translationCoverage,
  type ContentTypeDef,
  type Doc,
  type Entry,
  type Field,
} from '@app/shared/content';
import { prisma, type Prisma } from '../../db.ts';
import { badRequest, notFound } from '../../lib/http.ts';
import { revalidate } from '../../lib/revalidate.ts';
import { sanitizeRichText } from '../../lib/sanitize.ts';
import { getDefaultLocale } from '../settings/service.ts';

export const SINGLETON_SLUG = 'singleton';
const CATALOG_TYPES = new Set(['product', 'productType', 'flavor', 'globals']);

export function requireType(key: string): ContentTypeDef {
  const def = getContentType(key);
  if (!def) throw notFound('Content type');
  return def;
}

type EntryWithTranslations = Prisma.ContentEntryGetPayload<{ include: { translations: true } }>;

function resolveEntry(def: ContentTypeDef, entry: EntryWithTranslations, locale: string, defaultLocale: string): Doc {
  const own = entry.translations.find((t) => t.locale === locale)?.data as Doc | undefined;
  const fallback = entry.translations.find((t) => t.locale === defaultLocale)?.data as Doc | undefined;
  return mergeContent(def.fields, entry.data as Doc, own ?? {}, locale === defaultLocale ? {} : (fallback ?? {}));
}

function translationsFilter(locale: string, defaultLocale: string) {
  return { where: { locale: { in: [...new Set([locale, defaultLocale])] } } };
}

/* ─────────────── Public reads ─────────────── */

export async function getSingleton(type: string, locale: string): Promise<Doc> {
  const def = requireType(type);
  if (def.kind !== 'singleton') throw badRequest('Not a singleton type');
  const defaultLocale = await getDefaultLocale();
  const entry = await prisma.contentEntry.findUnique({
    where: { type_slug: { type, slug: SINGLETON_SLUG } },
    include: { translations: translationsFilter(locale, defaultLocale) },
  });
  if (!entry) return mergeContent(def.fields, {}, {}, {});
  return resolveEntry(def, entry, locale, defaultLocale);
}

export async function listEntries<T = Doc>(type: string, locale: string, opts: { drafts?: boolean } = {}): Promise<Entry<T>[]> {
  const def = requireType(type);
  if (def.kind !== 'collection') throw badRequest('Not a collection type');
  const defaultLocale = await getDefaultLocale();
  const rows = await prisma.contentEntry.findMany({
    where: { type, ...(opts.drafts ? {} : { status: 'published' }) },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { translations: translationsFilter(locale, defaultLocale) },
  });
  return rows.map((r) => ({ id: r.id, slug: r.slug, sortOrder: r.sortOrder, data: resolveEntry(def, r, locale, defaultLocale) as T }));
}

export async function getEntryBySlug<T = Doc>(type: string, slug: string, locale: string): Promise<Entry<T>> {
  const def = requireType(type);
  const defaultLocale = await getDefaultLocale();
  const r = await prisma.contentEntry.findFirst({
    where: { type, slug, status: 'published' },
    include: { translations: translationsFilter(locale, defaultLocale) },
  });
  if (!r) throw notFound('Page');
  return { id: r.id, slug: r.slug, sortOrder: r.sortOrder, data: resolveEntry(def, r, locale, defaultLocale) as T };
}

/* ─────────────── Admin ─────────────── */

export async function getForEdit(id: string, locale: string) {
  const entry = await prisma.contentEntry.findUnique({ where: { id }, include: { translations: true } });
  if (!entry) throw notFound('Entry');
  const def = requireType(entry.type);
  const defaultLocale = await getDefaultLocale();
  const own = (entry.translations.find((t) => t.locale === locale)?.data ?? {}) as Doc;
  const fallback = (entry.translations.find((t) => t.locale === defaultLocale)?.data ?? {}) as Doc;
  const coverage = Object.fromEntries(
    entry.translations.map((t) => [t.locale, translationCoverage(def.fields, entry.data as Doc, t.data as Doc)]),
  );
  return {
    id: entry.id,
    type: entry.type,
    slug: entry.slug,
    status: entry.status,
    sortOrder: entry.sortOrder,
    updatedAt: entry.updatedAt,
    locale,
    defaultLocale,
    /** Values for this language only (empty = not translated yet). */
    data: mergeContent(def.fields, entry.data as Doc, own, {}),
    /** Default-language values, shown as placeholders while translating. */
    fallback: locale === defaultLocale ? null : mergeContent(def.fields, entry.data as Doc, fallback, {}),
    coverage,
  };
}

function sanitizeDoc(fields: Field[], doc: Doc): Doc {
  const out: Doc = { ...doc };
  for (const f of fields) {
    const v = doc[f.key];
    if (f.type === 'richtext' && typeof v === 'string') out[f.key] = sanitizeRichText(v);
    else if (isContainer(f) && Array.isArray(v)) {
      out[f.key] = v.map((item: Doc) => {
        const sub = f.type === 'list' ? f.fields : (f.blocks[item._type]?.fields ?? []);
        return sanitizeDoc(sub, item);
      });
    }
  }
  return out;
}

async function checkReferences(fields: Field[], doc: Doc) {
  for (const f of fields) {
    if (f.type !== 'reference' || !doc[f.key]) continue;
    const ref = await prisma.contentEntry.findUnique({ where: { id: String(doc[f.key]) }, select: { type: true } });
    if (!ref || ref.type !== f.to) throw badRequest(`"${f.label}" points to a missing ${f.to}`, 'invalid_reference');
  }
}

function tagsFor(type: string, slug: string) {
  const tags = [`content:${type}`, `content:${type}:${slug}`];
  if (CATALOG_TYPES.has(type)) tags.push('catalog');
  return tags;
}

export async function saveEntry(
  id: string,
  locale: string,
  input: { data: unknown; slug?: string; status?: 'draft' | 'published'; sortOrder?: number },
  user?: { id: string; name: string },
) {
  const entry = await prisma.contentEntry.findUnique({ where: { id }, include: { translations: true } });
  if (!entry) throw notFound('Entry');
  const def = requireType(entry.type);
  const localeRow = await prisma.locale.findUnique({ where: { code: locale } });
  if (!localeRow) throw badRequest('Unknown language');

  const parsed = contentSchema(def.fields).safeParse(input.data);
  if (!parsed.success) {
    throw badRequest(
      'Some fields are invalid',
      'validation_error',
      parsed.error.issues.map((i) => ({ path: i.path.filter((p): p is string | number => typeof p !== 'symbol'), message: i.message })),
    );
  }
  const clean = sanitizeDoc(def.fields, parsed.data as Doc);
  await checkReferences(def.fields, clean);
  const { shared, localized } = splitContent(def.fields, clean);

  // Preserve other languages' list-item translations for items that still exist.
  const slug = def.kind === 'collection' && input.slug ? normalizeSlug(input.slug) : entry.slug;
  if (def.kind === 'collection' && !slug) throw badRequest('Slug is required');

  await prisma.$transaction(async (tx) => {
    await tx.contentRevision.create({
      data: {
        entryId: entry.id,
        authorId: user?.id,
        author: user?.name,
        snapshot: { data: entry.data, slug: entry.slug, status: entry.status, translations: entry.translations.map((t) => ({ locale: t.locale, data: t.data })) } as any,
      },
    });
    await tx.contentEntry.update({
      where: { id },
      data: {
        data: shared as any,
        slug,
        status: input.status ?? entry.status,
        sortOrder: input.sortOrder ?? entry.sortOrder,
        updatedById: user?.id,
      },
    });
    await tx.contentTranslation.upsert({
      where: { entryId_locale: { entryId: id, locale } },
      create: { entryId: id, locale, data: localized as any },
      update: { data: localized as any },
    });
    // Keep only the 30 most recent revisions per entry.
    const old = await tx.contentRevision.findMany({
      where: { entryId: id },
      orderBy: { createdAt: 'desc' },
      skip: 30,
      select: { id: true },
    });
    if (old.length) await tx.contentRevision.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  });

  revalidate(...tagsFor(entry.type, entry.slug), ...(slug !== entry.slug ? tagsFor(entry.type, slug) : []));
  return getForEdit(id, locale);
}

export function normalizeSlug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export async function createEntry(type: string, input: { slug: string; locale: string; data?: unknown }, user?: { id: string; name: string }) {
  const def = requireType(type);
  if (def.kind !== 'collection') throw badRequest('Singletons cannot be created');
  const slug = normalizeSlug(input.slug);
  if (!slug) throw badRequest('Slug is required');
  const max = await prisma.contentEntry.aggregate({ where: { type }, _max: { sortOrder: true } });
  const entry = await prisma.contentEntry.create({
    data: { type, slug, status: 'draft', sortOrder: (max._max.sortOrder ?? 0) + 1, data: {}, updatedById: user?.id },
  });
  if (type === 'product') await prisma.productCommerce.create({ data: { productId: entry.id } });
  if (input.data) return saveEntry(entry.id, input.locale, { data: input.data }, user);
  return getForEdit(entry.id, input.locale);
}

export async function deleteEntry(id: string) {
  const entry = await prisma.contentEntry.findUnique({ where: { id } });
  if (!entry) throw notFound('Entry');
  const def = requireType(entry.type);
  if (def.kind === 'singleton') throw badRequest('Singletons cannot be deleted');
  // Refuse to delete referenced entries (e.g. a flavor still used by products).
  const referencing = await prisma.contentEntry.findMany({ where: { type: 'product' }, select: { slug: true, data: true } });
  const users = referencing.filter((p) => (p.data as Doc)?.type === id || (p.data as Doc)?.flavor === id);
  if (users.length) throw badRequest(`Still used by: ${users.map((u) => u.slug).join(', ')}`, 'in_use');
  await prisma.contentEntry.delete({ where: { id } });
  revalidate(...tagsFor(entry.type, entry.slug));
}

export async function reorderEntries(type: string, ids: string[]) {
  requireType(type);
  await prisma.$transaction(ids.map((id, i) => prisma.contentEntry.update({ where: { id }, data: { sortOrder: i + 1 } })));
  revalidate(`content:${type}`, ...(CATALOG_TYPES.has(type) ? ['catalog'] : []));
}

export async function listForAdmin(type: string, locale: string) {
  const def = requireType(type);
  const rows = await prisma.contentEntry.findMany({
    where: { type },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { translations: true, commerce: true, prices: true },
  });
  const defaultLocale = await getDefaultLocale();
  const titleField = def.fields.find((f) => ['title', 'name'].includes(f.key))?.key ?? 'title';
  // A product's name is its flavor's name (its own title is a tagline), so the list shows "Margherita — Simple and perfect".
  const flavorNames = new Map<string, string>();
  if (type === 'product') {
    const flavorDef = requireType('flavor');
    const flavors = await prisma.contentEntry.findMany({ where: { type: 'flavor' }, include: { translations: true } });
    for (const f of flavors) {
      const name = resolveEntry(flavorDef, f, locale, defaultLocale).name;
      if (typeof name === 'string' && name.trim()) flavorNames.set(f.id, name.trim());
    }
  }
  return rows.map((r) => {
    const data = resolveEntry(def, r, locale, defaultLocale);
    const own = (data[titleField] as string | null)?.replace(/\s*\n\s*/g, ' ').trim();
    const flavor = typeof data.flavor === 'string' ? flavorNames.get(data.flavor) : undefined;
    return {
      id: r.id,
      slug: r.slug,
      status: r.status,
      sortOrder: r.sortOrder,
      updatedAt: r.updatedAt,
      title: [flavor, own].filter(Boolean).join(' — ') || r.slug,
      image: (data.image as { url?: string } | null)?.url ?? null,
      translated: r.translations.map((t) => t.locale),
      commerce: r.commerce,
      priceCount: r.prices.length,
    };
  });
}

export async function listRevisions(entryId: string) {
  return prisma.contentRevision.findMany({
    where: { entryId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, author: true, createdAt: true },
  });
}

export async function restoreRevision(entryId: string, revisionId: string) {
  const rev = await prisma.contentRevision.findFirst({ where: { id: revisionId, entryId } });
  if (!rev) throw notFound('Revision');
  const snap = rev.snapshot as { data: Doc; slug: string; status: 'draft' | 'published'; translations: { locale: string; data: Doc }[] };
  const entry = await prisma.contentEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw notFound('Entry');
  await prisma.$transaction(async (tx) => {
    await tx.contentEntry.update({ where: { id: entryId }, data: { data: snap.data as any, slug: snap.slug, status: snap.status } });
    for (const t of snap.translations) {
      const exists = await tx.locale.findUnique({ where: { code: t.locale } });
      if (!exists) continue;
      await tx.contentTranslation.upsert({
        where: { entryId_locale: { entryId, locale: t.locale } },
        create: { entryId, locale: t.locale, data: t.data as any },
        update: { data: t.data as any },
      });
    }
  });
  revalidate(...tagsFor(entry.type, entry.slug), ...tagsFor(entry.type, snap.slug));
}

