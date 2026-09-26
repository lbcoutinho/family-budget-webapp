import { type InvestmentFlowDto, useListInvestmentFlows } from '@family-budget/api-client';
import { ChevronLeftIcon, ChevronRightIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export function InvestmentFlowPage() {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const flow = useListInvestmentFlows({ year });
  const selected = flow.data?.find((item) => item.month === selectedMonth);
  const hasActivity = flow.data?.some((item) => item.trades.length > 0 || (item.fundingTransfers?.length ?? 0) > 0) ?? false;
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const completed = (flow.data ?? []).filter((item) => !isCurrentYear || item.month <= now.getMonth() + 1);
  const totals = completed.reduce(
    (sum, item) => ({
      investmentPurchaseAmount: sum.investmentPurchaseAmount + item.investmentPurchaseAmount,
      netSales: sum.netSales + item.netSales,
      netInvestmentFlow: sum.netInvestmentFlow + item.netInvestmentFlow,
      tradeFees: sum.tradeFees + item.tradeFees,
      realizedResult: sum.realizedResult + item.realizedResult,
    }),
    { investmentPurchaseAmount: 0, netSales: 0, netInvestmentFlow: 0, tradeFees: 0, realizedResult: 0 },
  );

  return (
    <>
      <PageHeader title={t('investmentFlow.title')} />
      <PageContent className="space-y-4">
        <nav className="flex gap-1 overflow-x-auto border-b" aria-label={t('investmentOverview.sections')}>
          <NavLink to="/investments/overview" className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground">
            {t('investmentOverview.title')}
          </NavLink>
          <NavLink to="/investments/operations" className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground">
            {t('investmentTrades.title')}
          </NavLink>
          <NavLink to="/investments/flow" className="border-b-2 border-foreground px-3 py-2 text-sm font-medium">
            {t('investmentFlow.title')}
          </NavLink>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('investmentFlow.description')}</p>
          <div className="flex items-center gap-1" aria-label={t('investmentFlow.year')}>
            <Button variant="ghost" size="icon-sm" onClick={() => setYear(year - 1)} aria-label={t('investmentFlow.previousYear')}>
              <ChevronLeftIcon />
            </Button>
            <strong className="min-w-12 text-center tabular-nums">{year}</strong>
            <Button variant="ghost" size="icon-sm" onClick={() => setYear(year + 1)} aria-label={t('investmentFlow.nextYear')}>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
        <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">{t('investmentFlow.fundingNote')}</p>
        <Card className="py-0">
          {flow.isPending && (
            <div className="space-y-3 p-6" aria-busy="true">
              <span className="sr-only">{t('common.loading')}</span>
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-7" style={{ width: `${100 - index * 4}%` }} />
              ))}
            </div>
          )}
          {flow.isError && (
            <EmptyState
              icon={TriangleAlertIcon}
              title={t('investmentFlow.error.title')}
              description={t('investmentFlow.error.description')}
              action={<Button onClick={() => void flow.refetch()}>{t('common.retry')}</Button>}
            />
          )}
          {!flow.isPending && !flow.isError && !hasActivity && (
            <EmptyState icon={TriangleAlertIcon} title={t('investmentFlow.empty.title', { year })} description={t('investmentFlow.empty.description')} />
          )}
          {!flow.isPending && !flow.isError && hasActivity && (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px] text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card">{t('investmentFlow.columns.month')}</TableHead>
                    <TableHead className="text-right">{t('investmentFlow.columns.purchases')}</TableHead>
                    <TableHead className="text-right">{t('investmentFlow.columns.sales')}</TableHead>
                    <TableHead className="text-right">{t('investmentFlow.columns.netFlow')}</TableHead>
                    <TableHead className="text-right">{t('investmentFlow.columns.fees')}</TableHead>
                    <TableHead className="text-right">{t('investmentFlow.columns.realized')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flow.data?.map((item) => (
                    <FlowRow
                      key={item.month}
                      item={item}
                      selected={selectedMonth === item.month}
                      locale={i18n.language}
                      future={isCurrentYear && item.month > now.getMonth() + 1}
                      onSelect={() => setSelectedMonth(item.month)}
                    />
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="border-t-2 bg-muted/50 font-medium">
                    <TableCell className="sticky left-0 bg-muted/50">{t('investmentFlow.total', { month: completed.length })}</TableCell>
                    <Amount value={totals.investmentPurchaseAmount} />
                    <Amount value={totals.netSales} />
                    <Amount value={totals.netInvestmentFlow} tone />
                    <Amount value={totals.tradeFees} />
                    <Amount value={totals.realizedResult} tone />
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          )}
        </Card>
        {selected && <FlowDetails flow={selected} year={year} locale={i18n.language} />}
      </PageContent>
    </>
  );
}

