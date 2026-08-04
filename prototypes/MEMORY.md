# Prototype decisions

What the user has already decided about the prototypes. A regeneration reads this first and treats
everything under "Settled" as input, not as a question to ask again.

Two `MEMORY.md` files exist and they do not overlap: `plans/MEMORY.md` tracks GitHub mirroring, and this one records UI
decisions.

---

## Standing instruction

**v1 is discarded in full** (`discarded/v1-default/`) — rejected for looking templated, having been
drawn without any design skill in play.

**Direction D — Cromático won.** The four candidates are archived whole in
`archives/v2-directions/`, index included, so the comparison still renders. They are archived
rather than discarded: three of them lost a comparison they existed to lose, which is not the same
as being rejected.

**`00-design-system.html` is approved** and moved to `approved/`. Its relative paths climb one
level (`../_shared/…`), and `proto.js` picks the right index link by looking for `/approved/` in
the path. `01-login.html`, `02-app-shell.html` and `06-month.html` are approved too and sit beside it.
`09-reports-monthly.html` is still under review.

The two comparison pages that closed screen 06 — `06-month-chart.html` (the strip, simple ×
stacked) and `06-month-list.html` (the list, four variants) — are in
`archives/v2-month-comparisons/`. They are self-contained (no `_shared/`, no index of their own),
so they are archived as they are, without a copy of anything beside them.

**Screens are drawn one at a time from here on**, in the order the project needs them, and approved
one at a time — the user asked for this explicitly. **Never draw the undrawn screens in a batch,
and never draw the next one unasked.**

**Broken once, on 2026-08-02, by explicit request: 02, 03, 04 and 05 were drawn as a block**, because
the whole of M3 depends on them. The rule stands for everything after — the exception was asked for,
not assumed. **Approval stayed one at a time:** each of the four carries its own "Decisões a aprovar"
block and moves to `approved/` on its own.

Discarding v1 discarded the files, not the decisions. Everything under "Settled" below still holds
and v2 respects it — that is the whole reason this file exists separately from the mock-ups.

### Settled for v2 and everything after

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

### Versions are per design skill

v2 is what the `frontend-design` skill produces. Later versions come from other skills, one
version each, so the comparison is between skills rather than between briefs. Keep them as
separate `vN` sets and do not merge them.

### First review of v2 — settled 2026-08-01

The user reviewed `00-design-system.html` section by section. What that produced:

- **Ten category colours, not sixteen — approved as drawn** in the second pass. Eleven or twelve categories is the real ceiling, and six
  of the sixteen were near-duplicates (two blues, two oranges, two teals, two magentas, two purples,
  two olives). **Repetition past ten is accepted** — the eleventh category reuses a colour and the
  value label keeps the chart readable. The ten that stayed were re-tuned rather than merely
  cut: every one is now ≥ 4.8:1 on the page (usable as text, not only as a dot) and no pair is
  closer than ΔE2000 12.9 in normal vision. Final values live in `_shared/proto.css`.
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
  amber cashbox, amber already darkened. No longer an open question.
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

### What v2 decided on its own, and needs confirming

- **The cashbox amber darkened** from `#a0700f` to `#8a6008`, because the original sat at 4.4:1 on
  white, under the 4.5:1 floor. It is now 5.6:1. The other three money colours already passed.
  **Approved in the first review.**
- **The month list is rows, not a table**, which cost the plan's "sort by clicking a column
  header" — there is no header. Sorting moved to a select above the list. The gain is one layout
  that works at both ends without a table that scrolls sideways.

Raised by the M3 block drawn on 2026-08-02, all still open and each stated as a numbered decision on
its own page:

- **02 — no floating action button on mobile**, against the plan's own §3.4, which proposed one. The
  sticky top bar already keeps the action visible and the floating button covers the last row of the
  month list. Drawn both ways side by side so the choice is made by looking.
- **02 — the sidebar never collapses on desktop**, no icon-only mode, no collapse control.
- **02 — logging out asks for no confirmation.**
- **03 — a "Tipo" column** (conta corrente, poupança, carteira, cartão de crédito), which the v1
  never had. It changes no domain rule and is a label, not behaviour. **Kept as drawn, approved
  2026-08-04.**
- **03 — the account list's footer total covers active accounts only**, and says in a line below why
  it does not match the month screen's consolidated total, which includes cashboxes. **Approved as
  drawn, 2026-08-04.**
