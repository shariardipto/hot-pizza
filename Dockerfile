# syntax=docker/dockerfile:1
#
# Production images, one target per app:
#   api      Express API (Node, port 4000)
#   web      public website (Next.js standalone, port 3000)
#   admin    dashboard (Next.js standalone, port 3001)
#   migrate  one-off job: database migrations + first-time seed (run before the API starts)
#
# Easiest: docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# Single image: docker build --target web --build-arg API_URL=http://api:4000 -t resturant-web .

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 CI=1
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate
WORKDIR /repo

# ── Dependencies: cached until a package.json, the lockfile or the Prisma schema changes ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma/schema.prisma apps/api/prisma/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/
# Only so `prisma generate` (postinstall) can load prisma.config.ts — never used to connect.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# ── Build all three apps ──
FROM deps AS build
COPY . .
# Baked into the Next.js builds: where the web/admin servers reach the API (rewrites) and the admin's "View website" link.
ARG API_URL=http://api:4000
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ENV API_URL=$API_URL NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL NEXT_OUTPUT=standalone NODE_ENV=production
RUN pnpm --filter "./apps/*" run build

# ── The API's runtime folder: dist/ + production dependencies only ──
FROM build AS api-files
# Better Auth declares Next.js and the Prisma CLI as optional peers; the API uses neither at runtime
# (migrations run in the migrate image), so they are left out to keep the image small.
RUN pnpm --filter @app/api deploy --prod --legacy /out/api \
 && cd /out/api \
 && rm -rf src prisma scripts prisma.config.ts tsconfig.json tsup.config.ts \
 && rm -rf node_modules/.pnpm/next@* node_modules/.pnpm/@next+* node_modules/.pnpm/prisma@* \
           node_modules/.pnpm/@prisma+studio-core@* node_modules/.pnpm/@electric-sql+pglite*

# ── Migrations + first-time seed (docker compose runs it once before the API) ──
FROM deps AS migrate
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /repo/apps/api
ENV STORAGE_DIR=/data/storage
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/tsx prisma/seed/index.ts"]

# ── API ──
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production API_PORT=4000 STORAGE_DIR=/data/storage
WORKDIR /app
COPY --from=api-files --chown=node:node /out/api ./
RUN mkdir -p /data/storage/uploads /data/storage/cache && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/index.js"]

# ── Website ──
FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

# ── Dashboard ──
FROM ${NODE_IMAGE} AS admin
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/admin/.next/static ./apps/admin/.next/static
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3001/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/admin/server.js"]
