# M4 — Transactions (API)

**Goal:** the domain core. Transaction model, per-type field validation, cashbox operations and balance calculation.

**Definition of done:** all six transaction types can be created through the API with every invariant enforced, and balances reconcile.

**Depends on:** M3 complete (API side).

> This is the most sensitive milestone in the project. Tasks are split aggressively because a bug here corrupts every report silently.

---

## M4-T01 — `Transaction` model, enums and migration

Done — see #94.

---

## M4-T02 — Per-type field validator

Done — see #99.

---

## M4-T03 — `referenceMonth` and `isCreditCard` rules

Done — see #100.

---

## M4-T04 — Income and expense CRUD

Done — see #101.

---

## M4-T05 — Cashbox operations

Done — see #102.

---

## M4-T06 — Account-to-account transfer

Done — see #103.

---

## M4-T07 — Account and cashbox balance endpoints

Done — see #104.

---

## M4-T08 — Transaction listing with filters and pagination

Done — see #105.

---

## M4-T09 — Cashbox deletion by zero balance

Done — see #84.

---

## M4-T10 — Cashboxes summary cards

Done — see #89.

---

## Suggested implementation order (remaining tasks)

| Order | Task | Depends on | Why here |
|---|---|---|---|
| 1 | M4-T02 — Per-type field validator | #94 (T01, done) | Every write path (T04–T06) calls this validator; nothing else can start correctly without it |
| 2 | M4-T03 — `referenceMonth`/`isCreditCard` rules | T01 | Standalone date logic consumed by create/update in T04; no dependency on the validator itself, but cheaper to land before the CRUD that uses it |
| 3 | M4-T04 — Income/expense CRUD | T02, T03 | First consumer of both the validator and the date rules; establishes the `POST/PATCH/DELETE/GET /transactions` endpoints that T05–T06 extend |
| 4 | M4-T05 — Cashbox operations | T02, T04 | Extends the CRUD from T04 to the three cashbox types; needs the validator for the new required/forbidden fields and adds the `cashboxLabel` snapshot logic that T08 later filters on (ADR-0019) |
| 5 | M4-T06 — Account-to-account transfer | T02, T04 | Same CRUD extension pattern as T05, smaller scope; order relative to T05 is not strict but keeps the type matrix building incrementally |
| 6 | M4-T07 — Balance endpoints | T04, T05, T06 | Acceptance criteria require asserting balances across all six transaction types, so all types must be creatable first |
| 7 | M4-T08 — Transaction listing (filters/pagination) | T05 | `?cashboxId=` filter semantics interact with the `cashboxLabel` snapshot from T05 (ADR-0019); needs multiple transaction types present to be meaningfully tested |

Matches the file's numeric order — no reordering needed, but T03 could run in parallel with T02 if split across agents (no shared code, both only feed T04).
