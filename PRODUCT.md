# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Single primary user — the household's finance-keeper — recording and reviewing the family's money.
"Family" describes whose money the app tracks, not who logs in: the app is single-user by design.
Every domain entity nonetheless carries `userId` so a future move to multi-user needs no structural
migration. Used on **both desktop and phone as first-class targets** — a wide table is not a
desktop feature with a mobile fallback; both layouts are the design.

## Product Purpose

A personal web application for family budget management and expense tracking. It replaces the
spreadsheet-based process currently in use with structured recording of income and expenses, a
consolidated view by category, and a mechanism for setting money aside. Success is the point where
it can retire the spreadsheet — planned for the end of milestone M5, when the monthly tab and entry
forms ship.

## Positioning

Built around a **unified transaction ledger** whose `type` field carries the semantics, plus two
mechanisms a generic budgeting tool does not model:

- **Cashboxes** — reserves of money held separately from the checking account. Moving money into a
  cashbox is not an expense; only spending from it is. There is deliberately no tracing between a
  withdrawal and the purchases it funds; a cashbox is a pot with its own balance.
- **Dual dates on every transaction, cash-basis** — `date` (when the purchase happened) versus
  `referenceMonth` (which month it reports in). Credit-card purchases record in the month the
  statement is paid while preserving the original purchase date. All reports group by
  `referenceMonth`.

## Operating Context

- Money is tracked on a **cash basis**: an expense counts in the month money actually leaves the
  account.
- **Voice entry**: the user reads a bank statement aloud; the system extracts entries as `DRAFT`,
  affecting nothing until manually approved.
- Single currency: **euro**.
- UI language is **pt-BR** (localized interface strings only); all code, comments, commits, and
  identifiers are en-US.
- Consistent sample-data world across prototypes: same accounts/categories, July 2026.

## Capabilities and Constraints

- **Money is always integer cents** — never float or Decimal. Formatting lives in one place
  (`apps/web/src/lib/money.ts`).
- **Six transaction types**: INCOME, EXPENSE, TRANSFER, CASHBOX_IN, CASHBOX_OUT, CASHBOX_TRANSFER.
  Cashbox is a transaction type, not a category. `amount` is always positive; sign derives from
  `type`. Only EXPENSE counts as an expense in reports.
- **Balances and reports include only `status = CONFIRMED`.** Drafts affect nothing.
- **Deactivate, don't delete** — deleting an Account/Category/Cashbox that has transactions is
  blocked; inactive entities cannot be used in new or edited transactions.
- Categories are a two-level hierarchy (category → subcategory), **max depth 2**.
- **Monthly average, everywhere it appears, means one thing**: the twelve months ending with the
  month on screen, divided only by the months that had movement — never a flat twelve. Where the
  window crosses the year boundary the column is named "Média 12 meses" with a tooltip, not just
  "Média".
- **No CSV export anywhere** in the application. Do not reintroduce it as a convenience.
- Terminology (pt-BR UI): Contas (accounts), Categorias (categories), Caixinhas (cashboxes),
  Recorrências (recurrences), Mês (month), Relatórios (reports), Lançar por voz (voice entry).

## Brand Commitments

No committed name, logo, or voice — the repository name `family-budget-webapp` is a working title.
**No brand colour by design**: the chosen visual direction's thesis is that colour belongs to the
data, never the chrome. Chrome (primary button, active nav, focus ring, table header) is ink. This
is a durable product-level stance, recorded here so future work does not introduce a brand hue;
the specific palette and type choices live in design docs, not here.

## Evidence on Hand

- `plans/0001-overview.md` — architecture, domain model, balance/report formulas (§5.4).
- `plans/screens/AGENTS.md` — screen inventory and per-screen actions.
- `plans/milestones/` — eight milestones (M1 Foundation → M8 Voice entry).
- `docs/adr/` — 15 accepted ADRs (source of truth; accepted ADRs are never edited, only superseded).
- `prototypes/` — throwaway HTML prototypes; `prototypes/MEMORY.md` records every settled UI
  decision. Sample data is fictional but consistent across screens.
- No real financial data, testimonials, customers, or benchmarks exist; future work must not
  fabricate any.

## Product Principles

- **Plans and ADRs are the source of truth.** Before code, read the relevant plan and ADR; if
  implementation would deviate, stop and flag rather than improvise.
- **No screen ships without an approved prototype.** Concept approval and design approval are
  separate gates; a settled concept does not unblock implementation.
- **Correctness of money over convenience.** Integer cents, CONFIRMED-only balances, and the exact
  average definition are non-negotiable — get them wrong and reports break.
- **Designed single-user, structured for multi-user.** `userId` everywhere; no feature assumes a
  single account can never grow.
- **Both ends are the product.** Desktop and phone layouts are designed together, not one derived
  from the other.
