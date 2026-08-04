# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state: M1 complete (Foundation)

**M1 Foundation scaffolded** — monorepo, tooling, CI, health-check API, web bootstrap, and the OpenAPI→Orval client all exist. **M2 Authentication is next; no feature/domain code yet.** `plans/` and `docs/adr/` remain **strict source of truth**. Before code, read relevant plan + ADR; if implementation would deviate, **stop and flag** rather than improvise.

- `plans/0001-overview.md` — architecture, domain model, balance/report formulas (§5.4).
- `plans/0002-screens.md` — screen inventory, actions per screen, prototype workflow, open UI questions.
- `plans/milestones/` — 8 milestones (M1 Foundation → M8 Voice entry), each list of small tasks. First user-visible value at end of M5.
- `plans/MEMORY.md` — GitHub mirroring convention + progress tracker.
- `docs/adr/` — 15 accepted ADRs. **Accepted ADRs never edited** — supersede with new one (sequential 4-digit, kebab-case, use `template.md`).

## Ticket workflow (follow for every task)

- **Create GitHub Issue immediately before starting ticket**, so GitHub never drifts from plan docs. Run `.claude/skills/github-mirroring/` skill when starting milestone — drive automatically, unasked — and before starting any individual ticket.
- **When implementation reveals new architectural decision, record new ADR** in `docs/adr/` (never edit accepted) and **update affected future tickets/issues** to match.
- **When decision deviates from ticket's original plan, add comment to that Issue** explaining deviation.
- **When milestone completed, review this `CLAUDE.md` and update** if anything changed (e.g. once code exists, mark planned commands/layout real; refresh shifted conventions/gotchas).
- **When milestone completed, run `dependency-review` skill** (`.claude/skills/dependency-review/`): every pinned version — libraries, `@types/*`, Node, pnpm, Docker images, Actions — moves to latest release proven compatible with rest of stack.

## UI prototypes (blocking rule for every screen)

**No screen is written in React without an approved prototype.** Prototypes live in `prototypes/` — throwaway HTML, one shared `_shared/proto.css` + `proto.js`, no build step, no dependencies. Purpose: settle concept, colour, typography, spacing and animation while changing one's mind is still free.

- **Before implementing any screen ticket, check `prototypes/approved/`.** Prototype missing or still under review → **stop and ask**, don't improvise UI.
- **`prototypes/MEMORY.md` records every UI decision the user has already made — split by topic, with `MEMORY.md` itself as the index.** It holds only the status-per-screen table plus links; `prototypes/memory/global-rules.md` holds cross-cutting settled rules (no dark mode, no CSV, the monthly-average definition, what "approved" means), and `prototypes/memory/<NN>-<screen>.md` holds one screen's own decisions. Touching or regenerating a screen → read that screen's file plus `global-rules.md`, not the whole tree. Updating a screen's status → edit the index's table and that screen's file only. Note that **concept approval and design approval are separate gates**: a concept can be settled while the file is still under review, so it stays out of `approved/` and the screen stays blocked.
- Lifecycle: `prototypes/*.html` (under review) → `approved/` (implementation may start) → or `discarded/` (rejected, kept as record) → or `archives/` (exploration that did its job, kept as the record of a choice — not a rejection). A whole generation moves to `discarded/vN-<name>/` or `archives/vN-<name>/`, carrying `_shared/` and the index so it still renders. Moving a file also updates the status table in `prototypes/index.html` and §4 of `plans/0002-screens.md`, same commit.
- **State right now: `00-design-system.html`, `01-login.html`, `02-app-shell.html` and `06-month.html` are approved** and live in `approved/` (so M2-T06, M3-T06 and the M5 month tickets are unblocked on the UI side); `09-reports-monthly.html` is under review. v2 is direction **D — Cromático**, chosen from four candidates now in `archives/v2-directions/`; v1 is in `discarded/v1-default/`. Its thesis, amended once in review: **colour belongs to the data — and to the action** — no brand colour, but `--action` (= `--income`) on primary button, focus ring and active nav item; 10 category swatches; two typefaces, Familjen Grotesk + Public Sans, numbers included via `tabular-nums`.
- **Screens are drawn one at a time, in the order the project needs them, and approved one at a time.** Never draw the undrawn screens in a batch, and never draw the next one unasked.
- Every prototype ends with a **"Decisões a aprovar"** block — the open choices, stated so they can be decided rather than guessed.
- `00-design-system.html` is approved first; everything else inherits colour/type/motion from it.
- **UI strings go through i18n keys** (`apps/web/src/i18n/`, ADR-0018): pt-BR is the default locale and the source of truth for wording, en-US is kept at parity, `eslint-plugin-i18next` enforces it. Filenames, comments, commits stay en-US. Sample data fictional but consistent across screens (same accounts/categories, July 2026).
- An approved prototype may be edited when implementation reveals a problem — say so in the PR. What must never happen is a built screen silently diverging from it.
- Prototypes are not accessibility- or component-complete: shadcn/ui provides the real components; the prototype CSS is deleted as each screen ships.

