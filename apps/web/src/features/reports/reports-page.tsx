import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportsMonthly } from '@/features/reports/reports-monthly';
import { ReportsYearly } from '@/features/reports/reports-yearly';
import { MonthPicker } from '@/features/transactions/month-page';

type ReportView = 'monthly' | 'yearly';

function parseInRange(value: string | null, min: number, max: number, fallback: number): number {
  const parsed = value === null ? NaN : Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

/**
 * `/reports` — M6-T03. State lives entirely in the URL (`?view=&year=&month=&compare=`), not in
 * `useState`: that is what makes a linked cell (Step 4) and a reloaded or shared `/reports` URL
 * restore the same screen. The segmented control only offers monthly/yearly today — charts land in
 * M6-T04 — but `ReportView` is already the open union a third tab extends.
 */
export function ReportsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();

  const view: ReportView = searchParams.get('view') === 'yearly' ? 'yearly' : 'monthly';
  const year = parseInRange(searchParams.get('year'), 2000, 2100, now.getFullYear());
  const month = parseInRange(searchParams.get('month'), 1, 12, now.getMonth() + 1);
  const compare = searchParams.get('compare') === '1';
  const referenceMonth = new Date(year, month - 1, 1);

  const update = (patch: Record<string, string | undefined>) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  const setView = (next: ReportView) => update({ view: next === 'monthly' ? undefined : next });
  const selectMonth = (next: Date) => update({ year: String(next.getFullYear()), month: String(next.getMonth() + 1) });
  const moveMonth = (offset: number) => selectMonth(new Date(referenceMonth.getFullYear(), referenceMonth.getMonth() + offset, 1));
  const moveYear = (offset: number) => update({ year: String(year + offset) });

  return (
    <>
      <PageHeader
        title={
          <Tabs value={view} onValueChange={(value) => setView(value as ReportView)}>
            <TabsList>
              <TabsTrigger value="monthly">{t('reports.view.monthly')}</TabsTrigger>
              <TabsTrigger value="yearly">{t('reports.view.yearly')}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        actions={
          view === 'monthly' ? (
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={t('transactions.previousMonth')} onClick={() => moveMonth(-1)}>
                <ChevronLeftIcon />
              </Button>
              <MonthPicker key={referenceMonth.toISOString()} month={referenceMonth} onSelect={selectMonth} />
              <Button variant="ghost" size="icon-sm" aria-label={t('transactions.nextMonth')} onClick={() => moveMonth(1)}>
                <ChevronRightIcon />
              </Button>
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Checkbox checked={compare} onCheckedChange={(checked) => update({ compare: checked === true ? '1' : undefined })} />
                {t('reports.yearly.compare', { year: year - 1 })}
              </label>
              <span className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={t('reports.yearly.previousYear')} onClick={() => moveYear(-1)}>
                  <ChevronLeftIcon />
                </Button>
                <strong className="num min-w-[52px] text-center font-display text-[1.05rem] font-bold">{year}</strong>
                <Button variant="ghost" size="icon-sm" aria-label={t('reports.yearly.nextYear')} onClick={() => moveYear(1)}>
                  <ChevronRightIcon />
                </Button>
              </span>
            </div>
          )
        }
      />
      <PageContent className="space-y-4">
        {view === 'monthly' ? <ReportsMonthly year={year} month={month} /> : <ReportsYearly year={year} compare={compare} />}
      </PageContent>
    </>
  );
}
