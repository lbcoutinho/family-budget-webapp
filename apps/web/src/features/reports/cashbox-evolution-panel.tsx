/**
 * The cashbox evolution panel — `11-reports-charts.html`'s bottom block (M6-T05, #185), kept apart
 * from the expense charts above it in `ReportsPage`: cashbox deposit/withdrawal is not income or
 * expense, and this panel says so in text rather than leaving the separation implicit
 * (`prototypes/memory/11-charts.md`). Reads `GET /reports/cashboxes?year=` — its own query, not a
 * client-side reshape of the monthly/yearly report endpoints the charts above already fetch.
 */
import { useGetCashboxesReport, type CashboxesReportCashboxDto } from '@family-budget/api-client';
import { PiggyBankIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';

import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { paletteColor } from '@/features/reports/category-color';
import { ReportsErrorState, ReportsSkeleton } from '@/features/reports/report-shell';
import { Legend, TooltipCard, useHiddenSeries } from '@/features/reports/reports-charts';
import { formatMonthAbbreviation } from '@/lib/date';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface CashboxEvolutionPanelProps {
  year: number;
}

interface CashboxSeries {
  key: string;
  color: string;
  cashbox: CashboxesReportCashboxDto;
}

function ProgressCell({ closingBalance, targetAmount }: { closingBalance: number; targetAmount: number | null }) {
  const { t } = useTranslation();

  if (targetAmount === null) {
    return <span className="text-xs text-muted-foreground">{t('reports.cashboxes.noTarget')}</span>;
  }

  const percent = Math.min(100, Math.max(0, Math.round((closingBalance / targetAmount) * 100)));

  return (
    <div className="flex items-center gap-2">
      <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent">
        <div className="h-full rounded-full bg-cashbox" style={{ width: `${percent}%` }} />
      </div>
      <span className="num flex-none whitespace-nowrap text-xs text-muted-foreground">
        {t('reports.cashboxes.progress', { percent, target: formatCents(targetAmount) })}
      </span>
    </div>
  );
}

export function CashboxEvolutionPanel({ year }: CashboxEvolutionPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useGetCashboxesReport({ year });
  const [hidden, toggle] = useHiddenSeries();

  const series: CashboxSeries[] = useMemo(
    () =>
      (query.data?.cashboxes ?? []).map((cashbox) => {
        const key = cashbox.cashboxId ?? `label:${cashbox.name}`;
        return { key, color: paletteColor(key), cashbox };
      }),
    [query.data],
  );

  const chartData = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => {
        const point: Record<string, number | string | null> = { monthIndex, label: formatMonthAbbreviation(new Date(2000, monthIndex, 1)) };
        for (const { key, cashbox } of series) point[key] = cashbox.months[monthIndex]?.balance ?? null;
        return point;
      }),
    [series],
  );

  if (query.isPending) return <ReportsSkeleton />;
  if (query.isError) return <ReportsErrorState onRetry={() => void query.refetch()} />;

  return (
    <section aria-labelledby="reports-cashboxes-evolution" className="overflow-hidden rounded-lg border p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 id="reports-cashboxes-evolution" className="font-semibold">
          {t('reports.cashboxes.title', { year })}
        </h2>
        <Badge variant="outline" className="text-cashbox">
          {t('reports.cashboxes.badge')}
        </Badge>
      </div>
      <p className="mb-4 max-w-[72ch] text-[12.5px] text-muted-foreground">{t('reports.cashboxes.warning')}</p>

      {series.length === 0 ? (
        <EmptyState icon={PiggyBankIcon} title={t('reports.empty.title')} description={t('reports.empty.description')} />
      ) : (
        <div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  content={({ active, label, payload }) => {
                    if (!active || !payload?.length) return null;
                    const rows = payload
                      .filter((entry) => typeof entry.value === 'number')
                      .map((entry) => {
                        const found = series.find((candidate) => candidate.key === entry.dataKey);
                        return {
                          name: found?.cashbox.name ?? String(entry.dataKey),
                          color: found?.color ?? String(entry.color),
                          amount: entry.value as number,
                        };
                      });
                    if (rows.length === 0) return null;
                    return <TooltipCard rows={rows} total={String(label)} />;
                  }}
                />
                {series
                  .filter(({ key }) => !hidden.has(key))
                  .map(({ key, color }) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2.2} dot={{ r: 3 }} connectNulls={false} />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend items={series.map(({ key, color, cashbox }) => ({ key, name: cashbox.name, color }))} hidden={hidden} onToggle={toggle} />

          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>{t('reports.cashboxes.cashbox')}</TableHead>
                <TableHead className="text-right">{t('reports.cashboxes.deposits')}</TableHead>
                <TableHead className="text-right">{t('reports.cashboxes.withdrawals')}</TableHead>
                <TableHead className="text-right">{t('reports.cashboxes.closingBalance', { month: formatMonthAbbreviation(new Date(year, 11, 1)) })}</TableHead>
                <TableHead className="min-w-[170px]">{t('reports.cashboxes.target')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map(({ key, color, cashbox }) => (
                <TableRow key={key}>
                  <TableCell>
                    {cashbox.cashboxId ? (
                      <button type="button" className="flex items-center gap-2 font-medium hover:underline" onClick={() => void navigate('/cashboxes')}>
                        <span className="size-2.5 flex-none rounded-sm" style={{ background: color }} />
                        {cashbox.name}
                      </button>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 flex-none rounded-sm" style={{ background: color }} />
                        {cashbox.name}
                        <Badge variant="outline">{t('reports.monthly.deletedCashbox')}</Badge>
                      </span>
                    )}
                    {cashbox.isActive === false && <Badge variant="outline">{t('cashboxes.inactiveBadge')}</Badge>}
                  </TableCell>
                  <TableCell className={cn('num text-right', cashbox.deposits > 0 && 'text-cashbox')}>
                    {cashbox.deposits === 0 ? '—' : formatCents(cashbox.deposits)}
                  </TableCell>
                  <TableCell className={cn('num text-right', cashbox.withdrawals > 0 && 'text-cashbox')}>
                    {cashbox.withdrawals === 0 ? '—' : formatCents(cashbox.withdrawals)}
                  </TableCell>
                  <TableCell className="num text-right text-cashbox">{formatCents(cashbox.closingBalance)}</TableCell>
                  <TableCell>
                    <ProgressCell closingBalance={cashbox.closingBalance} targetAmount={cashbox.cashboxId ? cashbox.targetAmount : null} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
