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
| 00 design system | **not decided** | colour and type still to be chosen |
| 01 login | approved, in full | — |
| 02 shell | one change requested | group the setup screens under a "Configurações" menu |
| 03 accounts | approved | drop the initial-balance column; sort by name |
| 04 categories | approved | drop the month-spend column; make subcategory creation visible |
| 05 cashboxes | partly | drop the empty-goal wording and the "new cashbox" card |
| 06 month | approved, in full | — |
| 07 income / expense | approved, in full | — |
| 08 cashbox operations | approved, in full | — |
| 09 monthly report | approved | drop CSV export; add an "against the average" column |
| 10 yearly report | approved | percentage beside the current-year value, one row per category |
| 11 charts | approved | show every category, never group into "Outras" |
| 12 recurrences | approved, in full | keep the `autoConfirm` checkbox |
| 13 voice | approved, in full | — |

---

## Settled

### 01 — Login

All four decisions approved as prototyped: narrow centred card with no illustration; generic error
that never reveals whether the email exists; no "remember me"; the demo account signs in through
the same form with no separate button.

### 02 — Shell

**The setup screens become sub-items of a "Configurações" menu**, instead of a flat group under a
"Cadastros" label. That covers the four currently in that group: Contas, Categorias, Caixinhas,
Recorrências. Everyday work (Mês, Relatórios, Lançar por voz) stays at the top level.

Worth a second look while regenerating: Recorrências sits in that group today, so it moves with
the others, but it is arguably day-to-day rather than setup.

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

Not addressed, so still open on this screen: whether deposit/withdraw stay on each card in addition
to the top button, and whether an inactive cashbox with history disappears from here while staying
in the report (M6-T05).

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

- **No CSV export.** Drop the button from this screen. This is a scope change against M6-T03, whose
  implementation notes and acceptance criteria still call for CSV — see "Plan impact" below.
- **The cashbox block is visible by default**, not collapsed. That was the open question here.
- **New column: is this month above or below the average?** The one thing on these screens that was
  asked for rather than approved, so it has no prototype yet. Three things to settle while drawing
  it, none of them decided:
  - _Average of what._ The natural reading is each category's own monthly average, which M6-T02
    already computes and defines as the mean over months with activity. Reuse that definition
    rather than inventing a second one.
  - _Over which window._ Calendar year to date, or a rolling twelve months. They disagree in
    January.
  - _Which direction is good._ Above average is bad for an expense and good for income, so this
    column cannot colour itself from the sign the way every other amount does.
- Remaining approved as prototyped: the proportion bar inside the percentage cell; expenses and
  income in separate tables; percentages over the month's expense total, rounded to close at 100%;
  a category with no movement omitted rather than shown as zero.

### 10 — Yearly report

- **Comparison with the previous year: the percentage sits beside the current year's value, and
  both years stay on the same row.** This answers the open question — the comparison lives inside
  the cell, and a category never occupies two rows.
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

- **M6-T03** lists CSV export in its implementation notes and carries an acceptance criterion for
  the exported file. The monthly report no longer has it.
- **M6-T01** returns the month's figures only. The new "against the average" column needs a per
  category average, which today exists solely in M6-T02's yearly response — so either M6-T01 grows
  the field, or the screen calls both endpoints.

## Open

Every screen has now been reviewed. What is left:

1. **Colour concept** — sage, indigo or slate. Blocks visual approval of everything.
2. **Type concept** — grotesk, humanist or mixed. Same.
3. **CSV on the yearly report.** It was dropped from the monthly report explicitly; the yearly one
   was not mentioned and still has the button. The yearly matrix is the view that most resembles
   the spreadsheet being replaced, so do not assume the same answer — ask.
4. The three details of the new "against the average" column, listed under 09.
5. On cashboxes: whether deposit/withdraw stay on each card as well as in the top bar, and whether
   an inactive cashbox with history vanishes from that screen while staying in the report.
6. Whether Recorrências belongs under the new "Configurações" menu, as the shell change implies.
