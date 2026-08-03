# Plan 0002 — Screens, actions and prototypes

**Status:** Awaiting approval
**Depends on:** [`0001-overview.md`](0001-overview.md)
**Last updated:** 2026-07-30

---

## 1. Purpose

Plan 0001 defines the domain and the milestones; the milestone files define the tickets. Neither
says what the application *looks* like, or which actions each screen offers. This plan closes that
gap and introduces one rule:

> **No screen is implemented without an approved prototype.**

A prototype is a disposable HTML file under `prototypes/`. It exists to settle concept, colour,
typography, spacing and animation cheaply, while changing one's mind is still free. Once approved
it becomes the reference the React implementation follows; it is never itself shipped.

This does not add a milestone. Prototyping happens ahead of the milestone that owns the screen, and
the approved prototype is linked from the ticket's GitHub Issue.

---

## 2. Prototype workflow

### 2.1 Folder

```
prototypes/
├── index.html          list of every prototype and its status
├── MEMORY.md           every UI decision the user has made
├── _shared/            proto.css (tokens) + proto.js (icons, app shell, dialogs)
├── NN-name.html        under review
├── approved/           approved — reference for implementation
├── archives/
│   └── v2-directions/  the four candidate directions, kept as the record of the choice
└── discarded/
    └── v1-default/     a rejected set, complete and still openable
```

A set that leaves circulation is kept whole, in its own `vN-<name>` folder, `_shared/` and index
included, so it still opens and renders years later. Rejecting one prototype moves one file;
rejecting a whole generation moves the generation.

`discarded/` and `archives/` are different claims. Discarded means rejected. Archived means the
work was exploration that was never going to ship as-is — the four design directions, three of
which lost a comparison they existed to lose.

The folder is also published as a static site: `.github/workflows/pages.yml` deploys **only this
folder** to GitHub Pages on every push to `main` that touches it, so a screen can be reviewed from
a phone or sent as a link. Publishing one folder is why it is a workflow and not the "deploy from
a branch" setting, which can only serve the repository root or `/docs`. See
`prototypes/README.md`.

### 2.2 Lifecycle

| State        | Location            | Meaning                                                  |
| ------------ | ------------------- | -------------------------------------------------------- |
| Under review | `prototypes/*.html` | Written, waiting for the user's decision                  |
| Approved     | `approved/`         | Locked; the implementation ticket may start               |
| Discarded    | `discarded/vN-…/`   | Rejected, kept so it is not proposed again                |
| Archived     | `archives/vN-…/`    | Exploration that did its job, kept as the record of a choice |

**v1-default is discarded in full.** It did its job — it turned a plan into thirteen concrete
screens and pulled the decisions out of the user — and is kept for exactly that reason: a record of
what was already tried.

**The four v2 design directions are archived**, not discarded. `dir-d-cromatico` was chosen and
became v2; the other three are the evidence for why.

Moving a file also updates the status table in `prototypes/index.html` and §4 of this plan, in the
same commit.

### 2.3 Rules

- **Low effort by construction.** Plain HTML, one shared stylesheet, no build step, no framework,
  no external requests. A prototype that takes longer than the screen it replaces has failed.
- **Fictional but consistent data.** The same accounts, categories and month (July 2026) across
  every screen, so numbers can be traced from the monthly tab into the reports.
- **Every prototype ends with a "Decisões a aprovar" block** listing the choices that need a
  decision, including the ones with a real alternative.
- **pt-BR in the interface, en-US everywhere else** — filenames, comments, commits, this plan.
- **The plan wins over the prototype.** Where a mock-up contradicts a milestone file or an ADR, the
  prototype is wrong and gets fixed.
- **Changing an approved prototype is allowed** when implementation reveals a problem; edit it in
  place and say so in the pull request. What is not allowed is a built screen quietly diverging.
- A decision that turns out to be architectural — not merely visual — still produces an ADR, per
  `CLAUDE.md`.

### 2.4 Order of approval

`00 — Design system` first: colour, type, radius, shadow and motion propagate into every other
screen, so approving a screen before it means approving it twice. Then `02 — Shell`, because it
frames everything. The remaining screens can be approved in any order, though it is cheapest to
follow milestone order.

---

## 3. Cross-cutting decisions

