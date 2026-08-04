# 09 — Monthly report

Status: approved — **drawn in v2** — CSV gone, against-the-average column drawn, composition band
added.

- **No CSV export** — system-wide rule, see [global-rules.md](global-rules.md#settled--applies-everywhere).
- **The cashbox block is visible by default**, not collapsed. That was the open question here.
- **New column: is this month above or below the average?** Asked for rather than approved, so no
  prototype has drawn it yet. Now fully specified:
  - _Which average._ **The category's own average over the rolling twelve months ending with the
    month on screen.** Not the calendar year. Same rule as [global-rules.md](global-rules.md).
  - _Which direction is good._ **An expense above its average is red; income above its average is
    green.** Explicitly confirmed, and to be honoured when the screen is built.
  - _Divisor._ **Only the months with movement**, confirmed — not a flat twelve.
  - _Two colour meanings on one row._ This is the only place in the application where green and
    red mean good and bad instead of money in and money out, so a below-average expense shows a
    green marker beside a red figure. **Decided: draw it plainly and see how it reads** — no arrow,
    no muted treatment, nothing added to keep the two apart. Provisional; if the row turns out to
    contradict itself in practice, that is when to separate them.
- Remaining approved as prototyped: the proportion bar inside the percentage cell; expenses and
  income in separate tables; percentages over the month's expense total, rounded to close at 100%;
  a category with no movement omitted rather than shown as zero.

## Plan impact

**M6-T03 — applied.** CSV export is gone from its implementation notes, its acceptance criteria
and its tests, and the notes now state the rule is system-wide. Safe to edit directly because M6
has not been mirrored to GitHub yet (`plans/MEMORY.md` shows only M1 and M2 created), so no Issue
fell out of sync.

**M6-T01 — applied.** It now returns a rolling monthly average per category, with acceptance
criteria for the divisor, for a window that crosses the year boundary, and for a category with a
single month of movement.
