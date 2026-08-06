# 08 — Cashbox operations

Status: approved, in full.

All five approved as prototyped: one dialog with three modes; the selected cashbox's balance always
visible; the insufficient-balance warning never blocking submit; transfer mode hiding every account
selector; a fixed explanatory line per mode.

**ADR-0019 adds one case this dialog must handle**: editing an old deposit/withdrawal/transfer whose
cashbox was since deleted (`cashboxId`/`destinationCashboxId` is `NULL`). The mode's cashbox field
shows the transaction's snapshotted `cashboxLabel`/`destinationCashboxLabel` marked "(deleted
cashbox)" instead of an empty selector; a live cashbox has to be chosen to save the entry again.
