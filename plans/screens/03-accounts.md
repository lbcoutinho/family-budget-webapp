# 03 — Accounts (`/accounts`)

**Ticket:** M3-T07, M5-T06

| Action | Result |
| --- | --- |
| Create / edit | Dialog; currency input submitted as cents |
| Deactivate / reactivate | Confirmation; account disappears from new entries |
| Delete | Real delete, or a 409 with a clear message when entries exist |
| Toggle "show inactive" | Adds dimmed rows |

The list shows the current balance and not the initial one, which moved into the edit dialog.
The current balance needs `GET /accounts/balances`, which arrives with M5-T06, so M3-T07 either
ships without the column or waits. Rows are sorted alphabetically by name.
