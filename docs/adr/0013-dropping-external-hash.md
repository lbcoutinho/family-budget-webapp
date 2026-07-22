# ADR-0013 — Dropping `externalHash` for deduplication

**Status:** Accepted
**Date:** 2026-07-22

## Context

The model included an `externalHash` field, computed from date, amount and normalized description, with a unique constraint, to prevent re-reading part of a bank statement from creating duplicate entries.

## Decision

The field and its unique index were removed. Deduplication happens during manual draft review.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| `externalHash` with a unique constraint | Would block legitimate duplicates |
| `externalHash` without a unique constraint, for warnings only | The warning can be produced by comparing date and amount, with no extra column |
| Deduplication by time window | An arbitrary heuristic producing false positives |

## Consequences

### Positive
- Legitimate duplicates remain possible: two €3.50 coffees on the same day are two real expenses
- One fewer column and one fewer index
- Human review is more reliable than a hash because it sees context

### Negative
- No automatic protection against reprocessing the same portion of a statement
- Depends on the user's attention during review

### Risks and mitigations
- Duplication through inattention → the review screen flags possible duplicates by comparing date and amount against existing entries in the month, without blocking approval (M8-T04)
