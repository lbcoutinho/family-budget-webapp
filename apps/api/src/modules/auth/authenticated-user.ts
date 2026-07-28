/**
 * Who a request belongs to, as `JwtAuthGuard` puts it on `request.user` and `@CurrentUser()`
 * hands it to a controller.
 *
 * Only what the access token carries — the account is *not* re-read from the database on every
 * request. That is the trade-off ADR-0011 already accepts: a revoked account keeps working until
 * its access token expires, at most 15 minutes, and `POST /api/auth/refresh` re-reads the account
 * before minting the next one. Anything richer than an id and an address belongs in a query, not
 * in the guard.
 *
 * `AuthUserDto` (id, email, name) is structurally one of these, so the login route's
 * `request.user` and the guard's satisfy the same contract.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
}
