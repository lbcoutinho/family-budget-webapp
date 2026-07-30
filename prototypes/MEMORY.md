# Prototype decisions

What the user has already decided about the prototypes. A regeneration reads this first and treats
everything under "Settled" as input, not as a question to ask again.

Three `MEMORY.md` files exist and they do not overlap: the one at the repository root is the
implementation handoff, `plans/MEMORY.md` tracks GitHub mirroring, and this one records UI
decisions.

---

## Standing instruction

**A full regeneration of every prototype is planned, but not yet requested.** The user intends to
install additional skills first and will then ask for it. Do not regenerate before being asked.

## What "approved" means below

**Concepts are approved; the visual design is not.** These are two separate gates, and only the
first has been passed. Consequences:

- **No file moves to `prototypes/approved/`.** The blocking rule in `CLAUDE.md` therefore still
  blocks implementation of every screen, M2-T06 included.
- **The colour and type concepts are still unchosen** (see "Open" below), so no screen can be
  visually approved yet — everything inherits from the design system.
- What is settled is structure and behaviour: which actions a screen offers, which columns exist,
  what is shown and what is not.

## Status per screen

| Prototype | Concept | Changes to apply when regenerating |
| --- | --- | --- |
| 00 design system | partly | semantic colours kept; palette grows to 16 swatches; tones and type still open |
| 01 login | approved, in full | — |
| 02 shell | approved | "Configurações" menu holds the three registries; Recorrências stays top-level |
| 03 accounts | approved | drop the initial-balance column; sort by name |
| 04 categories | approved | drop the month-spend column; make subcategory creation visible |
| 05 cashboxes | approved | drop the empty-goal wording and the "new cashbox" card; add a "show inactive" toggle |
| 06 month | approved, in full | — |
| 07 income / expense | approved, in full | — |
| 08 cashbox operations | approved, in full | — |
| 09 monthly report | approved | drop CSV export; add an "against the average" column |
| 10 yearly report | approved | drop CSV; percentage beside the current-year value, one row per category; average column headed "Média 12 meses" with a tooltip |
| 11 charts | approved | show every category, never group into "Outras" |
| 12 recurrences | approved, in full | keep the `autoConfirm` checkbox |
| 13 voice | approved, in full | — |

---

## Settled

### Applies everywhere

**There is no CSV export anywhere in the application.** Not on the monthly report, not on the
yearly one, not anywhere else. Do not reintroduce it as a convenience while building a screen.

The two report prototypes still show the button, because they are waiting to be regenerated. The
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

### 00 — Design system

Partly settled. The colour discussion is deliberately postponed, so nothing here unblocks the
design gate.

- **The semantic colours are kept as they are**: green for income, red for expense, blue for
  transfer, amber for cashbox — independent of the brand colour, so switching theme never changes
  what a table means. What is left about them is the exact tone, to be picked together with the
  brand colour.
- **The category palette offers sixteen swatches, not eight.**

Two consequences of sixteen, both for whoever regenerates this:

- It halves the collision risk flagged on screen 11. Categories with no colour fall back to a value
  derived from their id, and since the charts now draw every category, two of them landing on the
  same colour was a real possibility with eight.
- It does not make sixteen categories legible in a donut. Sixteen categorical hues cannot all be
  told apart, and for a colour-blind reader far fewer can. Sixteen is the ceiling on how many
  categories get a *distinct* colour, not a promise that a sixteen-slice chart reads well — so the
  charts must identify a slice by more than its colour.

`proto.css` currently defines `--cat-1` … `--cat-8` twice, once for light and once for dark. Both
sets double.

### 01 — Login

All four decisions approved as prototyped: narrow centred card with no illustration; generic error
that never reveals whether the email exists; no "remember me"; the demo account signs in through
the same form with no separate button.

### 02 — Shell

**The three registries become sub-items of a "Configurações" menu**, instead of a flat group under
a "Cadastros" label: Contas, Categorias, Caixinhas.

**Recorrências stays at the top level**, alongside Mês, Relatórios and Lançar por voz — it is
visited while running the month, not set up once and forgotten.

Nothing else about the shell was approved — and note that this page never had a "Decisões a
aprovar" block to approve, unlike every other one. Write one when regenerating.

