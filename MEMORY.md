# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**M2-T01 merged** (issue #17, PR #26): `User` model, first migration `20260727120653_init_user`,
`db:migrate` / `db:reset` / `db:studio` scripts, integration spec. Nothing half-finished.

**M2-T02 widened** (issue #18): the seed now also creates a demo account on the `+demo` sub-address
of `SEED_USER_EMAIL`, with its own `SEED_DEMO_USER_PASSWORD`. A sign-up-endpoint ticket (M2-T07,
issue #27) was opened and then closed as not planned — M2-T02 already covers single-account
creation from the environment. M2 is six tasks again.

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
  (`cp .env.example .env`; git-ignored). Postgres 5432 (main) / 5433 (test).
- **`prisma migrate dev` does not always regenerate the client** (it did not after adding `User`);
  run `pnpm --filter api prisma:generate` when the new model is missing from `src/generated/prisma`.

## Next: M2-T02 — argon2 hashing service and initial user seed

Issue #18. `HashService` (argon2id) plus `prisma/seed.ts`, wired through **`migrations.seed` in
`apps/api/prisma.config.ts`** — Prisma 7 dropped the `prisma.seed` key in `package.json`
(ADR-0017). `tsx` is already a devDependency; it runs the seed as CommonJS, so keep the seed body
in a `main()` function — no top-level `await`. `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` need an
entry in `.env.example`; they are read by the seed script, not by the API, so decide deliberately
whether they belong in the boot-time env validation (they probably do not).
