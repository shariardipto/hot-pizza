import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { singletonTypes } from '@app/shared/content';
import { languageInfo } from '@app/shared/i18n';
import { prisma } from '../../db.ts';
import { audit } from '../../lib/audit.ts';
import { badRequest, handler, notFound, parse } from '../../lib/http.ts';
import { revalidate } from '../../lib/revalidate.ts';
import { requirePermission } from '../../middleware/auth.ts';
import {
  createEntry,
  deleteEntry,
  getForEdit,
  listForAdmin,
  listRevisions,
  reorderEntries,
  requireType,
  restoreRevision,
  saveEntry,
  SINGLETON_SLUG,
} from '../../modules/content/service.ts';
import { deleteMedia, listMedia, saveUpload } from '../../modules/media/service.ts';
import { getDefaultLocale, invalidateSettings } from '../../modules/settings/service.ts';

export const contentAdmin = Router();
const userOf = (req: any) => (req.session ? { id: req.session.user.id, name: req.session.user.name } : undefined);
const localeQ = async (q: unknown) => (typeof q === 'string' && q ? q : getDefaultLocale());

/* ─────────────── Content ─────────────── */

contentAdmin.get(
  '/singletons/:type',
  requirePermission('content.edit'),
  handler<{ type: string }>(async (req, res) => {
    const def = requireType(req.params.type);
    if (def.kind !== 'singleton') throw badRequest('Not a singleton');
    const entry = await prisma.contentEntry.upsert({
      where: { type_slug: { type: def.key, slug: SINGLETON_SLUG } },
      create: { type: def.key, slug: SINGLETON_SLUG, data: {} },
      update: {},
    });
    res.json(await getForEdit(entry.id, await localeQ(req.query.locale)));
  }),
);

contentAdmin.get(
  '/singletons',
  requirePermission('content.edit'),
  handler(async (_req, res) => {
    const rows = await prisma.contentEntry.findMany({ where: { slug: SINGLETON_SLUG }, select: { type: true, updatedAt: true } });
    res.json(Object.values(singletonTypes).map((d) => ({ key: d.key, label: d.label, description: d.description, updatedAt: rows.find((r) => r.type === d.key)?.updatedAt ?? null })));
  }),
);

contentAdmin.get(
  '/collections/:type',
  requirePermission('content.edit'),
  handler<{ type: string }>(async (req, res) => {
    res.json(await listForAdmin(req.params.type, await localeQ(req.query.locale)));
  }),
);

contentAdmin.post(
  '/collections/:type',
  requirePermission('content.edit'),
  handler<{ type: string }>(async (req, res) => {
    const body = parse(z.object({ slug: z.string().min(1).max(120), locale: z.string().optional(), data: z.any().optional() }), req.body);
    const created = await createEntry(req.params.type, { slug: body.slug, locale: body.locale ?? (await getDefaultLocale()), data: body.data }, userOf(req));
    await audit(req, 'content.create', req.params.type, created.id, { slug: created.slug });
    res.status(201).json(created);
  }),
);

contentAdmin.post(
  '/collections/:type/reorder',
  requirePermission('content.edit'),
  handler<{ type: string }>(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.string()).max(500) }), req.body);
    await reorderEntries(req.params.type, ids);
    res.json({ ok: true });
  }),
);

contentAdmin.get(
  '/entries/:id',
  requirePermission('content.edit'),
  handler<{ id: string }>(async (req, res) => {
    res.json(await getForEdit(req.params.id, await localeQ(req.query.locale)));
  }),
);

contentAdmin.put(
  '/entries/:id',
  requirePermission('content.edit'),
  handler<{ id: string }>(async (req, res) => {
    const body = parse(
      z.object({
        locale: z.string().min(2),
        data: z.record(z.string(), z.any()),
        slug: z.string().max(120).optional(),
        status: z.enum(['draft', 'published']).optional(),
        sortOrder: z.number().int().optional(),
      }),
      req.body,
    );
    const saved = await saveEntry(req.params.id, body.locale, body, userOf(req));
    await audit(req, 'content.update', saved.type, saved.id, { locale: body.locale, slug: saved.slug, status: saved.status });
    res.json(saved);
  }),
);

contentAdmin.delete(
  '/entries/:id',
  requirePermission('content.edit'),
  handler<{ id: string }>(async (req, res) => {
    await deleteEntry(req.params.id);
    await audit(req, 'content.delete', 'entry', req.params.id);
    res.status(204).end();
  }),
);

contentAdmin.get(
  '/entries/:id/revisions',
  requirePermission('content.edit'),
  handler<{ id: string }>(async (req, res) => res.json(await listRevisions(req.params.id))),
);

contentAdmin.post(
  '/entries/:id/revisions/:rev/restore',
  requirePermission('content.edit'),
  handler<{ id: string; rev: string }>(async (req, res) => {
    await restoreRevision(req.params.id, req.params.rev);
    await audit(req, 'content.restore', 'entry', req.params.id, { revision: req.params.rev });
    res.json(await getForEdit(req.params.id, await localeQ(req.query.locale)));
  }),
);

/* ─────────────── Media ─────────────── */

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

