# M2 — Authentication

**Goal:** working end-to-end login, with protected routes on both the backend and the frontend.

**Definition of done:** the user logs in through the browser, reaches a protected route, and the token is refreshed automatically when it expires.

**Depends on:** M1 complete.

---

## M2-T01 — `User` model and Prisma setup

### Why this is needed
The first migration in the project. It establishes the conventions every later migration inherits.

### Implementation notes
- ~~**Pre-work — decide the Prisma major (6 vs 7).**~~ Done: Prisma 7 adopted (ADR-0017) and the upgrade landed in its own PR ahead of this ticket. `apps/api` is on `prisma`/`@prisma/client` `^7.9.0` with a `prisma.config.ts`, the `prisma-client` generator emitting CommonJS TypeScript into the git-ignored `src/generated/prisma`, and `PrismaService` connecting through the `@prisma/adapter-pg` driver adapter. What is left below is the `User` model and the scripts.
- `schema.prisma` already carries the PostgreSQL datasource and the client generator; the connection URL lives in `prisma.config.ts`, not in the datasource block
- `User` model: `id` (uuid), `email` (unique), `passwordHash`, `name`, `createdAt`, `updatedAt`
- Convention: models named in singular PascalCase, mapped to snake_case tables via `@@map`
- `db:migrate`, `db:reset` and `db:studio` scripts in the API `package.json`. `db:reset` is run by the user, never by Claude: the Prisma 7 CLI refuses `migrate reset` when it detects an AI agent unless `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` carries the user's verbatim consent
- `tsx` wired up to run the seed

### Acceptance criteria
- [x] Prisma major (6 vs 7) decided; if 7 is adopted, an ADR is recorded and this ticket updated — ADR-0017, upgrade merged separately
- [x] `pnpm --filter api db:migrate` applies the migration
- [x] Prisma Client is generated and typed
- [x] The migration is committed under `prisma/migrations/`
- [x] Naming conventions are documented at the top of `schema.prisma`

### Tests
- Integration: create and read a user through `PrismaService`

---

## M2-T02 — argon2 hashing service and initial user seed

### Why this is needed
Plaintext passwords are unacceptable even in a personal app. The seed enables login without a sign-up screen, which will not exist since the app is single-user. It also creates a second, demo account, so the application can be shown to someone without exposing the real data.

### Implementation notes
- `HashService` wrapping `argon2.hash` and `argon2.verify` (argon2id, default parameters)
- Injectable service, so it can be mocked in auth tests
- `prisma/seed.ts` creating the user from `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`
- The same seed creates a **demo account** on the `+demo` sub-address of `SEED_USER_EMAIL` (`person@example.com` → `person+demo@example.com`) with its own password, `SEED_DEMO_USER_PASSWORD`. The address is derived by appending `+demo` to the local part, never configured as a second variable that could drift; both land in the same mailbox, so there is no second inbox to manage
- Only placeholders reach the repository: `.env.example` documents `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` and `SEED_DEMO_USER_PASSWORD` with dummy values, and the real address lives only in the git-ignored `.env`
- The demo account starts empty — nothing but the `User` row. Filling it with sample transactions is a later ticket, once those entities exist (M4)
- Idempotent seed (`upsert` by email), for both accounts
- Comparison always through `verify`, never by hash equality

### Acceptance criteria
- [ ] `pnpm --filter api db:seed` creates both the main and the demo account
- [ ] The demo account's email is the `+demo` sub-address derived from `SEED_USER_EMAIL`, not a separately configured address
- [ ] The two accounts have different passwords, each hashed independently
- [ ] Running the seed twice neither duplicates nor fails
- [ ] The hash differs on each run (random salt)
- [ ] Neither password appears in logs
- [ ] No real email address is committed — `.env.example` carries placeholders only

### Tests
- Unit: `hash` returns a value different from the input; `verify` returns true for the correct password and false otherwise; the demo address is derived correctly from a range of `SEED_USER_EMAIL` values
- Integration: seed idempotency, for both accounts

---

## M2-T03 — Local login with Passport and JWT issuance

### Why this is needed
The entry point of authentication. Isolated into its own task because it concentrates the security logic.

