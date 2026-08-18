# 11 — Charts

Status: **approved on both gates** on 2026-08-17, file in `approved/` — unblocks M6-T04 and M6-T05 — show every category, never group into "Outras".

- **Turning a category off in the legend recalculates the donut's centre total**, decided 2026-08-17 against the
  prototype's proposal that the centre keep the month's full total: otherwise the slices do not add up to the number
  inside them.
- **A category turned off stays in the list beside the donut, struck through**, with its amount still visible and its
  percentage replaced by an em dash. Turning it off removes it from the chart, not from the reading.

- **Every category is shown. Nothing is ever grouped into "Outras".** This answers the open
  question, in the opposite direction to what the prototype proposed.
- Consequence to handle when regenerating: the suggested palette has eight colours and categories
  without one fall back to a value derived from their id, so with every category on the donut two
  of them can end up the same colour. The palette needs to cope, or the fallback does.
- Remaining approved as prototyped: donut with the total in the centre rather than a full pie;
  charts on their own third tab of Relatórios; legend clickable to hide a series, with the state
  lasting only for the session; the cashbox line chart kept apart from the expense charts.
