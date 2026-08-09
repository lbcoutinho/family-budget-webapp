# 10 — Yearly report (`/reports?view=yearly`)

**Ticket:** M6-T02, M6-T03

| Action | Result |
| --- | --- |
| Pick year | Reloads the matrix |
| Compare with the previous year | Adds the prior value and variation |
| Expand a category | Reveals subcategory rows |
| Click a cell | Opens that month filtered by that category |

Category rows, twelve month columns, and totals plus a **"Média 12 meses"** column on the right.
That heading is deliberate: the average is the rolling one of
[global-rules.md §2.6](global-rules.md#26-monthly-averages), so for the current year it draws on
months the matrix does not show, and a column merely headed "Média" would invite the reader to
check it against the twelve cells beside it and find it wrong. A tooltip spells out the window and
the divisor.
Values are rounded to whole euros so the matrix fits; cents remain in the monthly view. Future
months show "—", not zero. On mobile the table scrolls horizontally with the category column
frozen. The prior-year comparison renders inside the cell — percentage beside the current year's
value — so a category never occupies two rows.
