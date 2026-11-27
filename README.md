# PIZZA — animated restaurant site, CMS, guest ordering & reservations

A full-stack, multi-language, admin-customizable website for a pizza restaurant or shop, ready to rebrand. It ships
with demo content for a brand called **PIZZA** (menu, photos, stories, three branches). The public site has a strongly
animated design; everything else — content, colors (with ready-made palettes), logo, fonts, layout options,
languages, markets, prices, payments, branches and opening hours — is managed in the admin dashboard.

**Full documentation:** [`docs/`](docs/README.md) — case study, architecture, project structure, data model,
API reference, website, admin, ordering & reservations, security, development, deployment and decisions.

```
apps/
  web/      Next.js 16 · Tailwind 4 public website (port 3000) — animated design & motion (GSAP, Lenis, SplitText-style reveals)
  admin/    Next.js 16 · Tailwind 4 dashboard (port 3001) — content, orders, reservations, appearance, markets, team
  api/      Express 5 · Better Auth · Prisma 7 / PostgreSQL (port 4000) — REST API /api/v1, payments, e-mail, media
  mobile/   (reserved) future Expo app — see apps/mobile/README.md
packages/
  shared/   Content model + field definitions, Zod schemas, money/markets/COD logic, typed API client
```

## Quick start

Requirements: Node ≥ 22, pnpm ≥ 10, Docker (for PostgreSQL).

```bash
cp .env.example .env          # then set BETTER_AUTH_SECRET and REVALIDATE_SECRET (any long random strings)
pnpm install
pnpm db:up                    # PostgreSQL 17 in Docker (host port 5433)
pnpm db:deploy                # apply migrations
pnpm db:seed                  # English, demo pizza content & photos, markets, demo branches, admin user
pnpm dev                      # api :4000 · web :3000 · admin :3001
```

| | URL | |
| --- | --- | --- |
| Website | http://localhost:3000 | English; add languages in Admin → Languages |
| Admin | http://localhost:3001 | `admin@example.com` / `ChangeMe123!` (from `.env` — change it) |
| API | http://localhost:4000/health | REST under `/api/v1` |
| Mail catcher (optional) | http://localhost:8025 | `docker compose --profile mail up -d`, then `SMTP_HOST=localhost` |

`pnpm db:seed -- --force` re-imports the demo content and images and resets settings, markets and branches
(overwrites admin edits). `pnpm db:studio` opens Prisma Studio.
`pnpm test` runs the shared and API tests; `pnpm typecheck` checks all apps.

## Demo content
- **Pages:** Home · Our pizzas (`/products`, one section per menu category) · a page per pizza (`/products/margherita`…)
  · Our story (`/about`) · Contact · Locations (`/locations`: every branch with address, opening hours and phone;
  the old `/where-to-buy` address redirects here) · Reservations · Checkout & order tracking · legal pages.
- **Menu:** 4 categories (Classic, Signature, Veggie, Specials), 8 pizzas, each with a flavor (name + page colors),
  a cut-out photo, a gallery and a demo price. **Branches:** PIZZA Centro and Malasaña (Madrid), Gràcia (Barcelona).
- **Photos** are free [Pexels](https://www.pexels.com/license/) photos, cropped to the design's sizes; pizza photos are
  cut out to a transparent background. Sources: `apps/api/prisma/seed/assets/media/SOURCES.md`.
- **Font:** Oswald (SIL Open Font License, `apps/web/public/fonts/OFL-Oswald.txt`), sized to fill the design's spaces.
- The demo texts are only data: replace them in the admin (Pages, Catalog, Texts & footer, Locations).

## How it fits together

```
Browser ──► web (Next.js) ──server──► api /api/v1 (cached, tag-revalidated)
   │            └─ rewrites /api/v1/*, /uploads/* ──────► api  (same-origin cart, checkout, images)
   └──► admin (Next.js) ── rewrites /api/* ─────────────► api  (/api/auth = Better Auth, /api/v1/admin)
api ──► PostgreSQL · local disk or S3 (media) · SMTP · Stripe / PayPal / Razorpay / SSLCommerz
api ──► POST web/api/revalidate (after every admin change → pages refresh within seconds)
```

### Public UI & motion
- React components with GSAP timelines, easings and timings: intro, morphing header logo, clip-path menu,
  page-transition panel, custom cursor, char/line reveals, parallax, sticky sections, horizontal galleries and the
  product switcher. All styling is **Tailwind CSS 4** utilities.
- Ordering screens (cart, checkout, order tracking, reservations) are built only from the design tokens, so they
  follow theme changes.

### Styling the website (Tailwind 4)
- `apps/web/src/styles/tailwind.css` — the theme. `preflight.css` — the site's own reset (used instead of Tailwind's
  preflight) and the root design variables, which Admin → Appearance overrides at runtime.
