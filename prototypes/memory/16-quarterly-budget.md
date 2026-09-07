# 16 — Quarterly Budget

Status: **approved** in `approved/16-quarterly-budget.html`, issue #335.

## Question

Which information hierarchy best supports quarterly planning and review on desktop and mobile?

- **A — Planning ledger:** one dense allocation table followed by results.
- **B — Category workspace:** allocation list beside a focused editor and a compact result rail.
- **C — Quarter story:** plan, monthly actuals, and Category allocations arranged in reading order.
- **D — Table + quarter rail:** combines A's single allocation table with C's responsive rhythm and
  sticky “Your quarter” summary.

## Review 1 — issue #335

The user selected A's single-table allocation model and C's mobile treatment and sticky quarter
summary as the basis for D. In D:

- “Calculated” becomes “Monthly target”; clearing a manual adjustment is an icon with a tooltip.
- The detailed realized-results summary stays below allocation.
- The mobile allocation keeps quarterly target and monthly target visible.
- The quarter rail has Planned, Realized, and Quarter note groups; estimated Income and the quarter
  note move into it. Planned Expenses are red, and planned Expenses plus goal availability show
  their effective percentages as muted subtitles.

## Approval — issue #335

Variant D was approved on 2026-09-07. It preserves the parent issue #333 contract and settles the
hybrid desktop and mobile structure described above.

## States and access

The prototype switcher exposes populated, first-use empty, loading, load error, saving, invalid,
and recoverable save-failure states. Arrow keys switch variants unless focus is in an editable
control. Form order follows visual order; errors use `aria-describedby`, autosave uses a polite
live region, and warning/error recovery remains keyboard reachable.
