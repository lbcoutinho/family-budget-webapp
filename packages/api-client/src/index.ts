// Public surface of the generated API client. The `./generated` tree is produced by Orval from the
// API's OpenAPI document (`pnpm gen`) and is never hand-edited; the axios instance below is the one
// hand-written seam, exported so callers can configure interceptors when auth arrives (M2).
//
// Orval's tags-split mode emits no root barrel, so each tag is re-exported here by hand. Add a line
// per new API tag (one folder appears under `generated/` for each). The model index is generated.
export * from './generated/model';
export * from './generated/accounts/accounts';
export * from './generated/auth/auth';
export * from './generated/cashboxes/cashboxes';
export * from './generated/categories/categories';
export * from './generated/health/health';
export * from './generated/users/users';

export { axiosInstance } from './lib/axios';
// Session state the app owns: it stores the token `login` returns, and says where an expired
// session should land. Renewal itself needs no wiring — the interceptors are already installed.
export { getAccessToken, setAccessToken, setSessionExpiredHandler } from './lib/auth-session';
