// Client-side session state: the access token, and what to do once it can no longer be renewed.
//
// The token is a module-scoped variable and nothing else — no `localStorage`, no `sessionStorage`
// (ADR-0011: anything readable by a script on the page is readable by an injected one). It is lost
// on reload by design; what survives is the httpOnly refresh cookie, which the interceptor trades
// for a new access token.

let accessToken: string | null = null;

/** Called when the session is over: the refresh token is missing, expired or rejected. */
type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

/** The current access token, or `null` when there is no session. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Store the token returned by `login` or `refresh`. `null` clears it. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Register what happens when the session ends — in practice, a redirect to the login screen.
 * Passing `null` unregisters. This package deliberately knows nothing about the app's routes, so
 * `apps/web` supplies the navigation (see `apps/web/src/lib/session.ts`).
 */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
}

/**
 * Drop the token and notify the app. Package-internal: called from the response interceptor when a
 * refresh fails, and only once per failed refresh, so a burst of 401s cannot fire a burst of
 * redirects.
 */
export function endSession(): void {
  accessToken = null;
  sessionExpiredHandler?.();
}
