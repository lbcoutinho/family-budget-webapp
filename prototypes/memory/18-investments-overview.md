# 18 — Investments overview

Status: **approved** in `approved/18-investments-overview.html`. Issue #394.

The approved prototype uses a hierarchical table:

- Each Instrument starts with one consolidated parent row.
- Custody Accounts appear as indented child rows without repeating the Instrument name.
- Market Quote belongs to the Instrument parent and applies to every Account position.

The screen includes Instrument type, Financial Institution, and Account filters inside one filter
menu, with the clear action in that menu. It shows native quantity,
remaining cost, weighted-average price, Market Quote, current EUR value, realized result, and
unrealized result. Positive and negative values use the same green/red treatment as the Month
screen. The populated data represents positive, negative, zero-position, current,
stale, manual, and missing-quote cases. Loading, empty, and error states are selectable.

Approved decisions: variant A, visible zero positions, colored quote health with text, and a
frozen-Instrument horizontally scrolling table on narrow screens.
