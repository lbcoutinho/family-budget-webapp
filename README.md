# Family Budget Webapp

Personal web application for family budget management and expense tracking: structured
recording of income and expenses, a consolidated view by category, and a mechanism for
setting money aside (cashboxes).

## Requirements

| Tool    | Version | Notes                                                                                                 |
| ------- | ------- | ----------------------------------------------------------------------------------------------------- |
| Node.js | 24 LTS  | pinned in [`.nvmrc`](.nvmrc) — `nvm use`; see [ADR-0016](docs/adr/0016-node-24-lts-as-the-runtime.md) |
| pnpm    | 11.x    | `corepack enable` activates the version pinned in `packageManager`                                    |
| Docker  | recent  | for PostgreSQL 16 via `docker compose` (added in M1-T03)                                              |

Both versions are enforced, not suggested: `engineStrict` in
[`pnpm-workspace.yaml`](pnpm-workspace.yaml) makes `pnpm install` fail with
`ERR_PNPM_UNSUPPORTED_ENGINE` on a runtime outside `engines.node`. And `corepack enable` is
not optional — the root scripts call `pnpm` recursively, and `engines.pnpm` rejects an older
standalone pnpm found on the `PATH`.

## Local setup

Everything needed to go from a fresh clone to a working dev environment, in order. Each step
is explained in more detail in the sections below (Database, MCP tooling).

```bash
# 1. Toolchain
nvm use              # Node 24, as pinned in .nvmrc
corepack enable      # activates the pnpm version pinned in package.json
pnpm install         # installs every workspace in one pass
pnpm typecheck       # verifies the TypeScript setup across all workspaces

# 2. Environment and database
cp .env.example .env               # fill in real secrets before running anything
docker compose up -d postgres postgres_test
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

The MCP servers (`codegraph`, `shadcn`) and the skills under `.claude/skills/` need none of this —
they're declared in [`.mcp.json`](.mcp.json) or vendored as files, so they work right after
`git clone` with no extra install step.

## Database

PostgreSQL 16 runs in Docker: `docker compose up -d postgres postgres_test` (main on 5432, a
disposable instance for integration tests on 5433). Copy `.env.example` to `.env` first — it
feeds both `docker-compose.yml` and the API.

The schema lives in [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma), whose
header states the naming conventions every model follows. The connection URL is **not** in the
datasource block: the Prisma CLI reads it from `apps/api/prisma.config.ts` and the running
application takes it from the validated environment
([ADR-0017](docs/adr/0017-prisma-7-with-the-rust-free-client.md)).

| Script                         | What it does                                                     |
| ------------------------------ | ---------------------------------------------------------------- |
| `pnpm --filter api db:migrate` | creates and applies a migration from the current schema          |
| `pnpm --filter api db:seed`    | creates the two accounts that can log in — see below             |
| `pnpm --filter api db:studio`  | opens Prisma Studio against the main database                    |
| `pnpm --filter api db:reset`   | **drops and recreates the database** — run by a human, see below |

Migrations are committed under `apps/api/prisma/migrations/` and never edited once pushed; a
schema change means a new migration. CI applies them with `prisma migrate deploy` before the
tests run.

The application is single-user and has no sign-up screen, so the logins come from the seed
([`apps/api/prisma/seed.ts`](apps/api/prisma/seed.ts)): the owner, at `SEED_USER_EMAIL` /
`SEED_USER_PASSWORD`, and a demo account with its own `SEED_DEMO_USER_PASSWORD`. The demo address
is not configured — the seed derives it by adding a `+demo` sub-address to `SEED_USER_EMAIL`, so
both accounts reach the same mailbox. The seed is idempotent: re-running it refreshes the two rows
rather than duplicating them.

`db:reset` is destructive and the Prisma 7 CLI knows it: it detects a coding agent and refuses
to run unless `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` carries the user's verbatim
consent. That guardrail is deliberate — in this repository resetting the database is always a
human action, never Claude's.

## Manual database backups

Set `ADMIN_EMAIL` to the administrator's email address. That authenticated user can download a
full custom-format PostgreSQL dump from `GET /api/backups/database`; the API streams it directly
and temporarily rejects domain writes while the dump runs. The download contains all financial and
authentication data and is **not encrypted**. Store it only in an approved, encrypted location.

The API host must have PostgreSQL 16 or newer client tools installed, including `pg_dump`. Use the same or
a newer PostgreSQL version when restoring.

To validate a backup safely, restore it into an empty database:

```bash
createdb family_budget_restore
pg_restore --dbname=family_budget_restore family-budget-backup-YYYY-MM-DDTHH-mm-ssZ.dump
```

For a destructive in-place recovery, stop the API first, terminate existing database connections,
drop and recreate the target database, then restore the dump and restart the API:

```bash
dropdb budget
createdb budget
pg_restore --dbname=budget family-budget-backup-YYYY-MM-DDTHH-mm-ssZ.dump
```

Re-run this recovery check after PostgreSQL or infrastructure changes. Backups use an in-memory
lock and therefore protect writes only when one API instance is running.

## Workspaces

Declared in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) as `apps/*` and `packages/*`:

| Path                  | Package name                | Purpose                                                                 |
| --------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `apps/api`            | `api`                       | REST API — NestJS + Prisma + PostgreSQL 16                              |
| `apps/web`            | `web`                       | Web client — Vite + React 19 + Tailwind + shadcn/ui                     |
| `packages/api-client` | `@family-budget/api-client` | Typed client generated from OpenAPI by Orval — **never edited by hand** |

Target a single workspace with `--filter`, e.g. `pnpm --filter api typecheck`.

## Scripts

Run from the repository root; each one fans out over the workspaces.

| Script              | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `pnpm dev`          | starts every app in watch mode, in parallel      |
| `pnpm build`        | builds every workspace                           |
| `pnpm lint`         | runs ESLint over the whole repository            |
| `pnpm lint:fix`     | same, applying every autofix                     |
| `pnpm format`       | rewrites the repository with Prettier            |
| `pnpm format:check` | verifies formatting without writing (used by CI) |
| `pnpm test`         | runs every workspace's test suite                |
| `pnpm typecheck`    | runs `tsc --noEmit` in every workspace           |

`dev`, `build` and `test` fan out over the workspaces with `--if-present`, so they stay
green while the applications are still being scaffolded (M1-T03 through M1-T05 add the real
scripts). `typecheck` does not: every workspace is expected to define it. `lint` and
`format` do not fan out at all — see below.

## Documentation

- [`plans/0001-overview.md`](plans/0001-overview.md) — architecture, domain model, formulas
- [`docs/adr/`](docs/adr/AGENTS.md) — architecture decision records
- [`AGENTS.md`](AGENTS.md) — working conventions for this repository

## Contributing

Code style, TypeScript configuration, MCP tooling setup and general conventions live in
[`CONTRIBUTING.md`](CONTRIBUTING.md), including the [Quality & security
checks](CONTRIBUTING.md#quality--security-checks) every pull request goes through — coverage
thresholds, CodeQL, Gitleaks and the Dependabot auto-merge policy.