These hold for every screen and are demonstrated in `00-design-system.html`.

### 3.1 Colour

The palette comes with the chosen design direction rather than from a menu of themes — v1's three
interchangeable schemes were part of why it had no point of view. The direction is **D —
Cromático**, and its thesis decides the whole question: **colour belongs to the data, never to the
chrome.** There is therefore **no brand colour at all** — the primary button, the active navigation
item, the focus ring and the table header are ink. Any brand accent would compete with the only
colours that carry meaning.

Whatever direction wins, the **money colours never change**: green is income, red is expense, blue
is transfer, amber is cashbox. Tying them to the brand colour would mean the brand could change
what a table means. Colour is never the only signal either — amounts also carry an explicit
`+`/`−`. **This assignment is approved**; only its exact tones travel with the direction.

The one exception is the against-the-average column on the monthly report, where green and red mean
good and bad rather than in and out — see §5, screen 09.

Category colours come from `Category.color`, offered as a **sixteen-swatch suggested palette**, and
are reused verbatim by every chart, so a category looks the same in every month and every view. A
category with no colour falls back to a deterministic value derived from its id. Sixteen is a
ceiling, not a guarantee of legibility: the charts draw every category with no "Outras" grouping,
and sixteen categorical hues cannot all stay distinguishable from one another — least of all for a
colour-blind reader. **So identification falls to the value**: a slice, bar or segment carries its
own amount as a label, and colour is left to group rather than to name. Nothing in the interface
requires matching a swatch against a legend to know what it is.

**There is no dark mode.** One appearance, tuned properly, rather than two carried at half
attention — which also means every token is a single value instead of a light/dark pair.

### 3.2 Typography

The typefaces come with the direction too: a display face used with restraint, a body face, and a
face for figures. Direction D pairs **Familjen Grotesk** (headings and large values),
**Public Sans** (body, deliberately neutral so it does not compete with the colour) and
**DM Mono** (every amount, date, percentage and count). Two constraints hold regardless — **every
amount is set in tabular figures**, because columns of money that do not align cannot be scanned,
and the display face is never the delivery vehicle for data.

### 3.3 Motion

Motion is chosen per direction rather than capped in advance. v1 fixed one easing curve and a
320 ms ceiling before there was anything to animate, and that turned out to forbid the two cases
where duration carries meaning: a rail being drawn across a month, a container filling. What
survives as a rule is narrower and about honesty, not budget:

- `prefers-reduced-motion` is respected everywhere.
- **A balance is never animated.** A number someone is reconciling against a bank statement must
  be readable the instant it appears. A total that recomputes because a filter changed is a
  different thing and may move.

### 3.4 Layout and responsiveness

The application is used on desktop **and** on the phone, and both are the design rather than one
being a fallback for the other. A screen is not finished until it has been drawn twice.

Sidebar of 244 px on desktop, collapsing to a drawer on narrow viewports; sticky top bar holding
the route title and its primary action; content capped for readability. On mobile the primary
action becomes a floating button. Wide tables scroll horizontally with the first column frozen
rather than collapsing into cards — the yearly matrix has no card equivalent.

### 3.5 Shared states

Every data screen specifies four states: **loading** (skeleton, never a blank page), **empty**
(explains the concept and offers the create action), **error** (message plus retry) and
**populated**. Deactivated records are dimmed and hidden behind a "show inactive" toggle.

### 3.6 Monthly averages

Wherever the application shows an average per month — the monthly report's against-the-average
column, the yearly matrix's average column, anything added later — it means the same thing:

> the **twelve months ending with the month on screen**, divided by **only those months that had
> movement**.

Never a flat twelve. A genuinely quarterly category — insurance, say — would otherwise read as
above average in every month it appears, which is noise rather than information.

This is provisional: it is the definition to try first, and it may not survive contact with real
data. Two consequences it is worth knowing about before then:

- The window crosses the year boundary. March 2027 averages April 2026 onward.
- **On the yearly matrix it stops reconciling with the row.** For a complete past year the window
  is exactly the twelve columns displayed, so the average checks out. For the current year it
  reaches back into the previous one, and the number at the end of the row can no longer be derived
  from the cells beside it. Resolved by naming it rather than by making an exception: that column
  is headed **"Média 12 meses"** and carries a tooltip explaining the window and the divisor. The
  definition stays the same everywhere.

