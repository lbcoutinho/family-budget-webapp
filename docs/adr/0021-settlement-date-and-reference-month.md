# ADR-0021 — Settlement date and reference month

**Status:** Accepted
**Date:** 2026-08-29

## Context

ADR-0009 introduced `date` and `referenceMonth` to preserve when a transaction happened and the month in which it reports. Cash settlement is a third concept: a card transaction cannot settle before the month in which it is reported.

## Decision

Every transaction stores a non-null `settlementDate` alongside the existing fields:

- `date` — when the underlying financial event happened
- `settlementDate` — when money settles; `date` for non-card transactions, otherwise the later of `date` and `referenceMonth`
- `referenceMonth` — the first day of the reporting month

This expand phase preserves `referenceMonth` as an API input. New producers derive `settlementDate`; existing rows are backfilled with the same rule. Reports continue to use `referenceMonth` until later migration tickets adopt settlement-date workflows.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Replace `referenceMonth` now | Would break independent producers and existing request clients during the migration |
| Derive settlement date only when read | Leaves no stable historical value for later settlement workflows |
| Use the transaction date for every row | Loses the delayed cash impact of card transactions |

## Consequences

### Positive

- Reporting and settlement concepts are explicit and independently queryable
- Existing clients keep sending the same transaction payloads

### Negative

- Transactions temporarily carry three dates until downstream migration is complete

### Risks and mitigations

- A new producer might omit the field; the non-null database column rejects that write, and focused producer tests cover each current path
