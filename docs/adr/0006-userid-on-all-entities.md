# ADR-0006 — `userId` on every domain entity

**Status:** Accepted
**Date:** 2026-07-22

## Context

The application is single-user today, but may need to support multiple users sharing one family budget. Adding an ownership column later, with production data in place, is expensive and risky.

There is also an immediate technical reason: `CASHBOX_TRANSFER` transactions reference no account. If ownership were derived from the account, those transactions would be orphaned.

## Decision

Every domain entity (`Account`, `Category`, `Cashbox`, `Transaction`, `RecurrenceRule`) carries `userId`. Every query filters by it, and an `assertOwnership` helper validates ownership of referenced entities.

Accessing another user's resource returns 404 rather than 403, so as not to disclose existence.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| No ownership column | Painful future migration; cashbox transfers would have no owner |
| Deriving ownership by joining `Account` | Fails for `CASHBOX_TRANSFER`; makes every read more expensive |
| PostgreSQL Row Level Security | Configuration complexity out of proportion |
| A `householdId` from the start | An abstraction with no concrete use today |

## Consequences

### Positive
- Isolation guaranteed in every query
- A path to multi-user without structural migration
- Cashbox transfers have an identifiable owner

### Negative
- A redundant column in the current scenario
- Risk of forgetting the filter in a new query

### Risks and mitigations
- A forgotten filter → repositories encapsulate the base `where`; integration tests assert isolation between users
- The back-relations declared on `User` (`transactions`, `recurrenceRules`) exist purely to satisfy Prisma's syntax and **must never be used in an `include`**
