# Plan 0002 — CSV Transaction Import

**Status:** Proposed
**Last updated:** 2026-08-23

## 1. Goal

Import bank-statement transactions from configurable CSV files without requiring the bank's column layout to match the application model. Every imported transaction remains a draft for manual review and categorization.

## 2. User flow

1. The Transactions screen exposes an **Import CSV** action.
2. Import requires a saved CSV model and one active destination account.
3. When no model exists, the action navigates to Settings › General. The user creates a model there, then returns to the import flow manually.
4. The user selects a model and account, uploads a CSV, and reviews a preview.
5. Valid new rows start selected. The user may deselect them. Duplicate and invalid rows cannot be selected.
6. The user confirms the import. The server revalidates and deduplicates inside one atomic operation.
7. The result shows imported, duplicate, invalid, and user-excluded counts, with expandable row details, plus an action back to Transactions.

## 3. CSV models

CSV models belong to a user and only describe how to read a file. They have no relationship to imported transactions.

Each model stores:

- Name, required and case-insensitively unique per user.
- Header line count, integer from 1 through 100. Lines before the last header line are ignored; the last header line provides column names.
- Separator: comma, semicolon, or tab.
- Exact header names for the transaction date, description, and amount columns.

The date format is fixed to `DD-MM-YYYY`. The amount format is fixed to `3606.87`, with `-` indicating an expense.

Settings › General lists existing models and provides **Create** and **Delete** actions. Creation uses a modal and accepts header names as text; it does not require an example file. Deletion requires confirmation containing the model name. Models cannot be edited, copied, tested, or reordered; a mistaken model is deleted and recreated.

## 4. File contract

- Encoding: UTF-8, with or without BOM.
- Maximum file size: 5 MB.
- Maximum row count: 10,000, including header rows.
- CSV quoting follows conventional CSV rules, including separators and line breaks inside quoted fields.
- Empty physical rows are ignored and do not appear in result counts.
- Extra columns are ignored.
- Missing mapped headers block preview and identify the missing columns.
- A duplicated header blocks preview only when it makes a mapped column ambiguous.
- A file with no transaction rows returns an error.

Each non-empty data row requires:

- A real calendar date matching `DD-MM-YYYY`. Future dates are accepted.
- A non-empty description after trimming leading and trailing whitespace.
- A non-zero amount matching the fixed decimal format. Currency symbols, grouping separators, and alternative decimal formats are invalid.

The parser converts amounts directly to integer cents; floating-point money is never used.

## 5. Transaction mapping

| CSV value | Transaction field |
| --- | --- |
| Selected destination account | `accountId` |
| Date column | `date` |
| Month of date | `referenceMonth`, normalized to the first day |
| Trimmed description | `description` |
| Absolute amount in cents | `amount` |
| Negative amount | `type = EXPENSE` |
| Positive amount | `type = INCOME` |
| Fixed value | `status = DRAFT` |
| Fixed value | `source = IMPORT_CSV` |

Only active accounts may be selected. Category and subcategory remain empty. Imported drafts affect neither balances nor reports under the existing confirmed-only rule.

## 6. Preview and validation

The preview preserves each row's physical line number from the uploaded file.

Rows have one of four outcomes:

- **New:** valid and selected by default; the user may deselect it.
- **Duplicate:** excluded and not selectable.
- **Invalid:** excluded and not selectable; includes a reason.
- **Not selected:** valid, new, and explicitly excluded by the user.

When no row can be imported, the confirmation action is disabled and an informational box explains why.

The preview writes nothing. Confirmation repeats parsing, validation, and duplicate detection on the server and creates all selected transactions atomically. Any write failure creates none.

## 7. Duplicate detection

Compare the upload with every existing transaction for the selected account, regardless of source or status. A duplicate fingerprint contains:

- Account.
- Date.
- Derived transaction type.
- Absolute amount in cents.
- Normalized description: trim outer whitespace, collapse internal whitespace, and compare case-insensitively. Preserve accents and punctuation.

