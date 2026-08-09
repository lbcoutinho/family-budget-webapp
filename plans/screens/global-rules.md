# Global rules and standing instructions

Cross-cutting decisions that apply to every screen, not to one of them. Read this before touching
any screen file in this folder — a per-screen file never overrides what's here.

## 1. Prototype workflow

### 1.1 Folder

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

### 1.2 Lifecycle

| State        | Location            | Meaning                                                  |
| ------------ | -------------------- | -------------------------------------------------------- |
| Under review | `prototypes/*.html` | Written, waiting for the user's decision                  |
| Approved     | `approved/`         | Locked; the implementation ticket may start               |
| Discarded    | `discarded/vN-…/`   | Rejected, kept so it is not proposed again                |
| Archived     | `archives/vN-…/`    | Exploration that did its job, kept as the record of a choice |

**v1-default is discarded in full.** It did its job — it turned a plan into thirteen concrete
screens and pulled the decisions out of the user — and is kept for exactly that reason: a record of
what was already tried.

**The four v2 design directions are archived**, not discarded. `dir-d-cromatico` was chosen and
became v2; the other three are the evidence for why.

Moving a file also updates the status table in `prototypes/index.html` and `prototypes/MEMORY.md`,
in the same commit.

### 1.3 Rules

- **Low effort by construction.** Plain HTML, one shared stylesheet, no build step, no framework,
  no external requests. A prototype that takes longer than the screen it replaces has failed.
- **Fictional but consistent data.** The same accounts, categories and month (July 2026) across
  every screen, so numbers can be traced from the monthly tab into the reports.
- **Every prototype ends with a "Decisões a aprovar" block** listing the choices that need a
  decision, including the ones with a real alternative.
- **pt-BR in the interface, en-US everywhere else** — filenames, comments, commits, plans.
- **The plan wins over the prototype.** Where a mock-up contradicts a milestone file or an ADR, the
  prototype is wrong and gets fixed.
- **Changing an approved prototype is allowed** when implementation reveals a problem; edit it in
  place and say so in the pull request. What is not allowed is a built screen quietly diverging.
- A decision that turns out to be architectural — not merely visual — still produces an ADR, per
  `AGENTS.md`.

### 1.4 Order of approval

`00 — Design system` first: colour, type, radius, shadow and motion propagate into every other
screen, so approving a screen before it means approving it twice. Then `02 — Shell`, because it
frames everything. The remaining screens can be approved in any order, though it is cheapest to
follow milestone order.

---

## 2. Cross-cutting decisions

These hold for every screen and are demonstrated in `00-design-system.html`.

### 2.1 Colour

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
good and bad rather than in and out — see [09-monthly-report.md](09-monthly-report.md).

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

### 2.2 Typography

The typefaces come with the direction too: a display face used with restraint, a body face, and a
face for figures. Direction D pairs **Familjen Grotesk** (headings and large values),
**Public Sans** (body, deliberately neutral so it does not compete with the colour) and
**DM Mono** (every amount, date, percentage and count). Two constraints hold regardless — **every
amount is set in tabular figures**, because columns of money that do not align cannot be scanned,
and the display face is never the delivery vehicle for data.

### 2.3 Motion

Motion is chosen per direction rather than capped in advance. v1 fixed one easing curve and a
320 ms ceiling before there was anything to animate, and that turned out to forbid the two cases
where duration carries meaning: a rail being drawn across a month, a container filling. What
survives as a rule is narrower and about honesty, not budget:

- `prefers-reduced-motion` is respected everywhere.
- **A balance is never animated.** A number someone is reconciling against a bank statement must
  be readable the instant it appears. A total that recomputes because a filter changed is a
  different thing and may move.

### 2.4 Layout and responsiveness

The application is used on desktop **and** on the phone, and both are the design rather than one
being a fallback for the other. A screen is not finished until it has been drawn twice.

Sidebar of 244 px on desktop, collapsing to a drawer on narrow viewports; sticky top bar holding
the route title and its primary action; content capped for readability. On mobile the primary
action becomes a floating button. Wide tables scroll horizontally with the first column frozen
rather than collapsing into cards — the yearly matrix has no card equivalent.

### 2.5 Shared states

Every data screen specifies four states: **loading** (skeleton, never a blank page), **empty**
(explains the concept and offers the create action), **error** (message plus retry) and
**populated**. Deactivated records are dimmed and hidden behind a "show inactive" toggle.

### 2.6 Monthly averages

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

See [09-monthly-report.md](09-monthly-report.md) and [10-yearly-report.md](10-yearly-report.md) for
where this rule is applied.

### 2.7 Localization and formatting

Interface in pt-BR, single currency euro, `1.234,56 €` via `lib/money.ts`. Dates `dd/MM/yyyy`,
months written out ("Julho de 2026") in navigation. Money input accepts both `1.234,56` and
`1234.56` and is submitted as integer cents.