- **Units:** `1rem = 10px` and the spacing unit is 1px: `p-20` = 2rem, `gap-40` = 4rem.
  **Breakpoints:** `max-md:` < 960 (phone) · `md:` ≥ 960 · `md:max-lg:` tablet only · `lg:` ≥ 1280 · `xl:` ≥ 1920.
- **Design tokens:** fluid type `text-340 … text-20`, `text-base`; fluid spacing `mb-fluid-40`, `pb-fluid-120`, `gap-fluid-60`;
  grid `w-col-1 … w-col-12`, `gap-gutter`, `px-offset`, `w-width`; colors `bg-accent`, `text-secondary`, `text-alt`, `bg-bg`
  (from the theme variables); easing `ease-expo` / `var(--ease-expo)`; animations `animate-marquee`, `animate-seal`.
- **Variants:** `inview:` (element scrolled into view, set by `lib/observer.ts`), `group-inview/name:`, `pointer-fine:`;
  `hover:` applies on every device.
- `cx()` (`lib/cx.ts`) = clsx + tailwind-merge (taught the tokens): a parent's `className` overrides a component's own classes.
  Shared class sets of the ordering screens live in `components/commerce/ui.ts`.
- Motion code relies on a few class names; keep them: `hero__media`, `menu-label__logos/__line/__bg`, `product-hero`,
  `product-switcher__*`, `has-error`, the split-text spans `.char/.line/.word(-mask)`, and the SVG parts of the logos.
- Gotchas: in arbitrary variants `_` means a space, so escape underscores in class names (``String.raw`[&_.logo-seal\_\_text]:…` ``);
  write class names literally (Tailwind only generates classes it can read in the source).

### Content & languages
- Content types are defined once in `packages/shared/src/content/types.ts` (fields, labels, groups). The admin form,
  API validation and storage are generated from them — add a field there and it appears everywhere.
- Each entry stores **shared** values (images, colors, flags, list structure) once and **texts per language**.
  Missing translations fall back field-by-field to the default language. Revisions are kept (restore in admin).
- Languages: add any language (optionally copy another as a starting point), hide/show it, change the default
  (default has no URL prefix: `/about`; others `/es/about`). RTL languages are supported (`dir="rtl"`).
- Seeded: **English** only. Add a language in Admin → Languages (copy English as a starting point) and translate it.

### Appearance (admin → Appearance)
- **Color palettes:** six ready-made combinations fill every color at once — **Classic** (the default design),
  Basil, Wood oven, Tomato, Napoli blue, Night — then any color can be fine-tuned (background,
  accent, secondary, logo, top navigation, menu links, footer links…) with a live preview.
- **Logo:** a text logo + letter mark (type the name and the letter; the header animation adapts to them), or an
  uploaded image + compact mark. Also favicon, display/regular fonts (upload WOFF2), corner radius, content width per
  breakpoint, top navigation, language switcher & cart placement, home-section order/visibility, motion switches
  (intro, transitions, smooth scroll, cursor, reduced-motion) and custom CSS.

### Media (admin → Media library)
- Images can be uploaded as **PNG, JPG or WebP** and are always **stored as WebP**: turned upright, camera/GPS metadata
  removed, anything larger than 4096 px scaled down. Photos are encoded at quality 80; PNG graphics keep transparency
  (the smaller of high-quality and near-lossless is kept, so logos stay crisp). Other image types (SVG, GIF…) are refused.
- Fonts (WOFF2/WOFF/TTF/OTF) for Appearance are stored as uploaded.
- The image server resizes on the fly (`?w=800&auto=format` → WebP). The favicon and social-share images are
  served as PNG/JPEG copies (`fm=png` / `fm=jpeg`) because not every browser or social network reads WebP.
- Older installs: `pnpm --filter @app/api media:webp` converts existing PNG/JPG files and updates every reference
  (content, revisions, settings, orders); `--dry-run` lists the changes first.

### Ordering — international by design
- **Markets** group countries with currency, explicit or auto-converted prices (exchange rate + rounding),
  tax (inclusive/exclusive), delivery fee & free-delivery threshold, minimum order, pick-up, **cash on delivery**
  (on/off, fee, max amount) and allowed **payment gateways**. Seeded:
  EU/Spain (EUR, default) · UK · US · Canada · Bangladesh (COD + SSLCommerz) · India (COD + Razorpay) · Asia (COD + Stripe)
  · Rest of world. COD is **never** offered in US/UK/CA/EU; it is enforced server-side, not just hidden.
