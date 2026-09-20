import { useGetMonthlyBalance } from '@family-budget/api-client';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { formatCents } from '@/lib/money';

function BalanceCard({ label, value, total = false }: { label: string; value: number | undefined; total?: boolean }) {
  if (!total) {
    return (
      <div className="flex items-baseline justify-between gap-3 py-2.5">
        <p className="min-w-0 truncate text-sm text-muted-foreground" title={label}>
          {label}
        </p>
        <p className="num shrink-0 font-semibold">{value === undefined ? '—' : formatCents(value)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-foreground bg-foreground p-4 text-background shadow-sm">
      <p className="text-xs text-background/70">{label}</p>
      <p className="num mt-1 font-display text-xl font-bold">{value === undefined ? '—' : formatCents(value)}</p>
    </div>
  );
}

/** Historical asset position and account close: intentionally independent from the ledger filters. */
export function MonthBalancePanel({ year, month }: { year: number; month: number }) {
  const { t } = useTranslation();
  const balance = useGetMonthlyBalance({ year, month });

  if (balance.isPending) {
    return (
      <div className="space-y-2" aria-label={t('balances.title')} aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const data = balance.data;
  return (
    <div className="space-y-3">
      <section aria-label={t('balances.title')} className="grid gap-2">
        <div className="divide-y rounded-xl border bg-card px-4 shadow-sm">
          {data?.accounts.map((account) => (
            <BalanceCard key={account.accountId} label={account.name} value={account.balance} />
          ))}
          <BalanceCard label={t('balances.cashboxes')} value={data?.cashboxBalance} />
        </div>
        <BalanceCard label={t('balances.total')} value={data?.netWorth} total />
      </section>
      <section aria-labelledby="monthly-close" className="rounded-xl border bg-muted/70 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="monthly-close" className="font-semibold">
            {t('transactions.monthlyClose')}
          </h2>
          <span className="text-table-header text-muted-foreground">{t('transactions.filtersUnaffected')}</span>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('transactions.previousBalance')}</dt>
            <dd className="num font-semibold">{data ? formatCents(data.previousAccountBalance) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t pt-2 font-display text-base font-bold">
            <dt>{t('transactions.closingBalance')}</dt>
            <dd className="num">{data ? formatCents(data.accountBalance) : '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
