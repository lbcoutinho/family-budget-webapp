# 21 — Investment import and reconciliation

Status: **under review** in `../21-investment-import-reconciliation.html`. Issue #397.

The prototype compares three structures for the same normalized CSV workflow:

- A — guided steps: upload, validate, reconcile, review adjustments, and confirm.
- B — split workspace: file and validation on the left, simulation and reconciliation on the right.
- C — batch ledger: import and rollback are presented as two auditable batch operations.

All variants keep preview and impact inspection read-only until an explicit confirmation. Position
Adjustments and Balance Adjustments are reviewed separately from CSV corrections and always require
a reason. Desktop and narrow-screen layouts are selectable from the prototype controls.

Approved decisions:

1. Variant A — guided steps — guides implementation.
2. Duplicate detection is row-level. A repeated external ID blocks the row; equivalent content with
   a new external ID remains a warning because some repeated lines are possible. Whole-file duplicate
   handling is not a separate workflow.
3. The rollback impact preview provides enough context before destructive confirmation.
4. The normalized-file input appears only in the File step, never beside the Validation step. The
   prototype is intentionally unchanged; implementation must apply this correction.

Open decision:

1. During reconciliation, should the screen ask for real custody values for every calculated
   Instrument Balance and Investment Position, or let the user select which ones to verify first?
