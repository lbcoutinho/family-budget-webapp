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

-- TODO Leandro: create bullet list and improve description - create commands per area of project
Commands: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm format` / `pnpm -r typecheck`. Non-obvious: `pnpm gen` regenerates API client (OpenAPI
export → Orval); CI fails if generated client stale. `docker compose up -d` runs Postgres on 5432 (main) + 5433 (test). **`prisma migrate reset` is user-run:**
the Prisma 7 CLI detects an AI agent and refuses without the user's verbatim consent in `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.

## Rules

- GitHub Issues/Milestones are the source of truth for anything already ticketed — local files above only cover what isn't ticketed yet.
- When implementation reveals new architectural decision, record new ADR in `docs/adr/` (never edit accepted) and update affected future tickets/issues to match.
- A milestone file's task collapses to `Done — see #<N>.`. Once that task has a GitHub issue — the issue body is authoritative from then on, not the milestone file.
- When milestone completed, review all `AGENTS.md` + `README.md` and update. If anything changed (e.g. once code exists, mark planned commands/layout real; refresh shifted conventions/gotchas). Also scan `docs/superpowers/specs/` for specs whose referenced tickets are all closed on GitHub, and prompt the user to delete the spec — no automated tracker, a manual check each time.

## Impeccable (design tooling)

[Impeccable](https://github.com/pbakaus/impeccable) is vendored into `.claude/` — the `impeccable` skill (`/impeccable audit`, `critique`, `polish`,
`animate`, … as sub-commands), four `impeccable-*` agents, and a design hook wired into `.claude/settings.json` that runs its 59-rule detector after `Edit`/
`Write`/`MultiEdit` on UI files and does a deeper pass on `Stop`. Apache 2.0; `npx impeccable detect <path>` runs the same detector standalone.

- It advises, it does not decide. The prototype gate still wins: a detector finding never authorizes a screen without an approved prototype, and never
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

## Conventions

- Prettier differs from defaults: `singleQuote`, `trailingComma: "all"`, `printWidth: 160`.
