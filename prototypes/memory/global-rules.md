# Global rules and standing instructions

Cross-cutting decisions that apply to every prototype, not to one screen. Read this before
regenerating any screen — a per-screen file (see `prototypes/MEMORY.md` index) never overrides
what's here.

## Standing instruction

**v1 is discarded in full** (`discarded/v1-default/`) — rejected for looking templated, having been
drawn without any design skill in play.

**Direction D — Cromático won.** The four candidates are archived whole in
`archives/v2-directions/`, index included, so the comparison still renders. They are archived
rather than discarded: three of them lost a comparison they existed to lose, which is not the same
as being rejected.

The two comparison pages that closed screen 06 — `06-month-chart.html` (the strip, simple ×
stacked) and `06-month-list.html` (the list, four variants) — are in
`archives/v2-month-comparisons/`. They are self-contained (no `_shared/`, no index of their own),
so they are archived as they are, without a copy of anything beside them.

**Screens are drawn one at a time from here on**, in the order the project needs them, and approved
one at a time — the user asked for this explicitly. **Never draw the undrawn screens in a batch,
and never draw the next one unasked.**

**Broken a second time, on 2026-08-17, by explicit request: 10 and 11 were drawn together**, because the user
asked for every prototype M6 needs in one go. Approval stays one at a time, as before.

**Broken once, on 2026-08-02, by explicit request: 02, 03, 04 and 05 were drawn as a block**, because
the whole of M3 depends on them. The rule stands for everything after — the exception was asked for,
not assumed. **Approval stayed one at a time:** each of the four carries its own "Decisões a aprovar"
block and moves to `approved/` on its own.

Discarding v1 discarded the files, not the decisions. Everything under "Settled" below still holds
and v2 respects it — that is the whole reason this file exists separately from the mock-ups.

Current per-screen status (what's in `approved/`, what's still under review) lives in the table in
`prototypes/MEMORY.md` — check there, not here, for "is screen N approved yet."

## Settled for v2 and everything after

- **No dark mode.** Not "later" — not needed at all. Every direction commits to one appearance,
  and the token files stop carrying a second set of values. This is what makes the light palette
  worth tuning properly: it is the only one.
- **Responsive, both ends first class.** The app is used on desktop _and_ on the phone. A wide
  table is not a desktop feature with a mobile fallback; both layouts are the design.
- **When colour cannot identify, the value identifies.** The answer to the sixteen-colour problem:
  charts label the slice with its amount instead of asking the reader to match a colour against a
  legend. Colour groups, the number names.
- **v2 opened with three screens: 00 design system, 06 month, 09 monthly report.** Enough to judge
  a direction — the token set, the densest screen, and the one with a chart and the new average
  column. With the design system approved, the rest are drawn **on demand, one at a time**.

## Versions are per design skill

v2 is what the `frontend-design` skill produces. Later versions come from other skills, one
version each, so the comparison is between skills rather than between briefs. Keep them as
separate `vN` sets and do not merge them.

## Rules deliberately broken in v2, and why

v1's own rules were written before there was any design intent. These four break four of them, on
the user's explicit instruction not to treat them as fixed:

- **External requests.** v1 forbade any network call and used system fonts. These load real
  typefaces from Google Fonts — without that there is no typography to judge.
- **Nothing over 320 ms.** Direction A rules its balance rail over 620 ms; direction D grows the
  month strip day by day over roughly 700 ms. In both the duration _is_ the content: it is the
  month being traversed.
- **One easing curve.** Direction B's envelope fills with a spring and settles. Filling a container
  does not decelerate linearly.
- **No animated numbers.** v1 banned counters, correctly: a balance that rolls cannot be checked.
  Direction D counts the expense total when a day is filtered — there it marks that the filter
  changed, and is not a balance anyone is reconciling.

## What "approved" means

**Concept approval and design approval are separate gates.** Every screen passed the first one in
the v1 review. The second is passed **one screen at a time** — see the status table in
`prototypes/MEMORY.md` for which screens have passed which gate.

- **`00-design-system.html` has passed both.** Colour, type, spacing, radius, shadow and motion are
  locked; no later screen may contradict it. Details: [00-design-system.md](00-design-system.md).
- What "concept approved" settles is structure and behaviour: which actions a screen offers, which
  columns exist, what is shown and what is not.

## Settled — applies everywhere

**There is no CSV export anywhere in the application.** Not on the monthly report, not on the
yearly one, not anywhere else. Do not reintroduce it as a convenience while building a screen.

The v2 report prototypes (09, 10, 11) carry no CSV button at all. The
ticket has already been corrected — M6-T03 no longer lists CSV in its implementation notes,
acceptance criteria or tests.

**Every monthly average in the application means the same thing:** the twelve months ending with
the month on screen, divided by only those months that had movement — never by a flat twelve. That
covers the monthly report's new column, the yearly matrix's average column, and anything added
later. Recorded as provisional: it is what to try first.

On the yearly matrix that average is not derivable from the row it sits in — for the current year
the window reaches into the previous one. **Settled by naming it, not by excepting it:** the column
is headed **"Média 12 meses"** and carries a tooltip explaining the window and the divisor. The
definition stays identical everywhere. A column headed just "Média" was the trap: it invites the
reader to add up the twelve cells beside it and conclude the number is wrong.

The tooltip is treated as part of the decision rather than as the "talvez" it was offered as — the
heading alone can say twelve months, but not that only months with movement count, and that is the
half a reader would never guess.

See [09-monthly-report.md](09-monthly-report.md) and [10-yearly-report.md](10-yearly-report.md) for
where this rule is applied.