### 03 — Accounts

- **No initial-balance column.** It is a value that is set once and then rarely looked at; it lives
  in the edit dialog, which is where the user goes when they do want it.
- **Current balance stays in the list.** This resolves the either/or that was on the page: current
  balance in the table, initial balance only in the form.
- **Default sort: alphabetical by account name.** Consistent with the already-approved decision not
  to expose manual ordering, even though `sortOrder` exists on the model.
- Remaining approved as prototyped: negative balance in red with no extra icon; deactivation asks
  for confirmation while delete attempts and surfaces the backend 409.

Sequencing consequence, not a new question: the current balance comes from
`GET /accounts/balances`, which arrives in M5-T06. M3-T07 lands before that, so the accounts screen
either ships without that column and gains it later, or waits.

### 04 — Categories

- **No "gasto no mês" / "recebido no mês" column.** This also removes the screen's only dependency
  on report data, so M3-T08 no longer needs anything from M6.
- **Subcategory creation has to be visible.** The user's note is that the prototype does not show
  how subcategories are created. The action does exist — a "+ Subcategoria" button on the parent
  row — but it sits inside `.row-actions`, which is `opacity: 0` until the row is hovered. So it is
  invisible on first look, in a screenshot, and on touch. Surface it properly rather than adding a
  second path.
- Remaining approved as prototyped: the tree as an expandable table rather than a nested list;
  colour belongs to the root category and subcategories inherit it in charts; the automatic
  "Outros" is marked as such and cannot be the last one deactivated.

### 05 — Cashboxes

Liked, and kept: **the summary cards at the top** and **the goal progress bars**.

- **Say nothing when there is no goal.** Drop the "Sem meta definida" line and the "Sem meta —
  nenhuma barra de progresso" note: absence needs no caption, the card simply has no bar.
- **Drop the dashed "+ Nova caixinha" card.** The action already exists in the top bar.

- **Deposit and withdraw stay in both places**: on each card and in the top bar. From the card the
  cashbox comes pre-filled, from the top bar it is chosen inside the dialog.
- **Inactive cashboxes are visible behind a "show inactive" toggle**, dimmed, exactly like
  categories and accounts. They do not vanish from the screen.

Two things follow, and both are work rather than wording:

- **That toggle does not exist on this prototype.** Accounts and categories have one; cashboxes
  never did, because the earlier draft had inactive ones disappearing. It has to be added, and on a
  card grid rather than a table.
- **An inactive card must not offer a working deposit or withdraw button.** The two answers meet
  here: buttons live on every card, and inactive entities cannot be used in new entries
  (`CLAUDE.md`, domain rules). So those cards keep their balance — the history behind it is real —
  but their actions are disabled, not merely inert.

### 06 — Month

All six decisions approved as prototyped. Two are worth restating because they were phrased as
questions or affect other screens:

- **Voice drafts do appear in the month list, dimmed, and do not count in the totals** — this was
  the open question on the page, and the prototyped behaviour is the answer.
- **No dashboard**: the balance panel lives at the top of this screen, `/` redirects here.

Also approved: three footer lines rather than a strip of cards; explicit `+`/`−` alongside colour;
credit-card icon with the original purchase date as a sub-line; infinite scroll rather than
numbered pages.

### 07 — Income / expense / transfer

All five approved as prototyped: type as a segmented control at the top of the dialog; cashbox
operations kept out of this form; reference month revealed only by the credit-card checkbox and
suggesting the following month; date and amount before classification; optimistic insert with
rollback.

### 08 — Cashbox operations

All five approved as prototyped: one dialog with three modes; the selected cashbox's balance always
visible; the insufficient-balance warning never blocking submit; transfer mode hiding every account
selector; a fixed explanatory line per mode.

### 09 — Monthly report