function FlowRow({
  item,
  selected,
  locale,
  future,
  onSelect,
}: {
  item: InvestmentFlowDto;
  selected: boolean;
  locale: string;
  future: boolean;
  onSelect: () => void;
}) {
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2026, item.month - 1));
  if (future)
    return (
      <TableRow className="text-muted-foreground">
        <TableCell className="sticky left-0 z-10 bg-card font-medium">{month}</TableCell>
        {Array.from({ length: 5 }, (_, index) => (
          <TableCell key={index} className="text-right">
            —
          </TableCell>
        ))}
      </TableRow>
    );
  return (
    <TableRow className={cn(selected && 'bg-muted/50')}>
      <TableCell className="sticky left-0 z-10 bg-card font-medium">
        <Button variant="link" className="h-auto p-0 text-inherit" onClick={onSelect} aria-expanded={selected}>
          {month}
        </Button>
      </TableCell>
      <Amount value={item.investmentPurchaseAmount} />
      <Amount value={item.netSales} />
      <Amount value={item.netInvestmentFlow} tone />
      <Amount value={item.tradeFees} />
      <Amount value={item.realizedResult} tone />
    </TableRow>
  );
}

function Amount({ value, tone = false }: { value: number; tone?: boolean }) {
  return (
    <TableCell className={cn('text-right tabular-nums', tone && value > 0 && 'text-income', tone && value < 0 && 'text-destructive')}>
      {formatCents(value)}
    </TableCell>
  );
}

function FlowDetails({ flow, year, locale }: { flow: InvestmentFlowDto; year: number; locale: string }) {
  const { t } = useTranslation();
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, flow.month - 1));
  return (
    <section aria-label={t('investmentFlow.operationsFor', { month, year })} className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-display text-lg">{t('investmentFlow.operationsFor', { month, year })}</h2>
        <p className="text-sm text-muted-foreground">{t('investmentFlow.operationsDescription')}</p>
      </div>
      {flow.trades.map((trade) => (
        <div key={trade.id} className="grid gap-1 border-t pt-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:gap-4">
          <span>
            <strong>
              {new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit' }).format(new Date(trade.executedAt))}
            </strong>{' '}
            · {trade.accountName} · {trade.disposedQuantity} {trade.disposedInstrumentCode} → {trade.acquiredQuantity} {trade.acquiredInstrumentCode}
          </span>
          <span className="tabular-nums">
            {t('investmentTrades.columns.value')}: {formatCents(trade.executionValue)}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {t('investmentFlow.columns.fees')}: {trade.feeValue === null ? '—' : formatCents(trade.feeValue)}
          </span>
        </div>
      ))}
      {flow.fundingTransfers?.map((transfer) => (
        <div key={transfer.id} className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
          <span>
            {t('investmentFlow.funding')} · {transfer.sourceAccountName} → {transfer.destinationAccountName}
          </span>
          <span>{t('investmentFlow.excluded')}</span>
        </div>
      ))}
      {flow.trades.length === 0 && (flow.fundingTransfers?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">{t('investmentFlow.noOperations')}</p>
      )}
    </section>
  );
}
