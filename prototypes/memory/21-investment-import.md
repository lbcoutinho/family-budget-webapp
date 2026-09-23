# 21 — Investment import and reconciliation

Status: **under review** in `../21-investment-import-reconciliation.html`. Issue #397.

The prototype compares three structures for the same normalized CSV workflow:

- A — guided steps: upload, validate, reconcile, review adjustments, and confirm.
- B — split workspace: file and validation on the left, simulation and reconciliation on the right.
- C — batch ledger: import and rollback are presented as two auditable batch operations.

All variants keep preview and impact inspection read-only until an explicit confirmation. Position
Adjustments and Balance Adjustments are reviewed separately from CSV corrections and always require
a reason. Desktop and narrow-screen layouts are selectable from the prototype controls.

Open decisions:

1. Which structure should guide implementation: A, B, or C?
2. Should reconciliation request every real custody value or only values the user chooses to verify?
3. Should duplicate fingerprints block confirmation or remain warnings when the external ID is new?
4. Does the rollback impact preview provide enough context before the destructive confirmation?
