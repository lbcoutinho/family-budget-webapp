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
| 09–13 reports, recurrences, voice | **not reviewed** | — |

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

---

## Open

1. **Colour concept** — sage, indigo or slate. Blocks visual approval of everything.
2. **Type concept** — grotesk, humanist or mixed. Same.
3. **09 monthly report, 10 yearly report, 11 charts, 12 recurrences, 13 voice** — not reviewed yet.
   Their own "Decisões a aprovar" blocks still hold the questions, including the yearly
   comparison layout, whether the donut collapses slices under ~3%, and whether `autoConfirm` is
   exposed on recurrence rules.
4. The two cashbox items and the Recorrências placement noted above.
