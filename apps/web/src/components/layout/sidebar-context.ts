import { createContext, useContext } from 'react';

export interface SidebarContextValue {
  /** Only ever true below the shell breakpoint; on the desktop the sidebar is not openable. */
  isOpen: boolean;
  /** True when the viewport is narrow enough that the sidebar is a drawer rather than a column. */
  isCompact: boolean;
  open: () => void;
  close: () => void;
}

/**
 * The default is inert rather than a thrown error, unlike `useAuth`: `PageHeader` is a shared
 * component that a test — or a future screen rendered outside the shell — may mount on its own,
 * and the only thing it loses there is a menu button that has nothing to open anyway.
 */
const noop = () => undefined;

export const SidebarContext = createContext<SidebarContextValue>({
  isOpen: false,
  isCompact: false,
  open: noop,
  close: noop,
});

export function useSidebar(): SidebarContextValue {
  return useContext(SidebarContext);
}
