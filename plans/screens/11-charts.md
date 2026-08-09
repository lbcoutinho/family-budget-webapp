# 11 — Charts (`/reports?view=charts`)

**Ticket:** M6-T04, M6-T05

| Action | Result |
| --- | --- |
| Toggle a legend entry | Hides / shows the series |
| Hover a slice or bar | Tooltip with formatted amount and percentage |
| Click a slice or bar | Opens the corresponding filtered month |

Donut for the month's distribution (total in the centre), stacked bars for the year by category,
lines for income against expenses, and a separate line chart plus table for cashboxes — kept apart
precisely because cashboxes are not expenses. Below 640 px the donut becomes a list with bars. A
period with no data shows an empty state, never an empty chart frame. Every category is drawn;
nothing collapses into "Outras".