### 3.7 Localization and formatting

Interface in pt-BR, single currency euro, `1.234,56 €` via `lib/money.ts`. Dates `dd/MM/yyyy`,
months written out ("Julho de 2026") in navigation. Money input accepts both `1.234,56` and
`1234.56` and is submitted as integer cents.

---

## 4. Screen inventory

Thirteen screens plus the design system. "Prototype" names the file; "Ticket" the milestone task
that implements it. **The whole first set was discarded after review** and lives in
`prototypes/discarded/v1-default/`; the decisions it produced are in `prototypes/MEMORY.md` and are
the input to v2.

**v2 is direction D — Cromático.** The design system is **approved** and sits in
`prototypes/approved/`, together with `01-login`, `02-app-shell`, `03-accounts`, `04-categories` and
`06-month`. Two are under review: `05` cashboxes and `09` monthly report.

Screens are drawn **one at a time, in the order the project needs them**. That rule was broken once,
on the user's explicit instruction: 02 to 05 were drawn as a block because the whole of M3 depends on
them. **Approval stays one at a time** — each file carries its own "Decisões a aprovar" block and
moves to `approved/` on its own.

| #   | Screen             | Route                  | Ticket             | Prototype                    | Status      |
| --- | ------------------ | ---------------------- | ------------------ | ---------------------------- | ----------- |
| 00  | Design system      | —                      | —                  | `approved/00-design-system.html` | **approved** |
| 01  | Login              | `/login`               | M2-T06             | `approved/01-login.html`     | **approved** |
| 02  | Shell / navigation | (frame)                | M3-T06             | `approved/02-app-shell.html` | **approved** |
| 03  | Accounts           | `/accounts`            | M3-T07, M5-T06      | `approved/03-accounts.html`  | **approved** |
| 04  | Categories         | `/categories`          | M3-T08             | `approved/04-categories.html` | **approved** |
| 05  | Cashboxes          | `/cashboxes`           | M3-T09, M5-T06     | `05-cashboxes.html`          | **v2 — under review** |
| 06  | Monthly tab        | `/month/:year/:month`  | M5-T01, T05, T06   | `approved/06-month.html`     | **approved** |
| 07  | Entry form         | (dialog)               | M5-T02, M5-T03     | `07-transaction-form.html`   | Awaiting v2 |
| 08  | Cashbox operations | (dialog)               | M5-T04             | `08-cashbox-form.html`       | Awaiting v2 |
| 09  | Monthly report     | `/reports`             | M6-T03             | `09-reports-monthly.html`    | **v2 — under review** |
| 10  | Yearly report      | `/reports?view=yearly` | M6-T02, M6-T03     | `10-reports-yearly.html`     | Awaiting v2 |
| 11  | Charts             | `/reports?view=charts` | M6-T04, M6-T05     | `11-reports-charts.html`     | Awaiting v2 |
| 12  | Recurrences        | `/recurrences`         | M7-T06             | `12-recurrences.html`        | Awaiting v2 |
| 13  | Voice entry        | `/voice`               | M8-T01, M8-T04     | `13-voice.html`              | Awaiting v2 |

"Awaiting v2" means the screen's concept survived the v1 review and only its drawing is missing.
Each of those drawings is requested when the project reaches it, never in advance.

There is deliberately **no dashboard**. The monthly tab is the home screen; `/` redirects to
`/month`, which redirects to the current month. A separate overview would duplicate the balance
panel and the report without adding a decision the user cannot already make.

---

## 5. Actions per screen

### 01 — Login (`/login`)

| Action | Result |
| --- | --- |
| Submit credentials | Access token in memory, refresh cookie, redirect to `/month` |
| Failed submit | Inline generic error; the typed email is preserved |

No sign-up, no password reset, no "remember me" — single user created by the seed, and the session
already restores itself from the refresh cookie. On load, the silent refresh runs behind a
verifying state, never behind the login form, so the form never flashes.

### 02 — Shell (frame for every route)

| Action | Result |
| --- | --- |
| Navigate | Route change; active item highlighted |
| Open menu (mobile) | Drawer; closes on selection |
| Logout | Clears the session, redirects to `/login` |

