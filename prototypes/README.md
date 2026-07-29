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
└── discarded/            rejected — kept as a record of what was already tried
```

## How to look at them

Open `prototypes/index.html` in a browser. No build, no server, no dependencies — plain files
on disk, everything inline, no network access required.

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
