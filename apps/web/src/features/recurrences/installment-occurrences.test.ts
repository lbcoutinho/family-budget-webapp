import { describe, expect, it } from 'vitest';

import { installmentOccurrenceDates } from './installment-occurrences';

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('installmentOccurrenceDates', () => {
  it('returns count consecutive monthly dates from the first payment', () => {
    const dates = installmentOccurrenceDates('2026-08-05', 3);

    expect(dates.map((d) => ymd(d.date))).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
  });

  it('clamps a day-31 first payment in a shorter month', () => {
    const dates = installmentOccurrenceDates('2026-01-31', 2);

    expect(dates[0]!.clamped).toBe(false);
    expect(ymd(dates[1]!.date)).toBe('2026-02-28');
    expect(dates[1]!.clamped).toBe(true);
  });
});