Navigation is split into everyday work (Mês, Caixinhas, Relatórios, Lançar por voz, Recorrências)
and a **Configurações** menu holding the two registries: Contas and Categorias. Caixinhas sits
second, directly below Mês, and Recorrências stays at the top level: both are visited while running
the month, not set up once. The user and the logout action sit at the foot of the sidebar; the top bar
belongs to the current task.

### 03 — Accounts (`/accounts`)

| Action | Result |
| --- | --- |
| Create / edit | Dialog; currency input submitted as cents |
| Deactivate / reactivate | Confirmation; account disappears from new entries |
| Delete | Real delete, or a 409 with a clear message when entries exist |
| Toggle "show inactive" | Adds dimmed rows |

The list shows the current balance and not the initial one, which moved into the edit dialog.
The current balance needs `GET /accounts/balances`, which arrives with M5-T06, so M3-T07 either
ships without the column or waits. Rows are sorted alphabetically by name.

### 04 — Categories (`/categories`)

| Action | Result |
| --- | --- |
| Switch expense / income tab | Filters by `kind` |
| Expand a category | Reveals its subcategories |
| Create root category | Automatically ships with an "Outros" subcategory |
| Create subcategory from its parent | `parentId` pre-filled; the parent shows as a label with its colour swatch, not an editable field |
| Pick colour | Ten suggested swatches plus a hex field |
| Deactivate parent | Confirmation stating that the children go with it |
| Deactivate last active subcategory | Blocked, 409 explained inline |
| Search | Filters the tree |

Colour belongs to the root category; subcategories inherit it in charts. There is no "gasto no
mês" column: it was dropped at review, which leaves this screen with no dependency on M6 data.

**Design-approved 2026-08-04.** The row count column stays, shown as a number. On desktop
"+ Subcategoria" is a visible dashed button beside the count, in the parent row's middle column.
**On mobile that column disappears and the action must move inside the expanded parent row** —
the prototype does not draw this state, so it is called out here rather than left implicit: an
implementation that only ports the desktop button loses the ability to add a subcategory on
mobile entirely.

### 05 — Cashboxes (`/cashboxes`)

| Action | Result |
| --- | --- |
| Create / edit | Name, description, optional target |
| Deposit / withdraw from a card | Opens the operations dialog (08) with the cashbox pre-filled |
| Deposit / withdraw from the top bar | Same dialog, cashbox chosen inside it |
| Deactivate, delete | Same pattern as accounts, 409 when entries exist |
| Toggle "show inactive" | Adds the dimmed cards |

Cards rather than a table: there are few of them and the target progress bar needs the room. The
balance is always computed, never stored. Reaching the target turns the bar green and blocks
nothing.

Deposit and withdraw are reachable both from each card and from the top bar — from the card the
cashbox is already chosen, from the top bar it is picked in the dialog.

Inactive cashboxes follow the same rule as every other registry (§3.5): hidden by default, shown
dimmed behind the "show inactive" toggle, never gone. They keep showing their balance, because the
history behind it is real. What they must not keep is a working deposit or withdraw button — an
inactive entity cannot be used in a new entry, so on those cards the actions are disabled rather
than merely ineffective.

### 06 — Monthly tab (`/month/:year/:month`) — the main screen

| Action | Result |
| --- | --- |
| Previous / next month, "hoje", month picker | Updates the URL; a shared URL opens the same month |
| Search description, filter by type / category / account | Narrows the table |
| Sort | Client-side within the loaded page, chosen in a select above the list |
| New entry | Opens 07; the cashbox button opens 08 |
| Edit row | Opens the form matching the entry type, pre-filled |
| Delete row | Confirmation identifying the entry, then a toast with undo |
| Scroll | Cursor pagination via `useInfiniteQuery` |

Balances sit at the top (one card per account, one aggregate for cashboxes, one consolidated
total), because the point of the screen is trusting the numbers. Footer totals follow the domain
rule: **only `EXPENSE` counts as expense** — transfers and cashbox deposits are excluded, and the
footer says so. Credit card rows carry an icon plus the original purchase date in a sub-line, since
the date column shows the reference month. Voice `DRAFT` entries appear here dimmed and excluded
from the totals, as prototyped.

