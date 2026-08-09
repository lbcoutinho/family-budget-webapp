# 09 — Monthly report (`/reports`)

**Ticket:** M6-T03

| Action | Result |
| --- | --- |
| Switch monthly / yearly / charts | Segmented control at the top |
| Navigate months | Same control as the monthly tab |
| Expand a category | Shows its subcategories |
| Click a row | Opens the monthly tab filtered by that category |

Expenses and income are separate tables, so the percentage column has one unambiguous base.
Cashbox movement appears in its own informational block, shown expanded, because it is excluded
from the percentages by construction. Categories with no activity in the period are omitted. There
is no CSV export.

A column compares the month against the category's rolling monthly average, defined in
[global-rules.md §2.6](global-rules.md#26-monthly-averages). Its colour reads as good or bad rather
than as in or out: an expense above its average is red, income above its average is green. That is
the one place in the application where green and red do not mean money in and money out, and it
sits beside an amount already coloured by the other rule — a below-average expense shows a green
marker next to a red figure, on the same row.

Decided: **draw it plainly and see how it reads**, without an extra device to separate the two
meanings. Provisional, like the monthly-average definition itself.
