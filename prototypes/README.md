# Prototypes

Throwaway HTML mock-ups of every screen, built to settle concept, colour, typography, spacing and
animation **before** any React code exists.

**Rule: no screen is implemented without an approved prototype.** This is recorded in
`CLAUDE.md`; the screen inventory and the actions each screen supports live in
`plans/0002-screens.md`.

## Layout

```
prototypes/
├── index.html            entry point — the three screens under review, and every screen's status
├── _shared/              proto.css (tokens) + proto.js (icons, app shell, dialogs)
├── NN-name.html          under review
├── MEMORY.md             every UI decision the user has made
├── approved/             approved — the reference the React implementation follows
├── archives/
│   └── v2-directions/    the four candidate directions; D won, the others are the record
├── discarded/
│   └── v1-default/       the first set, discarded in full — complete and still openable
└── .nojekyll             belt and braces, see "Published site" below
```

**v2 is direction D — Cromático**, chosen out of the four and expanded into a system. Its thesis:
**colour belongs to the data, never to the chrome.** A category's colour is permanent identity, so
the interface around it is achromatic — no brand colour at all, which is how the long-open "sage,
indigo or slate?" question ended up answered.

**Three screens are under review**, not thirteen: `00-design-system`, `06-month` and
`09-reports-monthly`. They are the three that decide everything — the token set, the densest
screen, and the one carrying the new against-the-average column. The remaining ten follow once
these are approved; drawing them first would only mean drawing them twice.

`archives/` and `discarded/` are not the same thing. A discarded set was rejected; the archived
directions were the path to a decision, and three of them lost a comparison they existed to lose.

Now that there is one direction, the shared `_shared/proto.css` and `_shared/proto.js` are back —
a set of thirteen screens has no business repeating its tokens thirteen times. During the
comparison each direction carried its own CSS on purpose, because a shared stylesheet would have
quietly made four directions into one.

## How to look at them

Open `prototypes/index.html` in a browser. No build and no server — plain files on disk. Unlike v1
these fetch webfonts (Familjen Grotesk, Public Sans, DM Mono), so the first load wants a
connection; without one they fall back to system faces and the typography no longer reads as
intended.

They are also published as a static site — see below — so a screen can be reviewed from a phone,
or sent as a link, without a checkout.

Two things are worth touching rather than looking at: **click a day in the month strip** on screen
06, which filters the list and recomputes the totals, and **hover the "contra a média" column** on
screen 09, whose tooltips carry the half of the average rule that a heading cannot say.

Worth opening on a phone too. Both ends are the design; neither is the other's fallback.

v1 offered a black bar that switched colour, type and motion across every screen. That is gone on
purpose — it let one set of screens pretend to be three, which is how v1 ended up with no point of
view at all.

## Approval flow

1. Read the screen, and the **"Decisões a aprovar"** block at the bottom of each page — the open
   questions are listed there deliberately.
2. Approve, or say what changes. Approving moves the file into `approved/`; the status table in
   `index.html` and the checklist in `plans/0002-screens.md` are updated in the same commit.
3. Only then does the screen become an implementation ticket.
4. A rejected prototype moves to `discarded/` rather than being deleted. One prototype rejected
   moves one file; a whole generation rejected moves into its own `discarded/vN-<name>/` folder,
   carrying `_shared/` and the index so the archive still renders. Exploration that was never
   meant to ship — the four design directions — goes to `archives/vN-<name>/` instead, on the same
   terms: complete, with its own index, still openable.

Files inside `approved/` are read-only references. When an approved prototype needs to change,
edit it in place and note the change in the pull request — the prototype and the built screen must
not drift.

## Published site

`.github/workflows/pages.yml` deploys **this folder and nothing else** to GitHub Pages on every
push to `main` that touches it. `prototypes/index.html` becomes the site root, so the paths are
the same as on disk and no link has to change to be deployable.

Publishing only this folder is the whole reason it is a workflow rather than the one-click
"deploy from a branch" setting: that setting can serve only the repository root or `/docs`, which
would publish the entire repository as static files.

Requires **Settings → Pages → Source = "GitHub Actions"** (one-off, by hand). This is not optional
and not a no-op: with the source left on "Deploy from a branch", that mode owns the `github-pages`
environment and limits it to its own branch deployment, so this workflow is **rejected before a
runner is assigned**. The symptom is a two-second failure with no logs, no step output and no
error annotation — it looks like a broken workflow and is not one.

The Pages settings page offers starter workflows ("Static HTML", "Jekyll") once the source is set
to GitHub Actions. Those are suggestions GitHub always shows; ignore them, this repository already
has its workflow. Changing the dropdown is the whole change.

Switching the source does not itself deploy — the push that would have triggered it has already
happened. Run it from **Actions → Prototypes → Run workflow**, which is what `workflow_dispatch`
is there for.

`.nojekyll` is precautionary rather than required: this deployment path uploads the folder as an
artifact and runs no Jekyll, so `_shared/` is served as-is. It is kept because the failure it
guards against — Jekyll dropping underscore-prefixed paths, leaving every screen unstyled — is
silent, only reproduces on the deployed site, and costs an empty file to prevent.

## What these are not

- Not a component library. The React implementation uses shadcn/ui; this CSS only exists so the
  mock-ups look like the real thing, and it is deleted as each screen ships.
- Not the source of truth for behaviour — that is the milestone plan and the ADRs. Where a
  prototype contradicts them, the plan wins and the prototype gets fixed.
- Not accessible-by-construction. Contrast and focus rings are considered, but keyboard
  interaction, ARIA and screen-reader flow are settled in the React implementation.

## Conventions

- UI strings are pt-BR, because the interface is localized. Filenames, comments, code and commit
  messages stay en-US, as everywhere else in this repository.
- Money is always shown pt-BR formatted with the euro symbol (`1.234,56 €`) and tabular figures.
- Sample data is fictional and self-consistent across screens: the same accounts (Millennium,
  Revolut, Dinheiro), the same categories and the same month (July 2026).
