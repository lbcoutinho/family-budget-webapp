# M7 — Recurrence and installments

**Goal:** long-running fixed expenses (insurance, financing) and installment purchases generated automatically.

**Definition of done:** the user defines a rule once and the entries appear in the correct months, without duplication.

**Depends on:** M5 complete.

---

## M7-T01 — `RecurrenceRule` model and migration

### Why this is needed
Open-ended recurrence and installments are the same problem — a template that produces entries. `totalOccurrences` distinguishes the two cases.

### Implementation notes
- `RecurrenceRule` model as defined in section 5 of the overview plan
- `Frequency` enum: `MONTHLY`, `YEARLY`
- Null `totalOccurrences` means open-ended; a value means installments
- `generatedUntil` records how far generation has run, guaranteeing idempotency
- `autoConfirm` decides whether generated entries start as `CONFIRMED` or `DRAFT`
- `installmentNumber` and `installmentTotal` already exist on `Transaction` (M4-T01)
- `Transaction.recurrenceRuleId` uses `onDelete: SetNull` — deleting a rule must not delete history

### Acceptance criteria
- [ ] Migration applies cleanly
- [ ] Deleting a rule preserves the generated transactions with a null `recurrenceRuleId`
- [ ] `totalOccurrences` accepts null

### Tests
- Integration: rule creation; deletion preserving transactions

---

## M7-T02 — Idempotent generation service

### Why this is needed
The heart of the milestone. Without idempotency, running the job twice duplicates every fixed expense for the month.

### Implementation notes
- `RecurrenceGeneratorService.generate(rule, until)`
- Computes occurrences between `generatedUntil` (or `startDate`) and `until`
- **Idempotency through two independent guards**: `generatedUntil` advanced within the same database transaction, plus a unique index on `(recurrenceRuleId, referenceMonth)`
- Handling for a `dayOfMonth` larger than the month: fall back to the last day (31 in February becomes 28 or 29)
- Honours `endDate` and `totalOccurrences`
- Inactive rules generate nothing
- Values are copied from the rule onto the transaction — **editing a rule never alters entries already generated**
- `referenceMonth` derived from the occurrence date
- Generated transactions carry `source = RECURRING`

### Acceptance criteria
- [ ] Running twice in a row produces no duplicates
- [ ] `dayOfMonth = 31` generates the 28th in February
- [ ] `endDate` stops generation
- [ ] `totalOccurrences` caps the count
- [ ] An inactive rule generates nothing
- [ ] Editing a rule's amount leaves past entries unchanged
- [ ] `autoConfirm = false` produces `DRAFT` entries
- [ ] A failure mid-generation leaves no inconsistent state

### Tests
- Unit: occurrence calculation (month rollovers, leap years, day 31, yearly frequency)
- Integration: double execution; termination by `endDate` and `totalOccurrences`; history immutability; rollback on failure

---

## M7-T03 — Recurrence rules API

### Why this is needed
CRUD for the rules, kept separate from the generation engine to keep pull requests small.

### Implementation notes
- CRUD under `/recurrence-rules`
- `POST /recurrence-rules/:id/generate` for manual generation
- `GET /recurrence-rules/:id/preview?months=` returning upcoming occurrences **without persisting them**
- Deactivation instead of deletion when generated transactions exist
- Validation: `dayOfMonth` between 1 and 31; `endDate` after `startDate`; the rule reuses the M4-T02 validator for account and category

### Acceptance criteria
- [ ] Full CRUD works
- [ ] Preview returns future occurrences without writing anything
- [ ] Manual generation respects idempotency
- [ ] A `dayOfMonth` outside the range returns 400
- [ ] An `endDate` before `startDate` returns 400
- [ ] An inactive category on the rule returns 400

### Tests
- Unit: DTO validations
- Integration: CRUD; preview with no side effects; manual generation

---

## M7-T04 — Installment materialization

### Why this is needed
Installments behave differently from open-ended recurrence: every installment is generated up front so the future commitment is visible.

### Implementation notes
- `POST /recurrence-rules/installment` creating the rule and materializing all N installments in a single database transaction
- As decided: `date` is the expected statement payment date and `referenceMonth` is that same month
- **Description generated automatically** in the format `"{description} ({n}/{total})"`
- **`notes` receives `"Purchased on YYYY-MM-DD"`**, preserving the original purchase date that neither date field retains
- Amount split: the final installment absorbs the remainder of the integer division in cents, so the sum matches the total exactly
- Cancelling an installment plan removes only future, unconfirmed installments

### Acceptance criteria
- [ ] Ten installments are generated across ten consecutive reference months
- [ ] The installments sum exactly to the total amount
- [ ] €100.00 in three installments produces 33.33 / 33.33 / 33.34
- [ ] Descriptions are numbered correctly
- [ ] The purchase date is recorded in `notes`
- [ ] Cancellation removes only future installments
- [ ] A failure during creation leaves no orphaned installments

### Tests
- Unit: cent division with remainders (multiple amounts and counts)
- Integration: full creation; exact sum; partial cancellation; atomicity

---

## M7-T05 — Generation job with a rolling horizon

### Why this is needed
Automates materialization of open-ended recurrences without writing infinite entries to the database.

### Implementation notes
- `@nestjs/schedule` with a daily cron
- A three-month forward horizon
- Also triggered on demand when opening a month that has not been materialized
- Structured logging of the outcome (rules processed, entries created)
- A failure on one rule does not stop the others
- A simple lock preventing concurrent execution

### Acceptance criteria
- [ ] The job generates entries up to three months ahead
- [ ] Repeated runs produce no duplicates
- [ ] A failing rule is logged and the rest continue
- [ ] Opening a future month triggers on-demand generation
- [ ] Concurrent execution is prevented

### Tests
- Unit: orchestration with failing rules
- Integration: job execution; horizon verification; absence of duplication

---

## M7-T06 — Recurrence screen

### Why this is needed
The interface for managing rules and creating installment plans.

### Implementation notes
- `/recurrences` route listing active and inactive rules
- Rule form: description, amount, account, category, frequency, day of month, start, end, `autoConfirm`
- A separate installment form: total amount, number of installments, first payment date, purchase date
- Preview of upcoming occurrences before saving
- Visual marker on the monthly tab for entries generated by a rule
- A manual generate action

### Acceptance criteria
- [ ] An open-ended monthly rule can be created
- [ ] An installment plan can be created with a preview of its installments
- [ ] The preview updates as fields change
- [ ] Generated entries are identifiable on the monthly tab
- [ ] Deactivating a rule stops further generation
- [ ] Manual generation works

### Tests
- Integration with MSW: creating both kinds; reactive preview; deactivation
