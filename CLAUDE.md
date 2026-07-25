# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state: pre-implementation

**No application code yet** — only planning + architecture docs. `plans/` and `docs/adr/` are **strict source of truth**. Before code, read relevant plan + ADR; if implementation would deviate, **stop and flag** rather than improvise.

- `plans/0001-overview.md` — architecture, domain model, balance/report formulas (§5.4).
- `plans/milestones/` — 8 milestones (M1 Foundation → M8 Voice entry), each list of small tasks. First user-visible value at end of M5.
- `plans/MEMORY.md` — GitHub mirroring convention + progress tracker.
- `docs/adr/` — 15 accepted ADRs. **Accepted ADRs never edited** — supersede with new one (sequential 4-digit, kebab-case, use `template.md`).

## Ticket workflow (follow for every task)

- **Read `MEMORY.md` at project root before writing any new code.** Handoff file: lets session that ends mid-implementation resume next. (Distinct from `plans/MEMORY.md`, which only tracks GitHub mirroring progress.)
- **Write `MEMORY.md` when you finish or stop work on ticket, and whenever user says "salve o progresso" / "vamos parar aqui"** (or equivalent any language) — that phrase = explicit checkpoint signal.
- **Keep `MEMORY.md` minimal, rewrite not append.** Holds only what needed to resume interrupted work or start next ticket — where unfinished change stopped, any non-obvious gotcha next ticket hits. Nothing else: what built + why belongs in Issue, PR body, `docs/adr/`. If last ticket finished + unrelated to next, one line naming it enough.
- **Create GitHub Issue immediately before starting ticket**, so GitHub never drifts from plan docs. Run `.claude/skills/github-mirroring/` skill when starting milestone — drive automatically, unasked — and before starting any individual ticket.
- **When implementation reveals new architectural decision, record new ADR** in `docs/adr/` (never edit accepted) and **update affected future tickets/issues** to match.
- **When decision deviates from ticket's original plan, add comment to that Issue** explaining deviation.
- **When milestone completed, review this `CLAUDE.md` and update** if anything changed (e.g. once code exists, mark planned commands/layout real; refresh shifted conventions/gotchas).
- **When milestone completed, run `dependency-review` skill** (`.claude/skills/dependency-review/`): every pinned version — libraries, `@types/*`, Node, pnpm, Docker images, Actions — moves to latest release proven compatible with rest of stack.

## Planned stack & layout (aspirational — scripts below don't exist until scaffolded)

pnpm monorepo, TypeScript strict (`noUncheckedIndexedAccess`), Node 24 LTS (ADR-0016).

- `apps/api/` — NestJS + Prisma + PostgreSQL 16. Jest + Supertest.
- `apps/web/` — Vite + React 19 + Tailwind v4/shadcn + TanStack Query. **Organized by feature, not file type.** Vitest + Testing Library + MSW.
- `packages/api-client/` — Orval-generated typed React-Query client. **Never hand-edit; excluded from lint/format.**

Planned commands: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm format` / `pnpm -r typecheck`. Non-obvious: `pnpm gen` regenerates API client (OpenAPI export → Orval); CI fails if generated client stale. `docker compose up -d` runs Postgres on 5432 (main) + 5433 (test).

## Domain rules (get these wrong and reports break)

- **Money always integer cents** — never float/Decimal. Formatting lives only in `apps/web/src/lib/money.ts`. Single currency (euro).
- **Dual dates on every transaction:** `date` (when happened) vs `referenceMonth` (which month it reports in, normalized to 1st). Credit-card transactions keep `referenceMonth` when `date` changes; others recompute.
- **6 transaction types:** INCOME, EXPENSE, TRANSFER, CASHBOX_IN, CASHBOX_OUT, CASHBOX_TRANSFER. Cashbox is **transaction type, not category**. Only EXPENSE counts as expense in reports. `amount` always positive; sign derived from `type`.
- **Balances & reports only include `status = CONFIRMED`.** Voice-entered transactions save as `DRAFT`, affect nothing until approved.
- **Deactivate, don't delete** — deleting Account/Category/Cashbox with transactions blocked; inactive entities can't be used in new/edited transactions.
- **`userId` on every entity** (single-user now, designed so multi-user needs no structural migration).
- Categories self-reference, **max depth 2** (parent has `parentId IS NULL`).
- Env vars validated at boot (fail-fast): `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`, `CORS_ORIGIN`.

## Conventions

- **Branch-per-implementation.** All implementation on branch off `main` — never commit directly to `main`. Commit + push to feature branch, open pull request to `main`. **Never merge to `main`** — user reviews and merges.
- **Run `pr-description` skill** (`.claude/skills/pr-description/`) **whenever opening pull request**, to structure PR body instead of freeform text.
- **English (en-US) everywhere** — code, comments, commit messages, identifiers. Only user-facing UI strings localized.
- **One task = one small PR**; split if diff exceeds ~400 lines. Merge only on green CI (lint + typecheck + tests).
- **One migration per schema-changing task**; never edited after commit.
- Prettier differs from defaults: `singleQuote`, `trailingComma: "all"`, `printWidth: 160`. ESLint flat config; **`@typescript-eslint/no-floating-promises` enabled + critical for NestJS** — always await or explicitly void promises.
