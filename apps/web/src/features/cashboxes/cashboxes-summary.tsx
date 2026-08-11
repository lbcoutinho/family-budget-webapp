import { useListCashboxBalances, useListTransactions } from '@family-budget/api-client';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMonthName, startOfMonth } from '@/lib/date';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface CashboxesSummaryProps {
  month: Date;
  activeCount: number;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** The four `.stat` cards atop the cashboxes screen: how many are active, what moved in/out of
 * them this month, and what they hold in total. Purely a display of two queries — the page owns
 * `month` and `activeCount` (the latter already fetched for the grid below, no point asking twice). */
export function CashboxesSummary({ month, activeCount }: CashboxesSummaryProps) {
  const { t } = useTranslation();
  const monthName = formatMonthName(month);

  const balances = useListCashboxBalances();
  const movements = useListTransactions({
    referenceMonth: toDateOnly(startOfMonth(month)),
    type: ['CASHBOX_IN', 'CASHBOX_OUT'],
    limit: 1,
  });

  const isLoading = balances.isPending || movements.isPending;
  const isError = balances.isError || movements.isError;

  const totalSaved = balances.data?.filter((cashbox) => cashbox.isActive).reduce((sum, cashbox) => sum + cashbox.balance, 0);
  // The API sums CASHBOX_OUT as a positive total; negated here because the card shows it as money
  // leaving the cashboxes, with the same minus-sign convention as an EXPENSE row.
  const withdrawn = movements.data ? -movements.data.cashboxOutTotal : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label={t('cashboxes.summary.activeCount')} value={String(activeCount)} />
      <Stat
        label={t('cashboxes.summary.depositedIn', { month: monthName })}
        value={movements.data ? formatCents(movements.data.cashboxInTotal, { sign: true }) : undefined}
        className="text-primary"
        loading={isLoading}
        error={isError}
      />
      <Stat
        label={t('cashboxes.summary.withdrawnIn', { month: monthName })}
        value={withdrawn !== undefined ? formatCents(withdrawn, { sign: true }) : undefined}
        className="text-destructive"
        loading={isLoading}
        error={isError}
      />
      <Stat
        label={t('cashboxes.summary.totalSaved')}
        value={totalSaved !== undefined ? formatCents(totalSaved) : undefined}
        className="text-cashbox"
        loading={isLoading}
        error={isError}
      />
    </div>
  );
}

interface StatProps {
  label: string;
  /** `undefined` while there's nothing to show yet — `loading` and `error` decide what fills in. */
  value: string | undefined;
  className?: string;
  loading?: boolean;
  error?: boolean;
}

function Stat({ label, value, className, loading, error }: StatProps) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="h-7 w-1/2" /> : <p className={cn('font-display text-2xl font-bold tabular-nums', className)}>{error ? '—' : value}</p>}
    </Card>
  );
}
