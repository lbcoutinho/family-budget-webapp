import { listTransactions, TransactionStatus, TransactionType, type TransactionListItemDto } from '@family-budget/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import i18n from '@/i18n';
import { formatMonth } from '@/lib/date';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

const NO_CATEGORY_KEY = '__none__';
const NO_CATEGORY_COLOR = 'var(--muted-foreground)';

interface Segment {
  key: string;
  name: string;
  color: string;
  cents: number;
}

export interface DateFilter {
  id: string;
  dateFrom?: string;
  dateTo?: string;
}

interface DayBucket extends DateFilter {
  date: string;
  totalCents: number;
  segments: Segment[];
  transactionCount: number;
}

interface BoundaryBucket extends DateFilter {
  side: 'before' | 'after';
  totalCents: number;
  segments: Segment[];
  transactionCount: number;
}

function localDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function monthFilterParam(referenceMonth: Date): string {
  const year = referenceMonth.getFullYear();
  const month = String(referenceMonth.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}

/** The strip's query key, exported so any mutation that changes a transaction — not just the ones
 * `MonthLedger` itself fires — can invalidate it. Unparameterized: every month's cached data is
 * dropped together, which is cheap next to a create/update/delete actually happening. */
export function getDailyExpensesQueryKey(): readonly [string, string] {
  return ['transactions', 'daily-expenses'];
}

async function fetchMonthlyExpenses(referenceMonthFilter: string, signal: AbortSignal): Promise<TransactionListItemDto[]> {
  const items: TransactionListItemDto[] = [];
  let cursor: string | undefined;

  do {
    const page = await listTransactions(
      { referenceMonth: referenceMonthFilter, status: TransactionStatus.CONFIRMED, limit: 200, ...(cursor ? { cursor } : {}) },
      signal,
    );
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return items;
}

function segmentFor(item: TransactionListItemDto, noCategoryLabel: string): Omit<Segment, 'cents'> {
  return {
    key: item.category?.id ?? NO_CATEGORY_KEY,
    name: item.category?.name ?? noCategoryLabel,
    color: item.category?.color ?? NO_CATEGORY_COLOR,
  };
}

function accumulate(map: Map<string, Segment>, item: TransactionListItemDto, noCategoryLabel: string): void {
  const { key, name, color } = segmentFor(item, noCategoryLabel);
  const existing = map.get(key);
  // The strip only ever lists CONFIRMED transactions (the default `listTransactions` filter), and a
  // CONFIRMED row always has an amount (ADR-0020) — the `?? 0` is type-narrowing, not a real branch.
  const cents = item.amount ?? 0;

  if (existing) {
    existing.cents += cents;
  } else {
    map.set(key, { key, name, color, cents });
  }
}

function byDescendingCents(a: Segment, b: Segment): number {
  return b.cents - a.cents;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: string, days: number): string {
  const result = localDate(date);
  result.setDate(result.getDate() + days);
  return dateKey(result);
}

function chartWindow(referenceMonth: Date, items: TransactionListItemDto[]): { start: string; end: string } {
  const firstExpense = items
    .filter((item) => item.type === TransactionType.EXPENSE && !item.isCreditCard)
    .map((item) => item.date)
    .sort()[0];
  if (firstExpense) return { start: firstExpense, end: addDays(firstExpense, 30) };

  const start = dateKey(new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 1));
  return { start, end: dateKey(new Date(referenceMonth.getFullYear(), referenceMonth.getMonth() + 1, 0)) };
}

function buildDays(start: string, end: string, items: TransactionListItemDto[], noCategoryLabel: string): DayBucket[] {
  const byDate = new Map<string, Map<string, Segment>>();
  for (let date = start; date <= end; date = addDays(date, 1)) byDate.set(date, new Map());

  for (const item of items) {
    if (item.type !== TransactionType.EXPENSE || item.date < start || item.date > end) continue;
    accumulate(byDate.get(item.date)!, item, noCategoryLabel);
  }

  return Array.from(byDate.entries()).map(([date, segmentMap]) => {
    const segments = Array.from(segmentMap.values()).sort(byDescendingCents);
    const totalCents = segments.reduce((sum, segment) => sum + segment.cents, 0);
    return {
      id: date,
      dateFrom: date,
      dateTo: date,
      date,
      totalCents,
      segments,
      transactionCount: items.filter((item) => item.type === TransactionType.EXPENSE && item.date === date).length,
    };
  });
}

function buildBoundary(side: BoundaryBucket['side'], edge: string, items: TransactionListItemDto[], noCategoryLabel: string): BoundaryBucket | null {
  const transactions = items.filter((item) => (side === 'before' ? item.date < edge : item.date > edge));
  if (transactions.length === 0) return null;

  const totals = new Map<string, Segment>();
  for (const item of transactions) if (item.type === TransactionType.EXPENSE) accumulate(totals, item, noCategoryLabel);

  return {
    id: `${side}:${edge}`,
    ...(side === 'before' ? { dateTo: addDays(edge, -1) } : { dateFrom: addDays(edge, 1) }),
    side,
    totalCents: Array.from(totals.values()).reduce((sum, segment) => sum + segment.cents, 0),
    segments: Array.from(totals.values()).sort(byDescendingCents),
    transactionCount: transactions.length,
  };
}

function buildLegend(items: TransactionListItemDto[], noCategoryLabel: string): Segment[] {
  const totals = new Map<string, Segment>();

  for (const item of items) if (item.type === TransactionType.EXPENSE) accumulate(totals, item, noCategoryLabel);

  return Array.from(totals.values()).sort(byDescendingCents);
}

function StripSkeleton() {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border bg-card p-4 shadow-xs">
      <h2 className="mb-2.5 font-semibold">{t('transactions.dailyExpense.title')}</h2>
      <Skeleton className="h-daily-chart w-full" aria-label="Loading daily expenses" />
    </section>
  );
}

