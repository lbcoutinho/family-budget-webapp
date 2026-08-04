# 00 — Design system

Status: **approved**, moved to `approved/`. Colour, type, spacing, radius, shadow and motion are
locked; no later screen may contradict it. Cross-cutting rules that apply regardless of this file
live in [global-rules.md](global-rules.md).

## First review of v2 — settled 2026-08-01

The user reviewed `00-design-system.html` section by section. What that produced:

- **Ten category colours, not sixteen — approved as drawn** in the second pass. Eleven or twelve
  categories is the real ceiling, and six of the sixteen were near-duplicates (two blues, two
  oranges, two teals, two magentas, two purples, two olives). **Repetition past ten is accepted** —
  the eleventh category reuses a colour and the value label keeps the chart readable. The ten that
  stayed were re-tuned rather than merely cut: every one is now ≥ 4.8:1 on the page (usable as
  text, not only as a dot) and no pair is closer than ΔE2000 12.9 in normal vision. Final values
  live in `_shared/proto.css`.
- **There is still no brand colour, but the action gets one.** The black primary button did not
  read as a call to action — that was the user's complaint, in those words. **The action borrows
  the income green** (`--action: var(--income)`), on the primary button, the focus ring and the
  active nav item. Tabs, links, table headers and everything else stay ink. No new hue entered the
  application.
  - The risk was raised and the user chose the green anyway: on the month screen the same green
    marks "entrada" in text and "act here" as a surface. **The rule that keeps them apart is
    grammatical — action is a filled surface, money is text.** Provisional: if it fails on the
    month screen, this is what changes.
  - **The green is approved after seeing it.** Idea parked for later, explicitly out of scope now:
    letting the user pick that accent — green, blue, black or purple.
  - **The launch dialog opens with EXPENSE pre-selected**, settled against the alternative of no
    pre-selection: nearly every entry is an expense, so pre-selecting saves one interaction almost
    every time. The green button means action, not type; the grammatical rule above carries that.
- **The four money colours are approved as they stand.** Green income, red expense, blue transfer,
  amber cashbox, amber already darkened (see below). No longer an open question.
- **Titles, body text and the type scale are approved.** Familjen Grotesk + Public Sans stay.
- **DM Mono is out. Numbers are Public Sans with `font-variant-numeric: tabular-nums`** — two
  families in the application, not three. Two complaints started it (the slashed zero, and the
  date/amount columns clashing with the category column beside them), and the question that settled
  it was whether any guideline requires numbers to have their own family.
  - **It does not.** The real requirement is **tabular figures** — fixed-width digits so a column
    aligns and the decimal comma always lands in the same place — which is a property of the
    numeral, not a change of typeface. Material 3 and IBM Carbon ask for tabular figures in data
    tables without a separate family (Carbon reserves Plex Mono for code); Apple's HIG points at
    SF's own monospaced digits. **Monospace is a strong convention for code, not for money.**
  - Verified against the upstream font binaries rather than assumed: **Public Sans and Familjen
    Grotesk both ship `tnum`**; the monospaced faces do not need it.
  - Consequence: the DM Mono webfont is gone from every page. `code` and the prototype's own ticket
    label fall back to the system monospace stack — no webfont for either.
- **Components approved** except the buttons, now green. Animations approved as they are; a pass
  for new animation opportunities was explicitly deferred (`find-animation-opportunities` skill).

## What v2 decided on its own, and needs confirming

- **The cashbox amber darkened** from `#a0700f` to `#8a6008`, because the original sat at 4.4:1 on
  white, under the 4.5:1 floor. It is now 5.6:1. The other three money colours already passed.
  **Approved in the first review.**

## Settled

Partly settled. The colour discussion is deliberately postponed, so nothing here unblocks the
design gate.

- **The semantic colours are settled, tone included**: green for income, red for expense, blue for
  transfer, amber for cashbox — independent of any brand colour, so switching theme never changes
  what a table means.
- **The category palette offers ten swatches**, cut from sixteen in the first v2 review. Grey
  (`--c10`) is permanently "Outros".
- **No dark mode**, so each swatch is one value rather than a light/dark pair.

Two things that survive the cut to ten:

- Categories with no colour fall back to a value derived from their id, and the charts draw every
  category without grouping into "Outras" — so two can land on the same colour. With ten swatches
  and eleven or twelve categories that is now **expected and accepted**, not a defect.
- Ten hues are still not all tellable apart in a donut, and fewer for a colour-blind reader —
  orange/olive and blue/purple remain close under deuteranopia. **Resolved, unchanged: the value
  does the identifying.** A slice carries its own amount as a label; colour groups things, the
  number names them. Nothing in the application requires matching a swatch to a legend.

## Open

**Nothing on `00-design-system.html` is open any more.** Colour and type are both closed:

1. **Colour — closed.** No brand colour; ten category swatches; the money four approved; one action
   accent borrowed from the income green. Sections 1–3 of `00-design-system.html`.
2. **Type — closed.** Familjen Grotesk (display) + Public Sans (body and every number, with
   tabular figures), scale approved. Two families, three roles.
