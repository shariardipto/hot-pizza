import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { z } from 'zod';
import { auth, ROLES } from '../../auth.ts';
import { prisma } from '../../db.ts';
import { audit } from '../../lib/audit.ts';
import { badRequest, handler, parse } from '../../lib/http.ts';
import { revalidate } from '../../lib/revalidate.ts';
import { can, PERMISSIONS, requireAuth, requirePermission, type Permission } from '../../middleware/auth.ts';
import { SETTINGS, getSetting, setSetting, type SettingKey } from '../../modules/settings/service.ts';
import { captchaConfigured } from '../../lib/captcha.ts';
import { eraseCustomerData, findCustomerData } from '../../modules/privacy/service.ts';

export const systemAdmin = Router();

systemAdmin.get('/me', requireAuth, handler(async (req, res) => {
  const u = req.session!.user;
  const [security, site] = await Promise.all([getSetting('security'), getSetting('site')]);
  res.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role, image: u.image, twoFactorEnabled: Boolean(u.twoFactorEnabled) },
    permissions: (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(u.role, p)),
    twoFactorRequired: security.requireTwoFactor,
    siteName: site.name,
  });
}));

/* ─────────────── Dashboard ─────────────── */

systemAdmin.get('/dashboard', requirePermission('dashboard.view'), handler(async (_req, res) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const since30 = new Date(now.getTime() - 29 * 86400_000);
  since30.setHours(0, 0, 0, 0);
  const today = now.toISOString().slice(0, 10);

  const [ordersToday, pendingOrders, revenue30, recentOrders, reservationsToday, pendingReservations, upcoming, topItems, byStatus] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.$queryRaw<{ day: Date; currency: string; total: bigint; orders: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, currency, SUM(total)::bigint AS total, COUNT(*)::bigint AS orders
      FROM "order" WHERE "createdAt" >= ${since30} AND status NOT IN ('cancelled') AND ("paymentStatus" = 'paid' OR "paymentMethod" = 'cod')
      GROUP BY 1, 2 ORDER BY 1`,
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, number: true, customerName: true, total: true, currency: true, status: true, paymentStatus: true, paymentMethod: true, createdAt: true } }),
    prisma.reservation.count({ where: { date: today, status: { in: ['pending', 'confirmed', 'seated'] } } }),
    prisma.reservation.count({ where: { status: 'pending' } }),
    prisma.reservation.findMany({
      where: { startsAt: { gte: now }, status: { in: ['pending', 'confirmed'] } },
      orderBy: { startsAt: 'asc' },
      take: 8,
      include: { location: { select: { name: true } } },
    }),
    prisma.orderItem.groupBy({ by: ['name'], _sum: { quantity: true }, where: { order: { createdAt: { gte: since30 }, status: { not: 'cancelled' } } }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  res.json({
    ordersToday,
    pendingOrders,
    reservationsToday,
    pendingReservations,
    revenue: revenue30.map((r) => ({ day: r.day.toISOString().slice(0, 10), currency: r.currency, total: Number(r.total), orders: Number(r.orders) })),
    recentOrders,
    upcomingReservations: upcoming,
    topProducts: topItems.map((t) => ({ name: t.name, quantity: t._sum.quantity ?? 0 })),
    ordersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
  });
}));

/* ─────────────── Settings ─────────────── */

systemAdmin.get('/settings', requirePermission('theme.manage'), handler(async (_req, res) => {
  const entries = await Promise.all((Object.keys(SETTINGS) as SettingKey[]).map(async (k) => [k, await getSetting(k)] as const));
  res.json(Object.fromEntries(entries));
}));

systemAdmin.put('/settings/:key', handler<{ key: string }>(async (req, res, next) => {
  const key = req.params.key as SettingKey;
  if (!(key in SETTINGS)) throw badRequest('Unknown setting');
  // Editors may change the look; everything else is admin-only.
  const perm: Permission = key === 'theme' ? 'theme.manage' : 'settings.manage';
  if (!can(req.session?.user.role, perm)) return requirePermission(perm)(req, res, next);
  // Don't let an admin lock everyone (incl. themselves) into 2FA before they have it.
  if (key === 'security' && req.body?.requireTwoFactor === true && !req.session?.user.twoFactorEnabled) {
    throw badRequest('Set up two-factor authentication for your own account first (Account → Security).', 'two_factor_self');
  }
  const value = await setSetting(key, req.body, req.session?.user.id);
  revalidate('settings', ...(key === 'features' ? ['content', 'catalog'] : []));
  await audit(req, 'settings.update', 'setting', key);
  res.json(value);
}));

/* ─────────────── Users ─────────────── */

systemAdmin.get('/users', requirePermission('users.manage'), handler(async (_req, res) => {
  res.json(
    await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, banned: true, banReason: true, twoFactorEnabled: true, createdAt: true, sessions: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 } },
    }),
  );
}));

const roleSchema = z.enum(ROLES);

systemAdmin.post('/users', requirePermission('users.manage'), handler(async (req, res) => {
  const body = parse(z.object({ name: z.string().min(1).max(120), email: z.email(), password: z.string().min(10).max(128), role: roleSchema }), req.body);
  const created = await auth.api.createUser({ body: { name: body.name, email: body.email.toLowerCase(), password: body.password, role: body.role as any }, headers: fromNodeHeaders(req.headers) });
  await audit(req, 'user.create', 'user', created.user.id, { email: body.email, role: body.role });
  res.status(201).json(created.user);
}));

systemAdmin.patch('/users/:id', requirePermission('users.manage'), handler<{ id: string }>(async (req, res) => {
  const body = parse(z.object({ name: z.string().min(1).max(120).optional(), role: roleSchema.optional() }), req.body);
  if (req.params.id === req.session!.user.id && body.role && body.role !== 'admin') throw badRequest('You cannot remove your own admin role');
  const user = await prisma.user.update({ where: { id: req.params.id }, data: body });
  await audit(req, 'user.update', 'user', req.params.id, body);
  res.json(user);
}));

systemAdmin.post('/users/:id/password', requirePermission('users.manage'), handler<{ id: string }>(async (req, res) => {
  const { password } = parse(z.object({ password: z.string().min(10).max(128) }), req.body);
  await auth.api.setUserPassword({ body: { userId: req.params.id, newPassword: password }, headers: fromNodeHeaders(req.headers) });
  await audit(req, 'user.password', 'user', req.params.id);
  res.json({ ok: true });
}));

/** Lost phone: remove the user's authenticator + backup codes and sign them out everywhere. */
systemAdmin.post('/users/:id/two-factor/reset', requirePermission('users.manage'), handler<{ id: string }>(async (req, res) => {
  await prisma.$transaction([
    prisma.twoFactor.deleteMany({ where: { userId: req.params.id } }),
    prisma.user.update({ where: { id: req.params.id }, data: { twoFactorEnabled: false } }),
    prisma.session.deleteMany({ where: { userId: req.params.id, ...(req.params.id === req.session!.user.id ? { NOT: { id: req.session!.session.id } } : {}) } }),
  ]);
  await audit(req, 'user.two_factor_reset', 'user', req.params.id);
  res.json({ ok: true });
}));

systemAdmin.post('/users/:id/ban', requirePermission('users.manage'), handler<{ id: string }>(async (req, res) => {
  if (req.params.id === req.session!.user.id) throw badRequest('You cannot disable your own account');
  const { reason } = parse(z.object({ reason: z.string().max(200).optional() }), req.body ?? {});
  await auth.api.banUser({ body: { userId: req.params.id, banReason: reason }, headers: fromNodeHeaders(req.headers) });
  await audit(req, 'user.ban', 'user', req.params.id);
  res.json({ ok: true });
}));

systemAdmin.post('/users/:id/unban', requirePermission('users.manage'), handler<{ id: string }>(async (req, res) => {
  await auth.api.unbanUser({ body: { userId: req.params.id }, headers: fromNodeHeaders(req.headers) });
  await audit(req, 'user.unban', 'user', req.params.id);
  res.json({ ok: true });
}));

systemAdmin.delete('/users/:id', requirePermission('users.manage'), handler<{ id: string }>(async (req, res) => {
  if (req.params.id === req.session!.user.id) throw badRequest('You cannot delete your own account');
  await auth.api.removeUser({ body: { userId: req.params.id }, headers: fromNodeHeaders(req.headers) });
  await audit(req, 'user.delete', 'user', req.params.id);
  res.status(204).end();
}));

/* ─────────────── Security status ─────────────── */

systemAdmin.get('/security/status', requirePermission('settings.manage'), handler(async (_req, res) => {
  const [users, withTwoFactor] = await Promise.all([
    prisma.user.count({ where: { banned: { not: true } } }),
    prisma.user.count({ where: { banned: { not: true }, twoFactorEnabled: true } }),
  ]);
  res.json({ captcha: { provider: 'turnstile', configured: captchaConfigured() }, users, withTwoFactor });
}));

/* ─────────────── Privacy: customer data requests ─────────────── */

const customerQuery = z.object({ q: z.string().trim().min(5).max(200) });
/** The audit log must not keep the very data that was erased: store "fr***@example.com" / "***5678". */
const masked = (q: string) => (q.includes('@') ? q.replace(/^(.{2}).*(@.*)$/, '$1***$2') : `***${q.replace(/\D/g, '').slice(-4)}`);

systemAdmin.get('/privacy/customer', requirePermission('settings.manage'), handler(async (req, res) => {
  const { q } = parse(customerQuery, req.query);
  const data = await findCustomerData(q);
  res.json({
    orders: data.orders.map((o) => ({ number: o.number, createdAt: o.createdAt, status: o.status, anonymized: Boolean(o.anonymizedAt) })),
    reservations: data.reservations.map((r) => ({ code: r.code, date: r.date, status: r.status, anonymized: Boolean(r.anonymizedAt) })),
  });
}));

systemAdmin.get('/privacy/customer/export', requirePermission('settings.manage'), handler(async (req, res) => {
  const { q } = parse(customerQuery, req.query);
  const data = await findCustomerData(q);
  await audit(req, 'privacy.export', 'customer', masked(q), { orders: data.orders.length, reservations: data.reservations.length });
  res.setHeader('Content-Disposition', `attachment; filename="customer-data-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
}));

systemAdmin.post('/privacy/customer/erase', requirePermission('settings.manage'), handler(async (req, res) => {
  const { q } = parse(customerQuery, req.body);
  const result = await eraseCustomerData(q);
  await audit(req, 'privacy.erase', 'customer', masked(q), result);
  res.json(result);
}));

/* ─────────────── Audit ─────────────── */

systemAdmin.get('/audit', requirePermission('audit.view'), handler(async (req, res) => {
  const q = parse(z.object({ entityType: z.string().optional(), entityId: z.string().optional(), page: z.coerce.number().int().min(1).default(1) }), req.query);
  const where = { ...(q.entityType ? { entityType: q.entityType } : {}), ...(q.entityId ? { entityId: q.entityId } : {}) };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * 50, take: 50 }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ items, total, page: q.page, pageSize: 50 });
}));
