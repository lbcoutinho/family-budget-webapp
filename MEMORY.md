# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**M2 Authentication is complete and merged; M3-T01 (#45, PR #57), M3-T02 (#46, PR #58), M3-T03
(#47, PR #60) and M3-T06 (#50, PR #61) are merged.** M3 Master data is mirrored on GitHub
(#45–#53). **M3-T04 (#48, categories API) and M3-T05 (#49, cashboxes model and API) are both
done**, T04 on branch `claude/m3-t04-categories-api` and T05 (this branch,
`worktree-m3-t05-cashbox`) merged with `main` to bring T04 in — conflicts were confined to
`app.module.ts`, the api-client barrel files and this memory file, all additive on both sides.
Nothing is half-finished. **M3's backend is now done** (T01–T06 all merged/complete); the
remaining M3 tickets are frontend screens — M3-T07 (#51, accounts), M3-T08 (categories), M3-T09
(cashboxes) — each blocked on its own prototype leaving `prototypes/approved/`. T07 is next once
`prototypes/03-accounts.html` is approved.

## Gotchas the next ticket will hit

- **A screen goes inside the shell, not beside it.** Add the route to the array in
  `app/router.tsx` (it is a child of the `AppLayout` route, so it is protected already), then
  render `<PageHeader title actions>` followed by `<PageContent>` — those two are the page frame
  and come from `components/page-header.tsx`. Replace the `RoutePlaceholder` that is holding the
  route rather than adding a second one.
- **`shell:` is the one custom breakpoint** (900 px, `styles/index.css`). `AppLayout` reads the
  same number through `useMediaQuery`, so if one changes, both do.
- **`window.matchMedia` does not exist in jsdom.** `test/setup.ts` installs a stub answering "no
  match" (= desktop) for every test; a test that wants the phone calls
  `stubMatchMedia(COMPACT_VIEWPORT)` from `test/match-media.ts`.
- **`react-hooks/set-state-in-effect` is on and it fails the build.** Resetting state when a prop
  or the route changes is done during render (`if (pathname !== lastPathname) …`), not in an
  effect — see `AppLayout` and `AppSidebar`.
- **Money is formatted only through `lib/money.ts`.** `formatCents` for display,
  `parseCurrencyInput` for what a user typed (it accepts `1.234,56` and `1234.56`, returns `null`
  for anything that is not a number, and rounds past two decimals).
- **M3-T02 set the master-data module pattern; copy it rather than reinventing it** for categories
  and cashboxes: `assertOwnership(row, userId)` from `common/` (returns the row, throws 404 — never
  403), `userId` from `@CurrentUser()` and never from the body, a `visibility()` helper building the
  `OR` array (a branch of `{ id: undefined }` would match _every_ row), and no pre-check before a
  duplicate name or a blocked delete — the database answers, and `PrismaExceptionFilter` maps P2002
  and P2003 to 409.
- **A boolean query param needs `@Transform`**, not just `@IsBoolean()`: `ValidationPipe`'s
  `transform` coerces any non-empty string to `true`, so `?includeInactive=false` would be true.
- **The demo user has no sample cashboxes.** M3-T05 seeded none — nothing in the ticket asked for
  it, and a cashbox reads as empty until balances exist (M4-T07). Add them to `seed.ts` alongside
  `seedAccounts` when the cashboxes screen (M3-T09) needs populated data.
- **The delete-blocked 409 has no end-to-end test yet** — nothing references an `Account` until the
  `Transaction` model lands in M4. The mapping is unit-tested in `prisma-exception.filter.spec.ts`;
  add the real case with M4. (Categories already prove the 409 through their self-relation: a root
  still holding subcategories cannot be deleted.)
- **Two M3-T04 rules are waiting on the `Transaction` model, and M4 has to pick them up**: "block a
  kind change when transactions reference the category" (a `ponytail:` comment marks the spot in
  `CategoriesService.update`), and the delete-blocked case above. Both land with M4-T01.
- **`CategoriesService` owns three invariants the schema cannot state**: the tree is two levels
  deep, a subcategory matches its parent's kind and carries no colour of its own, and an active
  root always has an active subcategory (hence the automatic "Outros" on create, and the 409 on
  deactivating the last one). Deactivating _or_ activating a root cascades to its children.
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
  seeds it with `setQueryData`; nothing else may write it. `useAuth()` is the read side. A
  `ponytail:` comment there marks what is still missing: other cached queries survive an expiry,
  and must be evicted once real data is cached.
- **No screen ships without an approved prototype.** Approved so far: `00-design-system.html`,
  `01-login.html`, `02-app-shell.html`, `06-month.html`. `03-accounts`, `04-categories` and
  `05-cashboxes` are drawn but still under review, so M3-T07/T08/T09 are blocked on the UI side.
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
