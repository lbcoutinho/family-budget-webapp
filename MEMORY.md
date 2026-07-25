# Handoff memory

Where the last ticket stopped and what comes next. Update this at the end of every ticket.
(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Earlier ticket: M1-T01 — Set up pnpm monorepo with workspaces

**Issue:** [#1](https://github.com/lbcoutinho/family-budget-webapp/issues/1) ·
**Branch:** `claude/m1-t01-implementation-6rizah` · **Date:** 2026-07-25 · **Status:** done

### What was done

- `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`.
- Root `package.json`: private, `packageManager: pnpm@10.33.0`, `engines.node >=22 <23`,
  orchestrating scripts `dev` / `build` / `lint` / `test` / `typecheck`.
- `tsconfig.base.json` with `target: ES2022`, `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`.
- Three workspaces created, each with a `tsconfig.json` extending the base and a `typecheck`
  script: `apps/api` (`api`, CommonJS + decorators, for NestJS), `apps/web` (`web`, ESNext +
  bundler resolution + `@/*` alias, for Vite), `packages/api-client`
  (`@family-budget/api-client`).
- `.nvmrc` → `22`; `.gitignore` extended (`node_modules`, `dist`, `coverage`, `.env*` with
  `!.env.example`, logs, tsbuildinfo).
- Full folder structure from `plans/0001-overview.md` §3 created, `.gitkeep` in empty dirs.
- Root `README.md` documenting requirements, setup, workspaces, scripts and TS config.

### Decisions taken during implementation (deviations noted on issue #1)

1. **Placeholder `src/index.ts` in each workspace.** `tsc -p` fails with TS18003 when a
   project has no input files, so `pnpm -r typecheck` could not pass over empty folders.
   Each workspace has a two-line `export {}` placeholder, commented with the ticket that
   replaces it (M1-T04 api, M1-T05 web, M1-T07 api-client). Delete them there.
2. **`--if-present` on `dev` / `build` / `lint` / `test`.** No workspace defines those
   scripts yet, and `pnpm -r <script>` fails hard when none matches. `typecheck` is
   deliberately left strict, since every workspace defines it.
3. **Package names.** Apps are named `api` and `web` (plain), so the plan's
   `pnpm --filter api dev` works verbatim; the shared package is scoped
   (`@family-budget/api-client`) because it is imported by name from application code.
4. **Latest compatible versions, checked against peer ranges** (user request):
   - **TypeScript `^6.0.3`, not 7.x.** TS 7 is the native Go compiler and ships no JS
     compiler API (`require('typescript')` exposes 2 keys, no `createProgram`).
     `typescript-eslint@8` requires `typescript >=4.8.4 <6.1.0` and `ts-jest@29` requires
     `>=4.3 <7`, so 7.x would cost type-aware linting (`no-floating-promises`) and the
     NestJS Jest transform. 6.0.3 keeps the full API and is the newest version inside both
     ranges.
   - **pnpm `11.17.0`** (`packageManager` + `engines.pnpm >=11`).
   - **`@types/node ^24.13.3`**, not 26.x: the types major must track the Node runtime
     major pinned in `.nvmrc`.
5. **Node 24 LTS instead of the planned 22 LTS** — recorded as
   [ADR-0016](docs/adr/0016-node-24-lts-as-the-runtime.md), since 22 is now maintenance-only.
   `.nvmrc` = `24`, `engines.node` = `>=24.0.0 <25.0.0`, and `engineStrict: true` in
   `pnpm-workspace.yaml` makes a wrong runtime fail the install instead of warning.
   `plans/milestones/m01-foundation.md` and `CLAUDE.md` were corrected to match, and the
   deviation is commented on issue #1.

**Config note:** pnpm 11 reads `engineStrict` from `pnpm-workspace.yaml`, _not_ from
`.npmrc` — an `.npmrc` with `engine-strict=true` is silently ignored (verified).

### TypeScript 6 gotchas for the next tickets

- `baseUrl` and `moduleResolution: node10` are deprecated (hard error without
  `ignoreDeprecations`, removed in 7). `apps/api` therefore uses `module: "Node16"` — which
  still emits CommonJS, since `apps/api/package.json` has no `"type": "module"` — and
  `apps/web` declares `paths` without `baseUrl`. **Re-check this after `nest new` and
  `create vite` in T04/T05**, since both scaffolds still generate the deprecated options.
- TS 6 requires an explicit `rootDir` when emitting (TS5011). Harmless today
  (`typecheck` is `--noEmit`), but T04's build config must set `rootDir: "./src"`.
- `corepack enable` is now mandatory: the root scripts shell out to `pnpm` recursively, and
  `engines.pnpm` rejects an older standalone pnpm on the `PATH`.
- M1-T06 must read the Node version from `.nvmrc` (`actions/setup-node` with
  `node-version-file`) rather than hardcoding it, so CI cannot drift from ADR-0016.

### Verified

On Node 24.18.0 with corepack active (pnpm 11.17.0, TypeScript 6.0.3 in all three
workspaces): `pnpm install` → 4 workspace projects, lockfile v9. `pnpm -r typecheck` →
3 projects pass. `pnpm dev` / `build` / `lint` / `test` → exit 0 (no-ops for now).
The runtime guard was checked in both directions: the same install aborts with
`ERR_PNPM_UNSUPPORTED_ENGINE` on Node 22.22.2.

---

## Last ticket: M1-T02 — Configure ESLint, Prettier, Husky and lint-staged

**Issue:** [#2](https://github.com/lbcoutinho/family-budget-webapp/issues/2) ·
**Branch:** `claude/m1-t02-hhuawz` · **Date:** 2026-07-25 · **Status:** done

### What was done

- Root `eslint.config.js` — flat config, CommonJS (every plugin ships CJS and the root
  package has no `"type": "module"`), built with `tseslint.config()`. Sections, in order:
  global `ignores`; a shared base (`js.configs.recommended` + `import` recommended,
  `import/order`, `eqeqeq`, `prefer-const`, `no-console`); type-aware TypeScript
  (`recommendedTypeChecked` + `stylisticTypeChecked` + `import` TypeScript preset);
  an `apps/api` override; an `apps/api` test override; an `apps/web` override
  (`jsx-a11y` + `react-hooks`); a plain-JavaScript override that switches type-aware rules
  back off; and `eslint-config-prettier/flat` **last**.
- `.prettierrc` (`singleQuote`, `trailingComma: "all"`, `printWidth: 100`, plus
  `endOfLine: "lf"`), `.prettierignore`, `.lintstagedrc.json`.
- Husky 9 initialized (`prepare: "husky"`, `core.hooksPath = .husky/_`); `.husky/pre-commit`
  runs `pnpm exec lint-staged`.
- Root scripts: `lint`, `lint:fix`, `format`, `format:check` added; `README.md` gained a
  "Code style" section.

### Decisions taken during implementation (deviations noted on issue #2)

1. **No `.eslintignore`** — ESLint 9 flat config dropped support for the file entirely;
   ignores live in the config's `ignores` key. The acceptance criterion's intent
   (`packages/api-client` is never linted) is met, the mechanism differs.
2. **`pnpm lint` is one root-level `eslint .`, not a `pnpm -r` fan-out.** The T01 handoff
   note expected a `lint` script per workspace. A single pass over a shared config is
   faster and also covers files outside every workspace (`eslint.config.js` itself); the
   per-workspace differences the plan asks for are config overrides, which is what the plan
   actually says ("per-workspace overrides"). Consequence: `apps/api` and `apps/web` have
   **no** `lint` script, so `eslint` is not a dependency of either workspace.
3. **ESLint pinned to 9.x, not the latest 10.x.** `eslint-plugin-import@2.32.0` and
   `eslint-plugin-jsx-a11y@6.10.2` — both named in the plan — cap their peer range at
   ESLint 9. Same rule as T01's TypeScript decision: newest version inside every peer range.
   Revisit when both plugins ship ESLint 10 support.
4. **`docs/adr/`, `plans/` and `.claude/` are in `.prettierignore`.** Prettier reflows
   Markdown (tables, `*emphasis*` → `_emphasis_`, list spacing); left alone it rewrote
   ~370 lines of accepted ADRs and plan text. Accepted ADRs are never edited, and plan text
   is copied verbatim into GitHub Issues, so reformatting it would desync the mirror.
   `README.md`, `CLAUDE.md` and this file **are** formatted.
5. **`allowBuilds: { unrs-resolver: true }` in `pnpm-workspace.yaml`.** pnpm 11 blocks
   dependency build scripts by default and **fails the whole install** until each one is
   declared. `unrs-resolver` is the native backend of `eslint-import-resolver-typescript`.
   Expect this again whenever a dependency with a postinstall is added (Prisma, esbuild).

### Gotchas for the next tickets

- **`--no-warn-ignored` is required in `.lintstagedrc.json`.** lint-staged passes explicit
  file paths, and ESLint emits a warning for an explicitly-passed ignored file, which
  `--max-warnings 0` would turn into a failed commit.
- `import/no-unresolved` and `import/named` are **off** for TypeScript — the compiler
  already does that, and the plugin mis-resolves path aliases. The TypeScript import
  resolver is still installed, because `import/order` needs it to classify groups.
- The `import/resolver.typescript` setting deliberately has **no `project` key**; resolver
  v4 discovers the nearest `tsconfig.json` per file. Passing a glob of every workspace
  tsconfig triggers a "Multiple projects found" warning on every run.
- Type-aware linting uses `projectService: true`, so **every linted `.ts` file must belong
  to a `tsconfig.json`**. T04's `nest new` and T05's `create vite` drop config files
  (`jest.config.ts`, `vite.config.ts`) outside `include` — either add them to the tsconfig
  or add `projectService.allowDefaultProject`.
- T06 (CI) should run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`.
- T05 will need `eslint-plugin-react` if React rules beyond hooks/a11y are wanted; the plan
  only lists `react-hooks` and `jsx-a11y`, so neither `react` nor `react-refresh` is installed.

### Verified

`pnpm lint` → 0 problems. `pnpm format` → whole repo, `pnpm format:check` clean afterwards.
`pnpm typecheck` → 3 projects pass. Rules were checked by lint-and-delete probes: a floating
promise in `apps/api` errors with `no-floating-promises` (type-aware linting works), a
conditional `useState` in `apps/web` errors with `react-hooks/rules-of-hooks`, and a file
full of errors under `packages/api-client` produces nothing. The `pre-commit` hook was
exercised in both directions: a clean commit passes, a staged lint error aborts it.

---

## Next up: M1-T03 — Docker Compose with PostgreSQL and environment validation

Issue [#3](https://github.com/lbcoutinho/family-budget-webapp/issues/3). Notes for whoever
picks it up:

- `docker-compose.yml`: `postgres:16-alpine`, named volume, main DB on 5432 and a second
  `postgres_test` on 5433.
- `.env.example` committed (`.gitignore` already allows it); `.env` stays ignored.
- `apps/api/src/config/env.validation.ts` with `class-validator`, wired into
  `@nestjs/config` (`isGlobal: true`, `validate`). Boot must fail naming the missing variable.
- Keys: `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`, `CORS_ORIGIN`.
- Unit test `env.validation.spec.ts` — this is the first ticket that needs a test runner in
  `apps/api`, so Jest lands here (and with it the `test` script the root `test` fans out to).
- Ordering note: T03 writes NestJS-flavored code but `nest new` only runs in T04. Either
  install `@nestjs/config` + `class-validator` by hand now, or reorder T03 after T04.

Remaining M1 tickets: T04 NestJS bootstrap + health check, T05 Vite/Tailwind/shadcn
bootstrap, T06 GitHub Actions CI, T07 Orval client.
