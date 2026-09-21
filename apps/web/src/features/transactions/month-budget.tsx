import { CategoryKind, useGetBudget, useGetMonthlyReport } from '@family-budget/api-client';
import { ChevronRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { categoryColor } from '@/features/reports/report-format';
import { formatCents } from '@/lib/money';

interface MonthBudgetProps {
  year: number;
  month: number;
  onSelectCategory: (categoryId: string) => void;
}

export function MonthBudget({ year, month, onSelectCategory }: MonthBudgetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const quarter = Math.floor((month - 1) / 3) + 1;
  const budgetQuery = useGetBudget(year, quarter);
  const reportQuery = useGetMonthlyReport({ year, month });
  const isBudgetMissing = !budgetQuery.data && (!budgetQuery.isError || (budgetQuery.error as { response?: { status?: number } }).response?.status === 404);

  const rows = useMemo(() => {
    if (!budgetQuery.data || !reportQuery.data) return [];

    const spending = new Map(
      reportQuery.data.categories.filter((category) => category.kind === CategoryKind.EXPENSE).map((category) => [category.categoryId, category]),
    );
    const allocations = new Map(budgetQuery.data.allocations.map((allocation) => [allocation.categoryId, allocation]));

    return [...new Set([...allocations.keys(), ...spending.keys()])].map((categoryId) => {
      const allocation = categoryId === null ? undefined : allocations.get(categoryId);
      const actual = spending.get(categoryId);
      const budget = allocation?.adjustedMonthlyAmount ?? 0;
      const spent = actual?.amount ?? 0;
      return {
        categoryId,
        name: allocation?.category.name ?? actual?.name ?? t('transactions.budget.uncategorized'),
        color: allocation?.category.color ?? actual?.color ?? null,
        budget,
        spent,
        available: budget - spent,
      };
    });
  }, [budgetQuery.data, reportQuery.data, t]);

  if (budgetQuery.isPending) {
    return <Skeleton aria-label={t('transactions.budget.loading')} className="h-28 w-full" />;
  }

  if (isBudgetMissing) {
    return (
      <section aria-labelledby="month-budget" className="mt-3 border-t pt-3">
        <h3 id="month-budget" className="font-semibold">
          {t('transactions.budget.title')}
        </h3>
        <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0 text-field">
          <Link to={`/budgets/${year}/${quarter}`}>{t('transactions.budget.create', { quarter })}</Link>
        </Button>
      </section>
    );
  }

  if (budgetQuery.isError || reportQuery.isError) {
    return (
      <section aria-labelledby="month-budget" className="mt-3 border-t pt-3">
        <h3 id="month-budget" className="font-semibold">
          {t('transactions.budget.title')}
        </h3>
        <p className="mt-1 text-field text-muted-foreground">{t('transactions.budget.error')}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 text-field"
          onClick={() => {
            void budgetQuery.refetch();
            void reportQuery.refetch();
          }}
        >
          {t('common.retry')}
        </Button>
      </section>
    );
  }

  if (reportQuery.isPending || !budgetQuery.data || !reportQuery.data) {
    return <Skeleton aria-label={t('transactions.budget.loading')} className="h-28 w-full" />;
  }

  const totalBudget = budgetQuery.data.allocations.reduce((total, allocation) => total + allocation.adjustedMonthlyAmount, 0);
  const totalSpending = reportQuery.data.expenseTotal;
  const available = totalBudget - totalSpending;

  return (
    <section aria-labelledby="month-budget" className="mt-3 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="month-budget" className="font-semibold">
          {t('transactions.budget.title')}
        </h3>
        <Button variant="ghost" size="sm" aria-expanded={open} aria-controls="month-budget-detail" onClick={() => setOpen((value) => !value)}>
          {t(open ? 'transactions.budget.hide' : 'transactions.budget.show')}
          <ChevronRightIcon className={open ? 'rotate-90' : ''} />
        </Button>
      </div>
      <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
        <BudgetMetric label={t('transactions.budget.planned')} amount={totalBudget} />
        <BudgetMetric label={t('transactions.expense')} amount={-totalSpending} tone="text-destructive" />
        <BudgetMetric label={t('transactions.budget.available')} amount={available} tone={available < 0 ? 'text-destructive' : undefined} />
      </div>
      {open ? (
        <div id="month-budget-detail" className="mt-3 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('transactions.budget.category')}</TableHead>
                <TableHead className="text-right">{t('transactions.budget.planned')}</TableHead>
                <TableHead className="text-right">{t('transactions.expense')}</TableHead>
                <TableHead className="text-right">{t('transactions.budget.available')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.categoryId ?? 'uncategorized'}>
                  <TableCell>
                    {row.categoryId ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="min-w-0 justify-start px-0 text-sm hover:underline"
                        onClick={() => onSelectCategory(row.categoryId!)}
                      >
                        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: categoryColor(row.color) }} />
                        <span className="truncate">{row.name}</span>
                      </Button>
                    ) : (
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="size-2.5 shrink-0 rounded-sm bg-muted-foreground/40" />
                        <span className="truncate">{row.name}</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="num text-right">{formatCents(row.budget)}</TableCell>
                  <TableCell className="num text-right text-destructive">{formatCents(-row.spent, { sign: true })}</TableCell>
                  <TableCell className={`num text-right ${row.available < 0 ? 'text-destructive' : ''}`}>
                    {formatCents(row.available, { sign: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}

function BudgetMetric({ label, amount, tone }: { label: string; amount: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num font-semibold ${tone ?? ''}`}>{formatCents(amount, { sign: amount < 0 })}</span>
    </div>
  );
}
