import {
  CategoryKind,
  getGetBudgetQueryKey,
  type BudgetDto,
  type YearlyReportDto,
  useGetBudget,
  useGetYearlyReport,
  useListCategories,
  usePutBudget,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircleIcon, ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/empty-state';
import { FieldError } from '@/components/field-error';
import { LoadingSpinner } from '@/components/loading-spinner';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { formatCents, parseCurrencyInput } from '@/lib/money';

interface AllocationFields {
  targetPercentage: string;
  adjustedMonthlyAmount: string;
  note: string;
  autoAdjusted: boolean;
}

interface BudgetFields {
  income: string;
  note: string;
  allocations: Record<string, AllocationFields>;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
}

const EMPTY: BudgetFields = { income: '', note: '', allocations: {} };
const EMPTY_ALLOCATION: AllocationFields = { targetPercentage: '0', adjustedMonthlyAmount: '0,00', note: '', autoAdjusted: true };
const PERIODS = Array.from({ length: 404 }, (_, index) => ({ year: 2000 + Math.floor(index / 4), quarter: (index % 4) + 1 }));

export function BudgetPage() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const year = Number(params.year);
  const quarter = Number(params.quarter);
  const validPeriod = Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(quarter) && quarter >= 1 && quarter <= 4;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const budgetQuery = useGetBudget(year, quarter, { query: { enabled: validPeriod, retry: false } });
  const reportQuery = useGetYearlyReport({ year, compare: false }, { query: { enabled: validPeriod, retry: false } });
  const categoriesQuery = useListCategories(undefined, { query: { retry: false } });
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<BudgetFields>(EMPTY);
  const [saved, setSaved] = useState<BudgetFields>(EMPTY);
  const [saveFailed, setSaveFailed] = useState(false);
  const income = parseCurrencyInput(fields.income);
  const incomeError = editing && (income === null || income <= 0) ? t('budgets.incomeInvalid') : undefined;
  const activeCategories = useMemo(
    () => (categoriesQuery.data ?? []).filter((category) => category.parentId === null && category.kind === CategoryKind.EXPENSE),
    [categoriesQuery.data],
  );
  const categories = useMemo(() => mergeCategories(activeCategories, budgetQuery.data ?? undefined), [activeCategories, budgetQuery.data]);
  const allocationErrors = useMemo(() => allocationValidation(fields.allocations), [fields.allocations]);
  const dirtyCount = dirtyFields(fields, saved);
  const shouldBlock = dirtyCount > 0;
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!budgetQuery.isSuccess) return;
    const next = toFields(budgetQuery.data ?? undefined);
    // A period change replaces the autosave baseline with that route's server snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(next);
    setSaved(next);
    setEditing(Boolean(budgetQuery.data));
    setSaveFailed(false);
  }, [budgetQuery.data, budgetQuery.isSuccess]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(t('budgets.leaveWarning'))) blocker.proceed();
    else blocker.reset();
  }, [blocker, t]);

  useBeforeUnload((event) => {
    if (shouldBlock) event.preventDefault();
  });

  const mutation = usePutBudget({
    mutation: {
      onSuccess: (result) => {
        const next = toFields(result);
        setFields(next);
        setSaved(next);
        setSaveFailed(false);
        queryClient.setQueryData(getGetBudgetQueryKey(year, quarter), result);
      },
      onError: () => setSaveFailed(true),
    },
  });

  const save = useCallback(() => {
    if (income === null || income <= 0 || Object.keys(allocationErrors).length > 0 || dirtyCount === 0) return;
    mutation.mutate({
      year,
      quarter,
      data: {
        estimatedQuarterlyIncome: income,
        note: fields.note.trim() || null,
        allocations: categories.map((category) => {
          const allocation = fields.allocations[category.id] ?? EMPTY_ALLOCATION;
          return {
            categoryId: category.id,
            targetPercentage: parsePercentage(allocation.targetPercentage) ?? 0,
            adjustedMonthlyAmount: parseCurrencyInput(allocation.adjustedMonthlyAmount) ?? 0,
            note: allocation.note.trim() || null,
          };
        }),
      },
    });
  }, [allocationErrors, categories, dirtyCount, fields, income, mutation, quarter, year]);

  useEffect(() => {
    if (incomeError || Object.keys(allocationErrors).length > 0 || dirtyCount === 0 || mutation.isPending || saveFailed) return;
    const timer = window.setTimeout(save, 800);
    return () => window.clearTimeout(timer);
  }, [allocationErrors, fields, incomeError, dirtyCount, mutation.isPending, save, saveFailed]);

  const title = useMemo(() => quarterTitle(year, quarter, i18n.language), [i18n.language, quarter, year]);
  const derived = useMemo(() => deriveTotals(fields, income), [fields, income]);
  const review = useMemo(
    () => (reportQuery.data ? deriveQuarterReview(reportQuery.data, quarter, derived.expenses, income) : undefined),
    [derived.expenses, income, quarter, reportQuery.data],
  );
  const move = (offset: number) => {
    const index = year * 4 + quarter - 1 + offset;
    void navigate(`/budgets/${Math.floor(index / 4)}/${(index % 4) + 1}`);
  };
  const changeAllocation = (categoryId: string, field: Exclude<keyof AllocationFields, 'autoAdjusted'>, value: string) => {
    setSaveFailed(false);
    setFields((current) => ({
      ...current,
      allocations: {
        ...current.allocations,
        [categoryId]: updateAllocation(current.allocations[categoryId] ?? EMPTY_ALLOCATION, field, value, parseCurrencyInput(current.income)),
      },
    }));
  };
  const resetAllocation = (categoryId: string, suggestion: number) => {
    setSaveFailed(false);
    setFields((current) => ({
      ...current,
      allocations: {
        ...current.allocations,
        [categoryId]: { ...(current.allocations[categoryId] ?? EMPTY_ALLOCATION), adjustedMonthlyAmount: currencyInput(suggestion), autoAdjusted: true },
      },
    }));
  };
  const changeIncome = (value: string) => {
    setSaveFailed(false);
    setFields((current) => ({ ...current, income: value, allocations: recalculateAutoAdjusted(current.allocations, parseCurrencyInput(value)) }));
  };

  if (!validPeriod) return <Navigate to="/budgets" replace />;

  return (
    <>
      <PageHeader
        title={t('budgets.title')}
        actions={
          <nav className="flex items-center gap-1" aria-label={t('budgets.quarterNavigation')}>
            <Button variant="ghost" size="icon-sm" aria-label={t('budgets.previousQuarter')} onClick={() => move(-1)} disabled={year === 2000 && quarter === 1}>
              <ChevronLeftIcon />
            </Button>
            <Label className="sr-only" htmlFor="budget-quarter">
              {t('budgets.quarter')}
            </Label>
            <NativeSelect
              id="budget-quarter"
              className="w-auto min-w-36"
              value={`${year}-${quarter}`}
              onChange={(event) => void navigate(`/budgets/${event.target.value.replace('-', '/')}`)}
            >
              {PERIODS.map((period) => (
                <option key={`${period.year}-${period.quarter}`} value={`${period.year}-${period.quarter}`}>
                  {t('budgets.quarterOption', period)}
                </option>
              ))}
            </NativeSelect>
            <Button variant="ghost" size="icon-sm" aria-label={t('budgets.nextQuarter')} onClick={() => move(1)} disabled={year === 2100 && quarter === 4}>
              <ChevronRightIcon />
            </Button>
          </nav>
        }
      />
      <PageContent className="space-y-4">
        {budgetQuery.isPending ? (
          <LoadingSpinner label={t('budgets.loading')} className="py-16" />
        ) : budgetQuery.isError ? (
          <EmptyState
            icon={AlertCircleIcon}
            title={t('budgets.loadErrorTitle')}
            description={t('budgets.loadErrorDescription')}
            action={<Button onClick={() => void budgetQuery.refetch()}>{t('common.retry')}</Button>}
          />
        ) : !editing ? (
          <EmptyState
            icon={SlidersHorizontalIcon}
            title={t('budgets.emptyTitle', { quarter, year })}
            description={t('budgets.emptyDescription')}
            action={<Button onClick={() => setEditing(true)}>{t('budgets.startIncome')}</Button>}
          />
        ) : categoriesQuery.isError ? (
          <EmptyState
            icon={AlertCircleIcon}
            title={t('budgets.categoriesLoadErrorTitle')}
            description={t('budgets.categoriesLoadErrorDescription')}
            action={<Button onClick={() => void categoriesQuery.refetch()}>{t('common.retry')}</Button>}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                <p className="text-sm text-muted-foreground">{t('budgets.description')}</p>
              </div>
              <SaveStatus
                pending={mutation.isPending}
                failed={saveFailed}
                invalid={Boolean(incomeError) || Object.keys(allocationErrors).length > 0}
                dirtyCount={dirtyCount}
                onRetry={save}
              />
            </div>
            <div className="grid items-start gap-3 shell:grid-cols-budget-layout">
              <div className="min-w-0 space-y-4">
                {categoriesQuery.isPending ? (
                  <LoadingSpinner label={t('budgets.categoriesLoading')} className="py-16" />
                ) : (
                  <AllocationTable
                    categories={categories}
                    fields={fields.allocations}
                    income={income}
                    errors={allocationErrors}
                    onChange={changeAllocation}
                    onReset={resetAllocation}
                  />
                )}
                <QuarterReview query={reportQuery} review={review} onRetry={() => void reportQuery.refetch()} />
              </div>
              <QuarterCard
                fields={fields}
                incomeError={incomeError}
                derived={derived}
                review={review}
                onIncome={changeIncome}
                onNote={(value) => {
                  setSaveFailed(false);
                  setFields((current) => ({ ...current, note: value }));
                }}
              />
            </div>
          </>
        )}
      </PageContent>
    </>
  );
}

