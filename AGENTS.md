## Project state: M3 in progress (Master data)

**M1 Foundation and M2 Authentication complete.** M3 Master data underway: Account, Category and Cashbox models/APIs, base layout/nav, i18n foundation and
stable API error codes all shipped; Accounts and Categories screens (M3-T07, M3-T08) are built. **M3-T09 (Cashboxes screen) is next** — its prototype
(`prototypes/approved/05-cashboxes.html`) is approved. Remaining after that: M3-T12–T14 (locale on `User`, Settings › General, deploy to Vercel). GitHub Issues
are **strict source of truth** for ticketed work; `docs/adr/` for architectural decisions. Before code, read the issue + relevant ADR; if implementation would
deviate, **stop and flag** rather than improvise.

## Repository structure

- `plans/0001-overview.md` — architecture, domain model, balance/report formulas (§5.4).
- `plans/screens/AGENTS.md` — screen inventory, actions per screen, prototype workflow.
- `plans/milestones/` — 8 milestones (M1 Foundation → M8 Voice entry).
- `docs/adr/` — ADRs indexed in `docs/adr/AGENTS.md`.
- `apps/api/` — API/backend.
- `apps/web/` — Web frontend.
- `packages/api-client/` — Orval-generated typed React-Query client.

## Commands

**Repo-wide** (run from root, cover both apps)

- `pnpm dev` / `pnpm build` / `pnpm test`
- `pnpm lint` / `pnpm lint:fix` / `pnpm format` / `pnpm format:check`
- `pnpm -r typecheck`
- `pnpm gen` — regenerates `@family-budget/api-client` (OpenAPI export → Orval)
- `pnpm verify backend` / `pnpm verify frontend` — end-of-task checks
- `pnpm go` — quick start dev app.

**API** (`api:*`, proxies to `apps/api`)

- `pnpm api:dev` / `api:build` / `api:start` / `api:typecheck` / `api:test` / `api:test:watch` / `api:test:e2e`.
- `pnpm api:prisma:generate` — regenerate Prisma client into `src/generated/prisma`.
- `pnpm api:db:migrate` / `api:db:seed` / `api:db:studio` — Prisma migrate deploy, seed script, Prisma Studio.
- `pnpm api:db:reset` — not the same as `prisma migrate reset`; still **user-run**.
- `pnpm api:openapi:export` — exports the OpenAPI contract used by `pnpm gen`.

**Web** (`web:*`, proxies to `apps/web`)

- `pnpm web:dev` / `web:build` / `web:preview` / `web:typecheck` / `web:test` / `web:test:watch`.
- `pnpm web:gen:client` — Orval step of `pnpm gen`; run `pnpm gen` from root instead unless you already have a fresh OpenAPI export.

**Infra**

- `docker compose up -d` — Postgres on 5432 (main) + 5433 (test).

## Ticket workflow (follow for every task)

- Don't create issues in Github without explicit ask
- Never work on the main worktree, unless explicitly asked. Always create separate worktree for any work.
- **GitHub Issues/Milestones are the source of truth for anything already ticketed** — local files above only cover what isn't ticketed yet.
- **Plans are written directly into the GitHub issue body** (`## Implementation Plan`, `## Acceptance Criteria`, `## Tests`), never to a local plan file — this
  overrides `superpowers:writing-plans`'s default of saving to `docs/superpowers/plans/`.
- Use the `create-issue` skill to open the issue for one ticket at a time.
- **A milestone file's task collapses to `Done — see #<N>.`** once that task has a GitHub issue — the issue body is authoritative from then on, not the
  milestone file.
- **When implementation reveals new architectural decision, record new ADR** in `docs/adr/` (never edit accepted) and **update affected future tickets/issues**
  to match.
- **When decision deviates from ticket's original plan, add comment to that Issue** explaining deviation.
- **Do regular commits** - commit on every step finished when implementing a plan or doing code changes. Always use skill `create-commit` for commits.
- Never execute lint, format, typecheck, unit tests, e2e test, API client regenerate or any command that user can quickly run manually after coding is done.
  Commit the changes and print the commands the user needs to run in order.
- **When opening a PR, always use the `create-pr` skill** — never the PR format from the Superpowers plugin, even if another Superpowers workflow is triggered
  beforehand.
- **ADRs and plans may sacrifice prose grammar for token economy**
- **When milestone completed, review all `AGENTS.md` + `README.md` and update**. If anything changed (e.g. once code exists, mark planned commands/layout real;
  refresh shifted conventions/gotchas). Also scan `docs/superpowers/specs/` for specs whose referenced tickets are all closed on GitHub, and prompt the user to
  delete the spec — no automated tracker, a manual check each time.

## Impeccable (design tooling)

[Impeccable](https://github.com/pbakaus/impeccable) v3.5.0 is vendored into `.claude/` — the `impeccable` skill (`/impeccable audit`, `critique`, `polish`,
`animate`, … as sub-commands), four `impeccable-*` agents, and a design hook wired into `.claude/settings.json` that runs its 59-rule detector after `Edit`/
`Write`/`MultiEdit` on UI files and does a deeper pass on `Stop`. Apache 2.0; `npx impeccable detect <path>` runs the same detector standalone.

- **It advises, it does not decide.** The prototype gate above still wins: a detector finding never authorizes a screen without an approved prototype, and never
  overrides a decision already settled in `prototypes/MEMORY.md` or `00-design-system.html`.

## Domain rules (get these wrong and reports break)

- **Money always integer cents** — never float/Decimal. Formatting lives only in `apps/web/src/lib/money.ts`. Single currency (euro).
- **Dual dates on every transaction:** `date` (when happened) vs `referenceMonth` (which month it reports in, normalized to 1st). Credit-card transactions keep
  `referenceMonth` when `date` changes; others recompute.
- **6 transaction types:** INCOME, EXPENSE, TRANSFER, CASHBOX_IN, CASHBOX_OUT, CASHBOX_TRANSFER. Cashbox is **transaction type, not category**. Only EXPENSE
  counts as expense in reports. `amount` always positive; sign derived from `type`.
- **Balances & reports only include `status = CONFIRMED`.** Voice-entered transactions save as `DRAFT`, affect nothing until approved.
- **Deactivate, don't delete** — deleting Account/Category/Cashbox with transactions blocked; inactive entities can't be used in new/edited transactions.
- **`userId` on every entity** (single-user now, designed so multi-user needs no structural migration).
- Categories self-reference, **max depth 2** (parent has `parentId IS NULL`).
- Env vars validated at boot (fail-fast): `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_SECRET`,
  `REFRESH_TOKEN_EXPIRES_IN`, `CORS_ORIGIN`.

## Agentic workflow

- Use Opus model exclusively for thinking tasks like architecture analysis and decisions, writings ADRs and plans. If you're in a session with Opus selected and
  need to write code or update docs then start a subagent with Haiku medium to do the work.
- When implementing plans, use a subagent for each step. Analyze the plan and create a dependency tree to understand what can be done in parallel and what's
  sequential. Use the main session to coordinate the subagents.

## Conventions

- **Branch-per-implementation** — never commit directly to `main`. Commit + push to feature branch, open pull request to `main`.
- **Never merge PRs** — user reviews and merges.
- **English (en-US) everywhere** — code, comments, commit messages, identifiers.
- Prettier differs from defaults: `singleQuote`, `trailingComma: "all"`, `printWidth: 160`.