- Visitor country: explicit choice → CDN geo headers (Vercel/Cloudflare/CloudFront) → browser locale → default market.
- Guest checkout (no account): name, phone (validated & normalized to E.164 per country), e-mail (required for online
  payment), country-aware address (state/province/county, ZIP/postcode/PIN rules), delivery or pick-up, notes.
- Prices/totals are always recalculated on the server; stock is reserved atomically; double submits are prevented
  with idempotency keys; unpaid online orders expire and restock automatically.
- Order tracking for guests via private link (`/order/PZ-10001?token=…`) or order number + phone (`/order`).
  The order-number prefix is a setting.
- E-mails (customer confirmation & status updates, staff notifications) in the customer's language (English and
  Spanish texts built in).

### Payment gateways (credentials in `.env`, never in the DB)
| Gateway | Markets | Setup |
| --- | --- | --- |
| Stripe (Payment Element: cards, Apple Pay, Google Pay…) | US, UK, CA, EU, Asia, RoW | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, webhook `…/api/v1/payments/stripe/webhook` (events `payment_intent.*`, `charge.refunded`) → `STRIPE_WEBHOOK_SECRET`. Dev: `stripe listen --forward-to localhost:4000/api/v1/payments/stripe/webhook` |
| PayPal (PayPal balance, Pay Later, cards) | Currencies PayPal accepts (USD, EUR, GBP, CAD, AUD…; not BDT/INR, hidden there automatically) | `PAYPAL_CLIENT_ID/SECRET`, `PAYPAL_SANDBOX=true` for sandbox. Customers approve on PayPal, come back to `…/api/v1/payments/paypal/return` and the payment is captured server-side. Webhook `…/api/v1/payments/paypal/webhook` (events `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED/DENIED/PENDING/REFUNDED`) → `PAYPAL_WEBHOOK_ID` |
| Razorpay (UPI, cards, net banking) | India | `RAZORPAY_KEY_ID/SECRET`, webhook `…/api/v1/payments/razorpay/webhook` (`payment.captured`, `payment.failed`) |
| SSLCommerz (bKash, Nagad, cards) | Bangladesh | `SSLCOMMERZ_STORE_ID/PASSWORD`, `SSLCOMMERZ_SANDBOX=true` for sandbox; IPN `…/api/v1/payments/sslcommerz/ipn` |

Unconfigured gateways are hidden automatically (Admin → Markets shows status, mode and webhook URLs).
Payment status is also re-checked against the provider when a customer opens the order page, so orders confirm
even before webhooks are configured.

### Reservations
Locations with time zone, opening hours (several services per day), slot interval, table time, seats, party-size
limits, lead time, booking horizon, closed dates and auto-confirm. Availability is computed per slot from overlapping
bookings; bookings are serialized per location/day so the last seats cannot be double-booked. Guests get a private
manage/cancel link; staff manage a calendar, phone bookings and statuses.

### Roles
`admin` (everything) · `editor` (content, media, appearance) · `staff` (orders & reservations). Public sign-up is
disabled; admins create accounts in Team. Every change is written to the audit log.

