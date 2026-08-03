# Family Budget Webapp

Personal web application for family budget management and expense tracking: structured
recording of income and expenses, a consolidated view by category, and a mechanism for
setting money aside (cashboxes).

> **Status:** foundation complete (milestone M1); authentication in progress (milestone M2).
> The API and the web client are bootstrapped, but no domain feature is usable yet.

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

# 3. CodeGraph (code intelligence used by Claude Code)
npm install -g @colbymchenry/codegraph
codegraph init

# 4. shadcn MCP server token (rate limits only, no scopes needed)
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here

# 5. Claude Code plugins — marketplaces are per-machine, not cloned with the repo
claude plugin marketplace add ChromeDevTools/chrome-devtools-mcp
claude plugin install chrome-devtools-mcp@chrome-devtools-plugins

claude plugin marketplace add DietrichGebert/ponytail
claude plugin install ponytail@ponytail

claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install security-guidance@claude-plugins-official
claude plugin install claude-md-management@claude-plugins-official
claude plugin install superpowers@claude-plugins-official

claude   # inside the session: /reload-plugins
```

The MCP servers (`codegraph`, `shadcn`) and the skills under `.claude/skills/` (emilkowalski's
animation/React/deploy skills, impeccable, pick-ui-library, prototype, …) need none of this —
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

## Code style

One ESLint flat config ([`eslint.config.js`](eslint.config.js)) covers the whole monorepo
and is run in a **single pass from the root**, rather than once per workspace. A single pass
is faster, and it also reaches the files that live outside any workspace — the root config
files themselves. The per-workspace differences (Node globals and NestJS allowances for
`apps/api`, browser globals plus `react-hooks` and `jsx-a11y` for `apps/web`) are expressed
as overrides inside that one config.

TypeScript is linted with **type information** (`projectService`), which is what makes
`@typescript-eslint/no-floating-promises` work — the rule that matters most once NestJS
arrives, since an unawaited promise there fails silently. `eslint-config-prettier` is applied
last, so ESLint never argues with Prettier about formatting.

Prettier deviates from its defaults in three places, in [`.prettierrc`](.prettierrc):
`singleQuote: true`, `trailingComma: "all"`, `printWidth: 160`. The plan asked for a
100-column width; 160 was chosen instead, so wide-but-readable lines (NestJS decorators,
Tailwind class lists, table-driven tests) stop being wrapped into unreadable stacks.

Two trees are excluded from both tools: `packages/api-client`, which Orval generates and
nobody edits, and — for Prettier only — `docs/adr/` and `plans/`, whose text is either
immutable once accepted or copied verbatim into GitHub Issues.

A Husky `pre-commit` hook runs `lint-staged` over the staged files: ESLint `--fix` followed
by Prettier on TypeScript and JavaScript, Prettier alone on JSON, Markdown, YAML and CSS. A
lint error that no autofix can repair aborts the commit. The hook is installed by the
`prepare` script, so a fresh `pnpm install` is all it takes; to bypass it deliberately, use
`git commit --no-verify`.

**ESLint is pinned to 9.x, not 10.x.** Two of the plugins this project requires —
`eslint-plugin-import` and `eslint-plugin-jsx-a11y` — still declare a peer range that stops
at ESLint 9. Following the same rule used for TypeScript below, the version chosen is the
newest one inside every peer range.

## TypeScript configuration

[`tsconfig.base.json`](tsconfig.base.json) holds the settings shared by every workspace —
`target: ES2022`, `strict: true`, `noUncheckedIndexedAccess: true` and the related
`noImplicitOverride` / `noFallthroughCasesInSwitch` / `noUnused*` checks. Each workspace
has its own `tsconfig.json` extending it and adding only what is specific to its runtime
(module system, `lib`, JSX, path aliases).

**TypeScript is pinned to 6.x, not 7.x.** TypeScript 7 is the native (Go) compiler: it ships
no JavaScript compiler API, and the tools this project depends on still need one —
`typescript-eslint` declares `typescript >=4.8.4 <6.1.0` and `ts-jest` declares
`>=4.3 <7`. Without them there is no type-aware linting (including
`@typescript-eslint/no-floating-promises`) and no NestJS test transform. The configuration
here is already free of what TypeScript 7 removed — no `baseUrl`, no `moduleResolution:
node10` — so the upgrade is a version bump once the toolchain catches up.

## MCP tooling

[`.mcp.json`](.mcp.json) declares project-scoped MCP servers picked up automatically by
Claude Code on clone — currently `codegraph` and `shadcn` (the
[shadcn-ui-mcp-server](https://github.com/Jpisnice/shadcn-ui-mcp-server), used to look up
shadcn/ui component source and demos).

`codegraph` needs its CLI installed globally and an index built once per clone — `.codegraph/`
holds the SQLite index and daemon files, is git-ignored (machine-local), and is empty right
after clone:

```bash
npm install -g @colbymchenry/codegraph
codegraph init      # builds the initial index at the repo root
```

`codegraph sync` catches the index up after pulling changes made outside a Claude Code session
(the running MCP server/hook keeps it current during one); `codegraph status` shows whether it's
stale.

The `shadcn` server needs a GitHub personal access token for API rate limits — no scopes
required. Export it in your shell before starting Claude Code, it is not read from `.env`:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

## Documentation

- [`plans/0001-overview.md`](plans/0001-overview.md) — architecture, domain model, formulas
- [`plans/milestones/`](plans/milestones/) — the 8 milestones and their tasks
- [`docs/adr/`](docs/adr/README.md) — architecture decision records
- [`CLAUDE.md`](CLAUDE.md) — working conventions for this repository

## Conventions

- Money is always stored and transported as **integer cents** — never floats.
- All implementation happens on a branch off `main` and lands through a pull request;
  `main` is never committed to directly.
- English (en-US) for code, comments and commit messages; only UI strings are localized.