- **03 — M3-T07 ships without the current-balance column** and gains it at M5-T06, rather than the
  ticket waiting. **Settled 2026-08-04: M3-T07 ships without it; M5-T06 adds the column to the
  accounts list as part of its own scope** — both milestone files updated to match.
- **04 — "+ Subcategoria" is a dashed text button in the middle column**, and it disappears on the
  phone, where the action moves inside the expanded parent row.
- **04 — the "Outros" subcategory's deactivate button is disabled rather than absent** when it is the
  last active one, so the reason can be shown on click. The backend still answers 409.
- **05 — the cashbox balance is amber at display size**, the only screen where amber carries a large
  number; on the month screen the same value sits in an uncoloured card.
- **05 — deactivating a cashbox that still holds money is allowed**, with a warning that says the
  balance stays in the total. The alternative — requiring an empty cashbox — was rejected.

### Rules deliberately broken in v2, and why

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

## What "approved" means below

**Concept approval and design approval are separate gates.** Every screen passed the first one in
the v1 review. The second is now being passed **one screen at a time**:

- **`00-design-system.html` has passed both** and sits in `approved/`. Colour, type, spacing,
  radius, shadow and motion are locked; no later screen may contradict it.
- **`01-login.html` has passed both** and sits in `approved/`, so M2-T06 is unblocked.
- **`02-app-shell.html` has passed both** and sits in `approved/`, so M3-T06 is unblocked.
- **`06-month.html` has passed both** and sits in `approved/`, so M5-T01, M5-T05 and M5-T06 are
  unblocked on the UI side.
- **`03-accounts.html` has passed both**, approved 2026-08-04, and sits in `approved/`, so M3-T07
  is unblocked on the UI side.
- **`04-categories.html` has passed both**, approved 2026-08-04, and sits in `approved/`, so
  M3-T08 is unblocked on the UI side.
- **Every other screen is still concept-only**, so `CLAUDE.md`'s rule keeps blocking
  implementation.
- What "concept approved" settles is structure and behaviour: which actions a screen offers, which
  columns exist, what is shown and what is not.

## Status per screen

Every row's v1 file is in `discarded/v1-default/`. "Concept" is what survived review and carries
into v2. **Drawn in v2** marks the three that exist now; every other row is waiting on their
approval.

| Prototype             | Concept           | Changes to apply when regenerating                                                                                                                   |
| --------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00 design system      | **approved**      | in `approved/` — 10 swatches, green action accent, Grotesk + Public Sans with tabular figures                                                        |
| 01 login              | **approved**      | in `approved/` — four states, the action is the only colour on the screen, no subtitle and no demo footer                                            |
| 02 shell              | **approved**      | in `approved/` — Caixinhas second, below Mês; Contas and Categorias under Configurações; no burger on the desktop                                    |
| 03 accounts           | **approved**      | in `approved/` — initial-balance column gone, current balance in the list (added by M5-T06), type column kept, sorted by name                        |
| 04 categories         | **approved**      | in `approved/` — month-spend column gone, "+ Subcategoria" a visible button on the parent row, subcategory dialog shows the parent as a colour label |
| 05 cashboxes          | approved          | **drawn in v2, under review** — no empty-goal wording, no "new cashbox" card, "show inactive" toggle added                                           |
| 06 month              | **approved**      | in `approved/` — stacked month strip, the wide row, running balance under every amount                                                               |
| 07 income / expense   | approved, in full | —                                                                                                                                                    |
| 08 cashbox operations | approved, in full | —                                                                                                                                                    |
| 09 monthly report     | approved          | **drawn in v2** — CSV gone, against-the-average column drawn, composition band added                                                                 |
| 10 yearly report      | approved          | drop CSV; percentage beside the current-year value, one row per category; average column headed "Média 12 meses" with a tooltip                      |
| 11 charts             | approved          | show every category, never group into "Outras"                                                                                                       |
| 12 recurrences        | approved, in full | keep the `autoConfirm` checkbox                                                                                                                      |
| 13 voice              | approved, in full | —                                                                                                                                                    |

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

### 01 — Login

All four decisions approved as prototyped: narrow centred card with no illustration; generic error
that never reveals whether the email exists; no "remember me"; the demo account signs in through
the same form with no separate button.

**Approved in v2 and moved to `approved/`.** Four states on one page — initial, submitting, invalid
credential, verifying session — plus a live form at the top that actually fails once and then
signs in, because the screen has exactly one interaction and it is worth prototyping for real.
What the review settled, beyond the four already approved:

- **The action is the only colour on the screen.** Direction D at its limit: no data, so nothing
  else is coloured except the mark, which is the palette itself.
