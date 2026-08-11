// `create` as a named import rather than `Axios.create`: axios exports both a default and a named
// `create`, and reaching through the default is what `import/no-named-as-default-member` flags.
import { create as createAxios, type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import { installAuthInterceptors } from './auth-interceptors';

// Single axios instance the generated hooks call through. `baseURL: '/api'` matches the API's
// global prefix; in the browser the Vite dev proxy (and the production reverse proxy) forwards
// `/api` to the backend, so requests are always same-origin. `withCredentials` is what makes the
// browser attach the httpOnly refresh cookie to `/api/auth/refresh` and `/api/auth/logout` — the
// only two paths it is scoped to.
//
// This file is hand-written and intentionally lives inside the generated package so the client is
// self-contained: `apps/web` depends on `@family-budget/api-client`, never the reverse.
// `paramsSerializer.indexes: null` serializes array params as repeated `key=a&key=b` instead of
// axios's default `key[]=a&key[]=b` — Express's default query parser doesn't understand bracket
// notation and would otherwise leave the literal key `"type[]"` unparsed.
export const axiosInstance = createAxios({ baseURL: '/api', withCredentials: true, paramsSerializer: { indexes: null } });

// Installed at module load rather than exposed as an `initAuth()` for the app to call: every
// request goes through this instance, so authentication is not something a caller can forget.
installAuthInterceptors(axiosInstance);

/**
 * Orval mutator. Every generated request funnels through here, returning the unwrapped response
 * body so hooks are typed as `T` rather than `AxiosResponse<T>`.
 */
export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => axiosInstance(config).then((response: AxiosResponse<T>) => response.data);

// Re-exported so generated code can type errors and request bodies against these aliases.
export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
