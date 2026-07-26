import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library does not auto-clean between tests under Vitest's globals, so unmount and
// clear the DOM after each one to keep tests isolated.
afterEach(() => {
  cleanup();
});
