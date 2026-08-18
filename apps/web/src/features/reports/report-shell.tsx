/**
 * The chrome both report views share — expand/collapse state for category rows, the loading
 * skeleton and the error state — factored out once the monthly and yearly views turned out to
 * need the exact same three pieces (their tables, which genuinely differ, stay in each view).
 */

import { AlertCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** Which category/subcategory rows are expanded, keyed by `categoryId ?? 'uncategorized'`. */
export function useExpandedRows(): [ReadonlySet<string>, (key: string) => void] {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return [expanded, toggle];
}

/** Two card-shaped placeholders — one per side (expense/income) — while a report loads. */
export function ReportsSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="space-y-px rounded-lg border p-3">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 3 }, (_, row) => (
            <Skeleton key={row} className="h-11 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ReportsErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={AlertCircleIcon}
      title={t('reports.error.title')}
      description={t('reports.error.description')}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    />
  );
}