Entries are rows rather than table cells — date, description with its classification underneath,
amount — with the category's colour as a bar down the left edge. One layout serves the phone and
the desktop, and no wide table has to scroll sideways. The cost is that there is no column header
to click, so **sorting moved into a select** above the list. Row actions stay visible at reduced
opacity rather than appearing on hover, which is the same correction the categories screen needed.

Above the list sits the screen's signature: **a strip with one segment per day**, its height the
day's expense and its colour the category that weighed most. Clicking a day filters the list and
recomputes the footer. That recomputed total may animate; the balance panel never does.

### 07 — Entry form (dialog)

| Action | Result |
| --- | --- |
| Pick type (income / expense / transfer) | Segmented control; changes which fields show |
| Fill and save | Optimistic insert into the table, rolled back on error |
| "Salvar e adicionar outro" | Keeps the dialog open, preserving date, account and category |
| Tick "cartão de crédito" | Reveals the reference-month picker, suggesting the following month |

Fields are ordered the way a bank statement is read: date and amount first, classification after.
The subcategory select stays disabled until a category is chosen and clears when it changes. When
editing an old entry whose category was deactivated, the value is still shown, marked
"(inativa)" — it must not be silently lost. Backend validation errors land on the matching field;
network errors become a toast.

### 08 — Cashbox operations (dialog)

| Action | Result |
| --- | --- |
| Deposit | Source account → destination cashbox |
| Withdraw | Source cashbox → destination account |
| Transfer | Cashbox → cashbox, no account field at all |

The selected cashbox's balance is always visible next to the selector. An amount above the balance
raises a client-side warning but never disables the submit — the backend owns the decision and
answers 409 with the available amount, because the balance may have changed since the dialog
opened. Each mode carries a fixed explanatory line: cashbox mechanics are the non-obvious part of
the domain.

### 09 — Monthly report (`/reports`)

| Action | Result |
| --- | --- |
| Switch monthly / yearly / charts | Segmented control at the top |
| Navigate months | Same control as the monthly tab |
| Expand a category | Shows its subcategories |
| Click a row | Opens the monthly tab filtered by that category |

Expenses and income are separate tables, so the percentage column has one unambiguous base.
Cashbox movement appears in its own informational block, shown expanded, because it is excluded
from the percentages by construction. Categories with no activity in the period are omitted. There
is no CSV export.

A column compares the month against the category's rolling monthly average, defined in §3.6. Its
colour reads as good or bad rather than as in or out: an expense above its average is red, income
above its average is green. That is the one place in the application where green and red do not
mean money in and money out, and it sits beside an amount already coloured by the other rule — a
below-average expense shows a green marker next to a red figure, on the same row.

Decided: **draw it plainly and see how it reads**, without an extra device to separate the two
meanings. Provisional, like §3.6.

### 10 — Yearly report (`/reports?view=yearly`)

| Action | Result |
| --- | --- |
| Pick year | Reloads the matrix |
| Compare with the previous year | Adds the prior value and variation |
| Expand a category | Reveals subcategory rows |
| Click a cell | Opens that month filtered by that category |

Category rows, twelve month columns, and totals plus a **"Média 12 meses"** column on the right.
That heading is deliberate: the average is the rolling one of §3.6, so for the current year it
draws on months the matrix does not show, and a column merely headed "Média" would invite the
reader to check it against the twelve cells beside it and find it wrong. A tooltip spells out the
window and the divisor.
Values are rounded to whole euros so the matrix fits; cents remain in the monthly view. Future
months show "—", not zero. On mobile the table scrolls horizontally with the category column
frozen. The prior-year comparison renders inside the cell — percentage beside the current year's
value — so a category never occupies two rows.

### 11 — Charts (`/reports?view=charts`)

| Action | Result |
| --- | --- |
| Toggle a legend entry | Hides / shows the series |
| Hover a slice or bar | Tooltip with formatted amount and percentage |
| Click a slice or bar | Opens the corresponding filtered month |

Donut for the month's distribution (total in the centre), stacked bars for the year by category,
lines for income against expenses, and a separate line chart plus table for cashboxes — kept apart
precisely because cashboxes are not expenses. Below 640 px the donut becomes a list with bars. A
period with no data shows an empty state, never an empty chart frame. Every category is drawn;
nothing collapses into "Outras".

