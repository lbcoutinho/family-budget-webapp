import { describe, expect, it } from 'vitest';

import {
  computeOccurrences,
  fullOccurrenceList,
  installmentProgress,
  monthlyRecurringStats,
  nextRollingOccurrence,
  type OccurrenceRuleLike,
  type RecurringRuleLike,
} from './occurrences';

// `Date`s here are local-time (no UTC anchoring, unlike the backend module), so formatting them
// through `toISOString` would shift the day whenever the test runner's zone is not UTC.
function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rule(overrides: Partial<OccurrenceRuleLike> = {}): OccurrenceRuleLike {
  return {
    frequency: 'MONTHLY',
    interval: 1,
    dayOfMonth: 5,
    startDate: '2026-01-05',
    endDate: null,
    totalOccurrences: null,
    generatedUntil: null,
    ...overrides,
  };
}

function recurringRule(overrides: Partial<RecurringRuleLike> = {}): RecurringRuleLike {
  return { ...rule(), type: 'EXPENSE', amount: 1000, isActive: true, ...overrides };
}

describe('computeOccurrences', () => {
  it('starts at startDate on the first run and steps monthly', () => {
    const occurrences = computeOccurrences(rule(), new Date(2026, 3, 30));

    expect(occurrences.map((o) => ymd(o.date))).toEqual(['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05']);
  });

  it('resumes one step after generatedUntil, never repeating an occurrence', () => {
    const occurrences = computeOccurrences(rule({ generatedUntil: '2026-02-05' }), new Date(2026, 3, 30));

    expect(occurrences.map((o) => ymd(o.date))).toEqual(['2026-03-05', '2026-04-05']);
  });

  it('steps yearly by 12 * interval months', () => {
    const occurrences = computeOccurrences(rule({ frequency: 'YEARLY', dayOfMonth: 15, startDate: '2026-11-15' }), new Date(2029, 0, 1));

    expect(occurrences.map((o) => ymd(o.date))).toEqual(['2026-11-15', '2027-11-15', '2028-11-15']);
  });

  it('clamps day 31 to the last day of a shorter month and flags it', () => {
    const occurrences = computeOccurrences(rule({ dayOfMonth: 31, startDate: '2026-01-31' }), new Date(2026, 1, 28));

    expect(occurrences).toHaveLength(2);
    expect(occurrences[0]!.clamped).toBe(false);
    expect(ymd(occurrences[1]!.date)).toBe('2026-02-28');
    expect(occurrences[1]!.clamped).toBe(true);
  });

  it('stops at endDate', () => {
    const occurrences = computeOccurrences(rule({ endDate: '2026-03-01' }), new Date(2026, 11, 31));

    expect(occurrences.map((o) => ymd(o.date))).toEqual(['2026-01-05', '2026-02-05']);
  });

  it('stops once totalOccurrences is reached, counting alreadyGenerated', () => {
    const occurrences = computeOccurrences(rule({ totalOccurrences: 3 }), new Date(2027, 0, 1), 2);

    expect(occurrences).toHaveLength(1);
  });

  it('returns nothing once alreadyGenerated already meets totalOccurrences', () => {
    expect(computeOccurrences(rule({ totalOccurrences: 2 }), new Date(2027, 0, 1), 2)).toEqual([]);
  });
});

describe('fullOccurrenceList', () => {
  it('ignores generatedUntil and always starts from startDate', () => {
    const occurrences = fullOccurrenceList(rule({ generatedUntil: '2026-02-05', totalOccurrences: 3 }), new Date(2027, 0, 1));

    expect(occurrences.map((o) => ymd(o.date))).toEqual(['2026-01-05', '2026-02-05', '2026-03-05']);
  });
});

