# 01 — Login (`/login`)

**Ticket:** M2-T06

| Action | Result |
| --- | --- |
| Submit credentials | Access token in memory, refresh cookie, redirect to `/month` |
| Failed submit | Inline generic error; the typed email is preserved |

No sign-up, no password reset, no "remember me" — single user created by the seed, and the session
already restores itself from the refresh cookie. On load, the silent refresh runs behind a
verifying state, never behind the login form, so the form never flashes.
