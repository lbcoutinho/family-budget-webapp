# Prototype decisions — index

What the user has already decided about the prototypes. A regeneration reads the relevant file(s)
below first and treats everything there as input, not as a question to ask again.

This is the only `MEMORY.md` in the project — it records UI decisions. GitHub Issues/Milestones are
the source of truth for ticketed work.

**This file is split by topic — read only what you need.** Checking or updating one screen's
status? Read this index's table and that screen's file, nothing else. Regenerating a screen? Read
[memory/global-rules.md](memory/global-rules.md) plus that screen's file. No single read needs the
whole set.

- [memory/global-rules.md](memory/global-rules.md) — standing instruction, cross-cutting settled
  rules (no dark mode, no CSV, the monthly-average definition, etc.), what "approved" means.
- Per-screen files, one per row of the status table below.

## Status per screen

Update this table when a screen's status changes — approving/rejecting a prototype touches only
this table and that screen's own file, nothing else.

| #   | Screen                      | Status            | File                                                                         |
| --- | --------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| 00  | Design system               | **approved**      | [memory/00-design-system.md](memory/00-design-system.md)                     |
| 01  | Login                       | **approved**      | [memory/01-login.md](memory/01-login.md)                                     |
| 02  | Shell                       | **approved**      | [memory/02-shell.md](memory/02-shell.md)                                     |
| 03  | Accounts                    | **approved**      | [memory/03-accounts.md](memory/03-accounts.md)                               |
| 04  | Categories                  | **approved**      | [memory/04-categories.md](memory/04-categories.md)                           |
| 05  | Cashboxes                   | **approved**      | [memory/05-cashboxes.md](memory/05-cashboxes.md)                             |
| 06  | Month                       | **approved**      | [memory/06-month.md](memory/06-month.md)                                     |
| 07  | Income / expense / transfer | **approved**      | [memory/07-income-expense-transfer.md](memory/07-income-expense-transfer.md) |
| 08  | Cashbox operations          | **approved**      | [memory/08-cashbox-operations.md](memory/08-cashbox-operations.md)           |
| 09  | Monthly report              | **approved**      | [memory/09-monthly-report.md](memory/09-monthly-report.md)                   |
| 10  | Yearly report               | **approved**      | [memory/10-yearly-report.md](memory/10-yearly-report.md)                     |
| 11  | Charts                      | **approved**      | [memory/11-charts.md](memory/11-charts.md)                                   |
| 12  | Recurrences                 | **approved**      | [memory/12-recurrences.md](memory/12-recurrences.md)                         |
| 13  | Voice                       | approved, in full | [memory/13-voice.md](memory/13-voice.md)                                     |
| 14  | Settings › General          | **approved**      | [memory/14-settings-general.md](memory/14-settings-general.md)               |
| 15  | CSV transaction import      | **approved**      | [memory/15-transaction-import.md](memory/15-transaction-import.md)           |

"Approved" here means **concept**-approved — structure and behaviour. **Design** approval (colour,
type, spacing locked in against `00-design-system.html`) is separate and only 00, 01, 02, 03, 04, 05,
06, 07, 08, 09, 10, 11 and 14 have passed it — those sit in `approved/` and unblock their tickets on the UI side.

**14 is a new screen, added for M3-T13, outside the original thirteen-screen inventory.** Its ticket
(issue #73) asked for `prototypes/07-settings-general.html`, but 07 is already the entry-form dialog
(`plans/screens/AGENTS.md`) — reused here as 14, the next free number, and flagged on the issue as a
deviation rather than silently renumbered.
See [memory/global-rules.md](memory/global-rules.md#what-approved-means) for the two-gate rule.

Every row's v1 file is in `discarded/v1-default/`.

# Open questions

Every screen has been reviewed at concept level. What's left per screen is tracked in that screen's
own file. This section is only for questions that don't belong to one screen.

- [memory/open-questions.md](memory/open-questions.md) — cross-cutting questions with no screen of
  their own. **Renaming rewrites history**, raised 2026-08-06, decided the same day for cashboxes
  ([ADR-0019](../../docs/adr/0019-cashbox-label-snapshot-and-deletion.md)); accounts and categories
  keep ADR-0015 unchanged. File is empty until the next one is raised.
