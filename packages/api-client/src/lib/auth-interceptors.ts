import { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { type SessionDto } from '../generated/model';

import { endSession, getAccessToken, setAccessToken } from './auth-session';

// Access tokens live 15 minutes (ADR-0011), so without this the user would be thrown back to the
// login screen four times an hour. A 401 is treated as "the token aged out": refresh once, replay
// the request, and only give up if the refresh cookie is gone too.

const REFRESH_PATH = '/auth/refresh';

/**
 * Endpoints whose 401 must be shown to the caller instead of triggering a refresh: on `login` it
 * means the password is wrong, and on `refresh` it means the session really is over — retrying
 * either would be the first step of an infinite loop.
 */
const NO_REFRESH_PATHS = [REFRESH_PATH, '/auth/login'];

/** A request carries this flag once it has been replayed, so it can never trigger a second refresh. */
interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  retriedAfterRefresh?: boolean;
}

/**
 * The refresh in flight, shared by every request waiting on it. Module scope rather than a field
 * on the instance because there is exactly one instance and exactly one session.
 */
let pendingRefresh: Promise<string | null> | null = null;

/**
 * Wire the access token into every outgoing request, and transparent renewal into every 401.
 * Called once, when the axios instance is created.
 */
export function installAuthInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    const token = getAccessToken();

    if (token !== null) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableRequestConfig | undefined;

      if (error.response?.status !== 401 || !config || config.retriedAfterRefresh === true || isExemptFromRefresh(config.url)) {
        throw error;
      }

      // Set before awaiting: whatever the refresh does, this request gets one replay and no more.
      config.retriedAfterRefresh = true;

      const token = await refreshOnce(instance);

      if (token === null) {
        // The session is already ended and the app already notified — surface the original 401 so
        // the caller sees why its request failed.
        throw error;
      }

      config.headers.set('Authorization', `Bearer ${token}`);

      return instance(config);
    },
  );
}

/**
 * Single-flight refresh. Concurrent 401s all land here, but only the first starts a request; the
 * rest await its result, so three expired requests cost one round trip and one rotated cookie.
 */
function refreshOnce(instance: AxiosInstance): Promise<string | null> {
  pendingRefresh ??= requestRefresh(instance).finally(() => {
    pendingRefresh = null;
  });

  return pendingRefresh;
}

/** Trade the refresh cookie for a new access token, or end the session. Never rejects. */
async function requestRefresh(instance: AxiosInstance): Promise<string | null> {
  try {
    const { data } = await instance.post<SessionDto>(REFRESH_PATH);

    setAccessToken(data.accessToken);

    return data.accessToken;
  } catch {
    // Once per failed refresh rather than once per waiting request, so the app is told the session
    // is over exactly once.
    endSession();

    return null;
  }
}

function isExemptFromRefresh(url: string | undefined): boolean {
  return url !== undefined && NO_REFRESH_PATHS.some((path) => url.startsWith(path));
}
