# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**Last done:** M1-T05 — frontend bootstrap (Vite 8 + React 19 + Tailwind v4 + shadcn/ui + React
Query + React Router + Vitest) in `apps/web`
([issue #5](https://github.com/lbcoutinho/family-budget-webapp/issues/5), PR open, awaiting review).
M1-T04 (`apps/api` health check, PR #13) still open awaiting review too.

Nothing half-finished. `pnpm --filter web dev` boots on :5173, landing page renders a styled shadcn
Card+Button, `test`/`build`/`typecheck`/`lint` all green.

## Environment notes (this machine)

- Native Windows, Node 24.18 / pnpm 11.17. **Do not run `pnpm format` (`prettier --write .`)** — it
  rewrites/CRLF-touches the whole repo and pollutes the diff. lint-staged formats staged files on
  commit; scope any manual prettier run to the files you changed.
- Local dev needs `docker compose up -d postgres postgres_test` and a root `.env`
  (`cp .env.example .env`; git-ignored). e2e and api boot both read that root `.env`.

## Next: M1-T06 — GitHub Actions CI pipeline

Read the ticket in `plans/milestones/m01-foundation.md`. Notes:

- Single job, sequential: install (pnpm cache) → lint → typecheck → test; `postgres:16-alpine`
  service container + `prisma migrate deploy` on the test DB before tests; concurrency group
  cancelling stale PR runs. End of ticket: enable branch protection requiring green CI on `main`.
- Issue #6 already exists. Both T04 (#13) and T05 PRs are still open — CI will run against them.
