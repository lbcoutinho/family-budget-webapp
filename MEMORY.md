# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**M2-T03 done** (issue #19): `AuthModule` with `LocalStrategy`, `AuthService`, `AuthController` —
`POST /api/auth/login|refresh|logout`, access token in the body, refresh token in an httpOnly
cookie. Branch `claude/next-task-1hsghf` (restarted from `main` after #29 merged), PR open —
nothing half-finished.

**M2-T01 (#26) and M2-T02 (#29) merged.** `User` model + first migration; `HashService`, the
`+demo` address helper and the two-account seed.

## Gotchas the next ticket will hit

- **`@ApiProperty` needs an explicit `type`.** The OpenAPI export runs under `tsx`, whose esbuild
  transform emits no `design:type` metadata, so a bare `@ApiProperty()` on a `string` field makes
  `@nestjs/swagger` report a bogus circular dependency and `pnpm gen` fails.
- **Request pipeline lives in `src/app.setup.ts`** (`configureApp`), shared by `main.ts` and every
  e2e spec. New global middleware, pipes or filters go there, not into `main.ts`.
- **Guards run before pipes**, so `POST /auth/login` answers a malformed body with 401 from
  `LocalStrategy`, never 400 from the validation pipe.
- M2-T04 adds the global `JwtAuthGuard`; `@Public()` must then be applied to `/health`,
  `/auth/login`, `/auth/refresh` **and `/auth/logout`** (logout must work with an expired token).

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

## Next: M2-T03 — Local login with Passport and JWT issuance

Issue #19. Two things M2-T02 leaves for it: **`HashService` belongs to no module yet** — the
`AuthModule` this ticket creates must list it in `providers` (and `exports`, once anything outside
auth needs it); and the seed's `SEED_*` variables are deliberately **outside** the boot-time env
validation, since only `prisma/seed.ts` reads them — `JWT_SECRET` and friends are already in
`EnvironmentVariables`, so this ticket adds nothing there.
