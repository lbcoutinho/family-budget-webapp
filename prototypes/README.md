# Prototypes

Throwaway HTML mock-ups of every screen, built to settle concept, colour, typography, spacing and
animation **before** any React code exists.

**Rule: no screen is implemented without an approved prototype.** This is recorded in
`CLAUDE.md`; the screen inventory and the actions each screen supports live in
`plans/0002-screens.md`.

## Layout

```
prototypes/
├── index.html            entry point — list of every prototype and its status
├── _shared/
│   ├── proto.css         design tokens + minimal component styles
│   └── proto.js          concept switcher (colour/mode/font/motion) + app shell
├── NN-name.html          prototypes under review
├── approved/             approved — the reference the React implementation follows
├── discarded/            rejected — kept as a record of what was already tried
└── .nojekyll             belt and braces, see "Published site" below
```

## How to look at them

Open `prototypes/index.html` in a browser. No build, no server, no dependencies — plain files
on disk, everything inline, no network access required.

They are also published as a static site — see below — so a screen can be reviewed from a phone,
or sent as a link, without a checkout.

The black bar at the top of every page switches four axes, and the choice is stored in
`localStorage`, so it follows you from screen to screen:

| Selector  | Values                        | What it is                                            |
| --------- | ----------------------------- | ----------------------------------------------------- |
| `cor`     | sage · indigo · slate         | Colour concept                                        |
| `modo`    | light · dark                  | Light / dark mode                                     |
| `fonte`   | grotesk · humanist · mixed    | Type concept                                          |
| `motion`  | full · reduced                | Animation, and what `prefers-reduced-motion` produces |

Start at `00-design-system.html`. Everything else inherits from it, so approving a screen before
the design system means re-approving it later.

## Approval flow

1. Read the screen, and the **"Decisões a aprovar"** block at the bottom of each page — the open
   questions are listed there deliberately.
2. Approve, or say what changes. Approving moves the file into `approved/`; the status table in
   `index.html` and the checklist in `plans/0002-screens.md` are updated in the same commit.
3. Only then does the screen become an implementation ticket.
4. A rejected direction moves to `discarded/` rather than being deleted.

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
