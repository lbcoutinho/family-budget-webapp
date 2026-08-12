# API

NestJS REST API using Prisma 7 and PostgreSQL 16.

## Architecture

- Keep controllers thin.
- Business logic belongs in services.
- Database access uses Prisma.
- Validate input at API boundaries.
- API contracts are exposed through OpenAPI.
- Changes to API contracts may require regenerating `@family-budget/api-client`.

## Prisma

- Schema: `prisma/schema.prisma`.
- Migrations live under `prisma/migrations/`.
- Create one migration per schema-changing task.
- Never edit an existing committed migration.
- Never run `prisma migrate reset`; database reset is a human-only action.
- Prisma generated sources under `src/generated/prisma` are generated code and must never be edited manually.

## Database

PostgreSQL 16.

- Development: port 5432.
- Tests: port 5433.

Database configuration comes from the validated environment.

Do not put a connection URL directly in `schema.prisma`.

## Testing

- Jest for unit tests.
- Supertest for HTTP/integration tests.
- Test observable behavior rather than implementation details.

## TypeScript

Strict TypeScript is enabled.

`@typescript-eslint/no-floating-promises` is critical.

Always:

- await promises; or
- explicitly mark intentionally ignored promises with `void`.

## API changes

When an endpoint or schema changes:

1. Update API implementation.
2. Update OpenAPI contract.
3. Determine whether the generated API client is affected.
4. Tell the user if `pnpm gen` must be run.

Never manually edit `packages/api-client`.
