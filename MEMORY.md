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
4. **TypeScript pinned to `^5.9.3`** (7.x exists but the NestJS/Vite toolchain in the plan
   targets 5.x). `@types/node ^22` added to `apps/api` so its `types: ["node"]` resolves.

No new ADR was needed — everything follows ADR-0001.

### Verified

`pnpm install` → 4 workspace projects. `pnpm -r typecheck` → 3 projects pass.
`pnpm dev` / `build` / `lint` / `test` → exit 0 (no-ops for now).

---

## Next up: M1-T02 — Configure ESLint, Prettier, Husky and lint-staged

Issue [#2](https://github.com/lbcoutinho/family-budget-webapp/issues/2). Notes for whoever
picks it up:

- Root `eslint.config.js` (flat), per-workspace overrides, `eslint-config-prettier` last,
  `@typescript-eslint/no-floating-promises` enabled.
- Prettier: `singleQuote`, `trailingComma: "all"`, `printWidth: 100`.
- Add the real `lint` script to each workspace (the root `lint` will then stop being a
  no-op) and a root `format` script — `format` was intentionally left out of T01 since
  Prettier is not installed yet.
- Exclude `packages/api-client` from lint and format (generated code), and remember its
  placeholder `src/index.ts` from T01.
- Husky `pre-commit` → `lint-staged`.

Remaining M1 tickets: T03 Docker Compose + env validation, T04 NestJS bootstrap + health
check, T05 Vite/Tailwind/shadcn bootstrap, T06 GitHub Actions CI, T07 Orval client.
