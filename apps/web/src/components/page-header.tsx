import { MenuIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useSidebar } from '@/components/layout/sidebar-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** The route's context — "Contas", "Julho de 2026". Never the application's name. */
  title: ReactNode;
  /** The route's primary action, or its filters. Left out entirely when the route has neither. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The bar at the top of every route. It belongs to the task, not to the navigation: the user and
 * the way out live at the foot of the sidebar instead, so this never competes with the primary
 * action for the width where it is scarcest.
 *
 * Sticky and translucent, so the action stays reachable down a long list — which is also the
 * reason the phone gets no floating button.
 */
export function PageHeader({ title, actions, className }: PageHeaderProps) {
  const { t } = useTranslation();
  const { isCompact, open } = useSidebar();

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/92 px-3.5 py-2.5 backdrop-blur-md shell:px-[22px] shell:py-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Above the breakpoint the sidebar is a fixed column, so the button has nothing to open
            and does not render at all. */}
        {isCompact && (
          <Button variant="ghost" size="icon-sm" onClick={open} aria-label={t('nav.openMenu')}>
            <MenuIcon />
          </Button>
        )}
        {/* A composed title carries its own controls — truncating it would clip their popovers. */}
        <h1 className={cn('font-display text-[1.05rem] font-bold tracking-[-0.02em]', typeof title === 'string' ? 'truncate' : 'min-w-0')}>{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * The body below that bar. It lives beside `PageHeader` rather than in a file of its own because
 * the two are one decision — where a route's content starts, and how wide it is allowed to get.
 */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('w-full max-w-[1120px] px-3.5 pt-4 pb-10 shell:p-[22px]', className)}>{children}</main>;
}
