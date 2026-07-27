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
Plaintext passwords are unacceptable even in a personal app. The seed enables login without a sign-up screen, which will not exist since the app is single-user.

### Implementation notes
- `HashService` wrapping `argon2.hash` and `argon2.verify` (argon2id, default parameters)
- Injectable service, so it can be mocked in auth tests
- `prisma/seed.ts` creating the user from `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`
- Idempotent seed (`upsert` by email)
- Comparison always through `verify`, never by hash equality

### Acceptance criteria
- [ ] `pnpm --filter api db:seed` creates the user
- [ ] Running the seed twice neither duplicates nor fails
- [ ] The hash differs on each run (random salt)
- [ ] The password never appears in logs

### Tests
- Unit: `hash` returns a value different from the input; `verify` returns true for the correct password and false otherwise
- Integration: seed idempotency

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

---

## M2-T07 — Registration restricted to a single allowed email

### Why this is needed
The account has to be created somehow, but the application is single-user and must never accept a stranger's sign-up. Restricting registration to one configured address makes a sign-up endpoint safe to expose: the password is chosen by the person registering and stored as an argon2 hash, and every other address is refused. Keeping that address in an environment variable also keeps the owner's real email out of the repository. The `+demo` sub-address of the same mailbox gives a second, disposable account for demonstrating the application without exposing personal data — same inbox, no second mail account to manage.

### Implementation notes
- Depends on M2-T02 (`HashService`); the two accounts it creates are what M2-T03 logs in
- `AUTH_ALLOWED_EMAIL` holds the owner's address, validated at boot with the rest of the environment (fail-fast). It is never committed: `.env.example` carries a placeholder such as `you@example.com`
- Exactly two addresses may register: `AUTH_ALLOWED_EMAIL` and its `+demo` sub-address, derived by appending `+demo` to the local part — `person@example.com` accepts `person@example.com` and `person+demo@example.com`, and nothing else. The suffix is derived, never configured separately, so the two can never drift apart
- `POST /api/auth/register`, marked `@Public()`, body `{ email, password, name }` validated with class-validator: valid email, password of at least 8 characters, non-empty name
- Comparison is trimmed and case-insensitive, and the address is stored lowercased, so `Person@…` and `person@…` cannot become two accounts
- Any other address is rejected with `403 Forbidden` and a fixed message — *"Email not accepted"* — identical for every refused address, so the response never reveals which address would work
- Re-registering an address that already has an account returns `409 Conflict`
- The password goes through `HashService`; no response, log or error ever carries `passwordHash` or the plain password
- Once this lands, M2-T02's seed should read `AUTH_ALLOWED_EMAIL` instead of its own `SEED_USER_EMAIL`, so the seed and the endpoint cannot disagree about which account is legitimate. This supersedes M2-T02's premise that no sign-up would exist: the seed stays as the local/CI convenience, registration is how the real account is created
- No web sign-up screen in this task — registration happens through the API (Swagger or `curl`). A UI for it, if ever wanted, is a separate ticket
- No rate limiting: the allow-list holds no secret worth guessing, and a refused address costs a single string comparison

### Acceptance criteria
- [ ] Registering the address in `AUTH_ALLOWED_EMAIL` creates the account and returns it without `passwordHash`
- [ ] Registering the `+demo` sub-address of that same address creates a second, independent account
- [ ] Any other address is refused with 403 and a message that does not reveal the allowed address
- [ ] Registering an address that already has an account returns 409
- [ ] The stored password is an argon2 hash; the plain password appears in no log and no response
- [ ] `AUTH_ALLOWED_EMAIL` is validated at boot, and only a placeholder appears in `.env.example`
- [ ] Both accounts can log in through `POST /api/auth/login`

### Tests
- Unit: the allow-list accepts the configured address and its `+demo` variant in any letter case, and refuses everything else — a different domain, `+demoX`, `+demo` twice, and an address that merely contains the allowed one as a substring
- Integration: register → 201; register the `+demo` address → 201; register a third address → 403; register a duplicate → 409; log in with each of the two accounts
