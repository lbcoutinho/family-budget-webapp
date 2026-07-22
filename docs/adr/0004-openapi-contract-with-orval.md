# ADR-0004 — API contract via OpenAPI and Orval

**Status:** Accepted
**Date:** 2026-07-22

## Context

Frontend and backend must agree on request and response types. Hand-writing types on the frontend causes silent divergence whenever the backend changes.

The initial proposal was to share Zod schemas across both sides. With NestJS selected (ADR-0002), the framework's standard is `class-validator`, and keeping Zod alongside it would create two sources of truth.

## Decision

The backend is the source of truth. `@nestjs/swagger` produces the OpenAPI document from the DTOs, and Orval generates the TypeScript client with TanStack Query hooks into `packages/api-client`.

Zod remains on the frontend for form validation only.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Shared Zod schemas | Conflicts with `class-validator`, the NestJS standard |
| Hand-written types | Diverge silently |
| tRPC | Couples both sides; loses OpenAPI documentation |
| openapi-generator-cli | Requires Java; output is more verbose and less idiomatic |

## Consequences

### Positive
- A DTO change breaks frontend TypeScript in exactly the right place
- TanStack Query hooks generated automatically
- Interactive documentation at `/api/docs` for free

### Negative
- An extra generation step (`pnpm gen`) in the workflow
- Two validation libraries in the project (class-validator on the backend, Zod on the frontend)

### Risks and mitigations
- A stale generated client → a CI step fails when `pnpm gen` produces a diff
