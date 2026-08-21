# ADR-0020 — Amountless recurrence rules

**Status:** Accepted
**Date:** 2026-08-21

## Context

Prototype 12 (`prototypes/memory/12-recurrences.md`) approved the `autoConfirm` checkbox: a rule may
generate `DRAFT` entries for a variable expense such as an electricity bill. ADR-0014's model still
requires an amount on every `RecurrenceRule` (`recurrence_rule_amount_positive`), mirrored on
`Transaction` (`transaction_amount_positive`). Creating an electricity-bill rule today forces the
user to invent a placeholder amount that is wrong every month.

A fixed rule with no amount should be possible: each month it materializes a `DRAFT` transaction
with no amount, the user fills the amount in when the bill arrives and confirms it. Balances and
reports only ever include `status = CONFIRMED` (ADR-0012), so the empty amount is only ever visible
inside a draft.

## Decision

`RecurrenceRule.amount` becomes nullable. `amount = null` is legal **only** when `autoConfirm =
false` — a rule that auto-confirms must know what it confirms.

`Transaction.amount` becomes nullable too. The positivity CHECK is relaxed to `amount IS NULL OR
amount > 0`, with a second CHECK forbidding `amount IS NULL` outside `status = 'DRAFT'`. A confirmed
transaction always has an amount.

Money stays integer cents; null means *unknown yet*, not zero. `0` is not used as a sentinel — it
would read as a real €0.00 entry in the drafts list.

Installment plans keep requiring an amount: splitting an unknown total is meaningless, so
`CreateInstallmentPlanDto.totalAmount` is untouched and stays a separate, always-required field.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| `0` as a sentinel for "unknown amount" | Reads as a real €0.00 entry everywhere a draft is listed or totalled |
| A separate `AmountlessRecurrenceRule` model | Duplicates every other field ADR-0014 already unified; the amount is the only thing that varies |
| Require a placeholder amount, let the user edit it monthly | The status quo this ADR removes — a wrong number every month until edited |

## Consequences

### Positive
- A variable-amount fixed expense (utility bill) can be modeled without a fabricated number
- `DRAFT` already excludes the row from balances and reports (ADR-0012); no new exclusion path needed

### Negative
- `amount` becomes optional in two more places client code must handle (`RecurrenceRuleDto`,
  `TransactionDto`) — every reader that assumed a number now needs a null branch
- Two additional hand-written CHECK constraints to keep in sync with the schema by hand, same as the
  existing `*_amount_positive` pair

### Risks and mitigations
- A confirm transition leaving `amount` null → `transaction_amount_required_when_confirmed` rejects
  it at the database, and `TransactionsService.update` rejects it at the API before that
- A display site formatting `null` as `€0.00` instead of `—` → `formatCents` is the single formatting
  function (ADR-0005) and gets the null branch there, not at each call site
