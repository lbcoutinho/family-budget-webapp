# Feature Ideas

Ideas recorded for future features — no milestone or deadline defined yet. Prioritization and brainstorming will be done at a later stage.

- Import bank/account statement (format TBD — CSV, XML or other): user uploads a statement file; system detects entries already registered to avoid duplicates; new entries are created as `DRAFT` transactions for the user to review, categorize, and approve.
- Personal note field on transactions: separate from the statement/imported description (which stays as-is from the bank), a free-text field for the user's own explanation of what the expense was, to help them remember it later.
- Toggle on the transactions screen to switch the displayed text between the personal note and the real transaction description; when a transaction has no personal note, keep showing the normal description.
- Generic `config` JSON field on `User` (instead of a dedicated settings table) to hold all user settings (e.g. `locale`, and whatever future Settings screen options get added), avoiding a new table per setting.
- Assessibility improv with lighthouse in chrome
