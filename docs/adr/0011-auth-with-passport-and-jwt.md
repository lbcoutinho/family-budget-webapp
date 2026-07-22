# ADR-0011 — Authentication with Passport and JWT

**Status:** Accepted
**Date:** 2026-07-22

## Context

A single-user application needing username and password login. There is no public sign-up, password recovery or social login.

## Decision

`@nestjs/passport` with `passport-local` for login and `passport-jwt` for protected routes. Passwords hashed with argon2id.

A 15-minute access token returned in the response body and held in memory on the frontend. A 7-day refresh token in an `httpOnly`, `sameSite: strict` cookie.

`JwtAuthGuard` registered globally: every route is protected by default, and public routes are marked with `@Public()`.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| A hand-rolled guard without Passport | Would diverge from the official NestJS documentation |
| Better Auth / Auth.js | Ships sign-up, 2FA and recovery, none of which will be used |
| Database-backed sessions | Would require a session store; JWT suffices at this scope |
| bcrypt | argon2id is the current OWASP recommendation |
| Access token in `localStorage` | Vulnerable to XSS |

## Consequences

### Positive
- The ecosystem standard, with abundant documentation and examples
- A new route is protected from birth, so protection cannot be forgotten
- An httpOnly refresh cookie reduces XSS exposure

### Negative
- The in-memory token is lost on page reload, requiring a silent refresh at startup
- Access token revocation is not immediate (a 15-minute window)

### Risks and mitigations
- Concurrent 401s triggering parallel refreshes → a request queue in the interceptor (M2-T05)
- CSRF against the refresh endpoint → `sameSite: strict` on the cookie
