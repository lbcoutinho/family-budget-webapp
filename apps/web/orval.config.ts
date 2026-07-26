import { defineConfig } from 'orval';

// Generates the typed React Query client from the API's exported OpenAPI document. Output lands in
// the `@family-budget/api-client` package (excluded from lint/format) rather than in `apps/web`, so
// the client is a shared, self-contained artifact. Run via `pnpm gen` from the repo root, which
// first refreshes `apps/api/openapi.json`.
export default defineConfig({
  familyBudget: {
    input: '../api/openapi.json',
    output: {
      mode: 'tags-split',
      // One folder per API tag under `generated/`; `packages/api-client/src/index.ts` is the
      // hand-written barrel that re-exports each tag (Orval's tags-split emits no root barrel).
      target: '../../packages/api-client/src/generated',
      schemas: '../../packages/api-client/src/generated/model',
      client: 'react-query',
      // Orval v8 defaults to a fetch-style client (two-arg calls); the axios client matches the
      // single `AxiosRequestConfig` signature of the `customInstance` mutator below.
      httpClient: 'axios',
      // Wipe stale files first so a removed endpoint disappears from the client and CI's
      // `git diff --exit-code` stays honest.
      clean: true,
      indexFiles: true,
      override: {
        // Every request funnels through the hand-written axios instance in the same package.
        mutator: {
          path: '../../packages/api-client/src/lib/axios.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
