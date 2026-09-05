# ADR-0022 — Settlement date contract

**Status:** Superseded by ADR-0023
**Date:** 2026-09-04

## Context

ADR-0021 introduced `settlementDate` through an expand migration while keeping `referenceMonth` as a client-controlled compatibility field. Every transaction producer now supplies settlement data, so the compatibility rule would leave two sources of truth for accounting time.

## Decision

`settlementDate` is the accounting date for every transaction. `referenceMonth` is always `startOfMonth(settlementDate)` and is never accepted independently from create or update clients.

For non-card transactions, `settlementDate` equals `date`. For credit-card expenses, it is required and cannot precede `date`; changing only the purchase date preserves it. Balances, chronological transaction queries, date filters, and daily expenses use settlement date. Reports group by the derived reference month.

This ADR supersedes ADR-0021 and, through it, ADR-0009.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Keep client-controlled `referenceMonth` | Allows it to disagree with the accounting date. |
| Derive settlement from reference month | Loses an actual settlement day and preserves the obsolete source of truth. |
| Use purchase date for all balance timing | Makes credit-card purchases affect cash before they settle. |

## Consequences

### Positive

- Every balance and chronological view has one accounting-date source.
- Monthly reports remain simple grouped reads over the derived month.

### Negative

- Card entry needs a separate settlement-date field.

### Risks and mitigations

- A direct database write could violate the rule → database constraints enforce card, date, and reference-month invariants.
