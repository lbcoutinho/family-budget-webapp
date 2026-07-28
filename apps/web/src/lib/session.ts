import { setSessionExpiredHandler } from '@family-budget/api-client';

/** Where an expired session lands. The route itself arrives with the login screen (M2-T06). */
export const LOGIN_PATH = '/login';

/**
 * A full page load rather than a router navigation: the session is gone, and discarding every
 * cached query and every piece of component state along with it is the point.
 */
function hardNavigate(path: string): void {
  window.location.assign(path);
}

/**
 * Teach the API client where to send the user when a refresh fails. The client stays route-aware
 * of nothing, so the redirect is registered here, once, at startup.
 *
 * `navigate` is a parameter because jsdom makes `window.location.assign` impossible to replace,
 * which would otherwise leave this the one untestable line in the auth flow.
 */
export function installSessionExpiredRedirect(navigate: (path: string) => void = hardNavigate): void {
  setSessionExpiredHandler(() => {
    // Already on the login screen — a silent refresh at startup failing, most likely. Reloading it
    // would only throw away whatever the user has typed.
    if (window.location.pathname === LOGIN_PATH) {
      return;
    }

    navigate(LOGIN_PATH);
  });
}
