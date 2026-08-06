# M4 — Transactions (API)

**Goal:** the domain core. Transaction model, per-type field validation, cashbox operations and balance calculation.

**Definition of done:** all six transaction types can be created through the API with every invariant enforced, and balances reconcile.

**Depends on:** M3 complete (API side).

> This is the most sensitive milestone in the project. Tasks are split aggressively because a bug here corrupts every report silently.

---

## M4-T01 — `Transaction` model, enums and migration

### Why this is needed
The central table of the system. Keeping the migration separate from business logic allows reviewing the schema without noise.

### Implementation notes
- Enums: `TransactionType`, `TransactionStatus`, `TransactionSource`
- Fields as defined in section 5 of the overview plan, including `isCreditCard`
- **No** `externalHash` (see ADR-0013)
- **No** `fundedByTransactionId` (see ADR-0008)
- All account/cashbox/category foreign keys are nullable — requirements are enforced per type in the service layer
- `cashboxId` and `destinationCashboxId` use `onDelete: SetNull` — deleting a zero-balance cashbox
  (ADR-0019) nulls these on its transactions instead of failing the delete
- `cashboxLabel` and `destinationCashboxLabel` (String, nullable): the cashbox name snapshotted at
  write time, alongside the id columns. The migration backfills both from the referenced cashbox
  (ADR-0019)
- `date` and `referenceMonth` typed as `@db.Date` (no timezone)
- Indexes: `[userId, referenceMonth, status]`, `[userId, type, referenceMonth]`, `[userId, categoryId, referenceMonth]`, `[userId, cashboxId]`
- CHECK constraint via raw SQL: `amount > 0`
- CHECK constraint via raw SQL: `EXTRACT(DAY FROM reference_month) = 1`

### Acceptance criteria
- [ ] Migration applies cleanly
- [ ] A negative `amount` is rejected by the database
- [ ] A `referenceMonth` not on the first of the month is rejected by the database
- [ ] Dates are written and read back without timezone drift
- [ ] Deleting a cashbox sets `cashboxId`/`destinationCashboxId` to `NULL` on its transactions
  without deleting them

### Tests
- Integration: valid insert; rejection of negative `amount`; rejection of invalid `referenceMonth`; date round-trip preserving the day

---

## M4-T02 — Per-type field validator

### Why this is needed
The most important integrity rule in the system, and one that cannot be expressed in the schema. It warrants an isolated task with exhaustive coverage.

### Implementation notes
- `TransactionValidator` under `modules/transactions/validators/`
- A declarative rule table (map of `type → required / forbidden fields`), not a chain of `if/else`
- Rules implemented:
  - required and forbidden state for `accountId`, `destinationAccountId`, `cashboxId`, `destinationCashboxId`, `categoryId`, `subcategoryId`
  - `category.kind` compatible with the transaction type
  - `subcategory.parentId === categoryId`
  - `destinationAccountId ≠ accountId`; `destinationCashboxId ≠ cashboxId`
  - every referenced entity belongs to the same `userId`
  - referenced entities are active (on create and update only)
- Errors return 400 naming the field and the reason

### Acceptance criteria
- [ ] Each of the six types validates its required set correctly
- [ ] Supplying a forbidden field returns 400
- [ ] `INCOME` with an expense category returns 400
- [ ] A subcategory belonging to another parent returns 400
- [ ] An inactive account or category returns 400 on create
- [ ] An entity owned by another user returns 404
- [ ] Source equal to destination returns 400

### Tests
- Unit: the full matrix — for each type, one valid case plus one invalid case per rule. This is the largest test suite in the backend.

---

## M4-T03 — `referenceMonth` and `isCreditCard` rules

### Why this is needed
A subtle rule that, when wrong, makes entries disappear from the monthly tab with no visible error.

### Implementation notes
- On create: when `referenceMonth` is absent, use `startOfMonth(date)`
- When supplied, normalize to the first of the month
- On update, when `date` changes:
  - `isCreditCard = false` → recompute `referenceMonth`
  - `isCreditCard = true` → preserve it