## Impeccable (design tooling)

[Impeccable](https://github.com/pbakaus/impeccable) v3.5.0 is vendored into `.claude/` — the `impeccable` skill (`/impeccable audit`, `critique`, `polish`, `animate`, … as sub-commands), four `impeccable-*` agents, and a design hook wired into `.claude/settings.json` that runs its 59-rule detector after `Edit`/`Write`/`MultiEdit` on UI files and does a deeper pass on `Stop`. Apache 2.0; `npx impeccable detect <path>` runs the same detector standalone.

- **It advises, it does not decide.** The prototype gate above still wins: a detector finding never authorizes a screen without an approved prototype, and never overrides a decision already settled in `prototypes/MEMORY.md` or `00-design-system.html`.

## Stack & layout

pnpm monorepo, TypeScript strict (`noUncheckedIndexedAccess`), Node 24 LTS (ADR-0016).

- `apps/api/` — NestJS + Prisma 7 + PostgreSQL 16. Jest + Supertest. Client generated as CommonJS TypeScript into `src/generated/prisma` (git-ignored, rebuilt by `postinstall`) — **never hand-edit; excluded from lint/format/coverage.** Connection URL lives in `prisma.config.ts` for the CLI and comes from `ConfigService` at runtime, never from a `url` in `schema.prisma` (ADR-0017).
- `apps/web/` — Vite + React 19 + Tailwind v4/shadcn + TanStack Query. **Organized by feature, not file type.** Vitest + Testing Library + MSW.
- `packages/api-client/` — Orval-generated typed React-Query client. **Never hand-edit; excluded from lint/format.**

Commands: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm format` / `pnpm -r typecheck`. Non-obvious: `pnpm gen` regenerates API client (OpenAPI export → Orval); CI fails if generated client stale. `docker compose up -d` runs Postgres on 5432 (main) + 5433 (test). **`prisma migrate reset` is user-run:** the Prisma 7 CLI detects an AI agent and refuses without the user's verbatim consent in `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.

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
- **Run `pr-description` skill** (`.claude/skills/pr-description/`) **whenever opening pull request**, to structure PR body instead of freeform text. Skill pins `model: sonnet` — documentation work runs on Sonnet 5, so PR footer names Sonnet even when session runs another model.
- **English (en-US) everywhere** — code, comments, commit messages, identifiers. Only user-facing UI strings go through i18n keys, pt-BR as source of truth and en-US kept at parity.
- **One task = one small PR**; split if diff exceeds ~400 lines. Merge only on green CI (lint + typecheck + tests).
- **One migration per schema-changing task**; never edited after commit.
- Prettier differs from defaults: `singleQuote`, `trailingComma: "all"`, `printWidth: 160`. ESLint flat config; **`@typescript-eslint/no-floating-promises` enabled + critical for NestJS** — always await or explicitly void promises.
