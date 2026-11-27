import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth, type Role, type Session } from '../auth.ts';
import { forbidden, HttpError, unauthorized } from '../lib/http.ts';
import { getSetting } from '../modules/settings/service.ts';

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

/** Permission → roles allowed. `admin` can do everything. */
export const PERMISSIONS = {
  'dashboard.view': ['admin', 'editor', 'staff'],
  'content.edit': ['admin', 'editor'],
  'media.manage': ['admin', 'editor'],
  'locales.manage': ['admin'],
  'catalog.edit': ['admin', 'editor'],
  'orders.view': ['admin', 'staff'],
  'orders.manage': ['admin', 'staff'],
  'reservations.view': ['admin', 'staff'],
  'reservations.manage': ['admin', 'staff'],
  'locations.manage': ['admin'],
  'markets.manage': ['admin'],
  'settings.manage': ['admin'],
  'theme.manage': ['admin', 'editor'],
  'users.manage': ['admin'],
  'audit.view': ['admin'],
} satisfies Record<string, Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (role === 'admin') return true;
  return (PERMISSIONS[permission] as readonly string[]).includes(role ?? '');
}

export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  try {
    // Always read the session from the database (not Better Auth's 5-minute cookie cache), so a disabled
    // account, a removed session or a role change takes effect on the very next request.
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers), query: { disableCookieCache: true } });
    if (session) req.session = session as Session;
  } catch {
    /* invalid / expired session → treated as anonymous */
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.session) return next(unauthorized());
  if (req.session.user.banned) return next(forbidden('Your account is disabled'));
  next();
}

/**
 * Settings → Security → "Require two-factor": accounts without an authenticator app can only load their own profile
 * (`GET /me`) until they finish the set-up (Better Auth's `/api/auth/two-factor/*` endpoints are not behind this).
 */
export async function enforceTwoFactor(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.method === 'GET' && req.path === '/me') return next();
    if (req.session && !req.session.user.twoFactorEnabled && (await getSetting('security')).requireTwoFactor) {
      return next(new HttpError(403, 'two_factor_required', 'Set up two-factor authentication to continue'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.session) return next(unauthorized());
    if (!can(req.session.user.role, permission)) return next(forbidden());
    next();
  };
}

export function actor(req: Request) {
  const u = req.session?.user;
  return { actorId: u?.id ?? null, actorName: u?.name ?? u?.email ?? null, actorEmail: u?.email ?? null };
}
