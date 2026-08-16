import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  /** `undefined` while there's nothing to show yet — `loading` and `error` decide what fills in. */
  value: string | undefined;
  className?: string;
  loading?: boolean;
  error?: boolean;
}

/** A single label + big-number tile: a skeleton while loading, an em dash on error. Shared by every
 * screen that shows a row of stats (`cashboxes-summary.tsx`, `balance-panel.tsx`). */
export function StatCard({ label, value, className, loading, error }: StatCardProps) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="h-7 w-1/2" /> : <p className={cn('font-display text-2xl font-bold tabular-nums', className)}>{error ? '—' : value}</p>}
    </Card>
  );
}
