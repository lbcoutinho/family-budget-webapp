# Plan 0003 — Transaction Personal Notes

**Status:** Proposed  
**Last updated:** 2026-08-25

## 1. Goal

Let the user explain a transaction in their own words without replacing the original or imported transaction description. The monthly transaction list can switch between personal notes and real descriptions while remaining useful when a note is absent.

## 2. Existing support

`Transaction.notes` already exists as nullable text with a 1,000-character limit. Transaction create, update, detail, list, generated client, and case-insensitive search already support it. Recurrence rules may copy their note to generated transactions. No API contract or schema change is required for the main feature.

The current web entry form does not expose `notes` and creates optimistic rows with `notes = null`. The monthly list always renders `description` even though list responses already contain `notes`.

## 3. Personal-note editing

The normal transaction dialog exposes an optional, single-line **Personal note** field for income, expense, and transfer transactions on both create and edit.

On desktop, row 4 contains Personal note on the left and Amount on the right. On mobile, Personal note stacks immediately above Amount. The field keeps the existing 1,000-character API limit. Leading and trailing whitespace is removed; an empty value is saved as `null`.

Creating and updating transactions must include the note in the request and optimistic list item. Clearing a saved note sends `null`. Cashbox operation dialogs do not expose notes because their manually entered description already serves as the user's explanation.

Recurring-rule forms remain unchanged. Existing API behavior that copies a rule note to generated transactions remains supported.

## 4. Monthly-list display

The monthly screen defaults to showing personal notes. A visible **Show personal notes** switch sits beside the search field and is not persisted between visits.

- Switch on: show `notes ?? description` as the transaction's primary text.
- Switch off: always show `description`.
- Cashbox operations always show `description`, regardless of the switch or any legacy/API-provided note.

The switch changes only the primary text in transaction rows. Search behavior, delete confirmation, sorting, undo payloads, and other action text continue using the real description and their existing semantics.

## 5. Filters and sorting

To preserve toolbar space, type, category, account, and sorting move into one **Filters and sorting** menu. Search and the personal-note switch remain directly visible.

Inside the menu:

- Each label appears to the left of its selector.
- Type, category, account, and sorting each occupy one aligned row.
- The menu trigger displays the number of active filters, for example **Filters (2)**.
- Only type, category, and account count as filters; sorting does not.
- **Clear filters** appears when at least one filter is active and clears those three filters without changing sorting.

The approved layout is prototype variant B: search and the personal-note switch remain visible while filters and sorting share the menu described above.

## 6. Imported transactions

CSV import continues to copy the bank statement text into `description` and leaves `notes = null`. Imported descriptions remain editable. Editing only a personal note does not affect existing duplicate detection.

Editing an imported description can prevent a later reimport from recognizing the transaction as a duplicate because the current fingerprint includes description. This risk is accepted; stable import identity is outside this plan.

## 7. Installments

New installment transactions stop writing the technical text `Purchased on YYYY-MM-DD` into `notes`. The installment plan already retains its purchase date, and the technical sentence conflicts with the personal-note meaning.

Existing installment transaction notes are not migrated. The user will remove them manually when needed. The installment form's purchase-date field is unchanged by this plan.

## 8. Acceptance criteria

- A user can set, edit, and clear a personal note when creating or editing an income, expense, or transfer.
- Empty or whitespace-only personal notes persist as `null`.
- The desktop and mobile field layouts follow §3.
- Cashbox operation forms remain unchanged and cashbox rows always display their description.
- The monthly list defaults to personal-note mode and falls back to description per row when no note exists.
- Turning the switch off makes every row show its real description.
- The display preference lasts only for the current mounted screen state.
- Search, delete confirmation, sorting, and other transaction actions retain their existing description behavior.
- Filters and sorting use the menu layout and active-filter behavior in §5.
- Imported descriptions remain separate from personal notes and editable.
- New installments no longer place purchase-date metadata in transaction notes.
- Existing technical installment notes remain untouched.
- Recurrence-rule UI and cashbox-note editing remain out of scope.

## 9. Tests

### API

- Update the installment service test to assert that generated installments no longer contain the technical purchase-date note.
- Keep existing transaction create/update/search coverage for nullable notes; add no duplicate coverage for behavior already proven unless an affected test regresses.

### Web

- Create a transaction with a personal note and verify the submitted payload and optimistic row.
- Edit, clear, and reopen a personal note; clearing submits `null`.
- Verify the row uses note, description fallback, and description-only switch states.
- Verify cashbox rows ignore notes in both switch states.
- Verify personal-note mode is the initial state and is not persisted.
- Verify the filter menu labels, active-filter count, clear action, and that sorting is neither counted nor cleared.
- Verify keyboard-accessible names for the switch, menu trigger, filters, sorting, and clear action.

## 10. Future work

- Make the search UI explicitly communicate that the existing backend search matches both descriptions and personal notes.
- Add stable imported-transaction identity only if edited descriptions cause meaningful duplicate-import problems.
- Expose recurrence-rule notes in the recurrence form only when a concrete user need appears.
