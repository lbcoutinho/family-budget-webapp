# 08 — Cashbox operations (dialog)

**Ticket:** M5-T04

| Action | Result |
| --- | --- |
| Deposit | Source account → destination cashbox |
| Withdraw | Source cashbox → destination account |
| Transfer | Cashbox → cashbox, no account field at all |

The selected cashbox's balance is always visible next to the selector. An amount above the balance
raises a client-side warning but never disables the submit — the backend owns the decision and
answers 409 with the available amount, because the balance may have changed since the dialog
opened. Each mode carries a fixed explanatory line: cashbox mechanics are the non-obvious part of
the domain.

Field order (M5-T10, see #172): origin and destination selectors side by side in one row, then Data,
Descrição, Valor, with the info callout last.
