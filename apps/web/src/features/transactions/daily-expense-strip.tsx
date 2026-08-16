import { listTransactions, TransactionType, type TransactionListItemDto } from '@family-budget/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

interface DayBucket {
  day: number;
  /** `YYYY-MM-DD` of this column inside the reference month — what a click filters the list to. */
  date: string;
  totalCents: number;
  /** Largest first. */
  segments: Segment[];
}

function localDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function monthFilterParam(referenceMonth: Date): string {
  const year = referenceMonth.getFullYear();
  const month = String(referenceMonth.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}

async function fetchMonthlyExpenses(referenceMonthFilter: string, signal: AbortSignal): Promise<TransactionListItemDto[]> {
  const items: TransactionListItemDto[] = [];
  let cursor: string | undefined;

  do {
    const page = await listTransactions(
      { referenceMonth: referenceMonthFilter, type: [TransactionType.EXPENSE], limit: 200, ...(cursor ? { cursor } : {}) },
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

  if (existing) {
    existing.cents += item.amount;
  } else {
    map.set(key, { key, name, color, cents: item.amount });
  }
}

function byDescendingCents(a: Segment, b: Segment): number {
  return b.cents - a.cents;
}

/**
 * One bucket per day of `referenceMonth`, `date` clamped from `item.date` to the month's own 1st or
 * last day. A credit-card purchase keeps its original `referenceMonth` when `date` moves (ADR-0009),
 * so without clamping such a row would have no column at all — and the strip would silently disagree
 * with the footer's `expenseTotal`, which sums the same unfiltered month.
 */
function buildDays(referenceMonth: Date, items: TransactionListItemDto[], noCategoryLabel: string): DayBucket[] {
  const year = referenceMonth.getFullYear();
  const month = referenceMonth.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const start = new Date(year, month, 1);
  const end = new Date(year, month, lastDay, 23, 59, 59, 999);

  const byDay = new Map<number, Map<string, Segment>>();
  for (let day = 1; day <= lastDay; day++) byDay.set(day, new Map());

  for (const item of items) {
    const txDate = localDate(item.date);
    const day = txDate < start ? 1 : txDate > end ? lastDay : txDate.getDate();

    accumulate(byDay.get(day)!, item, noCategoryLabel);
  }

  return Array.from(byDay.entries()).map(([day, segmentMap]) => {
    const segments = Array.from(segmentMap.values()).sort(byDescendingCents);
    const totalCents = segments.reduce((sum, segment) => sum + segment.cents, 0);
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return { day, date, totalCents, segments };
  });
}

function buildLegend(items: TransactionListItemDto[], noCategoryLabel: string): Segment[] {
  const totals = new Map<string, Segment>();

  for (const item of items) accumulate(totals, item, noCategoryLabel);

  return Array.from(totals.values()).sort(byDescendingCents);
}

function StripSkeleton() {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border bg-card p-4 shadow-xs">
      <h2 className="mb-2.5 font-semibold">{t('transactions.dailyExpense.title')}</h2>
      <Skeleton className="h-[108px] w-full" aria-label="Loading daily expenses" />
    </section>
  );
}

interface DayColumnProps {
  bucket: DayBucket;
  index: number;
  peakCents: number;
  selected: boolean;
  reducedMotion: boolean;
  onToggle: (date: string) => void;
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
  const dayLabel = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(localDate(bucket.date));
  const breakdown = bucket.segments.map((segment) => `${segment.name} ${formatCents(segment.cents)}`).join(' · ');
  const accessibleName = empty
    ? t('transactions.dailyExpense.tooltipEmpty', { date: dayLabel })
    : t('transactions.dailyExpense.tooltip', { date: dayLabel, total: formatCents(bucket.totalCents), breakdown });

  return (
    <button
      type="button"
      aria-pressed={selected}
      title={accessibleName}
      aria-label={accessibleName}
      onClick={() => onToggle(bucket.date)}
      className={cn(
        'group flex h-full min-w-0 flex-1 flex-col justify-end rounded-[3px] border-0 bg-transparent p-0',
        selected ? 'outline-2 outline-offset-1 outline-foreground' : '',
      )}
    >
      {empty ? (
        <span className="block h-[2px] w-full rounded-t-[3px] bg-border" />
      ) : (
        <span
          className="flex w-full origin-bottom flex-col justify-end overflow-hidden rounded-t-[3px] transition-transform group-hover:brightness-115"
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
    </button>
  );
}

export interface DailyExpenseStripProps {
  referenceMonth: Date;
  selectedDate: string | undefined;
  onToggleDay: (date: string) => void;
}

/** The month screen's signature: one column per day, stacked by category, so the shape of the month
 * reads before a single number does. Owns its own query — `listTransactions` filtered to `EXPENSE`,
 * paginated to exhaustion — rather than reusing the entries list's paginated, unfiltered query. */
export function DailyExpenseStrip({ referenceMonth, selectedDate, onToggleDay }: DailyExpenseStripProps) {
  const { t } = useTranslation();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const referenceMonthFilter = monthFilterParam(referenceMonth);

  const { data, isPending, isError } = useQuery({
    queryKey: ['transactions', 'daily-expenses', referenceMonthFilter],
    queryFn: ({ signal }) => fetchMonthlyExpenses(referenceMonthFilter, signal),
  });

  if (isPending) return <StripSkeleton />;
  // Fails quietly: the strip is a summary above a list the user came for, not worth an error card.
  if (isError || !data) return null;

  const noCategoryLabel = t('transactions.dailyExpense.noCategory');
  const days = buildDays(referenceMonth, data, noCategoryLabel);
  const legend = buildLegend(data, noCategoryLabel);
  const peakCents = Math.max(0, ...days.map((day) => day.totalCents));
  const lastDay = days.length;

  return (
    <section className="rounded-lg border bg-card p-4 shadow-xs">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-1">
        <h2 className="font-semibold">{t('transactions.dailyExpense.title')}</h2>
        <span className="text-[11.5px] text-muted-foreground">{t('transactions.dailyExpense.caption')}</span>
      </div>
      <div
        role="group"
        aria-label={t('transactions.dailyExpense.groupLabel', { month: formatMonth(referenceMonth) })}
        className="flex h-[108px] items-end gap-[3px] shell:h-[108px] max-shell:h-21"
      >
        {days.map((bucket, index) => (
          <DayColumn
            key={bucket.date}
            bucket={bucket}
            index={index}
            peakCents={peakCents}
            selected={bucket.date === selectedDate}
            reducedMotion={reducedMotion}
            onToggle={onToggleDay}
          />
        ))}
      </div>
      <div className="num mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>1</span>
        <span>8</span>
        <span>15</span>
        <span>22</span>
        <span>{lastDay}</span>
      </div>
      {legend.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-2 border-t pt-2.5">
          {legend.map((segment) => (
            <span key={segment.key} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: segment.color }} />
              {segment.name} <b className="num font-medium text-foreground">{formatCents(segment.cents)}</b>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
