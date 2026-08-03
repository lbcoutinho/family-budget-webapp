# M5 — Entries (UI)

**Goal:** the monthly tab and the entry forms. At the end of this milestone the application replaces the spreadsheet.

**Definition of done:** a full month of activity can be recorded through the interface.

**Depends on:** M4 complete.

---

## M5-T01 — Monthly tab with the transaction table

### Why this is needed
The main screen of the application, where the user spends most of their time.

### Implementation notes
- `/month/:year/:month` route, with `/month` redirecting to the current month
- Previous/next month navigation plus a direct month picker
- TanStack Table with columns: date, description, category/subcategory, account, amount, type
- Income and expense amounts visually distinguished
- An icon marking credit card entries
- Column sorting and a quick text filter
- Cursor pagination wired to `useInfiniteQuery`
- Footer totals: income, expenses, month balance
- An empty month shows an empty state with a create action

### Acceptance criteria
- [ ] Month navigation updates the URL and reloads data
- [ ] A shared URL opens the correct month
- [ ] Footer totals match the displayed data
- [ ] Transfers and cashbox deposits are excluded from the expense total
- [ ] Infinite scroll loads subsequent pages
- [ ] The layout is usable on mobile

### Tests
- Integration with MSW: rendering; month navigation; totals; incremental loading; empty state

---

## M5-T02 — Category and subcategory selector

### Why this is needed
This component has a specific pitfall: when editing an old entry whose category was deactivated, the select renders empty and the user saves without noticing the loss.

### Implementation notes
- `CategorySelect` component with two dependent levels
- Choosing a category loads and enables the subcategory select
- Changing the category clears the subcategory
- Filtered by `kind` according to the entry type
- **When editing, pass `?includeId=<uuid>` to fetch the referenced inactive category**, displayed with an "(inactive)" suffix
- An inactive category cannot be chosen for a new entry, only retained during an edit
- Text search within the select

### Acceptance criteria
- [ ] The subcategory select enables only after a category is chosen
- [ ] Changing the category clears the selected subcategory
- [ ] An expense entry does not list income categories
- [ ] Editing an entry with an inactive category shows the current value marked "(inactive)"
- [ ] Inactive categories are absent from the list for a new entry
- [ ] Search filters the options

### Tests
- Unit: dependency between selects; clearing on change; `kind` filtering
- Integration with MSW: the inactive-category edit scenario

---

## M5-T03 — Income and expense form

### Why this is needed
The most-used entry path. It concentrates the `isCreditCard` rule.

### Implementation notes
- Dialog using React Hook Form + Zod
- Fields: type, date, account, category, subcategory, description, amount, notes
- A "credit card" checkbox revealing the reference-month picker
- Checking the box suggests the following month as the reference
- Masked currency input converted to cents on submit
- A "save and add another" action that keeps account and category filled in
- Optimistic update through TanStack Query, with rollback on error
- Backend validation errors mapped onto the corresponding form fields

### Acceptance criteria
- [ ] Income and expense can be created successfully
- [ ] Required fields are validated before submission
- [ ] The credit card checkbox reveals the month picker and suggests the next month
- [ ] `isCreditCard` is persisted and shows as checked when editing
- [ ] "Save and add another" keeps the dialog open with context preserved
- [ ] An amount of "1.234,56" is sent as `123456`
- [ ] Backend errors appear on the matching field
- [ ] A failed mutation rolls back the optimistic update

### Tests
- Unit: validation; currency conversion; checkbox behaviour
- Integration with MSW: creation; editing preserving `isCreditCard`; backend error; rollback

---

## M5-T04 — Cashbox operations form

### Why this is needed
Different enough from the expense form that it does not belong there: no category, cashbox selection, and a balance rule.

### Implementation notes
- Dialog with three modes: deposit, withdrawal, cashbox transfer
- Deposit: source account plus destination cashbox
- Withdrawal: source cashbox plus destination account
- Transfer: source cashbox plus destination cashbox (no account)
- Current balance of the selected cashbox shown live
- A client-side warning when the amount exceeds the balance, without blocking submission — the decision belongs to the backend
- The backend 409 is surfaced with the available balance

### Acceptance criteria
- [ ] All three modes create the correct transaction
- [ ] Visible fields change according to the mode
- [ ] The selected cashbox's balance is displayed
- [ ] An amount above the balance shows a warning before submission
- [ ] The 409 shows a clear message including the available amount
- [ ] Transfer mode shows no account selector

### Tests
- Integration with MSW: each mode; balance display; 409 handling

---

## M5-T05 — Editing and deleting entries

### Why this is needed
Closes the entry lifecycle. Kept separate from creation because it involves pre-loading and confirmation.

### Implementation notes
- Row-level edit action opening the form matching the transaction type
- Pre-filled form, using `?includeId` on selects for inactive entities
- Deletion through `ConfirmDialog` showing the description and amount
- Invalidation of both the listing and the balances after a mutation
- Success toast with an undo action (recreates the record within a short window)

### Acceptance criteria
- [ ] Editing opens the correct form for each type
- [ ] Fields are pre-filled, including `isCreditCard`
- [ ] Deletion asks for confirmation identifying the entry
- [ ] Balances and totals update after the operation
- [ ] Undo restores the deleted entry

### Tests
- Integration with MSW: editing each type; deletion with confirmation; cache invalidation; undo

---

## M5-T06 — Balance panel

### Why this is needed
Immediate feedback that entries are correct. It is what makes the system trustworthy.

### Implementation notes
- Component shown at the top of the monthly tab and on the cashboxes screen
- One card per account with its current balance
- One card per cashbox with its balance and a progress bar when `targetAmount` is set
- Consolidated total (accounts plus cashboxes)
- Data from `GET /accounts/balances` and `GET /cashboxes/balances`
- Short `staleTime`; invalidated after any transaction mutation
- Skeleton while loading
- Adds the "Saldo atual" column to the accounts screen list (M3-T07), which shipped without it —
  `GET /accounts/balances` did not exist yet (`prototypes/approved/03-accounts.html`)

### Acceptance criteria
- [ ] Balances shown per account and per cashbox
- [ ] The progress bar appears only when a goal is set
- [ ] The consolidated total is correct
- [ ] Balances refresh after creating, editing or deleting an entry
- [ ] Negative balances are visually highlighted
- [ ] A skeleton shows while loading
- [ ] The accounts screen list shows a "Saldo atual" column sourced from this endpoint

### Tests
- Integration with MSW: rendering; refresh after mutation; conditional progress bar; negative formatting
