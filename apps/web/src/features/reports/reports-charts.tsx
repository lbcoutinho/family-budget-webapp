/**
 * The chart view of `/reports` (M6-T04) — `11-reports-charts.html`. Reads the same two endpoints
 * #183's table already fetches (`useGetMonthlyReport`, `useGetYearlyReport`); no new query, no
 * client-side recomputation of amounts or percentages beyond what a legend toggle forces (see
 * `DonutCard` below).
 *
 * The cashbox chart (`11-reports-charts.html`'s bottom block, M6-T05, #185) lives in
 * `cashbox-evolution-panel.tsx`, rendered by `ReportsPage` below this component — kept apart from
 * the expense charts, same as the prototype. `useHiddenSeries`/`Legend`/`TooltipCard` are exported
 * from here for it to reuse, rather than duplicating the toggle/legend/tooltip chrome.
 */
import { CategoryKind, useGetMonthlyReport, useGetYearlyReport, type MonthlyReportCategoryDto, type YearlyReportCategoryDto } from '@family-budget/api-client';
import { PiggyBankIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';

import { EmptyState } from '@/components/empty-state';
import { CashboxEvolutionPanel } from '@/features/reports/cashbox-evolution-panel';
import { categoryColor } from '@/features/reports/category-color';
import { formatPercent } from '@/features/reports/report-format';
import { ReportsErrorState, ReportsSkeleton } from '@/features/reports/report-shell';
import { formatMonth, formatMonthAbbreviation, monthPath } from '@/lib/date';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface ReportsChartsProps {
  year: number;
  month: number;
}

interface CategorySlice {
  key: string;
  id: string | null;
  name: string;
  color: string;
  amount: number;
  /** Of the month's expense total, straight from the API — the donut's baseline reading. Only
   * recomputed client-side once a legend toggle changes what the centre total counts. Absent for
   * slices that never need one (the stacked bar's categories). */
  percentage?: number;
}

function categoryKey(categoryId: string | null): string {
  return categoryId ?? 'uncategorized';
}

/** Session-only hidden-series state — `useState`, never the URL, never persisted
 * (`prototypes/memory/11-charts.md`). */
export function useHiddenSeries(): [ReadonlySet<string>, (key: string) => void] {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const toggle = (key: string) =>
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return [hidden, toggle];
}

export function Legend({
  items,
  hidden,
  onToggle,
}: {
  items: { key: string; name: string; color: string }[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
      {items.map((item) => {
        const isHidden = hidden.has(item.key);
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={!isHidden}
            aria-label={t('reports.charts.toggleSeries', { name: item.name })}
            onClick={() => onToggle(item.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-opacity',
              isHidden ? 'text-muted-foreground opacity-45 line-through' : 'text-foreground',
            )}
          >
            <span className="size-2.5 flex-none rounded-sm" style={{ background: item.color }} />
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

export function TooltipCard({ rows, total }: { rows: { name: string; color: string; amount: number; percentage?: number }[]; total?: string }) {
  return (
    <div className="rounded-md border bg-popover p-2 text-[12px] shadow-md">
      {total ? <div className="mb-1 font-medium">{total}</div> : null}
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-2 whitespace-nowrap">
          <span className="size-2 flex-none rounded-sm" style={{ background: row.color }} />
          <span className="flex-1">{row.name}</span>
          <span className="num font-medium">{formatCents(row.amount)}</span>
          {row.percentage !== undefined ? <span className="num text-muted-foreground">{formatPercent(row.percentage)}</span> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * The month's expense distribution — donut with the total in the centre, every category drawn
 * (nothing groups into "Outras"). Toggling a legend entry recalculates the centre total and every
 * visible slice's share of it, per `prototypes/memory/11-charts.md` — otherwise the slices stop
 * summing to the number in the middle. Below 640px it is replaced by a list with proportion bars.
 */
function DonutCard({
  year,
  month,
  categories,
  apiTotal,
  onOpenCategory,
}: {
  year: number;
  month: number;
  categories: CategorySlice[];
  /** `MonthlyReportDto.expenseTotal` — the reading while nothing is toggled off. */
  apiTotal: number;
  onOpenCategory: (categoryId: string) => void;
}) {
  const { t } = useTranslation();
  const [hidden, toggle] = useHiddenSeries();

  const visible = categories.filter((category) => !hidden.has(category.key));
  const max = Math.max(...categories.map((category) => category.amount), 1);

  if (categories.length === 0) {
    return <EmptyState icon={PiggyBankIcon} title={t('reports.empty.title')} description={t('reports.empty.description')} />;
  }

  // Nothing hidden: the total and every slice's share come straight from the API
  // (`expenseTotal`, `category.percentage`) — untouched, they are never recomputed. A legend
  // toggle changes what the centre sums, so from then on the total and the visible slices'
  // shares are derived from the already-fetched amounts instead (`prototypes/memory/11-charts.md`).
  const total = hidden.size > 0 ? visible.reduce((sum, category) => sum + category.amount, 0) : apiTotal;
  const percentageOf = (category: CategorySlice): number => (hidden.size > 0 ? (total > 0 ? (category.amount / total) * 100 : 0) : (category.percentage ?? 0));

  const referenceDate = new Date(year, month - 1, 1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative hidden size-[220px] flex-none sm:block">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={visible.map((category) => ({ ...category, displayPercentage: percentageOf(category) }))}
                dataKey="amount"
                nameKey="name"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={visible.length > 1 ? 1 : 0}
                stroke="none"
              >
                {visible.map((category) => (
                  <Cell
                    key={category.key}
                    fill={category.color}
                    cursor={category.id ? 'pointer' : undefined}
                    onClick={() => category.id && onOpenCategory(category.id)}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const slice = payload[0]!.payload as CategorySlice & { displayPercentage: number };
                  return <TooltipCard rows={[{ name: slice.name, color: slice.color, amount: slice.amount, percentage: slice.displayPercentage }]} />;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <b className="num font-display text-lg" data-testid="donut-total">
              {formatCents(total)}
            </b>
            <span className="text-[11px] text-muted-foreground">
              {hidden.size > 0
                ? t('reports.charts.donutTotalPartial', { shown: visible.length, total: categories.length })
                : t('reports.charts.donutTotalLabel')}
            </span>
          </div>
        </div>

        <div className="min-w-[240px] flex-1 space-y-1 sm:hidden">
          {categories.map((category) => {
            const isHidden = hidden.has(category.key);
            return (
              <div key={category.key} className={cn('border-b py-1.5 last:border-0', isHidden && 'opacity-45 line-through')}>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 flex-none rounded-sm" style={{ background: category.color }} />
                  <span className="flex-1 truncate text-[12.5px]">{category.name}</span>
                  <span className="num font-medium">{formatCents(category.amount)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: isHidden ? 0 : `${(category.amount / max) * 100}%`, background: category.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden min-w-[240px] flex-1 sm:block">
          {categories.map((category) => {
            const isHidden = hidden.has(category.key);
            const percentage = isHidden ? null : percentageOf(category);
            return (
              <div key={category.key} className={cn('flex items-center gap-2 border-b py-1.5 last:border-0', isHidden && 'opacity-45 line-through')}>
                <span className="size-2.5 flex-none rounded-sm" style={{ background: category.color }} />
                <span className="flex-1 truncate text-[12.5px]">{category.name}</span>
                <span className="num font-medium">{formatCents(category.amount)}</span>
                <span className="num w-12 flex-none text-right text-[12px] text-muted-foreground">{percentage === null ? '—' : formatPercent(percentage)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Legend items={categories.map((category) => ({ key: category.key, name: category.name, color: category.color }))} hidden={hidden} onToggle={toggle} />

      <p className="mt-2 text-[11px] text-muted-foreground">{t('reports.charts.donutHint', { month: formatMonth(referenceDate) })}</p>
    </div>
  );
}

/**
 * The stacked bar chart — twelve months, one bar segment per category, every month drawn
 * (including empty ones — no month is skipped for having no movement).
 */
function StackCard({
  categories,
  months,
  hidden,
  onToggle,
  onOpenMonth,
}: {
  categories: CategorySlice[];
  months: { monthIndex: number; byCategory: Record<string, number> }[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onOpenMonth: (categoryId: string, monthIndex: number) => void;
}) {
  const { t } = useTranslation();

  if (categories.length === 0) {
    return <EmptyState icon={PiggyBankIcon} title={t('reports.empty.title')} description={t('reports.empty.description')} />;
  }

  const data = months.map((month) => ({
    monthIndex: month.monthIndex,
    label: formatMonthAbbreviation(new Date(2000, month.monthIndex, 1)),
    ...month.byCategory,
  }));

  return (
    <div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <RechartsTooltip
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const rows = payload
                  .filter((entry) => typeof entry.value === 'number' && entry.value > 0)
                  .map((entry) => {
                    const category = categories.find((candidate) => candidate.key === entry.dataKey);
                    return { name: category?.name ?? String(entry.dataKey), color: category?.color ?? String(entry.color), amount: entry.value as number };
                  });
                if (rows.length === 0) return null;
                return <TooltipCard rows={rows} total={String(label)} />;
              }}
            />
            {categories
              .filter((category) => !hidden.has(category.key))
              .map((category) => (
                <Bar
                  key={category.key}
                  dataKey={category.key}
                  stackId="a"
                  fill={category.color}
                  radius={[1, 1, 0, 0]}
                  cursor={category.id ? 'pointer' : undefined}
                  onClick={(_: unknown, index: number) => category.id && onOpenMonth(category.id, months[index]!.monthIndex)}
                />
              ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={categories.map((category) => ({ key: category.key, name: category.name, color: category.color }))} hidden={hidden} onToggle={onToggle} />
      <p className="mt-2 text-[11px] text-muted-foreground">{t('reports.charts.stackHint')}</p>
    </div>
  );
}

/** Income vs. expense across the twelve months — two series, no colour mapping needed. */
function IncomeExpenseCard({ months }: { months: { monthIndex: number; income: number; expense: number }[] }) {
  const { t } = useTranslation();
  const [hidden, toggle] = useHiddenSeries();

  const empty = months.every((month) => month.income === 0 && month.expense === 0);
  if (empty) {
    return <EmptyState icon={PiggyBankIcon} title={t('reports.empty.title')} description={t('reports.empty.description')} />;
  }

  const data = months.map((month) => ({ ...month, label: formatMonthAbbreviation(new Date(2000, month.monthIndex, 1)) }));
  const series = [
    { key: 'income', name: t('reports.charts.income'), color: 'var(--primary)' },
    { key: 'expense', name: t('reports.charts.expense'), color: 'var(--destructive)' },
  ];

  return (
    <div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <RechartsTooltip
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const rows = payload.map((entry) => {
                  const found = series.find((candidate) => candidate.key === entry.dataKey);
                  return { name: found?.name ?? String(entry.dataKey), color: found?.color ?? String(entry.color), amount: entry.value as number };
                });
                return <TooltipCard rows={rows} total={String(label)} />;
              }}
            />
            {series
              .filter((entry) => !hidden.has(entry.key))
              .map((entry) => (
                <Line key={entry.key} type="monotone" dataKey={entry.key} name={entry.name} stroke={entry.color} strokeWidth={2.2} dot={{ r: 3 }} />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend items={series} hidden={hidden} onToggle={toggle} />
    </div>
  );
}

export function ReportsCharts({ year, month }: ReportsChartsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const monthlyQuery = useGetMonthlyReport({ year, month });
  const yearlyQuery = useGetYearlyReport({ year, compare: false });

  const [hiddenYearly, toggleYearly] = useHiddenSeries();

  const openCategory = (categoryId: string) => {
    void navigate(`${monthPath(new Date(year, month - 1, 1))}?categoryId=${encodeURIComponent(categoryId)}`);
  };

  const openMonth = (categoryId: string, monthIndex: number) => {
    void navigate(`${monthPath(new Date(year, monthIndex, 1))}?categoryId=${encodeURIComponent(categoryId)}`);
  };

  const donutSlices: CategorySlice[] = useMemo(() => {
    if (!monthlyQuery.data) return [];
    return monthlyQuery.data.categories
      .filter((category: MonthlyReportCategoryDto) => category.kind === CategoryKind.EXPENSE && category.amount > 0)
      .map((category) => ({
        key: categoryKey(category.categoryId),
        id: category.categoryId,
        name: category.name ?? t('reports.uncategorizedCategory'),
        color: categoryColor(category.categoryId, category.color),
        amount: category.amount,
        percentage: category.percentage,
      }));
  }, [monthlyQuery.data, t]);

  const yearlyExpenseCategories: YearlyReportCategoryDto[] = useMemo(
    () => (yearlyQuery.data ? yearlyQuery.data.categories.filter((category) => category.kind === CategoryKind.EXPENSE) : []),
    [yearlyQuery.data],
  );

  const stackCategories: CategorySlice[] = useMemo(
    () =>
      yearlyExpenseCategories.map((category) => ({
        key: categoryKey(category.categoryId),
        id: category.categoryId,
        name: category.name ?? t('reports.uncategorizedCategory'),
        color: categoryColor(category.categoryId, category.color),
        amount: category.total,
      })),
    [yearlyExpenseCategories, t],
  );

  const stackMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => ({
        monthIndex,
        byCategory: Object.fromEntries(stackCategories.map((category, index) => [category.key, yearlyExpenseCategories[index]!.monthly[monthIndex] ?? 0])),
      })),
    [stackCategories, yearlyExpenseCategories],
  );

  const incomeExpenseMonths = useMemo(
    () => (yearlyQuery.data ? yearlyQuery.data.months.map((month) => ({ monthIndex: month.month - 1, income: month.income, expense: month.expense })) : []),
    [yearlyQuery.data],
  );

  if (monthlyQuery.isPending || yearlyQuery.isPending) return <ReportsSkeleton />;

  if (monthlyQuery.isError || yearlyQuery.isError) {
    return (
      <ReportsErrorState
        onRetry={() => {
          if (monthlyQuery.isError) void monthlyQuery.refetch();
          if (yearlyQuery.isError) void yearlyQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="reports-charts-donut" className="overflow-hidden rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="reports-charts-donut" className="font-semibold">
            {t('reports.charts.donutTitle', { month: formatMonth(new Date(year, month - 1, 1)) })}
          </h2>
        </div>
        <DonutCard year={year} month={month} categories={donutSlices} apiTotal={monthlyQuery.data.expenseTotal} onOpenCategory={openCategory} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="reports-charts-stack" className="overflow-hidden rounded-lg border p-4">
          <h2 id="reports-charts-stack" className="mb-3 font-semibold">
            {t('reports.charts.stackTitle', { year })}
          </h2>
          <StackCard categories={stackCategories} months={stackMonths} hidden={hiddenYearly} onToggle={toggleYearly} onOpenMonth={openMonth} />
        </section>

        <section aria-labelledby="reports-charts-line" className="overflow-hidden rounded-lg border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="reports-charts-line" className="font-semibold">
              {t('reports.charts.lineTitle')}
            </h2>
            <span className="text-[11.5px] text-muted-foreground">{t('reports.charts.lineHint', { year })}</span>
          </div>
          <IncomeExpenseCard months={incomeExpenseMonths} />
        </section>
      </div>

      <CashboxEvolutionPanel year={year} />
    </div>
  );
}
