# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**M1 Foundation complete.** All 7 tickets merged to `main` (last: #16, Orval client). CLAUDE.md
refreshed (no longer "pre-implementation"). Dependency review done at M1 close on branch
`chore/m1-dependency-review` — **still needs a PR to `main`.**

**M2 mirrored to GitHub:** Milestone #2 + issues #17–#22 created. Ready to start M2-T01.

## Open decisions / blocked items

- **Prisma 6 → 7: investigated, ADR written, awaiting the user's call.**
  `docs/adr/0017-prisma-7-with-the-rust-free-client.md` (**Proposed**) recommends adopting
  `^7.9.0` in M2-T01 and carries the ordered implementation steps + spike evidence. Nothing in
  the app changed yet. When the user accepts: flip the status to `Accepted`, update the README
  index, follow the steps, and update the M2-T01 plan text + a comment on issue #17. If the user
  rejects, mark it `Rejected` and start M2-T01 on Prisma 6 unchanged.
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

## Next: M2-T01 — User model and Prisma setup

Issue #17. First migration in the project — sets conventions all later migrations inherit.
**Resolve the Prisma 6-vs-7 decision above first.** Read the ticket in
`plans/milestones/m02-authentication.md`.