function AllocationTable({
  categories,
  fields,
  income,
  errors,
  onChange,
  onReset,
}: {
  categories: Category[];
  fields: Record<string, AllocationFields>;
  income: number | null;
  errors: Record<string, string>;
  onChange: (categoryId: string, field: Exclude<keyof AllocationFields, 'autoAdjusted'>, value: string) => void;
  onReset: (categoryId: string, suggestion: number) => void;
}) {
  const { t } = useTranslation();
  const totals = deriveTotals({ income: '', note: '', allocations: fields }, income);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{t('budgets.allocationTitle')}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t('budgets.allocationDescription')}</p>
        </div>
        <span className="text-xs text-muted-foreground">{t('budgets.categoryCount', { count: categories.length })}</span>
      </CardHeader>
      <CardContent>
        {categories.length === 0 && <p className="mb-3 text-sm text-muted-foreground">{t('budgets.noExpenseCategories')}</p>}
        <div role="table" className="overflow-hidden rounded-md border">
          <div
            role="row"
            className="hidden grid-cols-budget-allocation gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground shell:grid"
          >
            <div role="columnheader">{t('budgets.category')}</div>
            <div role="columnheader">{t('budgets.targetPercentage')}</div>
            <div role="columnheader" className="text-right">
              {t('budgets.quarterlyTarget')}
            </div>
            <div role="columnheader">{t('budgets.adjustedMonthly')}</div>
            <div role="columnheader" className="text-right">
              {t('budgets.effectivePercentage')}
            </div>
            <div role="columnheader">{t('budgets.allocationNote')}</div>
          </div>
          {categories.map((category) => {
            const allocation = fields[category.id] ?? EMPTY_ALLOCATION;
            const percentage = parsePercentage(allocation.targetPercentage);
            const monthly = parseCurrencyInput(allocation.adjustedMonthlyAmount);
            const suggestion = income !== null && percentage !== null ? suggestedMonthlyTarget(income, percentage) : null;
            const quarterly = income !== null && percentage !== null ? suggestedQuarterlyTarget(income, percentage) : null;
            const effectiveQuarterly = monthly === null ? null : monthly * 3;
            const effectivePercentage = income !== null && income > 0 && effectiveQuarterly !== null ? percentageOf(effectiveQuarterly, income) : null;
            const error = errors[category.id];
            return (
              <div
                key={category.id}
                role="row"
                className={`grid gap-x-3 gap-y-2 border-b px-3 py-3 last:border-b-0 shell:grid-cols-budget-allocation shell:items-center ${category.isActive ? '' : 'bg-muted/30 text-muted-foreground'}`}
              >
                <div role="cell" className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: category.color ?? 'currentColor' }} />
                  <span className="truncate text-sm font-semibold">{category.name}</span>
                  {!category.isActive && <span className="text-xs">{t('budgets.inactive')}</span>}
                </div>
                <div role="cell" className="space-y-1">
                  <Label className="shell:hidden" htmlFor={`percentage-${category.id}`}>
                    {t('budgets.targetPercentage')}
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id={`percentage-${category.id}`}
                      inputMode="decimal"
                      value={allocation.targetPercentage}
                      aria-label={t('budgets.targetPercentageFor', { category: category.name })}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `allocation-error-${category.id}` : undefined}
                      onChange={(event) => onChange(category.id, 'targetPercentage', event.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <FieldError id={`allocation-error-${category.id}`} error={error === 'percentage' ? t('budgets.percentageInvalid') : undefined} />
                </div>
                <div role="cell" className="num text-right text-sm font-medium">
                  <span className="shell:hidden text-xs text-muted-foreground">{t('budgets.quarterlyTarget')}</span>
                  <div>{formatCents(quarterly)}</div>
                </div>
                <div role="cell" className="space-y-1">
                  <Label className="shell:hidden" htmlFor={`monthly-${category.id}`}>
                    {t('budgets.adjustedMonthly')}
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id={`monthly-${category.id}`}
                      inputMode="decimal"
                      value={allocation.adjustedMonthlyAmount}
                      aria-label={t('budgets.adjustedMonthlyFor', { category: category.name })}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `allocation-error-${category.id}` : undefined}
                      onChange={(event) => onChange(category.id, 'adjustedMonthlyAmount', event.target.value)}
                    />
                    {suggestion !== null && monthly !== suggestion && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('budgets.resetCalculated', { category: category.name })}
                        onClick={() => onReset(category.id, suggestion)}
                      >
                        <RotateCcwIcon />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('budgets.monthlyTarget', { amount: formatCents(suggestion) })}</p>
                  <FieldError id={`allocation-error-${category.id}`} error={error === 'monthly' ? t('budgets.monthlyInvalid') : undefined} />
                </div>
                <div role="cell" className="num text-right text-sm font-medium">
                  <span className="shell:hidden text-xs text-muted-foreground">{t('budgets.effectivePercentage')}</span>
                  <div>{effectivePercentage === null ? '—' : `${formatPercentage(effectivePercentage)}%`}</div>
                </div>
                <div role="cell">
                  <Label className="shell:hidden" htmlFor={`note-${category.id}`}>
                    {t('budgets.allocationNote')}
                  </Label>
                  <Textarea
                    id={`note-${category.id}`}
                    rows={2}
                    maxLength={2000}
                    value={allocation.note}
                    aria-label={t('budgets.noteFor', { category: category.name })}
                    onChange={(event) => onChange(category.id, 'note', event.target.value)}
                    placeholder={t('budgets.notePlaceholder')}
                  />
                </div>
              </div>
            );
          })}
          <div role="row" className="grid gap-x-3 gap-y-1 bg-muted/50 px-3 py-3 text-sm font-medium shell:grid-cols-budget-allocation">
            <div role="cell">{t('budgets.total')}</div>
            <div role="cell">{formatPercentage(totals.targetPercentage)}%</div>
            <div role="cell" className="text-right tabular-nums">
              {formatCents(totals.suggestedQuarterly)}
            </div>
            <div role="cell" className="text-right tabular-nums">
              {formatCents(totals.expenses / 3)}
            </div>
            <div role="cell" className="text-right tabular-nums">
              {totals.expensePercentage === null ? '—' : `${formatPercentage(totals.expensePercentage)}%`}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuarterCard({
  fields,
  incomeError,
  derived,
  review,
  onIncome,
  onNote,
}: {
  fields: BudgetFields;
  incomeError: string | undefined;
  derived: ReturnType<typeof deriveTotals>;
  review: ReturnType<typeof deriveQuarterReview> | undefined;
  onIncome: (value: string) => void;
  onNote: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="shell:sticky shell:top-21">
      <CardHeader>
        <CardTitle>{t('budgets.yourQuarter')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('budgets.planned')}</h3>
          <div className="space-y-1.5">
            <Label htmlFor="estimated-income">{t('budgets.estimatedIncome')}</Label>
            <Input
              id="estimated-income"
              inputMode="decimal"
              value={fields.income}
              aria-invalid={Boolean(incomeError)}
              aria-describedby={incomeError ? 'estimated-income-error' : undefined}
              onChange={(event) => onIncome(event.target.value)}
            />
            <FieldError id="estimated-income-error" error={incomeError} />
          </div>
          <SummaryLine label={t('budgets.plannedExpenses')} amount={derived.expenses} percentage={derived.expensePercentage} negative />
          <SummaryLine
            label={t('budgets.financialGoals')}
            amount={derived.availability}
            percentage={derived.availabilityPercentage}
            positive={derived.availability >= 0}
          />
          {derived.availability < 0 && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {t('budgets.overAllocated', { amount: formatCents(Math.abs(derived.availability)) })}
            </p>
          )}
        </section>
        {review && (
          <section className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">{t('budgets.realized')}</h3>
            <SummaryLine label={t('budgets.realizedIncome')} amount={review.income} percentage={null} positive />
            <SummaryLine label={t('budgets.realizedExpenses')} amount={review.expenses} percentage={null} negative />
            <SummaryLine label={t('budgets.realizedSurplus')} amount={review.surplus} percentage={null} positive={review.surplus >= 0} />
          </section>
        )}
        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">{t('budgets.quarterNote')}</h3>
          <Label className="sr-only" htmlFor="budget-note">
            {t('budgets.quarterNote')}
          </Label>
          <Textarea
            id="budget-note"
            rows={3}
            maxLength={2000}
            value={fields.note}
            onChange={(event) => onNote(event.target.value)}
            placeholder={t('budgets.notePlaceholder')}
          />
        </section>
      </CardContent>
    </Card>
  );
}

