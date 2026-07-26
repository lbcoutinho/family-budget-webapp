// Public surface of the generated API client. The `./generated` tree is produced by Orval from the
// API's OpenAPI document (`pnpm gen`) and is never hand-edited; the axios instance below is the one
// hand-written seam, exported so callers can configure interceptors when auth arrives (M2).
//
// Orval's tags-split mode emits no root barrel, so each tag is re-exported here by hand. Add a line
// per new API tag (one folder appears under `generated/` for each). The model index is generated.
export * from './generated/model';
export * from './generated/health/health';

export { axiosInstance } from './lib/axios';
