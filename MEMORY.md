# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**v2 prototypes done and pushed**, branch `claude/screens-prototypes-plan-7kk7l9` (restarted from
`main` after #36 merged). Direction **D — Cromático** won; the four candidates moved to
`prototypes/archives/v2-directions/`. v2 covers **three screens** — `00-design-system.html`,
`06-month.html`, `09-reports-monthly.html` — on a shared `_shared/proto.css` + `proto.js`.

Nothing half-finished. **Waiting on the user's design approval**, and `00-design-system.html` is
the one that unblocks everything.

**The remaining ten screens are deliberately not drawn.** They follow once these three are
approved — drawing them first would mean drawing them twice.

**M2-T01 (#26), M2-T02 (#29), M2-T03 (#30), M2-T04 (#32) and M2-T05 (#33) merged.** Only M2-T06
(the login screen, #22) is left in M2 — and it is blocked on a prototype approval, see below.

## Gotchas the next ticket will hit

- **No screen ships without an approved prototype** (rule in `CLAUDE.md`, workflow in
  `plans/0002-screens.md`). **M2-T06 is blocked twice over:** `01-login.html` has not been drawn in
  v2 yet, and nothing has moved to `prototypes/approved/`. Drawing it needs
  `00-design-system.html` approved first.
- **v2's design tokens are settled enough to build against once approved:** no brand colour (chrome
  is `#14161a`), 16 category swatches, money four with cashbox amber at `#8a6008`, Familjen Grotesk
  - Public Sans + DM Mono. They live in `prototypes/_shared/proto.css` and become
    `apps/web/src/styles/index.css`.
- **The token store is `@family-budget/api-client`, not a React context.** `setAccessToken` (call it
  with what `login`/`useLogin` returns), `getAccessToken`, `setSessionExpiredHandler`. Renewal needs
  no wiring: the interceptors are installed when `lib/axios.ts` loads. An `AuthProvider` should wrap
  this store, not replace it.
- **The startup silent refresh is not written yet.** M2-T06 owns it: `POST /api/auth/refresh`
  answers `{ accessToken, user }`, so one call restores the session with no separate "who am I".
  Nothing calls `refresh()` on mount today — the interceptor only reacts to a 401.
- **`installSessionExpiredRedirect()` runs in `main.tsx`** and does a full `location.assign`. Once
  the router owns `/login`, M2-T06 may re-register a router-aware handler via
  `setSessionExpiredHandler` — but something must stay registered, or a dead session goes nowhere.
- **`/login` is still not a route.** The redirect currently lands on a 404 in dev.
- **MSW is set up and strict.** `apps/web/src/test/server.ts` + `test/setup.ts` start it with
  `onUnhandledRequest: 'error'`, so every request a test triggers needs a `server.use(...)` handler.
- **`packages/api-client` is only ignored by lint/prettier under `src/generated/`.** Hand-written
  files in `src/lib/` are linted and formatted like any other source.
- **Every new route is protected the moment it is written** — `@Public()` is what opts out, and it
  also clears the operation's bearer requirement in the OpenAPI document.
- **`@ApiProperty` needs an explicit `type`.** The OpenAPI export runs under `tsx`, which emits no
  `design:type` metadata, so a bare `@ApiProperty()` breaks `pnpm gen`.
- **Add a line to `packages/api-client/src/index.ts` per new API tag** — Orval's tags-split mode
  emits no root barrel, so a generated tag is invisible until it is re-exported there.

## Open decisions / blocked items

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
- **Windows Prisma gotcha:** `prisma generate` (api `postinstall`) can fail with
  `EPERM ... rename query_engine-windows.dll.node` when a leftover node process holds the DLL.
  Harmless if the client is already generated at that version; otherwise close stray node
  processes and retry. Does not block typecheck/lint/test.
- Local dev needs `docker compose up -d postgres postgres_test` and a root `.env`
  (`cp .env.example .env`; git-ignored). Postgres 5432 (main) / 5433 (test). An existing `.env`
  needs the three `SEED_*` keys added by hand before `pnpm --filter api db:seed` will run.
- **`prisma migrate dev` does not always regenerate the client** (it did not after adding `User`);
  run `pnpm --filter api prisma:generate` when the new model is missing from `src/generated/prisma`.

## Next: M2-T06 — Login screen and route protection

Issue #22, the last ticket in M2: `features/auth/` (`LoginPage`, `AuthProvider`, `useAuth`), React
Hook Form + Zod, `ProtectedRoute`, and the silent refresh on mount with a loading state so the
login screen never flashes. `useLogin`/`useLogout` are already exported from the generated client;
the token store and the interceptors above are what it plugs into.

**Do not start it until the login prototype exists and is approved.** `01-login.html` was discarded
with v1 and has not been redrawn — it comes with the remaining ten screens, after
`00-design-system.html` is approved. Its v1 concept was approved in full (narrow centred card, no
illustration, generic error, no "remember me", demo account through the same form), and it also
has to cover the "verificando sessão" state that keeps the form from flashing.
