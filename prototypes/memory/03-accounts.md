# 03 — Accounts

Status: **approved**, in `approved/`, approved 2026-08-04. M3-T07 unblocked on the UI side.

**Design-approved on 2026-08-04.** All five "Decisões a aprovar" on the page were approved:

- **M3-T07 ships without the current-balance column; M5-T06 adds it.** The column comes from
  `GET /accounts/balances`, which does not exist until M5-T06. Chosen over the alternative of
  making M3-T07 depend on M5-T06. Both milestone files (`m03-master-data.md`, `m05-entries-ui.md`)
  are updated to carry this split.
- **The "Tipo" column stays** (conta corrente, poupança, carteira, cartão de crédito). It changes no
  domain rule — label, not behaviour. The v1 screen never had it.
- **Inactive accounts appear in the list, dimmed, behind the "show inactive" toggle** — same rule as
  categories and cashboxes.
- **The footer total covers active accounts only**, labelled, with the line below it explaining why
  it does not match the month screen's consolidated total (which includes cashboxes).
- **Negative balance in red, no icon, no parentheses** — carried over from the v1 approval.

Earlier, already-settled decisions this drawing carried forward:

- **No initial-balance column in the list.** It is a value that is set once and then rarely looked
  at; it lives in the edit dialog, which is where the user goes when they do want it.
- **Current balance stays in the list**, once it exists (see the M5-T06 split above). This resolves
  the either/or that was on the page: current balance in the table, initial balance only in the
  form.
- **Default sort: alphabetical by account name.** Consistent with the already-approved decision not
  to expose manual ordering, even though `sortOrder` exists on the model.
