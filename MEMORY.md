# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**Last done:** M1-T04 — NestJS API + `GET /api/health`
([issue #4](https://github.com/lbcoutinho/family-budget-webapp/issues/4),
[PR #13](https://github.com/lbcoutinho/family-budget-webapp/pull/13), open, awaiting review).

Nothing is half-finished. `apps/api` now boots (`pnpm --filter api dev`), health check green.

## Environment notes (this machine)

- Native Windows, Node 24.18 / pnpm 11.17 already correct — the old container/nvm note is gone.
- Local dev needs `docker compose up -d postgres postgres_test` and a root `.env`
  (`cp .env.example .env`; git-ignored). e2e and app boot both read that root `.env`.

## Next: M1-T05 — Bootstrap the frontend with Vite, Tailwind and shadcn/ui

Read the ticket in `plans/milestones/m01-foundation.md` first. Notes:

- **`apps/web` is already a populated workspace** (has `package.json`/`tsconfig` from T01) — same
  as T04, scaffold into it carefully with `pnpm create vite`, don't clobber. Confirm before overwriting.
- **Vite dev proxy `/api` → `http://localhost:3000`** (the API's `PORT`); the API serves under the
  global `/api` prefix, so proxy the `/api` path straight through.
- Issue #5 likely already exists (run github-mirroring / check before creating).
