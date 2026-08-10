import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { NO_MATCH, stubMatchMedia } from './match-media';
import { server } from './server';

// The real instance, in pt-BR: a test asserting on an accessible name reads the same locale file
// the application does, rather than repeating its wording. Pinned rather than resolved, because
// jsdom reports `navigator.language` as en-US and the suites are written in the default locale.
import i18n, { DEFAULT_LOCALE } from '@/i18n';

// `onUnhandledRequest: 'error'` turns a typo'd path into a failing test rather than a request that
// quietly leaves jsdom and hangs.
beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  await i18n.changeLanguage(DEFAULT_LOCALE);
});

// The shell reads the viewport through `matchMedia`, which jsdom does not implement at all.
stubMatchMedia(NO_MATCH);

// Radix's Tabs primitive measures itself with ResizeObserver, which jsdom does not implement either.
class StubResizeObserver {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}
globalThis.ResizeObserver ??= StubResizeObserver as unknown as typeof ResizeObserver;

// Radix's Select primitive calls these on pointer interaction; jsdom implements neither.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

// Testing Library does not auto-clean between tests under Vitest's globals, so unmount and
// clear the DOM after each one to keep tests isolated. Request handlers are per-test for the
// same reason.
afterEach(async () => {
  cleanup();
  server.resetHandlers();
  // A test that asked for the phone layout must not leave it behind for the next one.
  stubMatchMedia(NO_MATCH);
  // Same for a test that switched language.
  await i18n.changeLanguage(DEFAULT_LOCALE);
});

afterAll(() => {
  server.close();
});
