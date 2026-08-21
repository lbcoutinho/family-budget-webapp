/**
 * Occurrence math for the recurrences screen — a frontend port of `apps/api/.../recurrence/occurrences.ts`
 * (M7-T02, ADR-0014). Kept in lockstep with the backend on purpose: the list screen's progress column and
 * "next" date are derived client-side (the API does not expose a generated-count or next-occurrence field),
 * so a divergence here would show a number the backend would never produce.
 *
 * Local-time `Date`s throughout (unlike the backend's UTC-anchored version) — the screen only ever
 * deals with the browser's own "today", never a value read back from Prisma.
 */

import { parseDateOnly } from '@/lib/date';

export type OccurrenceFrequency = 'MONTHLY' | 'YEARLY';

export interface OccurrenceRuleLike {
  frequency: OccurrenceFrequency;
  interval: number;
  dayOfMonth: number;
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** `YYYY-MM-DD`, or null for open-ended. */
  endDate: string | null;
  /** Lifetime cap on occurrence count, or null for open-ended. */
  totalOccurrences: number | null;
  /** `YYYY-MM-DD` of the last generated occurrence, or null if never generated. */
  generatedUntil: string | null;
}

/** `min(dayOfMonth, daysInMonth)` — 31 becomes 28/29 in February, 30 in April. */
function clampDayOfMonth(year: number, month: number, dayOfMonth: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(dayOfMonth, daysInMonth);
}

export interface Occurrence {
  date: Date;
  /** True when `dayOfMonth` did not exist in this month and fell back to the last day. */
  clamped: boolean;
}

function occurrence(year: number, month: number, dayOfMonth: number): Occurrence {
  const day = clampDayOfMonth(year, month, dayOfMonth);
  return { date: new Date(year, month, day), clamped: day !== dayOfMonth };
}

/**
 * Occurrences strictly after the last generated one (or `startDate`, on the first run), up to and
 * including `until`, further bounded by `endDate` and `totalOccurrences`. Mirrors
 * `computeOccurrences` in the backend module 1:1, `alreadyGenerated` included.
 */
export function computeOccurrences(rule: OccurrenceRuleLike, until: Date, alreadyGenerated = 0): Occurrence[] {
  if (rule.totalOccurrences !== null && alreadyGenerated >= rule.totalOccurrences) {
    return [];
  }

  const step = rule.frequency === 'YEARLY' ? 12 * rule.interval : rule.interval;
  const startDate = parseDateOnly(rule.startDate);
  const endDate = rule.endDate === null ? null : parseDateOnly(rule.endDate);
  const generatedUntil = rule.generatedUntil === null ? null : parseDateOnly(rule.generatedUntil);

  let year: number;
  let month: number;

  if (generatedUntil === null) {
    year = startDate.getFullYear();
    month = startDate.getMonth();
  } else {
    year = generatedUntil.getFullYear();
    month = generatedUntil.getMonth() + step;
  }

  const occurrences: Occurrence[] = [];
  let count = alreadyGenerated;

  for (;;) {
    if (month >= 12) {
      year += Math.floor(month / 12);
      month = month % 12;
    }

    const next = occurrence(year, month, rule.dayOfMonth);

    if (next.date.getTime() > until.getTime()) break;
    if (endDate !== null && next.date.getTime() > endDate.getTime()) break;
    if (rule.totalOccurrences !== null && count >= rule.totalOccurrences) break;

    occurrences.push(next);
    count += 1;
    month += step;
  }

  return occurrences;
}

/** The full occurrence list from `startDate`, ignoring any `generatedUntil` — used for an
 * installment plan, whose every installment is materialized up front (`InstallmentsService`), so
 * "progress" means how many of them have already happened, not how many were generated. */
export function fullOccurrenceList(rule: OccurrenceRuleLike, until: Date): Occurrence[] {
  return computeOccurrences({ ...rule, generatedUntil: null }, until);
}

export interface InstallmentProgress {
  /** How many of the plan's installments fall on or before `asOf`. */
  elapsed: number;
  /** The next installment date after `asOf`, or null once every installment has happened. */
  next: Date | null;
}

/** Only meaningful when `rule.totalOccurrences` is not null (an installment plan). */
export function installmentProgress(rule: OccurrenceRuleLike, asOf: Date): InstallmentProgress {
  const total = rule.totalOccurrences ?? 0;
  const all = fullOccurrenceList(rule, parseDateOnly(rule.endDate ?? rule.startDate)).slice(0, total);
  const elapsed = all.filter((entry) => entry.date.getTime() <= asOf.getTime()).length;
  const next = all.find((entry) => entry.date.getTime() > asOf.getTime())?.date ?? null;

  return { elapsed, next };
}

/** The next occurrence an open-ended rule (no `totalOccurrences`) will generate, after its current
 * rolling horizon (`generatedUntil`). Null when the rule is inactive or has no future occurrence
 * within the lookahead window. */
export function nextRollingOccurrence(rule: OccurrenceRuleLike, lookaheadYears = 5): Date | null {
  const from = rule.generatedUntil === null ? parseDateOnly(rule.startDate) : parseDateOnly(rule.generatedUntil);
  const until = new Date(from.getFullYear() + lookaheadYears, from.getMonth(), from.getDate());

  return computeOccurrences(rule, until)[0]?.date ?? null;
}

export interface RecurringRuleLike extends OccurrenceRuleLike {
  type: 'EXPENSE' | 'INCOME';
  /** Null means a variable amount (ADR-0020) — excluded from every sum below, since there's
   * nothing to add. */
  amount: number | null;
  isActive: boolean;
}

export interface MonthlyRecurringStats {
  /** Sum of active EXPENSE rules with an occurrence in the given month. */
  expenseTotal: number;
  /** Sum of active INCOME rules with an occurrence in the given month. */
  incomeTotal: number;
  /** Sum of what's left to pay across installment plans — occurrences not yet elapsed as of
   * `asOf` — never counting an open-ended rule (`prototypes/memory/12-recurrences.md` decision 3). */
  installmentsOwed: number;
}

/** The three numbers atop the recurrences screen (`prototypes/approved/12-recurrences.html`). A
 * projection computed from the rule definitions themselves, not from materialized transactions —
 * generation is login-triggered, not a standing job, so "what's committed this month" has to be
 * knowable before anything is actually generated. */
export function monthlyRecurringStats(rules: RecurringRuleLike[], monthStart: Date, monthEnd: Date, asOf: Date): MonthlyRecurringStats {
  let expenseTotal = 0;
  let incomeTotal = 0;
  let installmentsOwed = 0;

  for (const rule of rules) {
    if (!rule.isActive) continue;

    const occursThisMonth = fullOccurrenceList(rule, monthEnd).some(
      (entry) => entry.date.getTime() >= monthStart.getTime() && entry.date.getTime() <= monthEnd.getTime(),
    );

    if (occursThisMonth && rule.amount !== null) {
      if (rule.type === 'EXPENSE') expenseTotal += rule.amount;
      else incomeTotal += rule.amount;
    }

    if (rule.totalOccurrences !== null) {
      const progress = installmentProgress(rule, asOf);
      const remaining = rule.totalOccurrences - progress.elapsed;
      if (remaining > 0 && rule.amount !== null) installmentsOwed += remaining * rule.amount;
    }
  }

  return { expenseTotal, incomeTotal, installmentsOwed };
}
