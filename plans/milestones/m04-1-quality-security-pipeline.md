# M4.1 — Quality & Security Pipeline

**Goal:** add a free quality and security layer on top of the existing CI — coverage gates, SAST, secret scanning, and scheduled dependency updates with a safe
auto-merge policy — without a SonarQube server and without duplicating what ESLint, TypeScript and the test suites already cover.

**Definition of done:** every PR to `main` is blocked until lint, typecheck, generated-client verification, unit + integration tests, coverage thresholds, CodeQL
and Gitleaks are green; Dependabot opens grouped version-update PRs every Friday 12:00 `Europe/Lisbon` for npm and GitHub Actions; patch/minor Dependabot PRs
auto-merge after green CI while major PRs wait for manual review; the policy is documented in the repository.

**Depends on:** M4 complete. Source plan: #114.

---

## Baseline (verified 2026-08-12 — do not re-derive)

- `.github/workflows/ci.yml` — one job, `ci`, on `pull_request` + `push: main`, with a `postgres:16-alpine` service and the full boot-time env var set.
  Steps: checkout → `pnpm/action-setup@v6` → `actions/setup-node@v7` (`.nvmrc`, pnpm cache) → `pnpm install --frozen-lockfile` → `pnpm lint` →
  `pnpm -r typecheck` → `pnpm gen` + `git diff --exit-code -- packages/api-client` → `prisma migrate deploy` → `pnpm test` → `pnpm --filter api test:e2e`.
  `.github/workflows/pages.yml` also exists (prototype publishing) and is out of scope.
- **There is no browser E2E suite.** "E2E" in #114 maps to `apps/api` Jest integration tests (`test/jest-e2e.json`, `*.e2e-spec.ts`), already required.
- `apps/api` — Jest, `rootDir: src`, `testRegex: .*\.spec\.ts$`, `collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!generated/**']`,
  `coverageDirectory: ../coverage`. No thresholds, no `test:cov` script.
- `apps/web` — Vitest 4 configured inside `vite.config.ts` (`globals`, `jsdom`, `src/test/setup.ts`). No coverage provider installed.
- Root scripts: `lint`, `typecheck`, `test` (`pnpm -r --if-present test`), plus the `api:*` / `web:*` proxies. No coverage script.
- Repo settings: public (CodeQL and code scanning free), squash-merge only, auto-merge **already enabled**, delete-branch-on-merge on.
- `main` protection: required status check **`ci`** only, `strict: true` (branch must be up to date), 0 required approvals, conversation resolution required,
  no admin enforcement.

Implication: required-check names must stay stable. Keep the single `ci` job (coverage folds into it) and add `codeql` / `gitleaks` as new required contexts.

---

## M4.1-T01 — Coverage thresholds in CI

Done — see #127.

---

## M4.1-T02 — CodeQL static analysis

Done — see #128.

---

## M4.1-T03 — Gitleaks secret scanning

Done — see #129.

---

## M4.1-T04 — Dependabot version updates, weekly

Done — see #130.

---

## M4.1-T05 — Auto-merge for Dependabot patch and minor

Done — see #131.

---

## M4.1-T06 — Required checks on `main`

Done — see #132.

---

## M4.1-T07 — Document the pipeline and validate end to end

Done — see #133.
