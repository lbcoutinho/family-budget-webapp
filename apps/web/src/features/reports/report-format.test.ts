import { describe, expect, it } from 'vitest';

import { averageDelta, formatPercent, formatSignedPercent, formatWholeEuros, hasSubcategoryBreakdown, isFutureMonth } from './report-format';

describe('averageDelta', () => {
  it('marks an above-average expense as bad (red)', () => {
    expect(averageDelta(11_500, 10_000, 'EXPENSE')).toEqual({ percent: 15, tone: 'bad' });
  });

  it('marks a below-average expense as good (green)', () => {
    expect(averageDelta(8_500, 10_000, 'EXPENSE')).toEqual({ percent: -15, tone: 'good' });
  });

  it('marks an above-average income as good (green) — the one place income above average is good', () => {
    expect(averageDelta(11_000, 10_000, 'INCOME')).toEqual({ percent: 10, tone: 'good' });
  });

  it('marks a below-average income as bad (red)', () => {
    expect(averageDelta(9_000, 10_000, 'INCOME')).toEqual({ percent: -10, tone: 'bad' });
  });

  it('is flat when the amount exactly matches the average', () => {
    expect(averageDelta(5_000, 5_000, 'EXPENSE')).toEqual({ percent: 0, tone: 'flat' });
  });

  it('has no delta to show when the average is zero', () => {
    expect(averageDelta(1_000, 0, 'EXPENSE')).toEqual({ percent: null, tone: null });
  });
});

describe('isFutureMonth', () => {
  const now = new Date(2026, 6, 15); // July 2026

  it('treats months after the current one, in the current year, as future', () => {
    expect(isFutureMonth(2026, 6, now)).toBe(false); // July itself
    expect(isFutureMonth(2026, 7, now)).toBe(true); // August
  });

  it('treats every month of a year entirely ahead of today as future', () => {
    expect(isFutureMonth(2027, 0, now)).toBe(true);
  });

  it('treats every month of a past year as not future', () => {
    expect(isFutureMonth(2025, 11, now)).toBe(false);
  });
});

describe('hasSubcategoryBreakdown', () => {
  it('is false when the only bucket is the "no subcategory chosen" one', () => {
    expect(hasSubcategoryBreakdown([{ subcategoryId: null }])).toBe(false);
  });

  it('is true when at least one real subcategory is present', () => {
    expect(hasSubcategoryBreakdown([{ subcategoryId: null }, { subcategoryId: 'sub-1' }])).toBe(true);
  });

  it('is false for an empty list', () => {
    expect(hasSubcategoryBreakdown([])).toBe(false);
  });
});

describe('formatWholeEuros', () => {
  it('rounds cents to whole euros', () => {
    expect(formatWholeEuros(115_049)).toBe('1.150 €');
  });

  it('signs a negative value with the typographic minus', () => {
    expect(formatWholeEuros(-115_000)).toBe('−1.150 €');
  });

  it('adds an explicit plus when sign is requested', () => {
    expect(formatWholeEuros(115_000, { sign: true })).toBe('+ 1.150 €');
  });
});

describe('formatPercent / formatSignedPercent', () => {
  it('formats a plain percentage with one decimal, unsigned', () => {
    expect(formatPercent(48.8)).toBe('48,8%');
  });

  it('signs a positive delta with a leading plus', () => {
    expect(formatSignedPercent(11.9)).toBe('+11,9%');
  });

  it('signs a negative delta with the typographic minus', () => {
    expect(formatSignedPercent(-5.5)).toBe('−5,5%');
  });
});
