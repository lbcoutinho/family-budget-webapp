# 05 — Cashboxes

Status: **approved** — no empty-goal wording, no "new cashbox" card, "show inactive" toggle added,
delete button added, moved to `prototypes/approved/05-cashboxes.html`.

Liked, and kept: **the summary cards at the top** and **the goal progress bars**.

- **Say nothing when there is no goal.** Drop the "Sem meta definida" line and the "Sem meta —
  nenhuma barra de progresso" note: absence needs no caption, the card simply has no bar.
- **Drop the dashed "+ Nova caixinha" card.** The action already exists in the top bar.
- **Deposit and withdraw stay in both places**: on each card and in the top bar. From the card the
  cashbox comes pre-filled, from the top bar it is chosen inside the dialog.
- **Inactive cashboxes are visible behind a "show inactive" toggle**, dimmed, exactly like
  categories and accounts. They do not vanish from the screen.

Two things follow, and both are work rather than wording:

- **That toggle does not exist on this prototype.** Accounts and categories have one; cashboxes
  never did, because the earlier draft had inactive ones disappearing. It has to be added, and on a
  card grid rather than a table.
- **An inactive card must not offer a working deposit or withdraw button.** The two answers meet
  here: buttons live on every card, and inactive entities cannot be used in new entries
  (`CLAUDE.md`, domain rules). So those cards keep their balance — the history behind it is real —
  but their actions are disabled, not merely inert.

## Review of the v2 draw, 2026-08-06

- **The four summary cards follow the monthly report's order**: caixinhas ativas, depositado no mês,
  resgatado no mês and, last, total guardado. The screen ends on the accumulated figure the same way
  screen 09 ends on the cashboxes after income and expense. The count stays — it is no longer "the
  most dispensable of the four", it opens the row.
- Everything else in the "Decisões a aprovar" block stands as drawn: deposit/withdraw in both
  places, amber display-size balance on the card, green bar on a reached goal that blocks nothing,
  deactivating with a balance allowed with a warning.
- **The card has no delete button, and that is an oversight, not a decision.** The screen's own
  states section draws the "Apagar" dialog and its 409, and accounts and categories both put a trash
  icon next to edit and deactivate. The cashbox card offers only edit and deactivate, so the delete
  it documents is unreachable. Fixed to match 03 and 04.
- **The 409 this dialog draws is no longer "has transactions" but "balance is not zero".**
  ADR-0019 narrows ADR-0015 for Cashbox only: a zero-balance cashbox may be deleted even with
  transaction history — the row is removed and its transactions keep the cashbox's name as text
  (`cashboxLabel`) while `cashboxId` goes to `NULL`. A non-zero balance still returns 409. Renaming
  a cashbox no longer rewrites the label on past entries either. Deactivate stays the reversible
  default action on the card; delete is the permanent one, and its confirmation says so.

## Raised by the M3 block drawn on 2026-08-02

- **The cashbox balance is amber at display size**, the only screen where amber carries a large
  number; on the month screen the same value sits in an uncoloured card.
- **Deactivating a cashbox that still holds money is allowed**, with a warning that says the
  balance stays in the total. The alternative — requiring an empty cashbox — was rejected.
