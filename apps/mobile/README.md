# Mobile app (planned)

This folder is reserved for a future **React Native / Expo** app (Android + iOS). The backend is already prepared for it:

| Need | Ready-made piece |
| --- | --- |
| Catalog, content, prices per country | Public REST API `GET /api/v1/catalog`, `/content/*`, `/settings` |
| Guest checkout (COD + online payment) | `POST /api/v1/checkout/quote`, `POST /api/v1/orders` (idempotent), `GET /api/v1/orders/:number?token=` |
| Reservations | `GET /api/v1/reservations/availability`, `POST /api/v1/reservations`, cancel via token |
| Typed client | `createApiClient()` from `@app/shared/api` — fetch-based, works in React Native as-is |
| Validation & rules | Zod schemas (`@app/shared/schemas`), market/COD/money logic (`@app/shared/commerce`) |
| Staff app (orders/bookings) | Better Auth **bearer** plugin is enabled: sign in via `/api/auth/sign-in/email`, then send `Authorization: Bearer <token>` to `/api/v1/admin/*` |

## Suggested setup

```bash
pnpm create expo-app apps/mobile --template tabs
pnpm --filter mobile add @app/shared@workspace:*
```

```ts
// apps/mobile/lib/api.ts
import { createApiClient } from '@app/shared/api';
export const api = createApiClient({ baseUrl: 'https://api.your-domain.com' });
```

Bot check: when Turnstile is on (Admin → Settings → Security), `POST /orders` and `POST /reservations` need an
`X-Captcha-Token` header. In the app, render the Turnstile widget in a small `react-native-webview` page (Cloudflare
supports this) and pass the token as the 3rd argument of `createOrder` / `createReservation`. Staff users with 2FA
sign in with `/api/auth/sign-in/email` → `/api/auth/two-factor/verify-totp`.

Payments on mobile: use `@stripe/stripe-react-native` with the `clientSecret` returned by `POST /api/v1/orders`
(`payment.type === "stripe"`), `react-native-razorpay` for India, and an in-app browser for SSLCommerz (`payment.type === "redirect"`).
For staff sign-in on Expo, add `@better-auth/expo` to the API's Better Auth plugins and the app.