### 12 — Recurrences (`/recurrences`)

| Action | Result |
| --- | --- |
| Create fixed rule | Description, amount, account, category, frequency, day, start, optional end |
| Create installment plan | Total, count, first payment date, purchase date; all N materialized at once |
| Preview | Upcoming occurrences, recalculated as fields change, persisted nowhere |
| Generate now | Manual run, idempotent |
| Deactivate | Stops future generation, keeps history |
| Cancel installments | Removes only future, unconfirmed installments |

Rules and installment plans share one table, told apart by the progress column ("sem fim" versus
"4/12"). Editing a rule never touches entries already generated — the amount is copied at
generation time — and the screen says so. Entries produced by a rule are marked with an icon on
the monthly tab. `autoConfirm` is exposed as a checkbox — generated entries are not always
confirmed, the rule decides.

### 13 — Voice entry (`/voice`)

| Action | Result |
| --- | --- |
| Record / pause / clear | Live partial transcript |
| Edit the transcript | Free text, correctable before extraction |
| Extract | Candidates persisted as `DRAFT` |
| Edit a candidate inline | Saved onto the draft |
| Discard / approve a row | Removes it, or validates and confirms it |
| Approve all valid | Confirms only the complete ones, atomically |

Recording and review live on one route, stacked. Rows with missing fields are highlighted amber
with the approve button disabled; a likely duplicate (same date and amount already in the month)
is flagged but never blocked. Nothing here affects a balance or a report before approval. Leaving
with pending drafts asks for confirmation, and the drafts survive either way. A browser without
the Web Speech API falls back to a text box; a denied microphone permission explains how to
restore it.

---

## 6. What is deliberately absent

| Not built | Why |
| --- | --- |
| Dashboard / home | The monthly tab is the home; a separate one would repeat the balance panel |
| Sign-up, password reset | Single user, seeded; there is no self-service account |
| User settings screen | Nothing to configure yet — single currency, single locale, single user |
| Budget/limit per category | Not in the domain model; would be a new plan |
| Attachments on entries | Not in the domain model |
| Global search across months | The monthly filter covers the real use; revisit if it does not |
| Onboarding / tour | One user, who wrote the requirements |

---

## 7. Open questions to settle at approval

Answers as they are given, plus every other decision the user has made about the prototypes, are
recorded in `prototypes/MEMORY.md`. That file is the record; this list only tracks what is left.

Still open — both now have a concrete proposal in `00-design-system.html`, which is what approving
that screen accepts or rejects:

1. **Which colour concept.** Was Sage, Indigo or Slate. v2 proposes **none of them**: no brand
   colour, the sixteen category swatches as direction D drew them, and the money four with the
   cashbox amber darkened from `#a0700f` to `#8a6008` so its text clears 4.5:1 on white.
2. **Which type stack.** Was grotesk, humanist or mixed. v2 proposes **three roles instead of one
   family**: Familjen Grotesk, Public Sans, DM Mono.

Raised by v2 and deliberately left to the eye:

3. **Does the against-the-average column read?** On screen 09 an expense below its average shows a
   green marker beside a red figure, drawn plainly with nothing added to separate the two meanings
   of green. That was the decision — draw it and see — so this is answered by looking, not by
   argument.
4. **Sorting the month by a select rather than by column headers.** The month list is rows rather
   than a table, so there is no header to click. See §5, screen 06.

Settled:

- **The account list shows the current balance, not the initial one** — the initial balance moved
  into the edit dialog. The current balance still only exists from M5-T06, so M3-T07 either ships
  without that column or waits.
- **Voice drafts appear on the monthly tab, dimmed, excluded from the totals.**
- **The categories screen carries no month-spend column**, which removes its only dependency on M6
  data.
- **The yearly comparison lives inside the cell**, percentage beside the current year's value, one
  row per category.
- **The charts never group categories into "Outras"** — every category is drawn.
- **`autoConfirm` stays exposed** on recurrence rules.
- **There is no CSV export anywhere in the application** — not on the monthly report, not on the
  yearly one, nowhere. Applied to M6-T03 in `plans/milestones/m06-reports.md`.
- **The monthly report gains a column comparing the month against the category's average**, which
  M6-T01 has to feed — see "Plan impact" in `prototypes/MEMORY.md`.
