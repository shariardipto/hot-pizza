import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Load the monorepo root .env (apps/api/.env overrides if present).
config({ path: path.resolve(import.meta.dirname, '../../.env') });
config({ path: path.resolve(import.meta.dirname, '.env'), override: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
