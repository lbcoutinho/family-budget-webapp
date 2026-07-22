# ADR-0002 — NestJS, Prisma and PostgreSQL on the backend

**Status:** Accepted
**Date:** 2026-07-22

## Context

The backend needs a predictable structure, automatic OpenAPI generation, and transactional integrity for operations that move money between accounts and cashboxes.

## Decision

NestJS as the framework, Prisma as the ORM and PostgreSQL as the database.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Plain Fastify | Less opinionated; structure, DI and OpenAPI generation would have to be assembled by hand |
| Express | Weaker TypeScript support; a more dated ecosystem |
| Drizzle | More explicit SQL, but less mature migrations and tooling than Prisma |
| TypeORM | A history of instability in migrations |
| SQLite | No adequate `NUMERIC` type and concurrency limitations |
| MongoDB | The domain is strongly relational; multi-document transactions are more fragile |

## Consequences

### Positive
- `@nestjs/swagger` produces the OpenAPI document from DTOs, feeding ADR-0004
- Modules, DI and guards define the architecture, reducing arbitrary decisions
- PostgreSQL transactions guarantee atomicity for cashbox operations
- Prisma Client is fully typed from the schema

### Negative
- NestJS has a steeper learning curve than Express
- Prisma adds a generation step to the build
- Decorators require `experimentalDecorators`

### Risks and mitigations
- Complex report queries may exceed Prisma Client's expressiveness → use typed `$queryRaw` in those cases
