# 05 — Cashboxes

Status: **drawn in v2, under review** — no empty-goal wording, no "new cashbox" card, "show
inactive" toggle added.

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

## Raised by the M3 block drawn on 2026-08-02

- **The cashbox balance is amber at display size**, the only screen where amber carries a large
  number; on the month screen the same value sits in an uncoloured card.
- **Deactivating a cashbox that still holds money is allowed**, with a warning that says the
  balance stays in the total. The alternative — requiring an empty cashbox — was rejected.
