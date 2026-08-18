# Prototypes

- **`prototypes/MEMORY.md` records every UI decision the user has already made — split by topic, with `MEMORY.md` itself as the index.** It holds only the
  status-per-screen table plus links; `prototypes/memory/global-rules.md` holds cross-cutting settled rules (no dark mode, no CSV, the monthly-average
  definition, what "approved" means), and
  `prototypes/memory/<NN>-<screen>.md` holds one screen's own decisions. Touching or regenerating a screen → read that screen's file plus `global-rules.md`, not
  the whole tree. Updating a screen's status → edit the index's table and that screen's file only. Note that **concept approval and design approval are separate
  gates**: a concept can be settled while the file is still under review, so it stays out of `approved/` and the screen stays blocked.
- Lifecycle: `prototypes/*.html` (under review) → `approved/` (implementation may start) → or `discarded/` (rejected, kept as record) → or `archives/`
  (exploration that did its job, kept as the record of a choice — not a rejection). A whole generation moves to `discarded/vN-<name>/` or `archives/vN-<name>/`,
  carrying `_shared/` and the index so it still renders. Moving a file also updates the status table in `prototypes/index.html` and §4 of
  `plans/screens/`, same commit.
- **State right now: `00-design-system.html`, `01-login.html`, `02-app-shell.html`, `06-month.html`, `09-reports-monthly.html`, `10-reports-yearly.html` and
  `14-settings-general.html` are approved**
  and live in `approved/` (so M2-T06, M3-T06, the M5 month tickets and M3-T13 are unblocked on the UI side);
  `11-reports-charts.html` is under review. v2 is direction **D — Cromático**, chosen from four candidates now in
  `archives/v2-directions/`; v1 is in `discarded/v1-default/`. Its thesis, amended once in review: **colour belongs to the data — and to the action** — no brand
  colour, but `--action` (= `--income`) on primary button, focus ring and active nav item; 10 category swatches; two typefaces, Familjen Grotesk + Public Sans,
  numbers included via
  `tabular-nums`.
- **Screens are drawn one at a time, in the order the project needs them, and approved one at a time.** Never draw the undrawn screens in a batch, and never
  draw the next one unasked.
- Every prototype ends with a **"Decisões a aprovar"** block — the open choices, stated so they can be decided rather than guessed.
- `00-design-system.html` is approved first; everything else inherits colour/type/motion from it.
- Prototypes are not accessibility- or component-complete: shadcn/ui provides the real components; the prototype CSS is deleted as each screen ships.

- **Every time a prototype review session starts, read `memory/open-questions.md` first.** It holds cross-cutting questions raised in past reviews that don't
  belong to one screen. Check whether the session at hand answers any of them.
  - A question answered (by an ADR, a ticket, or the review itself) gets **removed from the file**, not left with a
    "decided" strikethrough — the decision lives in the ADR/ticket, not here.
  - The file may legitimately be empty; that means every question raised so far is settled.
