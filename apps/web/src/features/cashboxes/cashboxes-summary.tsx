import { useListCashboxBalances, useListTransactions } from '@family-budget/api-client';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/stat-card';
import { formatDateOnly, formatMonthName, startOfMonth } from '@/lib/date';
import { formatCents } from '@/lib/money';

export interface CashboxesSummaryProps {
  month: Date;
  activeCount: number;
}

/** The four `.stat` cards atop the cashboxes screen: how many are active, what moved in/out of
 * them this month, and what they hold in total. Purely a display of two queries — the page owns
 * `month` and `activeCount` (the latter already fetched for the grid below, no point asking twice). */
export function CashboxesSummary({ month, activeCount }: CashboxesSummaryProps) {
  const { t } = useTranslation();
  const monthName = formatMonthName(month);

  const balances = useListCashboxBalances();
  const movements = useListTransactions({
    referenceMonth: formatDateOnly(startOfMonth(month)),
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
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label={t('cashboxes.summary.activeCount')} value={String(activeCount)} />
      <StatCard
        label={t('cashboxes.summary.depositedIn', { month: monthName })}
        value={movements.data ? formatCents(movements.data.cashboxInTotal, { sign: true }) : undefined}
        className="text-primary"
        loading={isLoading}
        error={isError}
      />
      <StatCard
        label={t('cashboxes.summary.withdrawnIn', { month: monthName })}
        value={withdrawn !== undefined ? formatCents(withdrawn, { sign: true }) : undefined}
        className="text-destructive"
        loading={isLoading}
        error={isError}
      />
      <StatCard
        label={t('cashboxes.summary.totalSaved')}
        value={totalSaved !== undefined ? formatCents(totalSaved) : undefined}
        className="text-cashbox"
        loading={isLoading}
        error={isError}
      />
    </div>
  );
}
