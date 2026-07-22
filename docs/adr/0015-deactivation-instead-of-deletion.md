# ADR-0015 — Deactivation instead of deletion

**Status:** Accepted
**Date:** 2026-07-22

## Context

Categories, accounts and cashboxes fall out of use over time but remain referenced by historical entries. Deleting them would break reports for prior years.

## Decision

`Account`, `Category` and `Cashbox` carry `isActive`. Inactive entities:

- do not appear in selectors for new entries
- remain valid on existing entries
- continue to appear in historical reports

Permanent deletion is allowed only when no transaction references the entity; otherwise the API returns 409.

Transactions, having no history worth preserving, are deleted permanently.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Cascade deletion | Would destroy financial history |
| Soft delete with `deletedAt` | Different semantics: deactivation is reversible and intentional, not removal |
| Forbidding deletion entirely | Would prevent cleaning up a record created by mistake |

## Consequences

### Positive
- Historical reports remain intact
- Records created by mistake can still be removed
- Deactivation is reversible

### Negative
- The interface needs a "show inactive" toggle
- Edit forms must handle references to inactive entities

### Risks and mitigations
- An empty select when editing an entry with a deactivated category, leading the user to save without one → the `?includeId` parameter returns the referenced inactive entity, displayed with an "(inactive)" suffix (M3-T02, M5-T02)
- Deactivating the last active subcategory leaving the parent unusable → blocked with 409 (M3-T04)
