/**
 * jsdom ships no `window.matchMedia`, and the shell asks it whether the sidebar is a column or a
 * drawer. This installs one that answers from a predicate, so a test can say "this is a phone" by
 * naming the query it wants to match rather than by faking a window width nothing reads.
 *
 * Installed for every test by `setup.ts`, answering "no match" — which is the desktop layout.
 */
export function stubMatchMedia(matches: (query: string) => boolean): void {
  window.matchMedia = (query: string) =>
    ({
      matches: matches(query),
      media: query,
      onchange: null,
      // Nothing in a test resizes the window, so a listener would never fire anyway.
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/** The desktop answer: no query matches, so the sidebar is a fixed column. */
export const NO_MATCH = () => false;

/** The phone answer: the shell's `max-width` query matches, so the sidebar is a drawer. */
export const COMPACT_VIEWPORT = (query: string) => query.includes('max-width');
