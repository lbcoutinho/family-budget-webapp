import { axiosInstance, setAccessToken, setSessionExpiredHandler } from '@family-budget/api-client';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOGIN_PATH, installSessionExpiredRedirect } from '@/lib/session';
import { server } from '@/test/server';

// Driven through a real failed refresh rather than by calling the handler directly, so the test
// covers the wiring as well as the decision.
const PROTECTED_URL = '/protected';

afterEach(() => {
  setAccessToken(null);
  setSessionExpiredHandler(null);
  window.history.pushState({}, '', '/');
});

/** A session whose access token is expired and whose refresh cookie is no longer accepted. */
function expiredSession() {
  setAccessToken('expired-token');
  server.use(
    http.get(`/api${PROTECTED_URL}`, () => new HttpResponse(null, { status: 401 })),
    http.post('/api/auth/refresh', () => new HttpResponse(null, { status: 401 })),
  );
}

describe('installSessionExpiredRedirect', () => {
  it('sends the user to the login screen when the session cannot be renewed', async () => {
    const navigate = vi.fn();
    installSessionExpiredRedirect(navigate);
    expiredSession();

    await expect(axiosInstance.get(PROTECTED_URL)).rejects.toThrow();

    expect(navigate).toHaveBeenCalledWith(LOGIN_PATH);
  });

  it('stays put when the login screen is already open', async () => {
    const navigate = vi.fn();
    installSessionExpiredRedirect(navigate);
    window.history.pushState({}, '', LOGIN_PATH);
    expiredSession();

    await expect(axiosInstance.get(PROTECTED_URL)).rejects.toThrow();

    expect(navigate).not.toHaveBeenCalled();
  });
});