describe('installmentProgress', () => {
  it('counts installments on or before asOf as elapsed and finds the next one', () => {
    const plan = rule({ totalOccurrences: 12, endDate: '2026-12-05' });

    const progress = installmentProgress(plan, new Date(2026, 3, 10));

    expect(progress.elapsed).toBe(4);
    expect(progress.next && ymd(progress.next)).toBe('2026-05-05');
  });

  it('returns next: null once every installment has already happened', () => {
    const plan = rule({ totalOccurrences: 2, endDate: '2026-02-05' });

    const progress = installmentProgress(plan, new Date(2026, 11, 1));

    expect(progress.elapsed).toBe(2);
    expect(progress.next).toBeNull();
  });
});

describe('nextRollingOccurrence', () => {
  it('returns the occurrence right after generatedUntil for an open-ended rule', () => {
    const openEnded = rule({ generatedUntil: '2026-05-05' });
    const next = nextRollingOccurrence(openEnded);

    expect(next && ymd(next)).toBe('2026-06-05');
  });

  it('returns startDate itself when the rule has never generated', () => {
    const next = nextRollingOccurrence(rule());

    expect(next && ymd(next)).toBe('2026-01-05');
  });
});

describe('monthlyRecurringStats', () => {
  const monthStart = new Date(2026, 7, 1);
  const monthEnd = new Date(2026, 7, 31);
  const asOf = new Date(2026, 7, 15);

  it('sums active expense and income rules with an occurrence in the given month', () => {
    const rent = recurringRule({ type: 'EXPENSE', amount: 95000, dayOfMonth: 1 });
    const salary = recurringRule({ type: 'INCOME', amount: 320000, dayOfMonth: 3 });

    const stats = monthlyRecurringStats([rent, salary], monthStart, monthEnd, asOf);

    expect(stats.expenseTotal).toBe(95000);
    expect(stats.incomeTotal).toBe(320000);
  });

  it('ignores an inactive rule and a rule with no occurrence in the month', () => {
    const inactive = recurringRule({ type: 'EXPENSE', amount: 1000, isActive: false });
    const yearly = recurringRule({ type: 'EXPENSE', amount: 2000, frequency: 'YEARLY', startDate: '2026-11-15', dayOfMonth: 15 });

    const stats = monthlyRecurringStats([inactive, yearly], monthStart, monthEnd, asOf);

    expect(stats.expenseTotal).toBe(0);
  });

  it('skips a variable-amount (amountless) rule instead of adding null', () => {
    const variable = recurringRule({ type: 'EXPENSE', amount: null, dayOfMonth: 1 });

    const stats = monthlyRecurringStats([variable], monthStart, monthEnd, asOf);

    expect(stats.expenseTotal).toBe(0);
  });

  it('sums only what remains unpaid across installment plans, never an open-ended rule', () => {
    const plan = recurringRule({ type: 'EXPENSE', amount: 5000, totalOccurrences: 12, endDate: '2026-12-10', dayOfMonth: 10, startDate: '2026-01-10' });
    const endless = recurringRule({ type: 'EXPENSE', amount: 6250, dayOfMonth: 10 });

    const stats = monthlyRecurringStats([plan, endless], monthStart, monthEnd, asOf);

    // asOf = 2026-08-15: Jan..Aug 10th have elapsed (8 of 12), 4 remain.
    expect(stats.installmentsOwed).toBe(4 * 5000);
  });

  it('finds the earliest next occurrence across every active rule', () => {
    const soon = recurringRule({ dayOfMonth: 20, generatedUntil: '2026-08-01' });
    const later = recurringRule({ dayOfMonth: 25, generatedUntil: '2026-08-01' });

    const stats = monthlyRecurringStats([later, soon], monthStart, monthEnd, asOf);

    expect(stats.nextGeneration?.getDate()).toBe(20);
  });

  it('returns nextGeneration: null with no active rules', () => {
    const stats = monthlyRecurringStats([recurringRule({ isActive: false })], monthStart, monthEnd, asOf);

    expect(stats.nextGeneration).toBeNull();
  });
});
