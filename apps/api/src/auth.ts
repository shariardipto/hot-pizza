import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, bearer, twoFactor } from 'better-auth/plugins';
import { prisma } from './db.ts';
import { env, isProd } from './env.ts';
import { authRateLimitStorage } from './lib/rate-limit.ts';
import { sendMail } from './modules/notifications/mailer.ts';
import { passwordResetEmail } from './modules/notifications/templates.ts';

export const ROLES = ['admin', 'editor', 'staff'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Admin-only authentication. Customers never sign in (guest checkout / bookings).
 * - Cookie sessions for the admin dashboard (proxied through the admin app → same-origin cookies).
 * - Bearer tokens (`Authorization: Bearer …`) for a future staff mobile app.
 */
export const auth = betterAuth({
  appName: 'Admin',
  baseURL: env.ADMIN_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  trustedOrigins: [env.ADMIN_URL, env.WEB_URL, env.API_URL],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({ to: user.email, ...passwordResetEmail({ name: user.name, url }) });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: { enabled: isProd, window: 60, max: 100, ...(authRateLimitStorage ? { customStorage: authRateLimitStorage } : {}) },
  advanced: {
    useSecureCookies: env.ADMIN_URL.startsWith('https://'),
    cookiePrefix: 'admin',
  },
  plugins: [
    admin({ defaultRole: 'staff', adminRoles: ['admin'] }),
    bearer(),
    // Authenticator-app codes (TOTP) + one-time backup codes. Enrolment completes only after the first valid code.
    twoFactor({
      issuer: 'Site admin',
      skipVerificationOnEnable: false,
      backupCodeOptions: { amount: 10, length: 10 },
      trustDeviceMaxAge: 60 * 60 * 24 * 30,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
