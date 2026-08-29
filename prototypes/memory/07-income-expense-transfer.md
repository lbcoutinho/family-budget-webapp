# 07 — Income / expense / transfer

Status: approved, in full.

**The segmented control opens on "Despesa"** — settled in the second v2 review, when the green
action accent raised the question of whether a pre-selected type would contradict the button's
colour. It does not: nearly every entry is an expense, and pre-selecting saves an interaction.

All five approved as prototyped: type as a segmented control at the top of the dialog; cashbox
operations kept out of this form; date and amount before classification; optimistic insert with rollback.

Issue #284 reopens one credit-card detail for approval. Card expenses expose distinct **purchase**
and **settlement** dates instead of an editable reference month. Settlement suggests the first day
of the month after purchase, including year rollover, but remains editable. Once edited, changing
only the purchase date preserves settlement. Settlement cannot precede purchase; its month becomes
the reference month and it determines when the expense enters balances. Non-card entries use their
single date as both purchase and settlement date.

Two of the prototype's own open decisions were settled during #169, which fixed the shipped dialog
back onto the approved design:

- **Description is required, not optional** — the API has always rejected a blank one
  (`@IsNotEmpty()`). The prototype's "(opcional)" on both labels was the one thing wrong; it came
  off in #169 and the field stays required on every tab.
- **"Salvar e adicionar outro" clears everything** — date, account, category and all — rather than
  preserving date/account/category as the screen doc originally said. Only the selected type tab is
  kept, since that is the mode the user is in, not a value they typed.

Also settled in #169, not previously called out: the credit-card checkbox only appears on the
expense tab (income on a credit card is not a thing the model represents), and the dialog titles
itself for the mode it is in — "Novo lançamento" creating, "Editar lançamento" editing.
