# 07 — Entry form (dialog)

**Ticket:** M5-T02, M5-T03, M5-T09

| Action | Result |
| --- | --- |
| Pick type (income / expense / transfer) | Segmented control; changes which fields show |
| Fill and save | Optimistic insert into the table, rolled back on error |
| "Salvar e adicionar outro" | Clears every field, resets the date to today, keeps the type tab, and focuses "Conta" — create screen only |
| Tick "cartão de crédito" | Expense-only; reveals settlement date, suggesting the first day of the following month |

The dialog titles itself for the mode it is in — "Novo lançamento" creating, "Editar lançamento"
editing — and only the create dialog offers "Salvar e adicionar outro".

Fields are ordered the way a bank statement is read: date and amount first, classification after,
with the reference-month field immediately above the credit-card checkbox and settlement date last,
right above the footer. Reference month is the accounting classification: it initially follows the
settlement month but can be changed independently. The credit-card
checkbox only appears on the expense tab — a credit-card purchase is a spend, never income — and an
entry saved on any other tab always carries `isCreditCard: false`. "Descrição" is required on every
tab; the API rejects a blank one, so the form does too.

The subcategory select stays disabled until a category is chosen and clears when it changes;
choosing a category never marks the subcategory invalid on its own — that only happens on a save
attempt with a category already chosen. When editing an old entry whose category was deactivated,
the value is still shown, marked "(inativa)" — it must not be silently lost.

A failed save focuses the topmost field that is missing or invalid, in the same top-to-bottom order
the fields are drawn, and that field shows a red border. Filling it and saving again moves focus to
the next empty field. Backend validation errors land on the matching field the same way; network
errors become a toast.
