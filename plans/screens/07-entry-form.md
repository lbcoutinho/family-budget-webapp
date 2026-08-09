# 07 — Entry form (dialog)

**Ticket:** M5-T02, M5-T03

| Action | Result |
| --- | --- |
| Pick type (income / expense / transfer) | Segmented control; changes which fields show |
| Fill and save | Optimistic insert into the table, rolled back on error |
| "Salvar e adicionar outro" | Keeps the dialog open, preserving date, account and category |
| Tick "cartão de crédito" | Reveals the reference-month picker, suggesting the following month |

Fields are ordered the way a bank statement is read: date and amount first, classification after.
The subcategory select stays disabled until a category is chosen and clears when it changes. When
editing an old entry whose category was deactivated, the value is still shown, marked
"(inativa)" — it must not be silently lost. Backend validation errors land on the matching field;
network errors become a toast.