- Unchecking `isCreditCard` during an update recomputes `referenceMonth` from `date`
- All date handling in UTC with no timezone conversion; use `date-fns` on plain dates

### Acceptance criteria
- [ ] Create without `referenceMonth` derives it from `date`
- [ ] A supplied `referenceMonth` is normalized to the first of the month
- [ ] Editing `date` with `isCreditCard = false` recomputes
- [ ] Editing `date` with `isCreditCard = true` preserves
- [ ] Unchecking `isCreditCard` recomputes
- [ ] An entry dated January 31 does not roll into February through timezone conversion

### Tests
- Unit: each scenario above, including month and year boundaries and negative-offset timezones

---

## M4-T04 — Income and expense CRUD

### Why this is needed
The first real consumer of the validator. Scope is limited to `INCOME` and `EXPENSE` to keep the pull request small.

### Implementation notes
- `POST /transactions`, `PATCH /transactions/:id`, `DELETE /transactions/:id`, `GET /transactions/:id`
- In this task only `INCOME` and `EXPENSE` are accepted; other types return 400 temporarily
- `status` defaults to `CONFIRMED`; `source` defaults to `MANUAL`
- Deletion is permanent (a transaction has no history worth preserving)
- Updates cannot change `type`

### Acceptance criteria
- [ ] Income and expense can be created with all required fields
- [ ] Creating without a category or subcategory returns 400
- [ ] Amount, date, description and notes can be edited
- [ ] Changing `type` on update returns 400
- [ ] Deletion removes the record
- [ ] Another user's transaction returns 404

### Tests
- Unit: create, update and delete services
- Integration: CRUD over HTTP; user isolation; 400 validations

---

## M4-T05 — Cashbox operations

### Why this is needed
The product's distinctive mechanic. It gets its own pull request because of the negative-balance rule.

### Implementation notes
- Enable `CASHBOX_IN`, `CASHBOX_OUT` and `CASHBOX_TRANSFER`
- Validate sufficient balance for `CASHBOX_OUT` and `CASHBOX_TRANSFER`, computed inside the same database transaction with an appropriate isolation level
- Return 409 including the available balance when funds are insufficient
- The balance check also runs on **update** — raising the amount of an old withdrawal can drive the balance negative
- `CASHBOX_TRANSFER` does not require `accountId`
- `cashboxLabel`/`destinationCashboxLabel` are set from the referenced cashbox's current name on
  create, and kept in sync whenever `cashboxId`/`destinationCashboxId` change on update — never
  touched by a rename of the cashbox itself (ADR-0019)

### Acceptance criteria
- [ ] A deposit debits the account and credits the cashbox
- [ ] A withdrawal credits the account and debits the cashbox
- [ ] A cashbox transfer references no account
- [ ] A withdrawal above the balance returns 409 stating what is available
- [ ] Editing a withdrawal above the balance returns 409
- [ ] Transferring to the same cashbox returns 400
- [ ] Creating a cashbox transaction snapshots the current cashbox name(s) into
  `cashboxLabel`/`destinationCashboxLabel`
- [ ] Renaming a cashbox does not change the label already stored on its past transactions
- [ ] Changing which cashbox a transaction points to updates its snapshotted label

### Tests
- Unit: sufficient-balance rule, including the update case
- Integration: all three types; negative-balance blocking on both create and update

---

## M4-T06 — Account-to-account transfer

### Why this is needed
Completes the type matrix. Small scope, small pull request.

### Implementation notes
- Enable `TRANSFER` with `accountId` (source) and `destinationAccountId` (destination)
- No category
- No balance validation (a checking account may go negative)
- Never appears in any expense report

### Acceptance criteria
- [ ] A transfer affects both accounts correctly
- [ ] Destination equal to source returns 400
- [ ] Transfers do not appear in the month's expense total
- [ ] Supplying a category returns 400

### Tests
- Unit: distinct-accounts validation
- Integration: effect on balances; absence from the expense report

---

## M4-T07 — Account and cashbox balance endpoints

