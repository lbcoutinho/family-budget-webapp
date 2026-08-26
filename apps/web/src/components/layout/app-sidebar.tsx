import { ChevronRightIcon, LogOutIcon, SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

import { NAV_ITEMS, type NavItem, SETTINGS_NAV_ITEMS } from './nav-items';
import { useSidebar } from './sidebar-context';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';

const linkClasses = (isActive: boolean) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sidebar-nav font-normal text-muted-foreground transition-colors',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    isActive ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-muted hover:text-foreground',
  );

/**
 * The navigation, and the only place the session is ended.
 *
 * Below 900 px the same element is a drawer: it slides in over the content, and while it is closed
 * it is `inert`, so its seven links stay out of the tab order instead of sitting off-screen and
 * catching the first Tab. Above it there is no drawer, no menu button and no collapsed mode — 244
 * fixed pixels, because seven items fit by name and an icon alone has to be guessed at.
 */
export function AppSidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { isOpen, isCompact, close } = useSidebar();
  const { pathname } = useLocation();

  const onSettingsRoute = SETTINGS_NAV_ITEMS.some((item) => pathname.startsWith(item.to));
  const [settingsExpanded, setSettingsExpanded] = useState(onSettingsRoute);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Navigating into a registry opens the submenu, so the user never has to reopen the menu they
  // are already inside. Adjusting state during render rather than in an effect keeps it to one
  // pass — and unlike deriving it outright, it leaves the toggle free to close it again.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);

    if (onSettingsRoute) {
      setSettingsExpanded(true);
    }
  }

  return (
    <aside
      inert={isCompact && !isOpen}
      data-open={isOpen}
      className={cn(
        'flex flex-col gap-1 border-r border-border bg-card px-3 py-4',
        // The drawer half: fixed, above the content, and animated in from the left.
        'fixed inset-y-0 left-0 z-40 w-sidebar-drawer -translate-x-full transition-transform duration-ui ease-ui data-[open=true]:translate-x-0',
        // The column half.
        'shell:static shell:z-auto shell:w-auto shell:translate-x-0 shell:transition-none',
      )}
    >
      <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-4 font-display text-headline font-bold tracking-brand">
        {/* The mark is the palette itself — four of the ten category swatches. The application has
            no brand colour, so the only honest logo is made of the colours that mean something. */}
        <span className="inline-grid grid-cols-2 gap-0.5" aria-hidden="true">
          <i className="size-sidebar-mark rounded-mark bg-category-1" />
          <i className="size-sidebar-mark rounded-mark bg-category-3" />
          <i className="size-sidebar-mark rounded-mark bg-category-2" />
          <i className="size-sidebar-mark rounded-mark bg-category-5" />
        </span>
        {t('app.name')}
      </div>

      <nav aria-label={t('nav.mainNav')} className="grid gap-0.5">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.to} item={item} onNavigate={close} />
        ))}

        <Button
          variant="ghost"
          size="sm"
          aria-expanded={settingsExpanded}
          aria-controls="sidebar-settings"
          onClick={() => setSettingsExpanded((expanded) => !expanded)}
          className={cn(linkClasses(false), 'cursor-pointer')}
        >
          <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>{t('nav.settings')}</span>
          <ChevronRightIcon
            className={cn('ml-auto size-4 shrink-0 transition-transform duration-ui-fast', settingsExpanded && 'rotate-90')}
            aria-hidden="true"
          />
        </Button>

        <div id="sidebar-settings" hidden={!settingsExpanded} className="grid gap-0.5 pl-sidebar-submenu">
          {SETTINGS_NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} onNavigate={close} />
          ))}
        </div>
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-border pt-3 text-sidebar-meta">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-sidebar-avatar font-semibold text-background"
        >
          {initials(user?.name)}
        </span>
        <span className="min-w-0 grow">
          <span className="block truncate font-medium">{user?.name}</span>
          <span className="block truncate text-sidebar-avatar text-muted-foreground">{user?.email}</span>
        </span>
        {/* No confirmation: nothing is lost by leaving, and coming back costs a password. */}
        <Button variant="ghost" size="icon-sm" title={t('nav.logout')} aria-label={t('nav.logout')} onClick={() => void logout()}>
          <LogOutIcon />
        </Button>
      </div>
    </aside>
  );
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { t } = useTranslation();
  const Icon = item.icon;

  return (
    <NavLink to={item.to} onClick={onNavigate} className={({ isActive }) => linkClasses(isActive)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}

/** First and last name, or the first two letters of a single name. */
function initials(name: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  if (words.length === 1) {
    return (words[0] ?? '').slice(0, 2).toUpperCase();
  }

  return `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase();
}
