# 12 — Recurrences (`/recurrences`)

**Ticket:** M7-T06

| Action | Result |
| --- | --- |
| Create fixed rule | Description, amount, account, category, frequency, day, start, optional end |
| Create installment plan | Total, count, first payment date, purchase date; all N materialized at once |
| Preview | Upcoming occurrences, recalculated as fields change, persisted nowhere |
| Generate now | Manual run, idempotent |
| Deactivate | Stops future generation, keeps history |
| Cancel installments | Removes only future, unconfirmed installments |

Rules and installment plans share one table, told apart by the progress column ("sem fim" versus
"4/12"). Editing a rule never touches entries already generated — the amount is copied at
generation time — and the screen says so. Entries produced by a rule are marked with an icon on
the monthly tab. `autoConfirm` is exposed as a checkbox — generated entries are not always
confirmed, the rule decides.
