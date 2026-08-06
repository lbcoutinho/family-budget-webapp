# Open questions

Questions raised during a prototype review that belong to no single screen and have not been
decided yet. Each one is here to be discussed in its own session, not guessed at during
implementation.

## Renaming rewrites history — cashboxes, and by extension accounts and categories

Raised 2026-08-06, reviewing `05-cashboxes.html`. **Not decided. Do not implement either way.**

A cashbox is referenced by id, so renaming it rewrites every place its name is shown: the statement,
the monthly report, the yearly report. The name is not stored on the transaction.

The case that exposes it: a "Carro" cashbox is used until the car is bought, goes to zero and is
deactivated — it cannot be deleted, because it has entries. Later a new goal appears. If the old
cashbox is reused by renaming it to "Férias", every deposit and withdrawal made for the car is now
labelled "Férias". The past loses the identity it actually had.

The three questions to settle:

1. **May a cashbox that already has entries be renamed at all?** Renaming has a legitimate use
   (fixing a typo, "Ferias" → "Férias") and an illegitimate one (repurposing the pot, which is a new
   cashbox wearing an old name). Both look the same to the system.
2. **Why can a cashbox not be deleted?** It can — `plans/0001-overview.md` §5.3 blocks the delete
   only when the entity has transactions, and this screen draws that 409. The rule exists so a
   delete never silently removes deposits and withdrawals that months have already reported. An
   empty, never-used cashbox does delete.
3. _(third question was cut off in the review — to be restated by the user.)_

The shapes on the table, none chosen:

- **Leave it.** The name is a label on a live entity, history follows it. Zero work, and the "Carro"
  case is solved socially: create a new cashbox instead of reusing the old one.
- **Block the rename once entries exist**, offering "create a new cashbox" instead. Protects
  history, and makes fixing a typo impossible.
- **Snapshot the name on the transaction** and show the snapshot in past statements and reports.
  Correct, and the most expensive: a column, a migration, a backfill, and two names for one thing
  everywhere something is displayed.
- **Separate the two operations**: rename (a correction, affects everything, allowed) and repurpose
  (closes the current cashbox and opens a new one carrying the balance). Names the user's real
  intent, costs a new operation.

Whatever is decided applies the same way to accounts and categories — a renamed category rewrites
the same reports.
