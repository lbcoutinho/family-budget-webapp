# Handoff memory

Where the last ticket stopped and what comes next. Update this at the end of every ticket.
(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Last ticket: M1-T01 — Set up pnpm monorepo with workspaces

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

**Config note:** pnpm 11 reads `engineStrict` from `pnpm-workspace.yaml`, *not* from
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

## Next up: M1-T02 — Configure ESLint, Prettier, Husky and lint-staged

Issue [#2](https://github.com/lbcoutinho/family-budget-webapp/issues/2). Notes for whoever
picks it up:

- Root `eslint.config.js` (flat), per-workspace overrides, `eslint-config-prettier` last,
  `@typescript-eslint/no-floating-promises` enabled. The rule is type-aware, so it needs
  `parserOptions.projectService` — and it is the reason TypeScript stays on 6.x (see above).
- Prettier: `singleQuote`, `trailingComma: "all"`, `printWidth: 100`.
- Add the real `lint` script to each workspace (the root `lint` will then stop being a
  no-op) and a root `format` script — `format` was intentionally left out of T01 since
  Prettier is not installed yet.
- Exclude `packages/api-client` from lint and format (generated code), and remember its
  placeholder `src/index.ts` from T01.
- Husky `pre-commit` → `lint-staged`.

Remaining M1 tickets: T03 Docker Compose + env validation, T04 NestJS bootstrap + health
check, T05 Vite/Tailwind/shadcn bootstrap, T06 GitHub Actions CI, T07 Orval client.
