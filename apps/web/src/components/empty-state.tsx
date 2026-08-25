import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  /** What the user can do about it. One sentence — the empty state teaches, it does not document. */
  description?: string;
  /** Usually the same primary action the top bar offers, repeated where the eye already is. */
  action?: ReactNode;
  className?: string;
}

/**
 * A list with nothing in it yet. The rule the design system sets is that absence needs no caption
 * — so this is used where the user can act, not merely to say "vazio": a filtered list that came
 * back empty says so in a line of text instead of borrowing this.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('grid place-items-center gap-2 rounded-lg border border-dashed border-border px-5 py-12 text-center', className)}>
      {Icon && <Icon className="size-6 text-muted-foreground/70" aria-hidden="true" />}
      <p className="font-display font-semibold tracking-tight">{title}</p>
      {description && <p className="max-w-empty-state text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
