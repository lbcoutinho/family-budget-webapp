import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './server';

// `onUnhandledRequest: 'error'` turns a typo'd path into a failing test rather than a request that
// quietly leaves jsdom and hangs.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Testing Library does not auto-clean between tests under Vitest's globals, so unmount and
// clear the DOM after each one to keep tests isolated. Request handlers are per-test for the
// same reason.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
