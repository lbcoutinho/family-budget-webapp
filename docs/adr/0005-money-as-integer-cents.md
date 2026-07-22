# ADR-0005 — Monetary values as integer cents

**Status:** Accepted
**Date:** 2026-07-22

## Context

Representing money as floating point causes rounding errors (`0.1 + 0.2 !== 0.3`). Prisma's `Decimal` is precise but serializes to a string in JSON, requiring conversion at every boundary.

## Decision

All monetary values are stored and transported as integers representing cents. Formatting for display happens only in the presentation layer, through `lib/money.ts`.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| `Float` / `Double` | Rounding errors are unacceptable |
| Prisma `Decimal` | Serializes as a string; requires conversion and care in every arithmetic operation |
| A library such as dinero.js | Unnecessary complexity for a single currency |

## Consequences

### Positive
- Exact arithmetic throughout the system
- Trivial JSON serialization
- SQL aggregations with no precision risk

### Negative
- Every value must be converted on the way into and out of the interface
- Division requires explicit remainder handling (see M7-T04)

### Risks and mitigations
- Forgetting the conversion and rendering "123456" instead of "1.234,56 €" → helpers centralized in `lib/money.ts` with test coverage
- A single currency (euro) is assumed → adding a currency field would require a migration if ever needed
