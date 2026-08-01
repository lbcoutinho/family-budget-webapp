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

**`00-design-system.html` is approved** and moved to `prototypes/approved/` (PR #43, branch
`design-system-v2-review`): ten category colours instead of sixteen, a green action accent
(`--action` = `--income`) on primary button / focus / active nav, DM Mono dropped in favour of
Public Sans with tabular figures, launch dialog settled as opening on EXPENSE.

**`01-login.html` is drawn and awaiting the user's review** — the screen M2-T06 needs. Nothing
half-finished; the ticket stays blocked until that file moves to `approved/` too.

**Screens are drawn one at a time from now on**, in the order the project needs them, and approved
one at a time. Do not draw the remaining ones in a batch, and do not draw the next one unasked.

**M2-T01 (#26), M2-T02 (#29), M2-T03 (#30), M2-T04 (#32) and M2-T05 (#33) merged.** Only M2-T06
(the login screen, #22) is left in M2 — and it is blocked on a prototype approval, see below.

## Gotchas the next ticket will hit

- **No screen ships without an approved prototype** (rule in `CLAUDE.md`, workflow in
  `plans/0002-screens.md`). **M2-T06 is blocked on one thing now:** `01-login.html` is drawn but
  still under review. It ships the moment that file reaches `prototypes/approved/`.
- **v2's design tokens after the first review:** no brand colour, but `--action` (= `--income`,
  `#1a7a52`) on primary button, focus ring and active nav item; **10** category swatches; money four
  with cashbox amber at `#8a6008`; **two typefaces only** — Familjen Grotesk for display, Public
  Sans for body _and_ every number, the latter through `.num { font-variant-numeric: tabular-nums }`
  rather than a monospaced family. They live in `prototypes/_shared/proto.css` and become
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

**Do not start it until `01-login.html` is approved.** The prototype now exists and is under
review; it draws all four states the ticket has to build — initial, submitting, invalid credential
and the "verificando sessão" screen that keeps the form from flashing. Two behaviours it settles
that the ticket must honour: the submitting state lives in the button (no overlay), and a failed
attempt clears and focuses the password while keeping the email.
