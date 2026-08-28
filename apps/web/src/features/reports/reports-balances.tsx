import { useGetBalancesReport, type BalancesReportAccountDto, type BalancesReportCashboxDto } from '@family-budget/api-client';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { ReportsErrorState, ReportsSkeleton } from '@/features/reports/report-shell';
import { formatDate, formatMonthAbbreviation, parseDateOnly } from '@/lib/date';
import { formatCents } from '@/lib/money';

type SnapshotItem = BalancesReportAccountDto | BalancesReportCashboxDto;

function SnapshotCard({ title, total, items, tone }: { title: string; total: number; items: SnapshotItem[]; tone?: 'cashbox' }) {
  const { t } = useTranslation();

  return (
    <section className="border-b p-4 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0" aria-label={title}>
      <p className="text-table-header text-muted-foreground">{title}</p>
      <p className={`num mt-1 font-display text-2xl font-bold ${tone === 'cashbox' ? 'text-cashbox' : ''}`}>{formatCents(total)}</p>
      <div className="mt-3 space-y-1.5 text-table-cell">
        {items.map((item) => (
          <div key={'accountId' in item ? item.accountId : item.cashboxId} className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate font-medium">
              {item.name}
              {!item.isActive ? (
                <Badge variant="outline" className="ml-1.5 align-middle text-badge">
                  {t('reports.balances.inactive')}
                </Badge>
              ) : null}
            </span>
            <span className="num shrink-0">{formatCents(item.balance)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Evolution({
  year,
  months,
}: {
  year: number;
  months: { month: number; accounts: number; cashboxes: number; netWorth: number; inProgress: boolean }[];
}) {
  const { t } = useTranslation();
  const current = months.find((month) => month.inProgress);
  const data = months.map((month) => ({ ...month, label: formatMonthAbbreviation(new Date(year, month.month - 1, 1)) }));

  return (
    <section aria-labelledby="reports-balances-evolution" className="overflow-hidden rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="reports-balances-evolution" className="font-semibold">
            {t('reports.balances.evolutionTitle', { year })}
          </h2>
          <p className="text-report-caption text-muted-foreground">{t('reports.balances.evolutionHint')}</p>
        </div>
        {current ? (
          <Badge variant="outline">{t('reports.balances.inProgress', { month: formatMonthAbbreviation(new Date(year, current.month - 1, 1)) })}</Badge>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <div className="h-report-chart min-w-report-balance-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <RechartsTooltip formatter={(value) => formatCents(Number(value))} />
              <Line type="monotone" dataKey="accounts" name={t('reports.balances.accounts')} stroke="var(--color-transfer)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line
                type="monotone"
                dataKey="cashboxes"
                name={t('reports.balances.cashboxes')}
                stroke="var(--color-cashbox)"
                strokeWidth={2.5}
                strokeDasharray="7 4"
                dot={{ r: 3 }}
              />
              <Line type="monotone" dataKey="netWorth" name={t('reports.balances.netWorth')} stroke="var(--color-foreground)" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-report-caption text-muted-foreground">
        <span>{t('reports.balances.accounts')}</span>
        <span>{t('reports.balances.cashboxes')}</span>
        <span>{t('reports.balances.netWorth')}</span>
      </div>
    </section>
  );
}

export function ReportsBalances({ year }: { year: number }) {
  const { t } = useTranslation();
  const query = useGetBalancesReport({ year });

  if (query.isPending) return <ReportsSkeleton />;
  if (query.isError) return <ReportsErrorState onRetry={() => void query.refetch()} />;

  const { snapshot, currentAccountingClose, futureDatedTransactions, evolution } = query.data;
  const accountsPercent = snapshot.totalNetWorth === 0 ? 0 : Math.round((snapshot.totalAccounts / snapshot.totalNetWorth) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">{t('reports.balances.title')}</h2>
          <p className="text-field text-muted-foreground">{t('reports.balances.intro')}</p>
        </div>
        <span className="text-table-header text-muted-foreground">
          {t('reports.balances.cutoff', { date: formatDate(parseDateOnly(snapshot.cutoffDate)) })}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border lg:grid lg:grid-cols-3">
        <SnapshotCard title={t('reports.balances.accounts')} total={snapshot.totalAccounts} items={snapshot.accounts} />
        <SnapshotCard title={t('reports.balances.cashboxes')} total={snapshot.totalCashboxes} items={snapshot.cashboxes} tone="cashbox" />
        <section className="bg-muted p-4" aria-label={t('reports.balances.netWorth')}>
          <p className="text-table-header text-muted-foreground">{t('reports.balances.netWorth')}</p>
          <p className="num mt-1 font-display text-2xl font-bold">{formatCents(snapshot.totalNetWorth)}</p>
          <div className="mt-3 flex items-center gap-3 text-table-cell">
            <div
              className="size-20 shrink-0 rounded-full"
              role="img"
              aria-label={t('reports.balances.allocationLabel', { accounts: accountsPercent, cashboxes: 100 - accountsPercent })}
              style={{ background: `conic-gradient(var(--color-transfer) 0 ${accountsPercent}%, var(--color-cashbox) ${accountsPercent}% 100%)` }}
            />
            <div className="space-y-1">
              <p>
                {t('reports.balances.accounts')}:{' '}
                <span className="num font-semibold">
                  {formatCents(snapshot.totalAccounts)} · {accountsPercent}%
                </span>
              </p>
              <p>
                {t('reports.balances.cashboxes')}:{' '}
                <span className="num font-semibold">
                  {formatCents(snapshot.totalCashboxes)} · {100 - accountsPercent}%
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-3 rounded-lg border bg-muted p-4 sm:grid-cols-3 sm:items-center" aria-label={t('reports.balances.comparisonTitle')}>
        <div>
          <p className="text-table-header text-muted-foreground">{t('reports.balances.effectivePosition')}</p>
          <p className="num font-display text-xl font-bold">{formatCents(snapshot.totalNetWorth)}</p>
        </div>
        <ArrowRightIcon className="text-muted-foreground max-sm:rotate-90" aria-hidden="true" />
        <div>
          <p className="text-table-header text-muted-foreground">{t('reports.balances.accountingClose')}</p>
          <p className="num font-display text-xl font-bold">{formatCents(currentAccountingClose)}</p>
          <p className="text-report-caption text-muted-foreground">
            {t('reports.balances.futureDated', { value: formatCents(futureDatedTransactions, { sign: true }) })}
          </p>
        </div>
      </section>

      {evolution.hasSufficientHistory ? (
        <Evolution year={year} months={evolution.months} />
      ) : (
        <section className="rounded-lg border border-dashed p-4">
          <h2 className="font-semibold">{t('reports.balances.insufficientTitle', { year })}</h2>
          <p className="mt-1 text-field text-muted-foreground">{t('reports.balances.insufficientDescription')}</p>
        </section>
      )}
    </div>
  );
}
