# 16 — Quarterly Budget

Status: **under review** in `16-quarterly-budget.html`, issue #335.

## Question

Which information hierarchy best supports quarterly planning and review on desktop and mobile?

- **A — Planning ledger:** one dense allocation table followed by results.
- **B — Category workspace:** allocation list beside a focused editor and a compact result rail.
- **C — Quarter story:** plan, monthly actuals, and Category allocations arranged in reading order.

All variants preserve the parent issue #333 contract. Review is still required; the winning
structure and any borrowed parts must be recorded here before the prototype moves to `approved/`.

## States and access

The prototype switcher exposes populated, first-use empty, loading, load error, saving, invalid,
and recoverable save-failure states. Arrow keys switch variants unless focus is in an editable
control. Form order follows visual order; errors use `aria-describedby`, autosave uses a polite
live region, and warning/error recovery remains keyboard reachable.
