# Family Budget Webapp

Personal web application for family budget management and expense tracking: structured
recording of income and expenses, a consolidated view by category, and a mechanism for
setting money aside (cashboxes).

> **Status:** foundation in progress (milestone M1). The applications are not bootstrapped
> yet — `apps/api` and `apps/web` currently hold only workspace and TypeScript configuration.

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS (≥ 22.13) | pinned in [`.nvmrc`](.nvmrc) — `nvm use`; the minor floor comes from pnpm 11 |
| pnpm | 11.x | `corepack enable` activates the version pinned in `packageManager` |
| Docker | recent | for PostgreSQL 16 via `docker compose` (added in M1-T03) |

`corepack enable` is not optional: the root scripts call `pnpm` recursively, and
`engines.pnpm` rejects an older standalone pnpm found on the `PATH`.

## Local setup

```bash
nvm use              # Node 22, as pinned in .nvmrc
corepack enable      # activates the pnpm version pinned in package.json
pnpm install         # installs every workspace in one pass
pnpm typecheck       # verifies the TypeScript setup across all workspaces
```

## Workspaces

Declared in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) as `apps/*` and `packages/*`:

| Path | Package name | Purpose |
|---|---|---|
| `apps/api` | `api` | REST API — NestJS + Prisma + PostgreSQL 16 |
| `apps/web` | `web` | Web client — Vite + React 19 + Tailwind + shadcn/ui |
| `packages/api-client` | `@family-budget/api-client` | Typed client generated from OpenAPI by Orval — **never edited by hand** |

Target a single workspace with `--filter`, e.g. `pnpm --filter api typecheck`.

## Scripts

Run from the repository root; each one fans out over the workspaces.

| Script | What it does |
|---|---|
| `pnpm dev` | starts every app in watch mode, in parallel |
| `pnpm build` | builds every workspace |
| `pnpm lint` | lints every workspace |
| `pnpm test` | runs every workspace's test suite |
| `pnpm typecheck` | runs `tsc --noEmit` in every workspace |

`dev`, `build`, `lint` and `test` use `--if-present`, so they stay green while the
applications are still being scaffolded (M1-T02 through M1-T05 add the real scripts).
`typecheck` does not: every workspace is expected to define it.

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
