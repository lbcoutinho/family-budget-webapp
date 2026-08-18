import { CategoryKind, useGetYearlyReport, type YearlyReportCategoryDto, type YearlyReportComparisonCategoryDto } from '@family-budget/api-client';
import { AlertCircleIcon, ChevronRightIcon } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  averageDelta,
  AVERAGE_TONE_CLASS,
  categoryColor,
  formatSignedPercent,
  formatWholeEuros,
  hasSubcategoryBreakdown,
  isFutureMonth,
} from '@/features/reports/report-format';
import { ReportsErrorState, ReportsSkeleton, useExpandedRows } from '@/features/reports/report-shell';
import { formatMonthAbbreviation, monthPath } from '@/lib/date';
import { cn } from '@/lib/utils';

export interface ReportsYearlyProps {
  year: number;
  compare: boolean;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2000, index, 1));
/** The tint at a cell's own value goes no further than this: past it the number itself loses
 * contrast, and the point of the tint is the shape of the row, not a solid block
 * (`10-reports-yearly.html`). */
const MAX_TINT_OPACITY = 0.22;

const STICKY_CELL = 'sticky left-0 z-10 bg-background';

function YearlyCell({ value, color, max, future, onOpen }: { value: number; color: string; max: number; future: boolean; onOpen: (() => void) | undefined }) {
  if (future || value === 0) {
    return <TableCell className="num text-right text-muted-foreground">—</TableCell>;
  }

  const opacity = max > 0 ? (value / max) * MAX_TINT_OPACITY : 0;

  return (
    <TableCell className="relative num text-right">
      <span aria-hidden="true" className="absolute inset-[1px] rounded-sm" style={{ background: color, opacity }} />
      <button type="button" className="relative hover:underline" onClick={onOpen}>
        {formatWholeEuros(value)}
      </button>
    </TableCell>
  );
}

function ComparisonBadge({ total, previousTotal, previousYear, kind }: { total: number; previousTotal: number; previousYear: number; kind: CategoryKind }) {
  const { t } = useTranslation();
  const { percent, tone } = averageDelta(total, previousTotal, kind);

  if (percent === null) return null;

  return (
    <span className={cn('num block text-[10.5px] font-medium', tone ? AVERAGE_TONE_CLASS[tone] : 'text-muted-foreground')}>
      {t('reports.yearly.comparisonValue', { year: previousYear, value: formatWholeEuros(previousTotal) })} · {formatSignedPercent(percent)}
    </span>
  );
}

/** A subcategory's own row in the yearly matrix — same twelve cells as its parent, but no
 * average and no year-over-year comparison (the matrix draws those only on the root row). */
function YearlySubcategoryRow({
  name,
  color,
  monthly,
  total,
  year,
  onOpenMonth,
}: {
  name: string;
  color: string;
  monthly: number[];
  total: number;
  year: number;
  onOpenMonth: (monthIndex: number) => void;
}) {
  const max = Math.max(...monthly, 0);

  return (
    <TableRow className="bg-muted/30">
      <TableCell className={cn(STICKY_CELL, 'bg-muted/30')}>
        <span className="ml-7 flex items-center gap-2">
          <span className="size-2.5 flex-none rounded-sm opacity-50" style={{ background: color }} />
          <span className="truncate text-[12.5px] text-muted-foreground">{name}</span>
        </span>
      </TableCell>
      {monthly.map((value, index) => (
        <YearlyCell key={index} value={value} color={color} max={max} future={isFutureMonth(year, index)} onOpen={() => onOpenMonth(index)} />
      ))}
      <TableCell className="num bg-muted text-right font-semibold">{formatWholeEuros(total)}</TableCell>
      <TableCell className="num bg-muted text-right" />
    </TableRow>
  );
}