function QuarterReview({
  query,
  review,
  onRetry,
}: {
  query: { isPending: boolean; isError: boolean };
  review: ReturnType<typeof deriveQuarterReview> | undefined;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();

  if (query.isPending) return <LoadingSpinner label={t('budgets.actualLoading')} className="py-8" />;
  if (query.isError) {
    return (
      <EmptyState
        icon={AlertCircleIcon}
        title={t('budgets.actualLoadErrorTitle')}
        description={t('budgets.actualLoadErrorDescription')}
        action={
          <Button variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }
  if (!review?.hasActivity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('budgets.reviewTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('budgets.noActualActivity')}</p>
        </CardContent>
      </Card>
    );
  }

  const monthFormatter = new Intl.DateTimeFormat(i18n.language, { month: 'long' });
  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label={t('budgets.reviewTitle')}>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <CardTitle>{t('budgets.incomeReview')}</CardTitle>
          <span className={`num text-sm font-semibold ${review.variance < 0 ? 'text-destructive' : 'text-primary'}`}>
            {formatCents(review.variance, { sign: true })}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <SummaryLine label={t('budgets.estimatedIncome')} amount={review.estimatedIncome} percentage={null} />
          <SummaryLine label={t('budgets.realizedIncome')} amount={review.income} percentage={null} positive />
          <SummaryLine
            label={t('budgets.incomeVariance')}
            amount={review.variance}
            percentage={review.variancePercentage}
            positive={review.variance >= 0}
            negative={review.variance < 0}
          />
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">{t('budgets.incomeByMonth')}</h3>
            {review.months.map((month) => (
              <SummaryLine
                key={month.month}
                label={monthFormatter.format(new Date(2000, month.month - 1, 1))}
                amount={month.income}
                percentage={null}
                positive
              />
            ))}
          </div>
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">{t('budgets.incomeByCategory')}</h3>
            {review.incomeCategories.map((category) => (
              <SummaryLine
                key={category.categoryId ?? category.name}
                label={category.name ?? t('reports.uncategorizedCategory')}
                amount={category.amount}
                percentage={null}
                positive
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('budgets.expenseReview')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SummaryLine label={t('budgets.plannedExpenses')} amount={review.plannedExpenses} percentage={null} negative />
          <SummaryLine label={t('budgets.realizedExpenses')} amount={review.expenses} percentage={null} negative />
          <SummaryLine
            label={t('budgets.remainingBudget')}
            amount={review.remainingBudget}
            percentage={null}
            positive={review.remainingBudget >= 0}
            negative={review.remainingBudget < 0}
          />
          <p className="border-t pt-3 text-xs text-muted-foreground">{t('budgets.remainingBudgetDescription')}</p>
        </CardContent>
      </Card>
    </section>
  );
}

function SummaryLine({
  label,
  amount,
  percentage,
  negative,
  positive,
}: {
  label: string;
  amount: number;
  percentage: number | null;
  negative?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right tabular-nums ${negative ? 'text-destructive' : positive ? 'text-primary' : ''}`}>
        {formatCents(amount)}
        {percentage !== null && <small className="block text-xs text-muted-foreground">{formatPercentage(percentage)}%</small>}
      </span>
    </div>
  );
}

function SaveStatus({
  pending,
  failed,
  invalid,
  dirtyCount,
  onRetry,
}: {
  pending: boolean;
  failed: boolean;
  invalid: boolean;
  dirtyCount: number;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const message = invalid
    ? t('budgets.invalidStatus')
    : pending
      ? t('budgets.saving')
      : failed
        ? t('budgets.saveFailed')
        : dirtyCount > 0
          ? t('budgets.unsaved', { count: dirtyCount })
          : t('budgets.saved');
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-h-9 items-center gap-2 text-xs ${failed || invalid ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      <span className={`size-2 rounded-full bg-current ${pending ? 'animate-pulse' : ''}`} />
      <span>{message}</span>
      {failed && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

function mergeCategories(active: (Category & { parentId: string | null })[], budget: BudgetDto | undefined): Category[] {
  const categories = new Map<string, Category>(active.map((category) => [category.id, category]));
  for (const allocation of budget?.allocations ?? []) {
    if (allocation.category) categories.set(allocation.categoryId, allocation.category);
  }
  return [...categories.values()];
}

function toFields(budget: BudgetDto | undefined): BudgetFields {
  if (!budget) return EMPTY;
  return {
    income: currencyInput(budget.estimatedQuarterlyIncome),
    note: budget.note ?? '',
    allocations: Object.fromEntries(
      budget.allocations.map((allocation) => [
        allocation.categoryId,
        {
          targetPercentage: String(allocation.targetPercentage),
          adjustedMonthlyAmount: currencyInput(allocation.adjustedMonthlyAmount),
          note: allocation.note ?? '',
          autoAdjusted: false,
        },
      ]),
    ),
  };
}

function dirtyFields(fields: BudgetFields, saved: BudgetFields): number {
  let count = Number(fields.income !== saved.income) + Number(fields.note !== saved.note);
  for (const categoryId of new Set([...Object.keys(fields.allocations), ...Object.keys(saved.allocations)])) {
    const current = fields.allocations[categoryId] ?? EMPTY_ALLOCATION;
    const baseline = saved.allocations[categoryId] ?? EMPTY_ALLOCATION;
    count +=
      Number(current.targetPercentage !== baseline.targetPercentage) +
      Number(current.adjustedMonthlyAmount !== baseline.adjustedMonthlyAmount) +
      Number(current.note !== baseline.note);
  }
  return count;
}

function allocationValidation(allocations: Record<string, AllocationFields>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(allocations).flatMap(([categoryId, allocation]) => {
      const percentage = parsePercentage(allocation.targetPercentage);
      if (percentage === null || percentage < 0 || percentage > 100) return [[categoryId, 'percentage']];
      const monthly = parseCurrencyInput(allocation.adjustedMonthlyAmount);
      return monthly === null || monthly < 0 ? [[categoryId, 'monthly']] : [];
    }),
  );
}

function updateAllocation(
  allocation: AllocationFields,
  field: Exclude<keyof AllocationFields, 'autoAdjusted'>,
  value: string,
  income: number | null,
): AllocationFields {
  const next = { ...allocation, [field]: value, autoAdjusted: field === 'adjustedMonthlyAmount' ? false : allocation.autoAdjusted };
  const percentage = parsePercentage(next.targetPercentage);
  if (next.autoAdjusted && income !== null && percentage !== null) next.adjustedMonthlyAmount = currencyInput(suggestedMonthlyTarget(income, percentage));
  return next;
}

function recalculateAutoAdjusted(allocations: Record<string, AllocationFields>, income: number | null): Record<string, AllocationFields> {
  if (income === null) return allocations;
  return Object.fromEntries(
    Object.entries(allocations).map(([categoryId, allocation]) => {
      const percentage = parsePercentage(allocation.targetPercentage);
      return [
        categoryId,
        allocation.autoAdjusted && percentage !== null
          ? { ...allocation, adjustedMonthlyAmount: currencyInput(suggestedMonthlyTarget(income, percentage)) }
          : allocation,
      ];
    }),
  );
}

function deriveTotals(fields: BudgetFields, income: number | null) {
  let expenses = 0;
  let suggestedQuarterly = 0;
  let targetPercentage = 0;
  for (const allocation of Object.values(fields.allocations)) {
    const percentage = parsePercentage(allocation.targetPercentage) ?? 0;
    targetPercentage += percentage;
    if (income !== null) suggestedQuarterly += suggestedQuarterlyTarget(income, percentage);
    const monthly = parseCurrencyInput(allocation.adjustedMonthlyAmount);
    if (monthly !== null && monthly >= 0) expenses += monthly * 3;
  }
  const availability = (income ?? 0) - expenses;
  return {
    expenses,
    suggestedQuarterly,
    targetPercentage,
    expensePercentage: income !== null && income > 0 ? percentageOf(expenses, income) : null,
    availability,
    availabilityPercentage: income !== null && income > 0 ? percentageOf(availability, income) : null,
  };
}

function deriveQuarterReview(report: YearlyReportDto, quarter: number, plannedExpenses: number, estimatedIncome: number | null) {
  const start = (quarter - 1) * 3;
  const months = report.months.slice(start, start + 3);
  const income = months.reduce((total, month) => total + month.income, 0);
  const expenses = months.reduce((total, month) => total + month.expense, 0);
  const incomeCategories = report.categories
    .filter((category) => category.kind === CategoryKind.INCOME)
    .map((category) => ({ ...category, amount: category.monthly.slice(start, start + 3).reduce((total, amount) => total + amount, 0) }))
    .filter((category) => category.amount > 0);
  const estimated = estimatedIncome ?? 0;
  const variance = income - estimated;

  return {
    months,
    income,
    expenses,
    incomeCategories,
    estimatedIncome: estimated,
    plannedExpenses,
    remainingBudget: plannedExpenses - expenses,
    surplus: income - expenses,
    variance,
    variancePercentage: estimated > 0 ? percentageOf(variance, estimated) : null,
    hasActivity: income !== 0 || expenses !== 0,
  };
}

function parsePercentage(value: string): number | null {
  if (value.trim() === '') return 0;
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(value.trim())) return null;
  const percentage = Number(value.replace(',', '.'));
  return Number.isFinite(percentage) ? percentage : null;
}

function suggestedQuarterlyTarget(income: number, percentage: number): number {
  return Math.round((income * Math.round(percentage * 100)) / 10_000);
}
function suggestedMonthlyTarget(income: number, percentage: number): number {
  return Math.round(suggestedQuarterlyTarget(income, percentage) / 3);
}
function percentageOf(amount: number, total: number): number {
  return Math.round((amount * 10_000) / total) / 100;
}
function currencyInput(cents: number): string {
  return formatCents(cents).replace(/\s?€$/, '');
}
function formatPercentage(value: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
function quarterTitle(year: number, quarter: number, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  const first = formatter.format(new Date(year, (quarter - 1) * 3, 1));
  const last = formatter.format(new Date(year, quarter * 3 - 1, 1));
  return `${first.charAt(0).toUpperCase()}${first.slice(1)} — ${last}${locale.startsWith('pt') ? ' de ' : ' '}${year}`;
}
