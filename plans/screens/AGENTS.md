# Screens — index

Plan 0001 defines the domain and the milestones; the milestone files define the tickets. Neither
says what the application *looks* like, or which actions each screen offers. This folder closes
that gap and introduces one rule:

> **No screen is implemented without an approved prototype.**

A prototype is a disposable HTML file under `prototypes/`. It exists to settle concept, colour,
typography, spacing and animation cheaply, while changing one's mind is still free. Once approved
it becomes the reference the React implementation follows; it is never itself shipped.

This does not add a milestone. Prototyping happens ahead of the milestone that owns the screen, and
the approved prototype is linked from the ticket's GitHub Issue.

See [global-rules.md](global-rules.md) for the prototype workflow (folder, lifecycle, rules, order
of approval) and the cross-cutting decisions (colour, typography, motion, layout, shared states,
monthly averages, localization) that apply to every screen below.

## Screens

Thirteen screens plus the design system. There is deliberately **no dashboard** — the monthly tab
is the home screen; `/` redirects to `/month`, which redirects to the current month. A separate
overview would duplicate the balance panel and the report without adding a decision the user cannot
already make.

| #   | Screen                                        | Route                   |
| --- | ---------------------------------------------- | ------------------------ |
| 01  | [Login](01-login.md)                          | `/login`                 |
| 02  | [Shell / navigation](02-shell.md)             | (frame)                   |
| 03  | [Accounts](03-accounts.md)                    | `/accounts`               |
| 04  | [Categories](04-categories.md)                | `/categories`             |
| 05  | [Cashboxes](05-cashboxes.md)                  | `/cashboxes`              |
| 06  | [Monthly tab](06-month.md) — the main screen  | `/month/:year/:month`     |
| 07  | [Entry form](07-entry-form.md) (dialog)       | (dialog)                  |
| 08  | [Cashbox operations](08-cashbox-operations.md) (dialog) | (dialog)        |
| 09  | [Monthly report](09-monthly-report.md)        | `/reports`                |
| 10  | [Yearly report](10-yearly-report.md)          | `/reports?view=yearly`    |
| 11  | [Charts](11-charts.md)                        | `/reports?view=charts`    |
| 12  | [Recurrences](12-recurrences.md)              | `/recurrences`            |
| 13  | [Voice entry](13-voice.md)                    | `/voice`                  |

Screen 14 (Settings › General, `/settings/general`, M3-T13) is outside the original thirteen; its
issue (#73) asked for `07-settings-general.html`, but 07 is already the entry-form dialog above —
drawn as 14, the next free number, and flagged as a deviation on the issue rather than reused
silently.

Current per-screen prototype status (what's in `approved/`, what's still under review) lives in the
table in `prototypes/MEMORY.md` — check there, not here, for "is screen N approved yet." The ticket
that implements each screen is named in its own file.

## What is deliberately absent

| Not built | Why |
| --- | --- |
| Dashboard / home | The monthly tab is the home; a separate one would repeat the balance panel |
| Sign-up, password reset | Single user, seeded; there is no self-service account |
| Budget/limit per category | Not in the domain model; would be a new plan |
| Attachments on entries | Not in the domain model |
| Global search across months | The monthly filter covers the real use; revisit if it does not |
| Onboarding / tour | One user, who wrote the requirements |
