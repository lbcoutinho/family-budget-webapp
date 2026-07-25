# Architecture Decision Records

A record of the project's architectural decisions and the reasoning behind them.

## Conventions

- Sequential numbering, zero-padded to four digits
- One file per decision, named `NNNN-title-in-kebab-case.md`
- An accepted ADR is **never edited**. To change a decision, add a new ADR with status `Accepted` and mark the previous one as `Superseded by ADR-XXXX`
- Use the [template](template.md) for new records

## Statuses

| Status | Meaning |
|---|---|
| Proposed | Under discussion |
| Accepted | Currently in force |
| Rejected | Evaluated and discarded |
| Superseded | Replaced by another ADR |

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-typescript-and-pnpm-monorepo.md) | TypeScript strict mode and pnpm monorepo | Accepted |
| [0002](0002-nestjs-prisma-postgresql.md) | NestJS, Prisma and PostgreSQL on the backend | Accepted |
| [0003](0003-react-vite-tailwind-shadcn.md) | React, Vite, Tailwind and shadcn/ui on the frontend | Accepted |
| [0004](0004-openapi-contract-with-orval.md) | API contract via OpenAPI and Orval | Accepted |
| [0005](0005-money-as-integer-cents.md) | Monetary values as integer cents | Accepted |
| [0006](0006-userid-on-all-entities.md) | `userId` on every domain entity | Accepted |
| [0007](0007-cashbox-as-transaction-type.md) | Cashbox as a transaction type, not a category | Accepted |
| [0008](0008-cashbox-without-funding-trace.md) | Cashbox as a pot, without funding traceability | Accepted |
| [0009](0009-dual-date-and-reference-month.md) | Dual dates and the credit card flag | Accepted |
| [0010](0010-self-referencing-two-level-category.md) | Self-referencing category with two levels | Accepted |
| [0011](0011-auth-with-passport-and-jwt.md) | Authentication with Passport and JWT | Accepted |
| [0012](0012-draft-status-on-transaction.md) | Draft status on the transaction instead of an import table | Accepted |
| [0013](0013-dropping-external-hash.md) | Dropping `externalHash` for deduplication | Accepted |
| [0014](0014-unified-recurrence-and-installments.md) | Unified recurrence and installments | Accepted |
| [0015](0015-deactivation-instead-of-deletion.md) | Deactivation instead of deletion | Accepted |
| [0016](0016-node-24-lts-as-the-runtime.md) | Node 24 LTS as the runtime | Accepted |