### Security
| Area | What is in place |
| --- | --- |
| Admin sign-in | Better Auth, password ≥ 10 chars, httpOnly cookies, roles, disable/ban (takes effect on the next request), audit log. **Two-factor** (authenticator app + 10 single-use backup codes, optional 30-day trusted device) in **Account**; Settings → Security can **require 2FA for the whole team** (members without it can only open Account until they set it up). Team → reset 2FA for a lost phone. Account also shows signed-in devices ("sign out everywhere else") and password change. |
| Website CSP | Strict nonce-based `Content-Security-Policy` per request (`'strict-dynamic'`, no `unsafe-inline` scripts, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'self'`). Stripe, Razorpay and Turnstile are allowed automatically; add analytics/embeds in Settings → Security → allowed origins. Mode: enforce / report-only / off; violations are logged by the API (`POST /api/v1/csp-report`). HSTS + `upgrade-insecure-requests` when the site runs on https. |
| Admin CSP | Same-origin-only policy, `frame-ancestors 'none'`, no third-party code. |
| Bot protection | Cloudflare **Turnstile** on checkout and bookings (invisible for most visitors, no cookies). Set `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`; switch in Settings → Security. Tokens are verified server-side, single-use and bound to the action; an idempotent retry of the same order does not need a new token. |
| COD / booking fraud | Max open cash-on-delivery orders per phone, max upcoming reservations per phone, blocked customers (phone in any format, or e-mail) — Settings → Orders & reservations. Plus per-IP rate limits, server-side COD gating and staff confirmation of COD orders. |
| API | Helmet, CORS allow-list, Zod validation on every input, rate limits (shared through Redis when `REDIS_URL` is set — needed with several API servers), Prisma (parameterized SQL), sanitized rich text, uploads limited to PNG/JPG/WebP images (re-encoded) and fonts, signed & idempotent payment webhooks, amount/currency checks, payment failures confirmed with the provider, secrets only in `.env`. |
| Privacy (GDPR) | Settings → Security: **keep customer details for** N months (then names, phones, e-mails and addresses are removed from finished orders and past bookings; totals and items stay for accounting) and **keep IP addresses for** N days (default 90). **Customer data requests**: find everything stored for a phone number or e-mail, download it as JSON, or erase it (refused while an order/booking is still open). The audit log stores only a masked address. |
| CI | `.github/workflows/ci.yml`: typecheck, tests, build, `pnpm audit` (fails on high/critical in production packages), gitleaks secret scan, Docker image builds. Actions are pinned to commit SHAs; Dependabot (`.github/dependabot.yml`) proposes updates after a 14-day cooldown. |

## Deployment
### Docker (recommended)
```bash
cp .env.example .env.production        # set POSTGRES_PASSWORD, secrets, https WEB_URL / ADMIN_URL / API_URL, payment keys
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
- Images (`Dockerfile`, one target each): `api`, `web`, `admin` (Next.js standalone, non-root, health checks) and
  `migrate`, a one-off job that applies migrations and seeds a fresh database before the API starts.
- The apps listen on `127.0.0.1:3000/3001/4000`; put a TLS reverse proxy in front (Caddy, nginx, Traefik). `API_URL` must
  be the API's public https URL (payment return pages and webhooks), and set `TRUST_PROXY=1`.
- Uploads live in the `uploads` volume (or use `STORAGE_DRIVER=s3` for S3/R2/Spaces/MinIO). Back up `pgdata` and `uploads`.
- Several API containers: start Redis (`--profile scale`) and set `REDIS_URL=redis://redis:6379` so rate limits are shared.

### Without Docker
- Build: `pnpm build` (API → `apps/api/dist`, web/admin → `.next`; the website build does not need the API running).
  Start: `pnpm --filter @app/api start`, `pnpm --filter @app/web start`, `pnpm --filter @app/admin start`
  (or deploy web/admin to Vercel and the API to any Node host).
- Set `NODE_ENV=production`, real `WEB_URL`/`ADMIN_URL`/`API_URL` (https), `TRUST_PROXY=1` behind a proxy,
  `pnpm db:deploy` on release.
- Background jobs (unpaid-order expiry, privacy retention) use Postgres advisory locks, so several API instances are safe.

## Before going live — please review
- **Keys**: replace the Cloudflare Turnstile test keys and switch the payment gateways from sandbox/test to live keys
  (`PAYPAL_SANDBOX=false`, `SSLCOMMERZ_SANDBOX=false`, live Stripe/Razorpay keys); set up each webhook (Markets & payments
  shows the URLs). Use long random values for `BETTER_AUTH_SECRET`, `REVALIDATE_SECRET` and `POSTGRES_PASSWORD`.
- **Privacy**: choose how long to keep customer details (Settings → Security; tax rules usually need the order
  totals for several years — those are kept either way).
- **Brand & content**: replace the demo name, logo, texts, menu, branches and photos with your own (Appearance,
  Pages, Catalog, Locations, Media library). The demo photos (Pexels) and the Oswald font are free for commercial use.
- **Legal texts**: the legal notice, privacy policy and cookie policy are generic templates with `[placeholders]`
  (company name, address, contact). Fill them in for your business and have them reviewed.
- **Prices** are demo prices in EUR, converted to other markets with example exchange rates. Set real prices in
  Catalog → product → Prices & stock, and review delivery fees, minimum order, exchange rates and taxes per market
  (US sales tax is a single flat rate here — integrate Stripe Tax or similar if you need per-state tax).
- No analytics or consent scripts are included. If you add analytics (Settings → analytics snippet), add a
  cookie-consent solution for the EU/UK.
- The footer "Data rights" link points to a configurable URL (Texts & footer → data-rights link).
