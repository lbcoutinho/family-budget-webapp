# 06 — Monthly tab (`/month/:year/:month`) — the main screen

**Ticket:** M5-T01, T05, T06

| Action | Result |
| --- | --- |
| Previous / next month, "hoje", month picker | Updates the URL; a shared URL opens the same month |
| Search description, filter by type / category / account | Narrows the table |
| Sort | Client-side within the loaded page, chosen in a select above the list |
| New entry | Opens 07; the cashbox button opens 08 |
| Edit row | Opens the form matching the entry type, pre-filled |
| Delete row | Confirmation identifying the entry, then a toast with undo |
| Scroll | Cursor pagination via `useInfiniteQuery` |

Balances sit at the top (one card per account, one aggregate for cashboxes, one consolidated
total), because the point of the screen is trusting the numbers. Footer totals follow the domain
rule: **only `EXPENSE` counts as expense** — transfers and cashbox deposits are excluded, and the
footer says so. Credit card rows carry an icon plus the original purchase date in a sub-line, since
the primary date shows settlement. Each eligible row shows its bare account balance after the
transaction below the amount; drafts and cashbox transfers omit it, while assistive text identifies
future settlements as projected. Voice `DRAFT` entries appear here dimmed and excluded
from the totals, as prototyped.

Entries are rows rather than table cells — date, description with its classification underneath,
amount — with the category's colour as a bar down the left edge. One layout serves the phone and
the desktop, and no wide table has to scroll sideways. The cost is that there is no column header
to click, so **sorting moved into a select** above the list. Row actions stay visible at reduced
opacity rather than appearing on hover, which is the same correction the categories screen needed.

Above the list sits the screen's signature: **a strip with one segment per day**, its height the
day's expense and its colour the category that weighed most. Clicking a day filters the list and
recomputes the footer. That recomputed total may animate; the balance panel never does.
