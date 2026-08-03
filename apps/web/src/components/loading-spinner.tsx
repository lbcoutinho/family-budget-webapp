import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  /** Announced to screen readers, and shown beside the spinner unless `labelHidden`. */
  label?: string;
  labelHidden?: boolean;
  className?: string;
}

/**
 * The one busy indicator. It is deliberately not a skeleton: skeletons are worth their complexity
 * on a screen whose shape is known in advance, and that decision belongs to each screen rather
 * than to the shell.
 *
 * `<output>` rather than a `div` with `role="status"` — same semantics, and it is what the login
 * screen already uses for the session check.
 */
export function LoadingSpinner({ label = 'Carregando…', labelHidden = false, className }: LoadingSpinnerProps) {
  return (
    <output className={cn('flex items-center justify-center gap-2 text-sm text-muted-foreground', className)}>
      <Loader2Icon className="size-4 animate-spin text-primary" aria-hidden="true" />
      <span className={cn(labelHidden && 'sr-only')}>{label}</span>
    </output>
  );
}