contentAdmin.get(
  '/media',
  requirePermission('media.manage'),
  handler(async (req, res) => {
    const q = parse(
      z.object({
        q: z.string().optional(),
        folder: z.string().optional(),
        type: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(60),
      }),
      req.query,
    );
    res.json(await listMedia(q));
  }),
);

contentAdmin.post(
  '/media',
  requirePermission('media.manage'),
  upload.array('files', 20),
  handler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw badRequest('No file uploaded');
    const folder = typeof req.body.folder === 'string' ? req.body.folder : '';
    const saved = [];
    for (const f of files) saved.push(await saveUpload(f, { folder, userId: req.session?.user.id }));
    await audit(req, 'media.upload', 'media', null, { files: saved.map((s) => s.storageKey) });
    res.status(201).json(saved);
  }),
);

contentAdmin.patch(
  '/media/:id',
  requirePermission('media.manage'),
  handler<{ id: string }>(async (req, res) => {
    const body = parse(z.object({ alt: z.string().max(300).nullable().optional(), folder: z.string().max(80).optional() }), req.body);
    res.json(await prisma.media.update({ where: { id: req.params.id }, data: body }));
  }),
);

contentAdmin.delete(
  '/media/:id',
  requirePermission('media.manage'),
  handler<{ id: string }>(async (req, res) => {
    await deleteMedia(req.params.id);
    await audit(req, 'media.delete', 'media', req.params.id);
    res.status(204).end();
  }),
);

/* ─────────────── Languages ─────────────── */

contentAdmin.get(
  '/locales',
  requirePermission('content.edit'),
  handler(async (_req, res) => {
    const [locales, counts, totalEntries] = await Promise.all([
      prisma.locale.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      prisma.contentTranslation.groupBy({ by: ['locale'], _count: { _all: true } }),
      prisma.contentEntry.count(),
    ]);
    res.json(locales.map((l) => ({ ...l, translatedEntries: counts.find((c) => c.locale === l.code)?._count._all ?? 0, totalEntries })));
  }),
);

contentAdmin.post(
  '/locales',
  requirePermission('locales.manage'),
  handler(async (req, res) => {
    const body = parse(
      z.object({
        code: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Use a BCP 47 code like "fr" or "pt-BR"'),
        name: z.string().max(60).optional(),
        nativeName: z.string().max(60).optional(),
        dir: z.enum(['ltr', 'rtl']).optional(),
        /** Copy all texts from this language as a starting point for translation. */
        copyFrom: z.string().optional(),
      }),
      req.body,
    );
    const info = languageInfo(body.code);
    const max = await prisma.locale.aggregate({ _max: { sortOrder: true } });
    const locale = await prisma.locale.create({
      data: {
        code: body.code,
        name: body.name || info.name,
        nativeName: body.nativeName || info.nativeName,
        dir: body.dir ?? info.dir,
        enabled: false,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    if (body.copyFrom) {
      const source = await prisma.contentTranslation.findMany({ where: { locale: body.copyFrom } });
      if (source.length) {
        await prisma.contentTranslation.createMany({ data: source.map((s) => ({ entryId: s.entryId, locale: body.code, data: s.data as any })) });
      }
    }
    await audit(req, 'locale.create', 'locale', body.code, body);
    res.status(201).json(locale);
  }),
);

contentAdmin.patch(
  '/locales/:code',
  requirePermission('locales.manage'),
  handler<{ code: string }>(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().max(60).optional(),
        nativeName: z.string().max(60).optional(),
        dir: z.enum(['ltr', 'rtl']).optional(),
        enabled: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
      req.body,
    );
    const current = await prisma.locale.findUnique({ where: { code: req.params.code } });
    if (!current) throw notFound('Language');
    if (current.isDefault && body.enabled === false) throw badRequest('The default language cannot be disabled');
    const updated = await prisma.locale.update({ where: { code: req.params.code }, data: body });
    invalidateSettings();
    revalidate('settings', 'content', 'catalog');
    await audit(req, 'locale.update', 'locale', req.params.code, body);
    res.json(updated);
  }),
);

contentAdmin.post(
  '/locales/:code/default',
  requirePermission('locales.manage'),
  handler<{ code: string }>(async (req, res) => {
    await prisma.$transaction([
      prisma.locale.updateMany({ data: { isDefault: false } }),
      prisma.locale.update({ where: { code: req.params.code }, data: { isDefault: true, enabled: true } }),
    ]);
    invalidateSettings();
    revalidate('settings', 'content', 'catalog');
    await audit(req, 'locale.default', 'locale', req.params.code);
    res.json({ ok: true });
  }),
);

contentAdmin.delete(
  '/locales/:code',
  requirePermission('locales.manage'),
  handler<{ code: string }>(async (req, res) => {
    const l = await prisma.locale.findUnique({ where: { code: req.params.code } });
    if (!l) throw notFound('Language');
    if (l.isDefault) throw badRequest('Choose another default language before deleting this one');
    await prisma.locale.delete({ where: { code: req.params.code } });
    invalidateSettings();
    revalidate('settings', 'content', 'catalog');
    await audit(req, 'locale.delete', 'locale', req.params.code);
    res.status(204).end();
  }),
);
