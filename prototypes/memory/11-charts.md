# 11 — Charts

Status: approved — show every category, never group into "Outras".

- **Every category is shown. Nothing is ever grouped into "Outras".** This answers the open
  question, in the opposite direction to what the prototype proposed.
- Consequence to handle when regenerating: the suggested palette has eight colours and categories
  without one fall back to a value derived from their id, so with every category on the donut two
  of them can end up the same colour. The palette needs to cope, or the fallback does.
- Remaining approved as prototyped: donut with the total in the centre rather than a full pie;
  charts on their own third tab of Relatórios; legend clickable to hide a series, with the state
  lasting only for the session; the cashbox line chart kept apart from the expense charts.
