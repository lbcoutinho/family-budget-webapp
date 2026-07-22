# ADR-0009 — Dual dates and the credit card flag

**Status:** Accepted
**Date:** 2026-07-22

## Context

The user works on a cash basis: a card purchase made on March 5 is recorded in the April tab, when the statement is paid, but retains its original March date.

With a single date field, the April tab (`WHERE date BETWEEN April 1 AND April 30`) would not find that entry. When a purchase happened and which month it counts toward are different quantities.

A second problem emerged: if `referenceMonth` were always recomputed when `date` changed, correcting a card purchase from March 5 to March 6 would make the expense vanish from the April tab without warning.

## Decision

Two date columns and one flag:

- `date` — when the purchase happened
- `referenceMonth` — which month it counts toward in reports, always normalized to the first of the month
- `isCreditCard` — determines recomputation behaviour

Rule when `date` changes during an update:
- `isCreditCard = false` → recompute `referenceMonth`
- `isCreditCard = true` → preserve the chosen `referenceMonth`

All reports and the monthly tab group by `referenceMonth`.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| A single date | Card entries would disappear from the correct tab |
| Noting the card in free-text `notes` | Allows neither filtering nor logic; the checkbox state would be lost on edit |
| A heuristic comparing `date` and `referenceMonth` | Fragile: a March 5 purchase legitimately recorded in March would be indistinguishable |
| Modelling the card statement as an entity | Accrual basis, which does not match how the user works |

## Consequences

### Positive
- Card purchases land in the right month without losing their original date
- "How much did I spend on the card this month" becomes answerable
- The interface checkbox has persisted state
- Moving to accrual basis later would only require reprocessing `referenceMonth`

### Negative
- Two dates demand discipline: every report query must use `referenceMonth`
- The interface must expose the concept to the user

### Risks and mitigations
- A query accidentally using `date` → a CHECK constraint guarantees `referenceMonth` falls on the first; integration tests cover the card case spanning months
