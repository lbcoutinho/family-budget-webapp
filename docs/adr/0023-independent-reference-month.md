# ADR-0023 — Independent reference month

**Status:** Accepted
**Date:** 2026-09-05

## Context

ADR-0022 made settlement date the sole source for reference month. That preserves cash timing but cannot classify a transaction in a different accounting month: for example, salary received on July 25 may belong to August's budget.

## Decision

`settlementDate` remains the date that affects balances, ordering, date filters, and the daily-expense strip. `referenceMonth` is an independent accounting classification, normalized to the first day of its month and used by monthly screens and reports.

Clients may supply a reference month on create or update. Create defaults it to the settlement month when omitted; update preserves the stored value when omitted. Non-card settlement dates still equal their transaction date, and card settlement constraints remain unchanged.

This ADR supersedes ADR-0022 and restores the accounting-classification intent of ADR-0021 without restoring its duplicate record.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Keep reference month derived from settlement | Cannot represent valid cash-versus-competence differences. |
| Move settlement date to the accounting month | Falsifies the date money affected the balance. |

## Consequences

### Positive

- Cash timing and accounting competence are both represented truthfully.
- Users can correct generated or imported transactions individually.

### Negative

- Monthly membership and financial chronology intentionally use different dates.

### Risks and mitigations

- A manual month can be surprising → forms suggest settlement month until the user changes it.
