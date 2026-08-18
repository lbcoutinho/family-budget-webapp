import {
  CategoryKind,
  useGetMonthlyReport,
  type MonthlyReportCategoryDto,
  type MonthlyReportCashboxesDto,
  type MonthlyReportSubcategoryDto,
} from '@family-budget/api-client';
import { ChevronRightIcon, PiggyBankIcon } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AVERAGE_TONE_CLASS, averageDelta, categoryColor, formatPercent, formatSignedPercent, hasSubcategoryBreakdown } from '@/features/reports/report-format';
import { ReportsErrorState, ReportsSkeleton, useExpandedRows } from '@/features/reports/report-shell';
import { type TranslationKey } from '@/i18n';
import { monthPath } from '@/lib/date';
import { formatCents } from '@/lib/money';

export interface ReportsMonthlyProps {
  year: number;
  month: number;
}

function AverageCell({ amount, average, kind }: { amount: number; average: number; kind: CategoryKind }) {
  const { t } = useTranslation();
  const { percent, tone } = averageDelta(amount, average, kind);

  return (
    <div>
      <span className={`num block font-medium ${tone ? AVERAGE_TONE_CLASS[tone] : 'text-muted-foreground'}`}>
        {percent === null ? '—' : formatSignedPercent(percent)}
      </span>
      <small className="num block text-[10.5px] text-muted-foreground">{t('reports.monthly.averageValue', { value: formatCents(average) })}</small>
    </div>
  );
}

