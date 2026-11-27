'use client';

import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/** Better Auth client — talks to `/api/auth/*` on this origin (proxied to the API). */
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001',
  // Sign-in answers `{ twoFactorRedirect: true }` for accounts with an authenticator; the login page shows the code step.
  plugins: [twoFactorClient()],
});
