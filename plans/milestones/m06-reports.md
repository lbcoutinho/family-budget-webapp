# M6 — Reports

**Goal:** an overview of spending by category, monthly and yearly, in both table and chart form.

**Definition of done:** the user can answer "where did my money go this year" without opening the spreadsheet.

**Depends on:** M5 complete.

---

## M6-T01 — Monthly summary API by category

### Why this is needed
The aggregation behind both the table and the charts. Computing it on the frontend would require downloading every transaction in the period.

### Implementation notes
- `GET /reports/monthly?year=&month=`
- Grouped by root category, with a breakdown by subcategory
- Returns income, expense and balance totals, plus a category list with amount, percentage and color
- **Only `type` in (`INCOME`, `EXPENSE`) and `status = CONFIRMED`** — deposits, withdrawals and transfers are excluded by construction
- Grouped by `referenceMonth`, never by `date`
- Aggregation performed in SQL
- Categories with no activity in the period are omitted
- A separate informational block with the month's cashbox activity (deposits, withdrawals, balance)

### Acceptance criteria
- [ ] Totals match the sum of the month's entries
- [ ] Cashbox deposits are excluded from expenses
- [ ] Account transfers are excluded from every total
- [ ] A credit card entry appears in its reference month, not the month of its date
- [ ] `DRAFT` entries are not counted
- [ ] Percentages sum to 100% (rounding handled)
- [ ] A month with no activity returns a valid empty structure

### Tests
- Unit: percentage calculation and rounding
- Integration: a scenario covering all six types asserting the exclusions; the credit card case spanning months; `DRAFT` exclusion

---

## M6-T02 — Yearly summary API by category

### Why this is needed
Shows trends across the year, which the monthly table cannot.

### Implementation notes
- `GET /reports/yearly?year=`
- A category-by-month matrix, with row and column totals
- Same exclusions as M6-T01
- Monthly average per category included in the response
- A single query aggregating by month, not a loop of twelve calls
- Optional prior-year comparison via `?compare=true`

### Acceptance criteria
- [ ] The matrix has twelve columns, including months with no activity
- [ ] Row and column totals are consistent with the monthly summary
- [ ] The monthly average is computed over months with activity
- [ ] A single query, no N+1
- [ ] `?compare=true` includes the prior year's data

### Tests
- Integration: consistency between the yearly summary and the sum of twelve monthly summaries; a year with no data; the comparison mode

---

## M6-T03 — Overview table screen

### Why this is needed
The reading format the user already knows from the spreadsheet. It has to come before the charts.

### Implementation notes
- `/reports` route toggling between monthly and yearly
- Monthly view: categories as rows, showing amount and percentage
- Category rows expand to reveal subcategories
- Yearly view: a category-by-month matrix with totals on the edges
- Clicking a cell navigates to the monthly tab filtered by that category
- CSV export
- Horizontal scrolling with a frozen first column in the yearly view on mobile

### Acceptance criteria
- [ ] Toggling between monthly and yearly works
- [ ] Expanding a category shows its subcategories
- [ ] Clicking a cell navigates to the monthly tab with the filter applied
- [ ] The exported CSV opens correctly with the right separator and encoding
- [ ] The category column stays frozen during horizontal scroll
- [ ] Percentages and totals match the API

### Tests
- Integration with MSW: rendering both views; expansion; filtered navigation; CSV contents

---

## M6-T04 — Charts with Recharts

### Why this is needed
Visual reading of distribution and trend, complementing the table.

### Implementation notes
- Pie (or donut) chart of the month's distribution by category
- Stacked bar chart of monthly evolution across the year, split by category
- Line chart comparing income against expenses across the year
- **Colors sourced from `Category.color`**, guaranteeing consistency across months and across charts
- Categories without a defined color fall back to a deterministic palette keyed by id
- Tooltip showing a formatted amount and percentage
- Clickable legend toggling series visibility
- Responsive container; on mobile the pie chart becomes a list with bars

### Acceptance criteria
- [ ] The pie chart reflects the selected month's distribution
- [ ] The stacked bar chart shows all twelve months
- [ ] The same category has identical colors across every chart and month
- [ ] Tooltips format amounts in euros
- [ ] The legend toggles series visibility
- [ ] Layout adapts on narrow viewports
- [ ] A period with no data shows an empty state rather than a broken chart

### Tests
- Unit: the category-to-color mapping function (determinism and fallback)
- Integration with MSW: rendering each chart; empty state

---

## M6-T05 — Cashbox evolution panel

### Why this is needed
Cashboxes are excluded from expense reports by construction, so they need a view of their own.

### Implementation notes
- A section on `/reports`, or a tab on the cashboxes screen
- Line chart of each cashbox's balance across the year
- Table of deposits, withdrawals and closing balance per cashbox for the period
- Progress against `targetAmount` where defined
- `GET /reports/cashboxes?year=` returning the time series

### Acceptance criteria
- [ ] Monthly balance evolution shown per cashbox
- [ ] Deposits and withdrawals summed correctly for the period
- [ ] Cashbox transfers are reflected in both cashboxes involved
- [ ] Progress against the goal is shown where applicable
- [ ] An inactive cashbox with history still appears in the report

### Tests
- Integration: time series including cashbox transfers; an inactive cashbox with history