- **"Entrando…" lives in the button**, not in an overlay; the fields stay readable.
- **On error the password is cleared and focused, the email is kept.** The email half was already
  approved; clearing the password is new.
- **The verifying state reuses the same card in the same place**, so nothing shifts when it
  becomes the form.
- **No footer line about the demo account, and no subtitle under the title.** Rejected in
  review: the demo account uses this same form, so saying so is noise, and "Entre para continuar"
  states what two fields and a button already state. The card is title, fields, button — nothing
  else. The same rule applies to every screen: don't label what the controls already say.

### 02 — Shell

**The registries become sub-items of a "Configurações" menu**, instead of a flat group under a
"Cadastros" label: Contas and Categorias.

**Caixinhas is the second top-level item, directly below Mês** — decided in the v2 review, moved
out of Configurações. Same reason as Recorrências: it is visited while running the month, not set
up once and forgotten.

**Recorrências stays at the top level**, alongside Mês, Caixinhas, Relatórios and Lançar por voz.

**No burger on the desktop.** The sidebar is fixed above 900 px, so the menu button has nothing to
open and does not render. (In the v2 drawing it did — `.btn`'s `display` was overriding `.burger`'s;
the rule now sits after the button rules in `proto.css`.)

#### Review of the v2 drawing — settled 2026-08-02, all five approved

1. **On the phone the main action stays in the top bar — no floating action button.** The
   alternative was drawn beside it and rejected.
2. **The sidebar does not collapse on the desktop.** 244 px fixed, no icons-only mode.
3. **Logout asks for no confirmation.**
4. **The brand is the palette — four squares — and the name is "Orçamento".**
5. **The user and the logout sit at the foot of the sidebar**, not in the top bar.

### 03 — Accounts

**Design-approved on 2026-08-04** and moved to `approved/`. All five "Decisões a aprovar" on the
page were approved:

- **M3-T07 ships without the current-balance column; M5-T06 adds it.** The column comes from
  `GET /accounts/balances`, which does not exist until M5-T06. Chosen over the alternative of
  making M3-T07 depend on M5-T06. Both milestone files (`m03-master-data.md`, `m05-entries-ui.md`)
  are updated to carry this split.
- **The "Tipo" column stays** (conta corrente, poupança, carteira, cartão de crédito). It changes no
  domain rule — label, not behaviour.
- **Inactive accounts appear in the list, dimmed, behind the "show inactive" toggle** — same rule as
  categories and cashboxes.
- **The footer total covers active accounts only**, labelled, with the line below it explaining why
  it does not match the month screen's consolidated total (which includes cashboxes).
- **Negative balance in red, no icon, no parentheses** — carried over from the v1 approval.

Earlier, already-settled decisions this drawing carried forward:

- **No initial-balance column in the list.** It is a value that is set once and then rarely looked
  at; it lives in the edit dialog, which is where the user goes when they do want it.
- **Current balance stays in the list**, once it exists (see the M5-T06 split above). This resolves
  the either/or that was on the page: current balance in the table, initial balance only in the
  form.
- **Default sort: alphabetical by account name.** Consistent with the already-approved decision not
  to expose manual ordering, even though `sortOrder` exists on the model.

### 04 — Categories

**Design-approved on 2026-08-04** and moved to `approved/`. All five "Decisões a aprovar" on the
page were approved, plus one change made during the review itself:

- **The mobile gap is real and stays undrawn on purpose — but the ticket now says so explicitly.**
  On the phone, expanding a category hides the "+ Subcategoria" button along with the count column
  it sits in, and the prototype doesn't draw a replacement. Not worth reworking the mock-up for;
  instead `plans/milestones/m03-master-data.md` (M3-T08) now states directly that the action must
  move inside the expanded parent row on narrow viewports, so it isn't quietly lost when the
  desktop layout gets implemented first.
- **The count column and its number stay**, both approved as drawn.
- **New, decided in this review rather than drawn originally: the subcategory dialog's "Categoria"
  field is a label with the colour swatch beside it, not an input.** The field was disabled but
  still looked like a form field, which invited the question of why it couldn't be typed into. A
  label with the parent's swatch states the same fact — which category this will belong to — without
  implying it's editable. Applied directly to the prototype before moving it to `approved/`.
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

**Design-approved on 2026-08-02** and moved to `approved/`. Nothing on the screen is open any
more; everything below is the record of how it got there.

#### Second review, on the v2 drawing — settled 2026-08-01

