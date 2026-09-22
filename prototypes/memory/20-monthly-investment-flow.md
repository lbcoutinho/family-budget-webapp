# 20 — Monthly investment flow

Status: **design review** in `20-monthly-investment-flow.html`. Issue #396.

The proposed prototype uses an annual table with one row per month and columns for Investment
Purchase Amount, net sales, Net Investment Flow, Trade Fees, and realized result. Selecting a
month exposes its contributing operations directly below the table.

Investment Funding Transfers appear in the operation drill-down as context, marked “Fora do
fluxo”, with zero contribution to purchases, sales, fees, and Net Investment Flow. Loading, empty,
error, current-year, positive-result, and negative-result states are selectable. On narrow screens
the table scrolls horizontally with the month column frozen; operation rows reflow below it.

Decisions awaiting approval:

1. Keep the annual comparison as one table rather than monthly cards.
2. Open the selected month's operations inline below the table.
3. Show funding Transfers in the drill-down, explicitly excluded from flow totals.
4. Define Net Investment Flow as purchases minus net sales, with Trade Fees separate.
