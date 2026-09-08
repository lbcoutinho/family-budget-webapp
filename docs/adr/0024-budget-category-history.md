# ADR-0024 — Budget Category history

**Status:** Accepted
**Date:** 2026-09-08

## Context

Budget allocations reference Categories. A Category can later be renamed or retired, but the Budget remains a historical planning record.

## Decision

Budget allocations retain the Category foreign key. A renamed Category is displayed by its current name. An inactive Category remains visible and editable only in Budgets that already allocate it; it cannot be added to another Budget. Categories referenced by any Budget cannot be deleted.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Snapshot the Category name on each allocation | Renames would not reach existing Budgets. |
| Remove inactive allocations | It would silently change historical planning totals. |

## Consequences

### Positive

- Budget history survives Category lifecycle changes.
- The database prevents deletion from bypassing the application rule.

### Negative

- Editing a historical Budget must accept its existing inactive Categories.

### Risks and mitigations

- An inactive Category supplied for a new allocation could bypass the picker — the API accepts it only when the same Budget already references it.