function YearlyTable({
  kind,
  titleKey,
  categories,
  months,
  total,
  totalAverage,
  comparisonByCategory,
  year,
  expanded,
  onToggle,
  onOpenMonth,
}: {
  kind: CategoryKind;
  titleKey: 'reports.monthly.expenseTitle' | 'reports.monthly.incomeTitle';
  categories: YearlyReportCategoryDto[];
  /** This side's column totals — `data.months[i].expense` or `.income`, straight from the API. */
  months: number[];
  total: number;
  totalAverage: number;
  comparisonByCategory: Map<string, YearlyReportComparisonCategoryDto>;
  year: number;
  expanded: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onOpenMonth: (categoryId: string, monthIndex: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby={`reports-yearly-${kind}`} className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id={`reports-yearly-${kind}`} className="font-semibold">
          {t(titleKey)}
        </h2>
        <span className="text-[11.5px] text-muted-foreground">{t('reports.yearly.wholeEurosHint')}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn(STICKY_CELL, 'min-w-[150px]')}>{t('reports.monthly.category')}</TableHead>
            {MONTHS.map((month, index) => (
              <TableHead key={index} className={cn('num text-right', isFutureMonth(year, index) && 'text-muted-foreground')}>
                {formatMonthAbbreviation(month)}
              </TableHead>
            ))}
            <TableHead className="num min-w-[118px] bg-muted text-right">{t('reports.yearly.total')}</TableHead>
            <TableHead className="num min-w-[110px] bg-muted text-right">
              <Tooltip>
                <TooltipTrigger className="decoration-dotted underline-offset-2 hover:underline">{t('reports.yearly.average')}</TooltipTrigger>
                <TooltipContent>{t('reports.yearly.averageTooltip')}</TooltipContent>
              </Tooltip>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => {
            const key = category.categoryId ?? 'uncategorized';
            const expandable = hasSubcategoryBreakdown(category.subcategories);
            const isOpen = expanded.has(key);
            const color = categoryColor(category.color);
            const name = category.name ?? t('reports.uncategorizedCategory');

            return (
              <Fragment key={key}>
                <TableRow className="[&>td:first-child]:p-0">
                  <TableCell className={STICKY_CELL}>
                    <span className="flex items-center gap-1 px-2 py-2">
                      {expandable ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-expanded={isOpen}
                          aria-label={t('reports.monthly.expand', { name })}
                          onClick={() => onToggle(key)}
                        >
                          <ChevronRightIcon className={isOpen ? 'rotate-90' : ''} />
                        </Button>
                      ) : (
                        <span className="inline-block size-6 flex-none" />
                      )}
                      <span className="size-2.5 flex-none rounded-sm" style={{ background: color }} />
                      <span className="truncate font-medium">{name}</span>
                    </span>
                  </TableCell>
                  {category.monthly.map((value, index) => (
                    <YearlyCell
                      key={index}
                      value={value}
                      color={color}
                      max={Math.max(...category.monthly, 0)}
                      future={isFutureMonth(year, index)}
                      onOpen={category.categoryId ? () => onOpenMonth(category.categoryId!, index) : undefined}
                    />
                  ))}
                  <TableCell className="num bg-muted text-right font-semibold">
                    {formatWholeEuros(category.total)}
                    {(() => {
                      const previous = comparisonByCategory.get(key);
                      return previous ? <ComparisonBadge total={category.total} previousTotal={previous.total} previousYear={year - 1} kind={kind} /> : null;
                    })()}
                  </TableCell>
                  <TableCell className="num bg-muted text-right">{formatWholeEuros(category.monthlyAverage)}</TableCell>
                </TableRow>
                {isOpen && category.categoryId
                  ? category.subcategories.map((subcategory) => (
                      <YearlySubcategoryRow
                        key={`${key}|${subcategory.subcategoryId ?? 'none'}`}
                        name={subcategory.name ?? t('reports.noSubcategory')}
                        color={color}
                        monthly={subcategory.monthly}
                        total={subcategory.total}
                        year={year}
                        onOpenMonth={(monthIndex) => onOpenMonth(category.categoryId!, monthIndex)}
                      />
                    ))
                  : null}
              </Fragment>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className={STICKY_CELL}>{t(kind === CategoryKind.EXPENSE ? 'reports.monthly.totalExpense' : 'reports.monthly.totalIncome')}</TableCell>
            {months.map((value, index) => (
              <TableCell key={index} className="num text-right">
                {isFutureMonth(year, index) ? '—' : formatWholeEuros(value)}
              </TableCell>
            ))}
            <TableCell className="num bg-muted text-right font-semibold">{formatWholeEuros(total)}</TableCell>
            <TableCell className="num bg-muted text-right">{formatWholeEuros(totalAverage)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </section>
  );
}

/** The yearly view of `/reports` (M6-T03 step 3) — `10-reports-yearly.html`. */
export function ReportsYearly({ year, compare }: ReportsYearlyProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, toggle] = useExpandedRows();
  const query = useGetYearlyReport({ year, compare });

  const openMonth = (categoryId: string, monthIndex: number) => {
    void navigate(`${monthPath(new Date(year, monthIndex, 1))}?categoryId=${encodeURIComponent(categoryId)}`);
  };

  if (query.isPending) return <ReportsSkeleton />;

  if (query.isError) return <ReportsErrorState onRetry={() => void query.refetch()} />;

  const data = query.data;
  const expenseCategories = data.categories.filter((category) => category.kind === CategoryKind.EXPENSE);
  const incomeCategories = data.categories.filter((category) => category.kind === CategoryKind.INCOME);

  if (expenseCategories.length === 0 && incomeCategories.length === 0) {
    return <EmptyState icon={AlertCircleIcon} title={t('reports.empty.title')} description={t('reports.empty.description')} />;
  }

  const comparisonByCategory = new Map<string, YearlyReportComparisonCategoryDto>(
    (data.comparison?.categories ?? []).map((category) => [category.categoryId ?? 'uncategorized', category]),
  );
  const expenseTotalAverage = expenseCategories.reduce((sum, category) => sum + category.monthlyAverage, 0);
  const incomeTotalAverage = incomeCategories.reduce((sum, category) => sum + category.monthlyAverage, 0);

  return (
    <div className="space-y-4">
      {expenseCategories.length > 0 ? (
        <YearlyTable
          kind={CategoryKind.EXPENSE}
          titleKey="reports.monthly.expenseTitle"
          categories={expenseCategories}
          months={data.months.map((month) => month.expense)}
          total={data.totals.expense}
          totalAverage={expenseTotalAverage}
          comparisonByCategory={comparisonByCategory}
          year={year}
          expanded={expanded}
          onToggle={toggle}
          onOpenMonth={openMonth}
        />
      ) : null}
      {incomeCategories.length > 0 ? (
        <YearlyTable
          kind={CategoryKind.INCOME}
          titleKey="reports.monthly.incomeTitle"
          categories={incomeCategories}
          months={data.months.map((month) => month.income)}
          total={data.totals.income}
          totalAverage={incomeTotalAverage}
          comparisonByCategory={comparisonByCategory}
          year={year}
          expanded={expanded}
          onToggle={toggle}
          onOpenMonth={openMonth}
        />
      ) : null}
    </div>
  );
}
