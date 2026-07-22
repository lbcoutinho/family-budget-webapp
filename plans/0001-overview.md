# Plan 0001 — Project Overview

**Status:** Awaiting approval
**Repository:** https://github.com/lbcoutinho/family-budget-webapp
**Last updated:** 2026-07-22

---

## 1. Application context

A personal web application for **family budget management and expense tracking**. It replaces the spreadsheet-based process currently in use, providing structured recording of income and expenses, a consolidated view by category, and a mechanism for setting money aside.

The application is **single-user**, but every domain entity carries `userId` so that a future move to multi-user requires no structural migration.

### 1.1 Domain

The system revolves around four concepts:

| Concept | Description |
|---|---|
| **Account** | Source or destination of money (e.g. a bank name). |
| **Category** | Two-level classification hierarchy (category → subcategory). |
| **Cashbox** | A reserve of money held separately from the checking account. |
| **Transaction** | Unified ledger entry. The `type` field determines its semantics. |

### 1.2 Cashbox mechanics

This is the non-trivial part of the domain. A cashbox is a pot of reserved money.

1. **Deposit** (`CASHBOX_IN`): money leaves an account and enters a cashbox. **Not an expense.**
2. **Cashbox transfer** (`CASHBOX_TRANSFER`): moves money between pots. Touches no account and does not appear on the bank statement.
3. **Withdrawal** (`CASHBOX_OUT`): money returns from the cashbox to an account.
4. **Spend** (`EXPENSE`): only here does the money become an expense and enter reports.

There is no tracing between a withdrawal and the expenses it funded. A €500 withdrawal may fund six independent purchases, and there is no real way to know which euro paid for what. A cashbox is simply a pot with its own balance.

### 1.3 Cash basis and credit cards

The user works on a **cash basis**: an expense is recorded in the month the money actually leaves the account. Credit card purchases are recorded in the month the statement is paid, while preserving the original purchase date.

This requires **two dates** on every transaction:

- `date` — when the purchase happened (March 5)
- `referenceMonth` — which month it belongs to in reports (April 1)

All reports and the monthly tab group by `referenceMonth`.

### 1.4 Voice entry

The user reads their bank statement aloud and the system extracts the entries. Transactions created by voice are saved with `status = DRAFT` and affect balances and reports only after manual approval.

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

**Frontend convention:** organize by *feature*, not by file type. Each folder under `features/` holds its own components, hooks and types.

---

## 4. Architecture decisions

All architectural decisions, including the alternatives that were considered and rejected, are recorded as ADRs in [`docs/adr/`](../docs/adr/README.md).

Decisions are not repeated here. When a decision changes, a new ADR supersedes the previous one and this plan is updated only where the change affects scope or sequencing.

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

### 5.3 Invariants

- `amount` is always positive; the sign is derived from `type`
- `referenceMonth` is always normalized to the first day of the month
- `category.kind` must match the transaction type (`INCOME` only accepts `INCOME` categories)
- `subcategory.parentId === categoryId`
- maximum category depth is 2 (`parent.parentId IS NULL`)
- `destinationCashboxId ≠ cashboxId`; `destinationAccountId ≠ accountId`
- `CASHBOX_OUT` must not drive a cashbox balance negative
- every referenced entity belongs to the same `userId`
- **balances and reports always filter `status = CONFIRMED`**
- inactive entities cannot be used when creating or editing
- deleting an Account, Category or Cashbox that has transactions is blocked

### 5.4 Balance formulas

```
Account = initialBalance
        + INCOME − EXPENSE
        − CASHBOX_IN + CASHBOX_OUT
        + TRANSFER(destination) − TRANSFER(source)

Cashbox = CASHBOX_IN − CASHBOX_OUT
        + CASHBOX_TRANSFER(destination) − CASHBOX_TRANSFER(source)
```

### 5.5 `referenceMonth` rule

- On create: when omitted, `referenceMonth = startOfMonth(date)`
- On update, when `date` changes:
  - `isCreditCard = false` → recompute `referenceMonth`
  - `isCreditCard = true` → preserve the chosen `referenceMonth`

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

The first milestone that delivers real value is the end of **M5**: from that point the application replaces the spreadsheet.

M7 and M8 both depend only on M5, not on each other, and may be built in either order or in parallel.

---

## 7. Working conventions

### 7.1 Language

All documentation, code, comments, commit messages and identifiers are written in **English (en-US)**. Only user-facing interface strings are localized.

### 7.2 Tasks and pull requests

- Each task becomes a **GitHub issue**, with the body copied from the milestone file
- Each task is **one small pull request**; if the diff exceeds roughly 400 lines, split it
- A pull request merges only with a green CI (lint + typecheck + tests)

### 7.3 Testing

Every task includes tests. By layer:

| Layer | Type | Tooling |
|---|---|---|
| Services (business rules) | Unit | Jest |
| Controllers / HTTP flow | Integration | Jest + Supertest + test database |
| React components | Unit | Vitest + Testing Library |
| Data-driven screens | Integration | Vitest + MSW |

API integration tests run against a real, ephemeral PostgreSQL database with migrations applied and each test wrapped in a rolled-back transaction.

### 7.4 ADRs

Every significant architectural decision produces an ADR in `docs/adr/`, numbered sequentially, using the template at `docs/adr/template.md`. Accepted ADRs are never edited — they are replaced by a new ADR that supersedes them.

### 7.5 Migrations

One migration per schema-changing task. Migrations are never edited after being committed.
