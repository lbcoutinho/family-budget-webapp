import { axiosInstance, getAccessToken, setAccessToken, setSessionExpiredHandler } from '@family-budget/api-client';
import { HttpResponse, delay, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/server';

// The interceptors under test live in `@family-budget/api-client` (they belong next to the axios
// instance every generated hook calls through), but the web app is where the test infrastructure
// is, and where the behaviour actually matters. Exercised through the package's public surface.

const PROTECTED_URL = '/protected';
const SESSION_USER = { id: 'user-1', email: 'owner@example.com', name: 'Owner' };

/** Counts the refresh round trips a test provoked — the point of the single-flight queue. */
let refreshCalls = 0;

/** Every `Authorization` header the API saw, in order. */
let authHeaders: (string | null)[] = [];

beforeEach(() => {
  refreshCalls = 0;
  authHeaders = [];
});

afterEach(() => {
  setAccessToken(null);
  setSessionExpiredHandler(null);
});

/** A protected endpoint that accepts one token and answers 401 to anything else. */
function protectedEndpoint(acceptedToken: string) {
  return http.get(`/api${PROTECTED_URL}`, ({ request }) => {
    const authorization = request.headers.get('authorization');
    authHeaders.push(authorization);

    return authorization === `Bearer ${acceptedToken}` ? HttpResponse.json({ ok: true }) : new HttpResponse(null, { status: 401 });
  });
}

/** A refresh endpoint that hands out `accessToken`, slowly enough for concurrent 401s to overlap. */
function refreshEndpoint(accessToken: string) {
  return http.post('/api/auth/refresh', async () => {
    refreshCalls += 1;
    await delay(20);

    return HttpResponse.json({ accessToken, user: SESSION_USER });
  });
}

/** A refresh endpoint for a session that is over: the cookie is missing, expired or rejected. */
function expiredRefreshEndpoint() {
  return http.post('/api/auth/refresh', async () => {
    refreshCalls += 1;
    await delay(20);

    return new HttpResponse(null, { status: 401 });
  });
}

describe('auth interceptors', () => {
  it('sends the access token as a bearer header', async () => {
    setAccessToken('valid-token');
    server.use(protectedEndpoint('valid-token'));

    const response = await axiosInstance.get(PROTECTED_URL);

    expect(response.status).toBe(200);
    expect(authHeaders).toEqual(['Bearer valid-token']);
  });

  it('sends no authorization header when there is no session', async () => {
    server.use(protectedEndpoint('valid-token'));

    await expect(axiosInstance.get(PROTECTED_URL)).rejects.toThrow();

    expect(authHeaders[0]).toBeNull();
  });

  it('refreshes and replays the original request on a 401', async () => {
    setAccessToken('expired-token');
    server.use(protectedEndpoint('fresh-token'), refreshEndpoint('fresh-token'));

    const response = await axiosInstance.get(PROTECTED_URL);

    expect(response.data).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(authHeaders).toEqual(['Bearer expired-token', 'Bearer fresh-token']);
    // The renewed token is kept, so the next request does not have to fail first.
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('refreshes once for three concurrent 401s', async () => {
    setAccessToken('expired-token');
    server.use(protectedEndpoint('fresh-token'), refreshEndpoint('fresh-token'));

    const responses = await Promise.all([axiosInstance.get(PROTECTED_URL), axiosInstance.get(PROTECTED_URL), axiosInstance.get(PROTECTED_URL)]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(refreshCalls).toBe(1);
  });

  it('ends the session once when the refresh fails, and reports the original error', async () => {
    const onSessionExpired = vi.fn();
    setSessionExpiredHandler(onSessionExpired);
    setAccessToken('expired-token');
    server.use(protectedEndpoint('fresh-token'), expiredRefreshEndpoint());

    const results = await Promise.allSettled([axiosInstance.get(PROTECTED_URL), axiosInstance.get(PROTECTED_URL), axiosInstance.get(PROTECTED_URL)]);

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect(refreshCalls).toBe(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('does not loop when the replayed request is rejected too', async () => {
    setAccessToken('expired-token');
    // The refresh succeeds, but the token it returns is not the one the endpoint accepts, so the
    // replay comes back 401 as well — the shape an infinite loop would take.
    server.use(protectedEndpoint('some-other-token'), refreshEndpoint('fresh-token'));

    await expect(axiosInstance.get(PROTECTED_URL)).rejects.toMatchObject({ response: { status: 401 } });

    expect(refreshCalls).toBe(1);
    expect(authHeaders).toHaveLength(2);
  });

  it('lets a failed login answer 401 instead of trying to refresh it', async () => {
    server.use(http.post('/api/auth/login', () => new HttpResponse(null, { status: 401 })));

    await expect(axiosInstance.post('/auth/login', { email: 'owner@example.com', password: 'wrong' })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(refreshCalls).toBe(0);
  });

  it('lets a rejected refresh call answer 401 instead of refreshing itself', async () => {
    server.use(expiredRefreshEndpoint());

    await expect(axiosInstance.post('/auth/refresh')).rejects.toMatchObject({ response: { status: 401 } });

    expect(refreshCalls).toBe(1);
  });
});
