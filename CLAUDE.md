# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state: pre-implementation

There is **no application code yet** — only planning and architecture docs. `plans/` and `docs/adr/` are the **strict source of truth**. Before writing code, read the relevant plan and ADR; if your implementation would deviate from them, **stop and flag it** rather than improvising.

- `plans/0001-overview.md` — architecture, domain model, balance/report formulas (§5.4).
- `plans/milestones/` — 8 milestones (M1 Foundation → M8 Voice entry), each a list of small tasks. First user-visible value lands at end of M5.
- `plans/MEMORY.md` — GitHub mirroring convention + progress tracker.
- `docs/adr/` — 15 accepted ADRs. **Accepted ADRs are never edited** — supersede with a new one (sequential 4-digit, kebab-case, use `template.md`).

## Ticket workflow (follow for every task)

- **When you finish or stop work on a ticket, write/update `MEMORY.md` at the project root** with where we stopped and the next steps.
- **Read `MEMORY.md` at the project root before writing any new code.** It records where the last ticket stopped and the next steps. (This is a handoff file — distinct from `plans/MEMORY.md`, which only tracks GitHub mirroring progress.)
- **Create the GitHub Issue immediately before starting a ticket**, so GitHub never drifts from the plan docs. Run `.claude/skills/github-mirroring/` skill when starting a milestone — drive it automatically, without being asked — and before starting any individual ticket.
- **When implementation reveals a new architectural decision, record a new ADR** in `docs/adr/` (never edit accepted ones) and **update the affected future tickets/issues** to match.
- **When a decision deviates from the ticket's original plan, add a comment to that Issue** explaining the deviation.
- **When a milestone is completed, review this `CLAUDE.md` and update it** if anything has changed (e.g. once code exists, mark the planned commands/layout as real; refresh conventions or gotchas that shifted).
- **When a milestone is completed, run the `dependency-review` skill** (`.claude/skills/dependency-review/`): every pinned version — libraries, `@types/*`, Node, pnpm, Docker images, Actions — moves to the latest release proven compatible with the rest of the stack.

## Planned stack & layout (aspirational — scripts below don't exist until scaffolded)

pnpm monorepo, TypeScript strict (`noUncheckedIndexedAccess`), Node 24 LTS (ADR-0016).
- `apps/api/` — NestJS + Prisma + PostgreSQL 16. Jest + Supertest.
- `apps/web/` — Vite + React 19 + Tailwind v4/shadcn + TanStack Query. **Organized by feature, not by file type.** Vitest + Testing Library + MSW.
- `packages/api-client/` — Orval-generated typed React-Query client. **Never hand-edit; excluded from lint/format.**

Planned commands: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm format` / `pnpm -r typecheck`. Non-obvious: `pnpm gen` regenerates the API client (OpenAPI export → Orval); CI fails if the generated client is stale. `docker compose up -d` runs Postgres on 5432 (main) and 5433 (test).

## Domain rules (get these wrong and reports break)

- **Money is always integer cents** — never float/Decimal. Formatting lives only in `apps/web/src/lib/money.ts`. Single currency (euro).
- **Dual dates on every transaction:** `date` (when it happened) vs `referenceMonth` (which month it reports in, normalized to the 1st). Credit-card transactions keep `referenceMonth` when `date` changes; others recompute it.
- **6 transaction types:** INCOME, EXPENSE, TRANSFER, CASHBOX_IN, CASHBOX_OUT, CASHBOX_TRANSFER. Cashbox is a **transaction type, not a category**. Only EXPENSE counts as an expense in reports. `amount` is always positive; sign is derived from `type`.
- **Balances & reports only include `status = CONFIRMED`.** Voice-entered transactions save as `DRAFT` and affect nothing until approved.
- **Deactivate, don't delete** — deleting an Account/Category/Cashbox that has transactions is blocked; inactive entities can't be used in new/edited transactions.
- **`userId` on every entity** (single-user now, designed so multi-user needs no structural migration).
- Categories self-reference, **max depth 2** (parent has `parentId IS NULL`).
- Env vars are validated at boot (fail-fast): `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`, `CORS_ORIGIN`.

## Conventions

- **Branch-per-implementation.** All implementation goes on a branch off `main` — never commit directly to `main`. Commit and push to the feature branch and open a pull request to `main`. **Never merge to `main`** — the user reviews and merges.
- **Run the `pr-description` skill** (`.claude/skills/pr-description/`) **whenever opening a pull request**, to structure the PR body instead of writing freeform text.
- **English (en-US) everywhere** — code, comments, commit messages, identifiers. Only user-facing UI strings are localized.
- **One task = one small PR**; split if the diff exceeds ~400 lines. Merge only on green CI (lint + typecheck + tests).
- **One migration per schema-changing task**; never edited after commit.
- Prettier differs from defaults: `singleQuote`, `trailingComma: "all"`, `printWidth: 100`. ESLint flat config; **`@typescript-eslint/no-floating-promises` is enabled and critical for NestJS** — always await or explicitly void promises.