- **No CSV export** — see the system-wide rule below; it started here.
- **The cashbox block is visible by default**, not collapsed. That was the open question here.
- **New column: is this month above or below the average?** Asked for rather than approved, so no
  prototype has drawn it yet. Now fully specified:
  - _Which average._ **The category's own average over the rolling twelve months ending with the
    month on screen.** Not the calendar year.
  - _Which direction is good._ **An expense above its average is red; income above its average is
    green.** Explicitly confirmed, and to be honoured when the screen is built.
  - _Divisor._ **Only the months with movement**, confirmed — not a flat twelve. Now a project-wide
    rule rather than a detail of this screen; see "Applies everywhere".
  - _Two colour meanings on one row._ This is the only place in the application where green and
    red mean good and bad instead of money in and money out, so a below-average expense shows a
    green marker beside a red figure. **Decided: draw it plainly and see how it reads** — no arrow,
    no muted treatment, nothing added to keep the two apart. Provisional; if the row turns out to
    contradict itself in practice, that is when to separate them.
- Remaining approved as prototyped: the proportion bar inside the percentage cell; expenses and
  income in separate tables; percentages over the month's expense total, rounded to close at 100%;
  a category with no movement omitted rather than shown as zero.

### 10 — Yearly report

- **Comparison with the previous year: the percentage sits beside the current year's value, and
  both years stay on the same row.** This answers the open question — the comparison lives inside
  the cell, and a category never occupies two rows.
- **No CSV export here either** — the rule is system-wide, see "Applies everywhere".
- Remaining approved as prototyped: whole euros in the matrix with cents kept for the monthly view;
  future months as "—" and still present as columns; total and average on the right with a
  highlighted background; horizontal scroll with a frozen category column on mobile.

### 11 — Charts

- **Every category is shown. Nothing is ever grouped into "Outras".** This answers the open
  question, in the opposite direction to what the prototype proposed.
- Consequence to handle when regenerating: the suggested palette has eight colours and categories
  without one fall back to a value derived from their id, so with every category on the donut two
  of them can end up the same colour. The palette needs to cope, or the fallback does.
- Remaining approved as prototyped: donut with the total in the centre rather than a full pie;
  charts on their own third tab of Relatórios; legend clickable to hide a series, with the state
  lasting only for the session; the cashbox line chart kept apart from the expense charts.

### 12 — Recurrences

All five approved, including the one that was still a question: **the `autoConfirm` checkbox
stays** — generated entries are not always confirmed, the rule decides.

Also approved: fixed rules and installment plans in one table told apart by the progress column;
two separate creation buttons rather than one form with a type switch; a mandatory preview before
saving; cancelling an installment plan removing only future unconfirmed installments.

### 13 — Voice entry

All six approved, including the one flagged for confirmation: **drafts do appear on the month
screen, dimmed**. That now agrees with what was already settled on prototype 06, so the two screens
no longer contradict each other.

Also approved: recording and review stacked on one route; inline editing in the table row rather
than a dialog per candidate; incomplete rows highlighted amber with approve disabled; a likely
duplicate warned about but never blocked; leaving with pending drafts asking for confirmation while
the drafts persist either way.

---

## Plan impact

Two of the decisions above change tickets that are already written down, and neither has been
applied to `plans/milestones/m06-reports.md` or to the mirrored GitHub Issues yet — deliberately,
because the prototypes have not been regenerated or design-approved, and the details above are
still open. Apply them once that settles.

- **M6-T03 — applied.** CSV export is gone from its implementation notes, its acceptance criteria
  and its tests, and the notes now state the rule is system-wide. Safe to edit directly because M6
  has not been mirrored to GitHub yet (`plans/MEMORY.md` shows only M1 and M2 created), so no Issue
  fell out of sync.
- **M6-T01 — applied.** It now returns a rolling monthly average per category, with acceptance
  criteria for the divisor, for a window that crosses the year boundary, and for a category with a
  single month of movement.
- **M6-T02 — applied.** Its average now uses the same project-wide definition, with a criterion
  pinning the case where they must agree: a complete past year averages to the same number either
  way.

## Open

Every screen has now been reviewed. What is left:

1. **Colour: the tones.** Postponed by the user, to be discussed as its own thing. The semantic
   roles are already settled (above); what is open is the brand colour — sage, indigo or slate, or
   something else — plus the exact tones of the semantic four and the sixteen category swatches.
   Blocks visual approval of everything.
2. **Type concept** — grotesk, humanist or mixed. Same.

Nothing else. Every screen-level question has been answered; what remains is the design system, and
it gates all thirteen screens.
