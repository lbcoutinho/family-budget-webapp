# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**Screen plan + prototypes done** (branch `claude/screens-prototypes-plan-7kk7l9`): `plans/0002-screens.md`
(13 screens, actions per screen, open questions) and `prototypes/` (14 throwaway HTML pages,
`_shared/proto.css` + `proto.js`, `approved/` and `discarded/` folders). Nothing half-finished —
**waiting on the user's approvals**, starting with `00-design-system.html`.

**M2-T04 done** (issue #20): `JwtStrategy`, the global `JwtAuthGuard` (`APP_GUARD` in
`AuthModule`), `@Public()` and `@CurrentUser()`, plus bearer auth in the OpenAPI document.

**M2-T01 (#26), M2-T02 (#29) and M2-T03 (#30) merged.** The backend half of M2 is complete; the
two remaining tickets are frontend.

## Gotchas the next ticket will hit

- **No screen ships without an approved prototype** (rule in `CLAUDE.md`, workflow in
  `plans/0002-screens.md`). M2-T05 is unaffected — it is pure wiring, no UI. **M2-T06 is blocked
  until `prototypes/01-login.html` and `00-design-system.html` move to `prototypes/approved/`.**
- **Every new route is protected the moment it is written.** A route needs no decorator to require
  a token; it needs `@Public()` (`src/modules/auth/decorators/public.decorator.ts`) not to. That
  decorator also clears the operation's bearer requirement in the OpenAPI document, so the two
  cannot drift.
- **`@CurrentUser()` gives `{ id, email }`, not a full `User`** — the access token's claims, with
  no database read. Anything else about the account is a query.
- **The web client has no auth wiring yet.** M2-T05 adds it: the access token lives in memory, the
  refresh cookie is scoped to `Path=/api/auth` (so axios needs `withCredentials: true`), and
  `POST /api/auth/refresh` answers `{ accessToken, user }` — enough to restore a session on page
  load without a separate "who am I" call.
- **The axios instance M2-T05 has to extend already exists**, at
  `packages/api-client/src/lib/axios.ts`, not at the `apps/web/src/lib/axios.ts` the ticket names.
  It is the hand-written Orval mutator every generated hook funnels through; `apps/web` depends on
  the package and never the other way round, so the interceptors belong there.
- **`@ApiProperty` needs an explicit `type`.** The OpenAPI export runs under `tsx`, whose esbuild
  transform emits no `design:type` metadata, so a bare `@ApiProperty()` on a `string` field makes
  `@nestjs/swagger` report a bogus circular dependency and `pnpm gen` fails.
- **Request pipeline lives in `src/app.setup.ts`** (`configureApp`), shared by `main.ts` and every
  e2e spec. New global middleware, pipes or filters go there, not into `main.ts`.

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

## Next: M2-T05 — Axios instance with refresh interceptor

Issue #21, and the first frontend ticket since M1. `apps/web/src/features/auth/` is still an empty
`.gitkeep`, and the generated client already exposes `login`, `refresh` and `logout` — so the
ticket is the token store, the interceptors and the single-flight refresh queue around them, not
new endpoints. See the axios gotcha above for where they go.
