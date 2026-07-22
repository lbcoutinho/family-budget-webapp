# ADR-0008 — Cashbox as a pot, without funding traceability

**Status:** Accepted
**Date:** 2026-07-22

## Context

The initial model included a `fundedByTransactionId` field linking an expense to the cashbox withdrawal that funded it, so the system could answer "how much of the Travel cashbox has been spent".

This does not match reality. A €500 withdrawal lands in a checking account that already held €1,000 and may fund six independent purchases of €100, €200, €30, €20, €100 and €50. Money is fungible: there is no way to know which euro paid for what.

## Decision

There is no link between a withdrawal and an expense. A cashbox is a pot with its own balance, and an expense is simply an expense.

The `fundedByTransactionId` field and the `CashboxFunding` relation were removed from the model.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| `fundedByTransactionId` on the expense | An artificial link the user would have to assert with no factual basis |
| Automatic proportional allocation | An arbitrary heuristic producing meaningless numbers |
| A dedicated bank account per cashbox | Does not match how the user actually operates |

## Consequences

### Positive
- A simpler model, honest about what is knowable
- Fewer fields, less validation, less surface for bugs
- The expense form need not ask where the money came from

### Negative
- Impossible to answer "how much of the Travel cashbox was actually spent"
- A cashbox balance shows only what remains, not what was consumed

### Risks and mitigations
- A future need to trace consumption per cashbox → would be served by an optional annotation field on the expense, without changing balance semantics
