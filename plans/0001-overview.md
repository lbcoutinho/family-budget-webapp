# Plan 0001 — Project Overview

**Repository:** https://github.com/lbcoutinho/family-budget-webapp
**Last updated:** 2026-09-04

---

## 1. Application context

Personal web app for **family budget management and expense tracking**. Replaces the current spreadsheet: structured recording of income/expenses, consolidated view by category, mechanism for setting money aside.

**Single-user**, but every domain entity carries `userId` so a future multi-user move needs no structural migration.

### 1.1 Domain

Four core concepts:

| Concept | Description |
|---|---|
| **Account** | Source or destination of money (e.g. a bank name). |
| **Category** | Two-level classification hierarchy (category → subcategory). |
| **Cashbox** | A reserve of money held separately from the checking account. |
| **Transaction** | Unified ledger entry. The `type` field determines its semantics. |

### 1.2 Cashbox mechanics

The non-trivial part of the domain. A cashbox is a pot of reserved money.

1. **Deposit** (`CASHBOX_IN`): money leaves an account, enters a cashbox. **Not an expense.**
2. **Cashbox transfer** (`CASHBOX_TRANSFER`): moves money between pots. Touches no account, doesn't appear on the bank statement.
3. **Withdrawal** (`CASHBOX_OUT`): money returns from cashbox to account.
4. **Spend** (`EXPENSE`): only here does money become an expense and enter reports.

No tracing between a withdrawal and the expenses it funded — a €500 withdrawal may fund six independent purchases, no way to know which euro paid for what. A cashbox is just a pot with its own balance.

A cashbox is expected to end: renaming never rewrites past entries (each transaction snapshots the cashbox name at the time); once balance is zero it may be deleted outright, even with transaction history (ADR-0019).

### 1.3 Cash basis and credit cards

**Cash basis**: expense recorded in the month the money actually leaves the account. Credit card purchases recorded in the month the statement is paid, preserving the original purchase date.

Requires **three dates** on every transaction:

- `date` — when the underlying event happened (March 5)
- `settlementDate` — when money affects balances (April 1 for a card purchase)
- `referenceMonth` — the first day of the settlement month (April 1), derived by the server

All reports and the monthly tab group by `referenceMonth`.

### 1.4 Voice entry

User reads their bank statement aloud, system extracts the entries. Voice-created transactions save as `status = DRAFT`, affect balances/reports only after manual approval.

---

## 2. Technology stack

### 2.1 Shared

| Item | Choice |
|---|---|
| Language | TypeScript (strict) |
| Package manager | pnpm + workspaces |
| Lint / Format | ESLint + Prettier |
| Git hooks | Husky + lint-staged |
| CI | GitHub Actions |
| Standalone scripts | tsx |

### 2.2 Backend

| Item | Choice |
|---|---|
| Framework | NestJS |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Validation | class-validator + class-transformer |
| Auth | @nestjs/passport, passport-local, passport-jwt, @nestjs/jwt |
| Password hashing | argon2 |
| Documentation | @nestjs/swagger (OpenAPI 3) |
| Config | @nestjs/config with boot-time validation |
| Logging | nestjs-pino |
| Testing | Jest + Supertest |

### 2.3 Frontend

| Item | Choice |
|---|---|
| Build | Vite |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router |
| Server state | TanStack Query |
| HTTP | Axios (via generated client) |
| Generated client | Orval (from OpenAPI) |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| Charts | Recharts |
| Dates | date-fns |
| Testing | Vitest + Testing Library + MSW |

### 2.4 Local infrastructure

- Docker Compose with PostgreSQL
- Environment variables validated at boot (fail fast)

### 2.5 Out of scope

Redis, GraphQL, microservices, Kubernetes, Storybook, Redux, global state manager.

---

## 3. Folder structure

