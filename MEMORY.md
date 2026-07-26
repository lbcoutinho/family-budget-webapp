# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**Last done:** M1-T07 — OpenAPI → Orval client pipeline. Branch `m01-t07-orval-client-pipeline`,
PR open, awaiting review. This is the **last ticket of M1**.

Green locally: lint, `pnpm -r typecheck`, web vitest, api unit + e2e (health + new openapi spec),
and the CI stale-client check (`pnpm gen` then `git diff --exit-code` is clean/deterministic). API
boots with `/api/health` 200 and Swagger UI at `/api/docs` 200.

## After this PR merges — M1 is COMPLETE. Two required follow-ups (CLAUDE.md):

1. Run the `dependency-review` skill. Known pins to look at: `actions/checkout`, `setup-node`,
   `pnpm/action-setup` still `@v4` (Node 20, one harmless CI annotation); `@nestjs/swagger@11.4.6`,
   `orval@8.23.0`, `axios@1.18.1`, `tsx@4.23.1` just added; Prisma 6.19 has a 7.x major available.
2. Review/update `CLAUDE.md` — code now exists, so mark planned commands/layout real. Note that
   `pnpm gen` (OpenAPI export → Orval) is now wired, and `.env.example` → `.env` at repo root.

## Non-obvious T07 gotchas (for reviewers / next session)

- Orval v8 defaults to a **fetch** client; had to set `httpClient: 'axios'` to match the mutator.
- tags-split emits **no root barrel** → `packages/api-client/src/index.ts` is a hand-written barrel;
  add one `export * from './generated/<tag>/<tag>'` line per new API tag.
- Custom axios instance lives **inside** `packages/api-client` (`src/lib/axios.ts`), not `apps/web`,
  so the client is self-contained and there is no web→client→web import cycle. Ticket said
  "src/lib/axios.ts" without a package; deviation noted on Issue #7.
- `openapi:export` uses `NestFactory.create(AppModule, { preview: true })` so it never connects to
  the DB, but env validation still runs → the export needs the standard env vars present.
- `apps/api/openapi.json` is **git-ignored** (intermediate); only the generated client is committed.
- `.gitattributes` pins `packages/api-client/**` to LF so the CI diff can't flake on CRLF checkouts.

## Environment notes (this machine)

- Native Windows, Node 24.18 / pnpm 11.17. **Do not run `pnpm format`** — rewrites the whole repo.
  lint-staged formats staged files on commit; scope manual prettier to files you changed.
- Local dev needs `docker compose up -d postgres postgres_test` (both currently up) and a root
  `.env` (`cp .env.example .env`; git-ignored). e2e, api boot and `pnpm gen` all read root `.env`.
- `esbuild` added to `pnpm-workspace.yaml` `allowBuilds` (tsx/vite/vitest need its native binary).

## Still blocked for me (carried over from T06)

Branch protection on `main` requiring the `ci` check — the `gh api -X PUT .../branches/main/protection`
call is denied by the Claude Code permission classifier. User must run it:

```bash
gh api -X PUT repos/lbcoutinho/family-budget-webapp/branches/main/protection \
  -f 'required_status_checks[strict]=true' -f 'required_status_checks[contexts][]=ci' \
  -F 'enforce_admins=false' -F 'required_pull_request_reviews=null' -F 'restrictions=null'
```
