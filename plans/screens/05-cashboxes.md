# 05 — Cashboxes (`/cashboxes`)

**Ticket:** M3-T09, M5-T06

| Action | Result |
| --- | --- |
| Create / edit | Name, description, optional target |
| Deposit / withdraw from a card | Opens the operations dialog (08) with the cashbox pre-filled |
| Deposit / withdraw from the top bar | Same dialog, cashbox chosen inside it |
| Deactivate, delete | Deactivate is the default, reversible action; delete is permanent, allowed only at zero balance, 409 otherwise (ADR-0019) |
| Toggle "show inactive" | Adds the dimmed cards |

Cards rather than a table: there are few of them and the target progress bar needs the room. The
balance is always computed, never stored. Reaching the target turns the bar green and blocks
nothing.

Deposit and withdraw are reachable both from each card and from the top bar — from the card the
cashbox is already chosen, from the top bar it is picked in the dialog.

Inactive cashboxes follow the same rule as every other registry (§2.5 in
[global-rules.md](global-rules.md)): hidden by default, shown dimmed behind the "show inactive"
toggle, never gone. They keep showing their balance, because the history behind it is real. What
they must not keep is a working deposit or withdraw button — an inactive entity cannot be used in a
new entry, so on those cards the actions are disabled rather than merely ineffective.