```
family-budget-webapp/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   └── pipes/
│   │   │   ├── config/
│   │   │   │   └── env.validation.ts
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── users/
│   │   │       ├── accounts/
│   │   │       ├── categories/
│   │   │       ├── cashboxes/
│   │   │       ├── transactions/
│   │   │       ├── reports/
│   │   │       └── recurrence/
│   │   └── test/
│   │       └── e2e/
│   └── web/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── app/
│       │   │   ├── router.tsx
│       │   │   └── providers.tsx
│       │   ├── components/
│       │   │   └── ui/          # shadcn/ui
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── accounts/
│       │   │   ├── categories/
│       │   │   ├── cashboxes/
│       │   │   ├── transactions/
│       │   │   ├── reports/
│       │   │   └── voice/
│       │   ├── hooks/
│       │   ├── lib/
│       │   │   ├── axios.ts
│       │   │   ├── money.ts
│       │   │   └── date.ts
│       │   └── styles/
│       └── orval.config.ts
├── packages/
│   └── api-client/              # Orval output — do not edit by hand
├── docs/
│   └── adr/                     # Architecture Decision Records
├── plans/
│   ├── 0001-overview.md
│   └── milestones/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

**Frontend convention:** organize by *feature*, not file type. Each folder under `features/` holds its own components, hooks and types.

---

## 4. Architecture decisions

All architectural decisions, including alternatives considered and rejected, recorded as ADRs in [`docs/adr/`](../docs/adr/AGENTS.md).

Not repeated here. When a decision changes, a new ADR supersedes the previous one; this plan updates only where the change affects scope or sequencing.

---

## 5. Approved data model

### 5.1 Enums

```
TransactionType   : INCOME | EXPENSE | TRANSFER | CASHBOX_IN | CASHBOX_OUT | CASHBOX_TRANSFER
TransactionStatus : DRAFT | CONFIRMED
TransactionSource : MANUAL | VOICE | RECURRING
CategoryKind      : EXPENSE | INCOME
Frequency         : MONTHLY | YEARLY
```

### 5.2 Required fields by transaction type

| Type | account | destAccount | cashbox | destCashbox | category | subcategory |
|---|---|---|---|---|---|---|
| `INCOME` | required | — | — | — | required | required |
| `EXPENSE` | required | — | — | — | required | required |
| `TRANSFER` | source | destination | — | — | — | — |
| `CASHBOX_IN` | source | — | destination | — | — | — |
| `CASHBOX_OUT` | destination | — | source | — | — | — |
| `CASHBOX_TRANSFER` | — | — | source | destination | — | — |

`CASHBOX_IN`, `CASHBOX_OUT` and `CASHBOX_TRANSFER` also snapshot `cashboxLabel` and, where
applicable, `destinationCashboxLabel` — cashbox name at the moment the entry is written, set by
the server, not user input (ADR-0019).

### 5.3 Invariants

- `amount` is always positive; the sign is derived from `type`
- `referenceMonth` is the first day of `settlementDate`'s month and is never client-controlled
- `settlementDate` is `date` for non-card transactions; a credit-card settlement date cannot precede its purchase date
- `category.kind` must match the transaction type (`INCOME` only accepts `INCOME` categories)
- `subcategory.parentId === categoryId`
- maximum category depth is 2 (`parent.parentId IS NULL`)
- `destinationCashboxId ≠ cashboxId`; `destinationAccountId ≠ accountId`
- `CASHBOX_OUT` must not drive a cashbox balance negative
- every referenced entity belongs to the same `userId`
- **balances and reports always filter `status = CONFIRMED`**
- inactive entities cannot be used when creating or editing
- deleting an Account or Category that has transactions is blocked
- a Cashbox with a non-zero balance cannot be deleted (409); a zero-balance Cashbox may be deleted
  even with transactions — its transactions keep `cashboxLabel`/`destinationCashboxLabel` but get
  `cashboxId`/`destinationCashboxId` set to `NULL` (ADR-0019)
- a `CASHBOX_*` transaction with a null `cashboxId`/`destinationCashboxId` means its cashbox was
  deleted, never "no cashbox" (ADR-0019)

### 5.4 Balance formulas

```
Account = initialBalance
        + INCOME − EXPENSE
        − CASHBOX_IN + CASHBOX_OUT
        + TRANSFER(destination) − TRANSFER(source)

Cashbox = CASHBOX_IN − CASHBOX_OUT
        + CASHBOX_TRANSFER(destination) − CASHBOX_TRANSFER(source)
```

### 5.5 Settlement and reference-month rules

- On create and update, `referenceMonth = startOfMonth(settlementDate)`.
- A non-card transaction derives `settlementDate` from `date`.
- A credit-card transaction requires `settlementDate`; changing only its purchase date preserves settlement.
- Chronological ledger order is `settlementDate`, then `createdAt`, then `id`.

---

## 6. Milestones

| # | Milestone | Goal | File |
|---|---|---|---|
| M1 | Foundation | Monorepo, tooling, CI, database, app bootstrap | [m01](milestones/m01-foundation.md) |
| M2 | Authentication | Working end-to-end login | [m02](milestones/m02-authentication.md) |
| M3 | Master data | Accounts, categories and cashboxes (API + UI) | [m03](milestones/m03-master-data.md) |
| M4 | Transactions (API) | Domain core and business rules | [m04](milestones/m04-transactions-api.md) |
| M5 | Entries (UI) | Monthly tab and entry forms | [m05](milestones/m05-entries-ui.md) |
| M6 | Reports | Category view, monthly and yearly | [m06](milestones/m06-reports.md) |
| M7 | Recurrence | Fixed expenses and installments | [m07](milestones/m07-recurrence.md) |
| M8 | Voice entry | Capture, parsing and approval | [m08](milestones/m08-voice-entry.md) |

Every screen inside those milestones is covered by [plans/screens/](screens/AGENTS.md): screens, actions each offers, prototype that must be approved before implementation.

First milestone delivering real value: end of **M5** — from that point the application replaces the spreadsheet.

M7 and M8 both depend only on M5, not on each other; may be built in either order or in parallel.

---

## 7. Working conventions

### 7.1 Language

All documentation, code, comments, commit messages and identifiers in **English (en-US)**. Only user-facing interface strings are localized.

### 7.2 Tasks and pull requests

- Each task becomes a **GitHub issue**; the plan (`## Implementation Plan`, `## Acceptance Criteria`, `## Tests`) is written directly into the issue body at execution time — never copied from a `plans/milestones/*.md` file
- Each task is **one small pull request**; split if the diff exceeds roughly 400 lines
- A pull request merges only with green CI (lint + typecheck + tests)

### 7.3 Testing

Every task includes tests, by layer:

| Layer | Type | Tooling |
|---|---|---|
| Services (business rules) | Unit | Jest |
| Controllers / HTTP flow | Integration | Jest + Supertest + test database |
| React components | Unit | Vitest + Testing Library |
| Data-driven screens | Integration | Vitest + MSW |

API integration tests run against a real, ephemeral PostgreSQL database, migrations applied, each test wrapped in a rolled-back transaction.

### 7.4 ADRs

Every significant architectural decision produces an ADR in `docs/adr/`, numbered sequentially, using the template at `docs/adr/template.md`. Accepted ADRs never edited — replaced by a new ADR that supersedes them.

### 7.5 Migrations

One migration per schema-changing task. Never edited after commit.
