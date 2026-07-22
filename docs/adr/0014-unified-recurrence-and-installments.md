# ADR-0014 — Unified recurrence and installments

**Status:** Accepted
**Date:** 2026-07-22

## Context

The system must automatically generate long-running fixed expenses (insurance, financing) and purchase installments. These are two distinct use cases but the same structural problem: a template that produces entries over time.

## Decision

A single `RecurrenceRule` entity. The `totalOccurrences` field distinguishes the cases: null for open-ended recurrence, a value for installments.

Three characteristics:

1. **The rule is a template, not a live binding.** Values are copied onto the transaction at generation time. Editing the rule does not alter entries already created.
2. **Hybrid generation.** Installments materialize all at once. Open-ended recurrence generates on a rolling three-month horizon.
3. **`autoConfirm`** decides whether entries start as `CONFIRMED` (fixed amount) or `DRAFT` (variable amount, such as a utility bill).

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Two separate entities | Would duplicate the generation engine and occurrence calculation |
| A live binding between rule and transactions | Adjusting an insurance premium would rewrite history |
| Generating indefinitely into the future | Would grow without bound in the database |
| Generating only on demand when a month is opened | Future commitments would be invisible |
| Full RRULE (iCalendar) | Disproportionate complexity; monthly and yearly suffice |

## Consequences

### Positive
- One generation engine, one test suite
- History is immutable and auditable
- Installment commitments are visible in advance

### Negative
- Fixing a mistake in a rule requires editing already-generated entries by hand
- `generatedUntil` must be kept in sync within the same database transaction

### Risks and mitigations
- The job duplicating entries → idempotency through two guards: `generatedUntil` advanced atomically and a unique index on `(recurrenceRuleId, referenceMonth)`
- `dayOfMonth = 31` in February → fall back to the last day of the month
- Installments not summing to the total → the final installment absorbs the remainder in cents