Duplicates use occurrence counts rather than set membership. If two matching transactions exist and the file contains three matching rows, the first two file rows are duplicates and the third is new. This preserves legitimate repeated purchases while preventing reimport of the same statement. Existing occurrences consume uploaded occurrences from top to bottom.

Confirmation serializes duplicate detection and creation for the user's destination account so concurrent imports cannot create duplicates between validation and insertion.

## 8. Result

After confirmation, show:

- `X` transactions imported.
- `Y` duplicate rows ignored.
- `Z` invalid rows ignored.
- `W` valid rows not selected.

Duplicate, invalid, and not-selected groups are expandable. Each entry shows its original line number; invalid entries also show their reason. Links to existing duplicate transactions are out of scope.

Do not persist the uploaded CSV, an import batch, or source line numbers. Persist only `source = IMPORT_CSV` on created transactions.

## 9. Required prototypes

No new screen or state in this feature may be implemented before its prototype is approved under the workflow in [`screens/global-rules.md`](screens/global-rules.md). Create disposable HTML prototypes under `prototypes/` for:

- The Transactions-screen **Import CSV** entry point and import page.
- Model and account selection, file upload, populated preview, invalid/duplicate states, the disabled-confirmation information box, loading/error states, and the final expandable result summary.
- Settings › General model list, empty state, creation modal, validation errors, and deletion confirmation.

Prototype approval must settle desktop and mobile layout, keyboard flow, focus handling, destructive-action confirmation, table/list overflow, and accessible status/error presentation. Approved prototypes become implementation references and are linked from the implementation ticket.

## 10. Acceptance criteria

- A user can create and delete saved CSV models from Settings › General under the constraints in §3.
- Import cannot proceed without a saved model and active destination account.
- A conforming CSV produces a preview without writing transactions.
- Invalid rows identify their line and reason; duplicate rows identify their line.
- The user can deselect valid new rows; invalid and duplicate rows remain unselectable.
- Repeated identical rows in one statement remain importable when existing occurrence counts do not consume them.
- Reimporting the same statement imports zero duplicate occurrences.
- Overlapping statement periods import only occurrences not already present.
- Confirmation revalidates and writes selected rows atomically without a concurrency window for duplicates.
- Every created transaction uses integer cents, the selected account, derived date/reference month/type, `DRAFT`, empty category/subcategory, and `IMPORT_CSV` source.
- The result reports all four outcome counts and exposes required row details.
- The system stores neither the CSV nor import-batch/line metadata.
- All new UI prototypes are approved before frontend implementation begins.

## 11. Tests

### API

- Model ownership, case-insensitive name uniqueness, header-count bounds, supported separators, creation, listing, and deletion.
- UTF-8/BOM parsing, quoted separators and newlines, multi-line headers, extra/missing/ambiguous headers, empty files, size/row limits, strict dates, zero/invalid amounts, and empty descriptions.
- Exact mapping to cents, type, reference month, draft status, empty categories, account ownership/activity, and CSV source.
- Duplicate normalization and occurrence counting against draft, confirmed, manual, and CSV transactions.
- Overlapping-period and concurrent-confirmation cases.
- Atomic rollback when any write fails.

### Web

- No-model navigation to Settings › General.
- Model list, creation validation, and confirmed deletion.
- Import selection, upload failures, preview outcome states, selection behavior, disabled-confirmation explanation, confirmation, expandable result details, and return navigation.
- Keyboard and accessible-name/status/error coverage for new controls.

## 12. Future work — category suggestions

Category suggestions are deliberately outside this delivery but retained as the next import enhancement:

1. Search confirmed historical transactions from the same account by exact normalized description.
2. Suggest category and subcategory only when all relevant matches agree.
3. Keep every imported transaction in `DRAFT`, including transactions with suggestions.
4. Leave categories empty when no unambiguous match exists.
5. Add approximate-description matching only after real import history provides examples and confidence rules can be specified.