The six "Decisões a aprovar" on the page were **all approved as drawn**. What the review changed is
everything around them, and all of it is applied:

- **The sidebar is approved as a whole** — the app name on the left, Mês / Relatórios / Lançar por
  voz / Recorrências at the top level, Configurações below. Two icons were wrong and are replaced
  in `_shared/proto.js`, so every screen inherits them:
  - **Configurações is a gear.** The circle-with-rays read as a sun, and the gear is the convention.
  - **Recorrências is two arrows turning, one behind the other** — the cycle. The previous pair of
    straight arrows read as a transfer.
- **Clicking the month name opens a picker**: a year stepper plus a twelve-month grid, so any month
  of any year is two clicks. The arrows stay for stepping one month at a time; "Hoje" stays.
- **The cashbox button gets the cashbox amber and says what it does.** It was a white outline
  button labelled just "Caixinha", which named a noun rather than an action and read as neutral
  chrome. It is now **"Movimentar caixinha"** with the piggy icon, in the amber that already means
  cashbox everywhere — outlined rather than filled, so it never competes with the green primary.
  It opens the screen-08 dialog, which is deposit, withdraw and transfer in one, so "movimentar"
  is the accurate verb rather than only "adicionar".
- **The strip is titled "Despesas dia a dia"**, replacing "O que saiu, dia a dia". The chart itself
  is liked and stays.
- **"Total consolidado" now sits on an ink background**, white text, instead of the grey wash that
  only barely told it apart from the four account cards. It stays uncoloured: a balance is not an
  action, and the green belongs to the action.
- Filters, sorting, the "31 lançamentos · 1 rascunho" summary and the entry rows are approved as
  drawn — the summary explicitly, because it surfaces pending drafts.

**The strip is stacked — settled after seeing `06-month-chart.html`.** A day can carry more than one
colour: one segment per category, largest at the base, so nothing that left on that day disappears.
It replaces the single dominant-category bar, which hid everything but the largest on 15 of July's
24 spending days. The comparison page stays as the record, with the width slider that showed the
real cost — at phone width a small expense becomes a 1–2 px sliver. The fallback if that sliver
becomes a complaint is written down there and still undrawn: stack at most three segments and roll
the rest into a grey fourth.

**The list stays A — the wide row.** Chosen from the four in `06-month-list.html` (A wide row, B
grouped by day, C dense statement, D collapsed by category), against the page's own recommendation
of B. The comparison page stays as the record of what was rejected.

**Every entry now carries the running balance of its account**, under the amount: grey, 11 px, no
colour — the same shape the monthly report uses to put the average under the percentage. What that
settled:

- **Which account.** The origin — the account the money left. Transfers and cashbox moves have two
  sides and both are applied to the running total, otherwise the destination's later rows would lie;
  only the origin's balance is displayed. The account is named in the row's own sub-line already, so
  the balance shows bare, with the account in a tooltip.
- **Always chronological**, whatever the list is sorted by. Sorting by amount must not change a
  balance.
- **Drafts carry none.** They affect nothing, so there is nothing to show.
- **No `+` on a positive balance**; a negative one keeps its `−`, because there it is information.
- The prototype's June 30 opening balances are picked backwards so the month closes exactly on the
  five balance cards at the top (Millennium 3.482,15 · Revolut 412,90 · Dinheiro −35,00 · caixinhas
  4.150,00 · total 8.010,05). Verified, not assumed.

### 07 — Income / expense / transfer

**The segmented control opens on "Despesa"** — settled in the second v2 review, when the green
action accent raised the question of whether a pre-selected type would contradict the button's
colour. It does not: nearly every entry is an expense, and pre-selecting saves an interaction.

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

Every screen has been reviewed at concept level. What is left is the visual gate, and v2 now puts
a concrete proposal against each of the two questions — they are answered on paper, not settled.

1. **Colour — closed.** No brand colour; ten category swatches; the money four approved; one action
   accent borrowed from the income green. Sections 1–3 of `00-design-system.html`.
2. **Type — closed.** Familjen Grotesk (display) + Public Sans (body and every number, with
   tabular figures), scale approved. Two families, three roles.

**Nothing on `00-design-system.html` is open any more.** Whether the file moves to `approved/` is
the user's call; once it does, `01-login.html` can be drawn and M2-T06 can start.

There is also one open question v2 raised rather than answered, on screen 09: whether the
against-the-average column reads correctly when green and red mean good and bad next to an amount
already coloured by the other rule. It was deliberately drawn plain, with nothing added to keep
the two meanings apart, so that the answer comes from looking at it.
