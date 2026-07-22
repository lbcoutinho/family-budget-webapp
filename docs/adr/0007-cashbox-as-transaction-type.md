# ADR-0007 — Cashbox as a transaction type, not a category

**Status:** Accepted
**Date:** 2026-07-22

## Context

In the current spreadsheet, transfers into savings are recorded under a category named "Caixa", and reports exclude that category manually.

Replicating this in the system would mean every report carrying a condition like `WHERE category.name != 'Caixa'` — a business rule hidden inside a string. Renaming the category would silently break every figure.

## Decision

Cashbox movements are transaction types (`CASHBOX_IN`, `CASHBOX_OUT`, `CASHBOX_TRANSFER`), not categories. Expense reports filter on `type = 'EXPENSE'`, so deposits are excluded by construction.

Cashboxes become records in a `Cashbox` table. The spreadsheet's "Caixa" category is not migrated as a category.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Keeping it as a category | A business rule encoded in a string; fragile to renaming |
| An `isTransfer` flag on the category | Better than a string, but conflates classification with movement semantics |
| A category with `kind = TRANSFER` | Would still require explicit exclusion in reports |

## Consequences

### Positive
- Reports are correct by construction, with no manual exclusions
- Cashboxes gain their own identity, balance and goal
- It becomes impossible to accidentally "spend" into a savings category

### Negative
- The interface needs a flow distinct from the expense form (M5-T04)
- More types in the validation matrix

### Risks and mitigations
- The user finding the new flow unfamiliar → the interface keeps using the Portuguese term "Caixa"
