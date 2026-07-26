import Axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

// Single axios instance the generated hooks call through. `baseURL: '/api'` matches the API's
// global prefix; in the browser the Vite dev proxy (and the production reverse proxy) forwards
// `/api` to the backend, so requests are always same-origin. Auth interceptors land here in M2.
//
// This file is hand-written and intentionally lives inside the generated package so the client is
// self-contained: `apps/web` depends on `@family-budget/api-client`, never the reverse.
export const axiosInstance = Axios.create({ baseURL: '/api' });

/**
 * Orval mutator. Every generated request funnels through here, returning the unwrapped response
 * body so hooks are typed as `T` rather than `AxiosResponse<T>`.
 */
export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> =>
  axiosInstance(config).then((response: AxiosResponse<T>) => response.data);

// Re-exported so generated code can type errors and request bodies against these aliases.
export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
