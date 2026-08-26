# ADR-0021 — Explicit reference month precedence

**Status:** Accepted
**Date:** 2026-08-26

## Context

ADR-0009 introduced `referenceMonth` as the reporting date and made the credit-card flag preserve it when a transaction date changes. Every transaction type now exposes that reporting classification for direct editing.

## Decision

An explicitly supplied `referenceMonth` takes precedence over automatic recomputation when `date` changes. The value is normalized to the first day of its month. When no explicit value is supplied, non-card transactions use the calendar month of `date`; a credit-card expense keeps its next-month suggestion.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Infer whether the stored month was manually chosen | The same stored value can result from either an automatic suggestion or a deliberate choice. |
| Keep the field exclusive to credit-card expenses | Transfers and cashbox operations also report by `referenceMonth`. |

## Consequences

### Positive
- Every transaction can be classified in its reporting month.
- Date corrections do not overwrite an explicit accounting choice.

### Negative
- The transaction forms need to preserve whether the user changed the month.

### Risks and mitigations
- A malformed value could be stored outside the first day of the month → the transaction service normalizes every supplied value.
