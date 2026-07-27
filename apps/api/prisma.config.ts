import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Configuration for the Prisma CLI (ADR-0017). Prisma 7 no longer accepts a connection `url` in
 * `schema.prisma`, and no longer loads `.env` on its own, so both live here.
 *
 * Only the CLI reads this file — `migrate`, `db` and `studio`. The application takes its
 * connection string from the validated environment through `ConfigService`, never from here.
 *
 * The URL falls back to an empty string instead of `env('DATABASE_URL')`, which throws when the
 * variable is missing: `postinstall` runs `prisma generate` on a fresh clone, before anyone has
 * copied `.env.example`, and generating the client needs no database. A command that does need
 * one — `migrate`, `studio` — still fails, with its own error.
 */
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
