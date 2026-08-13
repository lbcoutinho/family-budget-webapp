import { describe, expect, it } from 'vitest';

import { currentMonthPath, formatMonth, monthFromPathParams, monthPath, monthRange, startOfMonth } from './date';

describe('startOfMonth', () => {
  it('normalizes any day of the month to the first, at midnight', () => {
    const start = startOfMonth(new Date(2026, 6, 23, 18, 42, 7, 500));

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('stays in the local day, not in UTC — the first of the month is a label, not an instant', () => {
    // 23:30 local on the 1st is already the 2nd in UTC for anyone east of Greenwich, and the 1st
    // becomes the previous month's 30th for anyone far enough west.
    expect(startOfMonth(new Date(2026, 0, 1, 23, 30)).getMonth()).toBe(0);
    expect(startOfMonth(new Date(2026, 0, 1, 0, 30)).getMonth()).toBe(0);
  });
});

describe('formatMonth', () => {
  it('names the month in pt-BR, capitalized as a title', () => {
    expect(formatMonth(new Date(2026, 6, 15))).toBe('Julho de 2026');
    expect(formatMonth(new Date(2026, 0, 1))).toBe('Janeiro de 2026');
    expect(formatMonth(new Date(2025, 11, 31))).toBe('Dezembro de 2025');
  });
});

describe('monthRange', () => {
  it('covers the whole month, inclusive at both ends', () => {
    const { start, end } = monthRange(new Date(2026, 6, 15));

    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
    expect(end.getMonth()).toBe(6);
  });

  it('gets February right, leap year included', () => {
    expect(monthRange(new Date(2026, 1, 10)).end.getDate()).toBe(28);
    expect(monthRange(new Date(2028, 1, 10)).end.getDate()).toBe(29);
  });

  it('does not spill into the next year in December', () => {
    const { start, end } = monthRange(new Date(2026, 11, 5));

    expect(start.getMonth()).toBe(11);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
    expect(end.getFullYear()).toBe(2026);
  });
});

describe('month URL helpers', () => {
  it('builds a canonical, zero-padded path from a month label', () => {
    expect(monthPath(new Date(2026, 0, 27))).toBe('/month/2026/01');
    expect(monthPath(new Date(9, 10, 1))).toBe('/month/0009/11');
  });

  it('uses the local current month for the month redirect', () => {
    expect(currentMonthPath(new Date(2026, 7, 14, 23, 59))).toBe('/month/2026/08');
  });

  it('parses canonical route parameters as a local reference month', () => {
    expect(monthFromPathParams('2026', '02')).toEqual(new Date(2026, 1, 1));
  });

  it.each([
    ['2026', '2'],
    ['2026', '00'],
    ['2026', '13'],
    ['0000', '01'],
    ['202x', '01'],
    [undefined, '01'],
  ])('rejects malformed or out-of-range route parameters %s/%s', (year, month) => {
    expect(monthFromPathParams(year, month)).toBeUndefined();
  });
});
