import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';

import { AppSidebar } from './app-sidebar';
import { SidebarContext, type SidebarContextValue } from './sidebar-context';

import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { useRecurrenceCatchUp } from '@/features/recurrence/use-recurrence-catch-up';
import { useMediaQuery } from '@/hooks/use-media-query';

/**
 * The frame every route renders inside: the sidebar on the left, the route's own top bar and body
 * on the right. It holds no data of its own — what changes between routes is the content and the
 * top bar's title, never the frame.
 *
 * 900 px is where the sidebar stops being a column and becomes a drawer. The number matches the
 * approved shell prototype and is defined once, as the `shell` breakpoint in `styles/index.css`.
 */
const COMPACT = '(max-width: 899.98px)';

export function AppLayout() {
  const { t } = useTranslation();
  useRecurrenceCatchUp();
  const isCompact = useMediaQuery(COMPACT);
  const [isOpen, setIsOpen] = useState(false);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const { pathname } = useLocation();

  const [lastPathname, setLastPathname] = useState(pathname);

  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => {
    menuTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  }, []);

  // Choosing a destination closes the drawer. Keyed on the route rather than on the click so a
  // navigation from anywhere — a link in the content, the browser's back button — closes it too.
  //
  // Adjusted during render rather than in an effect: the drawer must be gone in the same commit
  // that shows the new route, and an effect would paint it open over the new page first.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  // Widening the window past the breakpoint turns the drawer back into a column; leaving the flag
  // true would spring the scrim back the next time the window narrows.
  if (isOpen && !isCompact) {
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      if (menuTrigger.current?.isConnected) {
        menuTrigger.current.focus();
      }
      wasOpen.current = false;
    }
  }, [isOpen]);

  const sidebar = useMemo<SidebarContextValue>(() => ({ isOpen, isCompact, open, close }), [isOpen, isCompact, open, close]);

  return (
    <SidebarContext value={sidebar}>
      <div className="grid min-h-svh shell:grid-cols-shell">
        <AppSidebar />

        {isCompact && isOpen && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('nav.closeMenu')}
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-30 h-auto w-auto cursor-default rounded-none bg-foreground/35 hover:bg-foreground/35 animate-in fade-in"
          />
        )}

        <div inert={isCompact && isOpen} className="flex min-w-0 flex-col">
          <Suspense fallback={<LoadingSpinner className="min-h-svh" />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </SidebarContext>
  );
}
