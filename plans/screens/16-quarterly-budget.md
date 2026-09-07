# 16 — Quarterly Budget (`/budgets/:year/:quarter`)

**Prototype ticket:** #335. **Parent delivery spec:** #333.

| Action | Result |
| --- | --- |
| Open Budget | Shows the current calendar quarter |
| Navigate or select a quarter | Opens any past, current, or future quarter |
| Make the first valid edit | Creates that quarter's Budget after the autosave pause |
| Edit estimated Income, quarterly note, allocation, or Category note | Shows dirty-field count and autosaves the whole valid Budget after about 800 ms |
| Enter an invalid intermediate value | Keeps it locally, suspends autosave, and announces the field error |
| Override an adjusted monthly amount | Preserves it when Income or percentage changes |
| Restore calculated amount | Replaces the override with the current calculated monthly target |
| Retry a failed save | Keeps local edits and retries the same aggregate write |

The editable allocation set contains every active top-level Expense Category plus any inactive
Category already used by the Budget. Quarterly and monthly targets, effective percentages, totals,
remaining Expense Budget, planned availability for financial goals, realized surplus, and Income
variance are derived. Allocation above 100% remains valid and produces a warning.

Actuals use confirmed Transactions grouped by Reference Month. Income is broken down by month and
Income Category; Expenses remain distinct from Transfers and Cashbox Movements. Desktop and phone
use the same controls without a horizontally scrolling editing surface. Status changes use an
accessible live region, field errors are associated with their inputs, and navigation warns while
invalid or unsaved values remain. See `prototypes/16-quarterly-budget.html`.
