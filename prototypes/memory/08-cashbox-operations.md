# 08 — Cashbox operations

Status: **approved**, design-approved, lives in `approved/`.

One dialog with three modes; transfer mode hiding every account selector; a fixed explanatory line per
mode, styled as informational (blue, `--transfer` token — same treatment as any other info callout,
not a warning), since it explains a behaviour rather than flagging a problem. Every account/cashbox
selector shows its balance, both sides of every operation (deposit, withdraw, transfer).

Withdraw mode's second explanatory line ("dinheiro volta para a conta, resgate encerra a poupança") was
removed rather than fixed: withdrawing the full balance doesn't close/end the cashbox, it just leaves it
empty, and the corrected version added no value.

**Insufficient-balance warning**: shown only on submit, never while typing. Withdraw mode has a hidden
amber `callout.warn` under the amount field; clicking "Salvar" checks the amount against the cashbox's
balance and reveals it if the amount exceeds the balance. It never blocks the submit — the server is
the source of truth on whether the balance is really insufficient (it can have changed since the dialog
opened).

Transfer mode's "Caixinha de origem" selector is required — no flow where it's optional or filled in
after the destination.

**ADR-0019 adds one case this dialog must handle**: editing an old deposit/withdrawal/transfer whose
cashbox was since deleted (`cashboxId`/`destinationCashboxId` is `NULL`). The mode's cashbox field
shows the transaction's snapshotted `cashboxLabel`/`destinationCashboxLabel` marked "(deleted
cashbox)" instead of an empty selector; a live cashbox has to be chosen to save the entry again. In
review, the user noted a live cashbox can never appear in a selector once deleted, so this path is
unlikely to actually occur in the current design — the prototype and its "(deleted cashbox)" label stay
as a safety net regardless, kept in case a future flow needs it.

**M5-T10** reordered every mode's fields: origin/destination selectors side by side, then Data,
Descrição, Valor, with the info callout last (right before the footer). The amount hint and the
amber insufficient-balance warning stay attached to Valor. `callout.info` dropped its left-bar
treatment for a thin border on all four sides, with a leading blue info icon — `callout.warn` is
unchanged, it's a different severity. Origin/destination/Descrição fields all got placeholder text
("Escolha uma conta", "Escolha uma caixinha", "Reserva para férias").