interface DayColumnProps {
  bucket: DayBucket | BoundaryBucket;
  index: number;
  peakCents: number;
  selected: boolean;
  reducedMotion: boolean;
  onToggle: (filter: DateFilter) => void;
}

function DayColumn({ bucket, index, peakCents, selected, reducedMotion, onToggle }: DayColumnProps) {
  const { t } = useTranslation();
  const [grown, setGrown] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const empty = bucket.totalCents === 0;
  const heightPercent = empty ? 0 : Math.max(9, Math.sqrt(bucket.totalCents / peakCents) * 100);
  const boundary = 'side' in bucket;
  const dayLabel = boundary
    ? t(`transactions.dailyExpense.${bucket.side}`)
    : new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(localDate(bucket.date));
  const breakdown = bucket.segments.map((segment) => `${segment.name} ${formatCents(segment.cents)}`).join(' · ');
  const accessibleName = boundary
    ? t(empty ? 'transactions.dailyExpense.boundaryTooltipEmpty' : 'transactions.dailyExpense.boundaryTooltip', {
        side: dayLabel,
        count: bucket.transactionCount,
        total: formatCents(bucket.totalCents),
        breakdown,
      })
    : empty
      ? t('transactions.dailyExpense.tooltipEmpty', { date: dayLabel })
      : t('transactions.dailyExpense.tooltip', { date: dayLabel, total: formatCents(bucket.totalCents), breakdown });
  const title = t(boundary ? 'transactions.dailyExpense.boundaryTitle' : 'transactions.dailyExpense.columnTitle', {
    ...(boundary ? { side: dayLabel } : { date: dayLabel }),
    count: bucket.transactionCount,
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      aria-pressed={selected}
      title={title}
      aria-label={accessibleName}
      onClick={() => onToggle(bucket)}
      className={cn(
        'group h-full min-w-0 flex-col justify-end rounded-bar border-0 bg-transparent p-0',
        selected ? 'outline-2 outline-offset-1 outline-foreground' : '',
      )}
    >
      {empty ? (
        <span className="block h-daily-baseline w-full rounded-t-bar bg-border" />
      ) : (
        <span
          className="flex w-full origin-bottom flex-col justify-end overflow-hidden rounded-t-bar transition-transform group-hover:brightness-115"
          style={{
            height: `${heightPercent}%`,
            transform: grown ? 'scaleY(1)' : 'scaleY(0)',
            transitionDuration: reducedMotion ? '0ms' : '420ms',
            transitionDelay: reducedMotion ? '0ms' : `${index * 20}ms`,
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {[...bucket.segments].reverse().map((segment) => (
            <i key={segment.key} className="block w-full" style={{ height: `${(segment.cents / bucket.totalCents) * 100}%`, background: segment.color }} />
          ))}
        </span>
      )}
    </Button>
  );
}

export interface DailyExpenseStripProps {
  referenceMonth: Date;
  selectedFilterId: string | undefined;
  onToggleFilter: (filter: DateFilter) => void;
}

/** The month screen's signature: one column per date, stacked by category, so the shape of the
 * accounting period reads before a single number does. It owns a paginated confirmed-only query so
 * the boundary bars can count every transaction type. */
export function DailyExpenseStrip({ referenceMonth, selectedFilterId, onToggleFilter }: DailyExpenseStripProps) {
  const { t } = useTranslation();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const referenceMonthFilter = monthFilterParam(referenceMonth);

  const { data, isPending, isError } = useQuery({
    queryKey: [...getDailyExpensesQueryKey(), referenceMonthFilter],
    queryFn: ({ signal }) => fetchMonthlyExpenses(referenceMonthFilter, signal),
  });

  if (isPending) return <StripSkeleton />;
  // Fails quietly: the strip is a summary above a list the user came for, not worth an error card.
  if (isError || !data) return null;

  const noCategoryLabel = t('transactions.dailyExpense.noCategory');
  const { start, end } = chartWindow(referenceMonth, data);
  const days = buildDays(start, end, data, noCategoryLabel);
  const before = buildBoundary('before', start, data, noCategoryLabel);
  const after = buildBoundary('after', end, data, noCategoryLabel);
  const legend = buildLegend(data, noCategoryLabel);
  const buckets = [before, ...days, after].filter((bucket): bucket is DayBucket | BoundaryBucket => bucket !== null);
  const peakCents = Math.max(0, ...buckets.map((bucket) => bucket.totalCents));

  return (
    <section className="rounded-lg border bg-card p-4 shadow-xs">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-1">
        <h2 className="font-semibold">{t('transactions.dailyExpense.title')}</h2>
        <span className="text-xs text-muted-foreground">{t('transactions.dailyExpense.caption')}</span>
      </div>
      <div
        role="group"
        aria-label={t('transactions.dailyExpense.groupLabel', { month: formatMonth(referenceMonth) })}
        className="grid h-daily-chart items-end gap-daily-gap max-shell:h-21"
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
      >
        {buckets.map((bucket, index) => (
          <DayColumn
            key={bucket.id}
            bucket={bucket}
            index={index}
            peakCents={peakCents}
            selected={bucket.id === selectedFilterId}
            reducedMotion={reducedMotion}
            onToggle={onToggleFilter}
          />
        ))}
      </div>
      <div
        data-testid="daily-expense-ticks"
        className="num mt-1.5 grid gap-daily-gap text-center text-xs text-muted-foreground"
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
      >
        {buckets.map((bucket, index) => {
          if (!('date' in bucket)) return null;
          const day = localDate(bucket.date).getDate();
          return [1, 5, 10, 15, 20, 25].includes(day) ? (
            <span key={bucket.id} style={{ gridColumnStart: index + 1 }}>
              {day}
            </span>
          ) : null;
        })}
      </div>
      {legend.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-2 border-t pt-2.5">
          {legend.map((segment) => (
            <span key={segment.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: segment.color }} />
              {segment.name} <b className="num font-medium text-foreground">{formatCents(segment.cents)}</b>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