### Why this is needed
Balances are derived, not stored. The query must be correct and well covered, since it is the main source of the user's trust in the system.

### Implementation notes
- `GET /accounts/balances` and `GET /cashboxes/balances`
- Aggregation in SQL (Prisma `groupBy` or a raw query), never in memory
- Formulas as defined in section 5.4 of the overview plan
- **Mandatory `status = CONFIRMED` filter**
- Optional `?asOf=YYYY-MM-DD` query param for a point-in-time balance
- A default repository scope applying `status = CONFIRMED`, so future queries cannot forget it

### Acceptance criteria
- [ ] Account balance accounts for all five components of the formula
- [ ] Cashbox balance accounts for deposits, withdrawals and transfers in both directions
- [ ] A `DRAFT` transaction affects no balance
- [ ] `?asOf` returns the balance up to the given date
- [ ] An account with no transactions returns its `initialBalance`
- [ ] The computation runs in the database, not in memory

### Tests
- Unit: formulas against constructed data
- Integration: a full scenario covering all six types and asserting final balances; an explicit assertion that `DRAFT` is ignored

---

## M4-T08 — Transaction listing with filters and pagination

### Why this is needed
The foundation of the frontend's monthly tab. Without pagination the screen degrades as history grows.

### Implementation notes
- `GET /transactions` with filters: `referenceMonth`, `dateFrom`/`dateTo`, `type[]`, `status`, `accountId`, `categoryId`, `subcategoryId`, `cashboxId`, `isCreditCard`, `search` (description and notes)
- Cursor pagination, `limit` defaulting to 50 with a maximum of 200
- Ordered by `date desc`, tie-broken by `createdAt desc`
- Response includes `total` and aggregates over the filtered set (income sum, expense sum)
- Relations included selectively (category and account), avoiding N+1
- Default: `status = CONFIRMED` when not specified
- `?cashboxId=` matches the live foreign key only — a transaction whose cashbox was since deleted
  (`cashboxId = NULL`) is excluded, even though `cashboxLabel` still names it; the response's
  `cashboxLabel`/`destinationCashboxLabel` let the frontend display those rows elsewhere without a
  join (ADR-0019)

### Acceptance criteria
- [ ] Filtering by `referenceMonth` returns the correct month
- [ ] Combined filters work together
- [ ] Cursor pagination neither repeats nor skips records
- [ ] A `limit` above 200 is rejected
- [ ] Text search matches description and notes
- [ ] Without a status filter, `DRAFT` records do not appear
- [ ] The listing issues a single query (no N+1)

### Tests
- Unit: building the `where` clause from filters
- Integration: each filter; combinations; paging through every page; default exclusion of `DRAFT`

---

## M4-T09 — Cashbox deletion by zero balance

**Last task of the milestone.** Follow-up to the already-shipped M3-T05, moved here because it
needs the `Transaction` model (M4-T01) and the balance formula (M4-T07), both delivered earlier in
this milestone.

### Why this is needed
ADR-0019 narrows ADR-0015 for `Cashbox` only: a finished cashbox has a zero balance and should be
removable even with entries, instead of staying deactivated forever with its name taken.

### Implementation notes
- Change the cashboxes service delete rule from "blocked when transactions exist" to "blocked when
  the balance is not zero" — 409 otherwise (ADR-0019)
- The balance uses the same formula as `GET /cashboxes/balances`, recomputed inside the delete
  database transaction rather than read beforehand, so a concurrent entry cannot slip past the check
- The `onDelete: SetNull` change on the `Transaction` cashbox relations (`cashboxId`,
  `destinationCashboxId`) belongs to M4-T01, not here

### Acceptance criteria
- [ ] Deleting a zero-balance cashbox with transactions succeeds
- [ ] Deleting a non-zero-balance cashbox returns 409
- [ ] Deleting an untouched cashbox still succeeds

### Tests
- Integration: deleting a zero-balance cashbox with transactions succeeds
- Integration: deleting a non-zero-balance cashbox returns 409 with the current balance
- Integration: deleting an untouched cashbox still succeeds
