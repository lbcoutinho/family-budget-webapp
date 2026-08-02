# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**M2 Authentication is complete and merged.** M3 Master data is mirrored on GitHub
(#45–#53). **M3-T01 (#45) is merged.** **M3-T03 (#47) is done** on branch
`feat/m3-t03-category-model` — `Category` model, migration `20260802205319_add_category` with the
hand-written partial index, the sample category tree in the seed, `test/e2e/category.e2e-spec.ts`.
Nothing is half-finished. **M3-T02 (#46), the accounts API, is still open and is the next backend
ticket** — it was skipped, not started; the branch `feat/m3-t02-accounts-api` holds no commits.

## Gotchas the next ticket will hit

- **The seed writes sample data for the demo user only, never for the owner**, and those rows hold
  a foreign key onto `User` with `onDelete: Restrict`: any fixture that deletes a user must delete
  that user's accounts and categories first (P2003) — see `removeFixtures()` in
  `test/e2e/account.e2e-spec.ts`.
- **Categories need two delete passes.** The self-relation is `onDelete: Restrict` and PostgreSQL
  checks it per row, so a single `deleteMany` spanning parents and children fails with P2003:
  delete `parentId: { not: null }` first, then the roots.
- **Root-category uniqueness lives in raw SQL, not in the schema.** `@@unique([userId, parentId,
name])` covers subcategories only — `NULL != NULL` — so the partial index
  `category_root_name_unique` was hand-appended to the `add_category` migration. A drift probe
  (`migrate dev --create-only` on an unchanged schema) came back **empty**, so Prisma leaves it
  alone; still, check any future migration's SQL for a `DROP INDEX` on it.
- **Prisma 7 no longer reports `meta.target` on P2002** — the driver adapter replaces it with
  `driverAdapterError`. Tests that need to name a constraint query `pg_indexes` instead.
- **The design tokens now live in `apps/web/src/styles/index.css`**, ported from
  `prototypes/_shared/proto.css` by M2-T06: one light appearance (no `.dark` block), `--primary` =
  the income green `#1a7a52`, ten `--category-N` swatches, and the two typefaces loaded from Google
  Fonts in `apps/web/index.html` (`font-sans` = Public Sans, `font-display` = Familjen Grotesk).
  Money colours beyond `--destructive` arrive with the first screen showing an amount.
- **The session is a React Query entry, not `useState`** — key `['auth', 'session']`
  (`SESSION_QUERY_KEY` in `features/auth/auth-provider.tsx`), holding `AuthUserDto | null`. Login
  seeds it with `setQueryData`; nothing else may write it. `useAuth()` is the read side.
- **`lib/session.ts` is gone.** `AuthProvider` registers the `setSessionExpiredHandler` itself and
  answers an expiry by setting the session query to `null`, so `ProtectedRoute` navigates instead
  of the page hard-reloading. A `ponytail:` comment there marks what is still missing: other cached
  queries survive an expiry, and must be evicted once real data is cached.
- **`routes` is exported from `app/router.tsx`** alongside `router`, so tests mount the real route
  table on `createMemoryRouter`. New screens go in that array, protected unless deliberately public.
- **No screen ships without an approved prototype.** Approved so far: `00-design-system.html`,
  `01-login.html`, `06-month.html`. M3's screens are not drawn yet — draw them one at a time, in
  the order the project needs them, and never unasked.
- **MSW is strict** (`onUnhandledRequest: 'error'`): every request a test triggers needs a
  `server.use(...)` handler.
- **`@ApiProperty` needs an explicit `type`** — the OpenAPI export runs under `tsx`, so a bare
  `@ApiProperty()` breaks `pnpm gen`.
- **Add a line to `packages/api-client/src/index.ts` per new API tag** — Orval's tags-split mode
  emits no root barrel.
- **Every new API route is protected the moment it is written**; `@Public()` is what opts out.

## Open decisions / blocked items

- **`.claude/worktrees/` is not git-ignored** and holds stale worktrees
  (`proto-v2-02-05`, `mirror-m3-issues`, `m3-t03-category-model`). `git add -A` sweeps them in, and `pnpm lint` from the
  repository root lints them (~3700 errors that CI never sees). Prune them, or ignore the path.
- **Dependency review from M1 close still has no PR.** Branch `chore/m1-dependency-review`.
- **Branch protection on `main` still not set** (requiring the `ci` check). The
  `gh api -X PUT .../branches/main/protection` call is blocked by the Claude Code permission
  classifier — user must run it:
  ```bash
  gh api -X PUT repos/lbcoutinho/family-budget-webapp/branches/main/protection --input - <<'JSON'
  { "required_status_checks": { "strict": true, "contexts": ["ci"] },
    "enforce_admins": false, "required_pull_request_reviews": null, "restrictions": null }
  JSON
  ```

## Environment notes (this machine)

- Native Windows, Node 24.18 / pnpm 11.17. **Do not run `pnpm format` (`prettier --write .`)** — it
  rewrites/CRLF-touches the whole repo. lint-staged formats staged files on commit.
- **Docker was not running when M2-T06 was verified**, so the login flow was proven against MSW and
  in the browser (the dev proxy 502s without the API, and the app correctly falls through to the
  login form) but never against the real API. Worth one manual pass with
  `docker compose up -d postgres postgres_test` + `pnpm --filter api db:seed` before merging.
- **Windows Prisma gotcha:** `prisma generate` (api `postinstall`) can fail with
  `EPERM ... rename query_engine-windows.dll.node` when a leftover node process holds the DLL.
  Harmless if the client is already generated at that version.
- Local dev needs `docker compose up -d postgres postgres_test` and a root `.env`
  (`cp .env.example .env`; git-ignored). Postgres 5432 (main) / 5433 (test). An existing `.env`
  needs the three `SEED_*` keys added by hand before `pnpm --filter api db:seed` will run.
- **`prisma migrate dev` does not always regenerate the client**; run
  `pnpm --filter api prisma:generate` when a new model is missing from `src/generated/prisma`.
