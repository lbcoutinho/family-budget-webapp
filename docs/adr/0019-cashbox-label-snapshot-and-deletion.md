# ADR-0019 — Cashbox label snapshot and deletion of empty cashboxes

**Status:** Accepted
**Date:** 2026-08-06

## Context

A cashbox is a pot with a purpose and a lifetime: "Carro" is fed until the car is bought, goes to
zero, and is finished. Accounts and categories are permanent by comparison — a cashbox is expected
to end.

ADR-0015 gives all three the same rule: deactivate, and delete only when no transaction references
the entity. Reviewing `prototypes/05-cashboxes.html` exposed two problems with applying that rule to
cashboxes, recorded in `prototypes/memory/open-questions.md`:

1. **Renaming rewrites history.** The name lives only on the `Cashbox` row and every display resolves
   it by id, so renaming "Carro" to "Férias" relabels every deposit and withdrawal made for the car.
   The statement and both reports now describe a past that did not happen.
2. **A finished cashbox cannot be removed.** It has entries, so it can only be deactivated. It stays
   in the "show inactive" list forever, and its name stays taken — which invites exactly the reuse-by-
   rename that problem 1 punishes.

Dropping the `cashboxId` relation entirely and describing the movement in free text was considered
and rejected on inspection: the cashbox balance is derived from the relation
(`plans/0001-overview.md` §5.4 — `CASHBOX_IN − CASHBOX_OUT ± CASHBOX_TRANSFER`), as is the
"`CASHBOX_OUT` must not drive a cashbox balance negative" invariant. Without the foreign key both
become text matching.

## Decision

The relation stays. Two changes make a cashbox's life end cleanly.

**1. The transaction snapshots the cashbox name.** Alongside `cashboxId` and `destinationCashboxId`,
a transaction stores `cashboxLabel` and `destinationCashboxLabel` — the cashbox's name at the moment
the entry was written. Statements and reports display the snapshot; balances and every aggregate
keep using the id. Renaming a cashbox stays allowed and no longer touches the past.

**2. A cashbox with a zero balance may be deleted, even with entries.** On delete the cashbox row is
removed and `cashboxId` / `destinationCashboxId` are set to `NULL` on its transactions
(`onDelete: SetNull`); the labels remain, so the history stays readable. A cashbox with a non-zero
balance still returns 409 — deleting it would make its money reappear as available in the account
with no entry explaining the movement. The user empties it with a `CASHBOX_OUT` first.

This narrows ADR-0015 for `Cashbox` only. `Account` and `Category` keep ADR-0015 unchanged: they are
permanent by nature, they have no balance-is-zero condition that makes removal safe, and no rename
problem has been raised for them in practice.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Drop the `cashboxId` relation, describe the movement in free text | The cashbox balance and the no-negative-balance invariant are derived from the relation; both would degrade to text matching |
| Leave it: rename is a label change, history follows | Leaves the review's actual complaint — a past statement describing a purpose that was never there |
| Block renaming once entries exist | Makes fixing a typo impossible, and pushes the user to abandon the pot rather than correct it |
| Delete regardless of balance | The pot's money would silently return to the account's available balance with no transaction recording it |
| Separate "rename" from "repurpose" (close and reopen carrying the balance) | Names the real intent, but adds an operation and a UI concept to solve what a snapshot column solves passively |
| Deactivate only, hidden behind a "show inactive" toggle | The list grows forever and the name stays taken, which is what invites reuse-by-rename |

## Consequences

### Positive
- A finished cashbox disappears from the app while its history stays readable
- Renaming is free again — a typo is fixed without falsifying past entries
- A cashbox name is reusable once the old pot is gone
- Cashbox aggregates keep the foreign key, so no formula changes

### Negative
- Two columns per cashbox reference on `Transaction`, kept in sync on create and on edit
- Displays resolve a name from two places: the snapshot for history, the entity for live cashboxes
- Deleting is irreversible, unlike deactivating

### Risks and mitigations
- A stale label after a rename, since old entries keep the old name by design → this is the intent, not a bug; the cashbox filter and every total keep using `cashboxId`, so only the displayed text differs
- A user deleting a cashbox meaning to hide it → the delete confirmation states that the cashbox is removed permanently and past entries keep the name as text; deactivation remains the reversible option and stays the default action on the card
- `cashboxId` becoming `NULL` breaking a filter or a report that assumes it is set → `CASHBOX_*` transactions must treat a null cashbox as "deleted cashbox", never as "no cashbox"; covered by tests on the statement and both reports
- The zero-balance check racing a concurrent entry → the balance is recomputed inside the delete transaction, not read beforehand
- Existing rows having no label after the migration → the migration backfills both columns from the referenced cashbox before the columns are used for display