### Implementation notes
- `AuthModule` with a `LocalStrategy` (`passport-local`, using the `email` field)
- `AuthService.validateUser(email, password)` returning the user without `passwordHash`
- `POST /api/auth/login` guarded by `AuthGuard('local')`
- Short-lived access token (15 minutes) in the response body
- Long-lived refresh token (7 days) in an `httpOnly`, `sameSite: strict` cookie, `secure` in production
- `POST /api/auth/refresh` issuing a new access token
- `POST /api/auth/logout` clearing the cookie
- Generic error message on failed login (never reveal whether the email exists)

### Acceptance criteria
- [ ] Valid credentials return an access token and set the refresh cookie
- [ ] Invalid credentials return 401 with a generic message
- [ ] Refresh with a valid cookie issues a new access token
- [ ] Refresh with a missing or invalid cookie returns 401
- [ ] No response ever contains `passwordHash`

### Tests
- Unit: `AuthService.validateUser` with correct password, wrong password and unknown email
- Integration: full login → refresh → logout flow; assertion of cookie attributes

---

## M2-T04 — Global JWT guard and `@CurrentUser` decorator

### Why this is needed
Makes the secure path the default: every route is protected unless explicitly marked public. The opposite approach — protecting route by route — eventually misses one.

### Implementation notes
- `JwtStrategy` (`passport-jwt`) extracting the token from the `Authorization: Bearer` header
- `JwtAuthGuard` registered as a global `APP_GUARD`
- `@Public()` decorator backed by metadata, checked by the guard
- Apply `@Public()` to `/health`, `/auth/login` and `/auth/refresh`
- `@CurrentUser()` decorator extracting the authenticated user from the request
- Swagger configured with bearer auth so endpoints can be tried from the UI

### Acceptance criteria
- [ ] A new route without any decorator requires a token by default
- [ ] A route marked `@Public()` is reachable without a token
- [ ] An expired token returns 401
- [ ] A token with an invalid signature returns 401
- [ ] `@CurrentUser()` supplies the authenticated user in controllers

### Tests
- Unit: the guard allows access when `@Public()` metadata is present
- Integration: protected route without a token → 401; with a valid token → 200; with an expired token → 401

---

## M2-T05 — Axios instance with refresh interceptor

### Why this is needed
Without it the user is logged out every 15 minutes. The interceptor must exist before any screen consumes the API.

### Implementation notes
- `src/lib/axios.ts` with a base instance and `withCredentials: true`
- Request interceptor injecting the access token, held in memory rather than `localStorage`
- Response interceptor: on 401, call `/auth/refresh` and replay the original request
- **Request queue**: multiple concurrent 401s trigger a single refresh; the rest wait for its result
- A failed refresh clears state and redirects to `/login`
- Loop protection: an already-replayed request does not trigger another refresh

### Acceptance criteria
- [ ] Authenticated requests carry the `Authorization` header
- [ ] A 401 transparently triggers refresh and replays the original request
- [ ] Three concurrent 401s trigger exactly one refresh
- [ ] A failed refresh redirects to login
- [ ] No infinite refresh loop is possible

### Tests
- Unit with MSW: transparent refresh; single-refresh concurrency; failure redirect; absence of loops

---

## M2-T06 — Login screen and route protection

### Why this is needed
Closes the end-to-end flow and validates the whole auth infrastructure in practice.

### Implementation notes
- `features/auth/` containing `LoginPage`, `useAuth` and `AuthProvider`
- Form built with React Hook Form + Zod (valid email, non-empty password)
- shadcn components (`Card`, `Input`, `Label`, `Button`)
- `ProtectedRoute` in React Router redirecting to `/login` when unauthenticated
- On application load, a silent refresh attempt restores the session
- Loading state while the session is being verified, to avoid a flash of the login screen
- Credential errors shown inline in the form; network errors shown as a toast

### Acceptance criteria
- [ ] Valid credentials redirect to the home screen
- [ ] Invalid credentials show an error without clearing the typed email
- [ ] A protected route without a session redirects to `/login`
- [ ] Reloading the page keeps the session (silent refresh)
- [ ] No flash of the login screen during initial verification
- [ ] Logout clears the session and redirects

### Tests
- Unit: form validation; loading and error states
- Integration with MSW: successful login; failed login; session restoration on mount; protected-route redirect
