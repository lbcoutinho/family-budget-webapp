import { type RecurrenceRuleDto } from '@family-budget/api-client';
import { useTranslation } from 'react-i18next';

import { monthlyRecurringStats } from './occurrences';

import { StatCard } from '@/components/stat-card';
import { formKey } from '@/i18n';
import { formatDate, formatMonthName, monthRange } from '@/lib/date';
import { formatCents } from '@/lib/money';

export interface RecurrencesSummaryProps {
  rules: RecurrenceRuleDto[];
}

/** The four `.stat` cards atop the screen (`prototypes/approved/12-recurrences.html`) — a
 * projection from the rule definitions themselves, computed client-side rather than fetched, since
 * there's no materialized-transaction total to read before this month's entries are even generated
 * (generation is login-triggered, `prototypes/memory/12-recurrences.md`). */
export function RecurrencesSummary({ rules }: RecurrencesSummaryProps) {
  const { t } = useTranslation();
  const now = new Date();
  const { start, end } = monthRange(now);
  const monthName = formatMonthName(now);

  const stats = monthlyRecurringStats(rules, start, end, now);

  return (
    <div className="mb-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t(formKey('recurrences.summary.expenseIn'), { month: monthName })}
          value={formatCents(-stats.expenseTotal, { sign: true })}
          className="text-destructive"
        />
        <StatCard
          label={t(formKey('recurrences.summary.incomeIn'), { month: monthName })}
          value={formatCents(stats.incomeTotal, { sign: true })}
          className="text-emerald-700"
        />
        <StatCard label={t(formKey('recurrences.summary.installmentsOwed'))} value={formatCents(stats.installmentsOwed)} />
        <StatCard label={t(formKey('recurrences.summary.nextGeneration'))} value={stats.nextGeneration ? formatDate(stats.nextGeneration) : '—'} />
      </div>
      <p className="mt-2.5 text-[12.5px] text-muted-foreground">{t(formKey('recurrences.summary.note'))}</p>
    </div>
  );
}
