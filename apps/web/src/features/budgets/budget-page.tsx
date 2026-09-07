import { getGetBudgetQueryKey, useGetBudget, usePutBudget } from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircleIcon, ChevronLeftIcon, ChevronRightIcon, SlidersHorizontalIcon } from 'lucide-react';
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

const EMPTY = { income: '', note: '' };
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
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(EMPTY);
  const [saved, setSaved] = useState(EMPTY);
  const [saveFailed, setSaveFailed] = useState(false);
  const income = parseCurrencyInput(fields.income);
  const incomeError = editing && (income === null || income <= 0) ? t('budgets.incomeInvalid') : undefined;
  const dirtyCount = Number(fields.income !== saved.income) + Number(fields.note !== saved.note);
  const shouldBlock = dirtyCount > 0;
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!budgetQuery.isSuccess) return;
    const next = budgetQuery.data
      ? { income: formatCents(budgetQuery.data.estimatedQuarterlyIncome).replace(/\s?€$/, ''), note: budgetQuery.data.note ?? '' }
      : EMPTY;
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
        const next = { income: formatCents(result.estimatedQuarterlyIncome).replace(/\s?€$/, ''), note: result.note ?? '' };
        setFields(next);
        setSaved(next);
        setSaveFailed(false);
        queryClient.setQueryData(getGetBudgetQueryKey(year, quarter), result);
      },
      onError: () => setSaveFailed(true),
    },
  });

  const save = useCallback(() => {
    if (income === null || income <= 0 || dirtyCount === 0) return;
    mutation.mutate({ year, quarter, data: { estimatedQuarterlyIncome: income, note: fields.note.trim() || null } });
  }, [dirtyCount, fields.note, income, mutation, quarter, year]);

  useEffect(() => {
    if (incomeError || dirtyCount === 0 || mutation.isPending || saveFailed) return;
    const timer = window.setTimeout(save, 800);
    return () => window.clearTimeout(timer);
  }, [fields.income, fields.note, incomeError, dirtyCount, mutation.isPending, save, saveFailed]);

  const title = useMemo(() => quarterTitle(year, quarter, i18n.language), [i18n.language, quarter, year]);
  const move = (offset: number) => {
    const index = year * 4 + quarter - 1 + offset;
    void navigate(`/budgets/${Math.floor(index / 4)}/${(index % 4) + 1}`);
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
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                <p className="text-sm text-muted-foreground">{t('budgets.description')}</p>
              </div>
              <SaveStatus pending={mutation.isPending} failed={saveFailed} invalid={Boolean(incomeError)} dirtyCount={dirtyCount} onRetry={save} />
            </div>
            <div className="shell:flex shell:justify-end">
              <Card className="w-full shell:max-w-sm">
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
                        aria-describedby="estimated-income-help estimated-income-error"
                        onChange={(event) => {
                          setSaveFailed(false);
                          setFields((current) => ({ ...current, income: event.target.value }));
                        }}
                      />
                      <p id="estimated-income-help" className="text-xs text-muted-foreground">
                        {t('budgets.incomeHelp')}
                      </p>
                      <FieldError id="estimated-income-error" error={incomeError} />
                    </div>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">{t('budgets.quarterNote')}</h3>
                    <Label className="sr-only" htmlFor="budget-note">
                      {t('budgets.quarterNote')}
                    </Label>
                    <Textarea
                      id="budget-note"
                      rows={4}
                      maxLength={2000}
                      value={fields.note}
                      onChange={(event) => {
                        setSaveFailed(false);
                        setFields((current) => ({ ...current, note: event.target.value }));
                      }}
                      placeholder={t('budgets.notePlaceholder')}
                    />
                  </section>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </PageContent>
    </>
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
      <span className={`size-2 rounded-full bg-current ${pending ? 'animate-pulse' : ''}`} /> <span>{message}</span>
      {failed && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

function quarterTitle(year: number, quarter: number, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  const first = formatter.format(new Date(year, (quarter - 1) * 3, 1));
  const last = formatter.format(new Date(year, quarter * 3 - 1, 1));
  return `${first.charAt(0).toUpperCase()}${first.slice(1)} — ${last}${locale.startsWith('pt') ? ' de ' : ' '}${year}`;
}
