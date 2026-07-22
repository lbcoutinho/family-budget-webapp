# M1 — Foundation

**Goal:** get the repository ready for development: monorepo configured, tooling in place, CI running, local database available, and both applications booting with an end-to-end health check.

**Definition of done:** `pnpm dev` starts API and web; `pnpm test` passes; CI is green on a pull request.

---

## M1-T01 — Set up pnpm monorepo with workspaces

### Why this is needed
Backend and frontend need to share the generated client (`packages/api-client`) and a common TypeScript configuration. Without a workspace, this degrades into manually copying files.

### Implementation notes
- `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- Root `package.json` with orchestrating scripts (`dev`, `build`, `lint`, `test`, `typecheck`)
- `tsconfig.base.json` at the root with `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`
- Each app extends the base config
- `.nvmrc` pinning the Node version (22 LTS)
- `.gitignore` covering `node_modules`, `dist`, `.env`, `coverage`

### Acceptance criteria
- [ ] `pnpm install` at the root installs dependencies for every workspace
- [ ] `pnpm -r typecheck` runs across all packages
- [ ] Folder structure from the overview plan is created (with `.gitkeep` where empty)
- [ ] Root README documents local setup

### Tests
Not applicable (configuration). Validation happens via CI in M1-T06.

---

## M1-T02 — Configure ESLint, Prettier, Husky and lint-staged

### Why this is needed
Code style standardized from the first commit. Fixing style after 5,000 lines have been written produces huge, useless diffs.

### Implementation notes
- ESLint flat config (`eslint.config.js`) at the root, with per-workspace overrides
- Plugins: `@typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`
- `eslint-config-prettier` last, to disable conflicting rules
- Prettier `.prettierrc`: `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`
- Husky `pre-commit` hook running `lint-staged`
- `lint-staged`: ESLint `--fix` plus Prettier on staged files
- Enable `@typescript-eslint/no-floating-promises` (critical in NestJS)

### Acceptance criteria
- [ ] `pnpm lint` runs across all workspaces without errors
- [ ] A commit with a lint error is blocked by the hook
- [ ] `pnpm format` formats the whole repository
- [ ] Generated code (`packages/api-client`) is listed in `.eslintignore` and `.prettierignore`

### Tests
Not applicable.

---

## M1-T03 — Docker Compose with PostgreSQL and environment validation

### Why this is needed
A reproducible database environment and fail-fast behaviour on missing configuration. An app that boots with an undefined `DATABASE_URL` and crashes on the first query is worse than one that refuses to boot.

### Implementation notes
- `docker-compose.yml` with a `postgres:16-alpine` service, named volume, port 5432
- A second `postgres_test` database on port 5433 for integration tests
- `.env.example` committed, listing every key with placeholder values
- `apps/api/src/config/env.validation.ts` validating at boot with `class-validator`
- Initial keys: `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`, `CORS_ORIGIN`
- `@nestjs/config` with `isGlobal: true` and `validate` pointing at the validation function

### Acceptance criteria
- [ ] `docker compose up -d` starts both databases
- [ ] The API refuses to start when a required variable is missing, naming the variable
- [ ] `.env` is git-ignored; `.env.example` is committed

### Tests
- Unit: `env.validation.spec.ts` — accepts a complete object, rejects a missing `DATABASE_URL`, rejects a non-numeric `PORT`

---

## M1-T04 — Bootstrap the NestJS API with a health check

### Why this is needed
The foundation every module is built on, plus an endpoint proving that the application and the database are up.

### Implementation notes
- `nest new` into `apps/api`, removing the scaffolded sample files
- Global `PrismaModule` with a `PrismaService` implementing `OnModuleInit` (`$connect`)
- Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Global exception filter mapping known Prisma errors (P2002, P2025) to appropriate HTTP responses
- `nestjs-pino` as the logger, redacting `authorization` and `password`
- `GET /health` returning `{ status, db }`, where `db` runs `SELECT 1`
- Global route prefix `/api`
- CORS configured from `CORS_ORIGIN`

### Acceptance criteria
- [ ] `pnpm --filter api dev` starts on the configured port
- [ ] `GET /api/health` returns 200 with the database connected
- [ ] A payload with an unknown field is rejected with 400
- [ ] Logs are structured and never leak passwords or tokens

### Tests
- Integration: `health.e2e-spec.ts` — 200 when the database is up
- Unit: exception filter maps P2002 → 409 and P2025 → 404

---

## M1-T05 — Bootstrap the frontend with Vite, Tailwind and shadcn/ui

### Why this is needed
The visual and build foundation of the frontend. Installing shadcn/ui after components exist means reworking their styling.

### Implementation notes
- `pnpm create vite` into `apps/web` (`react-ts` template)
- Tailwind CSS v4 configured
- `shadcn` init with the base theme; install initial components: `button`, `input`, `label`, `card`, `dialog`, `select`, `table`, `sonner`
- `@/` alias pointing at `src/` (in both `tsconfig` and `vite.config.ts`)
- `providers.tsx` with `QueryClientProvider` and `Toaster`
- React Router with a placeholder route
- Vite dev proxy for `/api` → backend, avoiding local CORS
- Vitest + Testing Library + jsdom configured

### Acceptance criteria
- [ ] `pnpm --filter web dev` starts and renders the landing page
- [ ] A shadcn component renders with styling applied
- [ ] `pnpm --filter web test` runs
- [ ] `pnpm --filter web build` produces a bundle with no type errors

### Tests
- Unit: smoke test rendering the App inside the providers

---

## M1-T06 — GitHub Actions CI pipeline

### Why this is needed
Keeps broken code out of `main`. It is the safety net that makes the small-PR rule sustainable.

### Implementation notes
- `ci.yml` triggered on `pull_request` and on `push` to `main`
- Single job with sequential steps: install (with pnpm cache) → lint → typecheck → test
- `postgres:16-alpine` service container for integration tests
- A step running `prisma migrate deploy` against the test database before tests
- Concurrency group cancelling stale runs for the same pull request

### Acceptance criteria
- [ ] A pull request with a lint error fails CI
- [ ] A pull request with a type error fails CI
- [ ] A pull request with a failing test fails CI
- [ ] The full run completes in under 5 minutes
- [ ] Branch protection requiring green CI is enabled on `main`

### Tests
Not applicable (the workflow is its own validation).

---

## M1-T07 — OpenAPI to TypeScript client pipeline with Orval

### Why this is needed
Removes hand-written types and HTTP calls from the frontend, and makes TypeScript fail in the right place when a backend DTO changes.

### Implementation notes
- `@nestjs/swagger` configured in `main.ts`, serving `/api/docs`
- Script `pnpm --filter api openapi:export` producing `openapi.json` without starting the server (using `SwaggerModule.createDocument` in a standalone context)
- `orval.config.ts` in `apps/web` using `tags-split` mode, the `react-query` client, output into `packages/api-client`
- Custom instance pointing at `src/lib/axios.ts`
- Root script `pnpm gen` chaining export and generation
- CI step verifying the generated client is up to date (`git diff --exit-code` after running `pnpm gen`)

### Acceptance criteria
- [ ] `pnpm gen` produces types and hooks from the health check endpoint
- [ ] A generated hook is consumed in the frontend with correct typing
- [ ] CI fails when the generated client is stale relative to the DTOs
- [ ] `packages/api-client` is excluded from linting and formatting

### Tests
- Integration: a test loading the OpenAPI document and asserting the expected paths exist
