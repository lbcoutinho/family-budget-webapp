# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**M2-T02 done** (issue #18): `HashService` (argon2id) at `src/modules/auth/hash.service.ts`,
`toDemoEmail` at `src/modules/users/demo-email.ts`, `prisma/seed.ts` with the owner and `+demo`
accounts, `db:seed` script. Branch `claude/next-task-1hsghf`, PR #29 open to `main` — nothing
half-finished. The plan-doc change it used to carry (demo account folded into M2-T02, M2-T07
dropped) landed separately as #28 and is now in `main`, merged back into this branch.

**M2-T01 merged** (issue #17, PR #26): `User` model, first migration `20260727120653_init_user`,
`db:migrate` / `db:reset` / `db:studio` scripts.

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
