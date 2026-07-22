# ADR-0010 — Self-referencing category with two levels

**Status:** Accepted
**Date:** 2026-07-22

## Context

The system needs categories and subcategories, capped at two levels, and the ability to deactivate them without losing history.

## Decision

A single `Category` table with a self-referencing `parentId`. The two-level maximum is enforced in the service layer (`parent.parentId` must be null).

Category and subcategory are **required on `INCOME` and `EXPENSE`**, and absent on all other types.

Creating a root category automatically creates an "Other" subcategory.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Two separate tables | Would duplicate CRUD, validation and endpoints; more joins in reports |
| Unlimited depth | Complicates reports and the interface with no benefit |
| Category required on **all** types | Would force artificial categories for transfers and deposits, recreating the problem ADR-0007 solves |
| Optional subcategory | Would leave "no subcategory" gaps in reports |

## Consequences

### Positive
- One CRUD, one endpoint, one interface component
- Reports have guaranteed level-2 granularity
- Deactivation cascades naturally through the self-relation

### Negative
- The schema accepts deep trees; the constraint exists only in the service
- Every category needs at least one active subcategory to be usable
- Deactivating the last active subcategory has to be blocked

### Risks and mitigations
- `NULL != NULL` in PostgreSQL prevents enforcing uniqueness on root categories via `@@unique` → a partial index in raw SQL (M3-T03)
- A deactivated category referenced by an old entry disappearing from the select on edit → the `?includeId` parameter (M3-T02, M5-T02)
