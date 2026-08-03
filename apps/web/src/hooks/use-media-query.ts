import { useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query currently matches, as React state.
 *
 * The shell needs this because the sidebar is two different things either side of 900 px — a fixed
 * column, or a drawer that has to be inert while closed so its links stay out of the tab order.
 * That is a structural difference, not a styling one, so CSS alone cannot express it.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the first render already gets the
 * right answer, so the drawer never flashes open on a phone.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);

      list.addEventListener('change', onChange);

      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    // Server snapshot: nothing is prerendered today, and "desktop" is the honest default for a
    // layout that must not assume a phone.
    () => false,
  );
}