function CategoryRows({
  kind,
  categories,
  expanded,
  onToggle,
  onOpenCategory,
}: {
  kind: CategoryKind;
  categories: MonthlyReportCategoryDto[];
  expanded: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onOpenCategory: (categoryId: string) => void;
}) {
  const { t } = useTranslation();
  const tone = kind === CategoryKind.EXPENSE ? 'text-destructive' : 'text-emerald-700';
  const signedAmount = (amount: number) => (kind === CategoryKind.EXPENSE ? -amount : amount);

  return (
    <>
      {categories.map((category) => {
        const key = category.categoryId ?? 'uncategorized';
        const expandable = hasSubcategoryBreakdown(category.subcategories);
        const isOpen = expanded.has(key);
        const name = category.name ?? t('reports.uncategorizedCategory');

        return (
          <Fragment key={key}>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-1">
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
                  {category.categoryId ? (
                    <button type="button" className="flex min-w-0 items-center gap-2 hover:underline" onClick={() => onOpenCategory(category.categoryId!)}>
                      <span className="size-2.5 flex-none rounded-sm" style={{ background: categoryColor(category.color) }} />
                      <span className="truncate font-medium">{name}</span>
                    </button>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 flex-none rounded-sm bg-muted-foreground/40" />
                      <span className="truncate font-medium">{name}</span>
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className={`num text-right ${tone}`}>{formatCents(signedAmount(category.amount), { sign: true })}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${category.percentage}%`, background: categoryColor(category.color) }} />
                  </div>
                  <span className="num w-12 flex-none text-right text-[12.5px]">{formatPercent(category.percentage)}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <AverageCell amount={category.amount} average={category.rollingAverage} kind={kind} />
              </TableCell>
              <TableCell className="num text-right">{category.count}</TableCell>
            </TableRow>
            {isOpen
              ? category.subcategories.map((subcategory: MonthlyReportSubcategoryDto) => (
                  <TableRow key={`${key}|${subcategory.subcategoryId ?? 'none'}`} className="bg-muted/30">
                    <TableCell>
                      <span className="ml-7 truncate text-[12.5px] text-muted-foreground">{subcategory.name ?? t('reports.noSubcategory')}</span>
                    </TableCell>
                    <TableCell className={`num text-right ${tone}`}>{formatCents(signedAmount(subcategory.amount), { sign: true })}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full opacity-60"
                            style={{ width: `${subcategory.percentage}%`, background: categoryColor(category.color) }}
                          />
                        </div>
                        <span className="num w-12 flex-none text-right text-[12.5px]">{formatPercent(subcategory.percentage)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <AverageCell amount={subcategory.amount} average={subcategory.rollingAverage} kind={kind} />
                    </TableCell>
                    <TableCell className="num text-right">{subcategory.count}</TableCell>
                  </TableRow>
                ))
              : null}
          </Fragment>
        );
      })}
    </>
  );
}

function CategoryTable({
  kind,
  titleKey,
  hintKey,
  categories,
  total,
  expanded,
  onToggle,
  onOpenCategory,
}: {
  kind: CategoryKind;
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  categories: MonthlyReportCategoryDto[];
  total: number;
  expanded: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onOpenCategory: (categoryId: string) => void;
}) {
  const { t } = useTranslation();
  const tone = kind === CategoryKind.EXPENSE ? 'text-destructive' : 'text-emerald-700';
  const signedTotal = kind === CategoryKind.EXPENSE ? -total : total;

  return (
    <section aria-labelledby={`reports-${kind}`} className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id={`reports-${kind}`} className="font-semibold">
          {t(titleKey)}
        </h2>
        <span className="text-[11.5px] text-muted-foreground">{t(hintKey)}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reports.monthly.category')}</TableHead>
            <TableHead className="text-right">{t('reports.monthly.amount')}</TableHead>
            <TableHead className="min-w-[170px]">{t('reports.monthly.percentage')}</TableHead>
            <TableHead className="min-w-[128px] text-right">
              <Tooltip>
                <TooltipTrigger className="decoration-dotted underline-offset-2 hover:underline">{t('reports.monthly.average')}</TooltipTrigger>
                <TooltipContent>{t('reports.monthly.averageTooltip')}</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="text-right">{t('reports.monthly.count')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <CategoryRows kind={kind} categories={categories} expanded={expanded} onToggle={onToggle} onOpenCategory={onOpenCategory} />
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t(kind === CategoryKind.EXPENSE ? 'reports.monthly.totalExpense' : 'reports.monthly.totalIncome')}</TableCell>
            <TableCell className={`num text-right ${tone}`}>{formatCents(signedTotal, { sign: true })}</TableCell>
            <TableCell>{formatPercent(100)}</TableCell>
            <TableCell className="text-right">—</TableCell>
            <TableCell className="num text-right">{categories.reduce((sum, category) => sum + category.count, 0)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </section>
  );
}

function CashboxBlock({ cashboxes }: { cashboxes: MonthlyReportCashboxesDto }) {
  const { t } = useTranslation();

  if (cashboxes.items.length === 0) return null;

  return (
    <section aria-labelledby="reports-cashboxes" className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="reports-cashboxes" className="flex items-center gap-2 font-semibold">
          <PiggyBankIcon className="size-4 text-cashbox" />
          {t('reports.monthly.cashboxes')}
        </h2>
        <Badge variant="outline">{t('reports.monthly.informational')}</Badge>
      </div>
      <p className="px-4 pt-3 text-[12.5px] text-muted-foreground">{t('reports.monthly.cashboxesHint')}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reports.monthly.cashbox')}</TableHead>
            <TableHead className="text-right">{t('reports.monthly.deposits')}</TableHead>
            <TableHead className="text-right">{t('reports.monthly.withdrawals')}</TableHead>
            <TableHead className="text-right">{t('reports.monthly.variation')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cashboxes.items.map((item) => (
            <TableRow key={item.cashboxId ?? item.name}>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.cashboxId === null ? <Badge variant="outline">{t('reports.monthly.deletedCashbox')}</Badge> : null}
                </span>
              </TableCell>
              <TableCell className="num text-right text-cashbox">{item.deposits === 0 ? '—' : formatCents(item.deposits)}</TableCell>
              <TableCell className="num text-right text-cashbox">{item.withdrawals === 0 ? '—' : formatCents(item.withdrawals)}</TableCell>
              <TableCell className="num text-right text-cashbox">{formatCents(item.balance, { sign: true })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t('reports.monthly.cashboxesVariation')}</TableCell>
            <TableCell className="num text-right text-cashbox">{formatCents(cashboxes.depositsTotal)}</TableCell>
            <TableCell className="num text-right text-cashbox">{formatCents(cashboxes.withdrawalsTotal)}</TableCell>
            <TableCell className="num text-right text-cashbox">{formatCents(cashboxes.balance, { sign: true })}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </section>
  );
}

/** The monthly view of `/reports` (M6-T03 step 2) — `09-reports-monthly.html`. */
export function ReportsMonthly({ year, month }: ReportsMonthlyProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, toggle] = useExpandedRows();
  const query = useGetMonthlyReport({ year, month });

  const openCategory = (categoryId: string) => {
    void navigate(`${monthPath(new Date(year, month - 1, 1))}?categoryId=${encodeURIComponent(categoryId)}`);
  };

  if (query.isPending) return <ReportsSkeleton />;

  if (query.isError) return <ReportsErrorState onRetry={() => void query.refetch()} />;

  const data = query.data;
  const expenseCategories = data.categories.filter((category) => category.kind === CategoryKind.EXPENSE);
  const incomeCategories = data.categories.filter((category) => category.kind === CategoryKind.INCOME);
  const empty = expenseCategories.length === 0 && incomeCategories.length === 0 && data.cashboxes.items.length === 0;

  if (empty) {
    return <EmptyState icon={PiggyBankIcon} title={t('reports.empty.title')} description={t('reports.empty.description')} />;
  }

  return (
    <div className="space-y-4">
      {expenseCategories.length > 0 ? (
        <CategoryTable
          kind={CategoryKind.EXPENSE}
          titleKey="reports.monthly.expenseTitle"
          hintKey="reports.monthly.expenseHint"
          categories={expenseCategories}
          total={data.expenseTotal}
          expanded={expanded}
          onToggle={toggle}
          onOpenCategory={openCategory}
        />
      ) : null}
      {incomeCategories.length > 0 ? (
        <CategoryTable
          kind={CategoryKind.INCOME}
          titleKey="reports.monthly.incomeTitle"
          hintKey="reports.monthly.incomeHint"
          categories={incomeCategories}
          total={data.incomeTotal}
          expanded={expanded}
          onToggle={toggle}
          onOpenCategory={openCategory}
        />
      ) : null}
      <CashboxBlock cashboxes={data.cashboxes} />
    </div>
  );
}
